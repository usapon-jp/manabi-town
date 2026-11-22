// 町の空の絵（朝焼け・昼・夕焼け・夜）。色の きまりは daytime.js、ここは それを 3D に 塗るだけ。
// meadow.js が createSky(scene, parts) で 作り、毎フレーム sky.update(minute, t, camPos) を よぶ。
// スマホで 重くならないよう: 空は 1まいの 球、星は 点の あつまり 1つ、月は 板 2まい。
// 建物の「ほんのり光る」つよさは 2秒に 1回だけ まとめて かえる（毎フレームは さわらない）。
import * as THREE from 'three';
import { skyAt, publishSky } from './daytime.js';

const SKY_R = 160;

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uSun: { value: new THREE.Vector3(0.5, 0.42, -0.75).normalize() },
      uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() },
      uHz: { value: new THREE.Color() }, uHzAway: { value: new THREE.Color() },
      uSunCol: { value: new THREE.Color() }, uGlow: { value: 0.28 }, uDisc: { value: 1 },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      varying vec3 vDir; uniform vec3 uSun; uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHz; uniform vec3 uHzAway;
      uniform vec3 uSunCol; uniform float uGlow; uniform float uDisc;
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        // 地平線の色: 太陽の がわは あたたかく、はんたいの 空は むらさきに（夕焼け・朝焼けの グラデーション）
        vec2 dflat = normalize(vec2(d.x, d.z) + 1e-5);
        vec2 sflat = normalize(vec2(uSun.x, uSun.z) + 1e-5);
        float side = 0.5 + 0.5 * dot(dflat, sflat);
        vec3 hz = mix(uHzAway, uHz, smoothstep(0.0, 1.0, side));
        // 絵本の 空: 地平線から 上へ ゆっくり 色が うつる（帯を ひろく、さかいめを やわらかく）
        vec3 col = mix(hz, uMid, smoothstep(-0.02, 0.3, h));
        col = mix(col, uTop, smoothstep(0.16, 0.9, h));
        float s = max(dot(d, uSun), 0.0);
        col += uSunCol * pow(s, 6.0) * uGlow;                          // ひろがる光
        col += uSunCol * pow(s, 2.0) * uGlow * 0.18 * (1.0 - smoothstep(0.0, 0.35, h));   // 地平線に そう 光
        col += vec3(1.0, 0.95, 0.8) * pow(s, 90.0) * 0.9 * uDisc;      // 太陽
        col = mix(col, hz, smoothstep(0.0, -0.2, d.y));                 // 地平線の下は霞
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

// 星: 空の上のほうに 点を ちらす。ちらちら またたく（形は 点の シェーダーで まるく）
function makeStars(count) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  let s = 7;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const y = 0.08 + Math.pow(r(), 0.7) * 0.92;
    const c = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * c * 150, y * 150, Math.sin(a) * c * 150], i * 3);
    seed[i] = r();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    uniforms: { uA: { value: 0 }, uT: { value: 0 }, uPx: { value: 1 } },
    vertexShader: `attribute float seed; uniform float uT; uniform float uPx; varying float vA;
      void main(){
        vA = 0.55 + 0.45 * sin(uT * (1.2 + seed * 2.0) + seed * 40.0);
        gl_PointSize = (1.6 + seed * seed * 3.2) * uPx;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `uniform float uA; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.88) * a * vA * uA, 1.0);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// 月: やわらかい光の わと、まるい 月
