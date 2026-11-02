// 勉強すると育つ「まなびタウン」。レベルが上がるたびに、草原にひとつずつ建物や景色がふえる。
// 置く場所は決まっているので、いつ開いても同じ街になる。world.js から使う。
import * as THREE from 'three';
import { heightAt } from './terrain.js';

const mats = new Map();
const mat = (color, opts = {}) => {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts }));
  return mats.get(key);
};
const box = (w, h, d, color, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
};
const cyl = (rt, rb, h, color, x = 0, y = 0, z = 0, seg = 12) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.position.set(x, y, z);
  return m;
};
const cone = (r, h, color, x = 0, y = 0, z = 0, seg = 12) => {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color));
  m.position.set(x, y, z);
  return m;
};

// ---- 建物 ---------------------------------------------------------------

function house({ wall = 0xfff1d6, roof = 0xe86a5a, size = 2 } = {}) {
  const g = new THREE.Group();
  const h = size * 0.85;
  g.add(box(size, h, size, wall, 0, h / 2, 0));
  const r = cone(size * 0.86, size * 0.7, roof, 0, h + size * 0.35, 0, 4);
  r.rotation.y = Math.PI / 4;
  g.add(r);
  g.add(box(size * 0.24, size * 0.42, size * 0.24, 0xb8725a, size * 0.28, h + size * 0.45, -size * 0.1)); // えんとつ
  g.add(box(size * 0.26, size * 0.46, 0.06, 0x9a6a4a, 0, size * 0.23, size / 2 + 0.02)); // とびら
  for (const sx of [-1, 1]) {
    g.add(box(size * 0.24, size * 0.24, 0.06, 0xbfe6ff, sx * size * 0.3, h * 0.58, size / 2 + 0.02));
    g.add(box(size * 0.28, size * 0.04, 0.08, 0xffffff, sx * size * 0.3, h * 0.58 - size * 0.14, size / 2 + 0.03));
  }
  return g;
}

function signpost() {
  const g = new THREE.Group();
  g.add(cyl(0.07, 0.09, 1.9, 0x9a6a4a, 0, 0.95, 0, 8));
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
    new THREE.MeshLambertMaterial({ map: tex }), mat(0xc98f4a),
  ]);
  board.position.set(0, 1.6, 0.06);
  g.add(board);
  return g;
}

const BED_COLORS = [0xff8fb3, 0xfff08a, 0xffffff, 0xc7a6ff, 0xffb27a];
function flowerbed() {
  const g = new THREE.Group();
  g.add(cyl(1.6, 1.7, 0.16, 0x8a6a4d, 0, 0.08, 0, 24));
  g.add(cyl(1.45, 1.45, 0.18, 0x6b4f3a, 0, 0.1, 0, 24));
  const heads = [];
  for (let i = 0; i < 26; i++) {
    const a = i * 2.399;
    const r = 0.25 + Math.sqrt(i / 26) * 1.1;
    const s = cyl(0.015, 0.015, 0.4, 0x5fa34a, Math.cos(a) * r, 0.3, Math.sin(a) * r, 4);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mat(BED_COLORS[i % BED_COLORS.length]));
    head.position.set(Math.cos(a) * r, 0.52, Math.sin(a) * r);
    heads.push(head);
    g.add(s, head);
  }
  g.userData.update = (t) => heads.forEach((h, i) => { h.position.y = 0.52 + Math.sin(t * 2 + i) * 0.03; });
  return g;
}

function pond() {
  const g = new THREE.Group();
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 32),
    new THREE.MeshLambertMaterial({ color: 0x6ec6e8, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.05;
  g.add(water);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 + (i % 3) * 0.08, 0), mat(0xb9b3a6));
    s.position.set(Math.cos(a) * 2.45, 0.1, Math.sin(a) * 2.45);
    s.scale.y = 0.6;
    g.add(s);
  }
  const pads = [];
  [[-0.8, 0.5], [0.7, -0.6], [0.9, 0.8]].forEach(([x, z]) => {
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.34, 12), mat(0x5fb86a, { side: THREE.DoubleSide }));
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.07, z);
    pads.push(p);
    g.add(p);
  });
  const lotus = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), mat(0xffb6d0));
  lotus.position.set(0.7, 0.2, -0.6);
  g.add(lotus);
  g.userData.update = (t) => {
    water.material.opacity = 0.88 + Math.sin(t * 1.3) * 0.04;
    pads.forEach((p, i) => { p.rotation.z = Math.sin(t * 0.6 + i) * 0.15; });
  };
  return g;
}

