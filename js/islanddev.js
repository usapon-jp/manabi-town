// ためしの島。アドレスの うしろに ?shima=test を つけて ひらいたときだけ 読みこまれる（world.js）。
// 島の きりかえが うごくかを たしかめるための もの。ためしの島で 作ったものは 保存されず、ひらきなおすと 消える。
// はじまりの島の データには さわらない。
import { currentProfile } from './store.js';
import { START, registerIsland, currentIslandId, setCurrentIsland, islandDef, onIslandChange } from './islands.js';

const DEV = 'dev-test';

export function startIslandDev(container) {
  registerIsland({ id: DEV, name: 'ためしの島', dev: true });
  const b = document.createElement('button');
  b.type = 'button';
  b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 172px);z-index:5;padding:8px 14px;border-radius:14px;border:2px solid #e2d3ad;background:rgba(255,252,240,.93);color:#6b4a2b;font:inherit;font-size:13px;font-weight:700;';
  const draw = () => {
    const p = currentProfile();
    const here = currentIslandId(p);
    b.hidden = !p;
    b.textContent = `いま: ${islandDef(here)?.name || here} → ${here === DEV ? 'はじまりの島へ' : 'ためしの島へ'}`;
  };
  b.addEventListener('click', () => {
    const p = currentProfile();
    if (p) setCurrentIsland(p, currentIslandId(p) === DEV ? START : DEV);
  });
  onIslandChange(draw);
  draw();
  container.appendChild(b);
}
