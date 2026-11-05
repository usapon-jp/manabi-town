// 音声（ブラウザの音声入力・読み上げ。追加料金なし）。
// 入力: SpeechRecognition（iPhone/iPad の Safari・Android の Chrome）。「ホーム画面に追加」したアプリでは iOS だと動かないことがある。
// 読み上げ: speechSynthesis。iOS は 最初の1回を タップの中で よばないと 鳴らないので unlock() を使う。
const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const TTS = typeof window !== 'undefined' && 'speechSynthesis' in window;

export const canListen = !!SR;
export const canSpeak = TTS;
export const isStandalone = () => window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;

// 読み上げ用に、絵文字・記号・かっこ書きの記号を はぶく
export function speakable(text) {
  return String(text || '')
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/[*_`#>~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 「Apple は りんご」→ [{ja}, {en: Apple}, {ja}]
export function splitLang(text) {
  const out = [];
  const re = /[A-Za-z][A-Za-z0-9'’,.!?\- ]*[A-Za-z0-9.!?]/g;
  let at = 0; let m;
  const push = (t, lang) => { const s = t.trim(); if (!s || !/[\p{L}\p{N}]/u.test(s)) return; const l = out[out.length - 1]; if (l && l.lang === lang) l.text += ` ${s}`; else out.push({ text: s, lang }); };
  while ((m = re.exec(text))) { push(text.slice(at, m.index), 'ja-JP'); push(m[0], 'en-US'); at = m.index + m[0].length; }
  push(text.slice(at), 'ja-JP');
  return out;
}

export function createVoice() {
  let rec = null;
  let utter = null;
  const voices = {};

  // ていねいで聞きとりやすい声（日本語: Kyoko・O-Ren・Google、英語: Samantha・Google US など）をえらぶ
  function pickVoice(lang) {
    if (!TTS) return null;
    if (voices[lang]) return voices[lang];
    const all = speechSynthesis.getVoices();
    const vs = lang === 'en-US' ? all.filter((v) => /^en-US/i.test(v.lang)).concat(all.filter((v) => /^en/i.test(v.lang)))
      : all.filter((v) => /^ja/i.test(v.lang));
    const good = lang === 'en-US' ? /samantha|google|natural|enhanced|premium/i : /kyoko|o-ren|google|siri|enhanced|premium/i;
    voices[lang] = vs.find((v) => good.test(v.name)) || vs[0] || null;
    return voices[lang];
  }

  return {
    // タップの中で よぶ。iOS で あとから鳴らせるように
    unlock() { if (TTS) { try { speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch { /* 無視 */ } } },
    // opt: { lang: 'ja-JP' | 'en-US' | 'mix', slow }
    // mix は 日本語の中の英語（2文字以上）だけ 英語の声で読む
    speak(text, onEnd, { lang = 'ja-JP', slow = false } = {}) {
      if (!TTS) { onEnd?.(); return; }
      this.stopListen();   // 聞きとり中に読み上げると、その声を 子どもの声として 送ってしまう
      this.stopSpeak();
      const t = speakable(text);
      if (!t) { onEnd?.(); return; }
      const parts = lang === 'mix' ? splitLang(t) : [{ text: t, lang }];
      const token = {};
      utter = token;
      const next = (i) => {
        if (utter !== token) return;
        if (i >= parts.length) { utter = null; onEnd?.(); return; }
        const pt = parts[i];
        const u = new SpeechSynthesisUtterance(pt.text);
        u.lang = pt.lang;
        u.rate = pt.lang === 'en-US' ? (slow ? 0.6 : 0.88) : (slow ? 0.75 : 0.95);
        u.pitch = pt.lang === 'en-US' ? 1.05 : 1.15;
        const v = pickVoice(pt.lang); if (v) u.voice = v;
        let fired = false;
        const go = () => { if (!fired) { fired = true; next(i + 1); } };
        u.onend = go; u.onerror = go;
        speechSynthesis.speak(u);
      };
      next(0);
    },
    stopSpeak() { if (TTS) { utter = null; try { speechSynthesis.cancel(); } catch { /* 無視 */ } } },
    speaking() { return !!utter; },
    // onResult(text) は 話しおわったとき。onEnd(reason) は 聞きとりが おわったとき（reason: ok | none | denied | error）
    // lang: 'ja-JP'（ふつう）か 'en-US'（英会話）
    listen({ onResult, onInterim, onEnd, lang = 'ja-JP' }) {
      if (!SR) { onEnd?.('error'); return; }
      this.stopListen();
      this.stopSpeak();
      let got = false; let reason = 'none';
      const r = new SR();
      rec = r;
      r.lang = lang; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
      r.onresult = (e) => {
        const res = e.results[e.results.length - 1];
        const text = res[0].transcript;
        if (res.isFinal) { got = true; reason = 'ok'; onResult?.(text); } else onInterim?.(text);
      };
      r.onerror = (e) => { reason = (e.error === 'not-allowed' || e.error === 'service-not-allowed') ? 'denied' : e.error === 'no-speech' || e.error === 'aborted' ? 'none' : 'error'; };
      r.onend = () => { if (rec === r) rec = null; onEnd?.(got ? 'ok' : reason); };
      try { r.start(); } catch { rec = null; onEnd?.('error'); }
    },
    stopListen() { if (rec) { const r = rec; rec = null; try { r.abort(); } catch { /* 無視 */ } } },
    listening() { return !!rec; },
    destroy() { this.stopListen(); this.stopSpeak(); },
  };
}
