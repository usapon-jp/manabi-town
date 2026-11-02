// しりょうの写真（教科書・プリント・ノート）。いちど入れたら、テスト範囲ごとのフォルダに残って、
// 問題づくり・しつもん・（のちに）ほかの画面から えらんで使える。
// 保存: この端末の IndexedDB（写真はおおきいので localStorage には入れない）。
// 端末どうしの同期は、メタ情報 listMeta() と 写真本体 getData(id) を Storage に送る形で つなげる。
import { h, toast } from './ui.js';
import { save } from './store.js';
import { shrink } from './scan.js';
import { icon } from './icons.js';

const DB = 'manabi-photos';
const OTHER = 'other';   // どのテストにも入れない しりょう

let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('no indexedDB')); return; }
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('photos', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}
const tx = async (mode, fn) => {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction('photos', mode);
    const r = fn(t.objectStore('photos'));
    t.oncomplete = () => resolve(r?.result);
    t.onerror = () => reject(t.error);
  });
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// 1まい入れる。folder は テスト予定の id か OTHER
export async function addPhoto(p, { dataUrl, folder = OTHER, subject = '', label = '' }) {
  const rec = { id: uid(), pid: p.id, folder, subject, label, data: dataUrl, at: Date.now() };
  await tx('readwrite', (s) => s.put(rec));
  return rec.id;
}
export async function allPhotos(p) {
  const rows = await tx('readonly', (s) => s.getAll());
  return (rows || []).filter((r) => r.pid === p.id).sort((a, b) => b.at - a.at);
}
// 同期用: 本体をのぞいた情報
export async function listMeta(p) { return (await allPhotos(p)).map(({ data, ...m }) => ({ ...m, bytes: data.length })); }
export async function getData(id) { return (await tx('readonly', (s) => s.get(id)))?.data || null; }
export async function removePhoto(id) { await tx('readwrite', (s) => s.delete(id)); }
export async function movePhoto(id, folder) {
  const d = await db();
  await new Promise((res, rej) => {
    const t = d.transaction('photos', 'readwrite'); const s = t.objectStore('photos'); const g = s.get(id);
    g.onsuccess = () => { if (g.result) { g.result.folder = folder; s.put(g.result); } };
    t.oncomplete = res; t.onerror = () => rej(t.error);
  });
}

function folders(p) {
  const tests = p.items.filter((i) => i.type === 'test' && !i.done).sort((a, b) => a.date.localeCompare(b.date))
    .map((i) => ({ id: i.id, name: i.title, subject: i.subject, sub: i.range || '' }));
  return [...tests, { id: OTHER, name: 'ほかの しりょう', subject: '', sub: '' }];
}

// しりょうを ひらく／えらぶ。opts.pick = 数（えらんで使う時）、opts.folder = さいしょに開くフォルダ、opts.onPick(dataUrls)
export async function openPhotos(p, opts = {}) {
  const fl = folders(p);
  let cur = fl.some((f) => f.id === opts.folder) ? opts.folder : fl[0].id;
  const chosen = new Set();
  const grid = h('div', { class: 'ph-grid' });
  const tabs = h('div', { class: 'ph-tabs' });
  const info = h('p', { class: 'sheet-sub' });
  const close = () => sheet.remove();
  const file = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: async () => {
    const f = file.files[0]; file.value = '';
    if (!f) return;
    const folder = fl.find((x) => x.id === cur);
    try {
      const dataUrl = await shrink(f);
      await addPhoto(p, { dataUrl, folder: cur, subject: folder?.subject || '', label: folder?.name || '' });
      toast('しりょうに 入れたよ');
    } catch { toast('この写真は ひらけなかった'); return; }
    draw();
  } });
  const useBtn = h('button', { type: 'button', class: 'btn primary', onclick: async () => {
    const urls = [];
    for (const id of chosen) { const d = await getData(id); if (d) urls.push(d); }
    close();
    opts.onPick?.(urls);
  } });

  async function draw() {
    const all = await allPhotos(p).catch(() => null);
    if (!all) { grid.replaceChildren(h('p', { class: 'empty' }, 'この端末では 写真を ためておけないみたい')); return; }
    const count = (id) => all.filter((x) => x.folder === id).length;
    tabs.replaceChildren(...fl.map((f) => h('button', { type: 'button', class: `ph-tab ${f.id === cur ? 'on' : ''}`, onclick: () => { cur = f.id; draw(); } },
      h('b', {}, f.name), h('small', {}, `${f.subject ? `${f.subject}・` : ''}${count(f.id)}まい`))));
    const mine = all.filter((x) => x.folder === cur);
    grid.replaceChildren(
      h('button', { type: 'button', class: 'ph-add', onclick: () => file.click() }, icon('camera'), h('span', {}, '撮る・えらぶ')),
      ...mine.map((x) => h('div', { class: `ph-item ${chosen.has(x.id) ? 'on' : ''}` },
        h('img', { src: x.data, alt: '', onclick: () => {
          if (!opts.pick) return;
          if (chosen.has(x.id)) chosen.delete(x.id); else if (chosen.size < opts.pick) chosen.add(x.id); else toast(`${opts.pick}まいまで`);
          draw();
        } }),
        chosen.has(x.id) ? h('span', { class: 'ph-check' }, icon('check')) : null,
        h('button', { type: 'button', class: 'ph-del', 'aria-label': 'けす', onclick: async () => { chosen.delete(x.id); await removePhoto(x.id); draw(); } }, icon('x')))));
    info.textContent = opts.pick ? 'つかう写真を タップ（フォルダは かえてもOK）' : '写真は この端末に ためておくよ。フォルダ＝テスト範囲ごと';
    useBtn.textContent = `この ${chosen.size}まいを つかう`;
    useBtn.hidden = !opts.pick;
    useBtn.disabled = !chosen.size;
  }

  const sheet = h('div', { class: 'sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card piyo-menu ph-card' },
      h('p', { class: 'sheet-title' }, icon('folder'), ' しりょうの写真'),
      tabs, info, grid, useBtn, file,
      h('button', { class: 'link', type: 'button', onclick: close }, 'とじる')));
  document.body.append(sheet);
  draw();
}

// せっていに出す カード
export function photosCard(p) {
  return h('div', { class: 'card form' },
    h('h3', {}, 'しりょうの写真'),
    h('p', {}, '教科書やプリントの写真を、テスト範囲ごとに ためておけます。問題づくりや しつもんで つかえます。'),
    h('button', { class: 'btn', onclick: () => openPhotos(p) }, icon('folder'), ' ひらく'));
}
