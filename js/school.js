// まなびタウンの 学校（Lv7）。赤い かわら屋根・しっくいの 壁・金の かねの 塔。town.js から使う。
// こまかい 部品は Bag で ひとつの メッシュに まとめて、たくさん 置いても 重くならないように している。
import * as THREE from 'three';
import { mat, box, cyl, cone, ball, blob, Bag, GEO, rboxGeo, seeded } from './townkit.js';

const WALL = 0xfff0d8;
const ROOF = 0xe5705f;
const WOOD = 0x93603e;
const WOOD_DARK = 0x7a4c30;
const TRIM = 0xfffaf0;
const STONE = 0xd8d1c1;
const SHUTTER = 0x7fb8a4;
const GLASS = 0xffe6a6;

// rboxGeo は 作るのに 手間が かかるので、同じ 大きさは 使いまわす
const rbCache = new Map();
const rb = (w, h, d, r = 0.02) => {
  const k = `${w},${h},${d},${r}`;
  if (!rbCache.has(k)) rbCache.set(k, rboxGeo(w, h, d, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)));
  return rbCache.get(k);
};

// ---- しっくいの 壁の 絵 ----------------------------------------------------
let plasterTex = null;
function plaster() {
  if (plasterTex) return plasterTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#fff0d8';
  x.fillRect(0, 0, 256, 256);
  const rnd = seeded(71);
  // ふんわりした むら
  for (let i = 0; i < 40; i++) {
    const px = rnd() * 256; const py = rnd() * 256; const r = 20 + rnd() * 50;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    const dark = rnd() < 0.5;
    g.addColorStop(0, dark ? 'rgba(214,180,140,0.10)' : 'rgba(255,255,255,0.14)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { x.save(); x.translate(ox, oy); x.fillRect(px - r, py - r, r * 2, r * 2); x.restore(); }
  }
  // こまかい つぶつぶ
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = rnd() < 0.55 ? `rgba(190,150,110,${0.06 + rnd() * 0.08})` : `rgba(255,255,255,${0.2 + rnd() * 0.2})`;
    x.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
  // こての あと（うすい 横すじ）
  for (let i = 0; i < 26; i++) {
    x.strokeStyle = `rgba(200,165,125,${0.05 + rnd() * 0.05})`;
    x.lineWidth = 1;
    const y0 = rnd() * 256; const x0 = rnd() * 256; const len = 30 + rnd() * 60;
    x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo(x0 + len / 2, y0 + (rnd() - 0.5) * 6, x0 + len, y0 + (rnd() - 0.5) * 4); x.stroke();
  }
  plasterTex = new THREE.CanvasTexture(c);
  plasterTex.colorSpace = THREE.SRGBColorSpace;
  plasterTex.wrapS = plasterTex.wrapT = THREE.RepeatWrapping;
  plasterTex.anisotropy = 4;
  return plasterTex;
}
let plasterMat = null;
const wallMat = () => plasterMat || (plasterMat = new THREE.MeshLambertMaterial({
  color: 0xffffff, map: plaster(), emissive: 0xffffff, emissiveMap: plaster(), emissiveIntensity: 0.24,
}));

// 面の むきに あわせて、1.6 ユニットで 絵が 1まい に なるよう UV を はりなおす（横長の 面でも 絵が のびない）
function worldUV(geo, size = 1.6) {
  const p = geo.attributes.position; const n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)); const ay = Math.abs(n.getY(i)); const az = Math.abs(n.getZ(i));
    let u; let v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / size; uv[i * 2 + 1] = v / size;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
function plasterBox(w, h, d, x, y, z) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(x, y, z);   // 位置ごと UV に するので、となりの 面と 絵が つながる
  return new THREE.Mesh(worldUV(geo), wallMat());
}
function plasterGable(width, rise, z, y, depth = 0.08) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(0, rise); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, y, z - depth / 2);
  return new THREE.Mesh(worldUV(geo), wallMat());
}

// ---- 部品を むきを つけて 置く ------------------------------------------------
// (cx,cy,cz) を 中心に ry だけ まわした 面の上に、その面での 位置 (lx,ly,lz) で 置く
function placer(bag, cx, cy, cz, ry) {
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
  const cs = Math.cos(ry); const sn = Math.sin(ry);
  return (geo, color, lx, ly, lz, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => {
    const q = qy.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)));
    bag.add(geo, color, { x: cx + lx * cs + lz * sn, y: cy + ly, z: cz - lx * sn + lz * cs, sx, sy, sz, q });
  };
}

