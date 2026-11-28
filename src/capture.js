/** Sends extracted items to the Hivemind capture inbox, where a founder accepts or rejects them. */
const { callTool } = require('./hivemind-client');

function toCapture(item, { sourceRef, sender, date }) {
  const payload = { detail: item.detail, said_by: sender, date };
  if (item.name) payload.name = item.name;
  if (item.kind === 'commitment') Object.assign(payload, { text: item.summary, owner: item.owner, due_date: item.due_date });
  if (item.kind === 'decision') Object.assign(payload, { text: item.summary, decided_at: date });
  if (item.kind === 'fact') payload.value = item.value;
  return { kind: item.kind, summary: item.summary, payload, source_ref: sourceRef };
}

async function captureItems(items, ctx) {
  let n = 0;
  for (const item of items) {
    const r = await callTool('hivemind_capture', toCapture(item, ctx));
    if (r.isError) console.error('[capture error]', r.text.slice(0, 200));
    else n++;
  }
  return n;
}

module.exports = { captureItems, toCapture };
