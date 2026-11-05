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

export function createVoice() {
  let rec = null;
  let utter = null;
  let jaVoice = null;

  function pickVoice() {
    if (jaVoice || !TTS) return jaVoice;
    const vs = speechSynthesis.getVoices().filter((v) => /^ja/i.test(v.lang));
    // ていねいで聞きとりやすい声（Kyoko・O-Ren・Google 日本語 など）をえらぶ
    jaVoice = vs.find((v) => /kyoko|o-ren|google|siri|enhanced|premium/i.test(v.name)) || vs[0] || null;
    return jaVoice;
  }

  return {
    // タップの中で よぶ。iOS で あとから鳴らせるように
    unlock() { if (TTS) { try { speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch { /* 無視 */ } } },
    speak(text, onEnd) {
      if (!TTS) { onEnd?.(); return; }
      this.stopSpeak();
      const t = speakable(text);
      if (!t) { onEnd?.(); return; }
      utter = new SpeechSynthesisUtterance(t);
      utter.lang = 'ja-JP';
      utter.rate = 0.95;
      utter.pitch = 1.15;
      const v = pickVoice(); if (v) utter.voice = v;
      const done = () => { if (utter === u) { utter = null; onEnd?.(); } };
      const u = utter;
      u.onend = done; u.onerror = done;
      speechSynthesis.speak(u);
    },
    stopSpeak() { if (TTS) { utter = null; try { speechSynthesis.cancel(); } catch { /* 無視 */ } } },
    speaking() { return !!utter; },
    // onResult(text) は 話しおわったとき。onEnd(reason) は 聞きとりが おわったとき（reason: ok | none | denied | error）
    listen({ onResult, onInterim, onEnd }) {
      if (!SR) { onEnd?.('error'); return; }
      this.stopListen();
      this.stopSpeak();
      let got = false; let reason = 'none';
      const r = new SR();
      rec = r;
      r.lang = 'ja-JP'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
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
