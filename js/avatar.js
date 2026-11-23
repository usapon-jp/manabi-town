// 町の主人公（アバター）の台帳と保存。3D には さわらない（3D は js/avatar3d.js）。
//
// 台帳（PARTS）は ガチャと同じく「1行 = 1つ」。体（body）も 髪（hair）・服（outfit）・くつ（shoes）と
// 同じ一覧に ならべる。男の子など 体を ふやすときも、ここに1行 足すだけ。id は保存に入るので、いちど決めたら変えない。
//
// 3Dモデルが できたら（フミオさん制作中）:
//   1. GLB を assets/models/ に置く（例: assets/models/girl-v2.glb）
//   2. 体の行の model に そのパスを書く（sw.js の FILES にも足して VERSION を上げる）
//   3. 髪・服・くつの行の mesh に、GLB の中の 部品（メッシュ）の名前を書く
//      つけていない部品の メッシュは かくす。mesh を書いていない部品は 何もしない
//   4. 色を かえたい部品は、モデルでは 白っぽい色に しておく（ここの色を かける）
//   モデルが 読めないとき・model が null のときは、コードで作った 仮の すがた（avatar3d.js）で 出る。
//   保存しているのは 部品の id と 名前だけ なので、差しかえても 子どものデータは そのまま。
//
// 保存の形（プロフィール p の直下。島をまたぐので p.world には入れない。端末どうしで そろう）:
//   p.avatar = {
//     name: 'はな',                         // プレイヤーが つけた 名前（きょうだいの名前とは べつ）
//     wear: { body: 'body:girl', hair: 'hair:futatsu', ... },   // いま つけている部品（ない kind は ふつうの）
//     colors: { hair: 'pink', eye: 'ao' },                      // 色の名前（COLORS の キー）
//     face: { eye: 0.3, mouth: 0, slim: 0.5 },                  // 顔の 調整（FACE。-1〜1、0 が もとの まま）
//   }
// 帽子（wear.hat）は ガチャで 手に入れた ものだけ えらべる（js/dressup.js）。
// p.avatar が ないうちは「まだ 名前を つけていない」。見た目は ふつうの（DEFAULT_WEAR）で出す。

export const KINDS = ['body', 'hair', 'outfit', 'shoes', 'hat'];

// 体の骨の名前（Mixamo）。GLB の中の名前と 記号を無視して くらべる。足りない骨は 動かさない
const MIXAMO = {
  hips: 'mixamorig:Hips',
  spine: 'mixamorig:Spine',
  head: 'mixamorig:Head',
  leftArm: 'mixamorig:LeftArm',
  rightArm: 'mixamorig:RightArm',
  leftLeg: 'mixamorig:LeftUpLeg',
  rightLeg: 'mixamorig:RightUpLeg',
};

// きゃらくるで作った 4頭身の 女の子（VRM の骨の名前）。walk の 関節は モデルの 前・横・上の 向きで まわす
const VRM = {
  hips: 'J_Bip_C_Hips',
  spine: 'J_Bip_C_Spine',
  head: 'J_Bip_C_Head',
  leftArm: 'J_Bip_L_UpperArm',
  rightArm: 'J_Bip_R_UpperArm',
  leftLeg: 'J_Bip_L_UpperLeg',
  rightLeg: 'J_Bip_R_UpperLeg',
};

