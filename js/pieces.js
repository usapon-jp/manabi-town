// 置きもの。レイズドベッド・丘の家（Sky の草の丘にある、まるい家のイメージ）と、家に付けるパーツ。
// どれも「ここに置く」1回で1つ。形は小さなパーツを Bag でまとめて、1つのメッシュにする。
import * as THREE from 'three';
import { Bag, GEO, rboxGeo, seeded, blob, tulip, daisy, hyacinth, smallYellow, leafBlade } from './townkit.js';
import { heightAt } from './terrain.js';
import { prop } from './props.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const { CYL, SPH, BOX, HALF } = GEO;
const WOOD = [0xb98a55, 0xc59a63, 0xa9794a];
const SLATE = [0x6f7684, 0x7b8291, 0x626977, 0x858c9b];

// ---- 家のパーツ（扉・窓・ひさし）-----------------------------------------------
// 家には「付ける場所（ソケット）」があって、そこに手持ちのパーツを付けたり付けかえたりできる。
// パーツは自分の足もと（扉）／まん中（窓）／かべの上のへり（ひさし）を原点に、+z（外）向きで作る。
const Y_AXIS = new THREE.Vector3(0, 1, 0);
function at(bag, px, py, pz, ry) {
  const qf = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, ry);
  return {
    add(geo, color, o = {}) {
      const v = new THREE.Vector3(o.x || 0, o.y || 0, o.z || 0).applyQuaternion(qf);
      const ql = o.q ? o.q.clone() : new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0));
      bag.add(geo, color, { ...o, x: px + v.x, y: py + v.y, z: pz + v.z, q: qf.clone().multiply(ql) });
      return this;
    },
  };
}

// ---- 質感（木目とガラス）---------------------------------------------------------
// Bag は色だけなので、木とガラスは別の入れ物にまとめて、それぞれの質感の材質で1つのメッシュにする。
// 木目は canvas でかいた絵（板のすじ・木目・ふし）を、頂点の色にかけあわせる（色は部品ごとにかえられる）。
class TexBag {
  constructor() { this.list = []; }
  add(geo, color, o = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const sc = o.s ?? 1;
    const q = o.q ? o.q.clone() : new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0));
    const m = new THREE.Matrix4().compose(new THREE.Vector3(o.x || 0, o.y || 0, o.z || 0), q, new THREE.Vector3(o.sx ?? sc, o.sy ?? sc, o.sz ?? sc));
    g.applyMatrix4(m);
    const n = g.attributes.position.count; const c = new THREE.Color(color); const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.list.push(g);
    return this;
  }
  mesh(mat) { return this.list.length ? new THREE.Mesh(mergeGeometries(this.list), mat) : new THREE.Group(); }
}
let woodMat = null; let glassMat = null;
function woodTexture() {
  const W = 256; const H = 512; const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const rnd = seeded(11);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
  const PL = 4; const pw = W / PL;
  for (let k = 0; k < PL; k++) {
    // 板ごとに少しだけ明るさをかえる
    const v = 236 + Math.floor(rnd() * 20);
    x.fillStyle = `rgb(${v},${v - 4},${v - 10})`; x.fillRect(k * pw, 0, pw, H);
    // 木目（ゆらゆらした縦のすじ）
    for (let i = 0; i < 9; i++) {
      const bx = k * pw + 4 + rnd() * (pw - 8); const amp = 1 + rnd() * 3; const f = 0.01 + rnd() * 0.02; const ph = rnd() * 6;
      x.strokeStyle = `rgba(90,55,25,${0.1 + rnd() * 0.16})`; x.lineWidth = 0.8 + rnd() * 1.6;
      x.beginPath();
      for (let y = 0; y <= H; y += 8) { const xx = bx + Math.sin(y * f + ph) * amp; if (y) x.lineTo(xx, y); else x.moveTo(xx, y); }
      x.stroke();
    }
    // ふし
    if (rnd() < 0.7) {
      const kx = k * pw + pw * (0.3 + rnd() * 0.4); const ky = rnd() * H;
      for (let r = 7; r > 1; r -= 2) { x.strokeStyle = `rgba(90,55,25,${0.22})`; x.lineWidth = 1; x.beginPath(); x.ellipse(kx, ky, r * 0.7, r * 1.6, 0, 0, Math.PI * 2); x.stroke(); }
    }
    // 板のつぎめ
    x.fillStyle = 'rgba(60,35,15,0.45)'; x.fillRect(k * pw, 0, 2, H);
    x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(k * pw + 2, 0, 1, H);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
// 板1まいのはば = 0.184m（アーチの扉の5まい）。テクスチャ1まいに4まい
const PLANK = 0.184;
function materials() {
  if (!woodMat) {
    const t = woodTexture(); t.repeat.set(1 / (PLANK * 4), 1 / 1.6);
    woodMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: t, emissive: 0x2e2a24 });
    glassMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.5, emissive: 0x9cc6da, emissiveIntensity: 0.3, depthWrite: false });
  }
  return { woodMat, glassMat };
}
// 木の板の面に、メートルの uv をつける（BoxGeometry の前の面が、はば・高さどおりの木目になる）
function plankGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv; const pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) + w / 2, pos.getY(i) + h / 2);
  return g;
}
// ガラス（うすい空色で、すこし透ける。白いハイライトを2本）
function glass(gb, b, r, o = {}) {
  gb.add(new THREE.CircleGeometry(r, 28), 0xd8eef8, { ...o });
  const hl = { ...o, z: (o.z || 0) + 0.004 };
  b.add(BOX, 0xffffff, { ...hl, x: (o.x || 0) - r * 0.32, y: (o.y || 0) + r * 0.3, sx: r * 0.16, sy: r * 0.9, sz: 0.004, rz: -0.75 });
  b.add(new THREE.RingGeometry(r * 0.86, r, 28, 1, Math.PI * 0.05, Math.PI * 0.55), 0xbfe0ee, { ...hl });   // ふちの空色の照りかえし
  b.add(BOX, 0xffffff, { ...hl, x: (o.x || 0) - r * 0.05, y: (o.y || 0) + r * 0.48, sx: r * 0.06, sy: r * 0.45, sz: 0.004, rz: -0.75 });
}
// 部品をつくるときに渡す入れ物: b=色 / gl=光る / wood=木目 / gls=ガラス
function partBags() { return { b: new Bag(), gl: new Bag(), wood: new TexBag(), gls: new TexBag() }; }
function bagsAt(B, x, y, z, ry) { return { b: at(B.b, x, y, z, ry), gl: at(B.gl, x, y, z, ry), wood: at(B.wood, x, y, z, ry), gls: at(B.gls, x, y, z, ry) }; }
function bagsMesh(B) {
  const { woodMat: wm, glassMat: gm } = materials();
  const g = new THREE.Group(); g.add(B.b.mesh(), B.gl.mesh(true), B.wood.mesh(wm));
  const gm2 = B.gls.mesh(gm); gm2.renderOrder = 2; g.add(gm2);
  return g;
}
export { partBags, bagsAt, bagsMesh };
const DOOR_WOOD = [0x9a6a3e, 0xa87646, 0x8d5f36];
const IRON_DARK = 0x3a3530;
const GOLD = 0xe8c25a;
const WARM = 0xffe39a;

