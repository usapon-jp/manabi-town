// node --experimental-default-type=module tools/thinking-checks.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {makeQuestion,STAGES,permutations,randomFor} from '../js/thinking-bank.js';
import {readBook,nextStage,recordAnswer,dayCount} from '../js/thinking-progress.js';
import {mergeProfile} from '../js/merge.js';

let total=0;const positions=new Map();
for(let level=1;level<=2;level++)for(let seed=0;seed<40;seed++)for(let stage=0;stage<STAGES;stage++){
 const q=makeQuestion(stage,level,`test-${seed}`),answer=q.choices[q.answer],a=q.audit;
 assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.choices.length);
 assert.equal(new Set(q.choices).size,q.choices.length);assert.equal(q.hints.length,2);
 assert.ok(q.explain&&q.diagram.length);assert.ok(!q.text.includes('undefined'));
 const key=`${q.type}-${q.tier}`;if(!positions.has(key))positions.set(key,new Set());positions.get(key).add(q.answer);
 if(q.type==='order'||q.type==='missing'){
  const solutions=permutations(a.names).filter(p=>a.constraints.every(([x,y])=>p.indexOf(x)<p.indexOf(y)));
  if(q.type==='order'){assert.equal(solutions.length,1);assert.equal(answer,solutions[0][a.position]);}
  else{const first=new Set(solutions.map(p=>p[0]));assert.equal(answer,first.size===1?`${[...first][0]}に決まる`:'まだ決められない');}
 }else if(q.type==='match'){
  const solutions=permutations(a.foods).filter(p=>a.clues.every(c=>p[c.i]!==c.f));assert.equal(solutions.length,1);assert.equal(answer,solutions[0][a.target]);
 }else if(q.type==='truth'){
  const solutions=a.colors.map((_,i)=>i).filter(i=>a.statements.filter(s=>(i===s.k)===s.eq).length===1);
  assert.equal(solutions.length,1);assert.equal(answer,`${a.colors[solutions[0]]}の箱`);
 }else if(q.type==='plan'){
  const solutions=a.rows.filter(r=>r.time<=a.capacity&&r.bridge);assert.equal(solutions.length,1);assert.equal(answer,solutions[0].name);
 }else{
  // Truth tables: P=>Q, positive P; affirming Q; contraposition through P=>Q=>R.
  const worlds=[];for(const p of [false,true])for(const qv of [false,true])for(const r of [false,true])worlds.push({p,q:qv,r});
  if(q.tier===1){const w=worlds.filter(w=>(!w.p||w.q)&&w.p);assert.ok(w.every(w=>w.q));assert.equal(answer,'リボンをもらえる');}
  if(q.tier===2){const w=worlds.filter(w=>(!w.p||w.q)&&w.q);assert.equal(new Set(w.map(w=>w.p)).size,2);assert.equal(answer,'どちらの可能性もある');}
  if(q.tier===3){const w=worlds.filter(w=>(!w.p||w.q)&&(!w.q||w.r)&&!w.r);assert.ok(w.every(w=>!w.p));assert.equal(answer,'持っていない');}
 }
 assert.deepEqual(makeQuestion(stage,level,`test-${seed}`),q);total++;
}
for(const seen of positions.values())assert.ok(seen.size>=3);
assert.equal(makeQuestion(0,1).tier,1);assert.equal(makeQuestion(12,1).tier,2);assert.equal(makeQuestion(24,1).tier,3);
assert.equal(readBook({grade:'adult'}).level,2);assert.equal(readBook({grade:'j2'}).level,2);
let book=readBook({});for(let stage=0;stage<STAGES;stage++){
 const q=makeQuestion(stage);book=recordAnswer(book,q,{choice:(q.answer+1)%q.choices.length,hints:2,day:'2026-11-07',at:stage});
 assert.equal(nextStage(book),stage+1);assert.equal(book.stamps.at(-1).firstCorrect,false);assert.equal(book.stamps.at(-1).question.audit,undefined);
 assert.equal(recordAnswer(book,q,{choice:q.answer,day:'2026-11-07'}),book);
}
assert.equal(dayCount(book,'2026-11-07'),36);assert.equal(dayCount(book,'2026-11-08'),0);
assert.equal(nextStage(JSON.parse(JSON.stringify(book))),36);
const base={id:'p',name:'p',points:7,thinkingBook:{...readBook({}),stamps:book.stamps.slice(0,1)}};
const local={...base,thinkingBook:{...base.thinkingBook,stamps:book.stamps.slice(0,2)}};
const remote={...base,thinkingBook:{...base.thinkingBook,stamps:book.stamps.slice(0,3)}};
const merged=mergeProfile(base,local,remote);assert.equal(nextStage(readBook(merged)),3);assert.equal(merged.points,7);
const twoA=recordAnswer(readBook({}),makeQuestion(0,1,'a'),{choice:0,hints:0,day:'2026-11-07',at:1,id:'device-a'});
const twoB=recordAnswer(readBook({}),makeQuestion(0,2,'b'),{choice:1,hints:1,day:'2026-11-07',at:2,id:'device-b'});
const twin=readBook(mergeProfile({id:'p',thinkingBook:readBook({})},{id:'p',thinkingBook:twoA},{id:'p',thinkingBook:twoB}));
assert.equal(twin.stamps.length,1);assert.equal(nextStage(twin),1);assert.deepEqual(twin.stamps[0].question,twoA.stamps[0].question);
let practice=readBook({});for(let i=0;i<140;i++)practice=recordAnswer(practice,makeQuestion(i%36),{choice:0,hints:0,day:'2026-11-07',at:i,id:`p-${i}`,practice:true});
assert.equal(Object.keys(practice.days).length,1);
practice=recordAnswer(practice,makeQuestion(0),{choice:0,hints:0,day:'2026-11-08',at:150,id:'next-day',practice:true});
assert.equal(Object.keys(practice.days).length,2);
assert.equal(practice.practice.length,120);assert.equal(nextStage(practice),0);
console.log(`PASS: ${total} generated questions independently solved; tier progression, deterministic generation, wrong-answer progress, deduplication, daily reset, bounded practice, JSON roundtrip and sync merge.`);

