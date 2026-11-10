import { stripHtml } from './utils.js';

const STOP = new Set('the a an and or but of to in on for with at by from is are was were be been being this that these those it its as we our us you your they their he she his her i me my will would can could should have has had do does did not no so if then than also about into over under after before more most very just'.split(' '));

export function autoSummary(html, maxSentences = 2) {
  const text = stripHtml(html);
  if (!text) return '';
  const sentences = (text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [text]).map(s => s.trim()).filter(Boolean);
  if (sentences.length <= maxSentences) return text.length > 240 ? text.slice(0, 237) + '…' : text;
  const freq = {};
  (text.toLowerCase().match(/\b[a-z][a-z'-]{2,}\b/g) || []).forEach(w => { if (!STOP.has(w)) freq[w] = (freq[w] || 0) + 1; });
  const scored = sentences.map((s, i) => {
    const words = s.toLowerCase().match(/\b[a-z][a-z'-]{2,}\b/g) || [];
    const score = words.reduce((a, w) => a + (freq[w] || 0), 0) / (words.length || 1) * (i === 0 ? 1.15 : 1);
    return { s, score, i };
  });
  const top = scored.sort((a, b) => b.score - a.score).slice(0, maxSentences).sort((a, b) => a.i - b.i);
  let out = top.map(t => t.s).join(' ');
  if (out.length > 260) out = out.slice(0, 257) + '…';
  return out;
}
