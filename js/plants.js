// いろいろな植物。ふっくら茂る葉と大きな黄色いカップの花（キンポウゲ）、すっと立つ紫のルピナス、
// チューリップ、シロツメクサ、タンポポ。どれも風にゆれる。meadow.js から makePlants(wind) で呼ぶ。
import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { isTownSpot } from './town.js';
import { addWind } from './wind.js';

const MEADOW_R = 26;
const rand = (a, b) => a + Math.random() * (b - a);
function gauss() { return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(Math.PI * 2 * Math.random()); }
function inDisc(radius) {
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * radius;
  return [Math.cos(a) * r, Math.sin(a) * r];
}

// ---- 形をつくる道具 ------------------------------------------------------

class Builder {
  constructor() { this.pos = []; this.col = []; this.m = new THREE.Matrix4(); }
  // 以降の点を、この行列で動かしてから足す
  at(x, y, z, rx = 0, ry = 0, rz = 0, s = 1) {
    this.m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s),
    );
    return this;
  }
  tri(a, b, c, ca, cb, cc) {
    for (const [p, col] of [[a, ca], [b, cb], [c, cc]]) {
      const v = new THREE.Vector3(...p).applyMatrix4(this.m);
      this.pos.push(v.x, v.y, v.z);
      this.col.push(col[0], col[1], col[2]);
    }
  }
  // 帯: rows[i] = { l, r, c } をつないで面にする
  strip(rows) {
    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i]; const b = rows[i + 1];
      this.tri(a.l, a.r, b.l, a.c, a.c, b.c);
      this.tri(a.r, b.r, b.l, a.c, b.c, b.c);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.col), 3));
    // 外がわほどななめに向く法線（ふくらんで見える）
    const n = new Float32Array(this.pos.length);
    for (let i = 0; i < this.pos.length; i += 3) {
      const x = this.pos[i] * 0.7; const z = this.pos[i + 2] * 0.7;
      const l = Math.hypot(x, 1, z);
      n[i] = x / l; n[i + 1] = 1 / l; n[i + 2] = z / l;
    }
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    return g;
  }
}

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// 葉っぱ: 根もとから外へのびて、先がおじぎする
function leaf(b, { angle, len, wid, lift, droop, base, tip, y0 = 0.02, fold = 0.3 }) {
  const rows = [];
  const dx = Math.cos(angle); const dz = Math.sin(angle);
  const px = -dz; const pz = dx;
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = len * t;
    const y = y0 + lift * t - droop * t * t;
    const w = wid * Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(1, 0.04 + 0.96 * t))));
    const fy = w * fold;
    rows.push({
      l: [dx * r + px * w, y + fy, dz * r + pz * w],
      r: [dx * r - px * w, y + fy, dz * r - pz * w],
      c: mix(base, tip, Math.pow(t, 0.8)),
    });
  }
  b.strip(rows);
}

// 茎: 根もと(0,0,0)から先(x,y,z)へ、すこしカーブ
function stem(b, x, y, z, w, color, bend = 0.1) {
  const rows = [];
  const n = 4;
  const len = Math.hypot(x, z) || 1;
  const px = -z / len; const pz = x / len;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const cx = x * t - (x / len) * bend * t * (1 - t);
    const cz = z * t - (z / len) * bend * t * (1 - t);
    const cy = y * t;
    rows.push({ l: [cx + px * w, cy, cz + pz * w], r: [cx - px * w, cy, cz - pz * w], c: mul(color, 0.85 + 0.25 * t) });
  }
  b.strip(rows);
}

