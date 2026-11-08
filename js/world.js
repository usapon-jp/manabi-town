// 草原の3D箱庭。風にゆれる草花、やわらかい光、歩きまわるキャラクター。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CHARACTERS } from './characters.js';
import { readMove, takeJump } from './controls.js';
import { createTown } from './town.js';
import { createMeadow } from './meadow.js';
import { heightAt } from './terrain.js';
import { createEditor } from './editor.js';
import { currentProfile, onChange } from './store.js';
import { levelOf } from './progress.js';
import { loadQuality, saveLowQuality, SLOW_FRAME_SEC, WARMUP_FRAMES, SAMPLE_FRAMES } from './quality.js';

const WALK_RADIUS = 12;   // ひとりで散歩するときのはんい
const ROAM_RADIUS = 28;   // 自分で動かすときに行けるはんい

const normName = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

export function createWorld(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  let quality = loadQuality();   // 'high' か 'low'（ふるい端末では草や花をへらす）
  const pixelRatio = () => (quality === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setPixelRatio(pixelRatio());
  container.appendChild(renderer.domElement);

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 220);
  const view = { angle: 0, dist: 11, height: 4.6, target: new THREE.Vector3() };

  // 絵本のような草原（空・雲海・草・花・木・ちょうちょ）
  const meadow = createMeadow(scene);
  meadow.setQuality(quality);
  const ground = meadow.ground;
  const time = { value: 0 };

  // タップした場所のしるし
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.25, 0.36, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.03;
  scene.add(marker);

  // 勉強したぶんだけ街が育つ（レベルに合わせて建物がふえる）
  const town = createTown(scene);
  let shownLv = 0;
  const refreshTown = () => {
    const p = currentProfile();
    const lv = p ? levelOf(p).lv : 1;
    if (lv !== shownLv) {
      const fresh = town.setLevel(lv, shownLv > 0);
      shownLv = lv;
      if (fresh.length) editor.announce(lv, fresh);   // あたらしい たてものが出たら、おしらせ
      // レベル3から町に池がある。そこへ溝をつなぐと、水がながれこむ
      meadow.cut.setSources(lv >= 3 ? [{ x: -9.5, z: 3.5, r: 2.7 }] : []);
      meadow.cut.updateWater();
    }
  };
  refreshTown();
  onChange(refreshTown);

  const actor = createActor(scene, CHARACTERS.piyo, town);

  // 操作: ドラッグでまわす（移動はスティック）
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let drag = null;
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'none';
  // 「つくる」: 草をかって道をつくるなど、子どもが草原を作りかえる（editor.js）
  const editor = createEditor({
    container, scene, cut: meadow.cut, wind: meadow.wind, setWalls: (list) => town.setWalls(list), town,
    onCelebrate: () => { setTimeout(() => actor.jump(), 400); },
    toScreen: (x, y, z) => {
      const v = new THREE.Vector3(x, heightAt(x, z) + y, z).project(camera);
      if (v.z > 1) return null;
      const rect = canvas.getBoundingClientRect();
      const d = camera.position.distanceTo(new THREE.Vector3(x, y, z));
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height, scale: (rect.height / 2) / (Math.tan((camera.fov * Math.PI) / 360) * d) };
    },
    rotate: (d) => { view.angle += d; },
    pick: (e) => {
      const rect = canvas.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(ground)[0];
      return hit ? { x: hit.point.x, z: hit.point.z } : null;
    },
  });
  // 2本指: ピンチで カメラを ちかづける／はなす。2本指の あいだは「つくる」の なぞりは しない
  let wasEditing = false; let savedDist = 0;
  const touches = new Map();
  let pinch = null;          // { d0, dist0, h0 }
  let multi = false;         // 2本指に なったら、指が ぜんぶ はなれるまで なぞらない
  const fingerGap = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  function zoomTo(dist) {
    const d = Math.min(26, Math.max(6, dist));
    view.height = view.height * (d / view.dist);
    view.dist = d;
  }
  canvas.addEventListener('pointerdown', (e) => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* 古い端末 */ }
    if (touches.size >= 2) {
      if (editor.active && !multi) editor.pointer('cancel');   // かきかけの 1本目は なかったことに
      multi = true; drag = null;
      pinch = { d0: fingerGap(), dist0: view.dist };
      return;
    }
    if (editor.active) { editor.pointer('down', e); return; }
    drag = { x: e.clientX, y: e.clientY, angle: view.angle, h0: view.height, moved: false };
  });
  const lift = (e) => { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; if (!touches.size) multi = false; };
  canvas.addEventListener('pointermove', (e) => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && touches.size >= 2) { zoomTo(pinch.dist0 * (pinch.d0 / fingerGap())); return; }
    if (multi) return;
    if (editor.active) { editor.pointer('move', e); return; }
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 8 || Math.abs(e.clientY - drag.y) > 8) drag.moved = true;
    if (drag.moved) {
      view.angle = drag.angle - dx * 0.008;
      // 上下に うごかすと、見おろす 角度が かわる（下へ ドラッグ＝上から 見る）
      view.height = Math.min(view.dist * 1.3, Math.max(view.dist * 0.12, drag.h0 + (e.clientY - drag.y) * 0.02 * (view.dist / 11)));
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    const wasMulti = multi;
    lift(e);
    if (wasMulti) { drag = null; return; }
    if (editor.active) { editor.pointer('up', e); return; }
    // タップした場所へ歩く機能は なし（2026-11-02 フミオさん）。ドラッグでまわすだけ
    if (drag && !drag.moved) editor.tapWorld?.(e);   // 柵の道具を持っているとき、置いた柵をタップでしまう
    drag = null;
  });
  canvas.addEventListener('pointercancel', (e) => { lift(e); drag = null; if (editor.active) editor.pointer('cancel'); });
  // パソコン: ホイールで ちかづける／はなす
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomTo(view.dist * (e.deltaY > 0 ? 1.1 : 1 / 1.1)); }, { passive: false });

  const perf = { frames: 0, sum: 0 };
  function setQuality(q, save) {
    quality = q;
    meadow.setQuality(q);
    renderer.setPixelRatio(pixelRatio());
    resize();
    if (save) saveLowQuality();
  }

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  const clock = new THREE.Clock();
  let running = false;
  function frame() {
    if (!running) return;
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    time.value += dt;
    // カクカクしていたら、自動で「ひかえめ」の画質に下げて、つぎからもそうする
    if (quality === 'high' && rawDt < 2.0) {   // タブを閉じていた直後の長い空白は数えない
      perf.frames += 1;
      if (perf.frames > WARMUP_FRAMES) perf.sum += Math.min(rawDt, 0.5);
      if (perf.frames >= WARMUP_FRAMES + SAMPLE_FRAMES) {
        if (perf.sum / SAMPLE_FRAMES > SLOW_FRAME_SEC) setQuality('low', true);
        else { perf.frames = WARMUP_FRAMES; perf.sum = 0; }
      }
    }
    const move = readMove();
    // カメラから見た向き: スティックの上 = 画面の奥
    const fx = -Math.sin(view.angle); const fz = -Math.cos(view.angle);
    const rx = Math.cos(view.angle); const rz = -Math.sin(view.angle);
    actor.update(dt, {
      x: rx * move.x + fx * move.y,
      z: rz * move.x + fz * move.y,
      mag: move.mag,
      dash: move.dash,
      jump: takeJump(),
    });
    editor.tick(dt, actor.position, move.dash, actor.heading);
    editor.update(time.value);
    marker.material.opacity = Math.max(0, marker.material.opacity - dt * 1.2);
    town.update(dt, time.value, camera.position);

    // 「つくる」の あいだは、すこし ひいて ひろく 見る（おわったら もとの きょりに）
    if (editor.active !== wasEditing) {
      wasEditing = editor.active;
      if (wasEditing) { savedDist = view.dist; zoomTo(Math.max(view.dist, 16)); } else if (savedDist) { zoomTo(savedDist); savedDist = 0; }
    }
    view.target.lerp(actor.position, 0.04);
    camera.position.set(
      view.target.x + Math.sin(view.angle) * view.dist,
      view.target.y + view.height,
      view.target.z + Math.cos(view.angle) * view.dist,
    );
    camera.lookAt(view.target.x, view.target.y + 1.5, view.target.z);
    meadow.update(dt, time.value, actor.position, camera.position);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  return {
    setActive(on) {
      if (on === running) return;
      running = on;
      editor.setVisible(on);
      if (on) { clock.getDelta(); resize(); requestAnimationFrame(frame); }
    },
    celebrate() { actor.jump(); },
    quality: () => quality,
    warp(x, z, angle, dist, face) { actor.position.set(x, heightAt(x, z), z); view.target.copy(actor.position); if (angle != null) view.angle = angle; if (dist) view.dist = dist; if (face != null) actor.face(face); },
  };
}

