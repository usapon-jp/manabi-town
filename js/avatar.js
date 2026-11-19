// 町の主人公（アバター）の台帳と保存。3D には さわらない（3D は js/avatar3d.js）。
//
// 台帳（PARTS）は ガチャと同じく「1行 = 1つ」。体（body）も 髪（hair）・服（outfit）・くつ（shoes）と
// 同じ一覧に ならべる。男の子など 体を ふやすときも、ここに1行 足すだけ。id は保存に入るので、いちど決めたら変えない。
//
// 3Dモデルが できたら（フミオさん制作中）:
//   1. GLB を assets/models/ に置く（例: assets/models/girl.glb）
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
//     colors: { hair: 'chairo', outfit: 'momo' },               // 色の名前（COLORS の キー）
//   }
// p.avatar が ないうちは「まだ 名前を つけていない」。見た目は ふつうの（DEFAULT_WEAR）で出す。

export const KINDS = ['body', 'hair', 'outfit', 'shoes'];

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
    // きゃらくる「カーディガン版」（VRM から 軽くした GLB。髪・服は モデルに 入っている）
    model: 'assets/models/girl.glb',
    placeholder: 'girl',  // model が ないとき・読めないときの 仮の すがた（avatar3d.js の BODIES）
    height: 1.32,         // 箱庭の中での 背の高さ（2026-11-19 1.15→1.32。花・建物に くらべて 小さかった）
    speed: 1.6,
    bones: VRM,
    // 骨の 向きが ばらばらな モデル（VRM）は、関節を モデルの 前(+z)・左(+x)・上(+y) の 向きで まわす。
    // rest は ふだんの すがた（T ポーズの うでを 下ろす）。仮の すがたと 同じ 向き・同じ 歩き方の 数字で 動く
    boneSpace: 'model',
    rest: { leftArm: { z: -1.3 }, rightArm: { z: 1.3 } },
    // 歩き方に ついてくる 関節（ひざ・ひじ・スカートの 骨）。avatar3d.js の addFollowers
    follow: {
      leftKnee: 'J_Bip_L_LowerLeg', rightKnee: 'J_Bip_R_LowerLeg',
      leftElbow: 'J_Bip_L_LowerArm', rightElbow: 'J_Bip_R_LowerArm',
      skirt: ['Skirt_000_1', 'Skirt_045_1', 'Skirt_090_1', 'Skirt_135_1', 'Skirt_180_1', 'Skirt_225_1', 'Skirt_270_1', 'Skirt_315_1'],
    },
    // 草原の 絵本の 絵柄に そろえる（js/picturebook.js）
    style: {},
    // 歩き方: 足を前後・うでを前後（armSwing）・うでを 横へ（armFlap）・上下（bob）
    walk: { legSwing: 0.45, armSwing: 0.4, armFlap: 0.06, bob: 0.035,
      // ダッシュ（world.js）: 足と うでを 大きく、前かがみ（lean）、上下に はずむ
      run: { legSwing: 0.8, armSwing: 0.95, armFlap: 0.12, bob: 0.08, lean: 0.24 } },
  },
  { id: 'hair:futatsu', kind: 'hair', label: 'ふたつむすび', mesh: null, placeholder: 'futatsu', color: 'hair' },
  { id: 'hair:bob', kind: 'hair', label: 'ボブ', mesh: null, placeholder: 'bob', color: 'hair' },
  { id: 'outfit:wanpi', kind: 'outfit', label: 'ワンピース', mesh: null, placeholder: 'wanpi', color: 'outfit' },
  { id: 'shoes:kutsu', kind: 'shoes', label: 'くつ', mesh: null, placeholder: 'kutsu' },
];

export const DEFAULT_WEAR = { body: 'body:girl', hair: 'hair:futatsu', outfit: 'outfit:wanpi', shoes: 'shoes:kutsu' };

// 色。部品の color（'hair' / 'outfit'）ごとに えらべる色。キーは保存に入るので 変えない
export const COLORS = {
  hair: { chairo: 0x7a4b2a, kuro: 0x3a2c2a, kinpatsu: 0xe8c06a, akage: 0xc0623a },
  outfit: { momo: 0xf29bb0, sora: 0x8ec9ef, kiiro: 0xf7d36a, wakaba: 0x9fd68a },
};
export const DEFAULT_COLORS = { hair: 'chairo', outfit: 'momo' };

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
  return { wear, colors };
}

// 見た目が かわったかを くらべる 短い しるし
export const lookKey = (look) => `${KINDS.map((k) => look.wear[k]).join('|')}|${Object.keys(COLORS).map((k) => look.colors[k]).join('|')}`;

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
