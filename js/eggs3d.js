// 教科の たまご・なかま・たね・建物の 3D。きまりと保存は js/eggs.js、画面（カード・ことば）は js/eggui.js。
// ここは「いまの すがた（setView で もらう）」を 草原に 出して、うごかすだけ。保存には さわらない。
//
// 教科の なかまの 3Dモデルが できたら（フミオさん制作中）:
//   1. GLB を assets/models/ に置く（例: assets/models/owl.glb。sw.js の FILES にも足して VERSION を上げる）
//   2. js/eggs.js の EGGS の その教科の chara.model に パスを書く
//   モデルが ない・読めないときは、ここで 作る 教科の色の まるい 仮の すがた（たまごに 目と足）で出る。
//   保存しているのは「孵化した・うえた場所」だけ なので、差しかえても 育てた分は そのまま。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { heightAt } from './terrain.js';
import { mat, box, cyl, cone, ball, blob, softDot } from './townkit.js';
import { EGGS, NEST, PLANT } from './eggs.js';

const TAU = Math.PI * 2;
const EGG_H = 0.6;          // たまごの 高さ
const CHARA_H = 0.62;       // なかまの 背の高さ（女の子は 1.15）
const BUILD_R = 1.35;       // 建物の 歩けない 広さ
const lighten = (hex, k) => new THREE.Color(hex).lerp(new THREE.Color(0xffffff), k).getHex();
const cssOf = (hex) => `#${new THREE.Color(hex).getHexString()}`;

// ---- たまごの 形と もよう ----------------------------------------------------------------
let eggGeo = null;
function eggGeometry() {
  if (eggGeo) return eggGeo;
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * Math.PI;
    const r = Math.sin(t) * (1 + 0.13 * Math.cos(t)) * 0.38;   // 下が ふっくら、上が すこし ほそい
    pts.push(new THREE.Vector2(Math.max(0.0001, r), (1 - Math.cos(t)) / 2));
  }
  eggGeo = new THREE.LatheGeometry(pts, 32);
  return eggGeo;
}
// 教科の色の もよう（まわりに 白い ぎざぎざの おび と 水玉）。crack: ひびを かく
function eggTexture(color, crack) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = cssOf(color); x.fillRect(0, 0, 256, 128);
  x.fillStyle = 'rgba(255,255,255,0.85)';
  x.beginPath(); x.moveTo(0, 62);
  for (let i = 0; i <= 16; i++) x.lineTo(i * 16, i % 2 ? 54 : 70);
  x.lineTo(256, 78); for (let i = 16; i >= 0; i--) x.lineTo(i * 16, (i % 2 ? 54 : 70) + 12); x.closePath(); x.fill();
  x.fillStyle = cssOf(lighten(color, 0.55));
  for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(16 + i * 32, i % 2 ? 30 : 100, 7, 0, TAU); x.fill(); }
  if (crack) {
    x.strokeStyle = 'rgba(90,60,40,0.85)'; x.lineWidth = 3; x.lineJoin = 'round';
    for (const ox of [40, 170]) {
      x.beginPath(); x.moveTo(ox, 18);
      [[10, 30], [-6, 44], [12, 56], [2, 66]].forEach(([dx, y]) => x.lineTo(ox + dx, y));
      x.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}
function makeEgg(def) {
  const tex = { plain: eggTexture(def.color, false), crack: eggTexture(def.color, true) };
  const m = new THREE.MeshLambertMaterial({ map: tex.plain, emissive: 0xffe2a0, emissiveIntensity: 0 });
  const mesh = new THREE.Mesh(eggGeometry(), m);
  mesh.scale.setScalar(EGG_H);
  return { mesh, tex };
}

// 頭の上の「！」（やることが あるときだけ）
let bangTex = null;
function bangSprite() {
  if (!bangTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.beginPath(); x.arc(64, 64, 58, 0, TAU); x.fill();
    x.fillStyle = '#ffcf3f'; x.beginPath(); x.arc(64, 64, 50, 0, TAU); x.fill();
    x.fillStyle = '#6b3f1d'; x.font = '900 84px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('!', 64, 70);
    bangTex = new THREE.CanvasTexture(c);
    bangTex.colorSpace = THREE.SRGBColorSpace;
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: bangTex, transparent: true, depthWrite: false, depthTest: false, fog: false }));
  s.renderOrder = 9;
  s.scale.setScalar(0.42);
  s.visible = false;
  return s;
}

// きらきら（あたたまった・生まれた・できた とき）
function sparkleSet(scene, color) {
  const list = [];
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.visible = false;
    scene.add(s);
    list.push({ s, t: 9, vx: 0, vy: 0, vz: 0, life: 1 });
  }
  return {
    burst(x, y, z, n = 14, spread = 1) {
      list.slice(0, n).forEach((p, i) => {
        const a = (i / n) * TAU + Math.random() * 0.4;
        p.t = 0; p.life = 0.9 + Math.random() * 0.6;
        p.vx = Math.cos(a) * (0.5 + Math.random()) * spread; p.vz = Math.sin(a) * (0.5 + Math.random()) * spread; p.vy = 1.2 + Math.random() * 1.4;
        p.s.position.set(x, y, z); p.s.visible = true;
      });
    },
    update(dt) {
      for (const p of list) {
        if (p.t >= p.life) { p.s.visible = false; continue; }
        p.t += dt;
        p.vy -= 1.6 * dt;
        p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
        const k = p.t / p.life;
        p.s.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.95;
        p.s.scale.setScalar(0.12 + 0.16 * (1 - k));
      }
    },
  };
}