// ---- まど ------------------------------------------------------------------
// 白い わく・まんなかの 十字・上の まぐさ・下の まどだい・よろい戸（羽板つき）・カーテン・花ばこ
function schoolWindow(solid, glow, cx, cy, cz, ry, w, h, { flowers = false, seed = 1 } = {}) {
  const P = placer(solid, cx, cy, cz, ry);
  const G = placer(glow, cx, cy, cz, ry);
  const rnd = seeded(seed);
  // ガラス（すこし おくに ひっこめる）と 光の すじ
  G(GEO.BOX, GLASS, 0, 0, 0.01, w, h, 0.02);
  G(GEO.BOX, 0xfff8e4, -w * 0.18, h * 0.12, 0.025, 0.035, h * 0.55, 0.005, 0, -0.5);
  G(GEO.BOX, 0xfff8e4, -w * 0.05, h * 0.18, 0.025, 0.02, h * 0.35, 0.005, 0, -0.5);
  // 上の カーテン（ひだ）
  for (let i = 0; i < 5; i++) P(GEO.SPH, 0xffb8c8, -w / 2 + (i + 0.5) * (w / 5), h / 2 - 0.06, 0.03, w / 10, 0.07, 0.015);
  // わく
  P(rb(0.07, h + 0.14, 0.09), TRIM, -w / 2 - 0.035, 0, 0.04);
  P(rb(0.07, h + 0.14, 0.09), TRIM, w / 2 + 0.035, 0, 0.04);
  P(rb(w + 0.14, 0.07, 0.09), TRIM, 0, h / 2 + 0.035, 0.04);
  P(rb(w + 0.14, 0.07, 0.09), TRIM, 0, -h / 2 - 0.035, 0.04);
  // 十字（たて1本・よこ2本で 6まいの ガラス）
  P(GEO.BOX, TRIM, 0, 0, 0.035, 0.03, h, 0.04);
  for (const fy of [-1, 1]) P(GEO.BOX, TRIM, 0, fy * h / 6, 0.035, w, 0.03, 0.04);
  // まぐさ（上の かざり）と まどだい
  P(rb(w + 0.26, 0.09, 0.12), TRIM, 0, h / 2 + 0.11, 0.05);
  P(rb(w + 0.34, 0.045, 0.17), 0xf2e6cf, 0, h / 2 + 0.175, 0.06);
  P(rb(0.09, 0.1, 0.13), TRIM, 0, h / 2 + 0.11, 0.07);            // かなめ石
  P(rb(w + 0.24, 0.06, 0.17), TRIM, 0, -h / 2 - 0.1, 0.07);
  for (const s of [-1, 1]) P(rb(0.05, 0.08, 0.08), 0xf2e6cf, s * (w / 2 - 0.02), -h / 2 - 0.17, 0.04);
  // よろい戸
  const sw = w * 0.42;
  for (const s of [-1, 1]) {
    const sx = s * (w / 2 + 0.08 + sw / 2);
    const shade = new THREE.Color(SHUTTER).multiplyScalar(0.95 + rnd() * 0.08).getHex();
    P(rb(sw, h + 0.06, 0.04), shade, sx, 0, 0.03);
    P(rb(sw - 0.04, 0.03, 0.03), new THREE.Color(shade).multiplyScalar(1.08).getHex(), sx, 0, 0.05);   // まんなかの 横木
    const n = 6;
    for (let k = 0; k < n; k++) {
      const yy = -h / 2 + 0.06 + (k + 0.5) * ((h - 0.12) / n);
      P(GEO.BOX, new THREE.Color(shade).multiplyScalar(0.82).getHex(), sx, yy, 0.055, sw - 0.06, 0.022, 0.012, -0.5);
    }
    for (const hy of [-1, 1]) P(GEO.BOX, 0x4a4a4a, s * (w / 2 + 0.085), hy * h * 0.32, 0.055, 0.03, 0.03, 0.02);   // ちょうつがい
  }
  // 花ばこ
  if (flowers) {
    P(rb(w * 1.2, 0.15, 0.18), 0xa56b46, 0, -h / 2 - 0.2, 0.13);
    P(GEO.BOX, 0x8a5636, 0, -h / 2 - 0.2, 0.225, w * 1.18, 0.02, 0.01);
    const cols = [0xff8fb3, 0xfff08a, 0xffffff, 0xc7a6ff];
    for (let i = 0; i < 7; i++) {
      const fx = (i - 3) * w * 0.17;
      P(GEO.SPH, 0x62b35a, fx + 0.03, -h / 2 - 0.12, 0.15, 0.07, 0.05, 0.06);
      P(GEO.SPH, cols[i % 4], fx, -h / 2 - 0.08 + (i % 2) * 0.03, 0.17, 0.055, 0.055, 0.055);
    }
  }
}