// ふつうの扉（四角い板戸）。高さ1.45m
function plainDoor(P) {
  const { b, wood } = P;
  const w = 0.82; const h = 1.45;
  wood.add(plankGeo(w + 0.14, h + 0.08, 0.08), 0x6e4a2c, { y: (h + 0.08) / 2, z: -0.02 });
  wood.add(plankGeo(w, h, 0.06), 0xa87646, { y: h / 2, z: 0.03 });
  for (const y of [0.3, h - 0.3]) wood.add(plankGeo(w - 0.06, 0.08, 0.025), 0x8d5f36, { y, z: 0.07 });
  b.add(SPH, GOLD, { x: w / 2 - 0.13, y: 0.72, z: 0.1, s: 0.05 });
}
// アーチの形の板（なめらかなアーチ。w=はば、h=高さ、t=あつみ。足もと中央が原点）
function archGeo(w, h, t, seg = 28) {
  const r = w / 2; const hr = h - r;
  const sh = new THREE.Shape();
  sh.moveTo(-r, 0); sh.lineTo(r, 0); sh.lineTo(r, hr);
  sh.absarc(0, hr, r, 0, Math.PI, false);
  sh.lineTo(-r, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1, curveSegments: seg });
  g.translate(0, 0, -t / 2);
  return g;
}
// アーチの扉（ミント色か茶色。上がまるい扉。金色のまる窓と、くるんとした金具）
const DOOR_COLORS = {
  mint: { frame: 0xf3e6c8, door: 0x86c2b2, line: 0x6fa898 },
  brown: { frame: 0x6e4a2c, door: 0xa87646, line: 0x7a5232 },
};
function archDoor(P, o = {}) {
  const { b, gl, wood, gls } = P;
  const C = DOOR_COLORS[o.color] || DOOR_COLORS.mint;
  const w = 0.92; const r = w / 2; const h = 1.45; const hr = h - r;
  wood.add(archGeo(w + 0.2, h + 0.1, 0.08), C.frame, { z: -0.03 });             // わく
  const door = archGeo(w, h, 0.06); door.translate(r, 0, 0);                   // uv をメートルで左はしから
  const uv = door.attributes.uv; const pos = door.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getY(i));
  door.translate(-r, 0, 0);
  wood.add(door, C.door, { z: 0.03 });                                         // 扉の板（木目つき）
  for (const y of [0.3, hr - 0.1]) {
    b.add(rboxGeo(0.34, 0.05, 0.02, 0.02), 0x4a3e34, { x: -r + 0.2, y, z: 0.075 });
    b.add(new THREE.TorusGeometry(0.04, 0.014, 6, 12), 0x4a3e34, { x: -r + 0.4, y, z: 0.075 });
  }
  const wy = hr + 0.1;
  gl.add(new THREE.CircleGeometry(0.14, 20), WARM, { y: wy, z: 0.076 });
  glass(gls, b, 0.14, { y: wy, z: 0.08 });
  b.add(new THREE.TorusGeometry(0.15, 0.03, 8, 24), 0xe8c25a, { y: wy, z: 0.085 });
  b.add(BOX, 0xe8c25a, { y: wy, z: 0.09, sx: 0.02, sy: 0.27, sz: 0.015 });
  b.add(BOX, 0xe8c25a, { y: wy, z: 0.09, sx: 0.27, sy: 0.02, sz: 0.015 });
  b.add(SPH, 0xe8c25a, { x: r - 0.15, y: 0.62, z: 0.1, s: 0.06 });
}
// リース（扉にかざる。葉っぱの輪に赤い実とリボン）。原点 = 輪のまん中
function wreath(P) {
  const { b } = P;
  const RR = 0.15;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    b.add(SPH, i % 2 ? 0x5e9e4e : 0x6fb05a, { x: Math.cos(a) * RR, y: Math.sin(a) * RR, z: 0.02, sx: 0.06, sy: 0.045, sz: 0.035, rz: a + Math.PI / 2 });
  }
  for (let i = 0; i < 5; i++) { const a = i * 1.3 + 0.4; b.add(SPH, 0xe0566a, { x: Math.cos(a) * RR, y: Math.sin(a) * RR, z: 0.05, s: 0.022 }); }
  b.add(SPH, 0xf08aa0, { x: -0.045, y: -RR, z: 0.05, sx: 0.045, sy: 0.03, sz: 0.02, rz: 0.4 });
  b.add(SPH, 0xf08aa0, { x: 0.045, y: -RR, z: 0.05, sx: 0.045, sy: 0.03, sz: 0.02, rz: -0.4 });
  b.add(SPH, 0xe0566a, { y: -RR, z: 0.055, s: 0.022 });
}
// ふつうの窓（四角い木わく・十字の桟）
function plainWindow(P) {
  const { b, gl, wood, gls } = P;
  const sz = 0.62;
  wood.add(plankGeo(sz + 0.12, sz + 0.12, 0.08), 0x7a5232, { z: 0 });
  gl.add(new THREE.PlaneGeometry(sz, sz), WARM, { z: 0.042 });
  gls.add(new THREE.PlaneGeometry(sz, sz), 0xd8eef8, { z: 0.046 });
  b.add(BOX, 0xffffff, { x: -0.12, y: 0.1, z: 0.05, sx: 0.05, sy: 0.32, sz: 0.004, rz: -0.75 });
  wood.add(plankGeo(0.045, sz, 0.025), 0x7a5232, { z: 0.06 });
  wood.add(plankGeo(sz, 0.045, 0.025), 0x7a5232, { z: 0.06 });
  wood.add(plankGeo(sz + 0.24, 0.07, 0.18), 0x8d5f36, { y: -sz / 2 - 0.08, z: 0.06 });   // 窓台
}
// 丸窓（まるい木わくに十字の桟）
function roundWindow(P) {
  const { b, gl, wood, gls } = P;
  const R = 0.36;
  b.add(CYL, 0x5d6b70, { z: -0.02, sx: R + 0.12, sy: 0.08, sz: R + 0.12, rx: Math.PI / 2 });
  wood.add(new THREE.TorusGeometry(R, 0.06, 10, 36), 0x9a6a3e, { z: 0.04 });
  gl.add(new THREE.CircleGeometry(R - 0.02, 24), WARM, { z: 0.025 });
  glass(gls, b, R - 0.01, { z: 0.038 });
  wood.add(plankGeo(0.04, R * 2 - 0.04, 0.025), 0x8d5f36, { z: 0.06 });
  wood.add(plankGeo(R * 2 - 0.04, 0.04, 0.025), 0x8d5f36, { z: 0.06 });
}
// ひさし（カフェの布のひさし。奥行きはソケットの d で決まる。しま模様で、手前のへりは波の形。足はなく、かべの金具でとめる）
function awningPart(P, o = {}) {
  const { b } = P;
  const W = o.w || 1.4; const D = o.d || 0.38; const drop = D * 0.45;   // 奥行き: 丸い家は短め。大きい建物はソケットで d: 0.75
  const ang = Math.atan2(drop, D); const L = Math.hypot(D, drop);
  const n = Math.max(5, Math.round(W / 0.2)); const sw = W / n;
  const C = [0xf6efe0, o.color || 0x3f8f86];
  for (let k = 0; k < n; k++) {
    const x = -W / 2 + (k + 0.5) * sw;
    b.add(BOX, C[k % 2], { x, y: -drop / 2, z: D / 2, sx: sw + 0.002, sy: 0.025, sz: L, rx: ang });
    // 手前のたれ（波の形）
    b.add(BOX, C[k % 2], { x, y: -drop - 0.08, z: D + 0.005, sx: sw + 0.002, sy: 0.16, sz: 0.02 });
    b.add(new THREE.CircleGeometry(sw / 2, 12, Math.PI, Math.PI), C[k % 2], { x, y: -drop - 0.16, z: D + 0.016 });
  }
  // よこの三角の布
  for (const sx of [-1, 1]) {
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -drop, D, 0, -drop - 0.16, D, 0, 0, 0, 0, -drop - 0.16, D, 0, -drop, D], 3));
    tri.computeVertexNormals();
    b.add(tri, C[1], { x: sx * W / 2 });
  }
  // かべの横木と、ななめの鉄の金具
  b.add(rboxGeo(W + 0.08, 0.07, 0.07, 0.02), IRON_DARK, { y: 0, z: 0.03 });
  for (const sx of [-1, 1]) {
    const dy = 0.5 - drop; const dz = D - 0.06;          // かべの下（-0.5）から、手前のへりへ
    b.add(CYL, IRON_DARK, { x: sx * (W / 2 - 0.08), y: -0.5 + dy / 2, z: 0.03 + dz / 2, sx: 0.018, sy: Math.hypot(dy, dz), sz: 0.018, rx: Math.atan2(dz, dy) });
    b.add(SPH, IRON_DARK, { x: sx * (W / 2 - 0.08), y: -0.5, z: 0.03, s: 0.035 });
  }
}

