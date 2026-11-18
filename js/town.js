// 勉強すると育つ「まなびタウン」。レベルが上がるたびに、草原にひとつずつ建物や景色がふえる。
// 置く場所は決まっているので、いつ開いても同じ街になる。world.js から使う。
import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { skyNow, DAY_MIN } from './daytime.js';

import { cottage, mushroomHouse, bed } from './cottage.js';
import { mat, glass, box, cyl, cone, ball, softDot, blob, smoke, Bag, rboxGeo as rboxGeoT, GEO } from './townkit.js';
const { CYL: CYLT, BOX: BOXT } = GEO;
import { NEST } from './eggs.js';
import { school } from './school.js';

// 切り妻（山がたの）屋根。底がy=0、ひさしを少し出す
function gable(width, depth, rise, color, over = 0.22) {
  const g = new THREE.Group();
  const half = width / 2 + over;
  const rise2 = (rise * half) / (width / 2);
  const len = Math.hypot(half, rise2);
  const ang = Math.atan2(rise2, half);
  const slabD = depth + over * 1.8;
  const dark = new THREE.Color(color).multiplyScalar(0.78).getHex();
  for (const side of [-1, 1]) {
    const slab = box(len, 0.13, slabD, color);
    slab.position.set((side * half) / 2, rise2 / 2 + 0.05, 0);
    slab.rotation.z = -side * ang;
    for (const u of [-0.32, 0, 0.32]) slab.add(box(0.07, 0.05, slabD * 0.99, dark, u * len, 0.08, 0)); // かわらのすじ
    g.add(slab);
  }
  const ridge = cyl(0.09, 0.09, slabD + 0.04, dark, 0, rise2 + 0.1, 0, 8);
  ridge.rotation.x = Math.PI / 2;
  g.add(ridge);
  return g;
}

// 山がたの壁（切り妻の三角）
function gableWall(width, rise, color, z, depth = 0.08) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(0, rise); shape.closePath();
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), mat(color));
  m.position.z = z - depth / 2;
  return m;
}

// まどわく・まど・よろい戸・花ばこ（正面むき）
function windowAt(g, x, y, z, w, h, shutter = 0x7fb8a4, flowers = true) {
  g.add(box(w + 0.12, h + 0.12, 0.05, 0xffffff, x, y, z));
  g.add(box(w, h, 0.07, 0xffe6a6, x, y, z + 0.01)).children.at(-1).material = glass;
  g.add(box(0.035, h, 0.08, 0xffffff, x, y, z + 0.02), box(w, 0.035, 0.08, 0xffffff, x, y, z + 0.02));
  g.add(box(w * 0.42, h + 0.1, 0.05, shutter, x - w * 0.75, y, z), box(w * 0.42, h + 0.1, 0.05, shutter, x + w * 0.75, y, z));
  if (flowers) {
    g.add(box(w * 1.2, 0.14, 0.18, 0xa56b46, x, y - h / 2 - 0.1, z + 0.1));
    const cols = [0xff8fb3, 0xfff08a, 0xffffff, 0xc7a6ff];
    for (let i = 0; i < 5; i++) {
      g.add(ball(0.075, cols[i % 4], x + (i - 2) * w * 0.24, y - h / 2 + 0.04, z + 0.12));
      g.add(ball(0.06, 0x62b35a, x + (i - 2) * w * 0.24 + 0.05, y - h / 2 - 0.02, z + 0.12));
    }
  }
}

function archDoor(g, x, y, z, w, h, color = 0x9a6a4a) {
  const rectH = h - w / 2;
  g.add(box(w, rectH, 0.08, color, x, y + rectH / 2, z));
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.08, 20, 1, false, Math.PI / 2, Math.PI), mat(color));
  arch.rotation.x = Math.PI / 2;
  arch.position.set(x, y + rectH, z);
  g.add(arch);
  g.add(box(0.05, h * 0.9, 0.09, 0x7a4c30, x, y + h * 0.45, z)); // まんなかの木目
  g.add(ball(0.04, 0xffd45c, x + w * 0.3, y + h * 0.42, z + 0.06));
}

function bush(x, z, s = 1) {
  const g = new THREE.Group();
  g.add(ball(0.32 * s, 0x6fb35e, 0, 0.26 * s, 0), ball(0.25 * s, 0x83c46a, 0.28 * s, 0.2 * s, 0.1 * s), ball(0.22 * s, 0x78bb64, -0.25 * s, 0.18 * s, -0.05 * s));
  for (let i = 0; i < 4; i++) g.add(ball(0.045 * s, [0xff8fb3, 0xfff08a][i % 2], (i - 1.5) * 0.14 * s, (0.3 + (i % 2) * 0.1) * s, 0.28 * s));
  g.position.set(x, 0, z);
  return g;
}

// ---- 建物 ---------------------------------------------------------------

