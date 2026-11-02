// まるくてやわらかい「ねんどのおもちゃ」風の家と花だん。
// ちいさなコテージ（うろこ屋根）と、きのこのおうち、丸太・石でかこった花だん。town.js から使う。
import * as THREE from 'three';
import { Bag, GEO, rboxGeo, alignUp, leafBlade, tulip, hyacinth, daisy, smallYellow, seeded, blob, smoke, softDot } from './townkit.js';

const { SPH, CYL, BOX, HALF } = GEO;
const CREAM = 0xfff0cf;
const WOOD = 0xc78a4f;
const WOOD_DARK = 0x9a6a3c;
const STONE = 0xe6d6b8;

// ---- 小物 ---------------------------------------------------------------

// 花だん: 'log'（丸太でかこむ・チューリップ）か 'stone'（石でかこむ・ヒヤシンス）
export function bed(kind = 'stone', radius = 0.9, seed = 1) {
  const rnd = seeded(seed);
  const g = new THREE.Group();
  const b = new Bag();
  const f = new Bag();
  b.add(CYL, 0x6b4a32, { y: 0.1, sx: radius, sy: 0.2, sz: radius });
  const n = Math.round(radius * 13);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * radius; const z = Math.sin(a) * radius;
    if (kind === 'log') {
      const h = 0.34 + rnd() * 0.12;
      b.add(CYL, i % 2 ? 0xd9a46a : 0xcf9a5e, { x, y: h / 2, z, sx: 0.15, sy: h, sz: 0.15 });
      b.add(CYL, 0xefc58c, { x, y: h + 0.005, z, sx: 0.12, sy: 0.02, sz: 0.12 });
      b.add(CYL, 0xc58c52, { x, y: h + 0.016, z, sx: 0.06, sy: 0.012, sz: 0.06 });
    } else {
      const sc = 0.9 + rnd() * 0.25;
      b.add(rboxGeo(0.42, 0.24, 0.3, 0.1), i % 2 ? STONE : 0xdccaa6, { x, y: 0.12 * sc, z, sx: sc, sy: sc, sz: sc, ry: -a + Math.PI / 2 });
    }
  }
  const items = Math.round(radius * radius * 46);
  for (let i = 0; i < items; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * radius * 0.78;
    const x = Math.cos(a) * r; const z = Math.sin(a) * r;
    const k = rnd();
    if (kind === 'log') {
      if (k < 0.34) tulip(f, x, z, [0xff9fbd, 0xff86ab, 0xffb3c8][i % 3], 0.3 + rnd() * 0.12);
      else if (k < 0.6) daisy(f, x, z, 0.12 + rnd() * 0.08, 0.1, 1.15);
      else if (k < 0.85) smallYellow(f, x, z, 0.12 + rnd() * 0.1);
      else leafBlade(f, x, 0.1, z, 0.25, rnd() * 6.28, 0x62b35a, 0.8);
    } else {
      if (k < 0.4) hyacinth(f, x, z, [0xff8fb8, 0xff9ec3, 0xf77fae][i % 3], 0.26 + rnd() * 0.1);
      else if (k < 0.7) daisy(f, x, z, 0.1 + rnd() * 0.08, 0.1, 1.15);
      else if (k < 0.88) smallYellow(f, x, z, 0.1 + rnd() * 0.08);
      else leafBlade(f, x, 0.1, z, 0.25, rnd() * 6.28, 0x62b35a, 0.8);
    }
  }
  const body = b.mesh(); const flowers = f.mesh();
  flowers.scale.setScalar(1.3);
  g.add(body, flowers);
  g.userData.update = (t) => { flowers.rotation.z = Math.sin(t * 1.8 + seed) * 0.012; flowers.rotation.x = Math.cos(t * 1.5 + seed) * 0.012; };
  return g;
}

// 飛び石
function stones(b, x0, z0, count, dx, dz) {
  for (let i = 0; i < count; i++) {
    const w = 0.5 - i * 0.03;
    b.add(CYL, i % 2 ? 0xe9dcc0 : 0xe2d3b4, {
      x: x0 + dx * i + (i % 2 ? 0.12 : -0.1), y: 0.03, z: z0 + dz * i, sx: w * 0.5, sy: 0.07, sz: w * 0.4, ry: i * 0.6,
    });
  }
}

