# Hivemind MCP server

Lets Claude (this project's threads now, the always-on assistant later) read and write
Hivemind. Every write goes through `../ontology`, so it is validated and logged as an Event
with actor `assistant`.

## Tools
| Tool | Does |
|---|---|
| `hivemind_search` | Word search across every readable type |
| `hivemind_get` | One record plus its last 10 events |
| `hivemind_timeline` | Everything that refers to a person, organisation or record |
| `hivemind_list` | Records of a type, filtered by exact field values |
| `hivemind_attention` | Overdue tasks and commitments, due deals, samples awaiting feedback, inbox and drafts: the daily brief |
| `hivemind_describe` | JSON Schema of a type (and deal pipelines) |
| `hivemind_create` / `hivemind_update` | Validated writes. Outbox messages stay drafts. |
| `hivemind_capture` | Put an uncertain extraction in the capture inbox |

Deliberately missing: delete, approve, send. Standing approvals cannot be created here.

## Run and test
```bash
npm install
npm test                       # 14 tests, in-memory store
MCP_SECRET=$(openssl rand -hex 32) GOOGLE_APPLICATION_CREDENTIALS=sa.json npm start
```

## Deploy (Cloud Run, needs the Blaze plan)
From `hivemind/`:
```bash
gcloud run deploy hivemind-mcp --source . --dockerfile mcp/Dockerfile \
  --project bombay-bioworks --region asia-south1 \
  --allow-unauthenticated --min-instances 0 --max-instances 2 \
  --set-secrets MCP_SECRET=hivemind-mcp-secret:latest
```
Create the secret first: `openssl rand -hex 32 | gcloud secrets create hivemind-mcp-secret --data-file=-`.
The service account needs the Cloud Datastore User role.

Then add a custom connector in claude.ai with the URL `https://<service-url>/mcp/<secret>`.

## Security
The secret in the URL is v1 only: anyone holding the URL can read and write Hivemind
(never delete, approve or send). Keep it to the founders, rotate it by updating the secret,
and move to OAuth before sharing more widely.
