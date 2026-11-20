// 試作シーン「絵本の村」: いまの お花畑（meadow.js）に、試作の 家1軒・女の子（いまの モデル）・ピヨ先生だけを 置く。
// 公開版の 町（world.js）とは 別の ページ。保存には さわらない（プロフィールを 読まない）。
// アドレスで ためす:
//   ?mat=wood|clay   家の 質感（wood = ねんど＋扉と わくだけ 木目。2026-11-20 決定）
//   ?clear=1         女の子の 足もとの 草花を よける（あり／なしの 比較用）
//   ?t=16            町の 時刻（daytime.js の 分。あさ 4.5・ひる 16・ゆうがた 39・よる 52）
//   ?cam=game|wide|top   カメラ（game = いまの ゲームと 同じ きょり、wide = 引き、top = 町ぜんたいを 上から）
//   ?zones=1         花の ところ／短い 草の ところ を わける（2026-11-20 試し → さみしい、で 見送り）
//   ?fs=0.67         花の 大きさ（ふつう 2/3、1 = いまの まま）
//   ?gs=0.75         草の 背（ふつう 0.75、1 = いまの まま）
//   ?more=1          花を ふやす 割合（1 = 2倍、0 = いまの 数）
//   ?big=1.5         女の子・ピヨ先生・家の 大きさ（1 = いまの ゲーム）。カメラも 同じ 倍率で 引く
//   ?world=1.5       地面の 広さ（ふつう big と 同じ。1 = いまの まま）。町の 建物の 場所も この 倍率で 広げて 目じるしを 置く
//   ?follow=0        草花を ついてこさせない（いまの 置き方。follow=1 が ふつう）
//   ?walk=…          自動で 歩く（画像を とる 用。例 walk=-14,-12 で その 場所へ）
//   ?hud=0           左上の 数字を かくす
// うごかし方: 矢印キー / WASD（Shift で 走る）、または 画面を 指で なぞる
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyWorldLook } from '../js/worldlook.js';
import { createMeadow } from '../js/meadow.js';
import { mountAvatar } from '../js/avatar3d.js';
import { lookOf, partOf } from '../js/avatar.js';
import { CHARACTERS } from '../js/characters.js';
import { picturebook, softShadow } from '../js/picturebook.js';
import { protoHouse } from './proto-house.js';
import { zoneMeadow } from './meadow-zones.js';
import { makeHeight, widenWorld, followMeadow } from './bigworld.js';

const P = new URLSearchParams(location.search);
const MAT = P.get('mat') || 'wood';
const CLEAR = P.get('clear') === '1';
const MINUTE = Number(P.get('t') ?? 16);
const CAM = P.get('cam') || 'game';
const ZONES = P.get('zones') === '1';   // ふつうは いまの 置き方（花の 大きさ だけ fs 倍）
// 2026-11-20 フミオさん「女の子を 大きくして、お花畑は 今のまま」→ ふつうは 草花 そのまま、BIG で キャラと 家を 大きく
const FS = Number(P.get('fs') ?? 1);       // 花の 大きさ
const GS = Number(P.get('gs') ?? 1);       // 草の 背
const MORE = Number(P.get('more') ?? 0);   // 花を ふやす 割合（1 = 2倍）
const BIG = Number(P.get('big') ?? 1.5);
const WK = Number(P.get('world') ?? BIG);   // 地面の 広さ
const FOLLOW = P.get('follow') !== '0';
const WALK = P.get('walk')?.split(',').map(Number);
const heightAt = makeHeight(WK);   // 2026-11-20 フミオさん 1.5 に決定（ピヨの顔が草の上に出て見やすい）   // 女の子・ピヨ先生・家の 大きさ（いまの ゲーム = 1）。カメラも 同じ 倍率で 引く

const stage = document.getElementById('stage');
const hud = document.getElementById('hud');
if (P.get('hud') === '0') hud.style.display = 'none';

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
stage.appendChild(renderer.domElement);
applyWorldLook(renderer);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 220);
const meadow = createMeadow(scene);
meadow.setPixelRatio(renderer.getPixelRatio());
if (WK !== 1) widenWorld(scene, meadow, { k: WK, heightAt });

