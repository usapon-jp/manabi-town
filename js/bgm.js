// 勉強タイマーのBGM。
// - 標準の4曲（たまの勉強タイマーと同じ曲）
// - 前のタイマー（うさぽんタイマー／たまの勉強タイマー）で取り込んだ曲：同じ usapon-jp.github.io の
//   同じブラウザなら、その保存場所（IndexedDB "tama-study-timer-bgm" / "usapon-timer-bgm"）をそのまま読む
// - 前のタイマーの「書き出し」ファイル（usapon-timer-bgm-library の JSON）
// - スマホの曲や動画から取り込む（動画は音だけ取り出す。できないときは動画のまま音を鳴らす）

const STANDARD = [1, 2, 3, 4].map((n) => ({
  id: `standard-bgm-${n}`, name: `やさしいBGM ${n}`, kind: 'audio', src: `assets/audio/study-bgm-${n}.mp3`, from: 'standard',
}));

const OWN_DB = 'manabi-bgm';
const OLD_DBS = ['tama-study-timer-bgm', 'usapon-timer-bgm'];
const STORE = 'tracks';
const META_KEY = 'manabi-bgm-meta';
const OLD_STATE_KEYS = ['usapon-timer-state-v1', 'tama-study-timer-state-v1'];
const VIDEO_AUDIO_RATE = 22050;

// ---- 保存場所 ----------------------------------------------------------------

function openDb(name, create) {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('no indexedDB')); return; }
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      if (create) req.result.createObjectStore(STORE);
      else req.transaction.abort(); // 前のタイマーの保存場所は、なければ作らない
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('open failed'));
    req.onblocked = () => reject(new Error('blocked'));
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(STORE)) { resolve(null); return; }
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result ?? null);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

async function putOwn(id, blob) { const db = await openDb(OWN_DB, true); try { await tx(db, 'readwrite', (s) => s.put(blob, id)); } finally { db.close(); } }
async function getFrom(name, id) { const db = await openDb(name, name === OWN_DB); try { return await tx(db, 'readonly', (s) => s.get(id)); } finally { db.close(); } }
async function deleteOwn(id) { const db = await openDb(OWN_DB, true); try { await tx(db, 'readwrite', (s) => s.delete(id)); } finally { db.close(); } }
async function oldKeys(name) {
  try {
    if (indexedDB.databases) {
      const list = await indexedDB.databases();
      if (!list.some((d) => d.name === name)) return [];
    }
    const db = await openDb(name, false);
    try { return (await tx(db, 'readonly', (s) => s.getAllKeys())) || []; } finally { db.close(); }
  } catch (e) { return []; }
}

const loadMeta = () => { try { return JSON.parse(localStorage.getItem(META_KEY)) || { tracks: [], selected: 'standard-bgm-1', volume: 0.6 }; } catch (e) { return { tracks: [], selected: 'standard-bgm-1', volume: 0.6 }; } };
const saveMeta = (m) => { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) { /* 無視 */ } };
let meta = loadMeta();

// 前のタイマーに入っている曲の名前
function oldTrackNames() {
  const names = {};
  for (const key of OLD_STATE_KEYS) {
    try {
      const s = JSON.parse(localStorage.getItem(key));
      (s?.sound?.customTracks || []).forEach((t) => { if (t?.id) names[t.id] = { name: t.name, kind: t.kind }; });
    } catch (e) { /* 無視 */ }
  }
  return names;
}

// ---- 曲の一覧 ----------------------------------------------------------------

export async function listTracks() {
  const own = meta.tracks.map((t) => ({ ...t, from: 'own' }));
  const ownIds = new Set(own.map((t) => t.id));
  const names = oldTrackNames();
  const old = [];
  for (const db of OLD_DBS) {
    const keys = (await oldKeys(db)).filter((k) => !String(k).startsWith('standard-') && !ownIds.has(String(k)));
    keys.forEach((k) => old.push({ id: String(k), db, name: names[k]?.name || '前のタイマーの曲', kind: names[k]?.kind || 'audio', from: 'old' }));
  }
  return [...STANDARD, ...own, ...old];
}

export function selectedId() { return meta.selected; }
export function setSelected(id) { meta.selected = id; saveMeta(meta); }

// ---- プレイリスト（長く聴く用） ------------------------------------------------
// meta.playlist: 曲idの並び / meta.mode: 'one'=1曲くりかえし, 'all'=じゅんばんにくりかえし, 'shuffle'=シャッフル / meta.useList: リストで流す
export const playlist = () => (Array.isArray(meta.playlist) ? meta.playlist : []);
export const mode = () => meta.mode || 'all';
export const useList = () => !!meta.useList && playlist().length > 0;
export function setMode(m) { meta.mode = m; saveMeta(meta); }
export function setUseList(on) { meta.useList = !!on; saveMeta(meta); }
export function togglePlaylist(id) {
  const l = playlist().slice();
  const i = l.indexOf(id);
  if (i >= 0) l.splice(i, 1); else l.push(id);
  meta.playlist = l;
  if (!l.length) meta.useList = false;
  saveMeta(meta);
}
export function movePlaylist(id, dir) {
  const l = playlist().slice();
  const i = l.indexOf(id); const j = i + dir;
  if (i < 0 || j < 0 || j >= l.length) return;
  [l[i], l[j]] = [l[j], l[i]];
  meta.playlist = l; saveMeta(meta);
}
// つぎにかける曲（リストにない曲idは とばす）
function nextId(current, valid) {
  const l = playlist().filter((id) => valid.has(id));
  if (!l.length) return null;
  if (mode() === 'one') return current;
  if (mode() === 'shuffle') {
    if (l.length === 1) return l[0];
    let n; do { n = l[Math.floor(Math.random() * l.length)]; } while (n === current);
    return n;
  }
  const i = l.indexOf(current);
  return l[(i + 1) % l.length];
}
export function volume() { return meta.volume ?? 0.6; }
export function setVolume(v) { meta.volume = v; saveMeta(meta); if (player) player.volume = v; }

