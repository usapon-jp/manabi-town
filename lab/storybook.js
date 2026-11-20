// 試作シーン「絵本の村」: いまの お花畑（meadow.js）に、試作の 家1軒・女の子（いまの モデル）・ピヨ先生だけを 置く。
// 公開版の 町（world.js）とは 別の ページ。保存には さわらない（プロフィールを 読まない）。
// アドレスで ためす:
//   ?mat=wood|clay   家の 質感（wood = ねんど＋扉と わくだけ 木目。2026-11-20 決定）
//   ?clear=1         女の子の 足もとの 草花を よける（あり／なしの 比較用）
//   ?t=16            町の 時刻（daytime.js の 分。あさ 4.5・ひる 16・ゆうがた 39・よる 52）
//   ?cam=game|wide   カメラ（game = いまの ゲームと 同じ きょり、wide = 引き）
//   ?zones=0         花の ところ／短い 草の ところ を わけない（いまの お花畑の まま。2026-11-20 試し）
//   ?fs=0.67         花の 大きさ（zones の とき。ふつう 2/3）
//   ?hud=0           左上の 数字を かくす
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

const P = new URLSearchParams(location.search);
const MAT = P.get('mat') || 'wood';
const CLEAR = P.get('clear') === '1';
const MINUTE = Number(P.get('t') ?? 16);
const CAM = P.get('cam') || 'game';
const ZONES = P.get('zones') !== '0';
const FS = Number(P.get('fs') ?? 2 / 3);

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

// ---- 家（女の子の 前、すこし 奥） ----
const HOUSE = { x: -0.4, z: -4.6 };
const house = protoHouse({ mat: MAT });
house.position.set(HOUSE.x, 0, HOUSE.z);
scene.add(house);

// ---- 女の子（いまの girl.glb）と ピヨ先生 ----
const GIRL = new THREE.Vector3(0.5, 0, 0);
const girl = new THREE.Group(); girl.position.copy(GIRL); girl.rotation.y = 0.35; scene.add(girl);
const girlDef = partOf('body:girl');
const gs = softShadow(girlDef.height * 0.3, 0.3); gs.position.set(GIRL.x, 0.02, GIRL.z); scene.add(gs);
let girlReady = false;
mountAvatar(girl, lookOf(null), () => { girlReady = true; });

const PIYO = new THREE.Vector3(1.55, 0, 0.55);
const piyo = new THREE.Group(); piyo.position.copy(PIYO); piyo.rotation.y = -0.25; scene.add(piyo);
const ps = softShadow(0.72 * 0.3, 0.3); ps.position.set(PIYO.x, 0.02, PIYO.z); scene.add(ps);
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
if (ZONES) {
  zoneMeadow(scene, {
    fs: FS,
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
const fp = house.userData.footprint;
meadow.clearTown((x, z) => {
  const dx = x - HOUSE.x; const dz = z - HOUSE.z;
  if (Math.abs(dx) < fp.w / 2 && dz > -fp.d / 2 && dz < fp.d / 2 + 0.6) return true;
  if (Math.abs(x - (HOUSE.x + (GIRL.x - HOUSE.x) * ((z - HOUSE.z) / (GIRL.z - HOUSE.z)))) < 0.55 && z > HOUSE.z && z < GIRL.z - 0.3) return true;
  if (CLEAR && Math.hypot(x - GIRL.x, z - GIRL.z) < 1.4) return true;
  return false;
});

// ---- カメラ ----
function placeCamera() {
  if (CAM === 'wide') { camera.position.set(6.5, 5.6, 9.5); camera.lookAt(-0.2, 1.3, -2.4); return; }
  // いまの ゲームと 同じ きょり（world.js の view: dist 6.6・height 2.05・lookY 1.25）。女の子の 正面 すこし 右から
  camera.position.set(GIRL.x + 1.6, 2.05, GIRL.z + 6.4);
  camera.lookAt(GIRL.x - 0.3, 1.25, GIRL.z - 1.2);
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
  meadow.update(dt, t, GIRL, camera.position, MINUTE);
  house.userData.update?.(t);
  renderer.render(scene, camera);
  frames++; acc += dt;
  if (acc > 0.5) { fps = frames / acc; frames = 0; acc = 0; }
  const info = renderer.info.render;
  hud.innerHTML = `描画 ${info.calls} 回 ・ 三角形 ${(info.triangles / 10000).toFixed(1)}万 ・ ${fps.toFixed(0)} fps<br>`
    + `質感 ${MAT === 'wood' ? 'ねんど＋木目' : 'ねんど'} ・ 足もと ${CLEAR ? 'よける' : 'そのまま'} ・ 花畑 ${ZONES ? `むら（花 ${FS.toFixed(2)}倍）` : 'いまのまま'}<br>`
    + '<a href="lab/storybook.html?mat=wood">ねんど＋木目</a><a href="lab/storybook.html?mat=clay">ねんど</a>'
    + `<a href="lab/storybook.html?mat=${MAT}&clear=${CLEAR ? 0 : 1}">足もと切りかえ</a>`
    + `<a href="lab/storybook.html?mat=${MAT}&zones=${ZONES ? 0 : 1}">花畑 切りかえ</a>`
    + `<a href="lab/storybook.html?mat=${MAT}&t=39">ゆうがた</a><a href="lab/storybook.html?mat=${MAT}&cam=wide">引き</a>`;
  if (girlReady && piyoReady && t > 1.5) window.READY = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