// ---- 家（女の子の 前、すこし 奥） ----
const HOUSE = { x: 0.5 + (-0.4 - 0.5) * BIG, z: -4.6 * BIG };   // 女の子との きょりも BIG 倍
const house = protoHouse({ mat: MAT });
house.position.set(HOUSE.x, heightAt(HOUSE.x, HOUSE.z), HOUSE.z); house.scale.setScalar(BIG);
scene.add(house);

// ---- 町の 建物の 場所の 目じるし（town.js の 置き場所 × WK。歩いて きょりを ためす） ----
// いまの 町: 小さな家 (8.5,-8)・きのこの家 (-10.5,-9.5)・学校 (0,-14)・風車 (14,3)・塔 (-15,-14)・ふんすい (6.5,8)・池 (-9.5,3.5)
const SPOTS = [[8.5, -8, 1.35, 0x8fcf5a], [-10.5, -9.5, 1.4, 0xf29bb0], [0, -14, 1.9, 0xc7a6ff], [14, 3, 1.2, 0xf4d47a], [-15, -14, 1.3, 0x9ec9f0], [6.5, 8, 0.8, 0xa9d873], [-9.5, 3.5, 0.8, 0x9ec9f0]];
const town = SPOTS.map(([x0, z0, size, roof]) => {
  const h = protoHouse({ mat: MAT, roof });
  const x = x0 * WK; const z = z0 * WK;
  h.position.set(x, heightAt(x, z), z); h.scale.setScalar(BIG * size * 0.5); h.rotation.y = Math.atan2(-x, -z);   // 入口を 町の まん中へ
  scene.add(h);
  return h;
});

// ---- 女の子（いまの girl.glb）と ピヨ先生 ----
const GIRL = new THREE.Vector3(0.5, 0, 0);
const girl = new THREE.Group(); girl.position.copy(GIRL); girl.rotation.y = 0.35; girl.scale.setScalar(BIG); scene.add(girl);
const girlDef = partOf('body:girl');
const gs = softShadow(girlDef.height * 0.3 * BIG, 0.3); gs.position.set(GIRL.x, 0.02, GIRL.z); scene.add(gs);
girl.position.y = heightAt(GIRL.x, GIRL.z);
let girlReady = false;
mountAvatar(girl, lookOf(null), () => { girlReady = true; });

const PIYO = new THREE.Vector3(0.5 + 1.05 * BIG, 0, 0.55 * BIG);
const piyo = new THREE.Group(); piyo.position.copy(PIYO); piyo.rotation.y = -0.25; piyo.scale.setScalar(BIG); scene.add(piyo);
const ps = softShadow(0.72 * 0.3 * BIG, 0.3); ps.position.set(PIYO.x, 0.02, PIYO.z); scene.add(ps);
let piyoReady = false;
new GLTFLoader().load(CHARACTERS.piyo.model, (gltf) => {
  const model = gltf.scene;
  model.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  picturebook(model, CHARACTERS.piyo.style);
  const box = new THREE.Box3().setFromObject(model); const size = box.getSize(new THREE.Vector3());
  const s = 0.72 / (size.y || 1);
  model.scale.setScalar(s); model.position.y = -box.min.y * s;
  piyo.add(model); piyoReady = true;
}, undefined, () => { piyoReady = true; });

// ---- 花の ところ と 短い 草の ところ（家の まえ・女の子の まわりは 短い 草の 広場） ----
if (ZONES || FS !== 1 || GS !== 1 || MORE > 0) {
  zoneMeadow(scene, {
    zones: ZONES,
    fs: FS,
    gs: GS,
    more: MORE,
    avoid: (x, z) => Math.abs(x - HOUSE.x) < 2.9 && Math.abs(z - HOUSE.z) < 2.4,
    // カメラから 見える ところに 花の かたまりを いくつか（女の子・家の まわりは 短い 草の 広場）
    beds: [{ x: -2.8, z: 1.2, r: 1.8 }, { x: 3.3, z: 1.8, r: 1.7 }, { x: 3.0, z: -3.6, r: 2.0 }, { x: -4.2, z: -3.2, r: 2.2 }, { x: -1.4, z: 4.6, r: 1.4 }],
    keepShort: (x, z) => {
      const d1 = Math.hypot(x - HOUSE.x, (z - HOUSE.z - 1.2) * 1.1);
      const d2 = Math.hypot(x - GIRL.x, z - GIRL.z);
      return Math.max(1 - Math.min(1, Math.max(0, (d1 - 2.2) / 1.0)), 1 - Math.min(1, Math.max(0, (d2 - 0.9) / 1.0)));
    },
  });
}

