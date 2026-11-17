// 町の アルバム（社会の たまごが 孵化すると、旅人の キツネが「旅の アルバム」を くれる）。きまりだけ（画面なし。node で たしかめられる）。
// 画面は js/albumui.js。写真は カメラ（js/camera.js）で とった ものが、そのまま 古い じゅんに ページに はられる。
//
// 社会が 育つと できることが ふえる（社会の たまごの すすみで 決まる）:
//   Lv1 孵化した … 8ページ（32まい）。日づけと 島の 名前が つく
//   Lv2 市場の たねを うえた … 16ページ（64まい）・スタンプ
//   Lv3 市場が できた … 25ページ（100まい）・ひとこと
// アルバムが ないうちは カメラに 10まい（camera.js の MAX_SHOTS）。アルバムが あれば アルバムの ページぶん とっておける。
// 保存: 写真の メタ（p.photos の 1こ）に stamp と note を 足すだけ。id ごとに 中身を まとめる 同期（merge.js）で そろう。
// 写真を うごかしたり folder を かえたりは しない（古い 版の 端末と いっしょに 使っても こわれない）。
import { eggsOf, featureOpen } from './eggs.js';
import { shots, MAX_SHOTS } from './camera.js';

export const FEATURE = 'album';
export const SUBJECT = '社会';
export const PER_PAGE = 4;
export const PAGES = [0, 8, 16, 25];          // Lv ごとの ページ数（Lv3 で 100まい）
export const NEED = { stamp: 2, note: 3 };
export const NOTE_MAX = 16;                    // ひとことの 字数
// スタンプ（アイコンは icons.js の 名前）。id は 保存に 入るので かえない
export const STAMPS = [
  { id: 'star', icon: 'star', color: '#f2b632', label: 'ほし' },
  { id: 'sparkles', icon: 'sparkles', color: '#c48bea', label: 'きらきら' },
  { id: 'smile', icon: 'smile', color: '#f08a5d', label: 'にこにこ' },
  { id: 'leaf', icon: 'leaf', color: '#6fae5b', label: 'はっぱ' },
  { id: 'moon', icon: 'moon', color: '#6f8fd8', label: 'おつきさま' },
  { id: 'party', icon: 'party-popper', color: '#e86f8f', label: 'おいわい' },
];
const stampIds = new Set(STAMPS.map((s) => s.id));
export const stampDef = (id) => STAMPS.find((s) => s.id === id) || null;

// アルバムの 育ち 0〜3（0 = まだ もらっていない）
export function albumLevel(p) {
  if (!featureOpen(p, FEATURE)) return 0;
  const e = eggsOf(p);
  if (e?.built?.shakai) return 3;
  if (e?.seed?.shakai) return 2;
  return 1;
}
export const can = (p, what) => albumLevel(p) >= (NEED[what] ?? 99);
export const pageCount = (p) => PAGES[albumLevel(p)] || 0;
// とっておける 写真の 数（アルバムが ないうちは カメラの 10まい）
export function shotCap(p) {
  const lv = albumLevel(p);
  return lv ? PAGES[lv] * PER_PAGE : MAX_SHOTS;
}
export const isFull = (p) => shots(p).length >= shotCap(p);
export const isMax = (p) => albumLevel(p) >= 3;

// 次に ふえることを 短く（ない ときは null）
export function nextHint(p) {
  const lv = albumLevel(p);
  if (lv === 1) return '社会の たねで ページと スタンプが ふえるよ';
  if (lv === 2) return '市場が できると ひとことが 書けるよ';
  return null;
}

// アルバムの 写真（古い じゅん。本の ように 1ページめが いちばん 古い）
export const albumShots = (p) => shots(p).slice().reverse();
// ページごとに わける。ページ数は いまの Lv ぶん（写真が それより 多い ときは 写真の ぶんまで 出す）
export function pagesOf(p) {
  const list = albumShots(p);
  const n = Math.max(pageCount(p), Math.ceil(list.length / PER_PAGE), 1);
  return Array.from({ length: n }, (_, i) => list.slice(i * PER_PAGE, (i + 1) * PER_PAGE));
}
// いちばん あたらしい 写真の ある ページ（なければ 0）
export function lastPage(p) {
  const n = albumShots(p).length;
  return n ? Math.floor((n - 1) / PER_PAGE) : 0;
}

// ---- スタンプ・ひとこと（メタを 書きかえるだけ。save は 呼ぶがわ） ----
const metaOf = (p, id) => (Array.isArray(p?.photos) ? p.photos.find((m) => m && m.id === id) : null);
// おなじ スタンプを もういちど おすと はずす。null で はずす
export function setStamp(p, id, stamp) {
  const m = metaOf(p, id);
  if (!m || !can(p, 'stamp')) return false;
  if (stamp == null || m.stamp === stamp) { delete m.stamp; return true; }
  if (!stampIds.has(stamp)) return false;
  m.stamp = stamp;
  return true;
}
export function cleanNote(text) {
  return [...String(text ?? '').replace(/[\r\n\t]+/g, ' ').trim()].slice(0, NOTE_MAX).join('');
}
export function setNote(p, id, text) {
  const m = metaOf(p, id);
  if (!m || !can(p, 'note')) return false;
  const t = cleanNote(text);
  if (t) m.note = t; else delete m.note;
  return true;
}