// カップ形の花（まるい花びらが上にむかって開く）。色は白〜灰色でつくり、あとから色をかける
function cup(b, { r, petals, tall = 1, wide = 0.75, dark = 0.72, rows = 5 }) {
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 + 0.3;
    const dx = Math.cos(a); const dz = Math.sin(a);
    const px = -dz; const pz = dx;
    const out = [];
    for (let k = 0; k <= rows; k++) {
      const t = k / rows;
      const rho = r * (0.12 + 0.88 * t) * (1 - 0.15 * Math.sin(t * Math.PI)) + r * 0.05;
      const y = r * tall * (1.15 * t - 0.4 * t * t);
      const w = r * wide * Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(1, 0.1 + 0.9 * t))));
      const v = dark + (1 - dark) * Math.pow(t, 0.7);
      out.push({ l: [dx * rho + px * w, y, dz * rho + pz * w], r: [dx * rho - px * w, y, dz * rho - pz * w], c: [v, v, v] });
    }
    b.strip(out);
  }
}

// 小さなまるい玉（花の中心・わた毛など）
function orb(b, x, y, z, r, color, detail = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail).toNonIndexed();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i += 3) {
    const v = [0, 1, 2].map((k) => [p.getX(i + k) + x, p.getY(i + k) + y, p.getZ(i + k) + z]);
    b.tri(v[0], v[1], v[2], color, color, color);
  }
}

// ---- 植物のひな形 --------------------------------------------------------

const LEAF_DARK = [0.14, 0.36, 0.1];
const LEAF_LIGHT = [0.5, 0.82, 0.26];

// ふっくら茂る葉 + 大きな黄色いカップの花
function buttercup() {
  const f = new Builder(); const p = new Builder();
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rand(-0.2, 0.2);
    const inner = i % 3 === 0;
    leaf(f, {
      angle: a, len: inner ? rand(0.4, 0.5) : rand(0.68, 0.9), wid: inner ? 0.14 : 0.23,
      lift: inner ? 0.3 : rand(0.1, 0.2), droop: inner ? 0.12 : rand(0.22, 0.34),
      base: mul(LEAF_DARK, rand(0.9, 1.1)), tip: mul(LEAF_LIGHT, rand(0.85, 1.1)),
    });
  }
  const n = 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(-0.4, 0.4);
    const d = rand(0.08, 0.3);
    const h = rand(0.34, 0.6);
    const x = Math.cos(a) * d; const z = Math.sin(a) * d;
    stem(f, x, h, z, 0.016, [0.3, 0.55, 0.18], 0.06);
    const rad = rand(0.18, 0.25);
    p.at(x, h, z, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    cup(p, { r: rad, petals: 5, tall: 0.95, wide: 0.82, dark: 0.7 });
    f.at(x, h, z, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    orb(f, 0, rad * 0.22, 0, rad * 0.26, [1.0, 0.62, 0.12], 1);
    for (let k = 0; k < 6; k++) {
      const ka = (k / 6) * Math.PI * 2;
      orb(f, Math.cos(ka) * rad * 0.34, rad * 0.4, Math.sin(ka) * rad * 0.34, rad * 0.06, [1.0, 0.8, 0.2], 0);
    }
    f.m.identity(); p.m.identity();
  }
  return { foliage: f.geometry(), petals: p.geometry(), H: 0.85 };
}

// すっと立つ穂状の花（ルピナス）
function lupine() {
  const f = new Builder(); const p = new Builder();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand(-0.2, 0.2);
    leaf(f, { angle: a, len: rand(0.3, 0.46), wid: 0.05, lift: rand(0.3, 0.5), droop: rand(0.1, 0.25), base: mul(LEAF_DARK, 1.1), tip: mul(LEAF_LIGHT, 0.95), fold: 0.5 });
  }
  const H = rand(0.8, 1.0);
  stem(f, 0.03, H, 0, 0.018, [0.28, 0.5, 0.16], 0.04);
  const N = 20;
  for (let k = 0; k < N; k++) {
    const u = k / (N - 1);
    const y = 0.32 + u * (H - 0.32);
    const a = k * 2.4;
    const r = 0.085 * (1 - u * 0.55);
    const sx = 0.03 * (y / H);
    p.at(sx + Math.cos(a) * 0.03, y, Math.sin(a) * 0.03, Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
    cup(p, { r, petals: 4, tall: 0.8, wide: 0.9, dark: 0.75, rows: 3 });
    p.m.identity();
  }
  orb(p, 0.03, H + 0.03, 0, 0.04, [0.95, 0.95, 0.95], 0);
  return { foliage: f.geometry(), petals: p.geometry(), H: H + 0.1 };
}

