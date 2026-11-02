// 草原の3D箱庭。風にゆれる草花、やわらかい光、歩きまわるキャラクター。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CHARACTERS } from './characters.js';
import { readMove, takeJump } from './controls.js';
import { createTown, isTownSpot } from './town.js';
import { currentProfile, onChange } from './store.js';
import { levelInfo, totalXp } from './progress.js';

const GROUND_RADIUS = 34;
const WALK_RADIUS = 12;   // ひとりで散歩するときのはんい
const ROAM_RADIUS = 28;   // 自分で動かすときに行けるはんい
const GRASS_COUNT = 7000;
const FLOWER_COUNT = 450;

const normName = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

export function createWorld(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const skyColor = new THREE.Color(0xd8eefa);
  scene.background = skyColor;
  scene.fog = new THREE.Fog(skyColor, 22, 60);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  const view = { angle: 0, dist: 13, height: 7.5, target: new THREE.Vector3() };

  scene.add(new THREE.HemisphereLight(0xfff6e0, 0x7fb069, 1.7));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.6);
  sun.position.set(10, 16, 6);
  scene.add(sun);

  const time = { value: 0 };

  // 地面
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(GROUND_RADIUS, 64),
    new THREE.MeshLambertMaterial({ color: 0x9ccf73 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  scene.add(makeGrass(time));
  scene.add(makeFlowers());
  makeTrees().forEach((t) => scene.add(t));
  const motes = makeLightMotes();
  scene.add(motes);

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
    const lv = p ? levelInfo(totalXp(p)).lv : 1;
    if (lv !== shownLv) { town.setLevel(lv, shownLv > 0); shownLv = lv; }
  };
  refreshTown();
  onChange(refreshTown);

  const actor = createActor(scene, CHARACTERS.piyo, town);

  // 操作: タップで移動、ドラッグでまわす
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let drag = null;
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, angle: view.angle, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 8 || Math.abs(e.clientY - drag.y) > 8) drag.moved = true;
    if (drag.moved) view.angle = drag.angle - dx * 0.008;
  });
  canvas.addEventListener('pointerup', (e) => {
    if (drag && !drag.moved) {
      const rect = canvas.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(ground)[0];
      if (hit) {
        const p = hit.point.clone();
        p.y = 0;
        if (p.length() > ROAM_RADIUS) p.setLength(ROAM_RADIUS);
        actor.walkTo(p);
        marker.position.set(p.x, 0.03, p.z);
        marker.material.opacity = 0.9;
      }
    }
    drag = null;
  });
  canvas.addEventListener('pointercancel', () => { drag = null; });

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
    const dt = Math.min(clock.getDelta(), 0.05);
    time.value += dt;
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
    marker.material.opacity = Math.max(0, marker.material.opacity - dt * 1.2);
    motes.userData.update(time.value);
    town.update(dt, time.value);

    view.target.lerp(actor.position, 0.04);
    camera.position.set(
      view.target.x + Math.sin(view.angle) * view.dist,
      view.height,
      view.target.z + Math.cos(view.angle) * view.dist,
    );
    camera.lookAt(view.target.x, 0.8, view.target.z);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  return {
    setActive(on) {
      if (on === running) return;
      running = on;
      if (on) { clock.getDelta(); resize(); requestAnimationFrame(frame); }
    },
    celebrate() { actor.jump(); },
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
        if (t > state.nextWander && state.manual <= 0) {
          const a = Math.random() * Math.PI * 2;
          const r = 2 + Math.random() * (WALK_RADIUS - 4);
          state.target = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
          state.nextWander = 5 + Math.random() * 6;
        }
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

// ---- 景色 ---------------------------------------------------------------

function randomInDisc(radius, min = 0) {
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(min * min + Math.random() * (radius * radius - min * min));
  return [Math.cos(a) * r, Math.sin(a) * r];
}

// 街の建物を置く場所をよけて選ぶ
function freeSpot(radius, min = 0, pad = 0) {
  let p = randomInDisc(radius, min);
  for (let i = 0; i < 8 && isTownSpot(p[0], p[1], pad); i++) p = randomInDisc(radius, min);
  return p;
}

function makeGrass(time) {
  const height = 0.42;
  const geo = new THREE.PlaneGeometry(0.07, height, 1, 4);
  geo.translate(0, height / 2, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setX(i, pos.getX(i) * (1 - y / height));
  }
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float k = clamp(position.y / ${height.toFixed(2)}, 0.0, 1.0);
      vec4 root = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float wave = sin(uTime * 1.7 + root.x * 0.35 + root.z * 0.22) * 0.6
                 + sin(uTime * 3.1 + root.x * 1.3) * 0.25;
      transformed.x += wave * k * k * 0.16;
      transformed.z += wave * k * k * 0.06;`,
    );
  };
  const mesh = new THREE.InstancedMesh(geo, mat, GRASS_COUNT);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < GRASS_COUNT; i++) {
    const [x, z] = freeSpot(GROUND_RADIUS - 6);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI);
    const k = 0.6 + Math.random() * 0.8;
    s.set(1, k, 1);
    m.compose(new THREE.Vector3(x, 0, z), q, s);
    mesh.setMatrixAt(i, m);
    c.setHSL(0.24 + Math.random() * 0.06, 0.45 + Math.random() * 0.2, 0.42 + Math.random() * 0.14);
    mesh.setColorAt(i, c);
  }
  return mesh;
}

function makeFlowers() {
  const geo = new THREE.IcosahedronGeometry(0.075, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), FLOWER_COUNT);
  const colors = [0xffb6d0, 0xffffff, 0xfff08a, 0xd9c2ff, 0xffd1a8];
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  for (let i = 0; i < FLOWER_COUNT; i++) {
    const [x, z] = freeSpot(GROUND_RADIUS - 8);
    m.makeTranslation(x, 0.28 + Math.random() * 0.15, z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.set(colors[i % colors.length]));
  }
  return mesh;
}

function makeTrees() {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0xa47c5b });
  const leafMats = [0x7cc06a, 0x8fd07a, 0x6db35e].map((color) => new THREE.MeshLambertMaterial({ color, flatShading: true }));
  const trees = [];
  for (let i = 0; i < 10; i++) {
    const [x, z] = freeSpot(GROUND_RADIUS - 6, 15, 1.5);
    const t = new THREE.Group();
    const h = 1.2 + Math.random() * 0.8;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, h, 8), trunkMat);
    trunk.position.y = h / 2;
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1 + Math.random() * 0.5, 1), leafMats[i % 3]);
    leaf.position.y = h + 0.6;
    t.add(trunk, leaf);
    t.position.set(x, 0, z);
    trees.push(t);
  }
  return trees;
}

function makeLightMotes() {
  const count = 120;
  const base = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const [x, z] = randomInDisc(16);
    base.set([x, 0.5 + Math.random() * 3, z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xfffbe0, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false,
  }));
  points.userData.update = (t) => {
    const p = geo.attributes.position;
    for (let i = 0; i < count; i++) {
      p.setX(i, base[i * 3] + Math.sin(t * 0.4 + i) * 0.4);
      p.setY(i, base[i * 3 + 1] + Math.sin(t * 0.7 + i * 1.7) * 0.3);
    }
    p.needsUpdate = true;
  };
  return points;
}
