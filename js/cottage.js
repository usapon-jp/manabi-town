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
  glow.add(rboxGeo(0.15, 0.22, 0.15, 0.03), 0xffcf78, { x, y, z });
  glow.halo(x, y, z + 0.05, 0.75);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(CYL, 0x5a4636, { x: x + sx * 0.08, y, z: z + sz * 0.08, sx: 0.01, sy: 0.24, sz: 0.01 });
  b.add(SPH, 0x5a4636, { x, y: y + 0.2, z, sx: 0.06, sy: 0.04, sz: 0.06 });
}


// 街灯（木の 柱に つるした ランタン）。glow に 光る ガラス
export function lampPost(b, glow, x, z, h = 2.1) {
  b.add(CYL, 0x6b4a32, { x, y: h / 2, z, sx: 0.07, sy: h, sz: 0.07 });
  b.add(CYL, 0x5a4636, { x, y: 0.08, z, sx: 0.16, sy: 0.16, sz: 0.16 });
  b.add(BOX, 0x6b4a32, { x: x + 0.22, y: h - 0.05, z, sx: 0.5, sy: 0.06, sz: 0.06 });
  b.add(new THREE.TorusGeometry(0.16, 0.025, 6, 12, Math.PI / 2), 0x5a4636, { x: x + 0.06, y: h - 0.22, z, rz: 0 });
  lantern(b, glow, x + 0.42, h - 0.32, z);
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


// ---- 家の かたち（絵本の 家: 大きな 屋根の かたまり ＋ ずんぐりした かべ） ------------
// 「全体の 形 → 中くらいの 見せ場（とびら・窓）→ 少しの 細部」の 順に 作る。
// 細かい ものを 全体に ちらさず、正面の 入口まわりだけに あつめる。

// 屋根の 線（正面から 見た 形）。x は -half〜half。てっぺんは まるく、斜面は すこし へこむ
function roofY(x, half, rise, sag) {
  const e = 0.07;
  const a = Math.min(1, (Math.sqrt(x * x + e * e) - e) / (half - e * 0.5));
  return rise * (1 - a) - sag * 4 * a * (1 - a);
}

// 丸い 窓わく（ドーナツ）＋ 光る ガラス ＋ 十字の さん
export function roundWindow(b, glow, x, y, z, r, frame = 0xd9a066, q = null) {
  b.add(new THREE.TorusGeometry(r, r * 0.2, 8, 24), frame, { x, y, z, q });
  glow.add(new THREE.CircleGeometry(r, 24), 0xffcf78, { x, y, z: z - 0.005, q });
  const o = q ? new THREE.Vector3(0, 0, 0.02).applyQuaternion(q) : new THREE.Vector3(0, 0, 0.02);
  b.add(BOX, frame, { x: x + o.x, y, z: z + o.z, sx: r * 0.16, sy: r * 2, sz: 0.02, q });
  b.add(BOX, frame, { x: x + o.x, y, z: z + o.z, sx: r * 2, sy: r * 0.16, sz: 0.02, q });
}

// まるい アーチの とびら（1まい板。小さな まる窓と とってだけ）
export function cuteDoor(b, glow, x, z, w = 0.78, h = 1.25, frame = 0xe8cf9e) {
  const r = w / 2;
  b.add(rboxGeo(w + 0.2, h - r, 0.08, 0.04), frame, { x, y: (h - r) / 2, z });
  b.add(HALF, frame, { x, y: h - r, z, sx: r + 0.1, sy: r + 0.1, sz: 0.04 });
  b.add(rboxGeo(w, h - r, 0.1, 0.03), WOOD, { x, y: (h - r) / 2, z: z + 0.02 });
  b.add(HALF, WOOD, { x, y: h - r, z: z + 0.02, sx: r, sy: r, sz: 0.05 });
  roundWindow(b, glow, x, h - r + 0.02, z + 0.08, 0.13, 0xa86f3f);
  b.add(SPH, 0xe9b84a, { x: x + r * 0.62, y: h * 0.42, z: z + 0.1, s: 0.05 });
}

// アーチの 窓 ＋ 花の まどべ（家の 見せ場）
export function archWindow(b, glow, x, y, z, w = 0.66, h = 0.8) {
  const r = w / 2; const hr = h - r;
  b.add(rboxGeo(w + 0.14, hr, 0.07, 0.03), 0xd9a066, { x, y: y + hr / 2, z });
  b.add(HALF, 0xd9a066, { x, y: y + hr, z, sx: r + 0.07, sy: r + 0.07, sz: 0.035 });
  glow.add(rboxGeo(w - 0.04, hr, 0.03, 0.02), 0xffcf78, { x, y: y + hr / 2, z: z + 0.035 });
  glow.add(HALF, 0xffcf78, { x, y: y + hr, z: z + 0.035, sx: r - 0.02, sy: r - 0.02, sz: 0.015 });
  b.add(BOX, 0xd9a066, { x, y: y + h / 2, z: z + 0.055, sx: 0.035, sy: h, sz: 0.015 });
  b.add(BOX, 0xd9a066, { x, y: y + hr * 0.75, z: z + 0.055, sx: w - 0.04, sy: 0.035, sz: 0.015 });
  // まどべの 花ばこ（ここだけ 色を あつめる）
  b.add(rboxGeo(w + 0.22, 0.16, 0.22, 0.05), 0xa86f3f, { x, y: y - 0.06, z: z + 0.1 });
  const fl = [0xff9fbd, 0xfff3c4, 0xff86ab, 0xffd84a, 0xff9fbd];
  for (let i = 0; i < 5; i++) {
    const fx = x + (i - 2) * (w + 0.1) / 5;
    b.add(SPH, 0x62b35a, { x: fx, y: y + 0.03, z: z + 0.13, sx: 0.09, sy: 0.07, sz: 0.08 });
    b.add(SPH, fl[i], { x: fx + 0.02, y: y + 0.09 + (i % 2) * 0.03, z: z + 0.18, s: 0.065 });
  }
}

// 三角屋根の 家の かたまり（土台・かべ・あつい 屋根・屋根の ふちの 茶色の 線）。
// 正面は z+ の 三角の 面。かべの 上（のき）は y0、屋根の 線は off + roofY(x)
export function gableHouse(b, { W, D, WH, base, over, rise, sag, T, wall = CREAM, roof, trim = WOOD_DARK, plinth = 0xdccaa6 }) {
  const half = W / 2 + over;
  b.add(rboxGeo(W + 0.36, base + 0.04, D + 0.36, 0.1), plinth, { y: (base + 0.04) / 2 });
  // かべ（四角 ＋ 屋根の 下の 三角を ひとつの かたまりに。角は まるく）
  const y0 = base + WH;
  const off = y0 - roofY(W / 2, half, rise, sag);
  const body = new THREE.Shape();
  body.moveTo(-W / 2, base); body.lineTo(W / 2, base); body.lineTo(W / 2, y0);
  for (let i = 1; i < 20; i++) { const x = W / 2 - (i / 20) * W; body.lineTo(x, off + roofY(x, half, rise, sag) - 0.02); }
  body.lineTo(-W / 2, y0); body.closePath();
  const bevel = 0.1;
  const bodyGeo = new THREE.ExtrudeGeometry(body, { depth: D - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4 });
  bodyGeo.translate(0, 0, -(D - bevel * 2) / 2);
  b.add(bodyGeo, wall, {});
  // 屋根（あつみの ある ひとかたまり。ふちは まるく）
  const slabD = D + 0.55;
  const top = []; const bot = [];
  for (let i = 0; i <= 32; i++) { const x = -half + (i / 32) * half * 2; bot.push([x, off + roofY(x, half, rise, sag)]); top.push([x, off + roofY(x, half, rise, sag) + T]); }
  const rs = new THREE.Shape();
  rs.moveTo(top[0][0], top[0][1]);
  for (const [x, y] of top.slice(1)) rs.lineTo(x, y);
  for (const [x, y] of bot.slice().reverse()) rs.lineTo(x, y);
  rs.closePath();
  const rb = 0.08;
  const roofGeo = new THREE.ExtrudeGeometry(rs, { depth: slabD - rb * 2, bevelEnabled: true, bevelThickness: rb, bevelSize: rb, bevelSegments: 3, curveSegments: 4 });
  roofGeo.translate(0, 0, -(slabD - rb * 2) / 2);
  b.add(roofGeo, roof, {});
  // 屋根の 正面と うしろの ふちに 茶色の 線（とぎれない 1本の 線）
  for (const zs of [-1, 1]) {
    const pts = top.map(([x, y]) => new THREE.Vector3(x, y + 0.02, zs * (slabD / 2 + 0.02)));
    b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.065, 6, false), trim, {});
  }
  return { off, y0, half, slabD, roofAt: (x) => off + roofY(x, half, rise, sag) + T };
}

