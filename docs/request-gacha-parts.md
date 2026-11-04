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

## あとから

- **なかまキャラ**: `js/data/gacha.js` に `kind: 'chara'` の行を足すとガチャから出ます。3D側は `js/characters.js` にモデルを足して、`ownedCharas(p)` の子を街に出してください。
