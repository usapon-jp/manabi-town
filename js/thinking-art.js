// 紙を切って重ねた景色。
const tree=(x,y,s,c)=>`<g transform="translate(${x} ${y}) scale(${s})" filter="url(#paper-shadow)"><path d="M-7 0L-3-120H5L9 0Z" fill="#9d7654"/><path d="M0-208C-70-194-91-136-62-108C-108-50-42-15 0-38C52-10 105-65 65-110C92-151 56-203 0-208Z" fill="${c}"/><path d="M0-175V-42M0-103L-32-128M0-80L34-114" fill="none" stroke="#ffffff" stroke-opacity=".15" stroke-width="3"/></g>`;
const flower=(x,y,c)=>`<g transform="translate(${x} ${y})"><path d="M0 0L2-20M0-6Q-13-15-13-5Q-7-3 0-6" stroke="#527e56" stroke-width="3" fill="#6c9862"/><path d="M2-21C-15-12-17-33-5-33C-10-49 11-49 11-35C28-36 24-17 13-19C16-7-1-8 2-21" fill="${c}"/><circle cx="5" cy="-28" r="4" fill="#e6b650"/></g>`;
export const STOPS=Array.from({length:12},(_,i)=>({x:15+(Math.floor(i/4)%2?3-i%4:i%4)*23.3,y:34+Math.floor(i/4)*25}));
export function sceneSvg(scene,done=0) {
  const night=scene==='stars',lake=scene==='lake';
  const sky=night?'#384b6d':lake?'#c9e3ed':'#f5dfa4';
  const grass=night?'#687f77':lake?'#9fbfa6':'#a7bd7d';
  const path=STOPS.map((p,i)=>`${i?'L':'M'}${p.x*9.6} ${p.y*5.4}`).join(' ');
  return `<svg class="sb-scenery" viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true"><defs>
  <filter id="paper-shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="2" dy="5" stdDeviation="2.5" flood-color="#453f2d" flood-opacity=".26"/></filter>
  <filter id="paper-grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency=".56 .75" numOctaves="3" stitchTiles="stitch"/>
    <feColorMatrix type="matrix" values="1.35 0 0 0 -.175  1.35 0 0 0 -.175  1.35 0 0 0 -.175  0 0 0 0 1"/>
  </filter>
  <pattern id="paper-fibres" width="169" height="101" patternUnits="userSpaceOnUse" fill="none" stroke-linecap="round">
    <path d="M11 24l9-1m29 52 15 1m34-59 12-2m25 36 9 1m6 40 8-2" stroke="#fff8dc" stroke-opacity=".22" stroke-width="1.6"/>
    <path d="M28 47l8 1m31-39 11 1m7 49 7-1m21 26 10 2m33-72 7-1" stroke="#4a4534" stroke-opacity=".14" stroke-width="1.2"/>
  </pattern>
  </defs><rect width="960" height="540" fill="${sky}"/>
  <path d="M0 0H960V79Q792 66 644 78T339 70Q171 65 0 91Z" fill="#fff8e7" opacity=".12"/>
  ${night?`<circle cx="794" cy="63" r="35" fill="#f7e8ab" filter="url(#paper-shadow)"/><circle cx="778" cy="53" r="35" fill="${sky}"/>${[[93,45],[225,82],[406,42],[590,67],[870,107],[717,28]].map(([x,y])=>`<path class="sb-star" d="M${x} ${y-7}l2 5 6 2-6 2-2 6-2-6-5-2 5-2z" fill="#f7e8ab"/>`).join('')}`:`<circle cx="797" cy="65" r="41" fill="#ebc774" filter="url(#paper-shadow)"/><g class="sb-cloud" fill="#fffaf0" filter="url(#paper-shadow)"><path d="M100 63Q92 40 116 38Q129 15 151 39Q179 34 183 63Z"/><path d="M486 82Q481 60 504 61Q514 35 537 59Q557 53 568 82Z"/></g>`}
  <path d="M0 189Q140 77 291 166Q439 89 571 170Q745 71 960 153V540H0Z" fill="${night?'#78879c':lake?'#bed4bb':'#cad3a4'}"/>
  <path d="M0 248Q204 164 363 214Q554 154 717 224Q855 179 960 215V540H0Z" fill="${grass}" filter="url(#paper-shadow)"/>
  ${lake?'<path d="M491 174Q660 156 960 207V540H643Q700 454 577 381Q704 290 491 174Z" fill="#76a7b5"/><path d="M772 276h88m-57 14h91m-164 120h93" fill="none" stroke="#c8e1de" stroke-width="4"/>':''}
  <path d="M0 421Q181 389 330 458Q566 385 732 443Q868 395 960 420V540H0Z" fill="${night?'#486e61':lake?'#729f87':'#73a36b'}"/>
  <path d="${path}" fill="none" filter="url(#paper-shadow)" stroke="#dfc79a" stroke-width="41" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
  <path d="${path}" fill="none" stroke="#fcf0ce" stroke-width="27" stroke-linecap="round" stroke-linejoin="round"/>
  ${tree(30,300,.85,night?'#48675c':'#6d946b')}${tree(927,403,1.15,night?'#3d6058':'#628768')}${tree(58,547,.72,night?'#517a69':'#759963')}
  <g transform="translate(747 400)" filter="url(#paper-shadow)"><path d="M-46 52V-25H44V52Z" fill="#f1dfb4"/><path d="M-64-25L0-75L62-25Z" fill="${night?'#bd8e7c':'#bd7e63'}"/><path d="M-9 52V16Q-9-8 12-8Q30-8 30 16V52Z" fill="#a7825f"/><rect x="-33" y="-8" width="17" height="24" rx="6" fill="#e9c678"/></g>
  <g filter="url(#paper-shadow)"><ellipse cx="490" cy="484" rx="70" ry="10" fill="#486147" opacity=".16"/><path d="M435 483l8-57h91l10 57" fill="#bb9670"/><path d="M431 423h119v13H431Z" fill="#ead5b1"/><path d="M446 423v-16h88v16" fill="#fbf1d4"/><path d="M456 407v-17h68v17" fill="#e7ba94"/><path d="M490 389v-15" stroke="#eac876" stroke-width="4"/></g>
  ${[[103,462],[186,520],[857,493],[664,507],[348,479]].map(([x,y],i)=>flower(x,y,night?'#e6c3b9':i%2?'#f4e6b2':'#e8bac0')).join('')}
  ${done?Array.from({length:Math.min(done,12)},(_,i)=>{const p=STOPS[i];return flower(p.x*9.6+29,p.y*5.4+17,i%2?'#f1d58f':'#e4adbb');}).join(''):''}
  <rect width="960" height="540" fill="url(#paper-fibres)"/>
  <rect class="sb-grain" width="960" height="540" fill="#808080" filter="url(#paper-grain)" opacity=".36"/>
  </svg>`;
}
