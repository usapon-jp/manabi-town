// まるくてやわらかい「ねんどのおもちゃ」風の家と花だん。
// ちいさなコテージ（うろこ屋根）と、きのこのおうち、丸太・石でかこった花だん。town.js から使う。
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { propReady } from './props.js';
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

// うさぽん村の つた（assets/models/ivy.json）を、まるい かべに そわせて はる。
// a0 = 正面からの 角度、y0 = 下はし、h = 高さ。かべの はんけいは bodyR(y)
const ivyGeoCache = new Map();
function ivyOn(g, bodyR, a0, y0, h) {
  const holder = new THREE.Group();
  g.add(holder);
  propReady('ivy').then((P) => {
    const key = `${a0},${y0},${h},${bodyR(0.5).toFixed(3)},${bodyR(1.2).toFixed(3)}`;
    let geo = ivyGeoCache.get(key);
    if (!geo) {
      geo = P.g.clone();
      const pos = geo.attributes.position; const k = h / P.h;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) * k; const y = pos.getY(i) * k + y0; const z = pos.getZ(i) * k;
        const r = bodyR(y) + 0.05 + z;
        const ang = a0 + x / r;
        pos.setXYZ(i, Math.sin(ang) * r, y, Math.cos(ang) * r);
      }
      geo.computeVertexNormals();
      ivyGeoCache.set(key, geo);
    }
    if (!ivyMat) { ivyMat = P.mat.clone(); ivyMat.color.set(0xd8f0c0); }
    holder.add(new THREE.Mesh(geo, ivyMat));
  }).catch(() => {});
}
let ivyMat = null;

// ---- きのこのおうち ---------------------------------------------------------
// ぽてっと まるい 絵本の 家（2026-11-19 フミオさん「生き物みたいに 愛嬌のある 家に」）。
// 形が 主役: 厚くて ふっくらした 傘（ふちは 場所ごとに すこし たわむ）＋ 短めで ふくらんだ 本体。
// 顔: まんなかの まるい とびら（口）と、左右の まる窓（目）。見せ場は 入口まわり（ランプ・つた・花の 鉢・石の 道）。

// 傘の ふちの たわみ（角度ごとに すこし ちがう。外がわほど 強く）
function capWarp(x, y, z, CR) {
  const r = Math.hypot(x, z); const th = Math.atan2(z, x);
  const k = Math.min(1, Math.max(0, (r - CR * 0.45) / (CR * 0.6)));
  const kk = k * k * (3 - 2 * k);
  const dy = kk * (-0.2 * (0.5 + 0.5 * Math.sin(2 * th + 0.7)) - 0.07 * Math.sin(3 * th + 1.9));
  const sr = 1 + kk * (0.04 * Math.sin(2 * th + 0.3) + 0.015 * Math.sin(3 * th + 1.1));
  return [x * sr, y + dy, z * sr];
}

// 2Dの 点を なめらかに つないで、まわして 形に（lathe）。warp で 頂点を ゆがめ、法線を 作りなおす
function smoothLathe(pts2, segs, n = 48, warp = null) {
  const curve = new THREE.SplineCurve(pts2.map(([r, y]) => new THREE.Vector2(r, y)));
  const prof = curve.getPoints(n).map((p) => new THREE.Vector2(Math.max(0.001, p.x), p.y));
  let geo = new THREE.LatheGeometry(prof, segs);
  geo.deleteAttribute('uv'); geo.deleteAttribute('normal');
  geo = mergeVertices(geo, 1e-4);
  if (warp) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const [x, y, z] = warp(pos.getX(i), pos.getY(i), pos.getZ(i)); pos.setXYZ(i, x, y, z); }
  }
  geo.computeVertexNormals();
  return { geo, curve };
}