// 壁のランタン（明かりはぼんやり光る）。glow に光る部分を足す
function lantern(b, glow, x, y, z) {
  b.add(CYL, 0x5a4636, { x, y: y + 0.17, z, sx: 0.07, sy: 0.04, sz: 0.07 });
  b.add(BOX, 0x5a4636, { x: x, y: y + 0.3, z: z - 0.06, sx: 0.025, sy: 0.04, sz: 0.1 });
  b.add(rboxGeo(0.2, 0.05, 0.2, 0.02), 0x5a4636, { x, y: y + 0.12, z });
  b.add(rboxGeo(0.2, 0.05, 0.2, 0.02), 0x5a4636, { x, y: y - 0.12, z });
  glow.add(rboxGeo(0.15, 0.22, 0.15, 0.03), 0xffe39a, { x, y, z });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(CYL, 0x5a4636, { x: x + sx * 0.08, y, z: z + sz * 0.08, sx: 0.01, sy: 0.24, sz: 0.01 });
  b.add(SPH, 0x5a4636, { x, y: y + 0.2, z, sx: 0.06, sy: 0.04, sz: 0.06 });
}

// アーチのとびら（二枚戸・まるいとって・上に光る窓）
function archDoor(b, glow, x, z, w = 0.8, h = 1.15) {
  const r = w / 2;
  b.add(rboxGeo(w + 0.22, h - r, 0.1, 0.04), 0xe9bf82, { x, y: (h - r) / 2, z });
  b.add(HALF, 0xe9bf82, { x, y: h - r, z, sx: r + 0.11, sy: r + 0.11, sz: 0.05 });
  const dz = z + 0.02;
  b.add(rboxGeo(w, h - r, 0.1, 0.03), WOOD, { x, y: (h - r) / 2, z: dz });
  b.add(HALF, WOOD, { x, y: h - r, z: dz, sx: r, sy: r, sz: 0.05 });
  b.add(BOX, 0x8c5a32, { x, y: h * 0.45, z: dz + 0.055, sx: 0.025, sy: h * 0.9, sz: 0.012 });   // ま中のすじ
  for (const sx of [-1, 1]) {
    b.add(rboxGeo(0.28, 0.4, 0.03, 0.02), 0xd9a066, { x: x + sx * 0.2, y: 0.3, z: dz + 0.06 }); // 下のパネル
    glow.add(HALF, 0xffe39a, { x: x + sx * 0.19, y: h - r - 0.02, z: dz + 0.058, sx: r * 0.42, sy: r * 0.42, sz: 0.01 });
    glow.add(rboxGeo(0.32, 0.22, 0.02, 0.01), 0xffe39a, { x: x + sx * 0.19, y: h - r - 0.13, z: dz + 0.058 });
    b.add(SPH, 0xe9b84a, { x: x + sx * 0.08, y: h * 0.45, z: dz + 0.08, s: 0.045 });             // とって
  }
  b.add(BOX, 0xc78a4f, { x, y: h - r - 0.02, z: dz + 0.065, sx: 0.03, sy: 0.4, sz: 0.012 });
}

function roundBush(b, x, y, z, s, flowerColor) {
  const rnd = seeded(Math.floor(x * 100 + z * 37) + 5);
  b.add(SPH, 0x6fb35e, { x, y: y + 0.28 * s, z, s: 0.34 * s });
  b.add(SPH, 0x83c46a, { x: x + 0.28 * s, y: y + 0.2 * s, z: z + 0.1 * s, s: 0.26 * s });
  b.add(SPH, 0x78bb64, { x: x - 0.26 * s, y: y + 0.2 * s, z: z - 0.04 * s, s: 0.24 * s });
  if (flowerColor) {
    for (let i = 0; i < 6; i++) b.add(SPH, flowerColor, { x: x + (rnd() - 0.5) * 0.6 * s, y: y + (0.28 + rnd() * 0.25) * s, z: z + 0.26 * s + rnd() * 0.1, s: 0.05 * s });
  }
}

// ---- うろこ屋根 -----------------------------------------------------------
// 切り妻の2まいの屋根。ひとつひとつの丸いタイルがうろこのように重なる。