// ---- キャラクター -------------------------------------------------------

function createActor(scene, config, town) {
  const root = new THREE.Group();
  scene.add(root);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(config.height * 0.38, 24),
    new THREE.MeshBasicMaterial({ color: 0x3d6b2a, transparent: true, opacity: 0.25, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  scene.add(shadow);

  const body = new THREE.Group();
  root.add(body);
  let bones = {};
  const base = {};

  new GLTFLoader().load(
    config.model,
    (gltf) => {
      const model = gltf.scene;
      model.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const s = config.height / (size.y || 1);
      model.scale.setScalar(s);
      model.position.y = -box.min.y * s;
      body.add(model);
      const byName = {};
      model.traverse((o) => { if (o.isBone) byName[normName(o.name)] = o; });
      for (const [key, name] of Object.entries(config.bones)) {
        const b = byName[normName(name)];
        if (b) { bones[key] = b; base[key] = b.rotation.clone(); }
      }
    },
    undefined,
    () => body.add(fallbackChick(config)),
  );

  const state = { target: null, phase: 0, idle: 0, nextWander: 3, jumpT: -1, y: 0, vy: 0, airJumps: 0, manual: 0, stuck: 0 };
  const GRAVITY = 22;
  const JUMP_V = 7.2;

  function rot(key, axis, value) {
    const b = bones[key];
    if (b) b.rotation[axis] = base[key][axis] + value;
  }

  return {
    position: root.position,
    get heading() { return root.rotation.y; },
    face(a) { root.rotation.y = a; },
    walkTo(p) { state.target = p.clone(); },
    jump() { state.jumpT = 0; },
    update(dt, ctl = { x: 0, z: 0, mag: 0, dash: false, jump: false }) {
      const w = config.walk;
      let walking = false;
      let speedK = 1;

      if (ctl.mag > 0.05) {
        // 自分で動かしている
        state.target = null;
        state.manual = 8; // 手をはなしてから8秒は、ひとりで散歩しない
        state.idle = 0;
        walking = true;
        speedK = (ctl.dash ? 2.4 : 1.25) * Math.max(0.35, ctl.mag);
        const len = Math.hypot(ctl.x, ctl.z) || 1;
        root.position.x += (ctl.x / len) * config.speed * speedK * dt;
        root.position.z += (ctl.z / len) * config.speed * speedK * dt;
        const r = Math.hypot(root.position.x, root.position.z);
        if (r > ROAM_RADIUS) root.position.multiplyScalar(ROAM_RADIUS / r);
        const want = Math.atan2(ctl.x, ctl.z);
        let diff = want - root.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        root.rotation.y += diff * Math.min(1, dt * 12);
      } else if (state.target) {
        const d = state.target.clone().sub(root.position);
        d.y = 0;
        const dist = d.length();
        if (dist < 0.05) {
          state.target = null;
        } else {
          walking = true;
          const step = Math.min(dist, config.speed * dt);
          root.position.addScaledVector(d.normalize(), step);
          const want = Math.atan2(d.x, d.z);
          let diff = want - root.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          root.rotation.y += diff * Math.min(1, dt * 8);
        }
      }
      state.manual = Math.max(0, state.manual - dt);

      root.position.y = heightAt(root.position.x, root.position.z);

      // 建物や池には入れない。ぶつかったままの行き先はあきらめる
      if (town.pushOut(root.position)) {
        state.stuck += dt;
        if (state.stuck > 0.8) { state.target = null; state.stuck = 0; }
      } else {
        state.stuck = 0;
      }

      // ジャンプ（空中でもう1回とべる）
      const onGround = state.y <= 0.0001;
      if (ctl.jump && (onGround || state.airJumps < 1)) {
        if (!onGround) state.airJumps += 1;
        state.vy = JUMP_V;
      }
      if (!onGround || state.vy > 0) {
        state.vy -= GRAVITY * dt;
        state.y = Math.max(0, state.y + state.vy * dt);
        if (state.y === 0) { state.vy = 0; state.airJumps = 0; }
      }
      const inAir = state.y > 0.0001;

      if (walking) {
        state.idle = 0;
        state.phase += dt * 9 * Math.min(1.8, Math.max(0.7, speedK));
        const s = Math.sin(state.phase);
        rot('leftLeg', 'x', s * w.legSwing);
        rot('rightLeg', 'x', -s * w.legSwing);
        rot('leftArm', 'z', Math.abs(s) * w.armFlap);
        rot('rightArm', 'z', -Math.abs(s) * w.armFlap);
        rot('head', 'z', s * 0.06);
        body.position.y = Math.abs(Math.sin(state.phase)) * w.bob;
      } else {
        state.idle += dt;
        const t = state.idle;
        rot('leftLeg', 'x', 0);
        rot('rightLeg', 'x', 0);
        rot('leftArm', 'z', 0.1 + Math.sin(t * 2) * 0.05);
        rot('rightArm', 'z', -0.1 - Math.sin(t * 2) * 0.05);
        rot('head', 'z', Math.sin(t * 0.8) * 0.12);
        rot('spine', 'x', Math.sin(t * 2.2) * 0.03);
        body.position.y = 0;
        // 勝手に歩き出す動きは なし（2026-11-02 フミオさん）。スティックで動かしたときだけ歩く
      }

      // よろこびジャンプ（2回）
      if (state.jumpT >= 0) {
        state.jumpT += dt;
        const k = state.jumpT / 0.45;
        if (k >= 2) {
          state.jumpT = -1;
        } else {
          body.position.y += Math.sin((k % 1) * Math.PI) * 0.5;
          rot('leftArm', 'z', 0.9);
          rot('rightArm', 'z', -0.9);
        }
      }

      if (inAir) {
        // 空中: 手をパタパタ、足をそろえる
        const flap = Math.sin(performance.now() / 60) * 0.5;
        rot('leftArm', 'z', 0.9 + flap);
        rot('rightArm', 'z', -0.9 - flap);
        rot('leftLeg', 'x', -0.3);
        rot('rightLeg', 'x', -0.3);
      }
      body.position.y += state.y;

      shadow.position.x = root.position.x;
      shadow.position.z = root.position.z;
      shadow.position.y = root.position.y + 0.06;
      shadow.scale.setScalar(Math.max(0.35, 1 - Math.min(body.position.y, 1.5) * 0.4));
    },
  };
}

function fallbackChick(config) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: config.fallbackColor });
  const h = config.height;
  const b = new THREE.Mesh(new THREE.SphereGeometry(h * 0.35, 24, 16), mat);
  b.position.y = h * 0.35;
  const head = new THREE.Mesh(new THREE.SphereGeometry(h * 0.25, 24, 16), mat);
  head.position.y = h * 0.78;
  const beak = new THREE.Mesh(new THREE.ConeGeometry(h * 0.06, h * 0.12, 12), new THREE.MeshLambertMaterial({ color: 0xff9a3c }));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, h * 0.76, h * 0.26);
  g.add(b, head, beak);
  return g;
}