// ---- 取り込み ------------------------------------------------------------------

function encodeMonoWav(buf, rate = VIDEO_AUDIO_RATE) {
  const n = Math.max(1, Math.floor((buf.duration || 0) * rate));
  const out = new ArrayBuffer(44 + n * 2);
  const v = new DataView(out);
  const ch = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i));
  const w = (o, s) => { for (let i = 0; i < s.length; i += 1) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i += 1) {
    const src = Math.min(ch[0].length - 1, Math.floor((i * buf.sampleRate) / rate));
    let s = 0; ch.forEach((c) => { s += c[src] || 0; });
    s = Math.max(-1, Math.min(1, s / Math.max(1, ch.length)));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([out], { type: 'audio/wav' });
}

async function videoToAudio(file) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('no audio');
  const ctx = new AC();
  try { return encodeMonoWav(await ctx.decodeAudioData(await file.arrayBuffer())); } finally { ctx.close?.(); }
}

const newId = () => `own-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// スマホの曲・動画を取り込む。かえり値は曲の情報
export async function importFile(file) {
  const isVideo = (file.type || '').startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(file.name);
  let blob = file; let kind = 'audio';
  if (isVideo) {
    try { blob = await videoToAudio(file); } catch (e) { blob = file; kind = 'video'; }
  }
  const id = newId();
  await putOwn(id, blob);
  const track = { id, name: file.name.replace(/\.[^.]+$/, '').slice(0, 40) || '取り込んだ曲', kind };
  meta.tracks.push(track);
  meta.selected = id;
  saveMeta(meta);
  return track;
}

// 前のタイマーの「書き出し」ファイルを読む
export async function importLibrary(file) {
  const data = JSON.parse(await file.text());
  const list = data?.customTracks || data?.sound?.customTracks || data?.data?.sound?.customTracks || [];
  let n = 0;
  for (const t of list) {
    if (!t?.dataUrl) continue;
    const blob = await (await fetch(t.dataUrl)).blob();
    const id = newId();
    await putOwn(id, blob);
    meta.tracks.push({ id, name: String(t.name || '前のタイマーの曲').slice(0, 40), kind: t.kind === 'video' ? 'video' : 'audio' });
    n += 1;
  }
  saveMeta(meta);
  return n;
}

export async function removeTrack(id) {
  meta.tracks = meta.tracks.filter((t) => t.id !== id);
  if (meta.selected === id) meta.selected = 'standard-bgm-1';
  saveMeta(meta);
  await deleteOwn(id).catch(() => {});
}

// ---- 再生 ----------------------------------------------------------------------

let player = null;
let playerUrl = null;

async function sourceFor(track) {
  if (track.src) return track.src;
  const blob = await getFrom(track.from === 'old' ? track.db : OWN_DB, track.id);
  if (!blob) throw new Error('missing');
  playerUrl = URL.createObjectURL(blob);
  return playerUrl;
}

// 再生のたびに番号をふる。読みこみ中に stop() や別の play() がきたら、古いほうは鳴らさない
let playToken = 0;

export async function play(id, opts = {}) {
  stop();
  const token = playToken;
  const tracks = await listTracks();
  if (token !== playToken) return null;
  const valid = new Set(tracks.map((t) => t.id));
  const listIds = playlist().filter((x) => valid.has(x));
  const listOn = (opts.list ?? (id === undefined && useList())) && listIds.length > 0;
  if (id === undefined) id = listOn ? (mode() === 'shuffle' ? listIds[Math.floor(Math.random() * listIds.length)] : listIds[0]) : meta.selected;
  const track = tracks.find((t) => t.id === id) || STANDARD[0];
  const el = document.createElement(track.kind === 'video' ? 'video' : 'audio');
  // リストで流すときは、1曲おわったらつぎの曲へ（1曲くりかえしだけ loop）
  el.loop = !listOn || mode() === 'one' || listIds.length < 2;
  if (listOn && !el.loop) el.addEventListener('ended', () => { if (token === playToken) { const n = nextId(track.id, valid); if (n) play(n, { list: true }).catch(() => {}); } });
  el.playsInline = true;
  el.setAttribute('playsinline', '');
  el.volume = volume();
  el.style.display = 'none';
  const src = await sourceFor(track);
  if (token !== playToken) { if (src.startsWith('blob:')) URL.revokeObjectURL(src); return null; }
  document.body.append(el);
  player = el;
  el.src = src;
  try {
    await el.play();
  } catch (e) {
    if (token !== playToken) return null;
    throw e;
  }
  if (token !== playToken) { el.pause(); el.remove(); return null; }
  return track;
}

export function stop() {
  playToken += 1;
  if (player) { player.pause(); player.remove(); player = null; }
  if (playerUrl) { URL.revokeObjectURL(playerUrl); playerUrl = null; }
}

export function pause() { player?.pause(); }
export function resume() { player?.play().catch(() => {}); }
export const isPlaying = () => !!player && !player.paused;