// とんがり屋根（すこし へこんだ 線の まるい 円すい ＋ すその まるい ふち）。y が すその 高さ
export function spireRoof(b, x, y, z, R, H, color, segs = 28) {
  const prof = [new THREE.Vector2(0.001, -0.12), new THREE.Vector2(R * 0.92, -0.12)];
  for (let i = 0; i <= 16; i++) { const u = i / 16; prof.push(new THREE.Vector2(Math.max(0.001, R * Math.pow(1 - u, 1.35)), u * H)); }
  b.add(new THREE.LatheGeometry(prof, segs), color, { x, y, z });
  b.add(new THREE.TorusGeometry(R * 0.97, Math.max(0.05, R * 0.065), 8, segs).rotateX(Math.PI / 2), new THREE.Color(color).multiplyScalar(0.85).getHex(), { x, y: y - 0.06, z });
}

// まるい 塔の かべ（下が すこし ひろく、まんなかが ふくらむ）。y0 から 高さ h
export function roundTower(b, x, y0, z, r0, r1, h, color, segs = 28) {
  const prof = [new THREE.Vector2(0.001, 0)];
  for (let i = 0; i <= 12; i++) { const u = i / 12; prof.push(new THREE.Vector2(r0 + (r1 - r0) * u + 0.05 * Math.sin(u * Math.PI) * r0, u * h)); }
  prof.push(new THREE.Vector2(0.001, h));
  b.add(new THREE.LatheGeometry(prof, segs), color, { x, y: y0, z });
}

