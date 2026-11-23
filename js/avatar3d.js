// 町の主人公の 3D。台帳と保存は js/avatar.js。
// - 体の行に model（GLB）が あれば それを読み、部品（髪・服・くつ）は GLB の中の メッシュを 出す／かくす で付けかえる
// - model が ない・読めないときは、ここで コードで作る 仮の すがた（絵本の ゆるい 女の子）で出す
// どちらでも 骨（関節）の 名前は avatar.js の bones の キー（hips・head・leftArm…）で world.js に わたすので、
// 歩き方の コードは 同じまま 動く。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { partOf, PARTS, COLORS, COLOR_SHIFT, FACE } from './avatar.js';
import { picturebook, setColorShift } from './picturebook.js';

const normName = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

// 体を body（THREE.Group）に 入れる。onBones({ hips, head, ... }) で 関節を わたす（あとで 来ることもある）。
// かえすのは { setLook(look) }。見た目が かわったら 呼ぶ（体が かわったら 作りなおす）
export function mountAvatar(body, look, onBones) {
  let bodyId = null;
  let ctl = null;
  function build(l) {
    body.clear();
    bodyId = l.wear.body;
    const part = partOf(bodyId);
    ctl = part.model ? glbBody(body, part, l, onBones) : placeholderBody(body, part, l, onBones);
  }
  build(look);
  return {
    setLook(l) {
      if (l.wear.body !== bodyId) build(l);
      else ctl.setLook(l);
    },
  };
}

const colorOf = (slot, key) => COLORS[slot]?.[key] ?? 0xffffff;

// ---- 3Dモデル（GLB）の体 --------------------------------------------------------------

function glbBody(body, part, look, onBones) {
  let model = null;
  let current = look;
  let fell = null;   // 読めなかったとき、仮の すがた
  // 台帳の mesh（名前か 名前の並び）-> 部品
  const meshParts = new Map();
  PARTS.forEach((p) => {
    if (p.kind === 'body' || !p.mesh) return;
    (Array.isArray(p.mesh) ? p.mesh : [p.mesh]).forEach((m) => meshParts.set(normName(m), p));
  });
  // 帽子用の 髪・色の ずらし・顔の 調整（台帳の hair / tint / face）
  const styles = (part.hairStyles || []).map((x) => ({ id: x.id, normal: normName(x.normal), hat: normName(x.hat) }));
  const hairMeshes = new Set(styles.flatMap((x) => [x.normal, x.hat]));
  const tintOf = new Map();   // メッシュ名 -> 'hair' | 'eye'
  for (const [slot, names] of Object.entries(part.tint || {})) names.split('|').forEach((n) => tintOf.set(normName(n), slot));
  function apply(l) {
    current = l;
    if (fell) { fell.setLook(l); return; }
    if (!model) return;
    const worn = new Set(Object.values(l.wear));
    const hat = l.wear.hat && partOf(l.wear.hat)?.mesh;
    model.traverse((o) => {
      if (!o.isMesh) return;
      const name = normName(o.name);
      // 髪型: えらんだ 髪型の メッシュだけ 出す（帽子の ときは 帽子用）
      if (hairMeshes.has(name)) {
        const st = styles.find((x) => x.id === l.wear.hair) || styles[0];
        o.visible = name === (hat ? st.hat : st.normal);
      }
      const slot = tintOf.get(name);
      if (slot) {
        const sh = COLOR_SHIFT[slot]?.[l.colors[slot]] || [0, 1, 1];
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => setColorShift(m, sh));
      }
      if (part.face && name === normName(part.face) && o.morphTargetDictionary) {
        for (const f of FACE) {
          const i = o.morphTargetDictionary[f.morph];
          if (i != null) o.morphTargetInfluences[i] = l.face?.[f.key] || 0;
        }
      }
      const owner = meshParts.get(name) || meshParts.get(normName(o.parent?.name || ''));
      if (!owner) return;
      o.visible = worn.has(owner.id);
      if (owner.color && o.visible) {
        const c = colorOf(owner.color, l.colors[owner.color]);
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m?.color) m.color.setHex(c); });
      }
    });
  }

  new GLTFLoader().load(part.model, (gltf) => {
    model = gltf.scene;
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      // 色を のせる 部品は、ほかの体と まざらないよう 材質を 自分用に
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    });
    if (part.style) {
      // 色を ずらす メッシュ（髪・顔）の 材質に しるし（picturebook.js が 色あいを ずらす しかけを 入れる）
      const tint = {};
      model.traverse((o) => { if (o.isMesh && part.tint) for (const [slot, names] of Object.entries(part.tint)) if (names.split('|').some((n) => normName(n) === normName(o.name))) tint[o.name] = slot; });
      picturebook(model, { ...part.style, tintMeshes: tint });
    }
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = part.height / (size.y || 1);
    model.scale.setScalar(s);
    model.position.y = -box.min.y * s;
    body.add(model);
    const byName = {};
    model.traverse((o) => { if (o.isBone) byName[normName(o.name)] = o; });
    const bones = {};
    for (const [key, name] of Object.entries(part.bones || {})) if (byName[normName(name)]) bones[key] = byName[normName(name)];
    if (part.boneSpace === 'model') {
      model.updateMatrixWorld(true);
      for (const key of Object.keys(bones)) bones[key] = modelSpaceJoint(bones[key], model, part.rest?.[key]);
      if (part.follow) addFollowers(bones, byName, model, part.follow);
    }
    onBones(bones);
    apply(current);
  }, undefined, () => {
    // 読めなかった: 仮の すがたで 出す
    fell = placeholderBody(body, part, current, onBones);
  });
  return { setLook: apply };
}

