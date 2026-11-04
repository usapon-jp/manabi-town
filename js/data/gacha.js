// ガチャの中身（＝子どもが持てる「つくるもの」の台帳）。3Dの箱庭（柵・おきもの）もこの表を読む。
// ふやすときは ITEMS に1行足すだけ。id は保存に使うので、一度出したら変えない。
//
// kind（箱庭での使いみち）:
//   fence = 柵のかたち（「柵」の道具で、歩いた線に立てる）
//   piece = おきもの（「おきもの」の道具で、タップして置く）
//   seed  = 花のタネ（「花のタネ」の道具でうえられる花がふえる）
//   chara = なかま（あとから足すキャラクター。もらうと街に住む）
// own: true  = 最初から持っている（ガチャには出ない）
// ready: false = 3Dのモデルがまだ。ガチャには出さず、「もうすぐ」に数だけ出す
// rarity: 1 ふつう / 2 めずらしい / 3 とてもめずらしい

export const KINDS = {
  fence: { label: 'さく' },
  piece: { label: 'おきもの' },
  seed: { label: '花のタネ' },
  chara: { label: 'なかま' },
};

export const RARITY = {
  1: { label: 'ふつう', weight: 60 },
  2: { label: 'めずらしい', weight: 30 },
  3: { label: 'とてもめずらしい', weight: 10 },
};

// ガチャ石の手に入れかた（フミオさん 2026-11-04。ためしてから ここだけで調整できる）
export const STONES = {
  daily: 1,       // 毎日1回のログインボーナス
  perLevel: 1,    // レベルが1つ上がるごと
  price: 100,     // ポイント100 で 石1こ
};

const s = (inner) => inner; // 線の絵（24×24、lucide と同じ太さ）
const FENCE = s('<path d="M5 21V7l1.5-2.5L8 7v14"/><path d="M11 21V7l1.5-2.5L14 7v14"/><path d="M17 21V7l1.5-2.5L20 7v14"/><path d="M3 11h19"/><path d="M3 17h19"/>');
const SEED = s('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 8h14"/><circle cx="12" cy="14.5" r="2"/><path d="M12 10.5v1.2M12 17.3v1.2M8 14.5h1.2M14.8 14.5H16"/>');

export const ITEMS = [
  // ---- 3Dができているもの（3Dセッション js/structures.js・js/pieces.js） ----
  { id: 'fence:wood', label: '木の柵', kind: 'fence', rarity: 1, own: true, color: '#c99a62', svg: FENCE },
  { id: 'fence:stone', label: '石垣', kind: 'fence', rarity: 2, color: '#9b9488',
    svg: s('<path d="M3 20h18"/><path d="M3 14h18"/><path d="M3 8h18"/><path d="M3 8v12"/><path d="M21 8v12"/><path d="M9 8v6"/><path d="M15 8v6"/><path d="M6 14v6"/><path d="M12 14v6"/><path d="M18 14v6"/>') },
  { id: 'fence:iron', label: 'てつの柵', kind: 'fence', rarity: 3, color: '#6f7d8c',
    svg: s('<path d="M3 21h18"/><path d="M3 17h18"/><path d="M6 17V6"/><path d="M12 17V4"/><path d="M18 17V6"/><path d="M4.5 7.5 6 5l1.5 2.5"/><path d="M10.5 5.5 12 3l1.5 2.5"/><path d="M16.5 7.5 18 5l1.5 2.5"/><path d="M3 10h18"/>') },
  { id: 'piece:raisedbed', label: 'レイズドベッド', kind: 'piece', rarity: 1, own: true, color: '#a8794b',
    svg: s('<path d="M3 13h18v6H3z"/><path d="M3 16h18"/><path d="M7 13c0-3 2-5 2-5"/><path d="M12 13c0-4 1-6 1-6"/><path d="M17 13c0-3-2-5-2-5"/>') },
  { id: 'piece:awning', label: 'ひさし', kind: 'piece', rarity: 2, color: '#7b8291',
    svg: s('<path d="M3 9l9-4 9 4"/><path d="M4 9h16"/><path d="M6 9v12"/><path d="M18 9v12"/><path d="M8 7v2M12 5.5V9M16 7v2"/><path d="M3 21h18"/>') },
  { id: 'piece:hill', label: '丘の家', kind: 'piece', rarity: 3, color: '#8fa871',
    svg: s('<path d="M2 20c3-7 6.5-10 10-10s7 3 10 10"/><path d="M9 20v-4a3 3 0 0 1 6 0v4"/><path d="M2 20h20"/><path d="M17 9V6h2v5"/><circle cx="12" cy="13" r=".6"/>') },

  // ---- 3Dがまだのもの（できたら ready を消す。依頼: docs/request-gacha-parts.md） ----
  { id: 'fence:white', label: '白い柵', kind: 'fence', rarity: 1, ready: false, color: '#b9b2a6',
    svg: s('<path d="M4 21V8a1.5 1.5 0 0 1 3 0v13"/><path d="M10.5 21V8a1.5 1.5 0 0 1 3 0v13"/><path d="M17 21V8a1.5 1.5 0 0 1 3 0v13"/><path d="M2 12h20"/><path d="M2 17h20"/>') },
  { id: 'piece:lantern', label: 'ランタン', kind: 'piece', rarity: 1, ready: false, color: '#e0a94a',
    svg: s('<path d="M12 2v2"/><path d="M9 4h6"/><path d="M8 7l1-3h6l1 3"/><path d="M8 7h8l-1 11H9z"/><path d="M10 21h4"/><path d="M12 18v3"/><path d="M12 10v4"/>') },
  { id: 'piece:mailbox', label: 'ポスト', kind: 'piece', rarity: 1, ready: false, color: '#d9785c',
    svg: s('<path d="M4 12a4 4 0 0 1 8 0v5H4z"/><path d="M8 8h8a4 4 0 0 1 4 4v5h-8"/><path d="M10 17v5"/><path d="M15 10V5h3"/>') },
  { id: 'piece:bench', label: 'ベンチ', kind: 'piece', rarity: 2, ready: false, color: '#a8794b',
    svg: s('<path d="M4 6h16"/><path d="M4 10h16"/><path d="M3 14h18"/><path d="M6 6v8"/><path d="M18 6v8"/><path d="M5 14v6"/><path d="M19 14v6"/>') },
  { id: 'piece:rosearch', label: 'バラのアーチ', kind: 'piece', rarity: 2, ready: false, color: '#d9788c',
    svg: s('<path d="M5 21V11a7 7 0 0 1 14 0v10"/><path d="M9 21v-9a3 3 0 0 1 6 0v9"/><circle cx="6.5" cy="8.5" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="17.5" cy="8.5" r="1"/>') },
  { id: 'seed:sunflower', label: 'ひまわりのタネ', kind: 'seed', rarity: 1, ready: false, species: 'sunflower', color: '#e8b52e', svg: SEED },
  { id: 'seed:cosmos', label: 'コスモスのタネ', kind: 'seed', rarity: 1, ready: false, species: 'cosmos', color: '#e58fae', svg: SEED },
  { id: 'seed:lavender', label: 'ラベンダーのタネ', kind: 'seed', rarity: 2, ready: false, species: 'lavender', color: '#9d86d6', svg: SEED },
];

// なかまキャラを足すときの例（3Dのモデルは js/characters.js にも足す）:
// { id: 'chara:hana', label: '花屋のハナ', kind: 'chara', rarity: 3, model: 'hana', color: '#e58fae', svg: '…' },
