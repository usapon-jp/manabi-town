// 柵と橋。くまのプーさんの絵本に出てきそうな、ちょっとゆがんだ木のぬくもり。
//   柵 … 少しかたむいた丸太の柱と、枝のような横木。根もとにはこけと小さな花
//   橋 … ゆるやかにそった木の板の橋。枝の手すり。ぼうきれ（プーさんの橋あそび）を落とせそうな低い橋
// 子どもが歩いて引いた線（柵）や、歩いたはしからはしまで（橋）から作る。保存するのは点だけ。
import * as THREE from 'three';
import { Bag, GEO, rboxGeo, seeded, alignUp } from './townkit.js';
import { heightAt, decks } from './terrain.js';

const { CYL, SPH, BOX: BOXG } = GEO;
const CONE = new THREE.ConeGeometry(1, 1, 8);

export const FENCE_SPACING = 0.85;     // 柱と柱のきょり
export const BRIDGE_MIN = 2.2;         // 橋のみじかい長さ（m）
export const BRIDGE_MAX = 7;           // 橋のながい長さ（m）
const BRIDGE_W = 1.7;                  // 橋のはば

// あたたかい、ふるびた木の色
const WOOD = [0xb98a55, 0xc59a63, 0xa9794a, 0xbf9159];
const WOOD_DARK = 0x8d6238;
const END_GRAIN = 0xe3c08a;
const MOSS = 0x8fb85a;

// 点の並びを、同じ間隔の点に並べなおす（ひらいた線として）
export function resampleLine(pts, spacing) {
  const out = [];
  if (pts.length < 2) return out;
  let carry = 0;
  out.push({ x: pts[0], z: pts[1] });
  for (let i = 2; i < pts.length; i += 2) {
    const ax = pts[i - 2]; const az = pts[i - 1]; const bx = pts[i]; const bz = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (!len) continue;
    let d = spacing - carry;
    while (d <= len) { out.push({ x: ax + ((bx - ax) * d) / len, z: az + ((bz - az) * d) / len }); d += spacing; }
    carry = len - (d - spacing);
  }
  return out;
}

// ---- 柵 ---------------------------------------------------------------------

// てつの柵: 黒い細い柱に、やりの先とうず巻き。ひくい石垣の上に立つ
function buildIronFence(op) {
  const rnd = seeded(op.seed || 7);
  const posts = resampleLine(op.pts, 1.5);
  const bag = new Bag();
  const walls = [];
  const IRON = 0x2d2f36;
  const ys = posts.map((p) => heightAt(p.x, p.z));
  const base = 0.3;
  posts.forEach((p, i) => {
    const y = ys[i];
    bag.add(rboxGeo(0.12, 1.1, 0.12, 0.02), IRON, { x: p.x, y: y + 0.55, z: p.z });
    bag.add(SPH, IRON, { x: p.x, y: y + 1.15, z: p.z, s: 0.08 });
    walls.push({ x: p.x, z: p.z, r: 0.16 });
  });
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i]; const b = posts[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const ang = Math.atan2(b.x - a.x, b.z - a.z);
    const bars = Math.max(3, Math.round(len / 0.17));
    // 低い石垣
    const stones = Math.max(2, Math.round(len / 0.5));
    for (let s = 0; s < stones; s++) {
      const t = (s + 0.5) / stones;
      const x = a.x + (b.x - a.x) * t; const z = a.z + (b.z - a.z) * t;
      const y = heightAt(x, z);
      for (let row = 0; row < 2; row++) {
        const sh = [0x8b95a3, 0x7c8695, 0x9aa4b2][Math.floor(rnd() * 3)];
        bag.add(rboxGeo(len / stones + 0.04, 0.16, 0.34, 0.04), sh, { x, y: y + 0.08 + row * 0.16, z, ry: ang - Math.PI / 2 });
      }
    }
    for (const hh of [0.52, 0.95]) {
      const mx = (a.x + b.x) / 2; const mz = (a.z + b.z) / 2; const my = (ys[i] + ys[i + 1]) / 2 + hh;
      bag.add(BOXG, IRON, { x: mx, y: my, z: mz, sx: 0.03, sy: 0.03, sz: len, ry: ang });
    }
    // たて棒と、やりの先
    for (let k = 1; k < bars; k++) {
      const t = k / bars;
      const x = a.x + (b.x - a.x) * t; const z = a.z + (b.z - a.z) * t;
      const y = ys[i] + (ys[i + 1] - ys[i]) * t + base;
      const h = 0.72 + ((k % 2) ? 0.1 : 0);
      bag.add(CYL, IRON, { x, y: y + h / 2, z, sx: 0.016, sy: h, sz: 0.016 });
      bag.add(CONE, IRON, { x, y: y + h + 0.06, z, sx: 0.035, sy: 0.16, sz: 0.035 });
    }
    // うず巻き（2つ。たがいちがいの向き）
    for (const s of [-1, 1]) {
      const t = 0.5 + s * 0.2;
      const x = a.x + (b.x - a.x) * t; const z = a.z + (b.z - a.z) * t;
      const y = ys[i] + (ys[i + 1] - ys[i]) * t + 0.78;
      bag.add(new THREE.TorusGeometry(0.1, 0.014, 6, 16, Math.PI * 1.5), IRON, { x, y, z, ry: ang + Math.PI / 2, rz: s > 0 ? 0 : Math.PI });
    }
    // 足もとの石垣のあたり判定
    const steps = Math.max(1, Math.floor(len / 0.3));
    for (let k = 1; k < steps; k++) walls.push({ x: a.x + ((b.x - a.x) * k) / steps, z: a.z + ((b.z - a.z) * k) / steps, r: 0.14 });
  }
  return { mesh: bag.mesh(), walls };
}