// ---- かわら屋根 --------------------------------------------------------------
// 丸がわら（うえに ふくらんだ 半分の つつ）を たてに ならべて、1だんずつ すこし ずらして 重ねる
function tiledRoof(width, depth, rise, over = 0.3) {
  const g = new THREE.Group();
  const half = width / 2 + over;
  const rise2 = (rise * half) / (width / 2);
  const len = Math.hypot(half, rise2);
  const ang = Math.atan2(rise2, half);
  const slabD = depth + over * 1.8;
  const rnd = seeded(53);
  const pitch = 0.3; const rows = Math.ceil(len / pitch);
  const colP = 0.22; const cols = Math.floor(slabD / colP);
  const base = new THREE.Color(ROOF);
  const under = base.clone().multiplyScalar(0.62).getHex();
  for (const side of [-1, 1]) {
    const b = new Bag();
    b.add(rb(len, 0.1, slabD, 0.03), under, {});
    for (let c = 0; c < cols; c++) {
      const v = -slabD / 2 + (c + 0.5) * (slabD / cols);
      // かわらの あいだの みぞ（すこし くらい）
      b.add(GEO.BOX, base.clone().multiplyScalar(0.8).getHex(), { x: 0, y: 0.06, z: v + slabD / cols / 2, sx: len, sy: 0.02, sz: 0.05 });
      for (let r = 0; r < rows; r++) {
        const u = side * (-len / 2 + (r + 0.5) * pitch);
        const k = 0.88 + rnd() * 0.2;
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
        q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), side * 0.07));   // のき側を すこし もちあげて 重なりを 見せる
        b.add(GEO.HALF, base.clone().multiplyScalar(k).getHex(), { x: u, y: 0.05 + r * 0.006, z: v, sx: colP * 0.46, sy: 0.075, sz: pitch * 1.12, q });
      }
      // のきさきの 丸い はな（まるがわらの 口）
      b.add(GEO.SPH, base.clone().multiplyScalar(0.9).getHex(), { x: side * (len / 2 - 0.02), y: 0.08 + rows * 0.006, z: v, sx: 0.03, sy: 0.07, sz: colP * 0.46 });
    }
    // 前と うしろの はふ板（木）
    for (const sz of [-1, 1]) b.add(rb(len + 0.04, 0.2, 0.08, 0.03), WOOD, { y: 0.0, z: sz * (slabD / 2 + 0.03) });
    const m = b.mesh();
    m.position.set((side * half) / 2, rise2 / 2 + 0.05, 0);
    m.rotation.z = -side * ang;
    g.add(m);
  }
  // むね（てっぺん）
  const ridge = new Bag();
  const rc = base.clone().multiplyScalar(0.85).getHex();
  const n = Math.round(slabD / 0.3);
  for (let i = 0; i < n; i++) {
    ridge.add(GEO.HALF, rc, { y: rise2 + 0.12, z: -slabD / 2 + (i + 0.5) * (slabD / n), sx: 0.13, sy: 0.12, sz: slabD / n * 1.05 });
  }
  for (const s of [-1, 1]) ridge.add(GEO.SPH, rc, { y: rise2 + 0.15, z: s * (slabD / 2 + 0.02), s: 0.12 });
  g.add(ridge.mesh());
  return g;
}

// 塔の 4かくい とんがり屋根。だんだんに かわらを 重ねる
function spire(y0, r0, h, x, z) {
  const g = new THREE.Group();
  const under = cone(r0 * 0.96, h, new THREE.Color(ROOF).multiplyScalar(0.7).getHex(), x, y0 + h / 2, z, 4);
  under.rotation.y = Math.PI / 4;
  g.add(under);
  const tiers = 6;
  for (let i = 0; i < tiers; i++) {
    const t0 = i / tiers; const t1 = (i + 1.15) / tiers;
    const rb0 = r0 * (1 - t0) + 0.05; const rt = Math.max(0.02, r0 * (1 - Math.min(1, t1)));
    const hh = h * (Math.min(1, t1) - t0);
    const col = new THREE.Color(ROOF).multiplyScalar(i % 2 ? 0.94 : 1.02).getHex();
    const tier = cyl(rt, rb0, hh, col, x, y0 + h * t0 + hh / 2, z, 4);
    tier.rotation.y = Math.PI / 4;
    g.add(tier);
  }
  return g;
}

