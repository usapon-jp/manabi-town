// 街づくりの共通部品（色・形・かげ・煙・まとめて描くための袋）。town.js と cottage.js が使う。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';


const mats = new Map();
// 絵本らしいやわらかい色。かげでも色がくすまないよう、ほんのり自分でも光らせる
export const mat = (color, opts = {}) => {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.24, ...opts }));
  return mats.get(key);
};
export const glass = (() => new THREE.MeshBasicMaterial({ color: 0xffe6a6 }))();

export const box = (w, h, d, color, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
};
export const cyl = (rt, rb, h, color, x = 0, y = 0, z = 0, seg = 16) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.position.set(x, y, z);
  return m;
};
export const cone = (r, h, color, x = 0, y = 0, z = 0, seg = 16) => {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color));
  m.position.set(x, y, z);
  return m;
};
export const ball = (r, color, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat(color));
  m.position.set(x, y, z);
  return m;
};

let dotTex = null;
export function softDot() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

// 建物の足もとのやわらかいかげ
export function blob(rx, rz = rx, opacity = 0.32) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(1, 28),
    new THREE.MeshBasicMaterial({ color: 0x3f5a2a, map: softDot(), transparent: true, opacity, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.scale.set(rx, rz, 1);
  m.position.y = 0.05;
  return m;
}

// ふわっとのぼる煙。g.userData.update から t を渡して動かす
export function smoke(x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const puffs = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xffffff, transparent: true, depthWrite: false }));
    g.add(s);
    puffs.push(s);
  }
  g.userData.tick = (t) => puffs.forEach((s, i) => {
    const k = (t * 0.22 + i / puffs.length) % 1;
    s.position.set(Math.sin(k * 5 + i) * 0.12 + k * 0.5, k * 1.8, 0);
    s.scale.setScalar(0.28 + k * 0.7);
    s.material.opacity = Math.sin(k * Math.PI) * 0.55;
  });
  return g;
}


// ---- まとめて描く袋 ------------------------------------------------------
// 小さな部品（花・タイル・石）をたくさん足して、ひとつのメッシュにまとめる。色は頂点ごとに持つ。

const SPH = new THREE.SphereGeometry(1, 12, 8);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const HALF = new THREE.CylinderGeometry(1, 1, 1, 20, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2); // うえ半分（アーチ）
export const GEO = { SPH, CYL, BOX, HALF };

const _m = new THREE.Matrix4(); const _q = new THREE.Quaternion(); const _e = new THREE.Euler();
const _p = new THREE.Vector3(); const _s = new THREE.Vector3(); const _c = new THREE.Color();

// かどのまるい箱（かたちは幅 w・高さ h・奥行 d、まるみ r）
export function rboxGeo(w, h, d, r) {
  const g = new THREE.BoxGeometry(w, h, d, 4, 4, 4);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const hw = w / 2 - r; const hh = h / 2 - r; const hd = d / 2 - r;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i); const y = pos.getY(i); const z = pos.getZ(i);
    const ix = Math.max(-hw, Math.min(hw, x)); const iy = Math.max(-hh, Math.min(hh, y)); const iz = Math.max(-hd, Math.min(hd, z));
    const dx = x - ix; const dy = y - iy; const dz = z - iz;
    const len = Math.hypot(dx, dy, dz);
    if (len > 1e-6) {
      pos.setXYZ(i, ix + (dx / len) * r, iy + (dy / len) * r, iz + (dz / len) * r);
      nor.setXYZ(i, dx / len, dy / len, dz / len);
    }
  }
  return g;
}

let bagMat = null; let glowMat = null;

export class Bag {
  constructor() { this.list = []; }
  // geo: 単位の形（SPH/CYL/BOX/HALF）か rboxGeo。x,y,z=場所、s/sx/sy/sz=大きさ、rx,ry,rz か q=向き
  add(geo, color, o = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    const s = o.s ?? 1;
    _p.set(o.x || 0, o.y || 0, o.z || 0);
    _s.set(o.sx ?? s, o.sy ?? s, o.sz ?? s);
    if (o.q) _q.copy(o.q); else _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0));
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    const n = g.attributes.position.count;
    _c.set(color);
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.list.push(g);
    return this;
  }
  // glow: true なら、かげにならず光って見える（まどの明かり）
  mesh(glow = false) {
    if (!bagMat) {
      bagMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x2e2a24 });
      glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    }
    if (!this.list.length) return new THREE.Group();
    return new THREE.Mesh(mergeGeometries(this.list), glow ? glowMat : bagMat);
  }
}

