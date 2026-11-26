// HTTP entry point (Cloud Run). Stateless Streamable HTTP MCP server.
//
// Auth for v1: a long random secret, accepted either as the last path segment
// (https://host/mcp/<secret>, for claude.ai custom connectors) or as a Bearer token.
// Rotate it by changing MCP_SECRET. Replace with OAuth before anyone outside the
// founders gets the URL.
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import admin from 'firebase-admin';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createRepo, firestoreAdminAdapter } from '../../ontology/index.js';
import { makeHandlers, registerTools } from './tools.js';

const SECRET = process.env.MCP_SECRET || '';
const PORT = Number(process.env.PORT || 8080);
if (SECRET.length < 32) {
  console.error('MCP_SECRET must be set to at least 32 random characters.');
  process.exit(1);
}

admin.initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT || 'bombay-bioworks' });
const repo = createRepo({
  adapter: firestoreAdminAdapter(admin.firestore()),
  actor: 'assistant',
  source: { channel: 'assistant', by: 'hivemind-mcp' },
});
const handlers = makeHandlers(repo);

const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
function authorised(req) {
  const url = new URL(req.url, 'http://x');
  const fromPath = url.pathname.startsWith('/mcp/') ? url.pathname.slice(5) : '';
  const fromHeader = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return (fromPath && same(fromPath, SECRET)) || (fromHeader && same(fromHeader, SECRET));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : undefined;
}

http.createServer(async (req, res) => {
  try {
    if (req.url === '/healthz') { res.writeHead(200).end('ok'); return; }
    if (!req.url.startsWith('/mcp')) { res.writeHead(404).end(); return; }
    if (!authorised(req)) { res.writeHead(401).end('unauthorised'); return; }

    // Stateless: a fresh server and transport per request.
    const server = new McpServer({ name: 'hivemind', version: '0.1.0' });
    registerTools(server, handlers);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { transport.close(); server.close(); });
    await server.connect(transport);
    const body = req.method === 'POST' ? await readBody(req) : undefined;
    await transport.handleRequest(req, res, body);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500).end('error');
  }
}).listen(PORT, () => console.log(`hivemind-mcp listening on ${PORT}`));