function fence(length = 7) {
  const g = new THREE.Group();
  const n = Math.round(length / 0.9);
  for (let i = 0; i <= n; i++) {
    const x = -length / 2 + (length / n) * i;
    g.add(box(0.12, 0.7, 0.12, 0xf3e3c3, x, 0.35, 0));
  }
  g.add(box(length, 0.08, 0.06, 0xe2cf9f, 0, 0.55, 0));
  g.add(box(length, 0.08, 0.06, 0xe2cf9f, 0, 0.28, 0));
  return g;
}

function windmill() {
  const g = new THREE.Group();
  g.add(cyl(0.65, 1.0, 3.2, 0xfff1d6, 0, 1.6, 0, 10));
  g.add(cone(0.95, 1.1, 0x6fa8dc, 0, 3.75, 0, 10));
  g.add(box(0.5, 0.8, 0.06, 0x9a6a4a, 0, 0.4, 0.97));
  const blades = new THREE.Group();
  blades.position.set(0, 3.2, 0.85);
  blades.add(cyl(0.12, 0.12, 0.3, 0x9a6a4a, 0, 0, 0.05, 8).rotateX(Math.PI / 2));
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    arm.add(box(0.1, 2.5, 0.05, 0xd9b48a, 0, 1.3, 0));
    arm.add(box(0.55, 1.5, 0.04, 0xffffff, 0.3, 1.5, 0.03));
    blades.add(arm);
  }
  g.add(blades);
  g.userData.update = (t) => { blades.rotation.z = -t * 0.9; };
  return g;
}

function school() {
  const g = new THREE.Group();
  g.add(box(5.2, 2.2, 2.6, 0xfff3dc, 0, 1.1, 0));
  g.add(box(5.5, 0.25, 2.9, 0xd9644f, 0, 2.3, 0));
  g.add(box(1.5, 2.2, 1.5, 0xfff3dc, 0, 3.3, 0));
  g.add(cone(1.25, 1.1, 0xd9644f, 0, 5.0, 0, 4).rotateY(Math.PI / 4));
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), mat(0xffffff));
  clock.position.set(0, 3.4, 0.76);
  g.add(clock);
  g.add(box(0.05, 0.3, 0.02, 0x4a4a4a, 0, 3.5, 0.78), box(0.22, 0.05, 0.02, 0x4a4a4a, 0.08, 3.4, 0.78));
  g.add(box(0.9, 1.3, 0.08, 0x9a6a4a, 0, 0.65, 1.32));
  for (const sx of [-1, 1]) {
    for (const k of [1, 2]) {
      g.add(box(0.7, 0.7, 0.06, 0xbfe6ff, sx * k * 1.0 + sx * 0.5, 1.25, 1.32));
    }
  }
  g.add(cyl(0.03, 0.03, 1.5, 0x8a8a8a, 2.9, 1.5, 1.3, 6));
  const flag = box(0.7, 0.4, 0.03, 0xff7a7a, 3.25, 2.05, 1.3);
  g.add(flag);
  g.userData.update = (t) => { flag.rotation.y = Math.sin(t * 3) * 0.25; };
  return g;
}

function fountain() {
  const g = new THREE.Group();
  g.add(cyl(1.9, 2.0, 0.5, 0xd9d4c7, 0, 0.25, 0, 24));
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.7, 24), new THREE.MeshLambertMaterial({ color: 0x8fd6f2 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.46;
  g.add(water);
  g.add(cyl(0.2, 0.3, 1.3, 0xd9d4c7, 0, 0.9, 0, 10));
  g.add(cyl(0.7, 0.25, 0.2, 0xd9d4c7, 0, 1.55, 0, 16));
  const drops = [];
  const dropMat = new THREE.MeshBasicMaterial({ color: 0xc9efff });
  for (let i = 0; i < 24; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), dropMat);
    drops.push(d);
    g.add(d);
  }
  g.userData.update = (t) => {
    drops.forEach((d, i) => {
      const k = (t * 0.9 + i / drops.length) % 1;
      const a = (i / drops.length) * Math.PI * 2 * 3;
      const out = Math.sin(k * Math.PI) * 0.55 + k * 0.9;
      d.position.set(Math.cos(a) * out, 1.65 + Math.sin(k * Math.PI) * 1.1 - k * 0.8, Math.sin(a) * out);
    });
  };
  return g;
}