// チューリップ
function tulip() {
  const f = new Builder(); const p = new Builder();
  const H = rand(0.5, 0.68);
  for (let i = 0; i < 3; i++) {
    leaf(f, { angle: (i / 3) * Math.PI * 2 + rand(-0.3, 0.3), len: rand(0.34, 0.46), wid: 0.065, lift: rand(0.22, 0.34), droop: rand(0.12, 0.2), base: mul(LEAF_DARK, 1.15), tip: mul(LEAF_LIGHT, 1.0), fold: 0.4 });
  }
  stem(f, 0.02, H, 0, 0.02, [0.3, 0.55, 0.18], 0.05);
  p.at(0.02, H, 0, 0.1, 0, -0.08);
  cup(p, { r: 0.1, petals: 6, tall: 1.9, wide: 0.55, dark: 0.7, rows: 5 });
  return { foliage: f.geometry(), petals: p.geometry(), H: H + 0.2 };
}

// シロツメクサ（まるい葉と白いぽんぽん）
function clover() {
  const f = new Builder(); const p = new Builder();
  const tone = [0.22, 0.5, 0.16];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rand(-0.3, 0.3);
    const d = rand(0.06, 0.34);
    const h = rand(0.1, 0.2);
    const x = Math.cos(a) * d; const z = Math.sin(a) * d;
    stem(f, x, h, z, 0.01, [0.3, 0.55, 0.2], 0);
    // 3まいの丸い小葉
    for (let k = 0; k < 3; k++) {
      const la = k * 2.094 + a;
      const lx = x + Math.cos(la) * 0.05; const lz = z + Math.sin(la) * 0.05;
      f.at(lx, h, lz, 0, 0, 0);
      const rows = []; const seg = 8; const R = 0.075;
      for (let s = 0; s < seg; s++) {
        const s0 = (s / seg) * Math.PI * 2; const s1 = ((s + 1) / seg) * Math.PI * 2;
        const c0 = mix(tone, [0.5, 0.78, 0.3], 0.5 + 0.5 * Math.cos(s0));
        f.tri([0, 0.01, 0], [Math.cos(s0) * R, 0.02, Math.sin(s0) * R], [Math.cos(s1) * R, 0.02, Math.sin(s1) * R], mul(tone, 1.05), c0, c0);
      }
      f.m.identity();
      void rows;
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = rand(0, Math.PI * 2); const d = rand(0.05, 0.28); const h = rand(0.22, 0.34);
    const x = Math.cos(a) * d; const z = Math.sin(a) * d;
    stem(f, x, h, z, 0.01, [0.3, 0.55, 0.2], 0.03);
    orb(p, x, h + 0.03, z, 0.065, [0.96, 0.96, 0.96], 1);
    orb(p, x, h + 0.08, z, 0.045, [1, 1, 1], 1);
  }
  return { foliage: f.geometry(), petals: p.geometry(), H: 0.4 };
}

// タンポポ（ぎざぎざ葉と、まるいわた毛）
function dandelion() {
  const f = new Builder(); const p = new Builder();
  const H = rand(0.4, 0.55);
  for (let i = 0; i < 7; i++) {
    leaf(f, { angle: (i / 7) * Math.PI * 2 + rand(-0.2, 0.2), len: rand(0.2, 0.3), wid: 0.05, lift: 0.08, droop: 0.04, base: mul(LEAF_DARK, 1.2), tip: mul(LEAF_LIGHT, 1.0), fold: 0.2 });
  }
  stem(f, 0.03, H, 0, 0.012, [0.34, 0.58, 0.24], 0.06);
  orb(p, 0.03, H + 0.06, 0, 0.085, [1, 1, 1], 2);
  for (let k = 0; k < 14; k++) { // わた毛のとげとげ
    const a = Math.random() * Math.PI * 2; const e = Math.random() * Math.PI - Math.PI / 2;
    orb(p, 0.03 + Math.cos(a) * Math.cos(e) * 0.095, H + 0.06 + Math.sin(e) * 0.095, Math.sin(a) * Math.cos(e) * 0.095, 0.014, [0.9, 0.9, 0.9], 0);
  }
  return { foliage: f.geometry(), petals: p.geometry(), H: H + 0.2 };
}