// 石垣: ふぞろいな平たい石をつみあげた、ひくい壁
function buildStoneWall(op) {
  const rnd = seeded(op.seed || 7);
  const pts = resampleLine(op.pts, 0.5);
  const bag = new Bag();
  const walls = [];
  const TONES = [0x7f8896, 0x8d96a4, 0x6f7886, 0x9aa3b0, 0x86909e];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const nx = pts[Math.min(pts.length - 1, i + 1)]; const pv = pts[Math.max(0, i - 1)];
    const ang = Math.atan2(nx.x - pv.x, nx.z - pv.z);
    const y = heightAt(p.x, p.z);
    const rows = 3;
    for (let r = 0; r < rows; r++) {
      const w = 0.5 + rnd() * 0.22; const h = 0.15 + rnd() * 0.04;
      bag.add(rboxGeo(w, h, 0.4 - r * 0.02, 0.04), TONES[Math.floor(rnd() * TONES.length)], {
        x: p.x + (rnd() - 0.5) * 0.06, y: y + 0.08 + r * 0.16, z: p.z + (rnd() - 0.5) * 0.06, ry: ang - Math.PI / 2 + (rnd() - 0.5) * 0.12,
      });
    }
    // こけ（石のすきまや上のかどに、小さく）
    if (rnd() < 0.35) {
      const side = rnd() < 0.5 ? -1 : 1; const off = side * (0.15 + rnd() * 0.04);
      const cx = Math.cos(ang - Math.PI / 2); const cz = -Math.sin(ang - Math.PI / 2);
      bag.add(SPH, MOSS, { x: p.x + cz * off + cx * (rnd() - 0.5) * 0.3, y: y + 0.42 + rnd() * 0.04, z: p.z - cx * off + cz * (rnd() - 0.5) * 0.3, sx: 0.07 + rnd() * 0.05, sy: 0.035, sz: 0.06 + rnd() * 0.04, ry: rnd() * 3 });
    }
    walls.push({ x: p.x, z: p.z, r: 0.22 });
  }
  return { mesh: bag.mesh(), walls };
}

// 白い柵（ピケットフェンス）: とんがり頭の白い板を ならべる。ひくい 横木が2本
function buildWhiteFence(op) {
  const rnd = seeded(op.seed || 7);
  const pts = resampleLine(op.pts, 0.2);
  const bag = new Bag();
  const walls = [];
  const WHITE = [0xfffaf0, 0xf8f1e2, 0xfdf7ea];
  const RAIL = 0xe9dfc8;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const nx = pts[Math.min(pts.length - 1, i + 1)]; const pv = pts[Math.max(0, i - 1)];
    const ang = Math.atan2(nx.x - pv.x, nx.z - pv.z);
    const y = heightAt(p.x, p.z);
    const h = 0.5 + rnd() * 0.04;
    const col = WHITE[i % 3];
    bag.add(rboxGeo(0.1, h, 0.03, 0.01), col, { x: p.x, y: y + h / 2, z: p.z, ry: ang + Math.PI / 2 });
    bag.add(CONE, col, { x: p.x, y: y + h + 0.04, z: p.z, sx: 0.07, sy: 0.1, sz: 0.022, ry: ang + Math.PI / 2 });
    if (i % 5 === 0) walls.push({ x: p.x, z: p.z, r: 0.14 });
  }
  // 横木（柱のうしろがわに2本）
  for (let i = 0; i < pts.length - 6; i += 5) {
    const a = pts[i]; const b = pts[i + 5];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const ang = Math.atan2(b.x - a.x, b.z - a.z);
    for (const hh of [0.15, 0.36]) {
      const mx = (a.x + b.x) / 2; const mz = (a.z + b.z) / 2; const my = (heightAt(a.x, a.z) + heightAt(b.x, b.z)) / 2 + hh;
      bag.add(rboxGeo(0.035, 0.05, len + 0.04, 0.01), RAIL, { x: mx - Math.cos(ang) * 0.03, y: my, z: mz + Math.sin(ang) * 0.03, ry: ang });
    }
  }
  // 足もとの、小さな花
  for (let i = 0; i < pts.length; i += 7) bag.add(SPH, [0xff9fbd, 0xfff08a, 0xc7a6ff][i % 3], { x: pts[i].x + 0.08, y: heightAt(pts[i].x, pts[i].z) + 0.06, z: pts[i].z + 0.08, s: 0.04 });
  return { mesh: bag.mesh(), walls };
}

