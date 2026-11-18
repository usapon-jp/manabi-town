// 絵本の 木（ふわふわの 葉っぱの かたまり・さくら）。meadow.js が 草原の まわりに 植える。
// 1本 = 1メッシュ（みき・えだ・葉を ひとつに まとめて、色は 頂点の 色）。スマホでも 軽い。
// - 葉: でこぼこした まるい かたまりを いくつか 重ねる。上は 明るい 黄緑、下と 内がわは こい 緑（光と かげが 絵の具で ぬったように）
// - さくら: 同じ 形で もも色。ときどき 白っぽい 花の つぶ
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const PAL = {
  green: { top: [0.74, 0.86, 0.38], mid: [0.42, 0.68, 0.28], low: [0.2, 0.42, 0.2], dot: null },
  deep: { top: [0.6, 0.8, 0.34], mid: [0.32, 0.58, 0.26], low: [0.14, 0.34, 0.18], dot: null },
  cherry: { top: [1.0, 0.82, 0.88], mid: [1.0, 0.6, 0.74], low: [0.86, 0.4, 0.56], dot: [1.0, 0.94, 0.96] },
};
const BARK = { light: [0.62, 0.44, 0.3], dark: [0.36, 0.24, 0.17] };

// かんたんな なめらかノイズ（-1〜1）
const n3 = (x, y, z) => (Math.sin(x * 1.7 + Math.sin(z * 1.3) * 1.4) * Math.sin(y * 1.9 + Math.sin(x * 1.1)) * Math.sin(z * 1.5 + Math.sin(y * 1.2) * 1.3));