// 花箱（窓の下に付ける。うえる花は えらべる: op.flowers[ソケット] = 'tulip' など。なしなら いろいろ）
const BOX_FLOWERS = {
  tulip: (f, x, z, i) => tulip(f, x, z, [0xff7a8a, 0xff9dbd, 0xfff08a, 0xffffff][i % 4], 0.13, 0.06),
  lupine: (f, x, z, i) => hyacinth(f, x, z, [0xb497f5, 0x9d7ef0, 0xff9dbd][i % 3], 0.1, 0.02),
  buttercup: (f, x, z) => smallYellow(f, x, z, 0.1, 0.06),
  clover: (f, x, z) => daisy(f, x, z, 0.1, 0.06, 0.9),
  dandelion: (f, x, z) => smallYellow(f, x, z, 0.12, 0.06),
};
const MIX = ['tulip', 'clover', 'lupine', 'buttercup', 'tulip'];
function flowerBox(P, o = {}) {
  const { b, wood } = P;
  const W = o.w || 0.86;
  wood.add(plankGeo(W, 0.17, 0.22), 0xa87646, { y: 0, z: 0.11 });
  wood.add(plankGeo(W + 0.04, 0.04, 0.24), 0xc59a63, { y: 0.085, z: 0.11 });
  b.add(BOX, 0x5b3d28, { y: 0.07, z: 0.11, sx: W - 0.08, sy: 0.04, sz: 0.16 });
  for (const sx of [-1, 1]) b.add(BOX, 0x8d5f36, { x: sx * (W / 2 - 0.1), y: 0, z: 0.225, sx: 0.035, sy: 0.12, sz: 0.01 });
  const n = Math.max(4, Math.round(W / 0.15));
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 0.08 + i * (W - 0.16) / (n - 1); const z = 0.1 + (i % 2 ? 0.03 : -0.02);
    b.add(SPH, 0x62b35a, { x, y: 0.1, z, sx: 0.07, sy: 0.045, sz: 0.06 });
    const sp = BOX_FLOWERS[o.species] ? o.species : MIX[i % MIX.length];
    BOX_FLOWERS[sp](b, x, z, i);
  }
}

