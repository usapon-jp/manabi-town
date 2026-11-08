// ピヨちゃんの考える教室 — 絵本のすごろく。ポイントや既存の塔には干渉しない。
import { h, toast } from './ui.js';
import { icon } from './icons.js';
import { currentProfile, getState, save, today } from './store.js';
import { CHAPTERS, STAGES, makeQuestion } from './thinking-bank.js';
import { readBook, nextStage, dayCount, recordAnswer } from './thinking-progress.js';
import { sceneSvg, STOPS } from './thinking-art.js';

export function openThinkingClassroom(profile = currentProfile()) {
  if (!profile) { toast('先に使う人を選んでね'); return; }
  if (document.querySelector('.thinking-overlay')) return;
  if(profile.thinkingBook?.version&&profile.thinkingBook.version!==1){toast('記録の新しい版に対応したアプリで開いてね');return;}
  const profileId=profile.id, previousFocus=document.activeElement;
  const siblings=Array.from(document.body.children).map(el=>({el,inert:el.inert}));
  siblings.forEach(({el})=>{if(el.id!=='toast')el.inert=true;});
  const overlay=h('div',{class:'sheet thinking-overlay sb-overlay',role:'dialog','aria-modal':'true','aria-label':'ピヨちゃんの考える教室'});
  const view=h('div',{class:'sb-view'});
  const close=()=>{
    overlay.remove();
    siblings.forEach(({el,inert})=>{if(el.isConnected)el.inert=inert;});
    if(previousFocus?.isConnected)previousFocus.focus();
    else document.querySelector('.puzzle-btn')?.focus();
    window.removeEventListener('manabi-synced',onSync);
  };
  const top=h('header',{class:'sb-top'},
    h('div',{class:'sb-brand'},icon('book-open'),h('span',{},'ピヨちゃんの考える教室')),
    h('button',{type:'button',class:'sb-icon','aria-label':'教室をとじる',onclick:close},icon('x')));
  overlay.append(h('div',{class:'sb-window'},top,view));
  document.body.append(overlay);
  let page=Math.min(2,Math.floor(nextStage(readBook(profile))/12)), practiceSerial=0;
  let questionOpen=false, shownPage=-1;
  const live=()=>getState().profiles.find(p=>p.id===profileId);
  const valid=()=>{if(currentProfile()?.id!==profileId||!live()){toast('使う人が変わったので、もう一度教室をひらいてね');close();return false;}return true;};
  function commit(book) {
    if(!valid())return false;
    const p=live();
    if(p.thinkingBook?.version&&p.thinkingBook.version!==1){toast('記録の新しい版に対応したアプリで開いてね');return false;}
    const prior=p.thinkingBook;p.thinkingBook=book;
    if(save())return true;
    if(prior===undefined)delete p.thinkingBook;else p.thinkingBook=prior;
    toast('記録を保存できなかったよ。画面を閉じずに、もう一度ためしてね',5000);return false;
  }
  function resetFocus() {
    view.scrollTop=0;view.querySelector('h1,h2')?.focus({preventScroll:true});
  }
  function onSync(){if(!valid())return;if(!questionOpen)drawMap();}
  window.addEventListener('manabi-synced',onSync);
  overlay.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();close();return;}
    if(e.key!=='Tab')return;
    const all=Array.from(overlay.querySelectorAll('button,a[href],select,summary,[tabindex="0"]')).filter(el=>!el.disabled&&el.getClientRects().length);
    const first=all[0],last=all.at(-1);
    if(e.shiftKey&&(document.activeElement===first||!all.includes(document.activeElement))){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  });
  const heading=(tag,text)=>h(tag,{tabindex:'-1'},text);
  function drawMap(fromStage=null) {
    if(!valid())return;
    questionOpen=false;
    const p=live(),book=readBook(p),next=nextStage(book),chapter=CHAPTERS[page],start=page*12;
    const cleared=book.stamps.filter(s=>s.stage>=start&&s.stage<start+12).length;
    const maxPage=Math.min(2,Math.floor(next/12));page=Math.min(page,maxPage);
    const daily=dayCount(book,today());
    const turning=shownPage!==page;shownPage=page;
    const illustration=h('div',{class:`sb-book sb-${chapter.scene}${turning?' sb-page-in':''}`},
      h('div',{class:'sb-picture',html:sceneSvg(chapter.scene,cleared)}));
    const map=h('div',{class:'sb-stops','aria-label':`第${page+1}章の道`});
    STOPS.forEach((pos,i)=>{
      const stage=start+i,stamp=book.stamps.find(s=>s.stage===stage),locked=stage>next;
      map.append(h('button',{type:'button',class:`sb-stop${stamp?' done':''}${stage===next?' current':''}`,style:`left:${pos.x}%;top:${pos.y}%`,disabled:locked,
        'aria-label':`${stage+1}マス目${stamp?'：ふりかえり':locked?'：これから':'：ここから考える'}`,
        onclick:()=>stamp?review(stamp):play(stage)},stamp?icon('check'):String(stage+1)));
    });
    const at=Math.max(0,Math.min(11,next-start)),pos=STOPS[at];
    const marker=h('div',{class:'sb-marker',style:`left:${pos.x}%;top:${pos.y}%`,'aria-hidden':'true'},
      h('img',{src:'assets/brain/piyo.webp',alt:'',width:62,height:84}));
    map.append(marker);illustration.append(map,h('i',{class:'sb-spine','aria-hidden':'true'}));
    const level=book.stamps.length||p.thinkingBook?book.level:/^(j[123]|adult)$/.test(p.grade)?2:1;
    const chooseLevel=h('select',{'aria-label':'問題のむずかしさ',onchange:e=>{
      const latest=readBook(live());if(commit({...latest,level:Number(e.target.value)}))drawMap();
    }},h('option',{value:1,selected:level===1},'やさしく始める'),h('option',{value:2,selected:level===2},'手ごたえから始める'));
    const unlockedNext=next<STAGES&&Math.floor(next/12)===page;
    const advance=()=>{
      if(!book.introduced){intro(level);return;}
      if(unlockedNext)play(next);else if(next>=start+12&&page<2){page++;drawMap();}else practice();
    };
    const caption=cleared===12?chapter.end:chapter.intro;
    view.replaceChildren(h('section',{class:'sb-home'},
      h('div',{class:'sb-chapter-nav'},
        h('button',{type:'button',class:'sb-icon',disabled:page===0,'aria-label':'前のページ',onclick:()=>{page--;drawMap();}},icon('chevron-left')),
        h('div',{},h('p',{class:'sb-eyebrow'},`PIYO'S LITTLE THINKING BOOK　／　${page+1}・3`),heading('h1',chapter.title),h('p',{class:'sb-sub'},chapter.sub)),
        h('button',{type:'button',class:'sb-icon',disabled:page===2||page>=maxPage,'aria-label':'次のページ',onclick:()=>{page++;drawMap();}},icon('chevron-right'))),
      illustration,
      h('div',{class:'sb-side'},h('div',{class:'sb-story'},h('span',{class:'sb-leaf','aria-hidden':'true'},icon('sprout')),h('p',{},caption)),
      h('div',{class:'sb-bottom'},
        h('div',{class:'sb-trail'},h('span',{},`きみの足あと　${next} / ${STAGES}`),h('span',{class:'sb-daily'},daily>=3?`今日の3問、できたね！${daily>3?`（${daily}問）`:''}`:`今日の目安　${daily} / 3問`)),
        h('div',{class:'sb-actions'},h('button',{type:'button',class:'btn primary sb-go',onclick:advance},!book.introduced?'絵本をひらく':unlockedNext?(daily>=3?'もう少し進む':'つづきから考える'):next>=start+12&&page<2?'次のページへ':'新しい手がかりで練習'),
          h('button',{type:'button',class:'sb-text-button',onclick:()=>journal()},icon('book-open'),' 足あとを見る')),
        h('div',{class:'sb-preferences'},chooseLevel,h('span',{},'時間制限なし・ポイントなし'),h('button',{type:'button',class:'sb-text-button',onclick:()=>intro(level)},'あそび方'))))));
    resetFocus();
    if(fromStage!==null&&Math.floor(fromStage/12)===page&&next<start+12&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
      const old=STOPS[fromStage%12];
      marker.animate?.([{left:`${old.x}%`,top:`${old.y}%`},{left:`${pos.x}%`,top:`${pos.y}%`}],{duration:850,easing:'ease-in-out'});
    }
  }
  function intro(level) {
    questionOpen=true;
    view.replaceChildren(h('section',{class:'sb-reading sb-welcome'},
      h('img',{class:'sb-welcome-piyo',src:'assets/brain/piyo.webp',alt:'ピヨちゃん',width:82,height:112}),
      h('p',{class:'sb-eyebrow'},'ちいさな一歩が、絵本になる。'),heading('h2','考える道を、いっしょに。'),
      h('p',{},'1問考えて、答え合わせ。考え方がわかったら、ピヨちゃんが1マス進むよ。'),
      h('ol',{class:'sb-instructions'},h('li',{},'まずは自分で。困ったら2段階のヒント。'),h('li',{},'まちがえても大丈夫。解説を読んで進めるよ。'),h('li',{},'1日3問が目安。休んでも足あとは消えないよ。'),h('li',{},'通ったマスを押すと、考えた問題を読み返せるよ。')),
      h('button',{type:'button',class:'btn primary sb-go',onclick:()=>{if(commit({...readBook(live()),introduced:true,level}))drawMap();}},'さあ、絵本の中へ'),
      h('button',{type:'button',class:'sb-text-button',onclick:()=>drawMap()},'絵本にもどる'),
      h('a',{class:'sb-text-button',href:'docs/thinking-classroom.html',target:'_blank',rel:'noopener'},'あそび方を別のページで読む')));resetFocus();
  }
  function practice(){
    const n=(practiceSerial++ + new Date().getDate())%12;
    play(page*12+n,true);
  }
  function play(stage,training=false,replay=null) {
    if(!valid())return;
    const p=live(),book=readBook(p);
    if(!training&&stage!==nextStage(book)){drawMap();return;}
    if(!book.introduced){intro(book.level);return;}
    questionOpen=true;
    const level=p.thinkingBook?book.level:/^(j[123]|adult)$/.test(p.grade)?2:1;
    const q=replay||makeQuestion(stage,level,training?`${profileId}:${today()}:${Date.now()}:${practiceSerial++}`:profileId);
    let answer=-1,hints=0,busy=false;
    const attemptId=`practice-${globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    const choices=h('div',{class:'thinking-choices sb-choices'});
    const help=h('div',{class:'sb-hints','aria-live':'polite'});
    const feedback=h('div',{class:'sb-feedback','aria-live':'polite'});
    const hintButton=h('button',{type:'button',class:'sb-text-button sb-hint-button',onclick:()=>{
      if(hints>=q.hints.length)return;
      help.append(h('p',{},`ヒント${hints+1}　${q.hints[hints++]}`));
      hintButton.textContent=hints>=q.hints.length?'ヒントを全部見たよ':'もうひとつヒント';hintButton.disabled=hints>=q.hints.length;
      help.scrollIntoView({block:'nearest'});
    }},icon('lightbulb'),' ヒントをみる');
    q.choices.forEach((choice,i)=>choices.append(h('button',{type:'button',class:'btn thinking-choice',onclick:()=>{
      if(answer!==-1)return;answer=i;hintButton.disabled=true;
      choices.querySelectorAll('button').forEach((b,j)=>{b.disabled=true;if(j===q.answer)b.classList.add('thinking-right');if(j===i&&j!==q.answer)b.classList.add('thinking-wrong');});
      const proceed=h('button',{type:'button',class:'btn primary sb-go',onclick:()=>{
        if(busy||!valid())return;busy=true;proceed.disabled=true;
        const latest=readBook(live());
        if(!training&&stage!==nextStage(latest)){toast('ほかの画面でも進んだので、今の足あとを表示するね');drawMap();return;}
        const next=recordAnswer(latest,q,{choice:answer,hints,day:today(),at:Date.now(),id:attemptId,practice:training});
        if(commit(next)){page=Math.floor(stage/12);drawMap(training?null:stage);}else{busy=false;proceed.disabled=false;proceed.textContent='もう一度、記録して進む';}
      }},training?'考え方を記録する':'わかった、1マス進む');
      feedback.replaceChildren(h('p',{class:`sb-verdict ${i===q.answer?'ok':'ng'}`},i===q.answer?'そう、その考え方！':'ここが、考えるチャンス。'),
        h('p',{class:'sb-answer'},`答え：${q.choices[q.answer]}`),h('p',{},q.explain),diagram(q),
        h('p',{class:'sb-small'},'考え方を読んで、納得できたら進もう。'),proceed);
      feedback.scrollIntoView({block:'start'});proceed.focus({preventScroll:true});
    }},h('span',{class:'sb-choice-letter','aria-hidden':'true'},String.fromCharCode(65+i)),h('span',{},choice))));
    view.replaceChildren(h('section',{class:'sb-reading'},
      h('button',{type:'button',class:'sb-text-button sb-back',onclick:()=>drawMap()},icon('chevron-left'),' 絵本にもどる'),
      h('div',{class:'sb-question-meta'},h('span',{},training?'よりみち練習':`${stage+1} / ${STAGES}マス`),h('span',{},['','たね','つぼみ','花'][q.tier])),
      h('p',{class:'sb-eyebrow'},q.skill),heading('h2',q.title),h('p',{class:'thinking-prompt sb-prompt'},q.text),choices,hintButton,help,feedback));resetFocus();
  }
  function diagram(q){return h('div',{class:`sb-reasoning sb-reasoning-${q.type}`,'aria-label':'考え方の整理'},q.diagram.map((text,i)=>h('span',{},q.type==='order'&&i?'→ ':null,text)));}
  function review(stamp) {
    const q=stamp.question;if(!q?.choices||!Array.isArray(q.diagram)){toast('この記録には問題の本文がありません');return;}
    questionOpen=true;
    view.replaceChildren(h('section',{class:'sb-reading'},h('button',{type:'button',class:'sb-text-button sb-back',onclick:()=>drawMap()},icon('chevron-left'),' 絵本にもどる'),
      h('p',{class:'sb-eyebrow'},`${stamp.stage+1}マス目の足あと　・　${stamp.day}`),heading('h2',q.title),h('p',{class:'thinking-prompt sb-prompt'},q.text),
      h('p',{class:'sb-answer'},`答え：${q.choices[q.answer]}`),h('p',{},q.explain),diagram(q),
      h('p',{class:'sb-small'},`${stamp.firstCorrect?'最初の答えで正解':'解説で考え方を確認'}　・　ヒント ${stamp.hints}こ`),
      h('button',{type:'button',class:'btn primary sb-go',onclick:()=>play(stamp.stage,true,q)},'同じ問題を、もう一度考える')));resetFocus();
  }
  function journal() {
    const book=readBook(live()),counts={};book.stamps.forEach(s=>{const k=s.question?.skill||'考える';counts[k]=(counts[k]||0)+1;});
    questionOpen=true;
    view.replaceChildren(h('section',{class:'sb-reading'},h('button',{type:'button',class:'sb-text-button sb-back',onclick:()=>drawMap()},icon('chevron-left'),' 絵本にもどる'),
      h('p',{class:'sb-eyebrow'},'MY LITTLE FOOTPRINTS'),heading('h2','ここまで考えてきたね。'),
      h('p',{class:'sb-journal-total'},`${nextStage(book)}`,h('small',{},` / ${STAGES}マス`)),
      h('p',{},'正解も、考え直した日も。きみが考えた足あと。'),
      h('p',{class:'sb-days'},`考えてきた日　${Object.keys(book.days).length}日`),
      h('div',{class:'sb-skill-list'},Object.entries(counts).map(([skill,n])=>h('span',{},skill,h('b',{},`${n}問`)))),
      !book.stamps.length?h('p',{},'最初の1マスから、絵本が始まるよ。'):null,
      h('div',{class:'sb-history'},book.stamps.slice().sort((a,b)=>b.stage-a.stage).map(s=>h('button',{type:'button',class:'sb-history-row',onclick:()=>review(s)},h('span',{},`${s.stage+1}　${s.question?.title||'考える問題'}`),h('small',{},s.day),icon('chevron-right')))),
      h('p',{class:'sb-small'},`よりみち練習の記録　${book.practice.length}回（最近120回まで）`)));resetFocus();
  }
  drawMap();
}
