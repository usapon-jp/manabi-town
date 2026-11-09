// 紙を切って重ねた景色。ピヨちゃんの既存画像はそのまま使う。
const tree=(x,y,s,c)=>`<g transform="translate(${x} ${y}) scale(${s})" filter="url(#paper-shadow)"><path d="M-7 0L-3-120H5L9 0Z" fill="#9d7654"/><path d="M0-208C-70-194-91-136-62-108C-108-50-42-15 0-38C52-10 105-65 65-110C92-151 56-203 0-208Z" fill="${c}"/><path d="M0-175V-42M0-103L-32-128M0-80L34-114" fill="none" stroke="#ffffff" stroke-opacity=".15" stroke-width="3"/></g>`;
const flower=(x,y,c)=>`<g transform="translate(${x} ${y})"><path d="M0 0L2-20M0-6Q-13-15-13-5Q-7-3 0-6" stroke="#527e56" stroke-width="3" fill="#6c9862"/><path d="M2-21C-15-12-17-33-5-33C-10-49 11-49 11-35C28-36 24-17 13-19C16-7-1-8 2-21" fill="${c}"/><circle cx="5" cy="-28" r="4" fill="#e6b650"/></g>`;
export const STOPS=Array.from({length:12},(_,i)=>({x:15+(Math.floor(i/4)%2?3-i%4:i%4)*23.3,y:30+Math.floor(i/4)*26}));
export function sceneSvg(scene,done=0) {
  const night=scene==='stars',lake=scene==='lake';
  const sky=night?'#394c68':lake?'#d6e8e9':'#efe9cb';
  const grass=night?'#617a73':lake?'#94b4a0':'#b9c89a';
  const path=STOPS.map((p,i)=>`${i?'L':'M'}${p.x*9.6} ${p.y*5.4}`).join(' ');
  return `<svg class="sb-scenery" viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true"><defs>
  <filter id="paper-shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="2" dy="5" stdDeviation="3" flood-color="#453f2d" flood-opacity=".16"/></filter>
  <filter id="paper-grain"><feTurbulence baseFrequency=".6" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".11"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter>
  <pattern id="checks" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#fff" opacity=".025"/><rect x="16" y="16" width="16" height="16" fill="#fff" opacity=".025"/></pattern>
  </defs><rect width="960" height="540" fill="${sky}"/>
  <rect width="960" height="540" fill="url(#checks)"/>
  ${night?`<circle cx="794" cy="63" r="35" fill="#f7e8ab" filter="url(#paper-shadow)"/><circle cx="778" cy="53" r="35" fill="${sky}"/>${[[93,45],[225,82],[406,42],[590,67],[870,107],[717,28]].map(([x,y])=>`<path class="sb-star" d="M${x} ${y-7}l2 5 6 2-6 2-2 6-2-6-5-2 5-2z" fill="#f7e8ab"/>`).join('')}`:`<circle cx="797" cy="65" r="41" fill="#ebc774" filter="url(#paper-shadow)"/><g class="sb-cloud" fill="#fffaf0" filter="url(#paper-shadow)"><path d="M100 63Q92 40 116 38Q129 15 151 39Q179 34 183 63Z"/><path d="M486 82Q481 60 504 61Q514 35 537 59Q557 53 568 82Z"/></g>`}
  <path d="M0 189Q140 77 291 166Q439 89 571 170Q745 71 960 153V540H0Z" fill="${night?'#70828b':'#c7d3b1'}"/>
  <path d="M0 248Q204 164 363 214Q554 154 717 224Q855 179 960 215V540H0Z" fill="${grass}" filter="url(#paper-shadow)"/>
  ${lake?'<path d="M491 174Q660 156 960 207V540H643Q700 454 577 381Q704 290 491 174Z" fill="#76a7b5"/><path d="M772 276h88m-57 14h91m-164 120h93" fill="none" stroke="#c8e1de" stroke-width="4"/>':''}
  <path d="M0 421Q181 389 330 458Q566 385 732 443Q868 395 960 420V540H0Z" fill="${night?'#46685e':'#7eaa7b'}"/>
  <path d="${path}" fill="none" stroke="#e7d3a9" stroke-width="41" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
  <path d="${path}" fill="none" stroke="#fcf0ce" stroke-width="27" stroke-linecap="round" stroke-linejoin="round"/>
  ${tree(30,300,.85,night?'#48675c':'#6d946b')}${tree(927,403,1.15,night?'#3d6058':'#628768')}${tree(58,547,.72,night?'#517a69':'#759963')}
  <g transform="translate(747 400)" filter="url(#paper-shadow)"><path d="M-46 52V-25H44V52Z" fill="#f1dfb4"/><path d="M-64-25L0-75L62-25Z" fill="${night?'#bd8e7c':'#bd7e63'}"/><path d="M-9 52V16Q-9-8 12-8Q30-8 30 16V52Z" fill="#a7825f"/><rect x="-33" y="-8" width="17" height="24" rx="6" fill="#e9c678"/></g>
  <g filter="url(#paper-shadow)"><ellipse cx="490" cy="484" rx="70" ry="10" fill="#486147" opacity=".16"/><path d="M435 483l8-57h91l10 57" fill="#bb9670"/><path d="M431 423h119v13H431Z" fill="#ead5b1"/><path d="M446 423v-16h88v16" fill="#fbf1d4"/><path d="M456 407v-17h68v17" fill="#e7ba94"/><path d="M490 389v-15" stroke="#eac876" stroke-width="4"/></g>
  ${[[103,462],[186,520],[857,493],[664,507],[348,479]].map(([x,y],i)=>flower(x,y,night?'#e6c3b9':i%2?'#f4e6b2':'#e8bac0')).join('')}
  ${done?Array.from({length:Math.min(done,12)},(_,i)=>{const p=STOPS[i];return flower(p.x*9.6+29,p.y*5.4+17,i%2?'#f1d58f':'#e4adbb');}).join(''):''}
  <rect width="960" height="540" fill="transparent" filter="url(#paper-grain)" opacity=".38"/>
  </svg>`;
}