export const PARTS = {
  'part:door': { slot: 'door', build: plainDoor },
  'part:archdoor': { slot: 'door', build: archDoor },
  'part:archdoor-brown': { slot: 'door', build: (P, o) => archDoor(P, { ...o, color: 'brown' }) },
  'part:window': { slot: 'window', build: plainWindow },
  'part:roundwindow': { slot: 'window', build: roundWindow },
  'piece:awning': { slot: 'over', build: awningPart },
  'part:flowerbox': { slot: 'sill', build: flowerBox },
  'part:wreath': { slot: 'doordeco', build: wreath },
};

// ひさしだけで置いたとき（むかしの置きかた）。かべがないので、木の板を1まい立てて付ける
function awning(op) {
  const g = new THREE.Group(); const B = partBags();
  B.wood.add(plankGeo(1.7, 2.3, 0.12), WOOD[1], { y: 1.15, z: -0.06 });
  awningPart(bagsAt(B, 0, 2.05, 0, 0), { w: 1.4 });
  g.add(blob(1.0, 0.6, 0.2), bagsMesh(B));
  return { mesh: g, walls: [{ dx: 0, dz: 0, r: 0.4 }] };
}

// ---- レイズドベッド（木の枠の高い花だん） ------------------------------------
function raisedBed(op) {
  const rnd = seeded(op.seed || 9);
  const g = new THREE.Group();
  const b = new Bag(); const f = new Bag();
  const W = 1.9; const D = 0.95; const H = 0.42;
  g.add(blob(W * 0.8, D * 1.0, 0.25));
  // 板をかさねた枠
  for (const [len, vert, px, pz] of [[W, false, 0, D / 2], [W, false, 0, -D / 2], [D, true, W / 2, 0], [D, true, -W / 2, 0]]) {
    for (let k = 0; k < 3; k++) {
      const y = 0.07 + k * 0.135;
      b.add(rboxGeo(vert ? 0.07 : len, 0.12, vert ? len : 0.07, 0.02), WOOD[(k + (vert ? 1 : 0)) % WOOD.length], { x: px, y, z: pz });
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(rboxGeo(0.1, H + 0.04, 0.1, 0.02), WOOD[2], { x: sx * W / 2, y: (H + 0.04) / 2, z: sz * D / 2 });
  b.add(BOX, 0x5b3d28, { y: H - 0.06, sx: W - 0.1, sy: 0.08, sz: D - 0.1 });
  // 花（ぎっしり）
  const n = 24;
  for (let i = 0; i < n; i++) {
    const x = (rnd() - 0.5) * (W - 0.3); const z = (rnd() - 0.5) * (D - 0.25);
    const k = rnd();
    if (k < 0.3) tulip(f, x, z, [0xff9fbd, 0xffd84a, 0xffffff, 0xc7a6ff][i % 4], 0.28 + rnd() * 0.12, H - 0.04);
    else if (k < 0.6) hyacinth(f, x, z, [0xb497f5, 0xff9ec3][i % 2], 0.24 + rnd() * 0.1, H - 0.04);
    else if (k < 0.85) daisy(f, x, z, 0.12 + rnd() * 0.08, H - 0.04, 1.15);
    else smallYellow(f, x, z, 0.1 + rnd() * 0.08, H - 0.04);
  }
  for (let i = 0; i < 6; i++) leafBlade(f, (rnd() - 0.5) * W * 0.8, H - 0.04, (rnd() - 0.5) * D * 0.7, 0.22, rnd() * 6.28, 0x62b35a, 0.8);
  const flowers = f.mesh();
  g.add(b.mesh(), flowers);
  g.userData.update = (t) => { flowers.rotation.z = Math.sin(t * 1.7 + (op.seed || 0)) * 0.01; };
  return { mesh: g, walls: [{ dx: -W / 2 + 0.2, dz: 0, r: 0.35 }, { dx: 0, dz: 0, r: 0.4 }, { dx: W / 2 - 0.2, dz: 0, r: 0.35 }] };
}

// ---- 丘の家（草でおおわれたまるい丘。石の玄関に扉、よこに窓。扉・窓・ひさしは付けかえられる）----
const HR = 2.6; const HRZ = HR * 0.9; const HH = 2.5; const HY = 0.34;
function domePoint(x, y) {          // 丘の表面の z と、外向きの水平の向き
  const t = 1 - (x * x) / (HR * HR) - ((y - HY) ** 2) / (HH * HH);
  const z = HRZ * Math.sqrt(Math.max(0, t));
  return { z, ry: Math.atan2(x / (HR * HR), z / (HRZ * HRZ)) };
}
const WIN = (sx) => { const x = sx * 1.55; const y = 1.35; const d = domePoint(x, y); return { x: x + Math.sin(d.ry) * 0.18, y, z: d.z + Math.cos(d.ry) * 0.18, ry: d.ry }; };
const PORCH_Z = HRZ + 0.18;         // 玄関の石の前の面
export const HOUSES = {
  'piece:hill': {
    sockets: {
      door: { slot: 'door', x: 0, y: HY + 0.06, z: PORCH_Z + 0.01, ry: 0 },
      doorDeco: { slot: 'doordeco', x: 0, y: HY + 0.06 + 0.82, z: PORCH_Z + 0.08, ry: 0 },
      winL: { slot: 'window', ...WIN(-1) },
      winR: { slot: 'window', ...WIN(1) },
      overDoor: { slot: 'over', x: 0, y: 2.08, z: PORCH_Z + 0.01, ry: 0, w: 1.3 },
      sillL: { slot: 'sill', ...WIN(-1), y: 1.35 - 0.56, w: 0.86 },
      sillR: { slot: 'sill', ...WIN(1), y: 1.35 - 0.56, w: 0.86 },
      overL: { slot: 'over', ...WIN(-1), y: 1.35 + 0.64, w: 1.0 },
      overR: { slot: 'over', ...WIN(1), y: 1.35 + 0.64, w: 1.0 },
    },
    base: { door: 'part:door', winL: 'part:window', winR: 'part:window' },
  },
};
// 家に付いているパーツ（op.parts で付けかえ。null = はずす。花箱の花は op.flowers[ソケット]）
export function houseParts(op) { return { ...(HOUSES[op.k]?.base || {}), ...(op.parts || {}) }; }

function hillHouse(op) {
  const rnd = seeded(op.seed || 3);
  const g = new THREE.Group();
  const b = new Bag(); const glow = new Bag();
  g.add(blob(3.9, 3.4, 0.3));
  // 石のだんだん（丘のすそ）
  for (let k = 0; k < 2; k++) {
    b.add(CYL, k ? 0x7f9aa0 : 0x6f8a92, { y: 0.1 + k * 0.17, sx: HR + 0.45 - k * 0.2, sy: 0.2, sz: HRZ + 0.45 - k * 0.2 });
  }
  // 丘（半球。草の色をまだらに）
  const dome = new THREE.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  const cnt = dome.attributes.position.count;
  const colors = new Float32Array(cnt * 3);
  const c1 = new THREE.Color(0x77a456); const c2 = new THREE.Color(0x95bd62); const tmp = new THREE.Color();
  for (let i = 0; i < cnt; i++) {
    const x = dome.attributes.position.getX(i); const z = dome.attributes.position.getZ(i); const y = dome.attributes.position.getY(i);
    tmp.copy(c1).lerp(c2, 0.5 + 0.5 * Math.sin(x * 5.1 + z * 3.7) * 0.6 + y * 0.3);
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  dome.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mound = new THREE.Mesh(dome, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x2f4a22, emissiveIntensity: 0.3 }));
  mound.scale.set(HR, HH, HRZ);
  mound.position.y = HY;
  g.add(mound);
  // 玄関の石のアーチ（丘から前へつき出す。扉は 1.45m なので、まわりに石が見える）
  const PW = 1.5; const pr = PW / 2; const ph = 1.2; const depth = 0.75; const pz = PORCH_Z - depth / 2;
  b.add(BOX, 0x8fb1b6, { y: HY + ph / 2, z: pz, sx: PW, sy: ph, sz: depth });
  b.add(HALF, 0x8fb1b6, { y: HY + ph, z: pz, sx: pr, sy: pr, sz: depth });
  // 玄関の上は草でおおう（丘とつながって見えるように）
  b.add(HALF, 0x86b05c, { y: HY + ph + 0.02, z: pz - 0.12, sx: pr + 0.1, sy: pr + 0.12, sz: depth - 0.2 });
  // アーチのふちの石（ひとつずつ形がちがう）
  const ring = 9;
  for (let k = 0; k <= ring; k++) {
    const a = Math.PI * (k / ring);
    const x = Math.cos(a) * (pr - 0.02); const y = HY + ph + Math.sin(a) * (pr - 0.02);
    b.add(rboxGeo(0.3, 0.2 + rnd() * 0.05, 0.08, 0.04), [0xa4c3c6, 0x9bbcc0, 0x86a8ad][k % 3], { x, y, z: PORCH_Z + 0.02, rz: a - Math.PI / 2 });
  }
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) {
    b.add(rboxGeo(0.24, 0.26, 0.08, 0.04), [0x9bbcc0, 0xa4c3c6, 0x86a8ad][(k + (sx > 0)) % 3], { x: sx * (pr - 0.1), y: HY + 0.15 + k * 0.28, z: PORCH_Z + 0.02 });
  }
  // 窓のうしろの石わく（窓をかべから少し出して、丘に埋もれないように）
  for (const id of ['winL', 'winR']) {
    const s = HOUSES['piece:hill'].sockets[id];
    const w = at(b, s.x, s.y, s.z, s.ry);
    w.add(CYL, 0x86b05c, { z: -0.25, sx: 0.58, sy: 0.46, sz: 0.58, rx: Math.PI / 2 });   // 草のふくらみ
    w.add(new THREE.TorusGeometry(0.5, 0.07, 6, 20), 0x9bbcc0, { z: -0.02 });            // 石のふち
  }
  // 付いているパーツ
  const parts = houseParts(op);
  const PB = partBags(); PB.b = b; PB.gl = glow;
  for (const [id, s] of Object.entries(HOUSES['piece:hill'].sockets)) {
    const P = PARTS[parts[id]];
    if (!P || P.slot !== s.slot) continue;
    P.build(bagsAt(PB, s.x, s.y, s.z, s.ry), { w: s.w, d: s.d, species: op.flowers?.[id] });
  }
  // 玄関の石の段と、ぼんやり光る灯り
  for (let k = 0; k < 3; k++) b.add(CYL, [0xa4c3c6, 0x9bbcc0, 0x8fb1b6][k], { x: 0, y: 0.08 + k * 0.1, z: PORCH_Z + 0.5 - k * 0.2, sx: 0.85 - k * 0.1, sy: 0.12, sz: 0.45 });
  // 街灯（うさぽん村の街灯。家の高さにあわせて 2.4m）
  const lamp = prop('lamppost', 2.4); lamp.position.set(1.25, 0, PORCH_Z + 0.35); lamp.rotation.y = 0.5; g.add(lamp);
  glow.add(SPH, WARM, { x: 1.25, y: 2.05, z: PORCH_Z + 0.35, s: 0.001 });
  // 丘の上の草花
  const f = new Bag();
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2; const r = Math.sqrt(rnd()) * HR * 0.7;
    const x = Math.cos(a) * r; const z = Math.sin(a) * r * 0.9;
    if (z > 1.2 && Math.abs(x) < 1) continue;      // 玄関の上はあける
    const yy = HY + HH * Math.sqrt(Math.max(0, 1 - (x * x) / (HR * HR) - (z * z) / (HRZ * HRZ))) - 0.03;
    if (i % 2) daisy(f, x, z, 0.1, yy, 0.9); else smallYellow(f, x, z, 0.1, yy);
  }
  g.add(bagsMesh(PB), f.mesh());
  return { mesh: g, walls: [{ dx: 0, dz: -0.2, r: 2.1 }, { dx: -1.5, dz: 0.2, r: 1.1 }, { dx: 1.5, dz: 0.2, r: 1.1 }, { dx: 0, dz: 1.9, r: 0.5 }] };
}