// 骨の 向きを モデルの 向き（前 +z・左 +x・上 +y）で かえる 道具。set(q) の q は モデルの 向きでの 回転
function modelDriver(bone, model) {
  const q0 = bone.quaternion.clone();
  const w = bone.getWorldQuaternion(new THREE.Quaternion())
    .premultiply(model.getWorldQuaternion(new THREE.Quaternion()).invert());
  const wInv = w.clone().invert();
  const t = new THREE.Quaternion();
  return (q) => { bone.quaternion.copy(q0).multiply(t.copy(wInv).multiply(q).multiply(w)); };
}

// world.js が さわる 関節。rotation（Euler）を 書きかえると、モデルの 向きで まわす。
// きゅうに 切りかわらないよう、すこし おくれて なめらかに ついていく（歩きはじめ・止まるときの カクッを なくす）。
// rest は ふだんの すがたの 回転。listeners は まわったときに 呼ぶ（ひざ・スカートが ついてくる）
const SMOOTH = 22;   // 大きいほど すばやく ついていく
function modelSpaceJoint(bone, model, rest = {}) {
  const set = modelDriver(bone, model);
  const rotation = new THREE.Euler(rest.x || 0, rest.y || 0, rest.z || 0);
  const target = new THREE.Quaternion().setFromEuler(rotation);
  const now = target.clone();
  const listeners = [];
  let last = performance.now();
  const apply = () => {
    target.setFromEuler(rotation);
    const t = performance.now();
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    now.slerp(target, 1 - Math.exp(-dt * SMOOTH));
    set(now);
    listeners.forEach((f) => f(now));
  };
  rotation._onChange(apply);
  set(now);
  return { rotation, bone, now, listeners };
}