export const PARTS = [
  {
    id: 'body:girl', kind: 'body', label: '女の子',
    // きゃらくる「女の子v2」冬服（2026-11-22）。顔・首・冬服・髪（ふつう／帽子用）・ベレー帽が 1つの GLB に 入っている。
    // 作り方: きゃらくる work/girl-v2/build/girl-v2-beret-rigged.blend から make_game_glb.py（軽くして 色の絵だけ のこす）
    // 2026-11-23 かわいさ微調整版（頭+5%・頭を前へ・あご細く・胴コンパクト・肩せまく・髪の横-4%・スカート裾+3%）:
    //   work/girl-v2/s1/girl-v2-s2-beret-rigged.blend から make_game_glb_v2.py --weights …s2-braids-rigged.blend --face -0.0065,0.071
    // 2026-11-23 三つ編み（HairBraids / HairBraidsHat、骨 J_Sec_*_Braid）を 追加: s1/girl-v2-s2-all-rigged.blend から --face -0.0065,0.071
    model: 'assets/models/girl-v2.glb',
    placeholder: 'girl',  // model が ないとき・読めないときの 仮の すがた（avatar3d.js の BODIES）
    height: 1.32,         // 箱庭の中での 背の高さ（2026-11-19 1.15→1.32。花・建物に くらべて 小さかった）
    speed: 1.6,
    bones: VRM,
    // 骨の 向きが ばらばらな モデル（VRM）は、関節を モデルの 前(+z)・左(+x)・上(+y) の 向きで まわす。
    // rest は ふだんの すがた（A ポーズの うでを もう少し 下ろす）
    // 2026-11-23 かわいさ微調整: うでを 体から 少し はなす（0.5 → 0.42）
    boneSpace: 'model',
    rest: { leftArm: { z: -0.42 }, rightArm: { z: 0.42 } },
    // 歩き方に ついてくる 関節（ひざ・ひじ）。avatar3d.js の addFollowers
    // ひざは 足が うしろへ いくと 最大 約40°、ひじ下は 外へ 約10° ひらく（コートの すそに 手が 入らない）
    follow: {
      leftKnee: 'J_Bip_L_LowerLeg', rightKnee: 'J_Bip_R_LowerLeg',
      leftElbow: 'J_Bip_L_LowerArm', rightElbow: 'J_Bip_R_LowerArm',
      knee: { base: 0.05, gain: 2.0, max: 1.3 }, elbowOut: 0.17,
      // 三つ編み: 同じ がわの うでが 前へ ふれた ときだけ、前と 内がわへ よける（うでに ささらない）
      braids: { left: 'J_Sec_L_Braid', right: 'J_Sec_R_Braid', fwd: 0.85, inward: 0.6 },
    },
    // 髪型（きせかえで えらぶ。wear.hair の id → メッシュ）。帽子を かぶると 帽子用（ボブは お花の ヘアピン・アホ毛 なし）に かえる
    // 台帳に ない id（ふるい 保存）は いちばん 上の ボブ
    hairStyles: [
      { id: 'hair:futatsu', label: 'ふんわりボブ', normal: 'Hair', hat: 'HairHat' },
      { id: 'hair:mitsuami', label: 'みつあみ', normal: 'HairBraids', hat: 'HairBraidsHat' },
    ],
    // 髪の色・目の色（絵の 色あいを ずらす。COLOR_SHIFT）と 顔の 調整（シェイプキー。FACE）
    tint: { hair: 'Hair|HairHat|HairBraids|HairBraidsHat', eye: 'Head' },
    face: 'Head',
    // 草原の 絵本の 絵柄に そろえる（js/picturebook.js）
    style: { faceNames: ['head'], glow: 0 },
    // 歩き方: 足を前後（太もも ±18°）・うでを前後（±18°）・うでを 横へ（armFlap）・上下（bob）
    walk: { legSwing: 0.31, armSwing: 0.31, armFlap: 0.04, bob: 0.03,
      // ダッシュ（world.js）: 足と うでを 大きく、前かがみ（lean）、上下に はずむ
      run: { legSwing: 0.62, armSwing: 0.7, armFlap: 0.1, bob: 0.07, lean: 0.22 } },
  },
  { id: 'hair:futatsu', kind: 'hair', label: 'ふたつむすび', mesh: null, placeholder: 'futatsu', color: 'hair' },
  { id: 'hair:bob', kind: 'hair', label: 'ボブ', mesh: null, placeholder: 'bob', color: 'hair' },
  { id: 'hair:mitsuami', kind: 'hair', label: 'みつあみ', mesh: null, placeholder: 'futatsu', color: 'hair' },
  { id: 'outfit:wanpi', kind: 'outfit', label: 'ワンピース', mesh: null, placeholder: 'wanpi', color: 'outfit' },
  { id: 'shoes:kutsu', kind: 'shoes', label: 'くつ', mesh: null, placeholder: 'kutsu' },
  // 帽子。hat:none は「かぶらない」。ほかの 帽子は ガチャ（js/data/gacha.js の kind: 'wear'）で 手に入れる
  { id: 'hat:none', kind: 'hat', label: 'なし', mesh: null },
  { id: 'hat:beret', kind: 'hat', label: '白いベレー帽', mesh: 'Beret', gacha: 'wear:beret' },
];