// 塔の まるまどと 金の かね。かねは 上の つり手を 軸に ゆれる
function bellWindow() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CircleGeometry(0.5, 28), mat(0x9fd3e8)));
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.42, 28), mat(0x7cb9d4));
  inner.position.z = 0.005;
  g.add(inner);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 28), mat(WOOD));
  rim.position.z = 0.01;
  g.add(rim);
  const rim2 = new THREE.Mesh(new THREE.TorusGeometry(0.585, 0.025, 6, 28), mat(TRIM));
  rim2.position.z = 0.01;
  g.add(rim2);
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {   // かなめ石
    const k = box(0.11, 0.13, 0.08, TRIM, Math.sin(a) * 0.56, Math.cos(a) * 0.56, 0.03);
    k.rotation.z = -a;
    g.add(k);
  }
  g.add(box(0.75, 0.07, 0.18, WOOD, 0, -0.6, 0.06));    // まどの 下の 台
  g.add(box(0.05, 0.42, 0.03, WOOD, 0, 0.21, 0.02));    // つり ぼう
  const swing = new THREE.Group();
  swing.position.set(0, 0.22, 0.08);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.03, 6, 20), mat(0xf2bf3e));
  lip.rotation.x = Math.PI / 2;
  lip.position.y = -0.43;
  swing.add(cone(0.24, 0.38, 0xffd45c, 0, -0.24, 0, 16), lip, ball(0.07, 0xffd45c, 0, 0, 0), ball(0.06, 0xd9a83a, 0, -0.46, 0));
  g.add(swing);
  g.userData.swing = swing;
  return g;
}

// げんかん: 石の アーチの わく・2まいの とびら（かざりの 板つき）・上の 半円の まど
function door(solid, glow, z) {
  const w = 0.95; const h = 1.5; const y0 = 0.2;
  const rectH = h - w / 2; const ay = y0 + rectH;
  const P = placer(solid, 0, 0, z, 0);
  const G = placer(glow, 0, 0, z, 0);
  const col = 0x9a6a4a;
  P(GEO.BOX, col, 0, y0 + rectH / 2, 0, w, rectH, 0.08);
  G(GEO.HALF, GLASS, 0, ay, 0, w / 2, w / 2, 0.06);           // 上の 半円の まど
  P(GEO.BOX, TRIM, 0, ay + 0.01, 0.04, w, 0.04, 0.04);
  for (const a of [-0.6, 0, 0.6]) P(GEO.BOX, TRIM, Math.sin(a) * w / 4, ay + Math.cos(a) * w / 4, 0.04, 0.025, w / 2, 0.03, 0, -a);
  P(GEO.BOX, WOOD_DARK, 0, y0 + rectH / 2, 0.045, 0.04, rectH, 0.02);   // まんなかの すきま
  for (const s of [-1, 1]) {
    for (const [py, ph] of [[0.32, 0.42], [0.8, 0.34]]) {
      P(rb(0.3, ph, 0.04, 0.015), 0xae7b54, s * 0.22, y0 + py, 0.05);
      P(rb(0.22, ph - 0.08, 0.03, 0.01), 0x9a6a4a, s * 0.22, y0 + py, 0.07);
    }
    P(GEO.SPH, 0xffd45c, s * 0.07, y0 + 0.62, 0.08, 0.035, 0.035, 0.035);   // とって
  }
  // 石の わく
  const rnd = seeded(9);
  const stone = () => new THREE.Color(STONE).multiplyScalar(0.94 + rnd() * 0.1).getHex();
  const R = w / 2 + 0.09;
  const n = 11; const bw = (Math.PI * R) / n - 0.012;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / n) * Math.PI;
    const big = i === (n - 1) / 2;
    P(rb(big ? bw + 0.04 : bw, big ? 0.25 : 0.19, big ? 0.14 : 0.12, 0.025), big ? 0xf2ead8 : stone(), Math.sin(a) * R, ay + Math.cos(a) * R + (big ? 0.02 : 0), 0.04, 1, 1, 1, 0, -a);
  }
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
    const sw = k % 2 ? 0.16 : 0.2;
    P(rb(sw, 0.24, 0.12, 0.025), stone(), s * (R + (sw - 0.16) / 2), y0 + 0.12 + k * rectH / 4, 0.04);
  }
}