export function buildFence(op) {
  if (op.style === 'white') return buildWhiteFence(op);
  if (op.style === 'iron') return buildIronFence(op);
  if (op.style === 'stone') return buildStoneWall(op);
  const rnd = seeded(op.seed || 7);
  const posts = resampleLine(op.pts, FENCE_SPACING);
  const bag = new Bag();
  const walls = [];
  const ys = posts.map((p) => heightAt(p.x, p.z));
  posts.forEach((p, i) => {
    const h = 0.78 + rnd() * 0.18;
    const lx = (rnd() - 0.5) * 0.16; const lz = (rnd() - 0.5) * 0.16;   // ちょっとかたむく
    const col = WOOD[Math.floor(rnd() * WOOD.length)];
    const y = ys[i];
    bag.add(CYL, col, { x: p.x, y: y + h / 2 - 0.06, z: p.z, sx: 0.085, sy: h, sz: 0.095, rx: lz, rz: lx });
    // 切り口（うえ）。すこし明るい
    bag.add(CYL, END_GRAIN, { x: p.x + lx * h * 0.5, y: y + h - 0.055, z: p.z - lz * h * 0.5, sx: 0.075, sy: 0.02, sz: 0.085, rx: lz, rz: lx });
    // 根もとのこけと、ときどき小さな花
    if (rnd() < 0.7) bag.add(SPH, MOSS, { x: p.x + (rnd() - 0.5) * 0.1, y: y + 0.04, z: p.z + (rnd() - 0.5) * 0.1, sx: 0.14, sy: 0.07, sz: 0.12 });
    if (rnd() < 0.3) bag.add(SPH, [0xfff2b0, 0xffc9d6, 0xffffff][Math.floor(rnd() * 3)], { x: p.x + 0.1, y: y + 0.1, z: p.z + 0.06, s: 0.035 });
    walls.push({ x: p.x, z: p.z, r: 0.14 });
  });
  // 横木（枝のように、すこしだけ太さがちがう）。柱と柱をつなぐ
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i]; const b = posts[i + 1];
    for (const hh of [0.3, 0.58]) {
      const jig = (rnd() - 0.5) * 0.05;
      const ay = ys[i] + hh + jig; const by = ys[i + 1] + hh - jig;
      const dx = b.x - a.x; const dy = by - ay; const dz = b.z - a.z;
      const len = Math.hypot(dx, dy, dz);
      const q = alignUp(dx, dy, dz);
      const th = 0.03 + rnd() * 0.015;
      bag.add(CYL, WOOD[(i + (hh > 0.4 ? 1 : 0)) % WOOD.length], { x: (a.x + b.x) / 2, y: (ay + by) / 2, z: (a.z + b.z) / 2, sx: th, sy: len + 0.1, sz: th, q });
      // 間の見えない所でも、通りぬけられないように
      const steps = Math.max(1, Math.floor(len / 0.3));
      if (hh < 0.4) for (let k = 1; k < steps; k++) walls.push({ x: a.x + (dx * k) / steps, z: a.z + (dz * k) / steps, r: 0.14 });
    }
  }
  return { mesh: bag.mesh(), walls };
}

// ---- 橋 ---------------------------------------------------------------------

// 橋のむき・長さを決める（はしからはしまで。長すぎれば BRIDGE_MAX にちぢめる）
export function bridgeGeometry(op) {
  let dx = op.x1 - op.x0; let dz = op.z1 - op.z0;
  let L = Math.hypot(dx, dz) || 1;
  dx /= L; dz /= L;
  L = Math.max(BRIDGE_MIN, Math.min(BRIDGE_MAX, L));
  const cx = op.x0 + (dx * L) / 2; const cz = op.z0 + (dz * L) / 2;
  return { cx, cz, ux: dx, uz: dz, L };
}

