const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const { cfg } = require('./config');

let model;
function getModel() {
  if (!model) {
    const genAI = new GoogleGenerativeAI(cfg.geminiApiKey);
    model = genAI.getGenerativeModel({
      model: 'gemini-flash-lite-latest',
      systemInstruction: `You are an intelligence extraction assistant for Bombay Bioworks, a bamboo activated carbon company based in Guwahati, India. Extract structured intelligence from WhatsApp group messages.`,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });
  }
  return model;
}

const PROMPT = (messages) => `Extract intelligence from these WhatsApp group messages.

<messages>
${messages}
</messages>

Return a JSON object with this exact structure:
{
  "facts": [
    {
      "value": "the numeric figure or amount (e.g. '250', '45', '12000')",
      "unit": "unit if any (kg, INR, ₹, MT, ton, %, L, hrs, days, °C — empty string if none)",
      "context": "1-2 sentences explaining what this number means and what it refers to",
      "category": "one of: price|quantity|yield|temperature|financial|measurement|timeline|other",
      "date": "YYYY-MM-DD",
      "sender": "sender name"
    }
  ],
  "people": [
    {
      "name": "person or organization name",
      "context": "how they were mentioned (supplier, buyer, contact, institution, etc.)"
    }
  ],
  "decisions": [
    {
      "text": "one sentence describing the decision, agreement, or commitment",
      "date": "YYYY-MM-DD"
    }
  ]
}

Rules:
- Only extract numbers with meaningful business context. Skip phone numbers, year digits, bare message counts.
- Focus on: bamboo prices, char/carbon yield, activation yield, iodine values, batch quantities, temperatures, procurement figures, revenue, costs, timelines.
- People: only real external contacts, suppliers, buyers, or institutions. Skip team members (Pratik/PA, Mukund/MK, Karan/KV).
- If nothing meaningful, return {"facts":[],"people":[],"decisions":[]}.`;

async function extractBatch(messageBatch) {
  const formatted = messageBatch
    .map(m => `[${m.msg_date}] ${m.sender}: ${m.text}`)
    .join('\n');

  const result = await getModel().generateContent(PROMPT(formatted));
  const raw = result.response.text().trim();

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return { facts: [], people: [], decisions: [] };
  }
}

module.exports = { extractBatch };