// 歩き方に ついてくる 関節（world.js は 知らなくてよい）
// - ひざ: 足が うしろへ いくほど まげる（足を 前へ はこぶ ときの けりあげ）
// - ひじ: いつも すこし まげて、うでを 大きく ふるほど（走るとき）もっと まげる
// - スカート: 下の 足と いっしょに 前後へ ゆれて、足を ひらくと すそが ひろがる（足が つきぬけない ように）
function addFollowers(bones, byName, model, f) {
  const find = (n) => byName[normName(n)];
  const ex = new THREE.Euler();
  const angleX = (q) => ex.setFromQuaternion(q).x;
  const rx = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
  for (const [legKey, kneeName] of [['leftLeg', f.leftKnee], ['rightLeg', f.rightKnee]]) {
    const knee = find(kneeName || '');
    if (!knee || !bones[legKey]) continue;
    const set = modelDriver(knee, model);
    const k = f.knee || { base: 0.08, gain: 1.1, max: 2 };
    bones[legKey].listeners.push((q) => { const a = angleX(q); set(rx(Math.min(k.max, k.base + k.gain * Math.max(0, a)))); });
  }
  for (const [armKey, elbowName] of [['leftArm', f.leftElbow], ['rightArm', f.rightElbow]]) {
    const elbow = find(elbowName || '');
    if (!elbow || !bones[armKey]) continue;
    const set = modelDriver(elbow, model);
    // ひじ下を 外へ ひらく（elbowOut。左うでは +z が 外）
    const out = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (armKey === 'leftArm' ? 1 : -1) * (f.elbowOut || 0));
    const cb = (q) => { const a = angleX(q); set(out.clone().multiply(rx(-0.28 - 0.6 * Math.max(0, -a) - 0.35 * Math.max(0, a)))); };
    bones[armKey].listeners.push(cb);
    cb(bones[armKey].now);
  }
  // 三つ編み: 同じ がわの うでが 前へ ふれた（うでの x が マイナス）ぶんだけ、前（-x まわり）と 内がわへ まわす
  if (f.braids) {
    for (const [armKey, name, side] of [['leftArm', f.braids.left, 1], ['rightArm', f.braids.right, -1]]) {
      const braid = find(name || '');
      if (!braid || !bones[armKey]) continue;
      const set = modelDriver(braid, model);
      const zq = new THREE.Quaternion(); const zAxis = new THREE.Vector3(0, 0, 1);
      const cb = (q) => {
        const fwd = Math.max(0, -angleX(q));
        set(zq.setFromAxisAngle(zAxis, side * f.braids.inward * fwd).multiply(rx(-f.braids.fwd * fwd)));
      };
      bones[armKey].listeners.push(cb);
      cb(bones[armKey].now);
    }
  }
  // スカート: 骨の 根もとが こしの どちらがわに あるかで、左右の 足の きき目を きめる
  const hips = bones.hips?.bone;
  const skirt = (f.skirt || []).map(find).filter(Boolean);
  if (!hips || !skirt.length || !bones.leftLeg || !bones.rightLeg) return;
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const hp = hips.getWorldPosition(new THREE.Vector3()).applyMatrix4(toModel);
  const down = new THREE.Vector3(0, -1, 0);
  const parts = skirt.map((b) => {
    const p = b.getWorldPosition(new THREE.Vector3()).applyMatrix4(toModel).sub(hp);
    p.y = 0; p.normalize();
    return { set: modelDriver(b, model), dir: p, wl: 0.5 + 0.5 * p.x };
  });
  const flare = new THREE.Quaternion(); const q = new THREE.Quaternion(); const v = new THREE.Vector3();
  const update = () => {
    const al = angleX(bones.leftLeg.now); const ar = angleX(bones.rightLeg.now);
    const open = Math.min(0.5, Math.abs(al - ar) * 0.35);
    for (const s of parts) {
      const swing = (al * s.wl + ar * (1 - s.wl)) * 0.75;
      // すそを 外へ ひらく（前と うしろが よく ひらく）
      const k = open * (0.4 + 0.6 * Math.abs(s.dir.z));
      flare.setFromUnitVectors(down, v.copy(s.dir).multiplyScalar(Math.tan(k)).add(down).normalize());
      s.set(q.copy(rx(swing)).multiply(flare));
    }
  };
  bones.leftLeg.listeners.push(update);
  bones.rightLeg.listeners.push(update);
}

// ---- 仮の すがた（コードで作る） --------------------------------------------------------
// 絵本の 草原に あう、まるっこい 2頭身くらいの 女の子。前は +z。
// 関節: hips（こし）→ spine（むね）→ head（あたま）・leftArm / rightArm（かた）、hips → leftLeg / rightLeg（また）
// 左は +x がわ（うでの z を + に まわすと 外へ あがる。world.js の 歩き方と あわせてある）

const SKIN = 0xffe1cc;
const lambert = (color, extra) => new THREE.MeshLambertMaterial({ color, ...extra });