// ---- ならべる -------------------------------------------------------------

function scatter({ template, count, flowerColors, clusters, clusterSpread, scale, tilt = 0.12, wind, gain }) {
  const { foliage, petals, H } = template;
  const fMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x3d6a28, emissiveIntensity: 0.3 });
  const pMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, emissive: 0x555555, emissiveIntensity: 0.22 });
  addWind(fMat, wind, H, gain);
  addWind(pMat, wind, H, gain);
  const fm = new THREE.InstancedMesh(foliage, fMat, count);
  const pm = new THREE.InstancedMesh(petals, pMat, count);
  fm.frustumCulled = false; pm.frustumCulled = false;
  const centers = [];
  for (let i = 0; i < clusters; i++) centers.push(inDisc(MEADOW_R - 2));
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler();
  const s = new THREE.Vector3(); const v = new THREE.Vector3(); const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    let x; let z;
    for (let tries = 0; tries < 6; tries++) {
      if (Math.random() < 0.8) {
        const cc = centers[Math.floor(Math.random() * centers.length)];
        x = cc[0] + gauss() * clusterSpread; z = cc[1] + gauss() * clusterSpread;
      } else [x, z] = inDisc(MEADOW_R);
      if (Math.hypot(x, z) < MEADOW_R && !isTownSpot(x, z, -0.2)) break;
      x = 99;
    }
    if (x === 99) { [x, z] = inDisc(10); }
    e.set(rand(-tilt, tilt), Math.random() * Math.PI * 2, rand(-tilt, tilt));
    q.setFromEuler(e);
    const k = rand(scale[0], scale[1]);
    s.set(k, k * rand(0.9, 1.15), k);
    v.set(x, heightAt(x, z) - 0.02, z);
    m.compose(v, q, s);
    fm.setMatrixAt(i, m);
    pm.setMatrixAt(i, m);
    const col = flowerColors[Math.floor(Math.random() * flowerColors.length)];
    pm.setColorAt(i, c.set(col));
  }
  const g = new THREE.Group();
  g.add(fm, pm);
  return g;
}

// 種類ごとの色・大きさ・ゆれ方。野原にはえる花も、子どもがうえる花も、ここの設定をつかう
export const SPECIES = {
  buttercup: { make: buttercup, colors: [0xffe03a, 0xffd620, 0xffdc2e, 0xffe85a, 0xffcf1a], scale: [0.9, 1.7], gain: 0.1, tilt: 0.12, label: 'きいろい花' },
  lupine: { make: lupine, colors: [0xb497f5, 0x9d7ef0, 0xff9dbd, 0xffd0e0, 0x8fc2f5, 0xffffff], scale: [0.85, 1.35], gain: 0.14, tilt: 0.12, label: 'むらさきの花' },
  tulip: { make: tulip, colors: [0xff7a8a, 0xff9dbd, 0xffb27a, 0xfff08a, 0xffffff, 0xff5f7a], scale: [0.9, 1.4], gain: 0.12, tilt: 0.12, label: 'チューリップ' },
  clover: { make: clover, colors: [0xffffff, 0xfff0f5, 0xffe6ef], scale: [0.9, 1.5], gain: 0.08, tilt: 0.05, label: 'シロツメクサ' },
  dandelion: { make: dandelion, colors: [0xffffff, 0xffffff, 0xfff6c8, 0xffe14a, 0xffdd33], scale: [0.9, 1.5], gain: 0.14, tilt: 0.12, label: 'タンポポ' },
};
export const SPECIES_KEYS = Object.keys(SPECIES);