// ---- 花のはち（どこにでも置ける小物。花は op.species でえらべる）---------------------
function flowerPot(op) {
  const g = new THREE.Group(); const b = new Bag();
  b.add(CYL, 0xc97b55, { y: 0.16, sx: 0.2, sy: 0.32, sz: 0.2 });
  b.add(CYL, 0xd98c66, { y: 0.33, sx: 0.23, sy: 0.06, sz: 0.23 });
  b.add(CYL, 0x5b3d28, { y: 0.355, sx: 0.19, sy: 0.01, sz: 0.19 });
  const sp = BOX_FLOWERS[op.species] ? op.species : null;
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26 + 0.3; const x = Math.cos(a) * 0.1; const z = Math.sin(a) * 0.1;
    b.add(SPH, 0x62b35a, { x, y: 0.37, z, sx: 0.07, sy: 0.045, sz: 0.07 });
    BOX_FLOWERS[sp || MIX[i]]({ add: (geo, c, o = {}) => b.add(geo, c, { ...o, y: (o.y || 0) + 0.3 }) }, x, z, i);
  }
  g.add(blob(0.35, 0.35, 0.2), b.mesh());
  return { mesh: g, walls: [{ dx: 0, dz: 0, r: 0.22 }] };
}

// ---- 街灯（うさぽん村の街灯をそのまま。ひとりでも置ける）---------------------------
function lampPost() {
  const g = new THREE.Group();
  g.add(blob(0.4, 0.4, 0.25), prop('lamppost', 2.4));
  return { mesh: g, walls: [{ dx: 0, dz: 0, r: 0.15 }] };
}