function placeholderBody(body, part, look, onBones) {
  const H = part.height;
  const u = (v) => v * H;   // 背の高さを 1 と したときの 長さ
  const root = new THREE.Group();
  body.add(root);
  const skin = lambert(SKIN, { emissive: 0xffc8a8, emissiveIntensity: 0.22 });
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };

  const hips = new THREE.Group(); hips.position.y = u(0.34); root.add(hips);
  const spine = new THREE.Group(); hips.add(spine);
  const head = new THREE.Group(); head.position.y = u(0.27); spine.add(head);
  const leftArm = new THREE.Group(); leftArm.position.set(u(0.1), u(0.22), 0); spine.add(leftArm);
  const rightArm = new THREE.Group(); rightArm.position.set(u(-0.1), u(0.22), 0); spine.add(rightArm);
  const leftLeg = new THREE.Group(); leftLeg.position.set(u(0.065), 0, 0); hips.add(leftLeg);
  const rightLeg = new THREE.Group(); rightLeg.position.set(u(-0.065), 0, 0); hips.add(rightLeg);
  // ふだんの すがた: うでは すこし 外へ ひらく
  leftArm.rotation.z = 0.18; rightArm.rotation.z = -0.18;

  // あたま（大きめ）と 顔
  const headR = u(0.215);
  const face = new THREE.Group(); face.position.y = u(0.2); head.add(face);
  face.add(mesh(new THREE.SphereGeometry(headR, 32, 24), skin));
  const eyeMat = lambert(0x2b2230);
  const hi = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const sx of [1, -1]) {
    const eye = mesh(new THREE.SphereGeometry(u(0.026), 16, 12), eyeMat, sx * u(0.075), -u(0.01), headR * 0.93);
    eye.scale.set(1, 1.35, 0.6);
    face.add(eye);
    face.add(mesh(new THREE.SphereGeometry(u(0.008), 8, 6), hi, sx * u(0.068) + u(0.006), u(0.008), headR * 0.985));
    const cheek = mesh(new THREE.CircleGeometry(u(0.03), 20), new THREE.MeshBasicMaterial({ color: 0xffa9a9, transparent: true, opacity: 0.55, depthWrite: false }), sx * u(0.125), -u(0.065), 0);
    // ほっぺは 顔の まるみに そわせる
    const dir = new THREE.Vector3(sx * 0.58, -0.3, 0.76).normalize();
    cheek.position.copy(dir.clone().multiplyScalar(headR * 1.005));
    cheek.lookAt(dir.clone().multiplyScalar(headR * 2));
    face.add(cheek);
  }
  const smile = mesh(new THREE.TorusGeometry(u(0.024), u(0.0055), 6, 16, Math.PI), lambert(0xc0605a), 0, -u(0.07), headR * 0.955);
  smile.rotation.z = Math.PI;
  face.add(smile);

  // うで（はだ）と 手
  for (const arm of [leftArm, rightArm]) {
    arm.add(mesh(new THREE.CapsuleGeometry(u(0.036), u(0.13), 6, 12), skin, 0, -u(0.1), 0));
    arm.add(mesh(new THREE.SphereGeometry(u(0.045), 14, 10), skin, 0, -u(0.19), 0));
  }
  // あし（はだ）
  for (const leg of [leftLeg, rightLeg]) {
    leg.add(mesh(new THREE.CapsuleGeometry(u(0.042), u(0.2), 6, 12), skin, 0, -u(0.15), 0));
  }
  // くび
  spine.add(mesh(new THREE.CylinderGeometry(u(0.04), u(0.045), u(0.08), 12), skin, 0, u(0.25), 0));

  // 付けかえる部品の 入れ物
  const slots = {
    hair: new THREE.Group(), outfit: new THREE.Group(), shoes: new THREE.Group(),
  };
  face.add(slots.hair);
  hips.add(slots.outfit);
  // くつは 両足に 1つずつ（足と いっしょに うごく）
  const shoeL = new THREE.Group(); leftLeg.add(shoeL);
  const shoeR = new THREE.Group(); rightLeg.add(shoeR);

  function setLook(l) {
    for (const g of [slots.hair, slots.outfit, shoeL, shoeR]) g.clear();
    const hairC = colorOf('hair', l.colors.hair);
    const outC = colorOf('outfit', l.colors.outfit);
    const hp = partOf(l.wear.hair); const op = partOf(l.wear.outfit); const sp = partOf(l.wear.shoes);
    if (hp && HAIR[hp.placeholder]) slots.hair.add(HAIR[hp.placeholder](u, headR, lambert(hairC)));
    if (op && OUTFIT[op.placeholder]) slots.outfit.add(OUTFIT[op.placeholder](u, lambert(outC)));
    if (sp && SHOES[sp.placeholder]) { shoeL.add(SHOES[sp.placeholder](u)); shoeR.add(SHOES[sp.placeholder](u)); }
  }
  setLook(look);
  onBones({ hips, spine, head, leftArm, rightArm, leftLeg, rightLeg });
  return { setLook };
}

