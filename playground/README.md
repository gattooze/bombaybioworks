# Charcoal Trade Playground

A static, serverless data playground for Volza customs-trade records (charcoal HS 440210 bamboo, 440220 shell/nut, 440290 other wood; more to come).
SQLite runs in the browser (sql.js), so GitHub Pages is the whole backend.

| Tab | Use |
|---|---|
| About & caveats | What data exists (country × HSN × span) and how to read it |
| Insights | Curated findings; numbers are live SQL, commentary is in `insights.json` |
| Importers | League table of named buyers across HSNs and countries (names normalised), with company profiles |
| Explore | Pivot builder: filter + group by product / flow / reporter / origin / destination / buyer / year / month… with charts and CSV |
| SQL | Free SQL on the `shipments` table, saved queries, quick chart |
| Rows | Browse and search the raw records |
| Add data | Drop a Volza export into the session; download the merged DB |

> **Privacy:** this repo contains licensed Volza data (buyer/supplier names, shipment values). Keep the repository **private** unless your Volza terms allow redistribution. Pages from a private repo needs a paid GitHub plan; otherwise run locally or host behind access control.

## Run locally
```bash
python3 -m http.server 8000   # then open http://localhost:8000
```
(`file://` will not work: browsers block loading the database.)

## Deploy
Push to GitHub, then Settings → Pages → Deploy from branch → `main` / root.

## Layout
```
index.html        the app
lib.js            pure logic (SQL builder, row cleaner) – mirrors build.py
insights.json     curated insight cards (SQL + commentary)
build.py          raw → clean table (types, flow/reporter parsing, price rules)
ingest.py         append new Volza exports, then rebuild
data/raw/volza_raw.sqlite   untouched Volza rows (source of truth)
data/trade.sqlite           cleaned table the site loads
```

## Add data (permanent)
```bash
pip install openpyxl            # only for .xlsx
python3 ingest.py data/incoming/new_download.xlsx
git add -A && git commit -m "add data" && git push
```
Duplicates are skipped on Record Id, so re-ingesting a file is safe. `build.py` and `lib.js` hold the same cleaning rules; change both together.

## Read before using a number
- Import and Export feeds overlap (same trade, two reporters). Never add them.
- Reporter coverage starts at different dates; use “like-for-like reporters” for trends.
- `monthly_aggregate` rows have no buyer/supplier. `shipment` rows do.
- Prices outside $50-15,000/t are flagged `price_ok = 0` (kept, excluded from averages). Implied prices under $50/t also lose their tonnage (`qty_flag`).
- 440290 covers only 20 importer markets for Nov-2025 to Oct-2026; its official totals and named shipments overlap, so never add them.
- US bill-of-lading rows have no value or usable weight.
- Customs value is not a market quote.