// ---- ベンチ（木の板と、くるっと巻いた脚。座れそうな、やさしい形） --------------------
function bench(op) {
  const rnd = seeded(op.seed || 21);
  const g = new THREE.Group(); const b = new Bag();
  const W = 1.5;
  g.add(blob(1.0, 0.5, 0.25));
  // 座面（3まいの板）と背もたれ（2まい）
  for (let k = 0; k < 3; k++) b.add(rboxGeo(W, 0.05, 0.13, 0.02), WOOD[(k + 1) % 3], { y: 0.42, z: -0.14 + k * 0.15 });
  for (let k = 0; k < 2; k++) b.add(rboxGeo(W, 0.12, 0.04, 0.015), WOOD[k % 3], { y: 0.66 + k * 0.15, z: -0.27, rx: -0.12 });
  // 脚: 両はしの、くろい鉄の脚（まるい足）
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 - 0.1);
    b.add(rboxGeo(0.05, 0.42, 0.45, 0.015), 0x3b3a40, { x, y: 0.21, z: -0.04 });
    b.add(rboxGeo(0.05, 0.4, 0.05, 0.015), 0x3b3a40, { x, y: 0.55, z: -0.26, rx: -0.12 });
    b.add(CYL, 0x3b3a40, { x, y: 0.46, z: 0.18, sx: 0.03, sy: 0.12, sz: 0.03, rz: Math.PI / 2 });   // ひじかけ
    b.add(SPH, 0x3b3a40, { x, y: 0.49, z: 0.2, s: 0.035 });
  }
  // 座面の上の、小さなクッションと、おき忘れの花
  b.add(rboxGeo(0.34, 0.07, 0.26, 0.03), 0xf4c9cf, { x: -0.38, y: 0.48, z: -0.06, ry: 0.15 });
  b.add(SPH, 0xffffff, { x: 0.45, y: 0.46, z: 0.02, s: 0.03 });
  if (rnd() < 2) b.add(SPH, 0xfff2b0, { x: 0.45, y: 0.46, z: 0.02, s: 0.012 });
  g.add(b.mesh());
  return { mesh: g, walls: [{ dx: -0.55, dz: 0, r: 0.3 }, { dx: 0, dz: 0, r: 0.3 }, { dx: 0.55, dz: 0, r: 0.3 }] };
}