function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// 葉の かたまり ひとつ
function puff(cx, cy, cz, r, rnd, canopy, pal) {
  // 正二十面体は 頂点が 面ごとに ばらばら なので、つなげて なめらかな 法線に する
  let g = new THREE.IcosahedronGeometry(r, 3);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const sx = rnd() * 10; const sy = rnd() * 10;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const nx = v.x / r; const ny = v.y / r; const nz = v.z / r;
    // でこぼこ（小さな もこもこが たくさん）
    const bump = 1 + 0.13 * n3(nx * 2.6 + sx, ny * 2.6 + sy, nz * 2.6) + 0.04 * n3(nx * 5.3 + sy, ny * 5.1, nz * 5.7 + sx);
    v.multiplyScalar(bump);
    v.y *= 0.86;
    pos.setXYZ(i, v.x + cx, v.y + cy, v.z + cz);
    // 色: 木ぜんたいの 高さ（上ほど 明るい）× 面の 向き（上むき・外むきが 明るい）× 内がわは こい
    const wy = (v.y + cy - canopy.y0) / (canopy.y1 - canopy.y0);
    const out = Math.hypot(v.x + cx - canopy.cx, v.z + cz - canopy.cz) / canopy.r;
    let t = clamp01(0.15 + 0.5 * wy + 0.35 * ny + 0.15 * out);
    t = t * t * (3 - 2 * t);
    let c = t < 0.5 ? mix(pal.low, pal.mid, t * 2) : mix(pal.mid, pal.top, (t - 0.5) * 2);
    // 絵の具の むら
    const w = 0.94 + 0.08 * n3(v.x * 3 + 7, v.y * 3, v.z * 3);
    c = [c[0] * w, c[1] * w, c[2] * w];
    if (pal.dot && ny > -0.2) c = mix(c, pal.dot, 0.55 * Math.max(0, n3(v.x * 9 + 3, v.y * 9, v.z * 9 + 1) - 0.35));
    col.set(c, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// みき・えだ（少し まがった 円柱）
function limb(x0, y0, z0, x1, y1, z1, r0, r1, bend = 0) {
  const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
  const g = new THREE.CylinderGeometry(r1, r0, len, 7, 4, true);
  g.translate(0, len / 2, 0);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / len;
    pos.setX(i, pos.getX(i) + Math.sin(y * Math.PI) * bend);
    // 根もとは すこし ひろがる
    if (y < 0.12) { const k = 1 + (0.12 - y) * 3.2; pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); }
    const ang = Math.atan2(pos.getZ(i), pos.getX(i));
    const stripe = 0.5 + 0.5 * Math.sin(ang * 5 + y * 3);
    const c = mix(BARK.dark, BARK.light, clamp01(0.35 + 0.45 * y + 0.2 * stripe));
    col.set(c, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dir = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  g.translate(x0, y0, z0);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

let sharedMat = null;
export function treeMaterial() {
  if (!sharedMat) {
    sharedMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    // 日かげでも 色が くすまない ように、葉の 色で ほんのり 光らせる（逆光の さくらが 灰色に ならない）
    sharedMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vColor * 0.22;');
    };
  }
  return sharedMat;
}

// kind: 'green' | 'deep' | 'cherry'。size: 1 で 高さ 約4.5m
export function makeTree(kind = 'green', size = 1, seed = 1) {
  const rnd = mulberry(seed * 7919 + 13);
  const pal = PAL[kind] || PAL.green;
  const H = (1.7 + rnd() * 0.5) * size;          // みきの 高さ（葉の 下まで）
  const R = (1.25 + rnd() * 0.3) * size;         // 葉の ひろがり
  const lean = (rnd() - 0.5) * 0.25 * size;
  const parts = [limb(0, 0, 0, lean, H + R * 0.5, 0, 0.2 * size, 0.11 * size, 0.08 * size)];
  // えだ（葉の 中へ のびる）
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rnd();
    parts.push(limb(lean * 0.6, H * 0.8, 0, Math.cos(a) * R * 0.6, H + R * 0.35, Math.sin(a) * R * 0.6, 0.09 * size, 0.04 * size, 0.05 * size));
  }
  // 葉の かたまり: まんなかの 大きな 1つ + まわりに 4〜6つ + てっぺん
  const cy = H + R * 0.75;
  const canopy = { cx: lean, cz: 0, y0: H - R * 0.1, y1: cy + R * 1.05, r: R * 1.4 };
  parts.push(puff(lean, cy, 0, R, rnd, canopy, pal));
  const n = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.6;
    const rr = R * (0.55 + rnd() * 0.2);
    parts.push(puff(lean + Math.cos(a) * R * 0.78, cy - R * (0.15 + rnd() * 0.25), Math.sin(a) * R * 0.78, rr, rnd, canopy, pal));
  }
  parts.push(puff(lean + (rnd() - 0.5) * R * 0.3, cy + R * 0.62, (rnd() - 0.5) * R * 0.3, R * 0.62, rnd, canopy, pal));
  const geo = mergeGeometries(parts.map((g) => { if (g.attributes.uv) g.deleteAttribute('uv'); return g; }));
  const mesh = new THREE.Mesh(geo, treeMaterial());
  mesh.userData.canopy = { y: cy, r: R };
  return mesh;
}

// さくらの 花びらが ちらちら まう（木の まわり）。update(t) で うごく
export function petals(spots, count = 90) {
  const geo = new THREE.BufferGeometry();
  const base = new Float32Array(count * 4);
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const s = spots[i % spots.length];
    const a = Math.random() * Math.PI * 2; const r = Math.random() * s.r * 1.6;
    base.set([s.x + Math.cos(a) * r, s.z + Math.sin(a) * r, s.top, Math.random()], i * 4);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d');
  x.fillStyle = '#ffd3e0'; x.beginPath(); x.ellipse(16, 16, 13, 8, 0.5, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#fff0f4'; x.beginPath(); x.ellipse(13, 13, 6, 3, 0.5, 0, Math.PI * 2); x.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: tex, size: 0.14, transparent: true, alphaTest: 0.3, depthWrite: false }));
  pts.frustumCulled = false;
  pts.userData.update = (t) => {
    for (let i = 0; i < count; i++) {
      const bx = base[i * 4]; const bz = base[i * 4 + 1]; const top = base[i * 4 + 2]; const ph = base[i * 4 + 3];
      const k = (t * 0.06 + ph) % 1;
      pos[i * 3] = bx + Math.sin(t * 0.8 + ph * 20) * 0.4 + k * 1.2;
      pos[i * 3 + 1] = top * (1 - k);
      pos[i * 3 + 2] = bz + Math.cos(t * 0.6 + ph * 17) * 0.4;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}