export function buildBridge(op) {
  const g = bridgeGeometry(op);
  const { cx, cz, ux, uz, L } = g;
  const rnd = seeded(op.seed || 11);
  const W = BRIDGE_W;
  // はしの地面の高さに、すこし持ちあげる。まんなかは、ゆるやかにそる
  const e0 = heightAt(cx - ux * (L / 2 + 0.3), cz - uz * (L / 2 + 0.3));
  const e1 = heightAt(cx + ux * (L / 2 + 0.3), cz + uz * (L / 2 + 0.3));
  const y0 = Math.max(e0, e1) + 0.1;
  const arch = 0.18 + L * 0.035;
  const yAt = (u) => y0 + arch * Math.sin((Math.PI * (u + L / 2)) / L);
  const slopeAt = (u) => (arch * Math.PI / L) * Math.cos((Math.PI * (u + L / 2)) / L);

  const bag = new Bag();
  const n = Math.round(L / 0.3);
  for (let i = 0; i < n; i++) {
    const u = -L / 2 + (L * (i + 0.5)) / n;
    const w = 0.255 + rnd() * 0.04;
    const wide = W + (rnd() - 0.5) * 0.12;
    const col = WOOD[Math.floor(rnd() * WOOD.length)];
    bag.add(rboxGeo(w, 0.07, wide, 0.02), col, { x: u, y: yAt(u), z: (rnd() - 0.5) * 0.04, ry: (rnd() - 0.5) * 0.07, rz: Math.atan(slopeAt(u)) });
    if (rnd() < 0.22) bag.add(SPH, MOSS, { x: u + (rnd() - 0.5) * 0.1, y: yAt(u) + 0.04, z: (rnd() - 0.5) * W * 0.8, sx: 0.12, sy: 0.03, sz: 0.1 });
  }
  // 板の下の、ふとい丸太（2本）
  for (const v of [-W * 0.32, W * 0.32]) {
    const segs = Math.max(4, Math.round(L / 0.6));
    for (let k = 0; k < segs; k++) {
      const u0 = -L / 2 + (L * k) / segs; const u1 = -L / 2 + (L * (k + 1)) / segs;
      const y1 = yAt(u0) - 0.1; const y2 = yAt(u1) - 0.1;
      const len = Math.hypot(u1 - u0, y2 - y1);
      bag.add(CYL, WOOD_DARK, { x: (u0 + u1) / 2, y: (y1 + y2) / 2, z: v, sx: 0.07, sy: len + 0.04, sz: 0.07, q: alignUp(u1 - u0, y2 - y1, 0) });
    }
  }
  // てすり: 枝の柱と、2本の横木
  const walls = [];
  const posts = Math.max(2, Math.round(L / 1.1) + 1);
  for (const side of [-1, 1]) {
    const v = side * (W / 2 - 0.02);
    const tops = [];
    for (let k = 0; k < posts; k++) {
      const u = -L / 2 + 0.12 + ((L - 0.24) * k) / (posts - 1);
      const h = 0.62 + rnd() * 0.08 + (k === 0 || k === posts - 1 ? 0.1 : 0);
      const lean = (rnd() - 0.5) * 0.1;
      const y = yAt(u);
      bag.add(CYL, WOOD[Math.floor(rnd() * WOOD.length)], { x: u, y: y + h / 2, z: v, sx: 0.06, sy: h, sz: 0.065, rx: lean, rz: (rnd() - 0.5) * 0.08 });
      bag.add(SPH, END_GRAIN, { x: u, y: y + h + 0.01, z: v, sx: 0.06, sy: 0.04, sz: 0.06 });
      tops.push({ u, y });
    }
    for (const hh of [0.28, 0.52]) {
      for (let k = 0; k < tops.length - 1; k++) {
        const a = tops[k]; const b = tops[k + 1];
        const ay = a.y + hh; const by = b.y + hh;
        const len = Math.hypot(b.u - a.u, by - ay);
        const th = 0.026 + rnd() * 0.012;
        bag.add(CYL, WOOD[(k + side + 2) % WOOD.length], { x: (a.u + b.u) / 2, y: (ay + by) / 2, z: v, sx: th, sy: len + 0.08, sz: th, q: alignUp(b.u - a.u, by - ay, 0) });
      }
    }
    // てすりに通りぬけないコリジョン（橋の中は歩ける）
    const cnt = Math.max(2, Math.round(L / 0.35));
    for (let k = 0; k <= cnt; k++) {
      const u = -L / 2 + (L * k) / cnt;
      walls.push({ x: cx + ux * u - uz * v, z: cz + uz * u + ux * v, r: 0.1 });
    }
  }
  const mesh = bag.mesh();
  const group = new THREE.Group();
  group.add(mesh);
  group.position.set(cx, 0, cz);
  group.rotation.y = Math.atan2(-uz, ux);   // ローカルの x（橋の長さ）を、橋のむきにあわせる
  // 歩ける床の情報（terrain.js の heightAt が使う）
  const deck = { cx, cz, ux, uz, L, W: W + 0.3, y0, arch };
  return { mesh: group, walls, deck };
}

// 床の高さ。橋の上にいなければ null
export function registerDeck(deck) { decks.list.push(deck); }
export function clearDecks() { decks.list.length = 0; }
