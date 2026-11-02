// 絵本のような草原の景色づくり: やわらかい空と雲海、風にゆれる草、咲きそろう花、ちょうちょ。
// world.js から createMeadow(scene) で呼ぶ。毎フレーム meadow.update(dt, t, actorPos) を呼ぶ。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heightAt } from './terrain.js';
import { isTownSpot } from './town.js';
import { makeWind, addWind } from './wind.js';
import { makePlants } from './plants.js';
import { createCutMask } from './cutmask.js';

export const SUN_DIR = new THREE.Vector3(0.5, 0.42, -0.75).normalize();
export const HORIZON = new THREE.Color(0xf6e9cf);

const MEADOW_R = 27;      // 草と花がはえるはんい
const GRASS_COUNT = 26000;
const FLOWER_COUNT = 3400;

// ---- 小さな道具 ---------------------------------------------------------

const rand = (a, b) => a + Math.random() * (b - a);
function gauss() {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(Math.PI * 2 * Math.random());
}
function inDisc(radius) {
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * radius;
  return [Math.cos(a) * r, Math.sin(a) * r];
}
// 街の建物の場所をよけた場所
function freeSpot(radius, pad = 0) {
  let p = inDisc(radius);
  // 街の場所はまばらに（まったくの空き地にはしない）
  for (let i = 0; i < 8 && isTownSpot(p[0], p[1], pad) && Math.random() < 0.8; i++) p = inDisc(radius);
  return p;
}
// ゆるいノイズ（0〜1）。草のむらや地面の色のゆらぎに使う
const noise = (x, z) => 0.5 + 0.25 * Math.sin(x * 0.21 + Math.sin(z * 0.17) * 2) + 0.25 * Math.sin(z * 0.13 - x * 0.09 + 1.3);

// やわらかい円のテクスチャ（光のつぶや雲に使う）
function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ふわふわの雲ひとつ分のテクスチャ（上はあたたかい白、下はうすい青灰色）
function cloudTexture(seed) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const x = c.getContext('2d');
  let s = seed * 9301 + 49297;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const puff = (cx, cy, rad, col, a) => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, `rgba(${col},${a})`);
    g.addColorStop(0.6, `rgba(${col},${a * 0.55})`);
    g.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = g; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  };
  for (let i = 0; i < 9; i++) puff(40 + r() * 176, 88 + r() * 16, 34 + r() * 22, '236,238,248', 0.85); // かげ
  for (let i = 0; i < 12; i++) puff(36 + r() * 184, 66 + r() * 26, 30 + r() * 24, '255,250,238', 1);  // ひなた
  for (let i = 0; i < 5; i++) puff(60 + r() * 136, 52 + r() * 14, 20 + r() * 14, '255,255,255', 0.9);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- 空 ------------------------------------------------------------------

function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: SUN_DIR }, uHorizon: { value: HORIZON } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      varying vec3 vDir; uniform vec3 uSun; uniform vec3 uHorizon;
      void main(){
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 mid = vec3(0.74, 0.88, 0.96);
        vec3 top = vec3(0.42, 0.68, 0.92);
        vec3 col = mix(uHorizon, mid, smoothstep(0.0, 0.14, h));
        col = mix(col, top, smoothstep(0.1, 0.6, h));
        float s = max(dot(normalize(vDir), uSun), 0.0);
        col += vec3(1.0, 0.82, 0.55) * pow(s, 6.0) * 0.28;   // ひろがる光
        col += vec3(1.0, 0.95, 0.8) * pow(s, 90.0) * 0.9;    // 太陽
        col = mix(col, uHorizon, smoothstep(0.0, -0.2, vDir.y)); // 地平線の下は霞
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(160, 32, 16), mat);
}

function makeClouds() {
  const group = new THREE.Group();
  const texes = [1, 2, 3, 4].map(cloudTexture);
  const add = (x, y, z, w, tex, opacity) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, depthWrite: false, fog: false }));
    sp.scale.set(w, w * 0.62, 1);
    sp.position.set(x, y, z);
    group.add(sp);
    return sp;
  };
  // 雲海（はしっこの下にひろがる）
  for (let i = 0; i < 130; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 36 + Math.pow(Math.random(), 0.8) * 90;
    add(Math.cos(a) * r, -3 - Math.random() * 6 - (r - 36) * 0.02, Math.sin(a) * r, 20 + Math.random() * 26, texes[i % 4], 0.97);
  }
  // 空にうかぶ雲
  const sky = [];
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 80 + Math.random() * 40;
    sky.push(add(Math.cos(a) * r, 22 + Math.random() * 28, Math.sin(a) * r, 34 + Math.random() * 30, texes[(i + 1) % 4], 0.85));
  }
  group.userData.update = (t) => sky.forEach((s, i) => { s.position.x += Math.sin(t * 0.05 + i) * 0.004; });
  return group;
}

