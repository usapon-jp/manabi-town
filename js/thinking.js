// ピヨちゃんの考える教室: オリジナルの読解・論理問題。初期版は検証済みの固定問題のみ。
import { h } from './ui.js';

export const THINKING_QUESTIONS = [
  { id:'logic-snacks', kind:'ろんり', title:'3びきのおやつ', text:'うさぎ・ねこ・きつねは、りんご・クッキー・ケーキを1つずつ、ちがうものを選びました。ねこはケーキ。うさぎはりんごではありません。きつねはクッキーではありません。うさぎのおやつは？', choices:['りんご','クッキー','ケーキ'], answer:1, hint:'ねこのおやつを決めたら、きつねが選べるものを考えてみよう。', explain:'ねこはケーキ。きつねはクッキーでもケーキでもないので、りんご。残ったクッキーがうさぎのおやつだよ。' },
  { id:'reading-rain', kind:'どっかい', title:'雨の日のおでかけ', text:'朝は雨でした。ゆいは赤いかさを持って出かけました。昼には雨がやみましたが、かさは学校に置いたままにしました。ゆいが帰るとき、かさはどこにありますか？', choices:['家','学校','公園'], answer:1, hint:'「置いたまま」という言葉に注目しよう。', explain:'かさは学校に置いたままと書いてあるから、学校にあるね。' },
  { id:'logic-order', kind:'ろんり', title:'ならんだ順番', text:'ピヨ・モモ・ソラが一列に並びます。ピヨはモモより前、ソラはモモより後ろです。真ん中にいるのはだれ？', choices:['ピヨ','モモ','ソラ'], answer:1, hint:'「前」「後ろ」を順番に並べてみよう。', explain:'ピヨ → モモ → ソラの順番だから、真ん中はモモだよ。' },
  { id:'reading-letter', kind:'どっかい', title:'お手紙の約束', text:'「土曜日に図書館へ行こう。雨なら日曜日にしよう」と手紙にありました。土曜日は雨、日曜日は晴れでした。約束どおりなら、図書館に行くのはいつ？', choices:['土曜日','日曜日','月曜日'], answer:1, hint:'雨だったときの約束を探してみよう。', explain:'土曜日は雨だったので、手紙にある「雨なら日曜日」の約束を使うよ。' },
  { id:'logic-boxes', kind:'ろんり', title:'3つの箱', text:'赤・青・黄の箱に、星・月・花のカードが1枚ずつ入っています。赤には星、青には花が入っています。黄の箱には何が入っていますか？', choices:['星','月','花'], answer:1, hint:'すでに使われたカードを消してみよう。', explain:'星は赤、花は青に入っているので、残る月が黄の箱に入るよ。' },
  { id:'reading-library', kind:'どっかい', title:'本を返す日', text:'図書館の案内には「火曜日はお休み。月曜日と水曜日は午前9時から午後5時まで、本を返せます」と書いてあります。水曜日の午後4時に本を返しに行けますか？', choices:['行ける','行けない','案内だけではわからない'], answer:0, hint:'水曜日に本を返せる時間を探して、午後4時がその中に入るか考えよう。', explain:'水曜日は午前9時から午後5時まで本を返せるね。午後4時はその間だから、返しに行けるよ。' },
];

// 比較関数で乱数を返す sort は順番が偏る。元の問題は変えずに混ぜる。
function shuffled(items, rand) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createThinkingSession(rand = Math.random) {
  return shuffled(THINKING_QUESTIONS, rand).slice(0, 3).map(q => {
    const order = shuffled(q.choices.map((_, i) => i), rand);
    return { ...q, choices: order.map(i => q.choices[i]), answer: order.indexOf(q.answer) };
  });
}

export function openThinkingClassroom() {
  document.querySelector('.thinking-overlay')?.remove();
  const previousFocus = document.activeElement;
  let index=0, correct=0, answered=false;
  const session=createThinkingSession();
  const close = () => { overlay.remove(); if (previousFocus?.isConnected) previousFocus.focus(); };
  const overlay=h('div',{class:'sheet thinking-overlay',onclick:e=>{if(e.target===overlay) close();}});
  const card=h('div',{class:'sheet-card'});
  overlay.append(card);
  document.body.append(overlay);
  function resetPosition() {
    card.scrollTop = 0;
    card.querySelector('.sheet-title').focus({ preventScroll: true });
  }
  function paint(){
    if(index>=session.length){
      card.replaceChildren(
        h('h2',{class:'sheet-title',tabindex:'-1'},'ピヨちゃんの考える教室'),
        h('img',{src:'assets/brain/piyo.webp',alt:'',width:70}),
        h('p',{class:'reward'},'よく考えたね！'),
        h('p',{},`3もん中 ${correct}もん せいかい`),
        h('p',{},'まちがえた問題も、考え方がわかれば大成功！'),
        h('button',{class:'btn primary',onclick:close},'おわる')
      );resetPosition();return;
    }
    const q=session[index];answered=false;
    const options=h('div',{class:'thinking-choices'},q.choices.map((choice,i)=>h('button',{type:'button',class:'btn thinking-choice',onclick:()=>{
      if(answered)return;
      answered=true;
      if(i===q.answer)correct++;
      options.querySelectorAll('button').forEach((b,j)=>{b.disabled=true;if(j===q.answer)b.classList.add('thinking-right');if(j===i&&j!==q.answer)b.classList.add('thinking-wrong');});
      feedback.replaceChildren(h('p',{class:'feedback '+(i===q.answer?'ok':'ng')},i===q.answer?'せいかい！':'おしい！ いっしょに考えよう'),h('p',{},q.explain),h('button',{class:'btn primary',onclick:()=>{index++;paint();}},index===session.length-1?'けっかへ':'つぎの問題'));
      feedback.scrollIntoView({ block:'nearest' });
    }},choice)));
    const hint=h('p',{hidden:true},q.hint);
    const feedback=h('div',{class:'thinking-feedback','aria-live':'polite'});
    card.replaceChildren(
      h('h2',{class:'sheet-title',tabindex:'-1'},'ピヨちゃんの考える教室'),
      h('p',{class:'sheet-sub'},`${index+1} / 3　・　${q.kind}`),
      h('p',{class:'reward'},q.title),
      h('p',{class:'thinking-prompt'},q.text),
      options,
      h('button',{class:'link',onclick:()=>{hint.hidden=false;}},'ヒントをみる'),
      hint,feedback,
      h('button',{class:'link',onclick:close},'とじる')
    );
    resetPosition();
  }
  paint();
}