function signpost() {
  const g = new THREE.Group();
  g.add(blob(0.7, 0.5, 0.25));
  g.add(cyl(0.07, 0.09, 1.9, 0x9a6a4a, 0, 0.95, 0, 8));
  g.add(ball(0.1, 0xb98558, 0, 1.92, 0));
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#fff3c9'; x.fillRect(0, 0, 512, 160);
  x.strokeStyle = '#c98f4a'; x.lineWidth = 14; x.strokeRect(7, 7, 498, 146);
  x.fillStyle = '#6b4a2b'; x.lang = 'ja'; x.font = 'bold 76px "Hiragino Maru Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Noto Sans CJK JP", "Yu Gothic", Meiryo, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('まなびタウン', 256, 84);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.53, 0.07), [
    mat(0xc98f4a), mat(0xc98f4a), mat(0xc98f4a), mat(0xc98f4a),
    new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }), mat(0xc98f4a),
  ]);
  board.position.set(0, 1.6, 0.06);
  g.add(board);
  g.add(bush(0.45, 0.2, 0.7), bush(-0.5, 0.15, 0.6));
  return g;
}

function pond() {
  const g = new THREE.Group();
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 40),
    new THREE.MeshLambertMaterial({ color: 0x7fd0ec, emissive: 0x4aa8cf, emissiveIntensity: 0.35, transparent: true, opacity: 0.93 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.1;
  g.add(water);
  const shine = new THREE.Mesh(new THREE.CircleGeometry(1.2, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, map: softDot(), transparent: true, opacity: 0.35, depthWrite: false }));
  shine.rotation.x = -Math.PI / 2; shine.position.set(0.5, 0.12, -0.4);
  g.add(shine);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 + (i % 3) * 0.09, 1), mat(0xc4beb0));
    s.position.set(Math.cos(a) * 2.45, 0.12, Math.sin(a) * 2.45);
    s.scale.y = 0.65;
    g.add(s);
  }
  const pads = [];
  [[-0.8, 0.5], [0.7, -0.6], [0.9, 0.8], [-0.3, -0.9]].forEach(([x, z]) => {
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.36, 14), mat(0x5fb86a, { side: THREE.DoubleSide }));
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.12, z);
    pads.push(p);
    g.add(p);
  });
  [[0.7, -0.6, 0xffb6d0], [-0.8, 0.5, 0xffffff]].forEach(([x, z, c]) => {
    for (let k = 0; k < 6; k++) {
      const pet = cone(0.06, 0.2, c, x + Math.cos(k) * 0.1, 0.22, z + Math.sin(k) * 0.1, 6);
      pet.rotation.z = Math.cos(k) * 0.5; pet.rotation.x = Math.sin(k) * 0.5;
      g.add(pet);
    }
  });
  // がまのほ
  for (let i = 0; i < 6; i++) {
    const a = 2.4 + i * 0.22;
    const x = Math.cos(a) * 2.6; const z = Math.sin(a) * 2.6;
    g.add(cyl(0.02, 0.025, 1.2 + (i % 3) * 0.2, 0x6fae56, x, 0.6, z, 5), cyl(0.05, 0.05, 0.28, 0x8a5a3c, x, 1.3 + (i % 3) * 0.2, z, 6));
  }
  g.userData.update = (t) => {
    water.material.opacity = 0.9 + Math.sin(t * 1.3) * 0.04;
    shine.material.opacity = 0.3 + Math.sin(t * 0.9) * 0.1;
    pads.forEach((p, i) => { p.rotation.z = Math.sin(t * 0.6 + i) * 0.15; });
  };
  return g;
}

function fence(length = 7) {
  const g = new THREE.Group();
  const n = Math.round(length / 0.8);
  for (let i = 0; i <= n; i++) {
    const x = -length / 2 + (length / n) * i;
    g.add(box(0.14, 0.72, 0.07, 0xfaf0d6, x, 0.36, 0), cone(0.1, 0.16, 0xfaf0d6, x, 0.8, 0, 4));
  }
  g.add(box(length, 0.08, 0.05, 0xe6d3a3, 0, 0.58, 0.05), box(length, 0.08, 0.05, 0xe6d3a3, 0, 0.26, 0.05));
  return g;
}

function windmill() {
  const g = new THREE.Group();
  g.add(blob(2.2, 2.2));
  g.add(cyl(1.05, 1.15, 1.0, 0xc4beb0, 0, 0.5, 0, 20));                // 石の土台
  g.add(cyl(0.68, 1.0, 2.6, 0xfff0d8, 0, 2.2, 0, 20));                 // 塔
  g.add(cyl(0.72, 0.72, 0.1, 0x93603e, 0, 3.55, 0, 20));
  g.add(cyl(0.7, 0.7, 0.08, 0x93603e, 0, 1.8, 0, 20));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x6fa8dc));
  dome.position.y = 3.58; dome.scale.set(1, 0.95, 1);
  g.add(dome);
  g.add(cone(0.12, 0.35, 0xffd45c, 0, 4.55, 0, 8));
  // 正面（+z）
  const door = new THREE.Group();
  archDoor(door, 0, 0, 0, 0.55, 0.95);
  door.position.set(0, 0.55, 1.1);
  g.add(door);
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.17, 16), glass);
  win.position.set(0, 2.5, 0.84);
  g.add(win);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 20), mat(0x93603e));
  ring.position.set(0, 2.5, 0.85);
  g.add(ring);
  const blades = new THREE.Group();
  blades.position.set(0, 3.1, 0.95);
  blades.add(cyl(0.14, 0.14, 0.4, 0x93603e, 0, 0, 0.05, 10).rotateX(Math.PI / 2));
  blades.add(ball(0.17, 0xffd45c, 0, 0, 0.3));
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    arm.add(box(0.1, 2.7, 0.06, 0x93603e, 0, 1.4, 0));
    const sail = box(0.62, 1.7, 0.03, 0xffffff, 0.36, 1.65, 0.04);
    arm.add(sail);
    for (let k = 0; k < 5; k++) arm.add(box(0.62, 0.03, 0.05, 0xd9b48a, 0.36, 0.85 + k * 0.4, 0.05));
    arm.add(box(0.03, 1.7, 0.05, 0xd9b48a, 0.36, 1.65, 0.05));
    blades.add(arm);
  }
  g.add(blades);
  g.add(bush(-1.1, 1.0, 0.9), bush(1.15, 0.9, 0.8));
  g.userData.update = (t) => { blades.rotation.z = -t * 0.8; };
  return g;
}