// ---- 地面 ----------------------------------------------------------------

function makeGround(cut) {
  const geo = new THREE.RingGeometry(0.01, 46, 96, 42);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const a = new THREE.Color(0x77ad4d); const b = new THREE.Color(0xa6c85c); const c = new THREE.Color(0x5f9a49);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i); const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    const n = noise(x * 1.4, z * 1.4);
    tmp.copy(a).lerp(b, Math.max(0, n - 0.45) * 1.6).lerp(c, Math.max(0, 0.45 - n) * 1.2);
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  // かった場所（みち）は、土の色に。ふちは踏みかためたようにすこし暗く
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCut = cut.uniforms.uCut;
    shader.uniforms.uCutR = cut.uniforms.uCutR;
    shader.vertexShader = 'varying vec2 vXZ;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vXZ = position.xz;');
    shader.fragmentShader = 'varying vec2 vXZ;\nuniform sampler2D uCut;\nuniform float uCutR;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float pm = texture2D(uCut, (vXZ + uCutR) / (2.0 * uCutR)).r;
      float inner = smoothstep(0.42, 0.62, pm);
      float rim = smoothstep(0.28, 0.42, pm) * (1.0 - inner);
      float sp = 0.5 + 0.5 * sin(vXZ.x * 9.0) * sin(vXZ.y * 11.0);
      vec3 soil = vec3(0.79, 0.60, 0.31) * (0.93 + 0.07 * sp);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.8, rim);
      diffuseColor.rgb = mix(diffuseColor.rgb, soil, inner);
      float bm = texture2D(uCut, (vXZ + uCutR) / (2.0 * uCutR)).g;
      vec3 bedSoil = vec3(0.14, 0.075, 0.04) * (0.9 + 0.1 * sp);
      diffuseColor.rgb = mix(diffuseColor.rgb, bedSoil, smoothstep(0.4, 0.62, bm));`);
  };
  return new THREE.Mesh(geo, mat);
}

// ---- 草 ------------------------------------------------------------------

function makeGrass(wind) {
  const H = 0.5;
  const seg = 5;
  const geo = new THREE.PlaneGeometry(0.1, H, 1, seg);
  geo.translate(0, H / 2, 0);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = pos.getY(i) / H;
    pos.setX(i, pos.getX(i) * (1 - k * 0.92));
    pos.setZ(i, k * k * 0.14);                       // 先がおじぎしている
    const v = 0.45 + k * 0.7;                        // 根もとは濃く、先は明るく
    cols.set([v * 0.9, v, v * 0.8], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos.count * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  addWind(mat, wind, H, 0.2, 0.12);

  const mesh = new THREE.InstancedMesh(geo, mat, GRASS_COUNT);
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const s = new THREE.Vector3(); const p = new THREE.Vector3();
  const c = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < GRASS_COUNT; i++) {
    const [x, z] = freeSpot(MEADOW_R, -0.2);
    q.setFromAxisAngle(up, Math.random() * Math.PI * 2);
    const patch = noise(x * 0.7, z * 0.7);
    const k = (0.6 + patch * 0.5) * (0.65 + Math.random() * 0.6);
    s.set(0.8 + Math.random() * 0.8, k, 1);
    p.set(x, heightAt(x, z) - 0.02, z);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    c.setHSL(0.235 + patch * 0.06 + Math.random() * 0.03, 0.55 + Math.random() * 0.2, 0.42 + Math.random() * 0.1);
    mesh.setColorAt(i, c);
  }
  return mesh;
}

// ---- 花 ------------------------------------------------------------------

function flowerGeometries() {
  const STEM = 0.34;
  // 茎 + 花の中心（vertex color）
  const stem = new THREE.PlaneGeometry(0.018, STEM, 1, 3);
  stem.translate(0, STEM / 2, 0);
  const sp = stem.attributes.position;
  const sc = new Float32Array(sp.count * 3);
  for (let i = 0; i < sp.count; i++) {
    const k = sp.getY(i) / STEM;
    sp.setZ(i, k * k * 0.03);
    sc.set([0.28 + k * 0.1, 0.55 + k * 0.1, 0.2], i * 3);
  }
  stem.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  const leaf = new THREE.PlaneGeometry(0.1, 0.045, 1, 1);
  leaf.rotateZ(0.5); leaf.translate(0.045, 0.1, 0);
  leaf.setAttribute('color', new THREE.BufferAttribute(new Float32Array(12).fill(0).map((_, i) => [0.3, 0.62, 0.22][i % 3]), 3));
  const center = new THREE.IcosahedronGeometry(0.03, 0);
  center.scale(1, 0.6, 1); center.translate(0, STEM + 0.012, 0);
  const cc = new Float32Array(center.attributes.position.count * 3);
  for (let i = 0; i < cc.length; i += 3) { cc[i] = 1.0; cc[i + 1] = 0.78; cc[i + 2] = 0.2; }
  center.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  [stem, leaf, center].forEach((g) => g.deleteAttribute('uv'));
  const stemAll = mergeGeometries([stem, leaf, center].map((g) => (g.index ? g.toNonIndexed() : g)));
  const n = stemAll.attributes.position.count;
  stemAll.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));

  // 花びら（上むきにすこし開いたおわん形）
  const verts = [];
  const petals = 8;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    const dx = Math.cos(a); const dz = Math.sin(a);
    const px = -dz; const pz = dx;
    const y0 = STEM + 0.015; const yTip = STEM + 0.05;
    const inner = 0.025; const mid = 0.055; const tip = 0.095; const w = 0.027;
    const P = (r, side, y) => [dx * r + px * side, y, dz * r + pz * side];
    verts.push(...P(inner, 0, y0), ...P(mid, -w, y0 + 0.02), ...P(mid, w, y0 + 0.02));
    verts.push(...P(mid, -w, y0 + 0.02), ...P(tip, 0, yTip), ...P(mid, w, y0 + 0.02));
  }
  const petal = new THREE.BufferGeometry();
  petal.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  const pn = verts.length / 3;
  petal.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pn * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return { stem: stemAll, petal, STEM };
}

function makeFlowers(wind) {
  const { stem, petal, STEM } = flowerGeometries();
  const stemMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const petalMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  addWind(stemMat, wind, STEM + 0.05, 0.12);
  addWind(petalMat, wind, STEM + 0.05, 0.12);
  const stems = new THREE.InstancedMesh(stem, stemMat, FLOWER_COUNT);
  const heads = new THREE.InstancedMesh(petal, petalMat, FLOWER_COUNT);
  stems.frustumCulled = false; heads.frustumCulled = false;

  const palette = [
    [0xffffff, 0xfffaf0], [0xffffff, 0xf7f3e8], [0xfff3a6, 0xffe27a], [0xffb7cf, 0xff9dbd],
    [0xcdb4ff, 0xb497f5], [0xa9d4ff, 0x8fc2f5], [0xffc9a0, 0xffb07a],
  ];
  // 花のかたまり（ひとつの色が多め）。白いデイジーがいちばん多い
  const clusters = [];
  for (let i = 0; i < 46; i++) {
    const [x, z] = inDisc(MEADOW_R - 2);
    clusters.push({ x, z, r: rand(1.2, 3.8), pal: i % 3 === 0 ? palette[0] : palette[1 + Math.floor(Math.random() * 6)] });
  }
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler();
  const s = new THREE.Vector3(); const p = new THREE.Vector3(); const c = new THREE.Color();
  for (let i = 0; i < FLOWER_COUNT; i++) {
    let x; let z; let pal;
    if (Math.random() < 0.72) {
      const cl = clusters[Math.floor(Math.random() * clusters.length)];
      x = cl.x + gauss() * cl.r * 0.55; z = cl.z + gauss() * cl.r * 0.55; pal = cl.pal;
    } else {
      [x, z] = inDisc(MEADOW_R); pal = Math.random() < 0.6 ? palette[0] : palette[Math.floor(Math.random() * palette.length)];
    }
    if (Math.hypot(x, z) > MEADOW_R || isTownSpot(x, z, -0.2)) { x = rand(-3, 3); z = rand(-3, 3); pal = palette[0]; }
    e.set(rand(-0.25, 0.25), Math.random() * Math.PI * 2, rand(-0.25, 0.25));
    q.setFromEuler(e);
    const k = rand(0.8, 1.5);
    s.set(k, k * rand(0.85, 1.25), k);
    p.set(x, heightAt(x, z) - 0.02, z);
    m.compose(p, q, s);
    stems.setMatrixAt(i, m);
    heads.setMatrixAt(i, m);
    heads.setColorAt(i, c.set(pal[Math.random() < 0.7 ? 0 : 1]));
  }
  const g = new THREE.Group();
  g.add(stems, heads);
  return g;
}

// ---- 木 ------------------------------------------------------------------

function makeTrees() {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x9c7456 });
  const leafMats = [0x86c26c, 0x97cf74, 0x78b865, 0xa7d27a].map((color) => new THREE.MeshLambertMaterial({ color }));
  const trees = [];
  for (let i = 0; i < 14; i++) {
    let x; let z;
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2; const r = rand(16, 27);
      x = Math.cos(a) * r; z = Math.sin(a) * r;
      if (!isTownSpot(x, z, 2)) break;
    }
    const t = new THREE.Group();
    const h = rand(1.3, 2.2);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.24, h, 8), trunkMat);
    trunk.position.y = h / 2;
    t.add(trunk);
    const base = leafMats[i % 4];
    const sc = rand(0.9, 1.35);
    // まるい葉っぱのかたまりを3〜4こ重ねる（絵本のわたあめ風）
    [[0, 0.9, 0, 1.15], [0.7, 0.55, 0.2, 0.8], [-0.6, 0.6, -0.25, 0.85], [0.1, 1.55, -0.1, 0.75]].forEach(([dx, dy, dz, r]) => {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(r * sc, 14, 10), base);
      leaf.position.set(dx * sc, h + dy * sc, dz * sc);
      t.add(leaf);
    });
    t.position.set(x, heightAt(x, z), z);
    t.rotation.y = Math.random() * 6;
    trees.push(t);
  }
  return trees;
}

// ---- ただよう光とちょうちょ ---------------------------------------------

function makeMotes() {
  const count = 160;
  const base = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const [x, z] = inDisc(18);
    base.set([x, 0.4 + Math.random() * 4, z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xfff1c4, size: 0.22, map: softDot(), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  points.frustumCulled = false;
  points.userData.update = (t) => {
    const p = geo.attributes.position;
    for (let i = 0; i < count; i++) {
      p.setX(i, base[i * 3] + Math.sin(t * 0.3 + i) * 0.7);
      p.setY(i, base[i * 3 + 1] + Math.sin(t * 0.7 + i * 1.7) * 0.35);
      p.setZ(i, base[i * 3 + 2] + Math.cos(t * 0.25 + i * 0.7) * 0.5);
    }
    p.needsUpdate = true;
  };
  return points;
}

function makeButterflies() {
  const colors = [0xffffff, 0xfff0a0, 0xffb7cf, 0xa9d4ff, 0xffd08a, 0xffffff];
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0.16, 0.1, 0.03, 0.2, -0.04, 0.02, 0, 0, 0, 0.1, -0.1, 0.02, 0.2, -0.04, 0.02]), 3));
  wingGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(18).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  const group = new THREE.Group();
  const list = [];
  colors.forEach((color, i) => {
    const b = new THREE.Group();
    const m = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.25 });
    const l = new THREE.Mesh(wingGeo, m);
    const r = new THREE.Mesh(wingGeo, m);
    r.scale.x = -1;
    b.add(l, r);
    group.add(b);
    const [ax, az] = inDisc(15);
    list.push({ b, l, r, ax, az, ph: i * 1.7, sp: rand(0.25, 0.45), rad: rand(2.5, 5) });
  });
  group.userData.update = (t) => {
    for (const o of list) {
      const a = t * o.sp + o.ph;
      const x = o.ax + Math.cos(a) * o.rad + Math.sin(a * 2.3) * 0.8;
      const z = o.az + Math.sin(a * 1.2) * o.rad;
      o.b.position.set(x, heightAt(x, z) + 0.9 + Math.sin(a * 3) * 0.3, z);
      o.b.rotation.y = -a * 1.2 + Math.PI / 2;
      const flap = Math.sin(t * 16 + o.ph) * 0.9;
      o.l.rotation.z = flap; o.r.rotation.z = -flap;
    }
  };
  return group;
}

// ---- まとめ --------------------------------------------------------------

export function createMeadow(scene) {
  const cut = createCutMask();
  const wind = makeWind(cut.uniforms);
  const sky = makeSky();
  scene.add(sky);
  scene.fog = new THREE.Fog(HORIZON, 34, 150);

  scene.add(new THREE.HemisphereLight(0xfff4de, 0x7fa758, 1.55));
  const sun = new THREE.DirectionalLight(0xffe2b0, 2.1);
  sun.position.copy(SUN_DIR).multiplyScalar(30);
  scene.add(sun);

  const ground = makeGround(cut);
  const clouds = makeClouds();
  const grass = makeGrass(wind);
  const flowers = makeFlowers(wind);
  const plants = makePlants(wind);
  const motes = makeMotes();
  const butterflies = makeButterflies();
  scene.add(ground, clouds, grass, flowers, plants, motes, butterflies);
  makeTrees().forEach((t) => scene.add(t));

  return {
    ground,
    cut,
    wind,
    update(dt, t, actorPos, camPos) {
      wind.uTime.value = t;
      wind.uActor.value.copy(actorPos);
      sky.position.copy(camPos);
      clouds.userData.update(t);
      motes.userData.update(t);
      butterflies.userData.update(t);
    },
  };
}
