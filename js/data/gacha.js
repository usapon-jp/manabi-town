// ガチャの中身（＝子どもが持てる「つくるもの」の台帳）。3Dの箱庭（柵・おきもの）もこの表を読む。
// ふやすときは ITEMS に1行足すだけ。id は保存に使うので、一度出したら変えない。
//
// kind（箱庭での使いみち）:
//   fence = 柵のかたち（「柵」の道具で、歩いた線に立てる）
//   piece = おきもの（「おきもの」の道具で、タップして置く）
//   part  = 家のパーツ（家をタップして、扉・窓・ひさしの場所に付けたり付けかえたりする）。slot = door / window / over（ひさし）/ sill（窓の下）/ doordeco（扉のかざり）
//   seed  = 花のタネ（「花のタネ」の道具でうえられる花がふえる）
//   chara = なかま（あとから足すキャラクター。もらうと街に住む）
// own: true  = 最初から持っている（ガチャには出ない）
// ready: false = 3Dのモデルがまだ。ガチャには出さず、「もうすぐ」に数だけ出す
// rarity: 1 ふつう / 2 めずらしい / 3 とてもめずらしい

export const KINDS = {
  fence: { label: 'さく' },
  piece: { label: 'おきもの' },
  part: { label: '家のパーツ' },
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
  // ひさしは家に付けるパーツ（id は保存に使うので piece: のまま）
  { id: 'piece:awning', label: 'ひさし', kind: 'part', slot: 'over', rarity: 2, color: '#7b8291',
    svg: s('<path d="M3 9l9-4 9 4"/><path d="M4 9h16"/><path d="M6 9v12"/><path d="M18 9v12"/><path d="M8 7v2M12 5.5V9M16 7v2"/><path d="M3 21h18"/>') },
  { id: 'piece:hill', label: '丘の家', kind: 'piece', rarity: 3, color: '#8fa871',
    svg: s('<path d="M2 20c3-7 6.5-10 10-10s7 3 10 10"/><path d="M9 20v-4a3 3 0 0 1 6 0v4"/><path d="M2 20h20"/><path d="M17 9V6h2v5"/><circle cx="12" cy="13" r=".6"/>') },

  { id: 'part:door', label: 'ふつうの扉', kind: 'part', slot: 'door', rarity: 1, own: true, color: '#a87646',
    svg: s('<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M10 3v18M14 3v18"/><path d="M6 8h12M6 16h12"/><circle cx="16" cy="12.5" r=".6"/>') },
  { id: 'part:window', label: 'ふつうの窓', kind: 'part', slot: 'window', rarity: 1, own: true, color: '#e0a94a',
    svg: s('<rect x="5" y="4" width="14" height="14" rx="1"/><path d="M12 4v14M5 11h14"/><path d="M3 20h18"/>') },

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
  { id: 'part:archdoor', label: 'アーチの扉（ミント）', kind: 'part', slot: 'door', rarity: 2, ready: false, color: '#86c2b2',
    svg: s('<path d="M6 21V10a6 6 0 0 1 12 0v11"/><path d="M4 21h16"/><circle cx="12" cy="9" r="1.6"/><path d="M8 13.5h8M8 17.5h8"/><circle cx="15.5" cy="15.5" r=".6"/>') },
  { id: 'part:archdoor-brown', label: 'アーチの扉（茶色）', kind: 'part', slot: 'door', rarity: 2, ready: false, color: '#a87646',
    svg: s('<path d="M6 21V10a6 6 0 0 1 12 0v11"/><path d="M4 21h16"/><circle cx="12" cy="9" r="1.6"/><path d="M8 13.5h8M8 17.5h8"/><circle cx="15.5" cy="15.5" r=".6"/>') },
  { id: 'part:roundwindow', label: '丸窓', kind: 'part', slot: 'window', rarity: 1, ready: false, color: '#d9a45c',
    svg: s('<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/>') },
  { id: 'part:flowerbox', label: '花箱', kind: 'part', slot: 'sill', rarity: 1, ready: false, color: '#e58fae',
    svg: s('<path d="M4 15h16l-1.5 5h-13z"/><path d="M7 15v-3M12 15v-4M17 15v-3"/><circle cx="7" cy="10.5" r="1.5"/><circle cx="12" cy="9" r="1.5"/><circle cx="17" cy="10.5" r="1.5"/>') },
  { id: 'part:wreath', label: 'リース', kind: 'part', slot: 'doordeco', rarity: 2, ready: false, color: '#6fb05a',
    svg: s('<circle cx="12" cy="11" r="6"/><circle cx="12" cy="11" r="3"/><path d="M10 17l-2 4M14 17l2 4"/><circle cx="12" cy="17" r="1"/>') },
  { id: 'piece:flowerpot', label: '花のはち', kind: 'piece', rarity: 1, ready: false, color: '#c97b55',
    svg: s('<path d="M7 14h10l-1.5 7h-7z"/><path d="M6 14h12"/><path d="M12 14V9"/><circle cx="12" cy="7" r="2"/><path d="M12 11c-2 0-3-1-3.5-2.5M12 11c2 0 3-1 3.5-2.5"/>') },
  { id: 'piece:lamppost', label: '街灯', kind: 'piece', rarity: 1, ready: false, color: '#5a4636',
    svg: s('<path d="M12 21V10"/><path d="M9 21h6"/><path d="M9 6l1-2h4l1 2"/><path d="M9 6h6l-1 4h-4z"/><path d="M12 2v2"/>') },
  { id: 'seed:sunflower', label: 'ひまわりのタネ', kind: 'seed', rarity: 1, ready: false, species: 'sunflower', color: '#e8b52e', svg: SEED },
  { id: 'seed:cosmos', label: 'コスモスのタネ', kind: 'seed', rarity: 1, ready: false, species: 'cosmos', color: '#e58fae', svg: SEED },
  { id: 'seed:lavender', label: 'ラベンダーのタネ', kind: 'seed', rarity: 2, ready: false, species: 'lavender', color: '#9d86d6', svg: SEED },
];

// なかまキャラを足すときの例（3Dのモデルは js/characters.js にも足す）:
// { id: 'chara:hana', label: '花屋のハナ', kind: 'chara', rarity: 3, model: 'hana', color: '#e58fae', svg: '…' },
