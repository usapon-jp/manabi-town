// 試作: 「手作り」の 質感（フェルト・木目）。テクスチャは キャンバスで 作る 256px 1まいずつ（軽い）。
// UV を 使わず、世界の 座標で 3方向から 貼る（Bag で まとめた メッシュにも そのまま 使える）。
import * as THREE from 'three';

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let felt = null; let wood = null;
export function feltTex() {
  if (felt) return felt;
  seed = 7;
  felt = canvasTex(256, (g, s) => {
    g.fillStyle = '#dedede'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 7000; i++) {     // 短い 毛羽
      const x = rnd() * s; const y = rnd() * s; const a = rnd() * Math.PI * 2; const l = 2 + rnd() * 6;
      const v = 165 + Math.floor(rnd() * 90);
      g.strokeStyle = `rgba(${v},${v},${v},0.6)`; g.lineWidth = 0.6 + rnd() * 0.7;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a + 1) * l * 0.5, y + Math.sin(a + 1) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
  });
  return felt;
}
export function woodTex() {
  if (wood) return wood;
  seed = 11;
  wood = canvasTex(256, (g, s) => {
    for (let x = 0; x < s; x++) {
      const v = 0.5 + 0.5 * Math.sin(x * 0.22 + Math.sin(x * 0.05) * 3);
      const c = Math.floor(205 + v * 40); g.fillStyle = `rgb(${c},${c},${c})`; g.fillRect(x, 0, 1, s);
    }
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = 'rgba(150,150,150,0.25)'; g.lineWidth = 1; const x = rnd() * s;
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6, s * 0.3, x - 6, s * 0.6, x, s); g.stroke();
    }
  });
  return wood;
}

// Bag の メッシュ（頂点の 色）に 質感を のせた 材質。fuzz = ふちが ふんわり 明るく なる 強さ（フェルトの 毛羽）
export function texturedMat(tex, scale, { fuzz = 0, vertexColors = true, color = 0xffffff } = {}) {
  const m = new THREE.MeshLambertMaterial({ vertexColors, color, emissive: 0x2e2a24 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tTex = { value: tex }; sh.uniforms.tScale = { value: scale };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTw; varying vec3 vTn;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvTw = (modelMatrix * vec4(transformed, 1.0)).xyz; vTn = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTw; varying vec3 vTn; uniform sampler2D tTex; uniform float tScale;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 bw = pow(abs(vTn), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
        vec3 tx = texture2D(tTex, vTw.zy * tScale).rgb * bw.x + texture2D(tTex, vTw.xz * tScale).rgb * bw.y + texture2D(tTex, vTw.xy * tScale).rgb * bw.z;
        diffuseColor.rgb *= tx * 1.1;`)
      .replace('#include <opaque_fragment>', `outgoingLight += diffuseColor.rgb * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.5) * ${fuzz.toFixed(2)};
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `lab-tex-${tex.id}-${fuzz}`;
  return m;
}