// ---- 巣 ----------------------------------------------------------------------------
function makeNest() {
  const g = new THREE.Group();
  g.add(blob(1.25, 1.1, 0.28));
  const straw = 0xd9b26a; const dark = 0xb98d4c;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.26, 12, 40), mat(straw));
  ring.rotation.x = -Math.PI / 2; ring.scale.z = 0.62; ring.position.y = 0.13;
  g.add(ring);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.8, 32), mat(0xc79b58));
  inner.rotation.x = -Math.PI / 2; inner.position.y = 0.08;
  g.add(inner);
  // わらの すじ
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU;
    const s = cyl(0.018, 0.018, 0.46, i % 3 ? dark : 0xe8c98a, Math.cos(a) * 0.8, 0.2 + (i % 2) * 0.05, Math.sin(a) * 0.8, 5);
    s.rotation.set(0.9 * Math.sin(a * 3), a, Math.PI / 2 + 0.5 * Math.cos(a * 2));
    g.add(s);
  }
  // はっぱと 小さな 花
  for (const [x, z, c] of [[-0.95, 0.55, 0xff8fb3], [1.0, 0.4, 0xfff08a], [0.2, 1.02, 0xffffff]]) {
    g.add(ball(0.13, 0x6fb35e, x, 0.1, z), ball(0.06, c, x + 0.06, 0.2, z + 0.04));
  }
  return g;
}
// 巣の中の たまごの 場所（まえの カメラから 見やすい ように、すこし 前に 寄せる）
const eggSlot = (i) => { const a = -Math.PI / 2 + (i / 5) * TAU; return { x: Math.cos(a) * 0.5, z: Math.sin(a) * 0.46 + 0.04, tilt: 0.12 * Math.sin(i * 2.1) }; };

// ---- 教科の なかま（仮の すがた） ------------------------------------------------------------
function placeholderChara(def) {
  const g = new THREE.Group();
  const h = CHARA_H;
  const col = def.color;
  const bodyM = new THREE.Mesh(eggGeometry(), mat(lighten(col, 0.15)));
  bodyM.scale.set(h * 1.25, h, h * 1.15);
  g.add(bodyM);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.2 * h, 16, 12), mat(0xfff8ec));
  belly.scale.set(1.1, 1.25, 0.5); belly.position.set(0, h * 0.36, h * 0.36);
  g.add(belly);
  for (const sx of [-1, 1]) {
    const eye = ball(0.065 * h, 0x3a2a24, sx * 0.13 * h, h * 0.66, h * 0.4);
    const shine = ball(0.022 * h, 0xffffff, sx * 0.13 * h + 0.02 * h, h * 0.69, h * 0.44);
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.05 * h, 16), new THREE.MeshBasicMaterial({ color: 0xff9eb0, transparent: true, opacity: 0.7 }));
    cheek.position.set(sx * 0.24 * h, h * 0.56, h * 0.39); cheek.rotation.y = sx * 0.55;
    const foot = ball(0.09 * h, 0xf2a65a, sx * 0.14 * h, 0.03, h * 0.12);
    foot.scale.set(1.2, 0.55, 1.5);
    g.add(eye, shine, cheek, foot);
  }
  const dark = new THREE.Color(col).multiplyScalar(0.72).getHex();
  // 動物ごとの しるし（耳・しっぽ・はな）
  if (def.chara.kind === 'owl') {
    for (const sx of [-1, 1]) { const t = cone(0.07 * h, 0.2 * h, dark, sx * 0.2 * h, h * 0.98, 0, 8); t.rotation.z = -sx * 0.35; g.add(t); }
    const beak = cone(0.045 * h, 0.1 * h, 0xf2a65a, 0, h * 0.58, h * 0.44, 8); beak.rotation.x = Math.PI; g.add(beak);
    for (const sx of [-1, 1]) { const w = ball(0.14 * h, dark, sx * 0.4 * h, h * 0.42, 0); w.scale.set(0.45, 1, 0.8); g.add(w); }
  } else if (def.chara.kind === 'squirrel') {
    for (const sx of [-1, 1]) g.add(cone(0.06 * h, 0.14 * h, dark, sx * 0.2 * h, h * 0.97, 0, 8));
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.22 * h, 0.1 * h, 10, 20, Math.PI * 1.3), mat(dark));
    tail.position.set(0, h * 0.52, -h * 0.42); tail.rotation.set(0, Math.PI / 2, -0.9);
    g.add(tail);
    g.add(ball(0.035 * h, 0x7a4b2a, 0, h * 0.58, h * 0.45));
  } else if (def.chara.kind === 'mole') {
    g.add(ball(0.07 * h, 0xff9eb0, 0, h * 0.55, h * 0.46));
    for (const sx of [-1, 1]) { const paw = ball(0.08 * h, 0xffd3c2, sx * 0.36 * h, h * 0.3, h * 0.2); paw.scale.set(1.2, 0.6, 1); g.add(paw); }
    g.add(ball(0.045 * h, 0xfff1a0, 0, h * 1.02, 0.02));   // あたまの 上の ひかる 玉（発明家）
  } else if (def.chara.kind === 'fox') {
    for (const sx of [-1, 1]) { const e = cone(0.1 * h, 0.22 * h, dark, sx * 0.2 * h, h * 0.98, 0, 4); e.rotation.z = -sx * 0.25; g.add(e); }
    const tail = cone(0.14 * h, 0.5 * h, dark, 0, h * 0.3, -h * 0.5, 10); tail.rotation.x = -1.1; g.add(tail);
    g.add(ball(0.05 * h, 0xffffff, 0, h * 0.27, -h * 0.72));
  } else if (def.chara.kind === 'rabbit') {
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.06 * h, 0.32 * h, 4, 10), mat(lighten(col, 0.25)));
      e.position.set(sx * 0.12 * h, h * 1.12, 0); e.rotation.z = -sx * 0.18; g.add(e);
      const inr = new THREE.Mesh(new THREE.CapsuleGeometry(0.03 * h, 0.26 * h, 4, 8), mat(0xffc6d4)); inr.position.set(sx * 0.12 * h, h * 1.12, 0.035 * h); inr.rotation.z = -sx * 0.18; g.add(inr);
    }
    g.add(ball(0.03 * h, 0xff9eb0, 0, h * 0.58, h * 0.45), ball(0.09 * h, 0xffffff, 0, h * 0.25, -h * 0.42));
  }
  g.add(blob(0.32, 0.28, 0.25));
  return g;
}
function makeChara(def) {
  const g = new THREE.Group();
  if (!def.chara.model) { g.add(placeholderChara(def)); return g; }
  new GLTFLoader().load(def.chara.model, (gltf) => {
    const model = gltf.scene;
    const bb = new THREE.Box3().setFromObject(model);
    const size = bb.getSize(new THREE.Vector3());
    const s = CHARA_H * 1.15 / (size.y || 1);
    model.scale.setScalar(s);
    model.position.y = -bb.min.y * s;
    model.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    g.add(model, blob(0.32, 0.28, 0.25));
  }, undefined, () => g.add(placeholderChara(def)));
  return g;
}

