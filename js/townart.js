// レベルアップのおしらせに出す、建物の小さな絵（SVG）。やさしい色で、ぜんぶ手でかいたもの。
// キーは、js/town.js の PLAN の「おしらせの名前」（unlock）。ない建物は、ふつうの家の絵になる。
const frame = (inner) => `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
  <ellipse cx="100" cy="176" rx="78" ry="12" fill="#6d9a4a" opacity="0.35"/>${inner}</svg>`;
const flower = (x, y, c) => `<g transform="translate(${x} ${y})"><circle r="5" fill="#ffd84a"/>${[0, 72, 144, 216, 288].map((a) => `<circle cx="${Math.cos((a * Math.PI) / 180) * 7}" cy="${Math.sin((a * Math.PI) / 180) * 7}" r="4.5" fill="${c}"/>`).join('')}<circle r="3.5" fill="#ffd84a"/></g>`;

const ART = {
  '看板と花だん': frame(`
    <rect x="94" y="70" width="9" height="104" rx="3" fill="#a9794a"/>
    <rect x="46" y="48" width="108" height="42" rx="8" fill="#fff3c9" stroke="#c98f4a" stroke-width="5"/>
    <text x="100" y="76" text-anchor="middle" font-size="19" font-weight="800" fill="#6b4a2b" font-family="sans-serif">まなびタウン</text>
    <ellipse cx="100" cy="164" rx="46" ry="12" fill="#8a6a4d"/>
    ${flower(70, 150, '#ff8fb3')}${flower(100, 144, '#fff08a')}${flower(130, 150, '#c7a6ff')}${flower(85, 160, '#ffffff')}${flower(116, 160, '#ffb27a')}`),
  '池': frame(`
    <ellipse cx="100" cy="150" rx="74" ry="30" fill="#c4beb0"/><ellipse cx="100" cy="148" rx="62" ry="23" fill="#7fd0ec"/>
    <ellipse cx="82" cy="142" rx="24" ry="6" fill="#fff" opacity="0.45"/>
    <ellipse cx="124" cy="152" rx="11" ry="5" fill="#5fb86a"/><circle cx="124" cy="148" r="5" fill="#ffb6d0"/>
    <rect x="152" y="96" width="3" height="48" fill="#6fae56"/><rect x="149" y="82" width="9" height="20" rx="4" fill="#8a5a3c"/>
    <rect x="164" y="108" width="3" height="40" fill="#6fae56"/><rect x="161" y="96" width="9" height="18" rx="4" fill="#8a5a3c"/>`),
  'コテージと柵': frame(`
    <rect x="46" y="96" width="108" height="70" rx="10" fill="#fff0cf"/>
    <path d="M30 100 L100 40 L170 100 Z" fill="#a9d95f"/><path d="M30 100 L100 40 L170 100" fill="none" stroke="#6f9a3c" stroke-width="5" stroke-linejoin="round"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${52 + i * 19}" cy="${88 - (i % 2) * 8}" r="8" fill="#93c957" opacity="0.8"/>`).join('')}
    <rect x="124" y="52" width="16" height="30" rx="3" fill="#e2bf86"/>
    <path d="M86 166 V132 a14 14 0 0 1 28 0 V166 Z" fill="#c78a4f"/><circle cx="106" cy="144" r="2.6" fill="#ffd45c"/>
    <rect x="58" y="116" width="24" height="26" rx="6" fill="#ffe39a" stroke="#d9a066" stroke-width="3"/><rect x="118" y="116" width="24" height="26" rx="6" fill="#ffe39a" stroke="#d9a066" stroke-width="3"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${24 + i * 22}" y="150" width="10" height="26" rx="3" fill="#faf0d6"/>`).join('')}<rect x="20" y="158" width="162" height="5" fill="#e6d3a3"/>`),
  'きのこの家': frame(`
    <rect x="68" y="102" width="64" height="66" rx="12" fill="#fff0cf"/>
    <path d="M26 112 a74 66 0 0 1 148 0 Z" fill="#f26a4b"/><path d="M26 112 h148" stroke="#fff4dc" stroke-width="8" stroke-linecap="round"/>
    <ellipse cx="62" cy="76" rx="13" ry="8" fill="#fff6e8"/><ellipse cx="108" cy="58" rx="15" ry="9" fill="#fff6e8"/><ellipse cx="146" cy="84" rx="11" ry="7" fill="#fff6e8"/>
    <path d="M88 168 V140 a12 12 0 0 1 24 0 V168 Z" fill="#c78a4f"/><circle cx="108" cy="148" r="2.4" fill="#ffd45c"/>
    <circle cx="82" cy="130" r="8" fill="#ffe39a" stroke="#d9a066" stroke-width="3"/>`),
  '風車': frame(`
    <path d="M78 168 L86 84 H114 L122 168 Z" fill="#fff0cf"/><path d="M72 88 a28 22 0 0 1 56 0 Z" fill="#6fa8dc"/>
    <path d="M92 168 V148 a8 8 0 0 1 16 0 V168 Z" fill="#9a6a4a"/>
    <g transform="translate(100 78) rotate(18)">
    ${[0, 90, 180, 270].map((a) => `<g transform="rotate(${a})"><rect x="-2.5" y="-58" width="5" height="58" rx="2" fill="#93603e"/><path d="M3 -56 H26 V-20 H3 Z" fill="#ffffff" stroke="#d9b48a" stroke-width="2.5" stroke-linejoin="round"/><path d="M3 -44 H26 M3 -32 H26" stroke="#e6d3a3" stroke-width="2"/></g>`).join('')}
    <circle r="7" fill="#ffd45c" stroke="#d9a840" stroke-width="2"/></g>`),
  '学校': frame(`
    <rect x="22" y="104" width="156" height="64" rx="8" fill="#fff3dc"/><rect x="14" y="96" width="172" height="14" rx="4" fill="#d9644f"/>
    <rect x="80" y="48" width="40" height="52" rx="4" fill="#fff3dc"/><path d="M74 54 L100 22 L126 54 Z" fill="#d9644f"/>
    <circle cx="100" cy="72" r="13" fill="#fff" stroke="#93603e" stroke-width="3"/><path d="M100 72 V63 M100 72 L107 75" stroke="#4a4a4a" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M90 168 V138 a10 10 0 0 1 20 0 V168 Z" fill="#c78a4f"/>
    ${[40, 62, 128, 150].map((x) => `<rect x="${x}" y="120" width="18" height="24" rx="4" fill="#bfe6ff" stroke="#fff" stroke-width="3"/>`).join('')}
    <rect x="168" y="62" width="3" height="40" fill="#8a8a8a"/><rect x="171" y="62" width="18" height="11" fill="#ff7a7a"/>`),
  '噴水': frame(`
    <ellipse cx="100" cy="150" rx="76" ry="24" fill="#d9d4c7"/><ellipse cx="100" cy="146" rx="64" ry="18" fill="#8fd6f2"/>
    <rect x="94" y="84" width="12" height="62" rx="4" fill="#d9d4c7"/><ellipse cx="100" cy="86" rx="26" ry="8" fill="#d9d4c7"/>
    ${[-28, -14, 0, 14, 28].map((dx) => `<path d="M100 82 q${dx * 0.8} -46 ${dx * 1.6} 0" fill="none" stroke="#c9efff" stroke-width="4" stroke-linecap="round"/>`).join('')}`),
  '虹': frame(`
    ${['#ff6b6b', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#b197fc'].map((c, i) => `<path d="M${22 + i * 7} 160 a${78 - i * 7} ${78 - i * 7} 0 0 1 ${(78 - i * 7) * 2} 0" fill="none" stroke="${c}" stroke-width="8"/>`).join('')}
    <ellipse cx="40" cy="162" rx="30" ry="14" fill="#fff"/><ellipse cx="160" cy="162" rx="30" ry="14" fill="#fff"/>`),
  '塔': frame(`
    <rect x="76" y="70" width="48" height="100" rx="6" fill="#f4e9ff"/><path d="M68 76 L100 28 L132 76 Z" fill="#ff8fb3"/>
    <path d="M100 14 l4 9 10 1 -7 7 2 10 -9 -5 -9 5 2 -10 -7 -7 10 -1 Z" fill="#ffe066"/>
    <path d="M92 170 V148 a8 8 0 0 1 16 0 V170 Z" fill="#c78a4f"/>
    <rect x="90" y="92" width="20" height="26" rx="8" fill="#ffe39a"/>
    <rect x="46" y="112" width="30" height="58" rx="6" fill="#f4e9ff"/><path d="M42 116 L61 86 L80 116 Z" fill="#74c0fc"/>
    <rect x="124" y="112" width="30" height="58" rx="6" fill="#f4e9ff"/><path d="M120 116 L139 86 L158 116 Z" fill="#74c0fc"/>`),
};
const DEFAULT = frame(`<rect x="56" y="98" width="88" height="70" rx="8" fill="#fff0cf"/><path d="M40 102 L100 50 L160 102 Z" fill="#e5705f"/>
  <path d="M88 168 V140 a12 12 0 0 1 24 0 V168 Z" fill="#c78a4f"/><rect x="64" y="116" width="20" height="22" rx="5" fill="#ffe39a"/><rect x="116" y="116" width="20" height="22" rx="5" fill="#ffe39a"/>`);

export function buildingArt(name) { return ART[name] || DEFAULT; }