// ---- ポスト（まるい屋根の赤いポスト。ささえの棒つき） ------------------------------
function mailbox(op) {
  const g = new THREE.Group(); const b = new Bag(); const gl = new Bag();
  const RED = 0xd9564a;
  g.add(blob(0.5, 0.5, 0.22));
  b.add(CYL, 0x8a6a4a, { y: 0.45, sx: 0.045, sy: 0.9, sz: 0.045 });                       // 棒
  b.add(rboxGeo(0.42, 0.26, 0.28, 0.06), RED, { y: 1.0 });                                   // はこ
  b.add(HALF, RED, { y: 1.13, sx: 0.21, sy: 0.12, sz: 0.14, rx: 0, rz: 0 });                // まるい屋根
  b.add(rboxGeo(0.26, 0.035, 0.02, 0.01), 0x3a2b24, { y: 1.04, z: 0.145 });                // 投入口
  b.add(rboxGeo(0.05, 0.14, 0.03, 0.01), 0xffd45c, { x: 0.22, y: 1.1, z: 0.0, rz: 0.1 });  // 旗
  b.add(SPH, 0xffd45c, { x: 0.24, y: 1.18, z: 0, s: 0.03 });
  b.add(rboxGeo(0.14, 0.09, 0.012, 0.01), 0xfff6dc, { y: 0.95, z: 0.145 });                // 名札
  // 足もとの、小さな花
  for (let i = 0; i < 4; i++) b.add(SPH, [0xff9fbd, 0xfff08a, 0xffffff, 0xc7a6ff][i], { x: -0.14 + i * 0.09, y: 0.06, z: 0.12 + (i % 2) * 0.04, s: 0.04 });
  g.add(b.mesh(), gl.mesh(true));
  return { mesh: g, walls: [{ dx: 0, dz: 0, r: 0.2 }] };
}

