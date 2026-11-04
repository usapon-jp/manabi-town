// 置きもの。ひさし・レイズドベッド・丘の家（Sky の草の丘にある、まるい家のイメージ）。
// どれも「ここに置く」1回で1つ。形は小さなパーツを Bag でまとめて、1つのメッシュにする。
import * as THREE from 'three';
import { Bag, GEO, rboxGeo, seeded, blob, tulip, daisy, hyacinth, smallYellow, leafBlade } from './townkit.js';
import { heightAt } from './terrain.js';

const { CYL, SPH, BOX, HALF } = GEO;
const WOOD = [0xb98a55, 0xc59a63, 0xa9794a];
const SLATE = [0x6f7684, 0x7b8291, 0x626977, 0x858c9b];

// ---- ひさし（スカラップのこけら板。ふたつの木の柱でささえる） ----------------
function awning(op) {
  const rnd = seeded(op.seed || 5);
  const g = new THREE.Group();
  const b = new Bag();
  const W = 2.4; const D = 1.3; const H = 1.7; const tilt = 0.32;
  // 柱
  for (const sx of [-1, 1]) {
    b.add(CYL, WOOD[1], { x: sx * (W / 2 - 0.12), y: H / 2, z: -D / 2 + 0.1, sx: 0.07, sy: H, sz: 0.07 });
    b.add(CYL, WOOD[0], { x: sx * (W / 2 - 0.12), y: H / 2 - 0.15, z: D / 2 - 0.1, sx: 0.07, sy: H - 0.3, sz: 0.07 });
    // ななめの腕木
    b.add(CYL, 0x5a4636, { x: sx * (W / 2 - 0.12), y: H - 0.42, z: 0, sx: 0.035, sy: 0.7, sz: 0.035, rx: 0.9 });
  }
  // 屋根の板（ふちがぎざぎざに重なる）
  const rows = 7;
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const z = -D / 2 + 0.05 + t * D;
    const y = H - Math.sin(tilt) * t * D * 1.1 + 0.04;
    for (let c = 0; c < 12; c++) {
      const x = -W / 2 + 0.1 + (c + 0.5) * ((W - 0.2) / 12);
      b.add(rboxGeo(0.2, 0.035, 0.26, 0.012), SLATE[Math.floor(rnd() * SLATE.length)], { x, y, z, rx: 0.2 + tilt * 0.4 });
    }
  }
  // 手前のへりのかざり板（スカラップ）
  for (let c = 0; c < 12; c++) {
    const x = -W / 2 + 0.1 + (c + 0.5) * ((W - 0.2) / 12);
    b.add(SPH, SLATE[(c + 1) % SLATE.length], { x, y: H - Math.sin(tilt) * D * 1.1 - 0.02, z: D / 2 + 0.05, sx: 0.1, sy: 0.07, sz: 0.04 });
  }
  g.add(blob(1.7, 1.1, 0.22));
  g.add(b.mesh());
  return { mesh: g, walls: [{ dx: -W / 2 + 0.12, dz: -D / 2 + 0.1, r: 0.12 }, { dx: W / 2 - 0.12, dz: -D / 2 + 0.1, r: 0.12 }] };
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

