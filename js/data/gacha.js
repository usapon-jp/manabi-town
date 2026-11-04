// ガチャの中身。ふやすときは ITEMS に1行足し、BANNERS の items に id を入れるだけ。
// id は保存に使うので、一度出したら変えない（名前や絵はあとから変えてよい）。
//
// cat（しゅるい）は箱庭の層にあわせる:
//   build = たてる（建物・柵・橋など。マスにすいつく・90度ずつ回す）
//   decor = かざる（小物。自由におく）
//   seed  = うえる（花のタネ。もらうと「花のタネ」の道具でその花がうえられる）
//   chara = なかま（あとから足すキャラクター。もらうと街に住む）
// stack: true は「もらうたびに数がふえる」（柵を何本も並べたい など）。
//        false は「1回もらえば ずっと使える」。2回目からは きらきら になる。

export const CATS = {
  build: { label: 'たてる', stack: true },
  decor: { label: 'かざる', stack: true },
  seed: { label: 'うえる', stack: false },
  chara: { label: 'なかま', stack: false },
};

// ★の出やすさ（合計100）。PITY 回目までに必ず ★3 が出る
export const RARITY = {
  1: { label: 'ふつう', rate: 70 },
  2: { label: 'すこし めずらしい', rate: 25 },
  3: { label: 'めずらしい', rate: 5 },
};
export const PITY = 20;

// ガチャ石の値段。ポイント100 で 石1こ = 1回
export const STONE_PRICE = 100;

const s = (inner) => inner; // 線の絵（24×24、lucide と同じ太さ）