// ---- 建物（たねから できる。絵本の 小さな たてもの） -------------------------------------------
function pyramidRoof(w, d, hgt, color) {
  const r = cone(Math.SQRT1_2, 1, color, 0, 0, 0, 4);
  r.rotation.y = Math.PI / 4;
  r.scale.set(w + 0.3, hgt, d + 0.3);
  return r;
}
function win(g, x, y, z, w = 0.36, hh = 0.4) {
  g.add(box(w + 0.08, hh + 0.08, 0.05, 0xffffff, x, y, z));
  const gl = box(w, hh, 0.06, 0xffe6a6, x, y, z + 0.01);
  gl.material = new THREE.MeshBasicMaterial({ color: 0xffe6a6 });
  g.add(gl);
}
function door(g, x, z, color = 0x9a6a4a) {
  g.add(box(0.44, 0.7, 0.06, color, x, 0.35, z), ball(0.03, 0xffd45c, x + 0.13, 0.36, z + 0.04));
}
const BUILDINGS = {
  // 国語: 図書館（ひらいた本の 看板・本の 山）
  library(c) {
    const g = new THREE.Group();
    g.add(blob(1.5, 1.2));
    g.add(box(2.1, 1.35, 1.5, 0xfff3dc, 0, 0.675, 0));
    const roof = pyramidRoof(2.1, 1.5, 0.95, c); roof.position.y = 1.35 + 0.47; g.add(roof);
    door(g, 0, 0.76);
    win(g, -0.62, 0.78, 0.76); win(g, 0.62, 0.78, 0.76);
    for (const sx of [-1, 1]) { const page = box(0.42, 0.04, 0.32, 0xffffff, sx * 0.21, 1.55, 0.86); page.rotation.z = sx * 0.28; page.rotation.x = 0.5; g.add(page); }
    const cover = box(0.9, 0.05, 0.36, c, 0, 1.5, 0.84); cover.rotation.x = 0.5; g.add(cover);
    const cols = [0xd78b9f, 0x7aa6bd, 0xd8b85a, 0x7f985e, 0xc98766];
    for (let i = 0; i < 5; i++) { const b = box(0.5 - i * 0.04, 0.11, 0.36, cols[i], 1.35, 0.06 + i * 0.11, 0.55); b.rotation.y = i * 0.25; g.add(b); }
    return g;
  },
  // 算数: 銀行（白い はしら・金の コイン）
  bank(c) {
    const g = new THREE.Group();
    g.add(blob(1.5, 1.2));
    g.add(box(2.0, 0.12, 1.6, 0xe9e1d0, 0, 0.06, 0.05));
    g.add(box(1.8, 1.25, 1.2, 0xf7f3ea, 0, 0.74, -0.1));
    for (let i = 0; i < 4; i++) g.add(cyl(0.08, 0.09, 1.2, 0xffffff, -0.66 + i * 0.44, 0.72, 0.62, 12));
    g.add(box(2.0, 0.12, 1.55, c, 0, 1.4, 0.05));
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.5, 3), mat(lighten(c, 0.15)));
    ped.rotation.set(Math.PI / 2, 0, Math.PI / 2); ped.scale.set(0.42, 1, 1.12); ped.position.set(0, 1.62, 0.05); g.add(ped);
    const coin = cyl(0.2, 0.2, 0.05, 0xf3c94a, 0, 1.64, 0.82, 24); coin.rotation.x = Math.PI / 2; g.add(coin);
    g.add(box(0.06, 0.2, 0.02, 0xc99a2a, 0, 1.64, 0.85));
    door(g, 0, 0.52, 0x6f8c52);
    // 算数を 勉強して 銀行が そだつと 飾りが ふえる（lv は eggui.js の view.lv）
    const gold = 0xf3c94a;
    const pile = new THREE.Group();
    for (let i = 0; i < 4; i++) { const c2 = cyl(0.17, 0.17, 0.05, gold, 0, 0.03 + i * 0.055, 0, 20); pile.add(c2); }
    pile.position.set(1.28, 0, 0.62);
    const flag = new THREE.Group();
    flag.add(cyl(0.025, 0.025, 0.9, 0xd9d2c0, 0, 0.45, 0, 8), box(0.34, 0.2, 0.02, gold, 0.18, 0.78, 0));
    flag.position.set(-0.78, 1.46, -0.3);
    const lamps = new THREE.Group();
    for (const sx of [-1, 1]) { lamps.add(cyl(0.03, 0.03, 0.7, 0x5e5548, sx * 1.15, 0.35, 0.95, 8), ball(0.09, 0xfff2a8, sx * 1.15, 0.78, 0.95)); }
    const crown = new THREE.Group();
    for (let i = 0; i < 3; i++) { const s = ball(0.07 + (i === 1 ? 0.03 : 0), gold, -0.18 + i * 0.18, 1.98 + (i === 1 ? 0.05 : 0), 0.05); crown.add(s); }
    const big = new THREE.Group();
    for (let i = 0; i < 6; i++) { const c3 = cyl(0.2, 0.2, 0.05, gold, -1.2, 0.03 + i * 0.055, 0.7 + (i % 2) * 0.03, 20); big.add(c3); }
    const tiers = [[], [pile], [flag], [lamps], [crown], [big]];
    g.add(pile, flag, lamps, crown, big);
    g.userData.setLv = (lv) => tiers.forEach((list, i) => list.forEach((o) => { o.visible = (lv || 1) >= i + 1; }));
    g.userData.setLv(1);
    return g;
  },
  // 理科: 発電所（屋根の パネル・ひかる 電球）
  power(c) {
    const g = new THREE.Group();
    g.add(blob(1.5, 1.2));
    g.add(box(2.0, 1.2, 1.4, 0xfff1c4, 0, 0.6, 0));
    g.add(box(2.1, 0.1, 1.5, new THREE.Color(c).multiplyScalar(0.8).getHex(), 0, 1.25, 0));
    for (let i = 0; i < 3; i++) { const pnl = box(0.55, 0.04, 0.8, 0x3f5f8f, -0.62 + i * 0.62, 1.42, -0.1); pnl.rotation.x = -0.45; g.add(pnl); }
    door(g, -0.45, 0.71); win(g, 0.5, 0.75, 0.71, 0.5, 0.36);
    g.add(cyl(0.05, 0.06, 1.3, 0x9a6a4a, 1.25, 0.65, 0.5, 8));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
    bulb.position.set(1.25, 1.42, 0.5); g.add(bulb, cyl(0.07, 0.07, 0.1, 0x8a8a8a, 1.25, 1.27, 0.5, 10));
    const bolt = new THREE.Shape();
    [[0.05, 0.3], [-0.12, 0.0], [0.0, 0.0], [-0.06, -0.3], [0.13, 0.05], [0.01, 0.05]].forEach(([x, y], i) => (i ? bolt.lineTo(x, y) : bolt.moveTo(x, y)));
    const bm = new THREE.Mesh(new THREE.ExtrudeGeometry(bolt, { depth: 0.04, bevelEnabled: false }), mat(0xffc93c));
    bm.position.set(0.5, 1.02, 0.72); g.add(bm);
    g.userData.glow = bulb;
    return g;
  },
  // 社会: 市場（しましまの ひさし・くだものの はこ）
  market(c) {
    const g = new THREE.Group();
    g.add(blob(1.5, 1.2));
    g.add(box(1.9, 0.7, 0.8, 0xc49464, 0, 0.35, 0.2));
    g.add(box(1.9, 1.3, 0.12, 0xb57f50, 0, 0.9, -0.5));
    for (const sx of [-0.88, 0.88]) for (const sz of [-0.45, 0.55]) g.add(cyl(0.05, 0.05, 1.7, 0x9a6a4a, sx, 0.85, sz, 8));
    for (let i = 0; i < 6; i++) { const s = box(0.34, 0.06, 1.3, i % 2 ? 0xffffff : c, -0.85 + i * 0.34, 1.76, 0.1); s.rotation.x = 0.28; g.add(s); }
    const fr = [0xe8503a, 0xffa53c, 0x8cc84b, 0xffd84a];
    for (let k = 0; k < 3; k++) {
      g.add(box(0.5, 0.18, 0.45, 0xe0b27a, -0.6 + k * 0.6, 0.79, 0.32));
      for (let i = 0; i < 4; i++) g.add(ball(0.09, fr[(i + k) % 4], -0.72 + k * 0.6 + (i % 2) * 0.22, 0.93, 0.22 + Math.floor(i / 2) * 0.2));
    }
    return g;
  },
  // 英語: 空港（かん制とう・ふきながし・小さな ひこうき）
  airport(c) {
    const g = new THREE.Group();
    g.add(blob(1.6, 1.25));
    g.add(box(1.9, 0.9, 1.2, 0xf4f8fb, -0.25, 0.45, 0));
    const band = box(1.7, 0.3, 0.06, 0xbfe4f5, -0.25, 0.58, 0.61); band.material = new THREE.MeshBasicMaterial({ color: 0xcfeefa }); g.add(band);
    g.add(box(2.0, 0.1, 1.3, c, -0.25, 0.95, 0));
    g.add(cyl(0.2, 0.24, 1.9, 0xf4f8fb, 0.95, 0.95, -0.25, 14));
    const cab = cyl(0.36, 0.3, 0.38, 0xcfeefa, 0.95, 2.05, -0.25, 14); cab.material = new THREE.MeshBasicMaterial({ color: 0xcfeefa }); g.add(cab);
    g.add(cyl(0.42, 0.42, 0.08, c, 0.95, 2.28, -0.25, 14));
    g.add(cyl(0.025, 0.025, 1.1, 0x9a9a9a, -1.35, 0.55, 0.55, 6));
    const sock = cone(0.1, 0.42, 0xff8a3c, -1.15, 1.02, 0.55, 10); sock.rotation.z = Math.PI / 2; g.add(sock);
    const plane = new THREE.Group();
    const bodyP = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.6, 4, 10), mat(0xffffff)); bodyP.rotation.z = Math.PI / 2;
    plane.add(bodyP, box(0.18, 0.03, 0.9, c, 0, 0, 0), box(0.12, 0.2, 0.02, c, -0.38, 0.12, 0));
    plane.position.set(-0.3, 0.16, 1.0); plane.rotation.y = 0.4;
    g.add(plane);
    return g;
  },
};
function makeBuilding(def) {
  const make = BUILDINGS[def.building.id];
  return make ? make(def.color) : BUILDINGS.library(def.color);
}

