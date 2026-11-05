// 子どもが作ったもの（みち・うえた花・かこんだ花だん）を、保存された「操作」の並びから画面に出す。
// editor.js が操作をためて、ここが見た目にする。取り消しは「操作を1つ減らして、はじめから出しなおす」だけ。
import * as THREE from 'three';
import { Bag, GEO, rboxGeo, seeded } from './townkit.js';
import { createPlantLayer, stampItems, LAYER_CAP } from './plants.js';
import { heightAt } from './terrain.js';
import { buildFence, buildBridge, registerDeck, clearDecks } from './structures.js';
import { buildPiece } from './pieces.js';

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

// 保存した操作を、前から順に重ねて「いまの形」にする。
//   place   … おきものを置く（最初の場所を ox,oz として覚える。あとの操作は ox,oz で呼ぶ）
//   parts   … 家のパーツの付けかえ {hx,hz(=ox,oz), socket, part|flower}
//   pmove   … おきものを動かす・しまう {hx,hz, x?, z?, rot?, stored?}
//   town    … 町の建物（レベルで出る）を動かす・しまう {id, x?, z?, rot?, stored?}
// 「もどす」は最後の操作をすてるだけで、前の形にもどる。
export function foldAll(ops) {
  const places = [];
  const out = [];
  const town = new Map();
  for (const op of ops) {
    if (op.t === 'place') { const c = { ...op, ox: op.x, oz: op.z, parts: { ...(op.parts || {}) }, flowers: { ...(op.flowers || {}) }, stored: false }; places.push(c); out.push(c); continue; }
    if (op.t === 'parts' || op.t === 'pmove') {
      const h = places.find((x) => x.ox === op.hx && x.oz === op.hz);
      if (!h) continue;
      if (op.t === 'parts') {
        if ('part' in op) h.parts[op.socket] = op.part;       // null = はずす
        if ('flower' in op) h.flowers[op.socket] = op.flower; // 花箱の花（null = いろいろ）
      } else {
        if (op.x != null) { h.x = op.x; h.z = op.z; }
        if (op.rot != null) h.rot = op.rot;
        if ('stored' in op) h.stored = !!op.stored;
      }
      continue;
    }
    if (op.t === 'town') {
      const { t, id, ...rest } = op;
      town.set(id, { ...(town.get(id) || {}), ...rest });
      continue;
    }
    out.push(op);
  }
  return { eff: out.filter((o) => !(o.t === 'place' && o.stored)), stored: places.filter((x) => x.stored), town };
}
export const foldParts = (ops) => foldAll(ops).eff;

export function createBuilds({ scene, wind, cut, setWalls, setTown }) {
  const layer = createPlantLayer(wind);
  scene.add(layer.group);
  const rings = new THREE.Group();
  scene.add(rings);

  const structs = new THREE.Group();   // 柵・橋
  scene.add(structs);
  let walls = [];                      // 柵・橋のてすりの、まるい壁
  let updaters = [];                   // 毎フレーム動かすもの（レイズドベッドの花のゆれ）
  let batching = false;
  const flushWalls = () => { if (!batching) setWalls?.(walls); };

  function disposeRings() {
    rings.children.forEach((m) => m.geometry?.dispose());
    rings.clear();
    structs.traverse((o) => o.geometry?.dispose());
    structs.clear();
    walls = [];
    updaters = [];
    clearDecks();
  }

  // 1つの操作を足す（plant の途中経過は editor が addStamp で足す）
  function apply(op) {
    if (op.t === 'path') cut.stroke(op.pts, op.r);
    else if (op.t === 'dig') cut.digStroke(op.pts, op.r);
    else if (op.t === 'fill') cut.fillStroke(op.pts, op.r);
    else if (op.t === 'seed') cut.stroke(op.pts, op.r, 'e');
    else if (op.t === 'pond') cut.pond(op.pts);
    else if (op.t === 'plant') for (let i = 0; i < op.pts.length / 2; i++) stampItems(op.s, op.pts[i * 2], op.pts[i * 2 + 1], op.seed, i).forEach((it) => { if (cut.digAt(it.x, it.z) < 0.02) layer.add(it); });
    else if (op.t === 'ring') { rings.add(buildRing(op)); cut.fill(op.pts); }
    else if (op.t === 'fence') { const f = buildFence(op); structs.add(f.mesh); walls.push(...f.walls); flushWalls(); }
    else if (op.t === 'place') { const pc = buildPiece(op); if (pc) { structs.add(pc.mesh); walls.push(...pc.walls); if (pc.update) updaters.push((t) => pc.update(t)); flushWalls(); } }
    else if (op.t === 'bridge') { const b = buildBridge(op); structs.add(b.mesh); walls.push(...b.walls); registerDeck(b.deck); flushWalls(); }
  }

  return {
    // 保存された操作ぜんぶから、はじめから作りなおす
    rebuild(ops) {
      cut.clear(); layer.clear(); disposeRings();
      batching = true;
      const { eff, town } = foldAll(ops);
      setTown?.(town);
      for (const op of eff) if (op.t === 'dig' || op.t === 'pond' || op.t === 'fill') apply(op);   // 高さが決まってから、花やかこみを置く
      for (const op of eff) if (op.t !== 'dig' && op.t !== 'pond' && op.t !== 'fill') apply(op);
      batching = false;
      setWalls?.(walls);
      cut.updateWater();
    },
    apply,
    update(t) { for (const f of updaters) f(t); },
    addStamp(species, x, z, seed, index) { stampItems(species, x, z, seed, index).forEach((it) => { if (cut.digAt(it.x, it.z) < 0.02) layer.add(it); }); },
    // その種類にまだ入れるか
    room(species, extra = 3) { return layer.count(species) + extra <= LAYER_CAP; },
  };
}
