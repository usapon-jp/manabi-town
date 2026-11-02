// 「とりこみコード」を読む。Claude がプリントの写真から作る JSON。
// 形: {"manabi":1,"items":[{type,subject,title,range,date}],"quizzes":[{title,subject,questions:[{q,options?,answer}]}]}
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseImport(text) {
  const raw = String(text || '').replace(/```(json)?/g, '').trim();
  if (!raw) return { error: 'コードを貼ってね' };
  let data;
  try { data = JSON.parse(raw); } catch (e) { return { error: 'コードが読めなかったよ。ぜんぶ貼れているか見てね' }; }
  if (!data || data.manabi !== 1) return { error: 'まなびタウンのコードではないみたい' };

  const items = (Array.isArray(data.items) ? data.items : [])
    .filter((i) => i && (i.type === 'test' || i.type === 'homework') && i.title && DATE.test(i.date))
    .map((i) => ({ type: i.type, subject: String(i.subject || 'その他'), title: String(i.title), range: String(i.range || ''), date: i.date }));

  const quizzes = (Array.isArray(data.quizzes) ? data.quizzes : []).filter((qz) => qz && typeof qz === 'object')
    .map((qz) => ({
      title: String(qz.title || '小テスト'),
      subject: String(qz.subject || ''),
      questions: (Array.isArray(qz.questions) ? qz.questions : []).filter(validQuestion).map((q) => (
        Array.isArray(q.options)
          ? { q: String(q.q), options: q.options.map(String), answer: q.answer }
          : { q: String(q.q), answer: Number(q.answer) }
      )),
    }))
    .filter((qz) => qz.questions.length > 0);

  if (!items.length && !quizzes.length) return { error: '入れられるものが なかったよ' };
  return { items, quizzes };
}

function validQuestion(q) {
  if (!q || !q.q) return false;
  if (q.options != null && !Array.isArray(q.options)) return false;
  if (Array.isArray(q.options)) return q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length;
  return Number.isFinite(Number(q.answer));
}