export function mushroomHouse({ cap = 0xf26a4b, size = 1, withBed = true, seed = 7 } = {}) {
  const g = new THREE.Group();
  const b = new Bag(); const glow = new Bag();
  g.add(blob(3.0, 3.0, 0.32));
  // 本体（短めで ふっくら。下は まるく 地面に すわる）
  const bodyPts = [[0.001, 0], [1.12, 0.0], [1.36, 0.1], [1.42, 0.42], [1.34, 0.9], [1.2, 1.45], [1.06, 2.04]];
  const body = smoothLathe(bodyPts, 40, 40);
  b.add(body.geo, 0xfff3dc, {});
  const bodyR = (y) => { // y での 本体の はんけい（だいたい）
    const pts = body.curve.getPoints(80);
    let best = pts[0];
    for (const p of pts) if (Math.abs(p.y - y) < Math.abs(best.y - y)) best = p;
    return best.x;
  };
  // 傘（厚く ふっくら。ふちは まるく まきこみ、すこし たわむ）
  const capY = 2.02; const CR = 2.45; const CH = 1.8; const RR = 0.5;
  const capPts = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2);
    const sa = Math.sin(a); const ca = Math.cos(a);
    capPts.push([(CR - RR) * Math.pow(sa, 0.8) + RR * sa, CH * Math.pow(ca, 0.75) - RR * 0.0]);
  }
  capPts.push([CR + 0.02, -RR * 0.45], [CR - RR * 0.55, -RR * 0.98], [CR - RR * 1.4, -RR * 0.9]);
  const warp = (x, y, z) => { const [wx, wy, wz] = capWarp(x, y, z, CR); return [wx, wy + capY, wz]; };
  b.add(smoothLathe(capPts.reverse(), 56, 60, warp).geo, cap, {});
  // 傘の うら（クリーム色。本体へ なめらかに つながる）
  const underPts = [[CR - RR * 1.3, -RR * 0.92], [CR * 0.72, -RR * 0.72], [1.42, -RR * 0.3], [1.08, 0.0]];
  b.add(smoothLathe(underPts.reverse(), 56, 24, warp).geo, 0xffe6c2, {});
  // 白い 水玉（大きめを すこし。傘の 面に そわせる）
  const capAt = (a, th) => {
    const sa = Math.sin(a); const ca = Math.cos(a);
    const r = (CR - RR) * Math.pow(sa, 0.8) + RR * sa; const y = CH * Math.pow(ca, 0.75);
    return new THREE.Vector3(...warp(Math.cos(th) * r, y, Math.sin(th) * r));
  };
  const spots = [[0.75, 0.9, 0.55], [0.95, 2.3, 0.48], [0.7, 3.5, 0.55], [0.9, 4.7, 0.5], [0.78, 5.8, 0.46], [0.08, 0.0, 0.5], [1.12, 1.55, 0.34], [1.1, 4.05, 0.36], [0.42, 2.9, 0.38]];
  for (const [a, th, sz] of spots) {
    const p = capAt(a, th);
    const n = capAt(a + 0.02, th).sub(capAt(a - 0.02, th)).cross(capAt(a, th + 0.02).sub(capAt(a, th - 0.02))).normalize();
    if (n.y < 0) n.negate();
    p.addScaledVector(n, 0.02);
    b.add(SPH, 0xfffaf0, { x: p.x, y: p.y, z: p.z, sx: sz, sy: 0.1, sz: sz * 0.86, q: alignUp(n.x, n.y, n.z) });
  }
  // 小さな えんとつ（うしろ。くの字に まがった パイプと けむり。住んでいる しるし）
  const chp = capAt(0.62, -2.3);
  b.add(CYL, 0xb86d4a, { x: chp.x, y: chp.y + 0.2, z: chp.z, sx: 0.13, sy: 0.55, sz: 0.13, rz: 0.15 });
  b.add(CYL, 0xb86d4a, { x: chp.x - 0.06, y: chp.y + 0.55, z: chp.z, sx: 0.13, sy: 0.3, sz: 0.13, rz: -0.25 });
  b.add(CYL, 0xd2875f, { x: chp.x - 0.1, y: chp.y + 0.71, z: chp.z, sx: 0.18, sy: 0.08, sz: 0.18, rz: -0.25 });
  // 顔: まんなかに 大きな まるい とびら、左右に 大きめの まる窓
  const zf = bodyR(0.6) - 0.02;
  cuteDoor(b, glow, 0, zf, 0.94, 1.28, 0xe9d3a8);
  b.add(rboxGeo(1.2, 0.1, 0.55, 0.05), 0xdccaa6, { y: 0.05, z: zf + 0.3 });
  b.add(rboxGeo(0.66, 0.02, 0.32, 0.01), 0xd88f8f, { y: 0.11, z: zf + 0.34 });   // 玄関マット
  for (const sd of [-1, 1]) {
    const wa = sd * 0.86; const wy = 1.05; const wr = bodyR(wy) + 0.01;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), wa);
    roundWindow(b, glow, Math.sin(wa) * wr, wy, Math.cos(wa) * wr, 0.31, 0xc98a52, q);
  }
  // 入口の わきの ランプ
  lantern(b, glow, 0.62, 1.3, bodyR(1.3) + 0.03);
  // つた（うさぽん村の つたの モデルを 本体の まるみに そわせて 左の 窓の 外がわに）
  ivyOn(g, bodyR, -0.5, 0.0, 1.75);
  // 花の 鉢を 入口の 両がわに
  for (const sd of [-1, 1]) {
    const px = sd * 0.86; const pz = zf + 0.4;
    b.add(new THREE.CylinderGeometry(0.19, 0.14, 0.3, 14), 0xd27a52, { x: px, y: 0.15, z: pz });
    b.add(CYL, 0xc06a45, { x: px, y: 0.3, z: pz, sx: 0.21, sy: 0.05, sz: 0.21 });
    b.add(SPH, 0x6fb35e, { x: px, y: 0.4, z: pz, sx: 0.2, sy: 0.15, sz: 0.2 });
    for (let k = 0; k < 4; k++) {
      const a = k * 1.7 + sd;
      b.add(SPH, sd < 0 ? 0xff9fbd : 0xffd84a, { x: px + Math.cos(a) * 0.12, y: 0.5 + (k % 2) * 0.04, z: pz + Math.sin(a) * 0.12, s: 0.065 });
    }
  }
  // 石の 道（とびらから 外へ）
  stones(b, 0.05, zf + 0.95, 3, 0.12, 0.55);
  // くらしの けはい: じょうろ
  const wcx = 1.22; const wcz = zf + 0.62;
  b.add(CYL, 0x9fb8a0, { x: wcx, y: 0.17, z: wcz, sx: 0.17, sy: 0.32, sz: 0.17 });
  b.add(CYL, 0x8aa68c, { x: wcx, y: 0.34, z: wcz, sx: 0.18, sy: 0.04, sz: 0.18 });
  b.add(CYL, 0x9fb8a0, { x: wcx + 0.24, y: 0.3, z: wcz, sx: 0.035, sy: 0.34, sz: 0.035, rz: -0.9 });
  b.add(new THREE.TorusGeometry(0.13, 0.022, 6, 14), 0x8aa68c, { x: wcx - 0.08, y: 0.36, z: wcz });
  g.add(b.mesh(), glow.mesh(true));
  if (withBed) {
    const bd = bed('log', 0.7, seed);
    bd.position.set(-2.15, 0, 0.45);
    g.add(bd);
  }
  const sm = smoke(chp.x - 0.1, chp.y + 0.8, chp.z);
  g.add(sm);
  const bedUpdate = g.children.find((c) => c.userData.update)?.userData.update;
  g.userData.update = (t) => { sm.userData.tick(t); bedUpdate?.(t); };
  g.scale.setScalar(size);
  return g;
}

void softDot;
