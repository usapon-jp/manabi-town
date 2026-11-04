// 勉強すると育つ「まなびタウン」。レベルが上がるたびに、草原にひとつずつ建物や景色がふえる。
// 置く場所は決まっているので、いつ開いても同じ街になる。world.js から使う。
import * as THREE from 'three';
import { heightAt } from './terrain.js';

import { cottage, mushroomHouse, bed } from './cottage.js';
import { mat, glass, box, cyl, cone, ball, softDot, blob, smoke } from './townkit.js';

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
  x.fillStyle = '#6b4a2b'; x.font = 'bold 76px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
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

function school() {
  const g = new THREE.Group();
  const wall = 0xfff0d8; const roof = 0xe5705f;
  g.add(blob(4.6, 3.2, 0.3));
  g.add(box(5.6, 0.2, 3.0, 0xbdb6a6, 0, 0.1, 0));
  g.add(box(5.2, 2.1, 2.6, wall, 0, 1.25, 0));
  const wood = 0x93603e;
  for (const sx of [-2.6, 2.6]) g.add(box(0.14, 2.1, 0.14, wood, sx, 1.25, 1.3));
  // 本棟の屋根（前後むき山がた）
  const rise = 1.1;
  const r1 = gable(5.2, 2.6, rise, roof, 0.3);
  r1.position.y = 2.3;
  g.add(r1);
  for (const sz of [-1, 1]) { const gw = gableWall(5.2, rise, wall, sz * 1.3); gw.position.y = 2.3; g.add(gw); }
  // まんなかの時計塔
  g.add(box(1.5, 3.0, 1.5, wall, 0, 3.95, 0.3));
  g.add(box(1.7, 0.14, 1.7, wood, 0, 5.52, 0.3));
  const spire = cone(1.2, 1.7, roof, 0, 6.45, 0.3, 4);
  spire.rotation.y = Math.PI / 4;
  g.add(spire);
  g.add(ball(0.13, 0xffd45c, 0, 7.35, 0.3));
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.5, 28), mat(0xffffff));
  face.position.set(0, 4.6, 1.06);
  g.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 28), mat(wood));
  rim.position.set(0, 4.6, 1.07);
  g.add(rim);
  const hand1 = box(0.05, 0.34, 0.02, 0x4a4a4a, 0, 4.7, 1.09);
  const hand2 = box(0.04, 0.24, 0.02, 0x4a4a4a, 0, 4.6, 1.09);
  g.add(hand1, hand2);
  g.add(box(0.5, 0.55, 0.06, 0xffe6a6, 0, 5.1, 1.06)).children.at(-1).material = glass;
  // げんかん
  const door = new THREE.Group();
  archDoor(door, 0, 0, 0, 0.95, 1.5);
  door.position.set(0, 0.2, 1.33);
  g.add(door);
  g.add(box(2.0, 0.1, 0.6, 0xcfc8b8, 0, 0.25, 1.6), box(1.6, 0.1, 0.45, 0xd8d1c1, 0, 0.3, 1.65));
  for (const sx of [-1, 1]) {
    windowAt(g, sx * 1.05, 1.35, 1.32, 0.42, 0.62, 0x7fb8a4, true);
    windowAt(g, sx * 1.95, 1.35, 1.32, 0.42, 0.62, 0x7fb8a4, true);
  }
  // 旗とばんてい（三角旗）
  g.add(cyl(0.03, 0.03, 1.8, 0x8a8a8a, 3.1, 0.9, 1.5, 6));
  const flag = box(0.8, 0.45, 0.03, 0xff7a7a, 3.5, 1.55, 1.5);
  g.add(flag);
  const cols = [0xff8fb3, 0xfff08a, 0x8fd6f2, 0x9fe0a0, 0xc7a6ff, 0xffb27a];
  for (let i = 0; i < 12; i++) {
    const x = -2.5 + (i / 11) * 5;
    const tri = new THREE.Mesh(new THREE.CircleGeometry(0.15, 3), mat(cols[i % cols.length], { side: THREE.DoubleSide }));
    tri.rotation.z = Math.PI;
    tri.position.set(x, 2.2 - Math.sin((i / 11) * Math.PI) * 0.25 + 0.0, 1.5);
    g.add(tri);
  }
  g.add(bush(-2.9, 1.7, 1.1), bush(2.4, 1.85, 1.0), bush(-1.6, 1.9, 0.8));
  g.userData.update = (t) => { flag.rotation.y = Math.sin(t * 3) * 0.25; };
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
  g.userData.update = (t, cam, pos) => {
    if (cam) g.rotation.y = Math.atan2(cam.x - pos.x, cam.z - pos.z);
    sparkles.forEach((s, i) => {
      const a = (i / sparkles.length) * Math.PI + Math.sin(t * 0.3 + i) * 0.04;
      const r = 11.5 + ((i * 7) % 5) * 0.9;
      s.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.2);
      s.material.opacity = 0.3 + 0.5 * Math.max(0, Math.sin(t * 1.6 + i * 1.9));
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
  for (const [y, a] of [[2.6, 0.5], [3.9, -0.5], [4.8, 0.9], [2.4, -1.2]]) {
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
  { lv: 4, x: 8, z: -7.5, r: 1.6, avoid: 3.4, rot: 0.15, make: () => cottage({ roof: 0xa9d95f }) },
  { lv: 5, x: 8, z: -2.2, r: 0, avoid: 4, make: () => fence(7) },
  { lv: 5, x: -10, z: -9, r: 1.55, avoid: 3.4, rot: -0.25, make: () => mushroomHouse() },
  { lv: 6, x: 14, z: 3, r: 1.1, avoid: 2.2, rot: -0.5, make: windmill },
  { lv: 7, x: 0, z: -14, r: 3.2, avoid: 4.2, make: school },
  { lv: 8, x: 6.5, z: 8, r: 2.0, avoid: 2.8, make: fountain },
  { lv: 9, x: 0, z: -31, r: 0, avoid: 0, make: rainbow },
  { lv: 10, x: -15, z: -14, r: 1.6, avoid: 3, rot: 0.6, make: tower },
  ...EXTRA_HOUSES.map(([x, z, rot, wall, roof], i) => ({
    lv: 11 + i, x, z, r: 1.3, avoid: 2.2, rot, make: () => (i % 2 ? mushroomHouse({ cap: roof, size: 0.8, withBed: false }) : cottage({ roof, size: 0.8, withBed: false })),
  })),
];

// 草や木をよけるための判定（建物が出る前から場所をあけておく）
export function isTownSpot(x, z, pad = 0) {
  return PLAN.some((p) => p.avoid > 0 && Math.hypot(x - p.x, z - p.z) < p.avoid + pad);
}

export function createTown(scene) {
  const items = PLAN.map((p) => {
    const group = p.make();
    group.position.set(p.x, heightAt(p.x, p.z), p.z);
    group.rotation.y = p.rot || 0;
    group.visible = false;
    scene.add(group);
    return { ...p, group, shown: false, pop: 1 };
  });
  const walls = items.filter((it) => it.r > 0);
  let extraWalls = [];
  let lastLv = 0;

  return {
    // pop: false のときは最初から出ておく。true なら、ふえた分だけポンッと出る
    setLevel(lv, pop = true) {
      for (const it of items) {
        const on = lv >= it.lv;
        if (on && !it.shown) {
          it.shown = true;
          it.group.visible = true;
          it.pop = pop && lastLv > 0 ? 0 : 1;
          it.group.scale.setScalar(it.pop === 0 ? 0.001 : 1);
        } else if (!on && it.shown) {
          it.shown = false;
          it.group.visible = false;
        }
      }
      lastLv = lv;
    },
    update(dt, t, camPos) {
      for (const it of items) {
        if (!it.shown) continue;
        if (it.pop < 1) {
          it.pop = Math.min(1, it.pop + dt / 0.9);
          const k = it.pop - 1;
          const s = 1 + 2.2 * k * k * k + 1.2 * k * k; // ちょっとはねてから止まる
          it.group.scale.setScalar(Math.max(0.001, s));
        }
        it.group.userData.update?.(t, camPos, it.group.position);
      }
    },
    // 子どもが作った柵・橋の手すりなど（まるい壁の並び）。builds.js が入れかえる
    setWalls(list) { extraWalls = list || []; },
    // 建物の中に入らないよう、外に押しだす。押しだしたら true
    pushOut(pos) {
      let pushed = false;
      for (const w of extraWalls) {
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
        if (!it.shown || it.pop < 0.6) continue;
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
