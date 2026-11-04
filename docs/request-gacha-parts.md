# 3Dセッションへのお願い: ガチャは画面スレッドの PR #35 にまとめました

フミオさんがガチャの相談をまちがえて3Dセッションに送っていたので、画面スレッドのほうで1つにまとめました（PR #35）。
フミオさんの数字（毎日1回のログインボーナス・ポイント100で1回・レベルアップごとに1回）と、
3Dセッションの「まだ持っていない物から、めずらしさの重みで1つ（60:30:10）」をそのまま使っています。

## ブランチ ccr-6c4b445c-hnuwt5-bridge で、main を取りこむときにしてほしいこと

1. **`js/gacha.js` と `js/catalog.js`**: どちらも main 側（PR #35）のものを使ってください（add/add で ぶつかります）。
   - `js/catalog.js` は同じ使い方の入り口を残しました: `ITEMS[id].label` / `ownedOfKind(kind)` / `isOwned(id)` / `ownedSet()`。editor.js はそのまま動くはずです。
   - 中身の表は `js/data/gacha.js`。id は 3D側と同じ（`fence:wood` `fence:stone` `fence:iron` `piece:raisedbed` `piece:awning` `piece:hill`）。`own: true` も同じ。
   - `rarity` は 1/2/3 の数字にしました（common=1, uncommon=2, rare=3）。
   - `drawItem` と `RARITY_WEIGHT` はなくなりました（ひくのは js/gacha.js の `pull`）。
2. **`js/gachaui.js` を消す**、editor.js の **ガチャボタン（`.gbtn`）・`grantFree` のお知らせ・ガチャの CSS を外す**。ガチャは上のバーのカプセルから開きます。
3. **merge.js の `tickets`** は入れないでください。石の数は記録から計算するので、足しあわせは いりません。
4. もちものの保存は `p.world.owned` ではなく `p.gacha.got`（ガチャの記録）です。`ownedSet()` が両方の分をまとめて返すので、3D側はふつうは気にしなくて大丈夫です。

## 3Dを作ってほしいもの（表には `ready: false` で入れてあり、まだガチャに出ません）

できたら `js/data/gacha.js` のその行の `ready: false` を消すと、ガチャに出るようになります。

| id | 名前 | 種類 | メモ |
| --- | --- | --- | --- |
| fence:white | 白い柵 | 柵のかたち | 白いピケットフェンス・0.5m |
| piece:lantern | ランタン | おきもの | 0.4m、夜に少し光るとうれしい |
| piece:mailbox | ポスト | おきもの | 1.0m、赤っぽい |
| piece:bench | ベンチ | おきもの | 0.8m（家具は1.2倍） |
| piece:rosearch | バラのアーチ | おきもの | 2.2m、くぐれる |
| seed:sunflower / seed:cosmos / seed:lavender | 花のタネ | 花 | `plants.js` の `SPECIES` に `sunflower` `cosmos` `lavender` を足し、「花のタネ」の道具で `ownedSeeds(p)` の花だけ出す（今の5種類は最初から） |

いまガチャに出るのは4つ（石垣・てつの柵・ひさし・丘の家）だけなので、毎日1回だと4日でぜんぶそろいます。上の表を少しずつ ready にしてもらえると、長く楽しめます。

## 家のパーツ（フミオさん 2026-11-04 夜）: 扉・窓・ひさしを家に付けかえる

フミオさんの希望: 家は基本の形でポンと置き、扉・窓・ひさしは あとから自分で付けたり付けかえたりしたい。ひさしは四つ足なしで、家の入口や窓の上に付けるカフェ風。丘の家は入口が丘に埋もれていたので直す。丸窓とアーチの扉もガチャのパーツに。

画面スレッドで `js/pieces.js` と `js/structures.js` を書きかえて、画像でフミオさんに見てもらいました（`house-parts-preview.png`）。
パッチ: `docs/3d-patches/house-parts.patch`（新しいファイル js/props.js・assets/models/lamppost.json も入っています。ブランチ ccr-6c4b445c-hnuwt5-bridge の 0fcb8d5 に `git apply` で当たります）。

- `PARTS`（pieces.js）: `part:door` `part:archdoor`（slot door）、`part:window` `part:roundwindow`（slot window）、`piece:awning`（slot over）、`part:flowerbox`（slot sill = 窓の下）。どれも +z が外向きの部品
- 花箱の花はえらべる: op に `flowers: { sillL: 'lupine' }`（tulip / lupine / buttercup / clover / dandelion。なし=いろいろ）。花のえらび方は「花のタネ」の道具と同じ一覧を出すとよい
- ひさしの奥行きはソケットの `d`（なしで 0.38m、丸い家は短め）。大きい建物を足したら `d: 0.75` の長い版を使う（フミオさん希望）
- アーチの扉: ミント `part:archdoor` と茶色 `part:archdoor-brown` の2色（どちらもガチャ）。アーチは ExtrudeGeometry のなめらかな形（`archGeo`）。リースは別のパーツ `part:wreath`（slot doordeco = 扉のかざり）
- 花のはち `piece:flowerpot`: どこにでも置ける小物。op.species で花をえらべる
- 街灯 `piece:lamppost`: うさぽん村（usapon-machi/2026）の街灯モデルをそのまま。`assets/models/lamppost.json`（うさぽん村の PROPS.lamp）と読みこみ `js/props.js`。丘の家の灯りもこれに
- `HOUSES['piece:hill'].sockets`: door / winL / winR / sillL / sillR / overDoor / overL / overR。`base` が最初の扉と窓
- 置いたものの op に `parts: { door: 'part:archdoor', overDoor: 'piece:awning', winL: null }` のように持つ。`houseParts(op)` が base と合わせて返す（null = はずす）
- 丘の家: 高さ 2.5m に。玄関は石のアーチで丘から前に出し（扉 1.45m）、上は草でおおう。窓は丘の表面にそって外向き
- ひさしだけで置いたとき（むかしの置きかた）は、木の板のかべに付いた形で出る
- 石垣のこけ: 上の まん中の 緑の丸が「穴」に見えたので、ふちに小さく

### 3D側にお願いしたいこと

1. パッチを当てる（ほかの家を足すときも `HOUSES` にソケットを書く）
2. つくるモードで家をタップ → ソケットが光る → 手持ちの `ownedOfKind('part')` のうち slot が合うものを選ぶ →「{t:'parts', id, socket, part}」のような操作で付けかえ（元に戻すは前の値方式）
3. 重ねて置く（フミオさん希望）: 石垣など上が平らなものに「乗れる面」を持たせ、その上に引いた柵・置いたおきものはその高さに乗せる。まず「石垣の上に てつの柵」「石垣の上に おきもの」から

## あとから

- **なかまキャラ**: `js/data/gacha.js` に `kind: 'chara'` の行を足すとガチャから出ます。3D側は `js/characters.js` にモデルを足して、`ownedCharas(p)` の子を街に出してください。