// あたまの 上〜うしろを おおう 髪（前と 顔の下は あける）
function hairCap(u, headR, mat, back = 0) {
  const g = new THREE.Group();
  const r = headR * 1.07;
  // 上半分の まるい ぼうし
  const top = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), mat);
  top.position.set(0, headR * 0.02, -headR * 0.03);
  g.add(top);
  // うしろ半分（下へ のびる）
  const backHalf = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16, Math.PI, Math.PI, Math.PI * 0.5, Math.PI * (0.32 + back)), mat);
  backHalf.position.copy(top.position);
  g.add(backHalf);
  // まえがみ（ふんわり 3つ）
  for (const [x, s] of [[-0.09, 0.95], [0, 1.1], [0.09, 0.95]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(u(0.07) * s, 16, 12), mat);
    b.scale.set(1.25, 0.62, 0.7);
    const dir = new THREE.Vector3(x * 1.7, 0.6, 0.78).normalize();
    b.position.copy(dir.multiplyScalar(headR * 0.98));
    g.add(b);
  }
  return g;
}

const HAIR = {
  // ふたつむすび: 耳の うしろで ふたつに むすぶ。リボンつき
  futatsu(u, headR, mat) {
    const g = hairCap(u, headR, mat, 0.04);
    const ribbon = lambert(0xff7a8e);
    for (const sx of [1, -1]) {
      const tuft = new THREE.Group();
      tuft.position.set(sx * headR * 0.92, -headR * 0.05, -headR * 0.32);
      tuft.rotation.z = sx * 0.5;
      const t = new THREE.Mesh(new THREE.SphereGeometry(u(0.07), 16, 12), mat);
      t.scale.set(0.85, 1.45, 0.85);
      t.position.y = -u(0.07);
      tuft.add(t);
      const tie = new THREE.Mesh(new THREE.SphereGeometry(u(0.032), 12, 10), ribbon);
      tie.position.y = u(0.01);
      tuft.add(tie);
      g.add(tuft);
    }
    return g;
  },
  // ボブ: あごの 高さで まるく そろえる
  bob(u, headR, mat) {
    const g = hairCap(u, headR, mat, 0.18);
    for (const sx of [1, -1]) {
      const side = new THREE.Mesh(new THREE.SphereGeometry(u(0.085), 16, 12), mat);
      side.scale.set(0.75, 1.35, 1.1);
      side.position.set(sx * headR * 0.86, -headR * 0.28, -headR * 0.12);
      g.add(side);
    }
    return g;
  },
};

const OUTFIT = {
  // ワンピース: むね（つつ）と ふんわり スカート。白い えり
  wanpi(u, mat) {
    const g = new THREE.Group();
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(u(0.085), u(0.11), u(0.23), 20), mat);
    chest.position.y = u(0.12);
    g.add(chest);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(u(0.11), u(0.2), u(0.17), 28, 1, true), mat);
    skirt.position.y = -u(0.06);
    skirt.material = mat.clone(); skirt.material.side = THREE.DoubleSide;
    g.add(skirt);
    // すその まるみ
    const hem = new THREE.Mesh(new THREE.TorusGeometry(u(0.2), u(0.018), 8, 32), mat);
    hem.rotation.x = Math.PI / 2; hem.position.y = -u(0.145);
    g.add(hem);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(u(0.07), u(0.022), 8, 24), lambert(0xffffff));
    collar.rotation.x = Math.PI / 2; collar.position.y = u(0.235);
    g.add(collar);
    // そで（かたの まるみ）
    for (const sx of [1, -1]) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(u(0.055), 14, 10), mat);
      puff.position.set(sx * u(0.1), u(0.205), 0);
      g.add(puff);
    }
    return g;
  },
};

const SHOES = {
  kutsu(u) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(u(0.055), 16, 10), lambert(0xc4553f));
    s.scale.set(0.95, 0.6, 1.35);
    s.position.set(0, -u(0.3), u(0.02));
    return s;
  },
};