// 向きを「上 → 法線」にあわせるクォータニオン
export function alignUp(nx, ny, nz) {
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, ny, nz).normalize());
}

// ---- 花だんの花 ----------------------------------------------------------

export function leafBlade(bag, x, y, z, len, ang, color = 0x62b35a, tilt = 0.7) {
  bag.add(SPH, color, {
    x: x + Math.sin(ang) * len * 0.45, y: y + len * 0.3, z: z + Math.cos(ang) * len * 0.45,
    sx: 0.028, sy: 0.012, sz: len / 2, ry: ang, rx: -tilt,
  });
}

export function tulip(bag, x, z, color, h = 0.35, y0 = 0.1) {
  bag.add(CYL, 0x5fa34a, { x, y: y0 + h / 2, z, sx: 0.013, sy: h, sz: 0.013 });
  bag.add(SPH, color, { x, y: y0 + h + 0.09, z, sx: 0.085, sy: 0.125, sz: 0.085 });
  bag.add(SPH, color, { x: x + 0.035, y: y0 + h + 0.1, z, sx: 0.05, sy: 0.11, sz: 0.06, rz: -0.25 });
  bag.add(SPH, color, { x: x - 0.035, y: y0 + h + 0.1, z, sx: 0.05, sy: 0.11, sz: 0.06, rz: 0.25 });
  leafBlade(bag, x, y0, z, 0.3, Math.random() * 6.28, 0x5fa34a, 0.9);
  leafBlade(bag, x, y0, z, 0.26, Math.random() * 6.28, 0x6bb856, 0.9);
}

export function hyacinth(bag, x, z, color, h = 0.3, y0 = 0.1) {
  bag.add(CYL, 0x5fa34a, { x, y: y0 + h / 2, z, sx: 0.015, sy: h, sz: 0.015 });
  const light = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.3).getHex();
  for (let i = 0; i < 12; i++) {
    const u = i / 11;
    const a = i * 2.4;
    const r = 0.05 * (1 - u * 0.6);
    bag.add(SPH, i % 3 === 0 ? light : color, {
      x: x + Math.cos(a) * r, y: y0 + h * 0.55 + u * 0.28, z: z + Math.sin(a) * r, s: 0.052 * (1 - u * 0.35),
    });
  }
  leafBlade(bag, x, y0, z, 0.34, Math.random() * 6.28, 0x5fa34a, 0.8);
  leafBlade(bag, x, y0, z, 0.3, Math.random() * 6.28, 0x6bb856, 0.8);
}

export function daisy(bag, x, z, h = 0.14, y0 = 0.1, size = 1) {
  bag.add(CYL, 0x6bb856, { x, y: y0 + h / 2, z, sx: 0.008, sy: h, sz: 0.008 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    bag.add(SPH, 0xffffff, { x: x + Math.cos(a) * 0.05 * size, y: y0 + h, z: z + Math.sin(a) * 0.05 * size, sx: 0.05 * size, sy: 0.012, sz: 0.022 * size, ry: -a });
  }
  bag.add(SPH, 0xffcf33, { x, y: y0 + h + 0.008, z, s: 0.03 * size });
}

export function smallYellow(bag, x, z, h = 0.14, y0 = 0.1) {
  bag.add(CYL, 0x6bb856, { x, y: y0 + h / 2, z, sx: 0.007, sy: h, sz: 0.007 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    bag.add(SPH, 0xffd84a, { x: x + Math.cos(a) * 0.035, y: y0 + h, z: z + Math.sin(a) * 0.035, s: 0.03 });
  }
  bag.add(SPH, 0xff9a2e, { x, y: y0 + h + 0.005, z, s: 0.02 });
}

// 決まった乱数（毎回おなじ花だんになる）
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
