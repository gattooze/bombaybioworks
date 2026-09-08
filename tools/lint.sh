#!/bin/sh
# Pre-push lint. Fails loudly if a banned character reaches a shipped file.
# Scope is the active site only, legacy/ and v3/ are archived and exempt.
status=0
for f in index.html modules.html products.html chemistry.html industry.html \
         planet.html circularity.html about.html assets/style.css \
         assets/modules.css assets/motifs.js assets/site.js; do
  [ -f "$f" ] || continue
  n=$(grep -c '—\|&mdash;' "$f" 2>/dev/null || true)
  if [ "${n:-0}" -gt 0 ] 2>/dev/null; then
    echo "EM-DASH in $f ($n)"
    grep -n '—\|&mdash;' "$f" | head -5
    status=1
  fi
done
[ "$status" = "0" ] && echo "lint: clean, no em-dashes"
exit $status