function scaledRoof(width, depth, rise, tileColor, baseColor, over = 0.3) {
  const g = new THREE.Group();
  const half = width / 2 + over;
  const rise2 = (rise * half) / (width / 2);
  const len = Math.hypot(half, rise2);
  const ang = Math.atan2(rise2, half);
  const slabD = depth + over * 1.6;
  const rnd = seeded(Math.floor(width * 31 + depth * 17));
  const pitch = 0.3;
  const rows = Math.ceil(len / pitch);
  const colP = 0.36;
  const cols = Math.ceil(slabD / colP);
  const base = new THREE.Color(tileColor);
  for (const side of [-1, 1]) {
    const slab = new Bag();
    slab.add(rboxGeo(len, 0.16, slabD, 0.05), new THREE.Color(baseColor).getHex(), {});
    for (let r = 0; r < rows; r++) {
      const u = side * (len / 2 - r * pitch - 0.1);
      for (let c = 0; c <= cols; c++) {
        const v = -slabD / 2 + (c + (r % 2 ? 0.5 : 0)) * colP;
        if (Math.abs(v) > slabD / 2 + 0.05) continue;
        const k = 0.9 + rnd() * 0.18;
        const col = base.clone().multiplyScalar(k).getHex();
        slab.add(SPH, col, { x: u, y: 0.09 + (rows - r) * 0.004, z: v, sx: pitch * 0.62, sy: 0.085, sz: colP * 0.56 });
      }
    }
    // ひさしの木のふち（前後）
    for (const sz of [-1, 1]) slab.add(rboxGeo(len + 0.04, 0.22, 0.1, 0.04), WOOD_DARK, { y: 0.03, z: sz * slabD / 2 });
    const m = slab.mesh();
    m.position.set((side * half) / 2, rise2 / 2 + 0.06, 0);
    m.rotation.z = -side * ang;
    g.add(m);
  }
  const ridge = new Bag();
  ridge.add(CYL, new THREE.Color(baseColor).multiplyScalar(0.85).getHex(), { y: rise2 + 0.12, sx: 0.12, sy: slabD + 0.06, sz: 0.12, rx: Math.PI / 2 });
  g.add(ridge.mesh());
  g.userData.rise = rise2;
  return g;
}

// 山がたの壁（三角）。木の柱とはりつき
function gableFace(b, width, rise, y, z, wall = CREAM) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(0, rise); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
  b.add(geo, wall, { y, z: z - 0.05 });
  const zz = z + (z > 0 ? 0.06 : -0.06);
  b.add(rboxGeo(0.12, rise * 0.86, 0.08, 0.03), WOOD_DARK, { y: y + rise * 0.43, z: zz });
  for (const s of [-1, 1]) {
    const L = Math.hypot(width * 0.27, rise * 0.55);
    b.add(rboxGeo(0.1, L, 0.08, 0.03), WOOD_DARK, { x: s * width * 0.2, y: y + rise * 0.32, z: zz, rz: s * Math.atan2(width * 0.27, rise * 0.55) * -1 });
  }
}

// ---- コテージ -------------------------------------------------------------