// ---- コテージ（緑の 屋根の 家） -------------------------------------------
// 大きな 三角屋根の かたまりが 主役。かべは ずんぐり、正面に まるい とびらと アーチ窓、屋根うらに まる窓
export function cottage({ roof = 0xa9d95f, wall = CREAM, size = 1, withBed = true, seed = 3 } = {}) {
  const g = new THREE.Group();
  const b = new Bag(); const glow = new Bag();
  const W = 2.3; const D = 2.3; const WH = 1.25; const base = 0.18;
  const over = 0.42; const half = W / 2 + over; const rise = 2.0; const sag = 0.16; const T = 0.3;
  g.add(blob(2.7, 2.9, 0.3));
  const { off, y0 } = gableHouse(b, { W, D, WH, base, over, rise, sag, T, wall, roof });
  // えんとつ（ずんぐり、すこし かたむける）
  const cx = 0.62; const cz = -0.45; const cy = off + roofY(cx, half, rise, sag) + T;
  b.add(rboxGeo(0.46, 0.9, 0.46, 0.12), 0xd98b6a, { x: cx, y: cy + 0.2, z: cz, rz: -0.06 });
  b.add(rboxGeo(0.6, 0.16, 0.6, 0.07), 0xc8785a, { x: cx + 0.04, y: cy + 0.68, z: cz, rz: -0.06 });
  // 正面
  const z = D / 2;
  cuteDoor(b, glow, -0.42, z, 0.76, 1.3);
  b.add(rboxGeo(1.05, 0.1, 0.5, 0.05), 0xdccaa6, { x: -0.42, y: 0.05, z: z + 0.28 });
  archWindow(b, glow, 0.58, base + 0.55, z, 0.6, 0.72);
  // 屋根うらの まる窓（三角の まんなか）
  roundWindow(b, glow, 0, y0 + (rise - over) * 0.32, z + 0.02, 0.24);
  roundWindow(b, glow, 0, y0 + (rise - over) * 0.32, -z - 0.02, 0.24, 0xd9a066, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
  // 入口の わきに 街灯、反対がわに まるい しげみ
  lampPost(b, glow, -1.65, z + 0.55);
  roundBush(b, 1.35, 0, z + 0.15, 0.9, 0xfff08a);
  stones(b, -0.35, z + 0.95, 3, 0.1, 0.6);
  g.add(b.mesh(), glow.mesh(true));
  if (withBed) {
    const bd = bed('stone', 0.8, seed);
    bd.position.set(2.15, 0, z - 0.4);
    g.add(bd);
  }
  const sm = smoke(cx + 0.04, cy + 0.85, cz);
  g.add(sm);
  const bedUpdate = g.children.find((c) => c.userData.update)?.userData.update;
  g.userData.update = (t) => { sm.userData.tick(t); bedUpdate?.(t); };
  g.scale.setScalar(size);
  return g;
}

// ---- きのこのおうち ---------------------------------------------------------
// 大きな まるい かさが 主役。柄は ふっくら、正面に まるい とびらと まる窓、わきに ランタン
export function mushroomHouse({ cap = 0xf26a4b, size = 1, withBed = true, seed = 7 } = {}) {
  const g = new THREE.Group();
  const b = new Bag(); const glow = new Bag();
  g.add(blob(2.9, 2.9, 0.3));
  const R = 1.0; const H = 1.95;
  // きのこの 柄（まんなかが ふくらみ、下は 地面に すわる）
  const stem = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    stem.push(new THREE.Vector2(R * (0.97 + 0.09 * Math.sin(u * Math.PI) - 0.1 * u) + (u < 0.12 ? (0.12 - u) * 1.6 : 0), u * (H + 0.2)));
  }
  b.add(new THREE.LatheGeometry(stem, 32), CREAM, {});
  // かさ（たかめの まるい ドーム。ふちは まるく 下へ まきこむ）
  const capY = H + 0.05; const CR = 2.1; const CH = 1.55;
  const capProf = [];
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * (Math.PI / 2);
    capProf.push(new THREE.Vector2(Math.sin(a) * CR, Math.cos(a) * CH * (0.8 + 0.2 * Math.cos(a))));
  }
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * Math.PI * 0.85;
    capProf.push(new THREE.Vector2(CR + Math.sin(a) * 0.2, -0.2 + Math.cos(a) * 0.2));
  }
  capProf.push(new THREE.Vector2(CR - 0.3, -0.26));
  capProf.push(new THREE.Vector2(0.01, -0.26));
  capProf.reverse();
  b.add(new THREE.LatheGeometry(capProf, 40), cap, { y: capY });
  b.add(new THREE.CircleGeometry(1, 32).rotateX(Math.PI / 2), 0xffe8c4, { y: capY - 0.25, sx: CR - 0.25, sy: 1, sz: CR - 0.25 });
  // 白い 水玉（大きめを すこしだけ）
  const spots = [[0.9, 0.62, 0.55], [2.2, 0.75, 0.5], [3.4, 0.6, 0.52], [4.6, 0.72, 0.5], [5.7, 0.66, 0.46], [0.3, 0.0, 0.5], [1.6, 1.12, 0.36], [4.0, 1.15, 0.36]];
  for (const [th, ph, sz] of spots) {
    const sp = Math.sin(ph); const cp = Math.cos(ph);
    const px = CR * sp * Math.cos(th); const py = capY + CH * cp * (0.8 + 0.2 * cp); const pz = CR * sp * Math.sin(th);
    const q = alignUp(px / (CR * CR), (py - capY) / (CH * CH), pz / (CR * CR));
    b.add(SPH, 0xffffff, { x: px * 0.99, y: capY + (py - capY) * 0.99, z: pz * 0.99, sx: sz, sy: 0.1, sz: sz * 0.85, q });
  }
  // とびら・まる窓・ランタン（正面に まとめる）
  const z = R * 0.97;
  cuteDoor(b, glow, -0.12, z, 0.72, 1.25);
  b.add(rboxGeo(1.0, 0.1, 0.5, 0.05), 0xdccaa6, { x: -0.12, y: 0.05, z: z + 0.28 });
  const wa = 0.78;
  const wq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), wa);
  roundWindow(b, glow, Math.sin(wa) * (R * 1.0), 1.15, Math.cos(wa) * (R * 1.0), 0.28, 0xd9a066, wq);
  lantern(b, glow, -0.74, 1.35, z - 0.04);
  roundBush(b, 1.1, 0, 0.75, 0.85, 0xffd84a);
  stones(b, -0.1, z + 0.95, 3, 0.15, 0.6);
  g.add(b.mesh(), glow.mesh(true));
  if (withBed) {
    const bd = bed('log', 0.8, seed);
    bd.position.set(-1.75, 0, 0.9);
    g.add(bd);
  }
  g.scale.setScalar(size);
  return g;
}

void softDot;
