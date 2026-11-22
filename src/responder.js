const { GoogleGenerativeAI } = require('@google/generative-ai');
const { cfg } = require('./config');
const { fetchContext } = require('./firestore');

let model;
function getModel() {
  if (!model) {
    const genAI = new GoogleGenerativeAI(cfg.geminiApiKey);
    model = genAI.getGenerativeModel({
      model: 'gemini-flash-lite-latest',
      systemInstruction: `You are Hive, the intelligence assistant for Bombay Bioworks — a bamboo activated carbon company in Guwahati, India.

You answer questions in the team's WhatsApp group using the company's knowledge base from Hivemind (the internal platform).

Rules:
- Lead with the direct answer
- Use specific numbers/figures when available
- Keep it to 2–4 sentences unless more detail is clearly needed
- If you don't have enough context, say so briefly rather than guessing
- Don't mention "the database" or "Hivemind" — just answer naturally`,
      generationConfig: { temperature: 0.2 },
    });
  }
  return model;
}

function scoreRelevance(note, keywords) {
  const text = `${note.title} ${note.summary} ${note.body}`.toLowerCase();
  return keywords.reduce((score, kw) => score + (text.includes(kw) ? 1 : 0), 0);
}

async function answer(rawQuestion) {
  const question = rawQuestion.replace(new RegExp(cfg.triggerPrefix, 'i'), '').trim();
  if (!question) return null;

  let notes = [];
  try {
    notes = await fetchContext(80);
  } catch (err) {
    console.error('Firestore fetch error:', err.message);
  }

  const keywords = question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const scored = notes
    .map(n => ({ ...n, score: scoreRelevance(n, keywords) }))
    .filter(n => n.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const context = scored.length ? scored : notes.slice(0, 15);
  const contextBlock = context.map(n =>
    `[${n.datetime?.slice(0, 10)}] ${n.title}\n${n.summary || ''}`
  ).join('\n\n');

  const prompt = `Question: "${question}"

Knowledge base context:
${contextBlock || '(no relevant entries found)'}

Answer the question.`;

  const result = await getModel().generateContent(prompt);
  return result.response.text().trim();
}

module.exports = { answer };
