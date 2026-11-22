// 試作: お花畑に「花が たくさん の ところ」と「短い 草だけ の ところ」を つくる（2026-11-20 フミオさん）。
// meadow.js は さわらず、できあがった 草花の 置き方（userData.orig）を あとから ならべ直す。
//   - 花（デイジー・plants.js の 花）は ぜんぶ 大きさ fs 倍（ふつう 2/3）
//   - 短い 草の ところに あった 花は、花の ところへ 引っこし（数は そのまま → 花の ところは こく なる）
//   - 草は 短い ところで 背を 低く、花の ところで そのまま
import * as THREE from 'three';
import { heightAt } from '../js/terrain.js';

const R = 26;
// なめらかな ノイズ（0〜1）。ハッシュの 格子を なめらかに つなぐ
function hash(ix, iz) { let h = (ix * 374761393 + iz * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, z) {
  const ix = Math.floor(x); const iz = Math.floor(z); const fx = x - ix; const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx); const sz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz); const b = hash(ix + 1, iz); const c = hash(ix, iz + 1); const d = hash(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// keepShort(x, z) → 0〜1。1 なら かならず 短い 草（家の まえ・女の子の まわり など）
export function zoneMeadow(scene, { zones = true, fs = 2 / 3, gs = 1, more = 0, avoid = () => false, share = 0.28, size = 4, keepShort = () => 0, beds = [] } = {}) {
  // beds: [{x, z, r}] 見せたい 場所に 置く 花の かたまり
  const field = (x, z) => {
    const n = vnoise(x / size + 11.3, z / size + 4.7) * 0.7 + vnoise(x / (size * 0.45) + 2.1, z / (size * 0.45) + 9.4) * 0.3;
    let bed = 0;
    for (const b of beds) bed = Math.max(bed, 1 - Math.hypot(x - b.x, z - b.z) / b.r);
    return Math.max(n, bed > 0 ? 0.6 + bed * 0.4 : 0) * (1 - keepShort(x, z));
  };
  const cut = 1 - share;                         // これより 上が 花の ところ
  // zones = false: 置き方は そのまま、花の 大きさ だけ かえる（2026-11-20 フミオさん「まえのが いい、サイズは 小さく」）
  const isFlower = (x, z) => !zones || field(x, z) > cut + 0.03;
  const grassH = (x, z) => 0.35 + 0.55 * smooth(cut - 0.06, cut + 0.06, field(x, z));

  // 花の ところの 場所を 前もって たくさん 用意（引っこし先）
  const spots = [];
  for (let i = 0; zones && spots.length < 6000 && i < 200000; i++) {
    const a = Math.random() * Math.PI * 2; const r = Math.sqrt(Math.random()) * (R - 1);
    const x = Math.cos(a) * r; const z = Math.sin(a) * r;
    if (field(x, z) > cut + 0.06 || (isFlower(x, z) && Math.random() < 0.4)) spots.push([x, z]);   // まん中ほど こく
  }

  const meshes = [];
  scene.traverse((o) => { if (o.isInstancedMesh && o.userData.orig) meshes.push(o); });
  const grass = meshes.filter((m) => m.count >= 20000);
  // 花は 茎と 花びらが 同じ 置き方を わけあう → 親と 数で 組に する
  const groups = new Map();
  for (const m of meshes) {
    if (grass.includes(m)) continue;
    const k = `${m.parent.uuid}:${m.count}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  }

  const M = new THREE.Matrix4(); const p = new THREE.Vector3(); const q = new THREE.Quaternion(); const s = new THREE.Vector3();
  let moved = 0; let flowers = 0;
  for (const set of groups.values()) {
    const o = set[0].userData.orig;
    for (let i = 0; i < o.length; i += 16) {
      M.fromArray(o, i); M.decompose(p, q, s);
      flowers++;
      if (!isFlower(p.x, p.z) && spots.length) {
        const [x, z] = spots[Math.floor(Math.random() * spots.length)];
        p.set(x + (Math.random() - 0.5) * 0.3, heightAt(x, z) - 0.02, z + (Math.random() - 0.5) * 0.3);
        moved++;
      }
      s.multiplyScalar(fs);
      M.compose(p, q, s);
      for (const m of set) { M.toArray(m.userData.orig, i); M.toArray(m.instanceMatrix.array, i); m.instanceMatrix.needsUpdate = true; }
    }
  }
  // more: 花を ふやす 割合（1 = 2倍）。同じ 形・材質の 入れ物を もう1つ 作り、もとの 花の そばに ずらして 置く。
  // 小さく した ぶん 見える 面積が へるので、数で おぎなう（avoid の ところには 置かない）
  if (more > 0) {
    const spin = new THREE.Quaternion(); const UP = new THREE.Vector3(0, 1, 0);
    for (const set of groups.values()) {
      const o = set[0].userData.orig; const n = o.length / 16; const add = Math.floor(n * more);
      const arr = new Float32Array(add * 16);
      for (let j = 0; j < add; j++) {
        M.fromArray(o, Math.floor(Math.random() * n) * 16); M.decompose(p, q, s);
        let x; let z; let tries = 0;
        do { const a = Math.random() * Math.PI * 2; const r = 0.25 + Math.random() * 0.9; x = p.x + Math.cos(a) * r; z = p.z + Math.sin(a) * r; tries++; }
        while ((avoid(x, z) || Math.hypot(x, z) > R) && tries < 6);
        if (avoid(x, z)) { s.set(0, 0, 0); }
        p.set(x, heightAt(x, z) - 0.02, z);
        q.premultiply(spin.setFromAxisAngle(UP, Math.random() * Math.PI * 2));
        s.multiplyScalar(0.85 + Math.random() * 0.3);
        M.compose(p, q, s); M.toArray(arr, j * 16);
      }
      for (const m of set) {
        const c = new THREE.InstancedMesh(m.geometry, m.material, add);
        c.frustumCulled = false; c.instanceMatrix.array.set(arr); c.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) {
          for (let j = 0; j < add; j++) { const src = Math.floor(Math.random() * n); c.setColorAt(j, new THREE.Color().fromArray(m.instanceColor.array, src * 3)); }
        }
        m.parent.add(c);
      }
    }
  }
  for (const m of zones || gs !== 1 ? grass : []) {
    const o = m.userData.orig;
    for (let i = 0; i < o.length; i += 16) {
      const k = (zones ? grassH(o[i + 12], o[i + 14]) : 1) * gs;   // gs = 草ぜんたいの 背
      o[i + 4] *= k; o[i + 5] *= k; o[i + 6] *= k;      // 縦の 列だけ ちぢめる
      for (let j = 4; j < 7; j++) m.instanceMatrix.array[i + j] = o[i + j];
    }
    m.instanceMatrix.needsUpdate = true;
  }
  return { moved, flowers, isFlower };
}