// ---- たね（つち → 芽 → つぼみ） ----------------------------------------------------------------
function makeSprout(def) {
  const g = new THREE.Group();
  const mound = ball(0.45, 0x9a6b45, 0, 0.02, 0); mound.scale.set(1, 0.32, 1); g.add(mound);
  for (let i = 0; i < 7; i++) { const a = i * 0.9; g.add(ball(0.05, 0x7d5536, Math.cos(a) * 0.28, 0.1, Math.sin(a) * 0.24)); }
  // 教科の色の 小さな 旗（どの教科の たねか わかるように）
  g.add(cyl(0.015, 0.015, 0.6, 0xc9a67a, 0.42, 0.3, 0.2, 6));
  const flag = box(0.22, 0.14, 0.015, def.color, 0.53, 0.52, 0.2); g.add(flag);
  const seed = ball(0.07, 0x6b4a2b, 0, 0.14, 0.05); seed.scale.set(1, 0.75, 1.2); g.add(seed);
  const stem = cyl(0.025, 0.03, 1, 0x62b35a, 0, 0.5, 0, 8);
  const leafL = ball(0.14, 0x7cc46a, -0.12, 0, 0); leafL.scale.set(1.3, 0.35, 0.7);
  const leafR = ball(0.14, 0x7cc46a, 0.12, 0, 0); leafR.scale.set(1.3, 0.35, 0.7);
  const leaves = new THREE.Group(); leaves.add(leafL, leafR);
  const bud = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshLambertMaterial({ color: lighten(def.color, 0.1), emissive: 0xffe2a0, emissiveIntensity: 0 }));
  bud.scale.set(1, 1.25, 1);
  const tip = cone(0.1, 0.16, lighten(def.color, 0.35), 0, 0.17, 0, 10); bud.add(tip);
  g.add(stem, leaves, bud);
  return {
    group: g,
    set(stage, k) {
      seed.visible = stage === 'seed';
      const up = stage === 'seed' ? 0 : stage === 'sprout' ? 0.25 + k * 0.5 : 0.55 + k * 0.45;
      stem.visible = leaves.visible = stage !== 'seed';
      stem.scale.y = Math.max(0.01, up * 0.75); stem.position.y = (up * 0.75) / 2 + 0.08;
      leaves.position.y = Math.max(0.12, up * 0.45) + 0.08;
      leaves.scale.setScalar(0.6 + up * 0.9);
      bud.visible = stage === 'bud' || stage === 'ready';
      bud.position.y = up * 0.75 + 0.12;
      bud.scale.setScalar((stage === 'ready' ? 1.25 : 0.55 + k * 0.6));
      bud.scale.y *= 1.25;
    },
    bud,
  };
}

