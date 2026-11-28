/**
 * Talks to Hivemind through its MCP server, the one API every writer uses.
 * Auth: Bearer HIVEMIND_MCP_SECRET (from Secret Manager hivemind-mcp-secret on the VM).
 */
const { cfg } = require('./config');

let nextId = 1;

async function rpc(method, params) {
  const res = await fetch(cfg.hivemindUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(cfg.hivemindSecret ? { authorization: `Bearer ${cfg.hivemindSecret}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Hivemind ${res.status}: ${text.slice(0, 200)}`);
  const line = text.trim().startsWith('{') ? text : (text.split('\n').find(l => l.startsWith('data:')) || '').slice(5);
  const msg = JSON.parse(line);
  if (msg.error) throw new Error(`Hivemind: ${msg.error.message}`);
  return msg.result;
}

let toolCache;
/** Tool definitions in the shape the Claude API takes. */
async function listTools() {
  if (!toolCache) {
    const { tools } = await rpc('tools/list', {});
    toolCache = tools.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
  }
  return toolCache;
}

/** Returns { text, isError }. */
async function callTool(name, args = {}) {
  const r = await rpc('tools/call', { name, arguments: args });
  return { text: (r.content || []).map(c => c.text).join('\n'), isError: !!r.isError };
}

module.exports = { listTools, callTool };