class El{
 constructor(tag,doc){this.tag=tag;this.doc=doc;this.children=[];this.attrs={};this.listeners={};this.scrollTop=0;this.disabled=false;this.inert=false;}
 setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,f){this.listeners[k]=f;}
 append(...xs){for(const x of xs){x.parent=this;this.children.push(x);}}
 replaceChildren(...xs){this.children.forEach(x=>x.parent=null);this.children=[];this.append(...xs);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}
 get isConnected(){return this===this.doc.body||!!this.parent?.isConnected;}
 get classList(){return{add:n=>{this.className=`${this.className||''} ${n}`;}};}
 querySelectorAll(selector){const sels=selector.split(',');const matches=el=>sels.some(s=>s.startsWith('.')?(el.className||'').split(' ').includes(s.slice(1)):s.startsWith('[')?false:el.tag===s);return this.children.flatMap(c=>[...(matches(c)?[c]:[]),...c.querySelectorAll(selector)]);}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
 focus(){this.doc.activeElement=this;}scrollIntoView(){}animate(){}getClientRects(){return[{}];}
 click(){this.listeners.click?.({target:this,currentTarget:this});}
 set textContent(s){this.children=[];this.text=s;}get textContent(){return this.text||this.children.map(c=>c.textContent).join('');}
}
const document={};document.body=new El('body',document);document.createElement=t=>new El(t,document);document.createTextNode=text=>Object.assign(new El('#text',document),{text});document.querySelector=s=>document.body.querySelector(s);document.querySelectorAll=s=>document.body.querySelectorAll(s);
const p={id:'test-p',name:'test',grade:'e4',points:15},other={id:'other',name:'other',grade:'adult',points:30};let active=p,fail=false,persisted=null,saveCount=0;
const notices=[],events={};const window={addEventListener:(k,f)=>events[k]=f,removeEventListener:k=>delete events[k]};
const globals={document,window,Node:El,icon:()=>new El('svg',document),toast:t=>notices.push(t),currentProfile:()=>active,getState:()=>({profiles:[p,other]}),save:()=>{saveCount++;if(fail)return false;persisted=JSON.stringify(p);return true;},today:()=> '2026-11-07',readBook,nextStage,recordAnswer,dayCount,STAGES,CHAPTERS:[{title:'Forest',scene:'forest',intro:'intro',sub:'sub',end:'end'},{title:'Lake',scene:'lake',intro:'intro',sub:'sub',end:'end'},{title:'Stars',scene:'stars',intro:'intro',sub:'sub',end:'end'}],makeQuestion,STOPS:Array.from({length:12},(_,i)=>({x:i,y:i})),sceneSvg:()=>'',matchMedia:()=>({matches:true})};
const ctx=vm.createContext(globals);
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const ui=read('js/ui.js').split('let toastTimer')[0].replace(/\bexport /g,'');
vm.runInContext(ui+'\n'+read('js/thinking.js').replace(/^import .*;\s*$/gm,'').replace(/\bexport /g,'')+'\nglobalThis.open=openThinkingClassroom;',ctx);
const find=text=>document.body.querySelectorAll('button').find(b=>b.textContent.includes(text));
const opener=new El('button',document);document.body.append(opener);opener.focus();ctx.open(p);
find('絵本をひらく').click();find('さあ、絵本の中へ').click();assert.ok(p.thinkingBook.introduced);
for(let stage=0;stage<3;stage++){
 find('つづきから考える').click();find('ヒントをみる').click();find('もうひとつヒント').click();
 const options=document.body.querySelector('.sb-choices').querySelectorAll('button');options[0].click();options[0].click();assert.ok(options.every(b=>b.disabled));
 const go=find('わかった、1マス進む');
 if(stage===0){fail=true;go.click();assert.equal(nextStage(readBook(p)),0);assert.ok(notices.some(t=>t.includes('保存できなかった')));fail=false;}
 go.click();go.click();assert.equal(nextStage(readBook(p)),stage+1);
}
assert.equal(dayCount(readBook(p),'2026-11-07'),3);assert.equal(p.points,15);assert.equal(other.thinkingBook,undefined);assert.equal(other.points,30);
assert.ok(find('もう少し進む'));find('足あとを見る').click();assert.ok(document.body.textContent.includes('ここまで考えてきたね'));
const close=()=>document.body.querySelectorAll('button').find(b=>b.attrs['aria-label']==='教室をとじる').click();close();assert.equal(opener.inert,false);
Object.assign(p,JSON.parse(persisted));ctx.open(p);assert.ok(document.body.textContent.includes('3 / 36'));active=other;events['manabi-synced']();assert.equal(document.querySelector('.thinking-overlay'),null);
active=p;document.body.focus();const launcher=new El('button',document);launcher.className='puzzle-btn';document.body.append(launcher);ctx.open(p);close();assert.equal(document.activeElement,launcher);
console.log(`PASS: real classroom UI on isolated DOM — onboarding, two hints, duplicate clicks, save-failure retry, 3 stamps, journal, reopen, profile switch and no reward changes (${saveCount} save calls).`);
const rand=randomFor('legacy');for(const name of ['icepath','blocks','origami','pattern','section']){const{default:g}=await import(`../js/brain/${name}.js`);for(let level=0;level<9;level++)for(let n=0;n<10;n++){const x=g.make(level,rand);if(name==='icepath')assert.equal(new Set(x.solution).size,x.solution.length);else assert.ok(x.answer>=0&&x.answer<x.options.length);}}
console.log('PASS: 450 existing puzzle generations.');

