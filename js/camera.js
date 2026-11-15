// 町の カメラ（理科の たまごが 孵化すると、発明家の モグラが 作ってくれる）。きまりだけ（3Dも 画面も なし。node で たしかめられる）。
// 画面は js/cameraui.js、3D の 撮影は world.js の camera。写真の 保存は js/photos.js と おなじ しくみ。
//
// 理科が 育つと できることが ふえる（理科の たまごの すすみで 決まる）:
//   Lv1 孵化した … 撮る（10まい まで）
//   Lv2 たねを うえた … ズーム・女の子の ポーズ
//   Lv3 発電所が できた … 自撮り・夕焼けの 色フィルター
// 町の データ（p）には 写真の 名前（p.photos の メタ）だけが 入る。本体は 端末の IndexedDB（photos.js）。
// アルバム（社会）は あとから。shots(p) を 読めば、カメラの 写真を そのまま アルバムに のせられる。
import { eggsOf, featureOpen } from './eggs.js';

export const FEATURE = 'camera';
export const FOLDER = 'camera';      // p.photos の folder。しりょうの フォルダには 出ない
export const MAX_SHOTS = 10;          // アルバムが ないうち、カメラに のこせる 数
export const SUBJECT = '理科';
export const ZOOMS = [1, 1.7, 2.6];
export const POSES = [
  { id: 'wave', label: 'てを ふる' },
  { id: 'banzai', label: 'ばんざい' },
  { id: 'bow', label: 'ぺこり' },
];
// フィルター（夕焼けを こく）。画面の プレビューと 保存の 合成で おなじ 色を つかう
export const SUNSET = {
  top: 'rgba(255, 130, 70, 0.62)',
  bottom: 'rgba(255, 80, 150, 0.5)',
  op: 'soft-light',
};
export const NEED = { zoom: 2, pose: 2, selfie: 3, filter: 3 };

// カメラの 育ち 0〜3（0 = まだ つかえない）
export function cameraLevel(p) {
  if (!featureOpen(p, FEATURE)) return 0;
  const e = eggsOf(p);
  if (e?.built?.rika) return 3;
  if (e?.seed?.rika) return 2;
  return 1;
}
export const can = (p, what) => cameraLevel(p) >= (NEED[what] ?? 99);

// 次に ふえることを 短く（ない ときは null）
export function nextHint(p) {
  const lv = cameraLevel(p);
  if (lv === 1) return '理科の たねを うえると ズームが ふえるよ';
  if (lv === 2) return '発電所が できると 自撮りが できるよ';
  return null;
}

// カメラの 写真（あたらしい じゅん）
export function shots(p) {
  const list = Array.isArray(p?.photos) ? p.photos : [];
  return list.filter((m) => m && m.folder === FOLDER).sort((a, b) => String(b.takenAt).localeCompare(String(a.takenAt)));
}
export const isFull = (p) => shots(p).length >= MAX_SHOTS;

// 写真に つける 名前（日づけと 島）。町の データに 入るのは これだけ
export function shotLabel(at = new Date()) {
  return `${at.getMonth() + 1}月${at.getDate()}日の 町`;
}
