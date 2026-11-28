#!/usr/bin/env bash
# Call a Hivemind tool from any project thread, without the MCP client.
#   hivemind/mcp/hm.sh hivemind_attention
#   hivemind/mcp/hm.sh hivemind_search '{"query":"ankur"}'
#   hivemind/mcp/hm.sh hivemind_list '{"type":"person","where":{"segment":"demand"},"limit":20}'
# Auth: the cloud environment's network secret adds the Bearer token, so no secret appears here.
# Prints the tool's JSON result. Exit code 1 if the tool returned an error.
set -euo pipefail
URL=${HIVEMIND_MCP_URL:-https://hivemind-mcp-849464697051.asia-south1.run.app/mcp}
TOOL=${1:?usage: hm.sh <tool> [json-args]}
ARGS=${2:-'{}'}
BODY=$(node -e 'console.log(JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:process.argv[1],arguments:JSON.parse(process.argv[2])}}))' "$TOOL" "$ARGS")
curl -sS -X POST "$URL" -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d "$BODY" \
| node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const line=s.trim().startsWith("{")?s:(s.split("\n").find(l=>l.startsWith("data:"))||"").slice(5);
  if(!line){console.error("No response (is the host allowed and the network secret set?):\n"+s.slice(0,300));process.exit(2);}
  const j=JSON.parse(line);
  if(j.error){console.error(JSON.stringify(j.error));process.exit(1);}
  const r=j.result;console.log(r.content.map(c=>c.text).join("\n"));process.exit(r.isError?1:0);
});'
