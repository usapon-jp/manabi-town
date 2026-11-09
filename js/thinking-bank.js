// 問題は端末上で生成。解集合から正解と解説を作り、通信はしない。
export const BOOK_ID = 'tea-v1';
export const STAGES = 36;
export const CHAPTERS = [
  { title:'森のお茶会', sub:'手がかりを、ひとつずつ。', scene:'forest', intro:'森のおくから、お茶会の招待状が届いたよ。\nピヨちゃんとお茶会の準備をしよう。', end:'テーブルの準備ができた！\n次は、湖の向こうへ招待状を届けよう。' },
  { title:'湖をわたる手紙', sub:'つながりを、見つけよう。', scene:'lake', intro:'招待状を持って、湖の向こうへ。\n手紙を読んで、わかったことを整理しよう。', end:'招待状がみんなに届いたよ。\n星が出たら、丘でお茶会がはじまるよ。' },
  { title:'星あかりの約束', sub:'ほんとうに、そう言える？', scene:'stars', intro:'もうすぐ、星あかりのお茶会。\nいくつもの条件を合わせて考えよう。', end:'みんなが集まって、お茶会がはじまったよ。\n36の足あとが、きみの絵本になったね。' },
];
export function randomFor(seed) {
  let n=2166136261;
  for (const c of String(seed)) n=Math.imul(n^c.charCodeAt(0),16777619);
  return () => { n|=0; n=n+0x6D2B79F5|0; let t=Math.imul(n^n>>>15,1|n); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
}
export function shuffle(xs, rand) {
  const out=xs.slice();
  for(let i=out.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
  return out;
}
export const permutations = xs => xs.length ? xs.flatMap((x,i)=>permutations(xs.filter((_,j)=>j!==i)).map(p=>[x,...p])) : [[]];
const NAMES=['モモ','ソラ','ルル','ココ','ナナ'];
function packed(q, choices, correct, rand) {
  const mixed=shuffle(choices,rand);
  return {...q,choices:mixed,answer:mixed.indexOf(correct)};
}
function ordering(tier, rand) {
  const names=shuffle(NAMES,rand).slice(0,tier+2), secret=shuffle(names,rand);
  const constraints=shuffle(secret.slice(1).map((n,i)=>[secret[i],n]),rand);
  const candidates=permutations(names).filter(p=>constraints.every(([a,b])=>p.indexOf(a)<p.indexOf(b)));
  const position=Math.floor(rand()*names.length), correct=candidates[0][position];
  return packed({type:'order',skill:'順番を整理する',title:'お茶会のならび順',
    text:`${names.join('・')}の${names.length}人が、前から順に1列にならびます。\n${constraints.map(([a,b])=>`・${a}は${b}より前です。`).join('\n')}\n前から${position+1}番目は、だれでしょう？`,
    hints:['名前を紙に書いて、前と後ろを矢印でつないでみよう。',`${secret[0]}から始まるよ。すべての「より前」を満たすようにならべよう。`],
    explain:`すべての手がかりを合わせると、前から「${secret.join(' → ')}」の順だけが残るよ。${position+1}番目は${correct}。`,
    diagram:secret, audit:{names,constraints,position,solutions:candidates}},names,correct,rand);
}
function matching(tier,rand) {
  const names=shuffle(NAMES,rand).slice(0,tier===3?4:3);
  const foods=shuffle(['りんご','クッキー','ケーキ','いちご'],rand).slice(0,names.length), secret=shuffle(foods,rand);
  const all=permutations(foods); let solutions=all;
  const pool=shuffle(names.flatMap((_,i)=>foods.filter(f=>f!==secret[i]).map(f=>({i,f}))),rand), clues=[];
  while(solutions.length>1){
    const clue=pool.map(c=>({...c,left:solutions.filter(p=>p[c.i]!==c.f)})).sort((a,b)=>a.left.length-b.left.length)[0];
    clues.push({i:clue.i,f:clue.f}); solutions=clue.left;
    pool.splice(pool.findIndex(c=>c.i===clue.i&&c.f===clue.f),1);
  }
  const target=Math.floor(rand()*names.length), correct=secret[target];
  return packed({type:'match',skill:'候補をしぼる',title:'だれのおやつ？',
    text:`${names.join('・')}が、${foods.join('・')}を1つずつ持っています。同じおやつを持つ人はいません。\n${clues.map(c=>`・${names[c.i]}は${c.f}を持っていません。`).join('\n')}\n${names[target]}のおやつは？`,
    hints:['人とおやつの表を作って、「ちがう」とわかる組み合わせに×をつけよう。','ひとり1つ、同じおやつはなし。ある人のおやつが決まったら、ほかの人の候補から消せるよ。'],
    explain:`条件に合う組み合わせは1通り。${names.map((n,i)=>`${n}は${secret[i]}`).join('、')}。だから${names[target]}は${correct}だね。`,
    diagram:names.map((n,i)=>`${n}：${secret[i]}`),audit:{names,foods,clues,target,solutions}},foods,correct,rand);
}
function missing(tier,rand) {
  const names=shuffle(NAMES,rand).slice(0,tier+2), enough=rand()<.5;
  const constraints=enough?names.slice(1).map((n,i)=>[names[i],n]):[[names[0],names[1]]];
  if(!enough&&tier===3)constraints.push([names[1],names[2]]);
  const solutions=permutations(names).filter(p=>constraints.every(([a,b])=>p.indexOf(a)<p.indexOf(b)));
  const targets=[...new Set(solutions.map(p=>p[0]))];
  const examples=[solutions[0].join(' → ')];
  if(!enough)examples.push(solutions.find(p=>p[0]!==solutions[0][0]).join(' → '));
  const correct=enough?`${names[0]}に決まる`:'まだ決められない';
  return packed({type:'missing',skill:'情報の十分・不足を見分ける',title:'手紙だけでわかる？',
    text:`${names.join('・')}が、前から順に1列にならびます。手紙に書かれている手がかりは、これだけです。\n${constraints.map(([a,b])=>`・${a}は${b}より前です。`).join('\n')}\n先頭の人について、この手紙だけで言えることは？`,
    hints:['書かれていない順番を、想像で決めていないかな？','条件に合うならび方を作ろう。先頭がちがう、別のならび方も作れるかな？'],
    explain:enough?`条件をすべて合わせると「${examples[0]}」の1通り。先頭は${names[0]}に決まるね。`:`「${examples.join('」も「')}」も条件に合うよ。先頭は${targets.join('・')}の可能性があるので、まだ決められないね。`,
    diagram:examples,audit:{names,constraints,solutions}},[`${names[0]}に決まる`,`${names.at(-1)}に決まる`,'まだ決められない'],correct,rand);
}
function conditional(tier,rand) {
  const who=shuffle(NAMES,rand)[0];
  const cases=[
    {text:`お茶会では「赤い招待状を持つ人は、リボンをもらえる」という決まりです。${who}は赤い招待状を持っています。${who}について必ず言えることは？`, choices:['リボンをもらえる','リボンをもらえない','決まりだけではわからない'],correct:'リボンをもらえる', explain:'赤い招待状がある → リボンをもらえる、という決まりにそのまま当てはまるね。'},
    {text:`お茶会では「赤い招待状を持つ人は、リボンをもらえる」という決まりです。赤い招待状がない人についての決まりはありません。${who}はリボンをもらいました。赤い招待状を持っていたと、必ず言えますか？`,choices:['必ず持っていた','絶対に持っていない','どちらの可能性もある'],correct:'どちらの可能性もある',explain:'赤い招待状があればリボンをもらえる。でも、招待状がない人がリボンをもらうことも禁止されていないね。「もらえた」だけでは招待状の色は決まらないよ。'},
    {text:`「金色の切符を持つ人は、必ず橋をわたれます」「橋をわたれる人は、必ず丘へ行けます」という決まりです。${who}は丘へ行けません。金色の切符を持っていますか？`,choices:['必ず持っている','持っていない','どちらの可能性もある'],correct:'持っていない',explain:'金色の切符があるなら、橋をわたり、必ず丘へ行けるはずだね。丘へ行けないという事実に合わないので、金色の切符は持っていないよ。'},
  ];
  const c=cases[tier-1];
  return packed({type:'condition',skill:'条件の向きを読む',title:'招待状のきまり',text:c.text,
    hints:['「もし〜なら、〜」の、出発点と行き先を見つけよう。','矢印を逆にしてもよいとは限らないよ。決まりと事実の両方に合う場合を考えよう。'],explain:c.explain,
    diagram:tier===3?['金の切符 → 橋 → 丘','丘へ行けない → 金の切符はない']:['赤い招待状 → リボン','リボン → 赤い招待状？'],audit:{tier}},c.choices,c.correct,rand);
}
function truth(tier,rand) {
  const colors=shuffle(['赤','青','黄','緑'],rand).slice(0,tier===3?4:3);
  const secret=Math.floor(rand()*colors.length);
  // One true statement, with each statement a predicate over the single hidden box.
  const predicates=[];
  for(let i=0;i<colors.length;i++)for(let k=0;k<colors.length;k++)for(const eq of [true,false])predicates.push({speaker:i,k,eq});
  let statements,solutions;
  for(let tries=0;tries<400;tries++){
    statements=colors.map((_,i)=>shuffle(predicates.filter(p=>p.speaker===i),rand)[0]);
    solutions=colors.map((_,i)=>i).filter(candidate=>statements.filter(s=>(candidate===s.k)===s.eq).length===1);
    if(solutions.length===1&&solutions[0]===secret)break;
  }
  if(solutions.length!==1||solutions[0]!==secret){
    // 星の箱を述べる肯定札1枚と、同じ箱を否定する札。星の箱だけ真が1枚になる。
    statements=colors.map((_,i)=>({speaker:i,k:secret,eq:i===0}));
    solutions=colors.map((_,i)=>i).filter(candidate=>statements.filter(s=>(candidate===s.k)===s.eq).length===1);
  }
  const result=solutions[0];
  const rows=colors.map((c,i)=>`${c}：${statements.filter(s=>(i===s.k)===s.eq).length}枚が本当`);
  return packed({type:'truth',skill:'仮に決めて、確かめる',title:'ひとつだけ本当の札',
    text:`${colors.join('・')}の箱があります。星のカードが入っている箱は1つだけ。箱の札のうち、本当のことが書かれているのは、ちょうど1枚です。\n${statements.map(s=>`・${colors[s.speaker]}の箱の札「星は${colors[s.k]}の箱に${s.eq?'ある':'ない'}」`).join('\n')}\n星が入っているのは、どの箱？`,
    hints:['札の色と、札に書かれた箱の色を分けて読もう。','星の場所を1つずつ仮に決めて、本当になる札を数えてみよう。1枚だけになる場所を探すよ。'],
    explain:`星の場所ごとに札を確かめると、${rows.join('、')}。本当の札がちょうど1枚になるのは${colors[result]}の箱だけだよ。`,diagram:rows,
    audit:{colors,statements,solutions}},colors.map(c=>`${c}の箱`),`${colors[result]}の箱`,rand);
}
function routes(tier,rand) {
  const capacity=tier+3, chosen=Math.floor(rand()*3), labels=['森の道','湖の道','丘の道'];
  const rows=shuffle(labels,rand).map((name,i)=>({name,time:capacity+(i===chosen?-1:i===((chosen+1)%3)?-2:2),bridge:i===chosen||i===(chosen+2)%3}));
  const correct=rows[chosen].name;
  return packed({type:'plan',skill:'条件を全部たしかめる',title:'お茶会への道',
    text:`お茶会には${capacity}分以内に着きたい。荷車を運ぶので、橋のある道を選びます。\n${rows.map(r=>`・${r.name}：${r.time}分、橋${r.bridge?'あり':'なし'}`).join('\n')}\n両方の条件を満たす道は？`,
    hints:['時間だけ、橋だけで決めずに、両方を確かめよう。',`${capacity}分をこえる道と、橋のない道を候補から外してみよう。`],
    explain:`${rows.map(r=>`${r.name}は${r.time>capacity?'時間が長すぎる':!r.bridge?'橋がない':'時間内で橋もある'}`).join('。')}。だから${correct}を選べるね。`,
    diagram:rows.map(r=>`${r.name}：${r.time<=capacity&&r.bridge?'両方OK':r.time>capacity?'時間 ×':'橋 ×'}`),audit:{rows,capacity}},rows.map(r=>r.name),correct,rand);
}
const makers=[ordering,matching,routes,missing,conditional,truth];
export function makeQuestion(stage, level=1, seed='story') {
  const safe=Math.max(0,Math.min(STAGES-1,Math.floor(stage)));
  const tier=Math.min(3,Math.max(1,Number(level)||1)+Math.floor(safe/12));
  const rand=randomFor(`${BOOK_ID}:${safe}:${tier}:${seed}`);
  const q=makers[safe%makers.length](tier,rand);
  if(q.answer<0||q.answer>=q.choices.length)throw new Error('Invalid thinking question');
  return {...q,id:`${BOOK_ID}-${safe}`,stage:safe,tier};
}