function bush(b, x, z, s = 1) {
  b.add(GEO.SPH, 0x6fb35e, { x, y: 0.26 * s, z, s: 0.32 * s });
  b.add(GEO.SPH, 0x83c46a, { x: x + 0.28 * s, y: 0.2 * s, z: z + 0.1 * s, s: 0.25 * s });
  b.add(GEO.SPH, 0x78bb64, { x: x - 0.25 * s, y: 0.18 * s, z: z - 0.05 * s, s: 0.22 * s });
  for (let i = 0; i < 4; i++) b.add(GEO.SPH, [0xff8fb3, 0xfff08a][i % 2], { x: x + (i - 1.5) * 0.14 * s, y: (0.3 + (i % 2) * 0.1) * s, z: z + 0.28 * s, s: 0.045 * s });
}

export function school() {
  const g = new THREE.Group();
  const solid = new Bag(); const glow = new Bag();
  const rnd = seeded(17);
  g.add(blob(4.6, 3.2, 0.3));
  g.add(box(5.6, 0.2, 3.0, 0xbdb6a6, 0, 0.1, 0));
  // かべ（しっくい）と 石の 土台
  g.add(plasterBox(5.2, 2.1, 2.6, 0, 1.25, 0));
  for (const [len, axis, fixed] of [[5.36, 'x', 1.33], [5.36, 'x', -1.33], [2.76, 'z', 2.63], [2.76, 'z', -2.63]]) {
    const n = Math.round(len / 0.34);
    for (let row = 0; row < 2; row++) for (let i = 0; i < n; i++) {
      const u = -len / 2 + (i + 0.5 + (row ? 0.5 : 0)) * (len / n);
      if (Math.abs(u) > len / 2 - 0.1) continue;
      if (axis === 'x' && fixed > 0 && Math.abs(u) < 0.62) continue;   // げんかんの ところは あける
      const c = new THREE.Color(STONE).multiplyScalar(0.86 + rnd() * 0.12).getHex();
      const y = 0.29 + row * 0.15;
      if (axis === 'x') solid.add(rb(len / n - 0.03, 0.13, 0.1, 0.03), c, { x: u, y, z: fixed });
      else solid.add(rb(0.1, 0.13, len / n - 0.03, 0.03), c, { x: fixed, y, z: u });
    }
  }
  // 柱・のきの 横木
  for (const sx of [-2.6, 2.6]) for (const sz of [-1.3, 1.3]) solid.add(rb(0.16, 2.1, 0.16, 0.03), WOOD, { x: sx, y: 1.25, z: sz });
  for (const sz of [-1.33, 1.33]) solid.add(rb(5.36, 0.12, 0.1, 0.03), WOOD, { y: 2.27, z: sz });
  for (const sx of [-2.63, 2.63]) solid.add(rb(0.1, 0.12, 2.76, 0.03), WOOD, { x: sx, y: 2.27 });
  // 屋根
  const rise = 1.1;
  const roof = tiledRoof(5.2, 2.6, rise, 0.3);
  roof.position.y = 2.3;
  g.add(roof);
  for (const sz of [-1, 1]) g.add(plasterGable(5.2, rise, sz * 1.3, 2.3));
  // 正面の 三角に 本の しるし（学校の めじるし）
  const badge = new THREE.Group();
  badge.add(new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), mat(0xffd45c)));
  const badgeRim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 6, 24), mat(WOOD));
  badgeRim.position.z = 0.01;
  badge.add(badgeRim);
  for (const sx of [-1, 1]) {
    const page = box(0.2, 0.26, 0.02, 0xffffff, sx * 0.105, 0, 0.02);
    page.rotation.z = sx * -0.12;
    badge.add(page);
  }
  badge.add(box(0.025, 0.26, 0.03, ROOF, 0, 0, 0.03));
  badge.position.set(0, 2.82, 1.39);
  g.add(badge);
  // まんなかの 塔
  g.add(plasterBox(1.5, 3.0, 1.5, 0, 3.95, 0.3));
  for (const sx of [-0.75, 0.75]) for (const sz of [-0.45, 1.05]) solid.add(rb(0.13, 2.2, 0.13, 0.03), WOOD, { x: sx, y: 4.35, z: sz });
  solid.add(rb(1.62, 0.1, 1.62, 0.03), WOOD, { y: 3.92, z: 0.3 });
  solid.add(rb(1.72, 0.14, 1.72, 0.04), WOOD, { y: 5.52, z: 0.3 });
  for (let i = 0; i < 8; i++) {   // のきの 下の かざり
    const u = -0.66 + (i / 7) * 1.32;
    for (const [x, z] of [[u, 1.12], [u, -0.52], [0.82, 0.3 + u], [-0.82, 0.3 + u]]) solid.add(rb(0.08, 0.12, 0.08, 0.02), WOOD, { x, y: 5.4, z });
  }
  g.add(spire(5.6, 1.2, 1.7, 0, 0.3));
  g.add(cyl(0.025, 0.025, 0.4, 0xd9a83a, 0, 7.45, 0.3, 6), ball(0.13, 0xffd45c, 0, 7.35, 0.3), cone(0.08, 0.18, 0xffd45c, 0, 7.7, 0.3, 8));
  // 塔の まるまどに 金の かね（時計に すると Lv10 の 時計塔と まちがえて タップしてしまうので、時計は 時計塔だけ）。4つの 面に
  const bells = [];
  for (const [x, z, rot] of [[0, 1.06, 0], [0, -0.46, Math.PI], [0.76, 0.3, Math.PI / 2], [-0.76, 0.3, -Math.PI / 2]]) {
    const bw = bellWindow();
    bw.position.set(x, 4.6, z);
    bw.rotation.y = rot;
    g.add(bw);
    bells.push(bw.userData.swing);
  }
  // げんかん
  door(solid, glow, 1.34);
  solid.add(rb(2.0, 0.1, 0.6, 0.03), 0xcfc8b8, { y: 0.25, z: 1.6 });
  solid.add(rb(1.6, 0.1, 0.45, 0.03), 0xd8d1c1, { y: 0.3, z: 1.65 });
  // まど（正面は 花ばこつき。横と うらにも）
  let seed = 1;
  for (const sx of [-1, 1]) {
    // 正面は げんかんの 石の わく（はば 0.67 まで）と よろい戸が 重ならないよう、まどを すこし 細くして 外へ よせる
    schoolWindow(solid, glow, sx * 1.13, 1.38, 1.3, 0, 0.38, 0.62, { flowers: true, seed: seed++ });
    schoolWindow(solid, glow, sx * 2.07, 1.38, 1.3, 0, 0.38, 0.62, { flowers: true, seed: seed++ });
    for (const z of [-0.5, 0.5]) schoolWindow(solid, glow, sx * 2.6, 1.38, z * sx, sx * Math.PI / 2, 0.42, 0.62, { seed: seed++ });
    schoolWindow(solid, glow, sx * 0.9, 1.38, -1.3, Math.PI, 0.42, 0.62, { seed: seed++ });
    schoolWindow(solid, glow, sx * 1.9, 1.38, -1.3, Math.PI, 0.42, 0.62, { seed: seed++ });
  }
  // 旗
  g.add(cyl(0.03, 0.03, 1.8, 0x8a8a8a, 3.1, 0.9, 1.5, 6), ball(0.07, 0xffd45c, 3.1, 1.84, 1.5));
  const flag = new THREE.Group();
  flag.position.set(3.1, 1.55, 1.5);
  flag.add(box(0.8, 0.45, 0.03, 0xff7a7a, 0.4, 0, 0));
  const star = new THREE.Mesh(new THREE.CircleGeometry(0.11, 5), mat(0xfff2b0, { side: THREE.DoubleSide }));
  star.position.set(0.38, 0, 0.02);
  flag.add(star);
  g.add(flag);
  bush(solid, -2.9, 1.7, 1.1); bush(solid, 2.4, 1.85, 1.0); bush(solid, -1.6, 1.9, 0.8);
  g.add(solid.mesh(), glow.mesh(true));
  g.userData.update = (t) => {
    flag.rotation.y = Math.sin(t * 3) * 0.25;
    bells.forEach((b, i) => { b.rotation.z = Math.sin(t * 1.6 + i * 0.4) * 0.12; });
  };
  return g;
}