function makeMoon(dot) {
  const g = new THREE.Group();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xcfd8ff, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(26);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(56, 52, 4, 64, 64, 60);
  gr.addColorStop(0, '#fffdf2'); gr.addColorStop(0.85, '#fff3c8'); gr.addColorStop(1, 'rgba(255,240,200,0)');
  x.fillStyle = gr; x.beginPath(); x.arc(64, 64, 60, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(225,215,180,0.55)';
  [[44, 50, 9], [78, 72, 12], [60, 88, 6], [86, 44, 5]].forEach(([cx, cy, rr]) => { x.beginPath(); x.arc(cx, cy, rr, 0, Math.PI * 2); x.fill(); });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  disc.scale.setScalar(7.5);
  g.add(halo, disc);
  g.userData.set = (a) => { halo.material.opacity = a * 0.55; disc.material.opacity = a; g.visible = a > 0.01; };
  return g;
}

// parts: { hemi, sun(DirectionalLight), clouds(Group), motes(Points), butterflies(Group), dot(テクスチャ) }
export function createSky(scene, parts) {
  const mat = skyMaterial();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 32, 16), mat);
  mesh.renderOrder = -2;
  const stars = makeStars(420);
  stars.renderOrder = -1;
  const moon = makeMoon(parts.dot);
  moon.renderOrder = -1;
  mesh.add(stars, moon);
  scene.add(mesh);
  // 霞: キャラの すこし 先から うすく かかりはじめ、とおくの 木や 雲海を 空に なじませる（奥ゆき）
  const fog = new THREE.Fog(0xf6e9cf, 30, 135);
  scene.fog = fog;

  const cloudMats = [];
  parts.clouds?.traverse((o) => { if (o.isSprite) cloudMats.push(o.material); });
  const moteCol = { day: new THREE.Color(0xfff1c4), night: new THREE.Color(0xd8ff8a) };
  const tmp = new THREE.Color();
  const moonVec = new THREE.Vector3();

  // 建物などの「ほんのり光る」つよさ（townkit の mat は emissive を 0.24 ほど 持つ）。夜は すこし おさえる
  let glowK = 1; let lastGlowAt = -99;
  function applyGlow(k, t) {
    const diff = Math.abs(k - glowK);
    // 時計で とんだ ときは すぐ。ゆっくり かわる ときは 2秒に 1回。あとから 建った 建物の ぶんも 5秒に 1回 そろえる
    if (diff < 0.1 && t - lastGlowAt < 2) return;
    if (diff < 0.005 && (k === 1 || t - lastGlowAt < 5)) return;
    glowK = k; lastGlowAt = t;
    const seen = new Set();
    scene.traverse((o) => {
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : null;
      if (!ms) return;
      for (const m of ms) {
        if (seen.has(m) || !m.emissive || m.emissiveIntensity == null) continue;
        seen.add(m);
        if (m.userData.glow0 == null) m.userData.glow0 = m.emissiveIntensity;
        m.emissiveIntensity = m.userData.glow0 * k;
      }
    });
  }

  // 色の きまりの 値は、絵の具の色（sRGB。#7fa758 などと 同じ 見かた）。光・霞・雲・地平線は そのまま 変換して わたす
  // （昼が いままでの 0x… の 色と ぴったり 同じに なるように）。空の 上のほうと 太陽の 光の わは、もとの シェーダーと 同じく そのまま
  const SRGB = THREE.SRGBColorSpace;
  const set = (u, c) => u.value.setRGB(c[0], c[1], c[2]);
  const setS = (col, c) => col.setRGB(c[0], c[1], c[2], SRGB);
  let pxRatio = 1;
  return {
    mesh,
    setPixelRatio(px) { pxRatio = px; },
    update(minute, t, camPos) {
      const s = skyAt(minute);
      publishSky(s);
      const u = mat.uniforms;
      u.uSun.value.set(s.sunDir[0], s.sunDir[1], s.sunDir[2]);
      set(u.uTop, s.top); set(u.uMid, s.mid); setS(u.uHz.value, s.hz); setS(u.uHzAway.value, s.hzAway); set(u.uSunCol, s.sun);
      u.uGlow.value = s.glow;
      u.uDisc.value = Math.min(1, Math.max(0, (s.sunDir[1] + 0.02) * 12));
      mesh.position.copy(camPos);
      // 霞（フォグ）は 地平線と 同じ色に
      setS(fog.color, [(s.hz[0] + s.hzAway[0]) / 2, (s.hz[1] + s.hzAway[1]) / 2, (s.hz[2] + s.hzAway[2]) / 2]);
      // 夜は 霞を うすく（町の 灯りが しずまない ように）
      fog.near = 30 + s.night * 8; fog.far = 135 + s.night * 25;
      // 星と月
      stars.material.uniforms.uA.value = s.stars;
      stars.material.uniforms.uT.value = t;
      stars.material.uniforms.uPx.value = pxRatio;
      stars.visible = s.stars > 0.01;
      moonVec.set(s.moonDir[0], s.moonDir[1], s.moonDir[2]).multiplyScalar(140);
      moon.position.copy(moonVec);
      moon.userData.set(Math.min(1, s.stars * 1.2));
      // 光
      if (parts.hemi) { setS(parts.hemi.color, s.hemi); setS(parts.hemi.groundColor, s.ground); parts.hemi.intensity = s.hemiI; }
      if (parts.sun) {
        setS(parts.sun.color, s.sun);
        // 日の入り・日の出の まぎわは 光を よわく（月と 入れかわる ときに パッと かわらない ように）
        const low = Math.min(1, Math.abs(s.lightDir[1]) * 6);
        parts.sun.intensity = s.sunI * (0.25 + 0.75 * low);
        parts.sun.position.set(s.lightDir[0], Math.max(0.05, s.lightDir[1]), s.lightDir[2]).multiplyScalar(30);
      }
      // 雲は 空の色に そまる
      setS(tmp, s.cloud);
      for (const m of cloudMats) m.color.copy(tmp);
      // 夜は ちょうちょが ねて、光の つぶが ほたるに
      if (parts.butterflies) parts.butterflies.visible = s.night < 0.5;
      if (parts.motes) {
        parts.motes.material.color.copy(moteCol.day).lerp(moteCol.night, s.night);
        parts.motes.material.opacity = 0.8 + s.night * 0.2;
        parts.motes.material.size = 0.22 + s.night * 0.08;
      }
      applyGlow(s.glowK, t);
      return s;
    },
  };
}
