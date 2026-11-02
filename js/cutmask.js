// 「草をかった場所」の地図。見えない大きな絵で持つ（赤＝みち、緑＝花だんの土、青＝ほった所）。
// 草・花は、白い所では短くなる（かりあと）。地面は、白い所だけ土の道の色になる。
// 方眼ではなく、指でなぞったとおりの自由な形がそのまま出る。
import * as THREE from 'three';

export const DIG_DEPTH = 0.34;   // いちばん深い所の深さ（m）
export const CUT_R = 32;      // 地図がおおうはんい（中心から）
const N = 256;                // 地図の細かさ（約0.25m）

export function createCutMask() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, N, N);
  ctx.globalCompositeOperation = 'lighten'; // 重ねても、いちばん白い所が残る
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const toPx = (v) => ((v + CUT_R) / (2 * CUT_R)) * N;
  // ほった深さ（0〜1）。見た目は地図の青をシェーダーが読むが、ピヨや花の高さのために、こちら側でも同じものを持つ
  const dig = new Float32Array(N * N);
  const DIG_COLOR = { r: '#f00', b: '#00f' };

  function stamp(x, z, r, ch = 'r') {
    const px = toPx(x); const py = toPx(z); const pr = (r / (2 * CUT_R)) * N;
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, DIG_COLOR[ch]); g.addColorStop(0.72, DIG_COLOR[ch]); g.addColorStop(1, '#000');
    ctx.fillStyle = g;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    if (ch === 'b') {
      const x0 = Math.max(0, Math.floor(px - pr)); const x1 = Math.min(N - 1, Math.ceil(px + pr));
      const y0 = Math.max(0, Math.floor(py - pr)); const y1 = Math.min(N - 1, Math.ceil(py + pr));
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          const d = Math.hypot(xx + 0.5 - px, yy + 0.5 - py) / pr;
          if (d >= 1) continue;
          const f = d <= 0.72 ? 1 : 1 - (d - 0.72) / 0.28;
          const i = yy * N + xx;
          if (f > dig[i]) dig[i] = f;
        }
      }
    }
  }
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const inside = (poly, x, z) => {
    let c = false;
    for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
      const xi = poly[i]; const zi = poly[i + 1]; const xj = poly[j]; const zj = poly[j + 1];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
    }
    return c;
  };

  return {
    uniforms: { uCut: { value: tex }, uCutR: { value: CUT_R } },
    // pts = [x0,z0,x1,z1,...] をつないで、半径 r の筆でなぞる
    stroke(pts, r, ch = 'r') {
      let lx = pts[0]; let lz = pts[1];
      stamp(lx, lz, r, ch);
      for (let i = 2; i < pts.length; i += 2) {
        const x = pts[i]; const z = pts[i + 1];
        const d = Math.hypot(x - lx, z - lz);
        const n = Math.max(1, Math.ceil(d / (r * 0.3)));
        for (let k = 1; k <= n; k++) stamp(lx + ((x - lx) * k) / n, lz + ((z - lz) * k) / n, r, ch);
        lx = x; lz = z;
      }
      tex.needsUpdate = true;
    },
    // 花だんの中（とじた形）を土にする
    fill(pts) {
      if (pts.length < 6) return;
      ctx.fillStyle = '#0f0'; ctx.strokeStyle = '#0f0'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(toPx(pts[0]), toPx(pts[1]));
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(toPx(pts[i]), toPx(pts[i + 1]));
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      tex.needsUpdate = true;
    },
    // いけ: とじた形の中をほる（ふちはなだらかに）
    pond(pts) {
      if (pts.length < 6) return;
      ctx.fillStyle = '#00f'; ctx.beginPath();
      ctx.moveTo(toPx(pts[0]), toPx(pts[1]));
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(toPx(pts[i]), toPx(pts[i + 1]));
      ctx.closePath(); ctx.fill();
      let minX = 1e9; let maxX = -1e9; let minZ = 1e9; let maxZ = -1e9;
      for (let i = 0; i < pts.length; i += 2) { minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]); minZ = Math.min(minZ, pts[i + 1]); maxZ = Math.max(maxZ, pts[i + 1]); }
      const px0 = Math.max(0, Math.floor(toPx(minX))); const px1 = Math.min(N - 1, Math.ceil(toPx(maxX)));
      const py0 = Math.max(0, Math.floor(toPx(minZ))); const py1 = Math.min(N - 1, Math.ceil(toPx(maxZ)));
      const w = (2 * CUT_R) / N;
      for (let yy = py0; yy <= py1; yy++) for (let xx = px0; xx <= px1; xx++) {
        if (inside(pts, -CUT_R + (xx + 0.5) * w, -CUT_R + (yy + 0.5) * w)) dig[yy * N + xx] = 1;
      }
      // ふちをなだらかに（外がわへむけて浅くなる）
      const loop = pts.concat([pts[0], pts[1]]);
      this.stroke(loop, 1.5, 'b');
      tex.needsUpdate = true;
    },
    // ほった深さ（m）。ピヨや花の高さをそろえるのに使う
    digAt(x, z) {
      const xx = Math.floor(toPx(x)); const yy = Math.floor(toPx(z));
      if (xx < 0 || yy < 0 || xx >= N || yy >= N) return 0;
      return DIG_DEPTH * sstep(0.15, 0.85, dig[yy * N + xx]);
    },
    clear() {
      dig.fill(0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, N, N);
      ctx.globalCompositeOperation = 'lighten';
      tex.needsUpdate = true;
    },
  };
}