function rainbow() {
  const g = new THREE.Group();
  [0xff6b6b, 0xffa94d, 0xffe066, 0x8ce99a, 0x74c0fc, 0xb197fc].forEach((c, i) => {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(13 - i * 0.62, 0.34, 8, 64, Math.PI),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.7, fog: false }),
    );
    g.add(arc);
  });
  return g;
}

function tower() {
  const g = new THREE.Group();
  g.add(cyl(1.3, 1.5, 5.2, 0xf4e9ff, 0, 2.6, 0, 14));
  g.add(cyl(1.55, 1.55, 0.3, 0xc7a6ff, 0, 5.3, 0, 14));
  g.add(cone(1.6, 2.2, 0xff8fb3, 0, 6.5, 0, 14));
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
  star.position.y = 8.1;
  g.add(star);
  g.add(box(0.8, 1.3, 0.08, 0x9a6a4a, 0, 0.65, 1.4));
  for (const y of [2.6, 4.0]) g.add(box(0.45, 0.6, 0.06, 0xbfe6ff, 0, y, 1.33));
  for (const sx of [-1, 1]) {
    g.add(cyl(0.55, 0.65, 2.6, 0xf4e9ff, sx * 2.0, 1.3, 0.2, 12));
    g.add(cone(0.75, 1.1, 0x74c0fc, sx * 2.0, 3.15, 0.2, 12));
  }
  g.userData.update = (t) => { star.rotation.y = t * 1.5; star.position.y = 8.1 + Math.sin(t * 2) * 0.12; };
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
  { lv: 2, x: -4, z: -4.5, r: 0, avoid: 2, make: flowerbed },
  { lv: 3, x: -9.5, z: 3.5, r: 2.4, avoid: 3.2, make: pond },
  { lv: 4, x: 8, z: -7, r: 1.35, avoid: 2.2, rot: 0.2, make: () => house() },
  { lv: 5, x: 8, z: -3.8, r: 0, avoid: 4, make: () => fence(7) },
  { lv: 5, x: -10, z: -9, r: 1.35, avoid: 2.2, rot: -0.3, make: () => house({ wall: 0xe3f1ff, roof: 0x5b8def }) },
  { lv: 6, x: 14, z: 3, r: 1.1, avoid: 2.2, rot: -0.5, make: windmill },
  { lv: 7, x: 0, z: -14, r: 3.2, avoid: 4.2, make: school },
  { lv: 8, x: 6.5, z: 8, r: 2.0, avoid: 2.8, make: fountain },
  { lv: 9, x: 0, z: -27, r: 0, avoid: 0, make: rainbow },
  { lv: 10, x: -15, z: -14, r: 1.6, avoid: 3, rot: 0.6, make: tower },
  ...EXTRA_HOUSES.map(([x, z, rot, wall, roof], i) => ({
    lv: 11 + i, x, z, r: 1.3, avoid: 2.2, rot, make: () => house({ wall, roof, size: 1.8 }),
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
    update(dt, t) {
      for (const it of items) {
        if (!it.shown) continue;
        if (it.pop < 1) {
          it.pop = Math.min(1, it.pop + dt / 0.9);
          const k = it.pop - 1;
          const s = 1 + 2.2 * k * k * k + 1.2 * k * k; // ちょっとはねてから止まる
          it.group.scale.setScalar(Math.max(0.001, s));
        }
        it.group.userData.update?.(t);
      }
    },
    // 建物の中に入らないよう、外に押しだす。押しだしたら true
    pushOut(pos) {
      let pushed = false;
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
