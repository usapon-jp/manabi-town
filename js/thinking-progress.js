// 絵本の進みはプロフィール内。既存のexport・同期にそのまま含まれる。
import { BOOK_ID, STAGES } from './thinking-bank.js';
const validStamp=s=>s&&typeof s==='object'&&typeof s.id==='string'&&(s.id===`${BOOK_ID}-${s.stage}`||s.id.startsWith(`${BOOK_ID}-${s.stage}:`))&&Number.isInteger(s.stage)&&s.stage>=0&&s.stage<STAGES;
export function readBook(profile) {
  const raw=profile?.thinkingBook;
  // 端末ごとの解答は別idにして問題スナップショットを混ぜない。同じマスは最初の足あと1つを使う。
  const first=new Map();
  const stamps=Array.isArray(raw?.stamps)?raw.stamps.filter(validStamp).slice().sort((a,b)=>(Number(a.at)||0)-(Number(b.at)||0)||a.id.localeCompare(b.id)):[];
  stamps.forEach(s=>{if(!first.has(s.stage))first.set(s.stage,s);});
  const days={};
  for(const [day,marked] of Object.entries(raw?.days&&typeof raw.days==='object'?raw.days:{}))if(/^\d{4}-\d{2}-\d{2}$/.test(day)&&marked===true)days[day]=true;
  [...first.values(),...(Array.isArray(raw?.practice)?raw.practice:[])].forEach(s=>{if(/^\d{4}-\d{2}-\d{2}$/.test(s?.day))days[s.day]=true;});
  return {version:1,days,level:raw?.level===2?2:raw?.level===1?1:/^(j[123]|adult)$/.test(profile?.grade)?2:1,
    stamps:[...first.values()].sort((a,b)=>a.stage-b.stage),
    practice:Array.isArray(raw?.practice)?raw.practice.filter(x=>x&&typeof x.id==='string'&&typeof x.day==='string'):[],
    introduced:raw?.introduced===true};
}
export function nextStage(book) {
  const done=new Set(book.stamps.map(s=>s.stage));
  let n=0;while(n<STAGES&&done.has(n))n++;return n;
}
export function dayCount(book,day) {return book.stamps.filter(s=>s.day===day).length+book.practice.filter(s=>s.day===day).length;}
export function recordAnswer(book, question, {choice,hints,day,at,id,practice=false}) {
  const {audit,...snapshot}=question;
  const stamp={id:practice?id:id?`${question.id}:${id}`:question.id,stage:question.stage,day,at,choice,hints,firstCorrect:choice===question.answer,question:snapshot};
  if(practice)return {...book,days:{...book.days,[day]:true},practice:[...book.practice.filter(s=>s.id!==id),stamp].slice(-120)};
  if(book.stamps.some(s=>s.stage===question.stage))return book;
  if(question.stage!==nextStage(book))return book;
  return {...book,days:{...book.days,[day]:true},stamps:[...book.stamps,stamp]};
}
