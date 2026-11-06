// うさぽん村（ハロウィン村 usapon-machi/2026）から持ってきた小物のモデル。
// データは assets/models/<名前>.json（うさぽん村の PROPS と同じ形: 16bit の位置・uv・index・512px の色の絵）。
// 読みこみは1回だけ。置いたときにまだなら、読めたあとで中身が入る。
import * as THREE from 'three';

const cache = {};
function load(name) {
  if (!cache[name]) {
    cache[name] = fetch(new URL(`../assets/models/${name}.json`, import.meta.url)).then((r) => r.json()).then((d) => {
      const b64 = (s, T) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
      const q = b64(d.p, Uint16Array); const n = d.n; const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) pos[i * 3 + a] = d.mn[a] + (q[i * 3 + a] / 65535) * (d.mx[a] - d.mn[a]);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(b64(d.u, Float32Array), 2));
      g.setIndex(new THREE.BufferAttribute(b64(d.i, Uint16Array), 1));
      g.computeVertexNormals();
      g.translate(-(d.mx[0] + d.mn[0]) / 2, -d.mn[1], -(d.mx[2] + d.mn[2]) / 2);   // 原点 = 足もとのまん中
      const tex = new THREE.Texture(); tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace;
      const im = new Image(); im.onload = () => { tex.image = im; tex.needsUpdate = true; }; im.src = `data:image/jpeg;base64,${d.t}`;
      const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0x333333, emissiveMap: tex, side: THREE.DoubleSide });
      return { g, mat, h: d.mx[1] - d.mn[1] };
    });
  }
  return cache[name];
}
export const propReady = (name) => load(name);

// 高さ h(m) の小物を1つ。すぐ空の Group を返し、読めたら中に入れる
export function prop(name, h) {
  const grp = new THREE.Group();
  load(name).then((P) => { const m = new THREE.Mesh(P.g, P.mat); m.scale.setScalar(h / P.h); grp.add(m); grp.userData.loaded = true; }).catch(() => {});
  return grp;
}
