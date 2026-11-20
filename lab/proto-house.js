// 試作: うさぽんの 手作りの 家（1軒）。cottage.js の 共通部品（gableHouse・cuteDoor・roundWindow）で 形を 作り、
// mat で 質感を かえる。'clay' = いまの 町と 同じ ねんど、'wood' = ねんど＋扉・わくだけ 木目（2026-11-20 決定）。
// 大きさは 女の子の 背 H = 1.32m が 物差し（扉 1.2H、のき 約1.6H、屋根の てっぺん 約3H）。
import * as THREE from 'three';
import { gableHouse, cuteDoor, roundWindow } from '../js/cottage.js';
import { Bag, rboxGeo, blob, smoke } from '../js/townkit.js';
import { woodTex, texturedMat } from './felt.js';

const H = 1.32;
const ROOF = 0x9fd06a;      // 若草
const CHIMNEY = 0xd9a48a;   // えんとつ（やさしい れんが色の ねんど）
const CHIMNEY_TOP = 0xc98f76;
const WOOD = 0xc78a4f;      // cottage.js の 扉の 木と 同じ 色
const FRAME = 0xe8cf9e;
const TILES = new Set([0xa9d873, 0x94c862]);
const WOODISH = new Set([WOOD, FRAME, 0xa86f3f, 0xd9a066, 0x9a6a3c]);

// 色で 行き先を わける Bag（gableHouse・cuteDoor が 1つの Bag に 足す ものを、屋根・木・そのほかに 分ける）
function splitBag(roofColor) {
  const clay = new Bag(); const roof = new Bag(); const wood = new Bag();
  return {
    clay, roof, wood,
    add(geo, color, o) {
      const c = typeof color === 'number' ? color : new THREE.Color(color).getHex();
      (c === roofColor || TILES.has(c) ? roof : WOODISH.has(c) ? wood : clay).add(geo, color, o);
      return this;
    },
  };
}

export function protoHouse({ mat = 'wood' } = {}) {
  const g = new THREE.Group();
  const b = splitBag(ROOF); const glow = new Bag();
  const W = 2.7; const D = 2.5; const WH = 1.95; const base = 0.18;
  const over = 0.5; const rise = 2.15; const sag = 0.18; const T = 0.36;
  g.add(blob(3.0, 3.1, 0.3));
  const { off, y0, slabD, roofAt } = gableHouse(b, { W, D, WH, base, over, rise, sag, T, roof: ROOF });

  // ねんどの うろこ瓦（2026-11-20 フミオさん「ねんどの 屋根瓦が すき」）。屋根の 上に まるい 瓦を 段ずつ ずらして ならべる。
  // 下の 段ほど 手前に 来るよう、てっぺんから のき へ 少しずつ 重ねる
  const half = W / 2 + over;
  const tile = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);   // 上 半分だけ
  const TILE = [0x9fd06a, 0xa9d873, 0x94c862];
  const rows = 8; const cols = 9;
  for (let r = 0; r < rows; r++) {
    const u = (r + 0.5) / rows;                     // 0 = てっぺん、1 = のき
    for (const xs of [-1, 1]) {
      const x = xs * (0.1 + u * (half - 0.22));
      const slope = (roofAt(x + 0.01) - roofAt(x - 0.01)) / 0.02;
      const ang = Math.atan(slope);
      for (let c = 0; c < cols; c++) {
        const zz = -slabD / 2 + 0.2 + ((c + (r % 2) * 0.5) / cols) * (slabD - 0.4);
        if (zz > slabD / 2 - 0.15) continue;
        b.add(tile, TILE[(r * 7 + c * 3 + (xs > 0 ? 1 : 0)) % 3], { x, y: roofAt(x) - 0.02, z: zz, sx: 0.27, sy: 0.12, sz: 0.22, rz: ang });
      }
    }
  }

  // えんとつ（ふつうの ねんどの 筒。2026-11-20 フミオさん「うさ耳の 煙突は いらない」）
  const cx = 0.72; const cz = -0.5; const cy = roofAt(cx);
  b.add(rboxGeo(0.42, 0.85, 0.42, 0.12), CHIMNEY, { x: cx, y: cy + 0.12, z: cz });
  b.add(rboxGeo(0.5, 0.12, 0.5, 0.05), CHIMNEY_TOP, { x: cx, y: cy + 0.56, z: cz });

  // 正面: 扉（1.2H）は まんなか、左右に まる窓、屋根うらに 小さな まる窓。見せ場は 入口まわりだけ
  const z = D / 2;
  cuteDoor(b, glow, 0, z, 0.92, H * 1.2, FRAME);
  b.add(rboxGeo(1.25, 0.1, 0.6, 0.05), 0xdccaa6, { x: 0, y: 0.05, z: z + 0.33 });
  roundWindow(b, glow, -0.95, base + 1.05, z + 0.02, 0.3);
  roundWindow(b, glow, 0.95, base + 1.05, z + 0.02, 0.3);
  roundWindow(b, glow, 0, y0 + (rise - over) * 0.38, z + 0.02, 0.22);

  const clayMesh = b.clay.mesh(); const roofMesh = b.roof.mesh(); const woodMesh = b.wood.mesh();
  // 2026-11-20 フミオさん: 建物は「ねんど＋木目」（フェルトは 服だけ）。'wood' で 扉・わくに 木目
  if (mat === 'wood') woodMesh.material = texturedMat(woodTex(), 0.8);
  g.add(clayMesh, roofMesh, woodMesh, glow.mesh(true));
  const sm = smoke(cx, cy + 0.8, cz);
  g.add(sm);
  g.userData.update = (t) => sm.userData.tick(t);
  g.userData.footprint = { w: W + 1.6, d: D + 2.2 };   // 草花を よける はんい（入口の 前を 広めに）
  return g;
}
