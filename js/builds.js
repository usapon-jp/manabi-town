// 子どもが作ったもの（みち・うえた花・かこんだ花だん）を、保存された「操作」の並びから画面に出す。
// editor.js が操作をためて、ここが見た目にする。取り消しは「操作を1つ減らして、はじめから出しなおす」だけ。
import * as THREE from 'three';
import { Bag, GEO, rboxGeo, seeded } from './townkit.js';
import { createPlantLayer, stampItems, LAYER_CAP } from './plants.js';
import { heightAt } from './terrain.js';

const { CYL } = GEO;
export const STAMP_STEP = 0.5;      // 花をうえるときの、スタンプのきょり
export const LOOP_MIN = 3;          // かこみに必要なさいていの長さ（m）

// 点の並び（x,z,x,z,…）を、おなじ間隔になるよう並べなおす（とじた形として）
export function resampleLoop(pts, spacing) {
  const P = [];
  for (let i = 0; i < pts.length; i += 2) P.push([pts[i], pts[i + 1]]);
  P.push(P[0]);
  const out = [];
  let carry = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i]; const [bx, bz] = P[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (!len) continue;
    const tx = (bx - ax) / len; const tz = (bz - az) / len;
    let d = carry;
    while (d < len) { out.push({ x: ax + tx * d, z: az + tz * d, tx, tz }); d += spacing; }
    carry = d - len;
  }
  return out;
}

export function loopLength(pts) {
  let L = 0;
  for (let i = 2; i < pts.length; i += 2) L += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  if (pts.length >= 4) L += Math.hypot(pts[0] - pts[pts.length - 2], pts[1] - pts[pts.length - 1]);
  return L;
}

// かこみ: 丸太か石を、なぞった形にそってならべる
function buildRing(op) {
  const b = new Bag();
  const rnd = seeded(op.seed || 1);
  const log = op.k === 'log';
  const pieces = resampleLoop(op.pts, log ? 0.36 : 0.46);
  for (const p of pieces) {
    const y0 = heightAt(p.x, p.z);
    if (log) {
      const h = 0.34 + rnd() * 0.14;
      b.add(CYL, rnd() < 0.5 ? 0xd9a46a : 0xcf9a5e, { x: p.x, y: y0 + h / 2 - 0.04, z: p.z, sx: 0.16, sy: h, sz: 0.16 });
      b.add(CYL, 0xefc58c, { x: p.x, y: y0 + h - 0.035, z: p.z, sx: 0.13, sy: 0.02, sz: 0.13 });
      b.add(CYL, 0xc58c52, { x: p.x, y: y0 + h - 0.024, z: p.z, sx: 0.065, sy: 0.012, sz: 0.065 });
    } else {
      const sc = 0.9 + rnd() * 0.3;
      b.add(rboxGeo(0.46, 0.24, 0.32, 0.1), rnd() < 0.5 ? 0xe6d6b8 : 0xdccaa6, {
        x: p.x, y: y0 + 0.1 * sc, z: p.z, sx: sc, sy: sc, sz: sc, ry: Math.atan2(-p.tz, p.tx),
      });
    }
  }
  return b.mesh();
}

export function createBuilds({ scene, wind, cut }) {
  const layer = createPlantLayer(wind);
  scene.add(layer.group);
  const rings = new THREE.Group();
  scene.add(rings);

  function disposeRings() {
    rings.children.forEach((m) => m.geometry?.dispose());
    rings.clear();
  }

  // 1つの操作を足す（plant の途中経過は editor が addStamp で足す）
  function apply(op) {
    if (op.t === 'path') cut.stroke(op.pts, op.r);
    else if (op.t === 'dig') cut.stroke(op.pts, op.r, 'b');
    else if (op.t === 'seed') cut.stroke(op.pts, op.r, 'e');
    else if (op.t === 'pond') cut.pond(op.pts);
    else if (op.t === 'plant') for (let i = 0; i < op.pts.length / 2; i++) stampItems(op.s, op.pts[i * 2], op.pts[i * 2 + 1], op.seed, i).forEach(layer.add);
    else if (op.t === 'ring') { rings.add(buildRing(op)); cut.fill(op.pts); }
  }

  return {
    // 保存された操作ぜんぶから、はじめから作りなおす
    rebuild(ops) {
      cut.clear(); layer.clear(); disposeRings();
      for (const op of ops) if (op.t === 'dig' || op.t === 'pond') apply(op);   // 高さが決まってから、花やかこみを置く
      for (const op of ops) if (op.t !== 'dig' && op.t !== 'pond') apply(op);
    },
    apply,
    addStamp(species, x, z, seed, index) { stampItems(species, x, z, seed, index).forEach(layer.add); },
    // その種類にまだ入れるか
    room(species, extra = 3) { return layer.count(species) + extra <= LAYER_CAP; },
  };
}
