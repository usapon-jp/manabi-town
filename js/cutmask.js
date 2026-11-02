// 「草をかった場所」の地図。見えない大きな白黒の絵（白＝かった所）で持つ。
// 草・花は、白い所では短くなる（かりあと）。地面は、白い所だけ土の道の色になる。
// 方眼ではなく、指でなぞったとおりの自由な形がそのまま出る。
import * as THREE from 'three';

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

  function stamp(x, z, r) {
    const px = toPx(x); const py = toPx(z); const pr = (r / (2 * CUT_R)) * N;
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, '#fff'); g.addColorStop(0.72, '#fff'); g.addColorStop(1, '#000');
    ctx.fillStyle = g;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }

  return {
    uniforms: { uCut: { value: tex }, uCutR: { value: CUT_R } },
    // pts = [x0,z0,x1,z1,...] をつないで、半径 r の筆でなぞる
    stroke(pts, r) {
      let lx = pts[0]; let lz = pts[1];
      stamp(lx, lz, r);
      for (let i = 2; i < pts.length; i += 2) {
        const x = pts[i]; const z = pts[i + 1];
        const d = Math.hypot(x - lx, z - lz);
        const n = Math.max(1, Math.ceil(d / (r * 0.3)));
        for (let k = 1; k <= n; k++) stamp(lx + ((x - lx) * k) / n, lz + ((z - lz) * k) / n, r);
        lx = x; lz = z;
      }
      tex.needsUpdate = true;
    },
    clear() {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, N, N);
      ctx.globalCompositeOperation = 'lighten';
      tex.needsUpdate = true;
    },
  };
}
