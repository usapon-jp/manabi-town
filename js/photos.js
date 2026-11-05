// しりょうの写真（教科書・プリント・ノート）。いちど入れたら、テスト範囲ごとのフォルダに残って、
// 問題づくり・しつもん・（のちに）ほかの画面から えらんで使える。
// 保存: 写真の本体は この端末の IndexedDB（おおきいので localStorage には入れない）。
// 同期: p.photos の id つき一覧は プロフィールと いっしょに足し合わせ、本体は Storage（manabi-photos/<user>/<id>.jpg）へ。
import { h, toast } from './ui.js';
import { pickPhoto } from './pickphoto.js';
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

// 写真のメタ情報は プロフィールの p.photos（id つきの配列。同期で足し合わせる）、
// 写真の本体は IndexedDB（id で ひもづく）。本体がまだ この端末に ない写真は data が null。
const metas = (p) => (Array.isArray(p.photos) ? p.photos : (p.photos = []));

// 1まい入れる。folder は テスト予定の id か OTHER
export async function addPhoto(p, { dataUrl, folder = OTHER, subject = '', label = '' }) {
  const id = uid();
  await tx('readwrite', (s) => s.put({ id, data: dataUrl }));
  metas(p).push({ id, folder, subject, name: label, takenAt: new Date().toISOString() });
  save();
  return id;
}
export async function allPhotos(p) {
  const rows = await tx('readonly', (s) => s.getAll());
  const have = new Map((rows || []).map((r) => [r.id, r.data]));
  return metas(p).map((m) => ({ ...m, data: have.get(m.id) || null })).sort((a, b) => String(b.takenAt).localeCompare(String(a.takenAt)));
}
export async function getData(id) { return (await tx('readonly', (s) => s.get(id)))?.data || null; }
// 同期用: 本体を IndexedDB に入れる／いま持っている id を知る
export async function putData(id, dataUrl) { await tx('readwrite', (s) => s.put({ id, data: dataUrl })); }
export async function localIds() { return ((await tx('readonly', (s) => s.getAllKeys())) || []); }
export async function removePhoto(p, id) {
  await tx('readwrite', (s) => s.delete(id));
  p.photos = metas(p).filter((m) => m.id !== id);
  save();
}
export function movePhoto(p, id, folder) { const m = metas(p).find((x) => x.id === id); if (m) { m.folder = folder; save(); } }

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
  const addFile = async (f) => {
    if (!f) return;
    const folder = fl.find((x) => x.id === cur);
    try {
      const dataUrl = await shrink(f);
      await addPhoto(p, { dataUrl, folder: cur, subject: folder?.subject || '', label: folder?.name || '' });
      toast('しりょうに 入れたよ');
    } catch { toast('この写真は ひらけなかった'); return; }
    draw();
  };
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
      h('button', { type: 'button', class: 'ph-add', onclick: () => pickPhoto(addFile, { title: 'しりょうに 入れる' }) }, icon('camera'), h('span', {}, '撮る・えらぶ')),
      ...mine.map((x) => h('div', { class: `ph-item ${chosen.has(x.id) ? 'on' : ''}` },
        !x.data ? h('span', { class: 'ph-wait' }, 'じゅんびちゅう') : h('img', { src: x.data, alt: '', onclick: () => {
          if (!opts.pick) return;
          if (chosen.has(x.id)) chosen.delete(x.id); else if (chosen.size < opts.pick) chosen.add(x.id); else toast(`${opts.pick}まいまで`);
          draw();
        } }),
        chosen.has(x.id) ? h('span', { class: 'ph-check' }, icon('check')) : null,
        h('button', { type: 'button', class: 'ph-del', 'aria-label': 'けす', onclick: async () => { chosen.delete(x.id); await removePhoto(p, x.id); draw(); } }, icon('x')))));
    info.textContent = opts.pick ? 'つかう写真を タップ（フォルダは かえてもOK）' : '写真は この端末に ためておくよ。フォルダ＝テスト範囲ごと';
    useBtn.textContent = `この ${chosen.size}まいを つかう`;
    useBtn.hidden = !opts.pick;
    useBtn.disabled = !chosen.size;
  }

  const sheet = h('div', { class: 'sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card piyo-menu ph-card' },
      h('p', { class: 'sheet-title' }, icon('folder'), ' しりょうの写真'),
      tabs, info, grid, useBtn,
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
