// 試作: 世界を 広げる（2026-11-20 フミオさん OK）。js/ の ファイルは さわらず、できあがった お花畑を あとから 直す。
//   1. 地面を k 倍に 広げる（はしっこの 下り坂も k 倍 外へ）。木も k 倍 外へ。
//   2. 草と花は「女の子の まわり だけ」に 生やし、歩くと ついてくる（数は そのまま → 重さは いまと 同じ）。
//      もとの 置き方から 正方形（1辺 L）を 切りだして タイルの ように しきつめ、中心に いちばん 近い 1まいを 使う。
//      ふちは 少しずつ 小さく して、草原が ぷつっと 切れて 見えないように する。
import * as THREE from 'three';

// terrain.js の heightAt と 同じ 形で、はしっこの 位置だけ k 倍（掘る・橋は 試作では 使わない）
export function makeHeight(k) {
  const edge = 25 * k;
  return (x, z) => {
    const r = Math.hypot(x, z);
    let h = 0.22 * Math.sin(x * 0.13 + 0.7) * Math.cos(z * 0.11 - 0.4) + 0.12 * Math.sin(x * 0.29 + z * 0.21 + 2.0);
    if (r > edge) { const d = r - edge; h -= 0.03 * d * d; }
    return h;
  };
}
const noise = (x, z) => 0.5 + 0.25 * Math.sin(x * 0.21 + Math.sin(z * 0.17) * 2) + 0.25 * Math.sin(z * 0.13 - x * 0.09 + 1.3);

export function widenWorld(scene, meadow, { k = 1.5, heightAt }) {
  // 地面: meadow.js の makeGround と 同じ 色の つけ方で、半径だけ k 倍（材質は そのまま 使う）
  const geo = new THREE.RingGeometry(0.01, 46 * k, 360, Math.round(92 * k));
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; const col = new Float32Array(pos.count * 3);
  const a = new THREE.Color(0x88b257); const b = new THREE.Color(0xb3cb6a); const c = new THREE.Color(0x6fa04f); const t = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i); const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    const n = noise(x * 1.4, z * 1.4);
    t.copy(a).lerp(b, Math.max(0, n - 0.45) * 1.6).lerp(c, Math.max(0, 0.45 - n) * 1.2);
    col.set([t.r, t.g, t.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  meadow.ground.geometry.dispose();
  meadow.ground.geometry = geo;

  // 木（中に canopy を もつ グループ）を k 倍 外へ
  for (const o of scene.children) {
    if (o.isGroup && o.children[0]?.userData?.canopy) {
      o.position.x *= k; o.position.z *= k;
      o.position.y = heightAt(o.position.x, o.position.z) - 0.05;
    }
  }
}

// 草花を ついてくる ように する。avoid(x, z) の ところ（家の 下 など）には 出さない
export function followMeadow(scene, { heightAt, half = 19, fadeFrom = 13, avoid = () => false, edge = 37.5 }) {
  const L = half * 2;
  const meshes = [];
  scene.traverse((o) => { if (o.isInstancedMesh && o.userData.orig) meshes.push(o); });
  // もとの 正方形の 中の ものだけ 使う。かたち（回転・大きさ）は もとの まま、場所だけ 動かす
  const sets = meshes.map((m) => {
    const o = m.userData.orig; const n = o.length / 16;
    const keep = [];
    for (let i = 0; i < n; i++) if (Math.abs(o[i * 16 + 12]) < half && Math.abs(o[i * 16 + 14]) < half) keep.push(i);
    const a = m.instanceMatrix.array;
    a.fill(0);
    m.count = keep.length;
    if (m.instanceColor) {   // 色も つめなおす
      const src = m.instanceColor.array.slice();
      keep.forEach((i, j) => { for (let q = 0; q < 3; q++) m.instanceColor.array[j * 3 + q] = src[i * 3 + q]; });
      m.instanceColor.needsUpdate = true;
    }
    return { m, o, keep };
  });
  const last = new THREE.Vector2(1e9, 1e9);
  function update(cx, cz, force = false) {
    if (!force && Math.hypot(cx - last.x, cz - last.y) < 0.4) return;
    last.set(cx, cz);
    for (const { m, o, keep } of sets) {
      const a = m.instanceMatrix.array;
      for (let j = 0; j < keep.length; j++) {
        const s = keep[j] * 16; const d = j * 16;
        const x = o[s + 12] + L * Math.round((cx - o[s + 12]) / L);
        const z = o[s + 14] + L * Math.round((cz - o[s + 14]) / L);
        const r = Math.hypot(x - cx, z - cz);
        let f = r < fadeFrom ? 1 : Math.max(0, (half - r) / (half - fadeFrom));
        if (f > 0 && (Math.hypot(x, z) > edge || avoid(x, z))) f = 0;
        for (let q = 0; q < 12; q++) a[d + q] = o[s + q] * f;
        a[d + 12] = x; a[d + 13] = heightAt(x, z) - 0.02; a[d + 14] = z; a[d + 15] = 1;
      }
      m.instanceMatrix.needsUpdate = true;
    }
  }
  return { update };
}