export const DEFAULT_WEAR = { body: 'body:girl', hair: 'hair:futatsu', outfit: 'outfit:wanpi', shoes: 'shoes:kutsu', hat: 'hat:none' };

// 色。部品の color（'hair' / 'outfit'）ごとに えらべる色。キーは保存に入るので 変えない。
// hex は 仮の すがたで かける色。3Dモデル（女の子v2）は 絵の 色あいを ずらす（COLOR_SHIFT）
export const COLORS = {
  hair: { pink: 0xf59ac0, chairo: 0x7a4b2a, kuro: 0x3a2c2a, kinpatsu: 0xe8c06a, akage: 0xc0623a, sora: 0x8ec9ef, murasaki: 0xb18be0 },
  eye: { ao: 0x4a78b8, midori: 0x4f9a6a, chairo: 0x8a5a3a, murasaki: 0x8a5ac0, pink: 0xd9708f },
  outfit: { momo: 0xf29bb0, sora: 0x8ec9ef, kiiro: 0xf7d36a, wakaba: 0x9fd68a },
};
export const COLOR_LABELS = {
  pink: 'ピンク', chairo: 'ちゃいろ', kuro: 'くろ', kinpatsu: 'きんいろ', akage: 'あかちゃ', sora: 'みずいろ', murasaki: 'むらさき',
  ao: 'あお', midori: 'みどり',
};
export const DEFAULT_COLORS = { hair: 'pink', eye: 'ao', outfit: 'momo' };
// 3Dモデルの 絵の 色あいの ずらし方 [色あい(1で ひとまわり), あざやかさ(かけ算), 明るさ(かけ算)]。
// 髪は もとが ピンク（毛先の 水色は そのまま）、目は もとが 青
export const COLOR_SHIFT = {
  hair: { pink: [0, 1, 1], chairo: [0.12, 0.62, 0.55], kuro: [0.08, 0.3, 0.22], kinpatsu: [0.2, 0.75, 1.05],
    akage: [0.06, 1.0, 0.75], sora: [-0.4, 0.85, 1.0], murasaki: [-0.12, 0.9, 0.95] },
  eye: { ao: [0, 1, 1], midori: [-0.24, 1, 1], chairo: [0.5, 0.75, 1.1], murasaki: [0.15, 1, 1], pink: [0.35, 0.9, 1.1] },
};

// 顔の 調整（シェイプキー）。保存は -1〜1 の 数（0 が もとの まま）。目と口は 絵なので 小さく しか うごかさない
export const FACE = [
  { key: 'eye', label: 'めの おおきさ', morph: 'EyeBig', min: -1, max: 1, lo: 'ちいさく', hi: 'おおきく' },
  { key: 'mouth', label: 'くちの たかさ', morph: 'MouthUp', min: -1, max: 1, lo: 'した', hi: 'うえ' },
  { key: 'slim', label: 'かおの ほそさ', morph: 'FaceSlim', min: -0.5, max: 1, lo: 'ふっくら', hi: 'ほっそり' },
];

const byId = new Map(PARTS.map((x) => [x.id, x]));
export const partOf = (id) => byId.get(id) || null;
export const partsOfKind = (kind) => PARTS.filter((x) => x.kind === kind);