function fountain() {
  const g = new THREE.Group();
  g.add(blob(3, 3, 0.25));
  g.add(cyl(1.95, 2.05, 0.55, 0xd9d4c7, 0, 0.27, 0, 32));
  g.add(cyl(1.75, 1.75, 0.5, 0xe8e3d6, 0, 0.25, 0, 32));
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.72, 32), new THREE.MeshLambertMaterial({ color: 0x8fd6f2, emissive: 0x5ab8e0, emissiveIntensity: 0.4 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.56;
  g.add(water);
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
  ripple.rotation.x = -Math.PI / 2; ripple.position.y = 0.58;
  g.add(ripple);
  g.add(cyl(0.2, 0.32, 1.1, 0xd9d4c7, 0, 1.05, 0, 14));
  g.add(cyl(0.75, 0.25, 0.22, 0xd9d4c7, 0, 1.65, 0, 20));
  g.add(ball(0.18, 0xe8e3d6, 0, 1.85, 0));
  const drops = [];
  const dropMat = new THREE.MeshBasicMaterial({ color: 0xd9f3ff });
  for (let i = 0; i < 30; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), dropMat);
    drops.push(d);
    g.add(d);
  }
  g.userData.update = (t) => {
    drops.forEach((d, i) => {
      const k = (t * 0.9 + i / drops.length) % 1;
      const a = (i / drops.length) * Math.PI * 2 * 3;
      const out = Math.sin(k * Math.PI) * 0.6 + k * 1.0;
      d.position.set(Math.cos(a) * out, 1.95 + Math.sin(k * Math.PI) * 1.1 - k * 0.9, Math.sin(a) * out);
    });
    const k = (t * 0.5) % 1;
    ripple.scale.setScalar(1 + k * 4);
    ripple.material.opacity = 0.5 * (1 - k);
  };
  return g;
}

