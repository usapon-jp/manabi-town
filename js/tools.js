// 道具の登録表。ピヨが手に持って、押しながら歩くと足もとが変わる。
// 道具をふやすときは、ここに1つ足す（unlockLv は、あとでレベル解放に使う）。
const svg = (inner) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const TOOLS = [
  {
    id: 'mower', label: '草かり', unlockLv: 1, op: 'path', width: 'brush',
    svg: svg('<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>'),
  },
  {
    id: 'fill', label: 'うめる', unlockLv: 1, op: 'fill', width: 'river',
    svg: svg('<path d="M3 17h18"/><path d="M5 13h14"/><path d="M8 9h8"/><path d="M12 3v4"/><path d="m10 5 2 2 2-2"/>'),
  },
  {
    id: 'seed', label: '草のタネ', unlockLv: 1, op: 'seed', width: 'brush',
    svg: svg('<path d="M7 20h10"/><path d="M12 20V10"/><path d="M12 14c-3.5 0-5-2-5-5 3.5 0 5 2 5 5z"/><path d="M12 11c0-3.5 2-5 5-5 0 3.5-2 5-5 5z"/>'),
  },
  {
    id: 'flower', label: '花のタネ', unlockLv: 1, op: 'plant', width: 'stamp',
    svg: svg('<circle cx="12" cy="12" r="2.6"/><path d="M12 9.4V5.2a2.6 2.6 0 0 1 5.2 0c0 1.9-2.3 4.2-5.2 4.2z" transform="translate(-2.6 0)"/><path d="M14.6 12h4.2a2.6 2.6 0 0 1 0 5.2c-1.9 0-4.2-2.3-4.2-5.2z" transform="translate(0 -2.6)"/><path d="M12 14.6v4.2a2.6 2.6 0 0 1-5.2 0c0-1.9 2.3-4.2 5.2-4.2z" transform="translate(2.6 0)"/><path d="M9.4 12H5.2a2.6 2.6 0 0 1 0-5.2c1.9 0 4.2 2.3 4.2 5.2z" transform="translate(0 2.6)"/>'),
  },
  {
    id: 'shovel', label: 'スコップ', unlockLv: 1, op: 'dig', width: 'river',
    svg: svg('<path d="M20 4l-8.5 8.5"/><path d="M17 3l4 4"/><path d="M11.5 12.5L6.8 17.2a2.1 2.1 0 0 1-3-3L8.5 9.5"/>'),
  },
];
// 柵・橋・おきもの（もちものはガチャでふえる。catalog.js）
TOOLS.push(
  {
    id: 'fence', label: '柵', unlockLv: 1, op: 'fence', width: 'none',
    svg: svg('<path d="M4 21V8l2-3 2 3v13"/><path d="M10 21V8l2-3 2 3v13"/><path d="M16 21V8l2-3 2 3v13"/><path d="M3 12h18"/><path d="M3 17h18"/>'),
  },
  {
    id: 'bridge', label: '橋', unlockLv: 1, op: 'bridge', width: 'none',
    svg: svg('<path d="M2 15c4-8 16-8 20 0"/><path d="M2 20h20"/><path d="M6 20v-6"/><path d="M12 20V9"/><path d="M18 20v-6"/>'),
  },
  {
    id: 'part', label: 'つける', unlockLv: 1, op: 'attach', width: 'none',
    svg: svg('<path d="M10 3H5a2 2 0 0 0-2 2v5"/><path d="M14 3h5a2 2 0 0 1 2 2v5"/><path d="M10 21H5a2 2 0 0 1-2-2v-5"/><path d="M14 21h5a2 2 0 0 0 2-2v-5"/><circle cx="12" cy="12" r="3"/>'),
  },
  {
    id: 'piece', label: 'おきもの', unlockLv: 1, op: 'place', width: 'none',
    svg: svg('<path d="M3 21h18"/><path d="M5 21V11l7-6 7 6v10"/><path d="M10 21v-6h4v6"/>'),
  },
);

export const toolById = (id) => TOOLS.find((t) => t.id === id) || TOOLS[0];