// size は高さのめやす（m）。キャラ1m・ドア1.5m・柵0.5m のものさし（docs/hakoniwa-design.md）
export const ITEMS = [
  // ★1
  { id: 'fence_wood', name: '木のさく', cat: 'build', rarity: 1, qty: 4, size: 0.5, color: '#c99a62',
    svg: s('<path d="M5 21V7l1.5-2.5L8 7v14"/><path d="M11 21V7l1.5-2.5L14 7v14"/><path d="M17 21V7l1.5-2.5L20 7v14"/><path d="M3 11h19"/><path d="M3 17h19"/>') },
  { id: 'fence_white', name: '白いさく', cat: 'build', rarity: 1, qty: 4, size: 0.5, color: '#b9b2a6',
    svg: s('<path d="M4 21V8a1.5 1.5 0 0 1 3 0v13"/><path d="M10.5 21V8a1.5 1.5 0 0 1 3 0v13"/><path d="M17 21V8a1.5 1.5 0 0 1 3 0v13"/><path d="M2 12h20"/><path d="M2 17h20"/>') },
  { id: 'lantern', name: 'ランタン', cat: 'decor', rarity: 1, size: 0.4, color: '#e0a94a',
    svg: s('<path d="M12 2v2"/><path d="M9 4h6"/><path d="M8 7l1-3h6l1 3"/><path d="M8 7h8l-1 11H9z"/><path d="M10 21h4"/><path d="M12 18v3"/><path d="M12 10v4"/>') },
  { id: 'mailbox', name: 'ポスト', cat: 'decor', rarity: 1, size: 1.0, color: '#d9785c',
    svg: s('<path d="M4 12a4 4 0 0 1 8 0v5H4z"/><path d="M8 8h8a4 4 0 0 1 4 4v5h-8"/><path d="M10 17v5"/><path d="M15 10V5h3"/>') },
  { id: 'flowerpot', name: '植木ばち', cat: 'decor', rarity: 1, size: 0.4, color: '#c47f5a',
    svg: s('<path d="M6 13h12l-1.5 8h-9z"/><path d="M12 13V8"/><path d="M12 10c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4z"/><path d="M12 9c0-2.5 1.5-4 4-4 0 2.5-1.5 4-4 4z"/>') },
  { id: 'seed_sunflower', name: 'ひまわりのタネ', cat: 'seed', rarity: 1, species: 'sunflower', color: '#e8b52e',
    svg: s('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 8h14"/><circle cx="12" cy="14.5" r="2"/><path d="M12 10.5v1.2M12 17.3v1.2M8 14.5h1.2M14.8 14.5H16"/>') },
  { id: 'seed_cosmos', name: 'コスモスのタネ', cat: 'seed', rarity: 1, species: 'cosmos', color: '#e58fae',
    svg: s('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 8h14"/><circle cx="12" cy="14.5" r="2"/><path d="M12 10.5v1.2M12 17.3v1.2M8 14.5h1.2M14.8 14.5H16"/>') },
  { id: 'seed_lavender', name: 'ラベンダーのタネ', cat: 'seed', rarity: 1, species: 'lavender', color: '#9d86d6',
    svg: s('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 8h14"/><circle cx="12" cy="14.5" r="2"/><path d="M12 10.5v1.2M12 17.3v1.2M8 14.5h1.2M14.8 14.5H16"/>') },
  // ★2
  { id: 'awning_stripe', name: 'しましまの ひさし', cat: 'build', rarity: 2, size: 1.9, color: '#7f985e',
    svg: s('<path d="M3 4h18l-1 6H4z"/><path d="M4 10a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/><path d="M9 4l-1 6"/><path d="M15 4l1 6"/><path d="M5 13v8"/><path d="M19 13v8"/><path d="M3 21h18"/>') },
  { id: 'bridge_wood', name: '木の はし', cat: 'build', rarity: 2, size: 0.8, color: '#b98754',
    svg: s('<path d="M2 15q10-8 20 0"/><path d="M2 19h20"/><path d="M6 12.4V19"/><path d="M12 11v8"/><path d="M18 12.4V19"/>') },
  { id: 'bench', name: 'ベンチ', cat: 'decor', rarity: 2, size: 0.8, color: '#a8794b',
    svg: s('<path d="M4 6h16"/><path d="M4 10h16"/><path d="M3 14h18"/><path d="M6 6v8"/><path d="M18 6v8"/><path d="M5 14v6"/><path d="M19 14v6"/>') },
  { id: 'rose_arch', name: 'バラのアーチ', cat: 'build', rarity: 2, size: 2.2, color: '#d9788c',
    svg: s('<path d="M5 21V11a7 7 0 0 1 14 0v10"/><path d="M9 21v-9a3 3 0 0 1 6 0v9"/><circle cx="6.5" cy="8.5" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="17.5" cy="8.5" r="1"/>') },
  // ★3
  { id: 'house_hill', name: '丘の 小さな家', cat: 'build', rarity: 3, size: 3.2, color: '#8fa871',
    svg: s('<path d="M2 20c3-7 6.5-10 10-10s7 3 10 10"/><path d="M9 20v-4a3 3 0 0 1 6 0v4"/><path d="M2 20h20"/><path d="M17 9V6h2v5"/><circle cx="12" cy="13" r=".6"/>') },
  { id: 'bridge_stone', name: '石の はし', cat: 'build', rarity: 3, size: 1.2, color: '#9b9488',
    svg: s('<path d="M2 9h20"/><path d="M2 6h20"/><path d="M3 9v11"/><path d="M21 9v11"/><path d="M7 20a5 5 0 0 1 10 0"/><path d="M8 6v3M12 6v3M16 6v3"/>') },
];

// ガチャの台。from / to（YYYY-MM-DD）で出る期間を決められる（なければ ずっと）。
// テストのあとのイベントガチャ（教科キャラ）や、季節のガチャも ここに足していく。
export const BANNERS = [
  {
    id: 'parts', title: 'はこにわパーツ', sub: 'さく・ひさし・家・はし・花のタネ',
    items: ITEMS.map((i) => i.id),
  },
];

// なかまキャラを足すときの例（cat: 'chara' にして、3Dのモデルは js/characters.js にも足す）:
// { id: 'chara_hana', name: '花屋のハナ', cat: 'chara', rarity: 3, model: 'hana', color: '#e58fae', svg: '…' },