// 虹: やわらかくにじむ光のおび。いつもカメラのほうを向く。両はしに雲
function rainbow() {
  const g = new THREE.Group();
  const bow = (inner, outer, alpha, flip) => new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 128, 1, 0, Math.PI),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      uniforms: { uIn: { value: inner }, uOut: { value: outer }, uAlpha: { value: alpha }, uFlip: { value: flip ? 1 : 0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        varying vec2 vP; uniform float uIn; uniform float uOut; uniform float uAlpha; uniform float uFlip;
        vec3 ramp(float t){
          vec3 c0 = vec3(0.68,0.55,1.00); vec3 c1 = vec3(0.45,0.70,1.00); vec3 c2 = vec3(0.55,0.92,0.68);
          vec3 c3 = vec3(1.00,0.93,0.45); vec3 c4 = vec3(1.00,0.70,0.40); vec3 c5 = vec3(1.00,0.50,0.55);
          t *= 5.0;
          if (t < 1.0) return mix(c0,c1,t); if (t < 2.0) return mix(c1,c2,t-1.0);
          if (t < 3.0) return mix(c2,c3,t-2.0); if (t < 4.0) return mix(c3,c4,t-3.0);
          return mix(c4,c5,t-4.0);
        }
        void main(){
          float t = clamp((length(vP) - uIn) / (uOut - uIn), 0.0, 1.0);
          if (uFlip > 0.5) t = 1.0 - t;
          float edge = smoothstep(0.0, 0.28, t) * smoothstep(1.0, 0.72, t);   // ふちはふんわり消える
          float foot = smoothstep(0.0, 0.22, vP.y / uOut);                    // 地面ちかくはすっと消える
          gl_FragColor = vec4(ramp(t), edge * foot * uAlpha);
          #include <colorspace_fragment>
        }`,
    }),
  );
  g.add(bow(11.0, 15.5, 0.62, false));
  g.add(bow(17.0, 19.5, 0.2, true));
  // 両はしの雲
  const mk = (x, s) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
    sp.scale.set(s * 1.6, s, 1);
    sp.position.set(x, s * 0.3, 0.3);
    return sp;
  };
  for (const side of [-1, 1]) {
    g.add(mk(side * 13.2, 6), mk(side * 11.8, 4.5), mk(side * 14.8, 4.2), mk(side * 13.4, 3));
  }
  const sparkles = [];
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xfff6c8, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(0.5);
    sparkles.push(s);
    g.add(s);
  }
  const fades = [];
  g.traverse((o) => { if (o.material && o !== g) fades.push([o.material, o.material.uniforms ? o.material.uniforms.uAlpha.value : o.material.opacity]); });
  let shownDay = -1;
  g.userData.update = (t, cam, pos) => {
    // 虹は 日の光で かかるので、夕焼けの おわりから 夜は うすれて きえる
    const day = 1 - skyNow.night;
    if (Math.abs(day - shownDay) > 0.01) {
      shownDay = day;
      for (const [m, a] of fades) { if (m.uniforms) m.uniforms.uAlpha.value = a * day; else m.opacity = a * day; }
    }
    for (const c of g.children) c.visible = day > 0.01;   // g.visible は 町が きめる（しまう・ほかの島）ので さわらない
    if (cam) g.rotation.y = Math.atan2(cam.x - pos.x, cam.z - pos.z);
    sparkles.forEach((s, i) => {
      const a = (i / sparkles.length) * Math.PI + Math.sin(t * 0.3 + i) * 0.04;
      const r = 11.5 + ((i * 7) % 5) * 0.9;
      s.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.2);
      s.material.opacity = (0.3 + 0.5 * Math.max(0, Math.sin(t * 1.6 + i * 1.9))) * day;
    });
  };
  return g;
}

function tower() {
  const g = new THREE.Group();
  g.add(blob(3.4, 3.4, 0.3));
  g.add(cyl(1.6, 1.8, 0.4, 0xbdb6a6, 0, 0.2, 0, 24));
  g.add(cyl(1.3, 1.5, 4.9, 0xf4e9ff, 0, 2.85, 0, 24));
  for (const y of [1.6, 3.2, 4.7]) g.add(cyl(1.42 - y * 0.02, 1.42 - y * 0.02, 0.12, 0xc7a6ff, 0, y, 0, 24));
  g.add(cyl(1.7, 1.55, 0.3, 0xc7a6ff, 0, 5.45, 0, 24));
  g.add(cyl(1.4, 1.4, 0.6, 0xf4e9ff, 0, 5.9, 0, 24));
  g.add(cone(1.75, 2.5, 0xff8fb3, 0, 7.45, 0, 24));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(cone(0.22, 0.45, 0xffd45c, Math.cos(a) * 1.55, 5.7 + 0.22, Math.sin(a) * 1.55, 6));
  }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
  star.position.y = 9.2;
  g.add(star);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xfff1a8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(2.4); halo.position.y = 9.2;
  g.add(halo);
  const door = new THREE.Group();
  archDoor(door, 0, 0, 0, 0.9, 1.5);
  door.position.set(0, 0.4, 1.44);
  g.add(door);
  // 時計（町の時刻で 針が まわる。上が 昼の まんなか）。Lv10 から「時計塔」
  const clock = new THREE.Group();
  clock.position.set(0, 3.95, 1.39);
  clock.rotation.x = -0.04;
  clock.add(new THREE.Mesh(new THREE.CircleGeometry(0.56, 32), mat(0xfffaf0)));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.06, 8, 32), mat(0xc7a6ff));
  clock.add(rim);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tick = box(i % 3 ? 0.04 : 0.07, i % 3 ? 0.08 : 0.13, 0.02, 0x8a6fb8, Math.sin(a) * 0.45, Math.cos(a) * 0.45, 0.02);
    tick.rotation.z = -a;
    clock.add(tick);
  }
  const sunMark = ball(0.07, 0xffc94a, 0, 0.3, 0.02); sunMark.scale.z = 0.3;
  const moonMark = ball(0.06, 0x8fa8e8, 0, -0.3, 0.02); moonMark.scale.z = 0.3;
  clock.add(sunMark, moonMark);
  const hand = new THREE.Group();
  hand.add(box(0.06, 0.4, 0.025, 0x5a4a7a, 0, 0.18, 0.05), ball(0.06, 0xffd45c, 0, 0, 0.06));
  clock.add(hand);
  g.add(clock);
  for (const [y, a] of [[2.6, 0.5], [3.7, -1.0], [4.8, 1.0], [2.4, -1.2]]) {
    const win = new THREE.Group();
    win.add(box(0.5, 0.7, 0.05, 0xffffff, 0, 0, 0), box(0.4, 0.6, 0.07, 0xffe6a6, 0, 0, 0.01));
    win.children[1].material = glass;
    const arch = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16, 0, Math.PI), glass);
    arch.position.set(0, 0.3, 0.05);
    win.add(arch);
    win.position.set(Math.sin(a) * 1.41, y, Math.cos(a) * 1.41);
    win.rotation.y = a;
    g.add(win);
  }
  for (const sx of [-1, 1]) {
    g.add(cyl(0.6, 0.72, 2.8, 0xf4e9ff, sx * 2.1, 1.4, 0.1, 16));
    g.add(cone(0.82, 1.2, 0x74c0fc, sx * 2.1, 3.4, 0.1, 16));
    g.add(ball(0.08, 0xffd45c, sx * 2.1, 4.05, 0.1));
    const w = box(0.25, 0.4, 0.05, 0xffe6a6, sx * 2.1, 1.9, 0.78);
    w.material = glass;
    g.add(w);
  }
  g.userData.update = (t) => {
    star.rotation.y = t * 1.5; star.position.y = 9.2 + Math.sin(t * 2) * 0.12;
    halo.position.y = star.position.y; halo.material.opacity = 0.6 + Math.sin(t * 2.4) * 0.2;
    hand.rotation.z = -((skyNow.minute - 20) / DAY_MIN) * Math.PI * 2;   // 昼の まんなか（20分）で 真上
  };
  return g;
}

// ---- 置き場所とレベル ---------------------------------------------------
// lv: そのレベルで出てくる / r: 歩けない広さ（0なら通りぬけ）/ avoid: 草や木をよける広さ

const EXTRA_HOUSES = [
  [15, -9, 0.4, 0xffe3e3, 0x74c0fc], [-16, 2, 1.1, 0xe3f6ff, 0xff8fb3], [-13, 10, 0.2, 0xfff1d6, 0x8ce99a],
  [12, 12, -0.3, 0xf3e3ff, 0xffa94d], [-4, 14, 0, 0xe6ffe3, 0xb197fc], [18, -1, -0.8, 0xfff8cc, 0xe86a5a],
];

const PLAN = [
  { lv: 2, x: 3.6, z: 3.2, r: 0.35, avoid: 1.2, rot: -0.4, make: signpost },
  { lv: 2, x: -4, z: -4.5, r: 0, avoid: 2, make: () => bed('log', 1.45, 11) },
  { lv: 3, x: -9.5, z: 3.5, r: 2.4, avoid: 3.2, make: pond },
  { lv: 4, x: 8.5, z: -8, r: 2.1, avoid: 4.2, rot: 0.15, make: () => cottage({ roof: 0x8fcf5a, size: 1.35 }) },
  { lv: 4, x: 8, z: -2.2, r: 0, avoid: 4, make: () => fence(7) },
  { lv: 5, x: -10.5, z: -9.5, r: 2.1, avoid: 4.2, rot: -0.25, make: () => mushroomHouse({ size: 1.4 }) },
  { lv: 6, x: 14, z: 3, r: 1.1, avoid: 2.2, rot: -0.5, make: windmill },
  { lv: 7, x: 0, z: -14, r: 3.2, avoid: 4.2, make: school },
  { lv: 8, x: 6.5, z: 8, r: 2.0, avoid: 2.8, make: fountain },
  { lv: 9, x: 0, z: -31, r: 0, avoid: 0, make: rainbow },
  { lv: 10, x: -15, z: -14, r: 1.6, avoid: 3, rot: 0.6, make: tower },
  ...EXTRA_HOUSES.map(([x, z, rot, wall, roof], i) => ({
    lv: 11 + i, x, z, r: 1.75, avoid: 2.9, rot, make: () => (i % 2 ? mushroomHouse({ cap: roof, size: 1.1, withBed: false }) : cottage({ roof, size: 1.1, withBed: false })),
  })),
];

// 名前と、動かせるか。id は「PLAN の何番目か」なので、足すときは かならず うしろに足す（保存した操作が id で呼ぶ）
const NAMES = ['看板', '花だん', '池', 'コテージ', '柵', 'きのこの家', '風車', '学校', '噴水', '虹', '時計塔'];
export const CLOCK_TOWER = 'town:10';   // 時計塔（タップすると 町の 時計を まわせる）
// レベルアップのおしらせに出す名前（同じ名前は、ひとつにまとめる）。1レベルに1つになるようにそろえてある
const UNLOCK = { 0: '看板と花だん', 1: '看板と花だん', 3: 'コテージと柵', 4: 'コテージと柵' };
PLAN.forEach((p, i) => {
  p.id = `town:${i}`;
  p.label = NAMES[i] || (i % 2 ? '小さなきのこの家' : '小さなコテージ');
  p.unlock = UNLOCK[i] || p.label;
  p.movable = !['池', '柵', '虹'].includes(p.label);   // 池・柵・虹は、うごかさない
});

// ---- 町の 小道（石だたみ） ------------------------------------------------
// まんなか（女の子の いる あたり）から 建物の 入口へ。建物が 出たら 小道も 出る（うごかした・しまった ときは かくす）
// for: PLAN の 番号。pts: 通る 点（x, z）
const TRAILS = [
  { for: 7, pts: [[0.9, 0.2], [1.3, -4.8], [0.6, -8.4], [0.2, -10.6]] },          // 学校
  { for: 3, pts: [[1.4, -2.6], [4.6, -4.1], [7.2, -4.7], [8.9, -5.0]] },          // コテージ
  { for: 5, pts: [[-2.6, -0.5], [-5.4, -3.6], [-8.4, -5.8], [-11.0, -6.6]] },     // きのこの家
  { for: 8, pts: [[1.4, 1.2], [3.2, 3.6], [4.8, 5.6]] },                           // 噴水
  { for: 2, pts: [[-1.8, 0.9], [-4.6, 2.0], [-6.8, 2.8]] },                        // 池
  // 池から 島の はしへ ながれる 小川と、木の 橋（池と いっしょに 出る）
  { for: 2, kind: 'stream', w: 1.5, pts: [[-11.6, 4.6], [-14.2, 6.6], [-17.4, 7.0], [-20.4, 9.2], [-23.6, 10.4]] },
];
const TRAIL_W = 1.25;
const segDist = (x, z, a, b) => {
  const dx = b[0] - a[0]; const dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
};
const nearTrail = (x, z, pad) => TRAILS.some((tr) => tr.pts.some((p, i) => i > 0 && segDist(x, z, tr.pts[i - 1], p) < (tr.w || TRAIL_W) * 0.5 + pad));

// 小川: 水の おび（ゆらゆら 光る）・岸の 石・まんなかの 木の 橋
function streamMesh(tr) {
  const g = new THREE.Group();
  const W = tr.w;
  const curve = new THREE.CatmullRomCurve3(tr.pts.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const n = Math.max(12, Math.ceil(curve.getLength() / 0.3));
  const pos = []; const col = []; const uv = []; const idx = [];
  const deep = new THREE.Color(0x5fb8d8); const shallow = new THREE.Color(0xa8e0ea); const bank = new THREE.Color(0xb9c98a);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t); const tg = curve.getTangentAt(t);
    const nx = -tg.z; const nz = tg.x;
    const wob = 1 + 0.15 * Math.sin(t * 17.0);
    for (const [k, a, c] of [[-1, 0, bank], [-0.7, 1, shallow], [0, 1, deep], [0.7, 1, shallow], [1, 0, bank]]) {
      const x = p.x + nx * k * W * 0.6 * wob; const z = p.z + nz * k * W * 0.6 * wob;
      pos.push(x, heightAt(x, z) + 0.04, z);
      col.push(c.r, c.g, c.b, a * 0.95);
      uv.push(k, t * n * 0.3);
    }
    if (i < n) for (let k = 0; k < 4; k++) { const a = i * 5 + k; idx.push(a, a + 5, a + 1, a + 1, a + 5, a + 6); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setIndex(idx);
  const time = { value: 0 };
  const wm = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, emissive: 0x2a6a88, emissiveIntensity: 0.35, polygonOffset: true, polygonOffsetFactor: -3 });
  wm.onBeforeCompile = (sh) => {
    sh.uniforms.uT = time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vSu;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvSu = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vSu;\nuniform float uT;').replace('#include <color_fragment>', `#include <color_fragment>
      float rip = sin( vSu.y * 9.0 - uT * 2.4 + sin( vSu.x * 3.0 ) * 1.5 ) * sin( vSu.y * 4.3 - uT * 1.3 + vSu.x * 2.0 );
      diffuseColor.rgb += vec3( 0.9, 0.95, 1.0 ) * pow( max( 0.0, rip ), 6.0 ) * 0.5 * ( 1.0 - abs( vSu.x ) );`);
  };
  const water = new THREE.Mesh(geo, wm);
  water.renderOrder = 1;
  g.add(water);
  // 岸の 石
  const b = new Bag();
  let seed = 31;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const rock = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < n; i += 1) {
    const t = (i + 0.5) / n;
    const p = curve.getPointAt(t); const tg = curve.getTangentAt(t);
    for (const side of [-1, 1]) {
      if (rnd() < 0.35) continue;
      const off = side * W * (0.6 + rnd() * 0.15);
      const x = p.x - tg.z * off; const z = p.z + tg.x * off;
      const r = 0.16 + rnd() * 0.16;
      b.add(rock, [0xd8d0bf, 0xc9c1ae, 0xe4dccb][Math.floor(rnd() * 3)], { x, y: heightAt(x, z) + r * 0.25, z, sx: r * 1.3, sy: r * 0.7, sz: r, ry: rnd() * 6 });
    }
  }
  // 木の 橋（まんなかへんに、川を またぐ アーチ）
  const bt = 0.45; const bp = curve.getPointAt(bt); const btg = curve.getTangentAt(bt);
  const bridge = new Bag();
  const L = W * 2.1; const Wd = 1.0;
  const rise = 0.42;
  const planks = 11;
  for (let i = 0; i < planks; i++) {
    const u = (i / (planks - 1) - 0.5);
    const y = rise * Math.cos(u * Math.PI) - 0.05;
    const ang = -Math.sin(u * Math.PI) * rise * Math.PI / L;
    bridge.add(rboxGeoT(Wd, 0.07, L / planks * 0.92, 0.02), i % 2 ? 0xc78a4f : 0xb87b45, { x: 0, y: y + 0.12, z: u * L, rx: ang });
  }
  for (const sx of [-1, 1]) {
    for (let i = 0; i <= 4; i++) {
      const u = i / 4 - 0.5;
      const y = rise * Math.cos(u * Math.PI);
      bridge.add(CYLT, 0x9a6a3c, { x: sx * Wd * 0.5, y: y + 0.32, z: u * L * 0.92, sx: 0.06, sy: 0.5, sz: 0.06 });
    }
    for (let i = 0; i < 8; i++) {
      const u0 = i / 8 - 0.5; const u1 = (i + 1) / 8 - 0.5;
      const y0 = rise * Math.cos(u0 * Math.PI); const y1 = rise * Math.cos(u1 * Math.PI);
      const len = Math.hypot((u1 - u0) * L * 0.92, y1 - y0);
      bridge.add(BOXT, 0xb07a48, { x: sx * Wd * 0.5, y: (y0 + y1) / 2 + 0.56, z: ((u0 + u1) / 2) * L * 0.92, sx: 0.07, sy: 0.07, sz: len + 0.02, rx: -Math.atan2(y1 - y0, (u1 - u0) * L * 0.92) });
    }
  }
  const bm = bridge.mesh();
  bm.position.set(bp.x, heightAt(bp.x, bp.z), bp.z);
  bm.rotation.y = Math.atan2(-btg.z, btg.x);   // 橋の 長さ（z）を 川と 直角に
  g.add(b.mesh(), bm);
  g.userData.update = (t) => { time.value = t; };
  return g;
}

function trailMesh(tr) {
  if (tr.kind === 'stream') return streamMesh(tr);
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(tr.pts.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const len = curve.getLength();
  const n = Math.max(8, Math.ceil(len / 0.35));
  // 土の おび（ふちは すうっと 草に とける）
  const pos = []; const col = []; const idx = [];
  const soil = new THREE.Color(0xe2bf93); const edge = new THREE.Color(0xc9b77e);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t); const tg = curve.getTangentAt(t);
    const nx = -tg.z; const nz = tg.x;
    const wob = 1 + 0.12 * Math.sin(t * 23.0 + tr.for);
    for (const [k, a] of [[-1, 0], [-0.55, 1], [0.55, 1], [1, 0]]) {
      const x = p.x + nx * k * TRAIL_W * 0.62 * wob; const z = p.z + nz * k * TRAIL_W * 0.62 * wob;
      pos.push(x, heightAt(x, z) + 0.035, z);
      const c = edge.clone().lerp(soil, a);
      col.push(c.r, c.g, c.b, a * 0.92);
    }
    if (i < n) for (let k = 0; k < 3; k++) { const a = i * 4 + k; idx.push(a, a + 4, a + 1, a + 1, a + 4, a + 5); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setIndex(idx);
  const ribbon = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  ribbon.renderOrder = 1;
  g.add(ribbon);
  // 石だたみ（まるい 平たい 石を ならべる）
  const stones = [];
  let seed = 11 + tr.for * 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const stoneGeo = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const cols = [0xf1e3c6, 0xe8d6b2, 0xf6ead2, 0xdcc9a4];
  const m = Math.round(n * 1.4);
  for (let i = 0; i < m; i++) {
    const t = (i + 0.5) / m;
    const p = curve.getPointAt(t); const tg = curve.getTangentAt(t);
    for (const side of [-0.28, 0.28]) {
      if (rnd() < 0.18) continue;
      const off = side + (rnd() - 0.5) * 0.12;
      const x = p.x - tg.z * off * TRAIL_W + tg.x * (rnd() - 0.5) * 0.12;
      const z = p.z + tg.x * off * TRAIL_W + tg.z * (rnd() - 0.5) * 0.12;
      const st = new THREE.Mesh(stoneGeo, mat(cols[Math.floor(rnd() * cols.length)]));
      const sz = 0.2 + rnd() * 0.07;
      st.scale.set(sz * (1 + rnd() * 0.3), 0.05, sz);
      st.rotation.y = rnd() * 6.28;
      st.position.set(x, heightAt(x, z) + 0.02, z);
      stones.push(st);
    }
  }
  // 石は 1つに まとめて かく（スマホで 軽く）
  const merged = mergeStones(stones);
  if (merged) g.add(merged);
  return g;
}

function mergeStones(list) {
  if (!list.length) return null;
  const b = new Bag();
  for (const st of list) b.add(st.geometry, st.material.color.getHex(), { x: st.position.x, y: st.position.y, z: st.position.z, sx: st.scale.x, sy: st.scale.y, sz: st.scale.z, ry: st.rotation.y });
  return b.mesh();
}

// 草や木をよけるための判定（建物が出る前から場所をあけておく）
// 教科の たまごの 巣（eggs.js の NEST）も、草が つきぬけないよう あけておく
export function isTownSpot(x, z, pad = 0) {
  if (Math.hypot(x - NEST.x, z - NEST.z) < NEST.r + 0.35 + pad) return true;
  if (nearTrail(x, z, pad)) return true;
  return PLAN.some((p) => p.avoid > 0 && Math.hypot(x - p.x, z - p.z) < p.avoid + pad);
}

export function createTown(scene) {
  const items = PLAN.map((p) => {
    const group = p.make();
    group.position.set(p.x, heightAt(p.x, p.z), p.z);
    group.rotation.y = p.rot || 0;
    group.visible = false;
    scene.add(group);
    return { ...p, x0: p.x, z0: p.z, rot0: p.rot || 0, group, shown: false, stored: false, pop: 1, base: group.scale.x };   // base: 建物ごとの 大きさ（cottage の size など）。ポンッと出る ときも これを たもつ
  });
  let off = false;   // 町の建物が ない島に いるあいだ（見えない・ぶつからない・うごかせない）
  // 小道: その 建物が もとの 場所に 出ている ときだけ 見せる
  const trails = TRAILS.map((tr) => { const m = trailMesh(tr); m.visible = false; scene.add(m); return { tr, m }; });
  const vis = (it) => {
    it.group.visible = !off && it.shown && !it.stored;
    for (const t of trails) if (`town:${t.tr.for}` === it.id) t.m.visible = it.group.visible && Math.hypot(it.x - it.x0, it.z - it.z0) < 0.5;
  };
  const walls = items.filter((it) => it.r > 0);
  let extraWalls = [];
  let blockers = [];   // 教科の 建物・たまごの 巣（eggs3d.js が 入れかえる）。[{ x, z, r }]
  let lastLv = 0;

  return {
    // pop: false のときは最初から出ておく。true なら、ふえた分だけポンッと出る
    // あたらしく出た建物の [{id,label}] をかえす（レベルアップのおしらせに使う）
    setLevel(lv, pop = true) {
      const fresh = [];
      for (const it of items) {
        const on = lv >= it.lv;
        if (on && !it.shown) {
          it.shown = true;
          vis(it);
          it.pop = pop && lastLv > 0 ? 0 : 1;
          it.group.scale.setScalar(it.pop === 0 ? 0.001 : it.base);
          if (pop && lastLv > 0) fresh.push({ id: it.id, label: it.unlock, lv: it.lv, main: it.id });
        } else if (!on && it.shown) {
          it.shown = false;
          vis(it);
        }
      }
      lastLv = lv;
      return fresh;
    },
    // 町の建物が ある島（はじまりの島）に いるときだけ on。ほかの島では まるごと かくす
    setOn(on) { off = !on; items.forEach(vis); },
    // 子どもがしまった・うごかした分を重ねる。map = { id: { x, z, rot, stored } }。ないものは、もとの場所にもどる
    setOverrides(map) {
      for (const it of items) {
        const o = map?.get ? map.get(it.id) : map?.[it.id];
        it.stored = !!o?.stored;
        it.x = o?.x ?? it.x0; it.z = o?.z ?? it.z0;
        const rot = o?.rot ?? it.rot0;
        it.group.position.set(it.x, heightAt(it.x, it.z), it.z);
        it.group.rotation.y = rot;
        vis(it);
      }
    },
    // いま出ていて、うごかせる建物（しまってあるもの以外）
    movables() { if (off) return []; return items.filter((it) => it.movable && it.shown && !it.stored).map((it) => ({ id: it.id, label: it.label, x: it.x, z: it.z, r: it.r, rot: it.group.rotation.y })); },
    // バッグにしまってある建物
    stored() { if (off) return []; return items.filter((it) => it.movable && it.shown && it.stored).map((it) => ({ id: it.id, label: it.label, r: it.r })); },
    // いま 町に 出ている 建物の 3D（しまってある・ほかの島に いるときは null）。タップの あたり判定に つかう
    groupOf(id) { const it = items.find((x) => x.id === id); return !off && it?.shown && !it.stored && it.pop >= 1 ? it.group : null; },
    // (x,z) のちかくの、うごかせる建物
    itemAt(x, z) {
      if (off) return null;
      let best = null; let bd = 1e9;
      for (const it of items) {
        if (!it.movable || !it.shown || it.stored) continue;
        const d = Math.hypot(x - it.x, z - it.z) - Math.max(it.r, 0.8);
        if (d < 1.4 && d < bd) { bd = d; best = it; }
      }
      return best ? { id: best.id, label: best.label, x: best.x, z: best.z, r: best.r, rot: best.group.rotation.y } : null;
    },
    // ここに置けるか（ほかの建物と かさならない）。r = 置くものの半径。じぶん（selfId）は のぞく
    canPlace(x, z, r, selfId) {
      if (off) return true;
      for (const it of items) {
        if (it.id === selfId || !it.shown || it.stored || it.r <= 0) continue;
        if (Math.hypot(x - it.x, z - it.z) < it.r + r + 0.3) return false;
      }
      for (const b of blockers) if (Math.hypot(x - b.x, z - b.z) < b.r + r + 0.3) return false;
      return true;
    },
    update(dt, t, camPos) {
      for (const tr of trails) if (tr.m.visible) tr.m.userData.update?.(t);
      for (const it of items) {
        if (!it.shown) continue;
        if (it.pop < 1) {
          it.pop = Math.min(1, it.pop + dt / 0.9);
          const k = it.pop - 1;
          const s = 1 + 2.2 * k * k * k + 1.2 * k * k; // ちょっとはねてから止まる
          it.group.scale.setScalar(Math.max(0.001, s * it.base));
        }
        it.group.userData.update?.(t, camPos, it.group.position);
      }
    },
    // 子どもが作った柵・橋の手すりなど（まるい壁の並び）。builds.js が入れかえる
    setWalls(list) { extraWalls = list || []; },
    // 教科の 建物など、町の表（PLAN）に ない 歩けない場所。canPlace でも よける
    setBlockers(list) { blockers = list || []; },
    // 建物の中に入らないよう、外に押しだす。押しだしたら true
    pushOut(pos) {
      let pushed = false;
      for (const w of off ? extraWalls : [...extraWalls, ...blockers]) {
        const dx = pos.x - w.x; const dz = pos.z - w.z;
        const d = Math.hypot(dx, dz);
        const min = w.r + 0.35;
        if (d < min) {
          const k = d > 0.0001 ? min / d : 0;
          pos.x = w.x + (k ? dx * k : min);
          pos.z = w.z + (k ? dz * k : 0);
          pushed = true;
        }
      }
      for (const it of walls) {
        if (off || !it.shown || it.stored || it.pop < 0.6) continue;
        const dx = pos.x - it.x;
        const dz = pos.z - it.z;
        const d = Math.hypot(dx, dz);
        const min = it.r + 0.35;
        if (d < min) {
          const k = d > 0.0001 ? min / d : 0;
          pos.x = it.x + (k ? dx * k : min);
          pos.z = it.z + (k ? dz * k : 0);
          pushed = true;
        }
      }
      return pushed;
    },
  };
}