// The actual store keeps the additive profile field through save/reload/export/sync.
const memory=new Map(),storageEvents=[];
function storageContext(){
 const localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
 const env={localStorage,document:{addEventListener(){}},window:{addEventListener(){},dispatchEvent:e=>storageEvents.push(e.type)},CustomEvent:class{constructor(type){this.type=type;}},setTimeout(){}};
 const context=vm.createContext(env);
 vm.runInContext(read('js/store.js').replace(/\bexport /g,'')+'\nglobalThis.api={addProfile,currentProfile,save,exportData,replaceProfiles};',context);
 return context.api;
}
const store=storageContext(),sp=store.addProfile('isolated test','adult');sp.thinkingBook=JSON.parse(JSON.stringify(book));assert.equal(store.save(),true);
const restored=storageContext();assert.equal(nextStage(readBook(restored.currentProfile())),36);
assert.equal(JSON.parse(restored.exportData()).profiles[0].thinkingBook.stamps.length,36);
const kept=restored.currentProfile();restored.replaceProfiles([{...JSON.parse(restored.exportData()).profiles[0],name:'synced'}],kept.id);
assert.equal(restored.currentProfile(),kept);assert.equal(kept.name,'synced');assert.equal(nextStage(readBook(kept)),36);
const swContext=vm.createContext({self:{addEventListener(){}}});vm.runInContext(read('sw.js')+'\nglobalThis.files=FILES;',swContext);
for(const path of swContext.files)assert.ok(fs.existsSync(new URL(`../${path}`,import.meta.url)),`SW missing ${path}`);
for(const path of ['js/thinking-bank.js','js/thinking-progress.js','js/thinking-art.js','css/thinking.css','docs/thinking-classroom.html'])assert.ok(swContext.files.includes(path));
console.log('PASS: actual store save/reload/export/replaceProfiles and all service-worker precache paths.');