// ---- 丘の家（草でおおわれたまるい丘に、まるい扉と窓。石のだんだん） ---------------
function hillHouse(op) {
  const rnd = seeded(op.seed || 3);
  const g = new THREE.Group();
  const b = new Bag(); const glow = new Bag();
  g.add(blob(3.9, 3.4, 0.3));
  const R = 2.5; const Hh = 1.7;
  // 石のだんだん（丘のすそ）
  for (let k = 0; k < 2; k++) {
    b.add(CYL, k ? 0x7f9aa0 : 0x6f8a92, { y: 0.1 + k * 0.17, sx: R + 0.55 - k * 0.2, sy: 0.2, sz: R * 0.9 + 0.5 - k * 0.2 });
  }
  // 丘（半球。草の色をまだらに）
  const dome = new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const col = dome.attributes.position.count;
  const colors = new Float32Array(col * 3);
  const c1 = new THREE.Color(0x77a456); const c2 = new THREE.Color(0x95bd62); const tmp = new THREE.Color();
  for (let i = 0; i < col; i++) {
    const x = dome.attributes.position.getX(i); const z = dome.attributes.position.getZ(i); const y = dome.attributes.position.getY(i);
    tmp.copy(c1).lerp(c2, 0.5 + 0.5 * Math.sin(x * 5.1 + z * 3.7) * 0.6 + y * 0.3);
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  dome.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mound = new THREE.Mesh(dome, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x2f4a22, emissiveIntensity: 0.3 }));
  mound.scale.set(R, Hh, R * 0.9);
  mound.position.y = 0.34;
  g.add(mound);
  // 玄関まわりの石の壁（丘の正面にはりついた、うす青い石）
  b.add(rboxGeo(2.1, 1.35, 0.5, 0.15), 0x8fb1b6, { x: 0, y: 0.34 + 0.65, z: R * 0.9 - 0.45 });
  // 石のめじ
  for (let k = 0; k < 7; k++) b.add(rboxGeo(0.62 + rnd() * 0.2, 0.2, 0.08, 0.03), [0x9bbcc0, 0x86a8ad, 0xa4c3c6][k % 3], { x: (rnd() - 0.5) * 1.5, y: 0.7 + (k % 4) * 0.28, z: R * 0.9 - 0.18 });
  // まるいとびら（くらい）と、まるい窓
  const zf = R * 0.9 - 0.18;
  glow.add(HALF, 0x1c2a33, { x: 0, y: 1.15, z: zf, sx: 0.46, sy: 0.46, sz: 0.04 });
  glow.add(BOX, 0x1c2a33, { x: 0, y: 0.76, z: zf, sx: 0.92, sy: 0.84, sz: 0.04 });
  b.add(new THREE.TorusGeometry(0.5, 0.06, 8, 24, Math.PI), 0x5f7f86, { x: 0, y: 1.15, z: zf + 0.03 });
  for (const sx of [-1, 1]) {
    const wx = sx * 1.9; const wz = R * 0.9 * 0.55 - 0.05; // 丘のよこがわに、まるい窓
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sx * 0.9);
    const wpos = new THREE.Vector3(sx * 1.55, 0.95, 1.5);
    b.add(new THREE.TorusGeometry(0.3, 0.07, 8, 24), 0x2b2f38, { x: wpos.x, y: wpos.y, z: wpos.z, q });
    glow.add(new THREE.CircleGeometry(0.27, 20), 0xffe39a, { x: wpos.x, y: wpos.y, z: wpos.z + 0.01, q });
    b.add(BOX, 0x2b2f38, { x: wpos.x, y: wpos.y, z: wpos.z + 0.02, sx: 0.05, sy: 0.56, sz: 0.03, q });
    b.add(BOX, 0x2b2f38, { x: wpos.x, y: wpos.y, z: wpos.z + 0.02, sx: 0.56, sy: 0.05, sz: 0.03, q });
    void wx; void wz;
  }
  // 玄関の石の段と、ぼんやり光る灯り
  for (let k = 0; k < 3; k++) b.add(CYL, [0xa4c3c6, 0x9bbcc0, 0x8fb1b6][k], { x: 0, y: 0.1 + k * 0.1, z: R * 0.9 + 0.4 - k * 0.22, sx: 0.8 - k * 0.12, sy: 0.12, sz: 0.5 });
  b.add(CYL, 0x2b2f38, { x: 1.2, y: 0.8, z: zf + 0.25, sx: 0.04, sy: 1.5, sz: 0.04 });
  glow.add(SPH, 0xffe39a, { x: 1.2, y: 1.6, z: zf + 0.25, s: 0.1 });
  // 丘の上の草花
  const f = new Bag();
  for (let i = 0; i < 12; i++) {
    const a = rnd() * Math.PI * 2; const r = Math.sqrt(rnd()) * R * 0.7;
    const x = Math.cos(a) * r; const z = Math.sin(a) * r * 0.9;
    const yy = 0.34 + Hh * Math.sqrt(Math.max(0, 1 - (x * x) / (R * R) - (z * z) / ((R * 0.9) ** 2))) - 0.03;
    if (i % 2) daisy(f, x, z, 0.1, yy, 0.9); else smallYellow(f, x, z, 0.1, yy);
  }
  g.add(b.mesh(), glow.mesh(true), f.mesh());
  return { mesh: g, walls: [{ dx: 0, dz: -0.2, r: 2.0 }, { dx: -1.5, dz: 0.2, r: 1.0 }, { dx: 1.5, dz: 0.2, r: 1.0 }] };
}

export const PIECES = {
  'piece:awning': awning,
  'piece:raisedbed': raisedBed,
  'piece:hill': hillHouse,
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