// ---- ランタン（ちいさな あかり。ぼんやり光る） --------------------------------------
function lantern(op) {
  const g = new THREE.Group(); const b = new Bag(); const gl = new Bag();
  const IRON = 0x3b3a40;
  g.add(blob(0.35, 0.35, 0.2));
  b.add(CYL, IRON, { y: 0.03, sx: 0.12, sy: 0.06, sz: 0.12 });                              // 台
  b.add(CYL, IRON, { y: 0.22, sx: 0.12, sy: 0.04, sz: 0.12 });
  b.add(CYL, IRON, { y: 0.55, sx: 0.12, sy: 0.04, sz: 0.12 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(CYL, IRON, { x: sx * 0.1, y: 0.39, z: sz * 0.1, sx: 0.012, sy: 0.34, sz: 0.012 });   // 4本の柱
  gl.add(rboxGeo(0.17, 0.3, 0.17, 0.03), 0xffe39a, { y: 0.39 });                             // あかり
  gl.add(SPH, 0xfffbe0, { y: 0.39, s: 0.05 });                                               // ほのお
  b.add(HALF, IRON, { y: 0.57, sx: 0.15, sy: 0.12, sz: 0.15 });                              // 屋根
  b.add(new THREE.TorusGeometry(0.05, 0.012, 6, 14, Math.PI), IRON, { y: 0.74, rz: 0 });   // 取っ手
  b.add(SPH, IRON, { y: 0.575 + 0.12, s: 0.025 });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xffe39a, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(1.3); halo.position.y = 0.4;
  g.add(b.mesh(), gl.mesh(true), halo);
  g.userData.update = (t) => { halo.material.opacity = 0.45 + Math.sin(t * 2.4 + (op.seed || 0)) * 0.1; };
  return { mesh: g, walls: [{ dx: 0, dz: 0, r: 0.14 }] };
}
let _halo = null;
function haloTex() {
  if (_halo) return _halo;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  _halo = new THREE.CanvasTexture(c); return _halo;
}

// ---- バラのアーチ（くぐれる。ツルとバラが からまる） --------------------------------
function roseArch(op) {
  const rnd = seeded(op.seed || 31);
  const g = new THREE.Group(); const b = new Bag();
  const W = 1.4; const H = 2.1;
  g.add(blob(1.1, 0.5, 0.22));
  const ROSE = [0xff7d9a, 0xff9fbd, 0xffffff, 0xffb27a];
  const pts = [];
  // 2本の柱と、まるいアーチ（細い鉄）
  for (const sx of [-1, 1]) b.add(CYL, 0xf3efe6, { x: sx * W / 2, y: (H - W / 2) / 2, z: 0, sx: 0.035, sy: H - W / 2, sz: 0.035 });
  const arc = new THREE.TorusGeometry(W / 2, 0.035, 8, 28, Math.PI);
  b.add(arc, 0xf3efe6, { y: H - W / 2 });
  // ツル（アーチにそって、うねる）と、葉と、バラ
  const N = 34;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = Math.PI * t;
    const side = i % 2 ? 1 : -1;
    // 柱の高さ(0〜0.5)→アーチ(0.5〜1)の2つの区間
    let x; let y;
    if (t < 0.5 === false) { x = Math.cos(Math.PI - (t - 0.5) * 2 * Math.PI) * 0 + 0; }
    const ax = Math.cos(Math.PI * (1 - t)) * (W / 2); const ay = (H - W / 2) + Math.sin(Math.PI * (1 - t)) * (W / 2);
    x = ax + (rnd() - 0.5) * 0.12; y = ay + (rnd() - 0.5) * 0.12;
    b.add(SPH, 0x5fa34a, { x, y, z: (rnd() - 0.5) * 0.14, sx: 0.07, sy: 0.035, sz: 0.05, rz: rnd() * 3 });
    if (i % 2 === 0) {
      const col = ROSE[Math.floor(rnd() * ROSE.length)];
      b.add(SPH, col, { x, y, z: 0.05 * side, s: 0.085 });
      b.add(SPH, new THREE.Color(col).multiplyScalar(0.82).getHex(), { x, y, z: 0.05 * side, s: 0.055 });
    }
    void a; void pts;
  }
  // 柱をのぼるツル
  for (const sx of [-1, 1]) for (let k = 0; k < 10; k++) {
    const y = 0.15 + k * ((H - W / 2 - 0.2) / 9);
    const x = sx * W / 2 + Math.sin(k * 1.7 + sx) * 0.05;
    b.add(SPH, 0x5fa34a, { x, y, z: (rnd() - 0.5) * 0.08, sx: 0.06, sy: 0.03, sz: 0.045, rz: rnd() * 3 });
    if (k % 2 === 1) { const col = ROSE[Math.floor(rnd() * ROSE.length)]; b.add(SPH, col, { x, y, z: 0.05, s: 0.08 }); b.add(SPH, new THREE.Color(col).multiplyScalar(0.8).getHex(), { x, y, z: 0.05, s: 0.05 }); }
  }
  g.add(b.mesh());
  // くぐれる: 柱だけ当たり判定
  return { mesh: g, walls: [{ dx: -W / 2, dz: 0, r: 0.1 }, { dx: W / 2, dz: 0, r: 0.1 }] };
}

export const PIECES = {
  'piece:awning': awning,
  'piece:raisedbed': raisedBed,
  'piece:hill': hillHouse,
  'piece:flowerpot': flowerPot,
  'piece:lamppost': lampPost,
  'piece:bench': bench,
  'piece:mailbox': mailbox,
  'piece:lantern': lantern,
  'piece:rosearch': roseArch,
};

// 1つ置く。op = { k:'piece:xxx', x, z, rot, seed }
export function buildPiece(op) {
  const make = PIECES[op.k];
  if (!make) return null;               // 知らない id（あたらしい版で作ったもの）は、読みとばす
  const { mesh, walls } = make(op);
  const group = new THREE.Group();
  group.add(mesh);
  group.position.set(op.x, heightAt(op.x, op.z), op.z);
  group.rotation.y = op.rot || 0;
  const c = Math.cos(op.rot || 0); const s = Math.sin(op.rot || 0);
  const ws = walls.map((w) => ({ x: op.x + w.dx * c + w.dz * s, z: op.z - w.dx * s + w.dz * c, r: w.r }));
  return { mesh: group, walls: ws, update: mesh.userData.update };
}