// ---- 草花を よける（家の まわり・入口から 女の子までの 小道。clear=1 なら 女の子の 足もとも） ----
const fp = { w: house.userData.footprint.w * BIG, d: house.userData.footprint.d * BIG };
// 家の 下（目じるしの 家も）には 草花を 出さない
const houseAvoid = (x, z) => [house, ...town].some((h) => {
  const w = h.userData.footprint.w * h.scale.x * 0.5; const d = h.userData.footprint.d * h.scale.x * 0.5;
  const c = Math.cos(-h.rotation.y); const sn = Math.sin(-h.rotation.y);
  const dx = x - h.position.x; const dz = z - h.position.z;
  const u = dx * c - dz * sn; const v = dx * sn + dz * c;
  return Math.abs(u) < w && Math.abs(v) < d;
});
const follow = FOLLOW ? followMeadow(scene, { heightAt, avoid: houseAvoid, edge: 25 * WK + 1 }) : null;
if (!FOLLOW) meadow.clearTown((x, z) => {
  const dx = x - HOUSE.x; const dz = z - HOUSE.z;
  if (Math.abs(dx) < fp.w / 2 && dz > -fp.d / 2 && dz < fp.d / 2 + 0.6) return true;
  if (Math.abs(x - (HOUSE.x + (GIRL.x - HOUSE.x) * ((z - HOUSE.z) / (GIRL.z - HOUSE.z)))) < 0.55 && z > HOUSE.z && z < GIRL.z - 0.3) return true;
  if (CLEAR && Math.hypot(x - GIRL.x, z - GIRL.z) < 1.4) return true;
  return false;
});