export function makePlants(wind) {
  const g = new THREE.Group();
  const counts = { buttercup: [110, 9, 1.9], lupine: [260, 10, 1.6], tulip: [220, 10, 1.5], clover: [160, 12, 2.2], dandelion: [200, 8, 2.4] };
  for (const key of SPECIES_KEYS) {
    const sp = SPECIES[key];
    const [count, clusters, clusterSpread] = counts[key];
    g.add(scatter({ template: sp.make(), count, flowerColors: sp.colors, clusters, clusterSpread, scale: sp.scale, tilt: sp.tilt, wind, gain: sp.gain }));
  }
  return g;
}

// ---- 子どもがうえる花 ------------------------------------------------------
// 種類ごとに、あらかじめ大きめの入れ物（インスタンス）を用意しておき、うえた数だけ見せる。
// 場所とむきは「種(seed)」から決まるので、保存するのは点と種だけでよい。かった場所でも消えない。

export const LAYER_CAP = 600; // 1種類あたりの上限

export function createPlantLayer(wind) {
  const group = new THREE.Group();
  const parts = {};
  for (const key of SPECIES_KEYS) {
    const sp = SPECIES[key];
    const { foliage, petals, H } = sp.make();
    const fMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x3d6a28, emissiveIntensity: 0.3 });
    const pMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, emissive: 0x555555, emissiveIntensity: 0.22 });
    addWind(fMat, wind, H, sp.gain, 1);   // 1 = かった場所で消えない
    addWind(pMat, wind, H, sp.gain, 1);
    const fm = new THREE.InstancedMesh(foliage, fMat, LAYER_CAP);
    const pm = new THREE.InstancedMesh(petals, pMat, LAYER_CAP);
    for (const m of [fm, pm]) { m.frustumCulled = false; m.count = 0; group.add(m); }
    pm.setColorAt(0, new THREE.Color(0xffffff));
    parts[key] = { fm, pm, n: 0 };
  }
  const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler();
  const s = new THREE.Vector3(); const v = new THREE.Vector3(); const c = new THREE.Color();

  // 1本ぶんを足す。item = { s: 種類, x, z, rot, k, tx, tz, col }
  function add(it) {
    const part = parts[it.s];
    if (!part || part.n >= LAYER_CAP) return false;
    e.set(it.tx, it.rot, it.tz);
    q.setFromEuler(e);
    s.set(it.k, it.k * 1.05, it.k);
    v.set(it.x, heightAt(it.x, it.z) - 0.02, it.z);
    m4.compose(v, q, s);
    part.fm.setMatrixAt(part.n, m4);
    part.pm.setMatrixAt(part.n, m4);
    part.pm.setColorAt(part.n, c.set(SPECIES[it.s].colors[it.col % SPECIES[it.s].colors.length]));
    part.n += 1;
    part.fm.count = part.n; part.pm.count = part.n;
    part.fm.instanceMatrix.needsUpdate = true; part.pm.instanceMatrix.needsUpdate = true;
    if (part.pm.instanceColor) part.pm.instanceColor.needsUpdate = true;
    return true;
  }
  function clear() {
    for (const p of Object.values(parts)) { p.n = 0; p.fm.count = 0; p.pm.count = 0; }
  }
  return { group, add, clear, count: (key) => parts[key].n };
}

// うえたスタンプ1つ（中心 x,z）から、まわりに3本の花を決める。おなじ種からはいつも同じ形になる
export function stampItems(species, x, z, seed, index) {
  const sp = SPECIES[species];
  let a = (seed * 2654435761 + index * 40503) >>> 0;
  const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const items = [];
  for (let i = 0; i < 3; i++) {
    const ang = rnd() * Math.PI * 2; const r = Math.sqrt(rnd()) * 0.5;
    items.push({
      s: species, x: x + Math.cos(ang) * r, z: z + Math.sin(ang) * r,
      rot: rnd() * Math.PI * 2, k: sp.scale[0] + rnd() * (sp.scale[1] - sp.scale[0]),
      tx: (rnd() - 0.5) * 2 * sp.tilt, tz: (rnd() - 0.5) * 2 * sp.tilt, col: Math.floor(rnd() * 100),
    });
  }
  return items;
}