export const NAME_MAX = 8;
// 名前を きれいにする（前後の空白・改行を とる。長すぎるときは 切る）
export function cleanName(s) {
  return String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// 名前を つけたか（つけるまでは 町で「なまえを つけてね」を出す）
export const hasAvatarName = (p) => !!(p && plain(p.avatar) && cleanName(p.avatar.name));
// 町で よぶ 名前。まだ ないときは「あなた」
export const avatarName = (p) => (hasAvatarName(p) ? cleanName(p.avatar.name) : 'あなた');

// いま つけている部品と色（足りないところ・台帳から消えた部品は ふつうの もの）。p は 書きかえない
export function lookOf(p) {
  const a = p && plain(p.avatar) ? p.avatar : {};
  const wear = {};
  for (const kind of KINDS) {
    const id = plain(a.wear) ? a.wear[kind] : undefined;
    const part = typeof id === 'string' ? partOf(id) : null;
    wear[kind] = part && part.kind === kind ? id : DEFAULT_WEAR[kind];
  }
  const colors = {};
  for (const [slot, list] of Object.entries(COLORS)) {
    const c = plain(a.colors) ? a.colors[slot] : undefined;
    colors[slot] = typeof c === 'string' && list[c] != null ? c : DEFAULT_COLORS[slot];
  }
  const face = {};
  for (const f of FACE) {
    const v = plain(a.face) ? Number(a.face[f.key]) : 0;
    face[f.key] = Number.isFinite(v) ? Math.max(f.min, Math.min(f.max, Math.round(v * 20) / 20)) : 0;
  }
  return { wear, colors, face };
}

// 見た目が かわったかを くらべる 短い しるし
export const lookKey = (look) => `${KINDS.map((k) => look.wear[k]).join('|')}|${Object.keys(COLORS).map((k) => look.colors[k]).join('|')}|${FACE.map((f) => look.face?.[f.key] ?? 0).join('|')}`;

// 名前を つける（p.avatar が なければ つくる。ほかの 中身は 消さない）。保存（save）は 呼ぶがわ
export function setAvatarName(p, name) {
  const n = cleanName(name);
  if (!p || !n) return false;
  if (!plain(p.avatar)) p.avatar = {};
  p.avatar.name = n;
  return true;
}

// 部品を つける（着せ替えで使う）。台帳にない部品は つけない
export function wearPart(p, id) {
  const part = partOf(id);
  if (!p || !part) return false;
  if (!plain(p.avatar)) p.avatar = {};
  if (!plain(p.avatar.wear)) p.avatar.wear = {};
  p.avatar.wear[part.kind] = id;
  return true;
}

export function setAvatarColor(p, slot, key) {
  if (!p || !COLORS[slot] || COLORS[slot][key] == null) return false;
  if (!plain(p.avatar)) p.avatar = {};
  if (!plain(p.avatar.colors)) p.avatar.colors = {};
  p.avatar.colors[slot] = key;
  return true;
}

// 顔の 調整を 1つ かえる（v は FACE の min〜max）
export function setAvatarFace(p, key, v) {
  const f = FACE.find((x) => x.key === key);
  const n = Number(v);
  if (!p || !f || !Number.isFinite(n)) return false;
  if (!plain(p.avatar)) p.avatar = {};
  if (!plain(p.avatar.face)) p.avatar.face = {};
  p.avatar.face[key] = Math.max(f.min, Math.min(f.max, Math.round(n * 20) / 20));
  return true;
}

// 髪の色・目の色・顔の 調整を もとに もどす（名前と 着ている ものは そのまま）
export function resetAvatarLook(p) {
  if (!p || !plain(p.avatar)) return false;
  delete p.avatar.face;
  if (plain(p.avatar.colors)) { delete p.avatar.colors.hair; delete p.avatar.colors.eye; }
  return true;
}