// ---- カメラ ----
const keys = new Set();
addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
let drag = null;   // 指で なぞる: はじめに さわった 所からの ずれで 向きと 速さ
stage.addEventListener('pointerdown', (e) => { drag = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY }; stage.setPointerCapture(e.pointerId); });
stage.addEventListener('pointermove', (e) => { if (drag) { drag.x = e.clientX; drag.y = e.clientY; } });
stage.addEventListener('pointerup', () => { drag = null; });
const SPEED = 1.6 * 1.25 * BIG;   // いまの ゲームの 歩く 速さ（1.6m/秒 × 1.25）を 背に あわせて BIG 倍
let walked = 0;
function moveGirl(dt) {
  let mx = 0; let mz = 0; let run = 1;
  if (keys.has('arrowleft') || keys.has('a')) mx -= 1;
  if (keys.has('arrowright') || keys.has('d')) mx += 1;
  if (keys.has('arrowup') || keys.has('w')) mz -= 1;
  if (keys.has('arrowdown') || keys.has('s')) mz += 1;
  if (keys.has('shift')) run = 2.4 / 1.25;
  if (drag) { const dx = drag.x - drag.x0; const dz = drag.y - drag.y0; const l = Math.hypot(dx, dz); if (l > 8) { mx = dx / l; mz = dz / l; run = l > 90 ? 2.4 / 1.25 : 1; } }
  if (WALK) { const dx = WALK[0] - GIRL.x; const dz = WALK[1] - GIRL.z; const l = Math.hypot(dx, dz); if (l > 0.3) { mx = dx / l; mz = dz / l; run = 2.4 / 1.25; } }
  const l = Math.hypot(mx, mz);
  if (!l) return;
  const step = SPEED * run * dt;
  const nx = GIRL.x + (mx / l) * step; const nz = GIRL.z + (mz / l) * step;
  if (Math.hypot(nx, nz) > 25 * WK - 1) return;   // はしっこ
  GIRL.set(nx, 0, nz); walked += step;
  girl.rotation.y = Math.atan2(mx, mz);
}
function placeCamera() {
  const k = BIG;
  if (CAM === 'top') { scene.fog = null; }
  if (CAM === 'top') { camera.position.set(0, 95 * WK / 1.5, 30 * WK / 1.5); camera.lookAt(0, 0, -2); return; }   // 町ぜんたいを 上から
  if (CAM === 'wide') { camera.position.set(GIRL.x + 6.0 * k, 5.6 * k, 9.5 * k); camera.lookAt(GIRL.x - 0.7 * k, 1.3 * k, -2.4 * k); return; }
  // いまの ゲームと 同じ きょり（world.js の view: dist 6.6・height 2.05・lookY 1.25）。女の子の 正面 すこし 右から
  const gy = heightAt(GIRL.x, GIRL.z);
  camera.position.set(GIRL.x + 1.6 * k, gy + 2.05 * k, GIRL.z + 6.4 * k);
  camera.lookAt(GIRL.x - 0.3 * k, gy + 1.25 * k, GIRL.z - 1.2 * k);
}
function resize() {
  const w = stage.clientWidth; const h = stage.clientHeight;
  renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize(); placeCamera();

// ---- 1こま ----
const clock = new THREE.Clock();
let t = 0; let frames = 0; let acc = 0; let fps = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  t += dt;
  moveGirl(dt);
  girl.position.set(GIRL.x, heightAt(GIRL.x, GIRL.z), GIRL.z); gs.position.set(GIRL.x, girl.position.y + 0.02, GIRL.z);
  // ピヨ先生は 女の子の 右うしろに ついてくる
  const want = new THREE.Vector3(GIRL.x + 1.05 * BIG, 0, GIRL.z + 0.55 * BIG);
  piyo.position.x += (want.x - piyo.position.x) * Math.min(1, dt * 2.5); piyo.position.z += (want.z - piyo.position.z) * Math.min(1, dt * 2.5);
  piyo.position.y = heightAt(piyo.position.x, piyo.position.z); ps.position.set(piyo.position.x, piyo.position.y + 0.02, piyo.position.z);
  placeCamera();
  follow?.update(GIRL.x, GIRL.z);
  meadow.update(dt, t, GIRL, camera.position, MINUTE);
  for (const h of town) h.userData.update?.(t);
  house.userData.update?.(t);
  renderer.render(scene, camera);
  frames++; acc += dt;
  if (acc > 0.5) { fps = frames / acc; frames = 0; acc = 0; }
  const info = renderer.info.render;
  hud.innerHTML = `描画 ${info.calls} 回 ・ 三角形 ${(info.triangles / 10000).toFixed(1)}万 ・ ${fps.toFixed(0)} fps<br>`
    + `質感 ${MAT === 'wood' ? 'ねんど＋木目' : 'ねんど'} ・ 足もと ${CLEAR ? 'よける' : 'そのまま'} ・ 花畑 ${ZONES ? 'むら' : 'いまの置き方'}（花 ${FS.toFixed(2)}倍・草 ${GS.toFixed(2)}倍・数 ${(1 + MORE).toFixed(1)}倍）・キャラと家 ${BIG.toFixed(2)}倍・地面 ${WK.toFixed(2)}倍・草花 ${FOLLOW ? 'ついてくる' : '全体'}<br>`
    + `いる場所 (${GIRL.x.toFixed(1)}, ${GIRL.z.toFixed(1)}) ・ 中心から ${Math.hypot(GIRL.x, GIRL.z).toFixed(1)}m ・ 歩いた ${walked.toFixed(0)}m ・ 矢印キー／WASD／指でなぞる で 歩く<br>`
    + '<a href="lab/storybook.html?mat=wood">ねんど＋木目</a><a href="lab/storybook.html?mat=clay">ねんど</a>'
    + `<a href="lab/storybook.html?mat=${MAT}&clear=${CLEAR ? 0 : 1}">足もと切りかえ</a>`
    + `<a href="lab/storybook.html?mat=${MAT}&zones=${ZONES ? 0 : 1}">花畑 切りかえ</a>`
    + `<a href="lab/storybook.html?mat=${MAT}&t=39">ゆうがた</a><a href="lab/storybook.html?mat=${MAT}&cam=wide">引き</a>`;
  const arrived = !WALK || Math.hypot(WALK[0] - GIRL.x, WALK[1] - GIRL.z) <= 0.3;
  if (girlReady && piyoReady && t > 1.5 && arrived) window.READY = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