export function cottage({ roof = 0xa9d95f, size = 1, withBed = true, seed = 3 } = {}) {
  const g = new THREE.Group();
  const W = 2.4; const D = 2.6; const WH = 1.45; const base = 0.2;
  const b = new Bag(); const glow = new Bag();
  g.add(blob(2.8, 3.1, 0.3));
  b.add(rboxGeo(W + 0.16, 0.34, D + 0.16, 0.1), 0xd9cfb6, { y: 0.17 });
  b.add(rboxGeo(W, WH, D, 0.18), CREAM, { y: base + WH / 2 });
  b.add(rboxGeo(W + 0.04, 0.12, D + 0.04, 0.05), WOOD_DARK, { y: base + WH });
  const rise = 1.15;
  const rf = scaledRoof(W, D, rise, roof, new THREE.Color(roof).multiplyScalar(0.62).getHex());
  rf.position.y = base + WH + 0.04;
  g.add(rf);
  gableFace(b, W, rise, base + WH + 0.02, D / 2 + 0.01);
  gableFace(b, W, rise, base + WH + 0.02, -D / 2 - 0.01);
  // えんとつ
  const cx = 0.62; const cz = -0.35;
  b.add(rboxGeo(0.55, 1.5, 0.55, 0.08), 0xe2bf86, { x: cx, y: base + WH + 0.95, z: cz });
  b.add(rboxGeo(0.7, 0.14, 0.7, 0.05), 0xd2a96e, { x: cx, y: base + WH + 1.72, z: cz });
  // 正面
  const z = D / 2 + 0.02;
  archDoor(b, glow, 0, z, 0.8, 1.2);
  b.add(rboxGeo(1.3, 0.12, 0.55, 0.05), 0xd9cfb6, { y: 0.06, z: z + 0.24 });
  // まる窓つきのアーチ窓（右）
  const wx = 0.82; const wy = base + WH * 0.62;
  b.add(rboxGeo(0.66, 0.62, 0.08, 0.04), 0xd9a066, { x: wx, y: wy - 0.05, z });
  b.add(HALF, 0xd9a066, { x: wx, y: wy + 0.26, z, sx: 0.33, sy: 0.33, sz: 0.04 });
  glow.add(rboxGeo(0.5, 0.5, 0.03, 0.02), 0xffe39a, { x: wx, y: wy - 0.05, z: z + 0.04 });
  glow.add(HALF, 0xffe39a, { x: wx, y: wy + 0.2, z: z + 0.04, sx: 0.25, sy: 0.25, sz: 0.015 });
  b.add(BOX, 0xd9a066, { x: wx, y: wy + 0.05, z: z + 0.06, sx: 0.03, sy: 0.85, sz: 0.012 });
  b.add(BOX, 0xd9a066, { x: wx, y: wy + 0.05, z: z + 0.06, sx: 0.5, sy: 0.03, sz: 0.012 });
  for (const s of [-1, 1]) b.add(rboxGeo(0.2, 0.86, 0.06, 0.03), 0xb77d4d, { x: wx + s * 0.5, y: wy + 0.05, z: z + 0.01 });
  b.add(rboxGeo(0.82, 0.15, 0.22, 0.04), 0xa86f3f, { x: wx, y: wy - 0.42, z: z + 0.1 });
  const rnd = seeded(seed);
  for (let i = 0; i < 7; i++) {
    b.add(SPH, 0x62b35a, { x: wx - 0.3 + i * 0.1, y: wy - 0.33, z: z + 0.14, s: 0.06 });
    if (i % 2 === 0) { daisy(b, wx - 0.3 + i * 0.1, z + 0.16, 0.06, wy - 0.34, 0.9); } else b.add(SPH, [0xff9fbd, 0xffd84a][i % 4 === 1 ? 0 : 1], { x: wx - 0.3 + i * 0.1, y: wy - 0.25, z: z + 0.16, s: 0.045 });
  }
  void rnd;
  // ランタンと、つたの花
  lantern(b, glow, -0.74, base + 1.05, z + 0.1);
  for (let i = 0; i < 16; i++) {
    const u = i / 15;
    const vx = -1.13 + Math.sin(u * 5) * 0.08;
    b.add(SPH, i % 3 ? 0x5fa34a : 0x78bb64, { x: vx, y: 0.5 + u * 1.5, z: z + 0.01 + (i % 2) * 0.05, sx: 0.09, sy: 0.05, sz: 0.04, rz: i * 0.7 });
    if (i % 4 === 1) daisy(b, vx + 0.07, z + 0.1, 0.01, 0.5 + u * 1.5, 0.7);
  }
  b.add(CYL, 0xa86f3f, { x: -1.0, y: 0.32, z: z + 0.32, sx: 0.28, sy: 0.64, sz: 0.28 });
  for (const y of [0.15, 0.5]) b.add(CYL, 0x7a5030, { x: -1.0, y, z: z + 0.32, sx: 0.295, sy: 0.05, sz: 0.295 });
  b.add(SPH, 0x6fb35e, { x: -1.0, y: 0.68, z: z + 0.32, sx: 0.3, sy: 0.14, sz: 0.3 });
  b.add(rboxGeo(0.5, 0.38, 0.4, 0.05), 0xd9a066, { x: 1.55, y: 0.19, z: z + 0.28, ry: 0.2 });
  b.add(BOX, 0xb77d4d, { x: 1.55, y: 0.2, z: z + 0.28 + 0.2, sx: 0.5, sy: 0.04, sz: 0.01, ry: 0.2 });
  roundBush(b, 1.5, 0, z + 0.05, 0.9, 0xfff08a);
  stones(b, 0.05, z + 1.0, 3, 0.1, 0.62);
  g.add(b.mesh(), glow.mesh(true));
  if (withBed) {
    const bd = bed('stone', 0.85, seed);
    bd.position.set(-1.95, 0, z + 1.2);
    g.add(bd);
  }
  const sm = smoke(cx, base + WH + 1.8, cz);
  g.add(sm);
  const bedUpdate = g.children.find((c) => c.userData.update)?.userData.update;
  g.userData.update = (t) => { sm.userData.tick(t); bedUpdate?.(t); };
  g.scale.setScalar(size);
  return g;
}

