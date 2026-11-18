// まなびタウンの 学校（Lv7）。赤い かわら屋根・しっくいの 壁・金の かねの 塔。town.js から使う。
// 形は「大きな 屋根の かたまり ＋ ずんぐりした かべ ＋ 太い 塔」が 主役（2026-11-19 引き算の 作り直し）。
// 細かい ものは 正面の 入口と 窓べだけに あつめる。部品は Bag で ひとつの メッシュに まとめる。
import * as THREE from 'three';
import { mat, box, cyl, cone, ball, blob, Bag, GEO, rboxGeo } from './townkit.js';
import { gableHouse, cuteDoor, archWindow, roundWindow } from './cottage.js';

const WALL = 0xfff0d8;
const ROOF = 0xe5705f;
const WOOD = 0x93603e;
const TRIM = 0xfffaf0;
const STONE = 0xd8d1c1;

// rboxGeo は 作るのに 手間が かかるので、同じ 大きさは 使いまわす
const rbCache = new Map();
const rb = (w, h, d, r = 0.02) => {
  const k = `${w},${h},${d},${r}`;
  if (!rbCache.has(k)) rbCache.set(k, rboxGeo(w, h, d, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)));
  return rbCache.get(k);
};


// 塔の まるまどと 金の かね。かねは 上の つり手を 軸に ゆれる
function bellWindow() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CircleGeometry(0.5, 28), mat(0x9fd3e8)));
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.42, 28), mat(0x7cb9d4));
  inner.position.z = 0.005;
  g.add(inner);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 28), mat(WOOD));
  rim.position.z = 0.01;
  g.add(rim);
  const rim2 = new THREE.Mesh(new THREE.TorusGeometry(0.585, 0.025, 6, 28), mat(TRIM));
  rim2.position.z = 0.01;
  g.add(rim2);
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {   // かなめ石
    const k = box(0.11, 0.13, 0.08, TRIM, Math.sin(a) * 0.56, Math.cos(a) * 0.56, 0.03);
    k.rotation.z = -a;
    g.add(k);
  }
  g.add(box(0.75, 0.07, 0.18, WOOD, 0, -0.6, 0.06));    // まどの 下の 台
  g.add(box(0.05, 0.42, 0.03, WOOD, 0, 0.21, 0.02));    // つり ぼう
  const swing = new THREE.Group();
  swing.position.set(0, 0.22, 0.08);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.03, 6, 20), mat(0xf2bf3e));
  lip.rotation.x = Math.PI / 2;
  lip.position.y = -0.43;
  swing.add(cone(0.24, 0.38, 0xffd45c, 0, -0.24, 0, 16), lip, ball(0.07, 0xffd45c, 0, 0, 0), ball(0.06, 0xd9a83a, 0, -0.46, 0));
  g.add(swing);
  g.userData.swing = swing;
  return g;
}

function bush(b, x, z, s = 1) {
  b.add(GEO.SPH, 0x6fb35e, { x, y: 0.26 * s, z, s: 0.32 * s });
  b.add(GEO.SPH, 0x83c46a, { x: x + 0.28 * s, y: 0.2 * s, z: z + 0.1 * s, s: 0.25 * s });
  b.add(GEO.SPH, 0x78bb64, { x: x - 0.25 * s, y: 0.18 * s, z: z - 0.05 * s, s: 0.22 * s });
  for (let i = 0; i < 4; i++) b.add(GEO.SPH, [0xff8fb3, 0xfff08a][i % 2], { x: x + (i - 1.5) * 0.14 * s, y: (0.3 + (i % 2) * 0.1) * s, z: z + 0.28 * s, s: 0.045 * s });
}