// じょうろ（たねに 水を かける 反応）
function makeCan() {
  const g = new THREE.Group();
  g.add(cyl(0.16, 0.18, 0.28, 0x8ec9ef, 0, 0, 0, 16));
  const spout = cyl(0.025, 0.04, 0.42, 0x8ec9ef, 0.24, 0.06, 0, 8); spout.rotation.z = -1.0; g.add(spout);
  g.add(cyl(0.06, 0.04, 0.05, 0x6fb0dc, 0.42, 0.18, 0, 10));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 16, Math.PI), mat(0x6fb0dc)); handle.position.set(-0.04, 0.12, 0); g.add(handle);
  g.visible = false;
  return g;
}

// 建物の 正面を カメラの ほうへ むける（うえた ときの 見え方の まま できあがる）
function away0(dir, camPos, x, z) { return camPos ? Math.atan2(camPos.x - x, camPos.z - z) : dir; }

// =================================================================================================
// world.js から つくる。town: 歩けない場所を 知らせる / cut: 水の場所を しらべる
export function createEggs({ scene, town, cut }) {
  const root = new THREE.Group();
  scene.add(root);
  const nest = makeNest();
  nest.position.set(NEST.x, heightAt(NEST.x, NEST.z), NEST.z);
  nest.rotation.y = 0.15;
  nest.scale.setScalar(1.15);
  nest.visible = false;
  root.add(nest);

  const sparkles = sparkleSet(scene, 0xffe39a);
  const drops = sparkleSet(scene, 0x8fd3ff);
  const can = makeCan();
  root.add(can);
  const canAnim = { t: -1, x: 0, z: 0 };

  // 1教科ずつの 3D
  const items = EGGS.map((def, i) => {
    const slot = eggSlot(i);
    const egg = makeEgg(def);
    const eggHolder = new THREE.Group();
    eggHolder.add(egg.mesh);
    eggHolder.position.set(slot.x, 0.1, slot.z);
    eggHolder.rotation.z = slot.tilt;
    nest.add(eggHolder);
    const chara = makeChara(def);
    chara.visible = false;
    root.add(chara);
    const sprout = makeSprout(def);
    sprout.group.visible = false;
    root.add(sprout.group);
    const building = makeBuilding(def);
    building.visible = false;
    root.add(building);
    const bang = bangSprite();
    root.add(bang);
    [eggHolder, chara, sprout.group, building].forEach((o) => o.traverse((m) => { m.userData.eggId = def.id; }));
    return {
      def, slot, egg, eggHolder, chara, sprout, building, bang,
      view: null, wob: 0, nextWob: 1 + i * 0.7, glow: 0, hatchT: -1, popT: -1, home: new THREE.Vector3(), charaAt: new THREE.Vector3(), hop: Math.random() * 6,
    };
  });
  const byId = new Map(items.map((it) => [it.def.id, it]));

  let on = true;
  let hidden = false;
  let has = false;
  let quiet = false;   // カメラの あいだは 頭の上の「！」を かくす（写真に うつらないように）
  let blockersSig = '';

  // なかまの 立つ場所: たねを うえる前は 巣の まえ、うえたら その たねの まえ
  function standSpot(it) {
    const v = it.view;
    if (v?.seed) {
      const front = v.phase === 'built' ? 1.75 : 0.95;
      const a = v.seed.rot || 0;
      const x = v.seed.x + Math.sin(a) * front + Math.cos(a) * 0.55; const z = v.seed.z + Math.cos(a) * front - Math.sin(a) * 0.55;
      return new THREE.Vector3(x, heightAt(x, z), z);
    }
    const i = EGGS.indexOf(it.def);
    const a = Math.PI * 0.18 + (i - 2) * 0.48;
    const x = NEST.x + Math.sin(a) * 1.75; const z = NEST.z + Math.cos(a) * 1.75;
    return new THREE.Vector3(x, heightAt(x, z), z);
  }

  function apply(it) {
    const v = it.view;
    const egg = v && v.phase === 'egg';
    it.eggHolder.visible = egg || it.hatchT >= 0;
    if (egg) it.egg.mesh.material.map = v.stage === 'crack' || v.stage === 'ready' ? it.egg.tex.crack : it.egg.tex.plain;
    const showChara = v && v.phase !== 'egg' && it.hatchT < 0;
    if (showChara && !it.chara.visible) { it.chara.position.copy(standSpot(it)); it.charaAt.copy(it.chara.position); }
    it.chara.visible = !!showChara;
    it.home.copy(standSpot(it));
    const planted = v && v.seed;
    it.sprout.group.visible = !!planted && v.phase === 'seed';
    it.building.visible = !!planted && v.phase === 'built';
    it.building.userData.setLv?.(v.lv);
    if (planted) {
      const y = heightAt(v.seed.x, v.seed.z);
      it.sprout.group.position.set(v.seed.x, y, v.seed.z);
      it.building.position.set(v.seed.x, y, v.seed.z);
      it.building.rotation.y = it.sprout.group.rotation.y = v.seed.rot || 0;
      if (v.phase === 'seed') it.sprout.set(v.stage, v.k);
    }
  }

  function refreshBlockers() {
    const list = has ? [{ x: NEST.x, z: NEST.z, r: 1.1 }] : [];
    for (const it of items) {
      const v = it.view;
      if (v?.seed) list.push({ x: v.seed.x, z: v.seed.z, r: v.phase === 'built' ? BUILD_R : 0.45 });
    }
    const sig = JSON.stringify(on ? list : []);
    if (sig === blockersSig) return;
    blockersSig = sig;
    town.setBlockers(on ? list : []);
  }

  // ---- たねを うえる 場所えらび（女の子の まえに わっか） ----
  const ghost = new THREE.Mesh(new THREE.RingGeometry(PLANT.r - 0.14, PLANT.r, 48), new THREE.MeshBasicMaterial({ color: 0x9fe07a, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false }));
  ghost.renderOrder = 8;
  ghost.rotation.x = -Math.PI / 2;
  ghost.visible = false;
  root.add(ghost);
  // うえられる 場所の しるし（みどりに ひかる まる）。草に かくれないよう 草の 上に うかべる。女の子の まわりを ときどき しらべる
  const SPOT_MAX = 36;
  const spotPos = new Float32Array(SPOT_MAX * 3);
  const spotGeo = new THREE.BufferGeometry();
  spotGeo.setAttribute('position', new THREE.BufferAttribute(spotPos, 3));
  spotGeo.setDrawRange(0, 0);
  const spotTex = (() => {   // しろい ふちの みどりの まる（ほたると まちがえない くっきりした 形）
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.beginPath(); x.arc(32, 32, 26, 0, TAU); x.fill();
    x.fillStyle = '#6cc04a'; x.beginPath(); x.arc(32, 32, 20, 0, TAU); x.fill();
    x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(26, 30, 5, 8, -0.6, 0, TAU); x.ellipse(38, 30, 5, 8, 0.6, 0, TAU); x.fill();   // ふたばの しるし
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const spots = new THREE.Points(spotGeo, new THREE.PointsMaterial({ map: spotTex, size: 0.7, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false, fog: false, alphaTest: 0.05 }));
  spots.renderOrder = 7; spots.visible = false; spots.frustumCulled = false;
  root.add(spots);
  let spotT = 0;
  function findSpots(cx, cz) {
    const step = 1.6; const R = 10; const list = [];
    const gx = Math.round(cx / step) * step; const gz = Math.round(cz / step) * step;   // 歩いても しるしが ぴょこぴょこ うごかない ように 格子に
    for (let x = gx - R; x <= gx + R; x += step) {
      for (let z = gz - R; z <= gz + R; z += step) {
        const d = Math.hypot(x - cx, z - cz);
        if (d <= R && validSpot(x, z)) list.push({ x, z, d });
      }
    }
    list.sort((a, b) => a.d - b.d);
    const n = Math.min(SPOT_MAX, list.length);
    for (let i = 0; i < n; i++) { const q = list[i]; spotPos.set([q.x, heightAt(q.x, q.z) + 0.55, q.z], i * 3); }
    spotGeo.setDrawRange(0, n);
    spotGeo.attributes.position.needsUpdate = true;
  }
  const plant = { id: null, at: null, sprout: null };
  function validSpot(x, z) {
    if (Math.hypot(x, z) > PLANT.max) return false;
    if (cut?.isWater?.(x, z)) return false;
    return town.canPlace(x, z, PLANT.r, null);
  }

  return {
    // カメラの あいだ true（「！」を 出さない）
    setQuiet(v) { quiet = !!v; if (quiet) items.forEach((it) => { it.bang.visible = false; }); },
    // views: [{ id, phase, stage, k, seed:{x,z,rot}|null, tap }]（eggui.js が 作る）。has: たまごを もらったか
    setView(views, hasEggs) {
      has = !!hasEggs;
      nest.visible = on && has;
      for (const v of views || []) {
        const it = byId.get(v.id);
        if (!it) continue;
        it.view = v;
        apply(it);
      }
      refreshBlockers();
    },
    // しばらく かくす（きせかえの あいだ、女の子の 前に たって じゃまに ならないよう）
    setHidden(v) { hidden = !!v; root.visible = on && !hidden; },
    // 町の 島（はじまりの島）に いるときだけ 出す
    setOn(v) {
      on = !!v;
      root.visible = on && !hidden;
      nest.visible = on && has;
      refreshBlockers();
    },
    // タップで あたった もの { id, what: 'egg' | 'chara' | 'seed' | 'building' }
    pick(raycaster) {
      if (!on || !has) return null;
      const targets = [];
      for (const it of items) {
        if (it.eggHolder.visible && it.hatchT < 0) targets.push([it.eggHolder, 'egg']);
        if (it.chara.visible) targets.push([it.chara, 'chara']);
        if (it.sprout.group.visible) targets.push([it.sprout.group, 'seed']);
        if (it.building.visible) targets.push([it.building, 'building']);
      }
      let best = null;
      for (const [obj, what] of targets) {
        const hit = raycaster.intersectObject(obj, true)[0];
        if (hit && (!best || hit.distance < best.d)) best = { d: hit.distance, id: obj.userData.eggId, what };
      }
      // たまごは 小さいので、巣に あたっても いちばん ちかい たまごに する
      if (!best) {
        const hitNest = raycaster.intersectObject(nest, true)[0];
        if (hitNest) {
          let near = null; let nd = 0.7;
          for (const it of items) {
            if (!it.eggHolder.visible) continue;
            const w = it.eggHolder.getWorldPosition(new THREE.Vector3());
            const d = Math.hypot(w.x - hitNest.point.x, w.z - hitNest.point.z);
            if (d < nd) { nd = d; near = it; }
          }
          if (near) best = { id: near.def.id, what: 'egg' };
        }
      }
      return best ? { id: best.id, what: best.what } : null;
    },
    // 勉強で あたたまった: たまごは ピカッと ひかって ゆれる、たねは じょうろで 水
    react(id) {
      const it = byId.get(id);
      if (!it || !on) return;
      if (it.view?.phase === 'seed') {
        canAnim.t = 0; canAnim.x = it.view.seed.x; canAnim.z = it.view.seed.z;
        can.visible = true;
        return;
      }
      if (it.view?.phase !== 'egg') return;
      it.glow = 1.6; it.wob = 1.4; it.nextWob = 3;
      const w = it.eggHolder.getWorldPosition(new THREE.Vector3());
      sparkles.burst(w.x, w.y + EGG_H * 0.6, w.z, 14, 0.6);
    },
    // 孵化の うごき。おわったら（なかまが 出たら）かえる
    hatch(id) {
      const it = byId.get(id);
      if (!it) return Promise.resolve();
      it.hatchT = 0;
      it.eggHolder.visible = true;
      return new Promise((res) => { it.onHatched = res; });
    },
    // 建物が できた うごき
    pop(id) {
      const it = byId.get(id);
      if (!it) return;
      it.popT = 0;
      const p = it.building.position;
      sparkles.burst(p.x, p.y + 1.4, p.z, 14, 1.4);
    },
    // その教科の ものが ある場所（カメラを むける）
    spotOf(id) {
      const it = byId.get(id);
      const v = it?.view;
      if (v?.seed) return { x: v.seed.x, z: v.seed.z };
      return { x: NEST.x, z: NEST.z };
    },
    nest: { x: NEST.x, z: NEST.z },
    // たねを うえる 場所えらびを はじめる／おわる。spot() で いまの 場所（うえられない所は null）
    beginPlant(id) {
      const it = byId.get(id);
      if (!it) return;
      plant.id = id; plant.at = null;
      ghost.visible = true;
      it.sprout.set('seed', 0);
      it.sprout.group.visible = true;
      plant.sprout = it.sprout.group;
      spots.visible = true; spotT = 0;
    },
    endPlant() {
      if (plant.sprout) { const it = byId.get(plant.id); plant.sprout.visible = it?.view?.phase === 'seed'; if (it) apply(it); }
      plant.id = null; plant.at = null; plant.sprout = null;
      ghost.visible = false;
      spots.visible = false; spotGeo.setDrawRange(0, 0);
    },
    plantSpot: () => plant.at,
    get planting() { return !!plant.id; },

    update(dt, t, actorPos, heading, camPos) {
      if (!on) return;
      sparkles.update(dt);
      drops.update(dt);
      // うえる 場所えらび
      if (plant.id) {
        // 女の子の まえ。カメラの ほうを むいている ときは、画面の おく（わっかが 見える ほう）に 出す
        let dir = heading;
        if (camPos) {
          const away = Math.atan2(actorPos.x - camPos.x, actorPos.z - camPos.z);
          if (Math.cos(heading - away) < -0.2) dir = away;
        }
        const x = actorPos.x + Math.sin(dir) * 2.4; const z = actorPos.z + Math.cos(dir) * 2.4;
        const ok = validSpot(x, z);
        ghost.position.set(x, heightAt(x, z) + 0.06, z);
        ghost.material.color.setHex(ok ? 0x9fe07a : 0xff7a6a);
        ghost.material.opacity = 0.6 + Math.sin(t * 5) * 0.25;
        plant.sprout.position.set(x, heightAt(x, z) + 0.05 + Math.sin(t * 4) * 0.04, z);
        plant.sprout.rotation.y = dir;
        plant.at = ok ? { x, z, rot: Math.round(away0(dir, camPos, x, z) * 100) / 100 } : null;
        spotT -= dt;
        if (spotT <= 0) { spotT = 0.5; findSpots(actorPos.x, actorPos.z); }
        spots.material.size = 0.7 + Math.sin(t * 3) * 0.06;
      }
      // じょうろ
      if (canAnim.t >= 0) {
        canAnim.t += dt;
        const k = canAnim.t;
        can.position.set(canAnim.x - 0.55, heightAt(canAnim.x, canAnim.z) + 1.25 + Math.sin(k * 3) * 0.04, canAnim.z);
        can.rotation.z = -Math.min(0.8, k * 1.6) + (k > 1.6 ? (k - 1.6) * 2 : 0);
        if (k > 0.45 && k < 1.6 && Math.floor(k * 8) !== Math.floor((k - dt) * 8)) drops.burst(canAnim.x - 0.08, heightAt(canAnim.x, canAnim.z) + 1.05, canAnim.z, 4, 0.15);
        if (k > 2) { canAnim.t = -1; can.visible = false; }
      }
      for (const it of items) {
        const v = it.view;
        // ---- たまご ----
        if (it.eggHolder.visible) {
          const m = it.egg.mesh;
          if (it.hatchT >= 0) {
            it.hatchT += dt;
            const k = it.hatchT;
            m.rotation.z = Math.sin(k * (14 + k * 10)) * Math.min(0.4, k * 0.35);
            m.position.y = Math.abs(Math.sin(k * 9)) * 0.04 * k;
            m.material.emissiveIntensity = Math.min(1.4, k);
            if (k > 1.3) {
              it.hatchT = -1;
              it.eggHolder.visible = false;
              m.rotation.z = 0; m.position.y = 0; m.material.emissiveIntensity = 0;
              const w = it.eggHolder.getWorldPosition(new THREE.Vector3());
              sparkles.burst(w.x, w.y + 0.3, w.z, 14, 1.2);
              it.chara.position.set(w.x, heightAt(w.x, w.z), w.z);
              it.charaAt.copy(it.chara.position);
              it.chara.visible = true;
              it.chara.scale.setScalar(0.01);
              it.born = 0;
              it.onHatched?.(); it.onHatched = null;
            }
          } else if (v?.phase === 'egg') {
            // ゆれる 間かく: ねむってる ほど まれ、生まれそう ほど よく
            const every = { sleep: 0, wiggle: 6, crack: 3.2, ready: 1.3 }[v.stage] || 0;
            it.nextWob -= dt;
            if (every && it.nextWob <= 0) { it.wob = Math.max(it.wob, v.stage === 'ready' ? 1 : 0.7); it.nextWob = every * (0.7 + Math.random() * 0.6); }
            const amp = { sleep: 0, wiggle: 0.18, crack: 0.26, ready: 0.32 }[v.stage] || 0.25;
            it.wob = Math.max(0, it.wob - dt * 1.1);
            m.rotation.z = Math.sin(t * 17) * it.wob * Math.max(amp, it.glow > 0 ? 0.3 : 0);
            m.position.y = it.wob > 0.5 ? Math.abs(Math.sin(t * 17)) * 0.03 : 0;
            m.scale.set(EGG_H * (1 + Math.sin(t * 1.8 + it.slot.x * 5) * 0.012), EGG_H * (1 - Math.sin(t * 1.8 + it.slot.x * 5) * 0.012), EGG_H);
            it.glow = Math.max(0, it.glow - dt * 0.8);
            const ready = v.stage === 'ready' ? 0.35 + Math.sin(t * 3) * 0.2 : 0;
            m.material.emissiveIntensity = Math.max(ready, Math.min(1, it.glow));
          }
        }
        // ---- なかま: 自分の 場所へ とことこ。ときどき ぴょん。カメラを 見る ----
        if (it.chara.visible) {
          if (it.born != null) {
            it.born += dt;
            const k = Math.min(1, it.born / 0.6) - 1;
            it.chara.scale.setScalar(Math.max(0.01, 1 + 2.2 * k * k * k + 1.2 * k * k));
            if (it.born > 1.4) it.born = null;
          } else {
            const d = it.home.clone().sub(it.charaAt); d.y = 0;
            const dist = d.length();
            if (dist > 0.05) {
              it.charaAt.addScaledVector(d.normalize(), Math.min(dist, dt * 1.6));
              it.charaAt.y = heightAt(it.charaAt.x, it.charaAt.z);
              it.chara.rotation.y = Math.atan2(d.x, d.z);
            } else if (camPos) {
              const want = Math.atan2(camPos.x - it.charaAt.x, camPos.z - it.charaAt.z);
              let diff = want - it.chara.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
              it.chara.rotation.y += diff * Math.min(1, dt * 2);
            }
            it.hop -= dt;
            if (it.hop < 0) it.hop = 4 + Math.random() * 5;
            const jump = it.hop < 0.4 ? Math.sin((it.hop / 0.4) * Math.PI) * 0.18 : 0;
            const walk = dist > 0.05 ? Math.abs(Math.sin(t * 12)) * 0.05 : 0;
            it.chara.position.set(it.charaAt.x, it.charaAt.y + jump + walk, it.charaAt.z);
            const sq = 1 + Math.sin(t * 2.4 + it.slot.x * 7) * 0.025;
            it.chara.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
          }
        }
        // ---- たね ----
        if (it.sprout.group.visible && v?.phase === 'seed' && plant.id !== it.def.id) {
          it.sprout.group.rotation.z = Math.sin(t * 1.6 + it.slot.x * 4) * 0.03;
          const ready = v.stage === 'ready';
          it.sprout.bud.material.emissiveIntensity = ready ? 0.35 + Math.sin(t * 3) * 0.2 : 0;
          if (ready) it.sprout.bud.rotation.z = Math.sin(t * 9) * 0.08;
        }
        // ---- 建物が できた ときの ぽんっ ----
        if (it.popT >= 0 && it.building.visible) {
          it.popT = Math.min(1, it.popT + dt / 0.9);
          const k = it.popT - 1;
          it.building.scale.setScalar(Math.max(0.001, 1 + 2.2 * k * k * k + 1.2 * k * k));
          if (it.popT >= 1) it.popT = -1;
        }
        const glow = it.building.userData.glow;
        if (glow && it.building.visible) glow.material.color.setHSL(0.14, 1, 0.78 + Math.sin(t * 2) * 0.06);
        // ---- 頭の上の「！」 ----
        const tap = !!v?.tap && it.hatchT < 0 && plant.id !== it.def.id;
        it.bang.visible = tap && !quiet;
        if (tap) {
          let base;
          if (v.phase === 'egg') base = it.eggHolder.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, EGG_H + 0.35, 0));
          else if (v.phase === 'seed') base = it.sprout.group.position.clone().add(new THREE.Vector3(0, 1.45, 0));
          else base = it.chara.position.clone().add(new THREE.Vector3(0, CHARA_H + 0.5, 0));
          it.bang.position.copy(base).add(new THREE.Vector3(0, Math.sin(t * 3.2 + it.slot.x * 3) * 0.06, 0));
        }
      }
    },
  };
}