// ---- きのこのおうち ---------------------------------------------------------

export function mushroomHouse({ cap = 0xf26a4b, size = 1, withBed = true, seed = 7 } = {}) {
  const g = new THREE.Group();
  const b = new Bag(); const glow = new Bag();
  g.add(blob(2.9, 2.9, 0.3));
  const R = 1.0; const H = 1.5;
  b.add(CYL, 0xd9cfb6, { y: 0.1, sx: R + 0.1, sy: 0.2, sz: R + 0.1 });
  b.add(new THREE.CylinderGeometry(1, 1, 1, 24), CREAM, { y: 0.2 + H / 2, sx: R, sy: H, sz: R });
  // かさ
  const capY = 0.2 + H - 0.05; const CR = 1.78; const CH = 1.15;
  const capGeo = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  b.add(capGeo, cap, { y: capY, sx: CR, sy: CH, sz: CR });
  b.add(new THREE.CircleGeometry(1, 28).rotateX(Math.PI / 2), 0xffe8c4, { y: capY - 0.01, sx: CR, sy: 1, sz: CR });
  const frill = new THREE.TorusGeometry(CR - 0.04, 0.09, 8, 36).rotateX(Math.PI / 2);
  b.add(frill, 0xfff4dc, { y: capY });
  // 白い水玉
  const spots = [[0.9, 0.55, 0.42], [1.5, 0.75, 0.3], [2.3, 0.55, 0.36], [3.1, 0.8, 0.28], [4.0, 0.6, 0.4], [4.8, 0.82, 0.3], [5.6, 0.5, 0.34], [0.1, 0.95, 0.3], [0.0, 0.2, 0.0]];
  for (const [th, ph, sz] of spots) {
    if (!sz) continue;
    const sp = Math.sin(ph); const cp = Math.cos(ph);
    const px = CR * sp * Math.cos(th); const py = capY + CH * cp; const pz = CR * sp * Math.sin(th);
    const q = alignUp(px / (CR * CR), (py - capY) / (CH * CH), pz / (CR * CR));
    b.add(SPH, 0xfff6e8, { x: px * 0.985, y: capY + (py - capY) * 0.985, z: pz * 0.985, sx: sz, sy: 0.07, sz: sz * 0.8, q });
  }
  // えんとつ
  b.add(CYL, 0xb86d4a, { x: 0.75, y: capY + 1.0, z: -0.55, sx: 0.17, sy: 0.7, sz: 0.17, rz: -0.12 });
  b.add(CYL, 0xd2875f, { x: 0.78, y: capY + 1.36, z: -0.55, sx: 0.22, sy: 0.1, sz: 0.22, rz: -0.12 });
  // とびら・窓・ランタン
  const z = R - 0.02;
  archDoor(b, glow, 0, z, 0.78, 1.15);
  b.add(rboxGeo(1.2, 0.1, 0.5, 0.04), 0xd9cfb6, { y: 0.05, z: z + 0.25 });
  const wa = 0.7; // まるい窓（右）
  const wxp = Math.sin(wa) * (R - 0.02); const wzp = Math.cos(wa) * (R - 0.02);
  const wq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), wa);
  const ring = new THREE.TorusGeometry(0.3, 0.06, 8, 24);
  b.add(ring, 0xd9a066, { x: wxp, y: 1.0, z: wzp, q: wq });
  glow.add(new THREE.CircleGeometry(0.3, 20), 0xffe39a, { x: wxp, y: 1.0, z: wzp, q: wq });
  b.add(BOX, 0xd9a066, { x: wxp, y: 1.0, z: wzp + 0.02, sx: 0.04, sy: 0.6, sz: 0.02, q: wq });
  b.add(BOX, 0xd9a066, { x: wxp, y: 1.0, z: wzp + 0.02, sx: 0.6, sy: 0.04, sz: 0.02, q: wq });
  lantern(b, glow, -0.74, 1.2, z + 0.06);
  roundBush(b, 1.0, 0, 0.85, 0.8, 0xffd84a);
  roundBush(b, 1.25, 0, 0.45, 0.6, 0xfff08a);
  // じょうろ・きりかぶ
  const wcx = 1.15; const wcz = 1.6;
  b.add(CYL, 0x9fb8a0, { x: wcx, y: 0.2, z: wcz, sx: 0.2, sy: 0.38, sz: 0.2 });
  b.add(CYL, 0x8aa68c, { x: wcx, y: 0.4, z: wcz, sx: 0.21, sy: 0.04, sz: 0.21 });
  b.add(CYL, 0x9fb8a0, { x: wcx + 0.28, y: 0.35, z: wcz, sx: 0.04, sy: 0.4, sz: 0.04, rz: -0.9 });
  b.add(CYL, 0x8aa68c, { x: wcx + 0.43, y: 0.5, z: wcz, sx: 0.07, sy: 0.05, sz: 0.07, rz: -0.9 });
  b.add(new THREE.TorusGeometry(0.15, 0.025, 6, 14), 0x8aa68c, { x: wcx - 0.1, y: 0.42, z: wcz, ry: 0.0, rx: 0.0 });
  const sx0 = 1.75; const sz0 = 0.35;
  b.add(CYL, 0xd9a46a, { x: sx0, y: 0.25, z: sz0, sx: 0.4, sy: 0.5, sz: 0.4 });
  b.add(CYL, 0xefc58c, { x: sx0, y: 0.505, z: sz0, sx: 0.37, sy: 0.02, sz: 0.37 });
  for (const rr of [0.12, 0.22, 0.3]) b.add(new THREE.TorusGeometry(rr, 0.012, 4, 20).rotateX(Math.PI / 2), 0xc58c52, { x: sx0, y: 0.52, z: sz0 });
  stones(b, 0.0, z + 0.9, 3, 0.18, 0.62);
  g.add(b.mesh(), glow.mesh(true));
  // うさぎの立て札
  const sg = new Bag();
  const spx = -1.55; const spz = 1.35;
  sg.add(CYL, 0xb77d4d, { x: spx, y: 0.35, z: spz, sx: 0.04, sy: 0.7, sz: 0.04 });
  sg.add(rboxGeo(0.72, 0.56, 0.08, 0.05), 0xd9a066, { x: spx, y: 0.85, z: spz, ry: 0.35 });
  const sq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.35);
  const rp = (dx, dy, dz) => { const v = new THREE.Vector3(dx, dy, dz).applyQuaternion(sq); return { x: spx + v.x, y: 0.85 + v.y, z: spz + v.z }; };
  sg.add(SPH, 0xffffff, { ...rp(0, -0.02, 0.06), sx: 0.17, sy: 0.15, sz: 0.04, q: sq });
  for (const e of [-1, 1]) {
    sg.add(SPH, 0xffffff, { ...rp(e * 0.08, 0.17, 0.06), sx: 0.05, sy: 0.14, sz: 0.03, q: sq });
    sg.add(SPH, 0xffc6d8, { ...rp(e * 0.08, 0.17, 0.08), sx: 0.025, sy: 0.09, sz: 0.015, q: sq });
    sg.add(SPH, 0x4a3a30, { ...rp(e * 0.06, 0.0, 0.1), s: 0.017, q: sq });
  }
  sg.add(SPH, 0xff9fb5, { ...rp(0, -0.05, 0.1), s: 0.02, q: sq });
  g.add(sg.mesh());
  if (withBed) {
    const bd = bed('log', 0.85, seed);
    bd.position.set(-1.85, 0, 0.75);
    g.add(bd);
  }
  const sm = smoke(0.78, capY + 1.5, -0.55);
  g.add(sm);
  const bedUpdate = g.children.find((c) => c.userData.update)?.userData.update;
  g.userData.update = (t) => { sm.userData.tick(t); bedUpdate?.(t); };
  g.scale.setScalar(size);
  return g;
}

void softDot;