export function school() {
  const g = new THREE.Group();
  const solid = new Bag(); const glow = new Bag();
  g.add(blob(4.4, 3.2, 0.3));
  // 建物の かたまり（ひろい 三角屋根）
  const W = 4.6; const D = 2.8; const WH = 1.7; const base = 0.25;
  const h = gableHouse(solid, { W, D, WH, base, over: 0.45, rise: 1.8, sag: 0.18, T: 0.34, wall: WALL, roof: ROOF, trim: WOOD, plinth: STONE });
  const z = D / 2;
  // 正面: 大きな アーチの とびら と、左右に アーチの 窓（花ばこつき）
  cuteDoor(solid, glow, 0, z, 1.0, 1.7, 0xf2ead8);
  solid.add(rb(1.9, 0.12, 0.6, 0.04), 0xcfc8b8, { y: 0.06, z: z + 0.42 });
  solid.add(rb(1.5, 0.12, 0.45, 0.04), STONE, { y: 0.16, z: z + 0.3 });
  for (const sx of [-1, 1]) archWindow(solid, glow, sx * 1.45, base + 0.55, z, 0.8, 0.98);
  // 横の かべに まる窓 1つずつ
  for (const sx of [-1, 1]) roundWindow(solid, glow, sx * (W / 2 + 0.01), base + 1.05, 0, 0.3, 0xd9a066, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sx * Math.PI / 2));
  // 正面の 三角に 本の しるし（学校の めじるし）
  const badge = new THREE.Group();
  badge.add(new THREE.Mesh(new THREE.CircleGeometry(0.36, 24), mat(0xffd45c)));
  const badgeRim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.06, 8, 24), mat(WOOD));
  badgeRim.position.z = 0.01;
  badge.add(badgeRim);
  for (const sx of [-1, 1]) {
    const page = box(0.24, 0.3, 0.02, 0xffffff, sx * 0.125, 0, 0.02);
    page.rotation.z = sx * -0.12;
    badge.add(page);
  }
  badge.add(box(0.03, 0.3, 0.03, ROOF, 0, 0, 0.03));
  badge.position.set(0, h.y0 + 0.62, z + 0.02);
  g.add(badge);
  // まんなかの 塔（ずんぐり。かねの まど ＋ ふとい とんがり屋根）
  const ridge = h.roofAt(0);
  const tw = 1.5; const tz = -0.15; const tBot = ridge - 0.9; const tTop = ridge + 1.35;
  solid.add(rb(tw, tTop - tBot, tw, 0.16), WALL, { y: (tBot + tTop) / 2, z: tz });
  solid.add(rb(tw + 0.16, 0.14, tw + 0.16, 0.06), WOOD, { y: tTop, z: tz });
  // とんがり屋根（すこし へこんだ 線の まるい 円すい。すそは 外へ はねる）
  const prof = [];
  const RR = 1.12; const HH = 1.9;
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    prof.push(new THREE.Vector2(Math.max(0.001, RR * Math.pow(1 - u, 1.35)), u * HH));
  }
  prof.unshift(new THREE.Vector2(RR * 0.92, -0.12));
  prof.unshift(new THREE.Vector2(0.001, -0.12));
  solid.add(new THREE.LatheGeometry(prof, 28), ROOF, { y: tTop + 0.1, z: tz });
  solid.add(new THREE.TorusGeometry(RR * 0.97, 0.07, 8, 28).rotateX(Math.PI / 2), new THREE.Color(ROOF).multiplyScalar(0.85).getHex(), { y: tTop + 0.04, z: tz });
  g.add(ball(0.14, 0xffd45c, 0, tTop + 0.1 + HH + 0.06, tz), cone(0.08, 0.2, 0xffd45c, 0, tTop + 0.1 + HH + 0.26, tz, 8));
  // 塔の まるまどに 金の かね（前と うしろ）
  const bells = [];
  for (const [zz, rot] of [[tz + tw / 2 + 0.01, 0], [tz - tw / 2 - 0.01, Math.PI]]) {
    const bw = bellWindow();
    bw.position.set(0, ridge + 0.55, zz);
    bw.scale.setScalar(0.78);
    bw.rotation.y = rot;
    g.add(bw);
    bells.push(bw.userData.swing);
  }
  // 旗
  g.add(cyl(0.03, 0.03, 1.8, 0x8a8a8a, 3.0, 0.9, 1.7, 6), ball(0.07, 0xffd45c, 3.0, 1.84, 1.7));
  const flag = new THREE.Group();
  flag.position.set(3.0, 1.55, 1.7);
  flag.add(box(0.8, 0.45, 0.03, 0xff7a7a, 0.4, 0, 0));
  const star = new THREE.Mesh(new THREE.CircleGeometry(0.11, 5), mat(0xfff2b0, { side: THREE.DoubleSide }));
  star.position.set(0.38, 0, 0.02);
  flag.add(star);
  g.add(flag);
  bush(solid, -2.6, 1.85, 1.1); bush(solid, 2.3, 2.0, 0.9);
  g.add(solid.mesh(), glow.mesh(true));
  g.userData.update = (t) => {
    flag.rotation.y = Math.sin(t * 3) * 0.25;
    bells.forEach((b, i) => { b.rotation.z = Math.sin(t * 1.6 + i * 0.4) * 0.12; });
  };
  return g;
}
