# Bombay Bioworks repo: guide for Claude

| Path | What |
|---|---|
| `hivemind/` | Hivemind ops platform (CRM and more). Read `hivemind/CLAUDE.md` before touching it. |
| `hivemind/mcp/` | Hivemind MCP server, live on Cloud Run |

Apply the BB Design System v1.0 to all UI. No em-dashes in user-facing copy.

## Hivemind data from any Claude thread

Native MCP tools from `.mcp.json` do not load in project threads (tested 28 Nov 2026).
Call the live server directly instead. It works from every cloud session in this environment:
the allowed host is set, and the environment's network secret adds the Bearer token, so no secret
goes in code or chat.

```bash
hivemind/mcp/hm.sh hivemind_attention
hivemind/mcp/hm.sh hivemind_search '{"query":"steel"}'
hivemind/mcp/hm.sh hivemind_list '{"type":"person","where":{"segment":"demand"},"limit":20}'
hivemind/mcp/hm.sh hivemind_get '{"type":"person","id":"<id>"}'
hivemind/mcp/hm.sh hivemind_describe '{"type":"person"}'
```

Tools: `hivemind_describe`, `hivemind_search`, `hivemind_get`, `hivemind_timeline`, `hivemind_list`,
`hivemind_attention`, `hivemind_create`, `hivemind_update`, `hivemind_capture`.
Run `hivemind_describe` before a write to see the fields. Writes go through the ontology repo
and log an Event. Facts you are unsure of go to `hivemind_capture`, not `hivemind_create`.
The script exits 1 on a tool error and 2 if the server is unreachable (host not allowed or secret missing).
