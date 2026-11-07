/* Pure logic (no DOM) so it can be unit-tested in Node. Mirrors build.py: if you change one, change the other. */
(function (root) {
  const HS_NAME = { "440210": "Bamboo charcoal", "440220": "Shell / nut charcoal", "440290": "Other wood charcoal", "380210": "Activated carbon" };
  const CTRY = { Srilanka: "Sri Lanka", SaudiArabia: "Saudi Arabia", UnitedKingdom: "United Kingdom", NewZealand: "New Zealand", CostaRica: "Costa Rica",
    Columbia: "Colombia", USA: "United States", Korea: "South Korea", PhilippinesComplete: "Philippines", GlobalDirectory: "Global directory" };
  const NA = new Set(["", "NA", "N/A", "Not Available", "-", "Z To Order and NA", "To Order", "TO ORDER"]);
  const PRICE_MIN = 50, PRICE_MAX = 15000;

  const DIMS = { hsn: "hs6", flow: "flow", reporter: "reporter", origin: "origin", destination: "destination",
    buyer: "buyer", supplier: "supplier", year: "year", quarter: "quarter", month: "month", record_type: "record_type",
    incoterm: "incoterm", mode: "mode", port_origin: "port_origin", port_destination: "port_destination", batch: "batch" };
  const TIME_DIMS = new Set(["year", "quarter", "month"]);
  const PRICE_EXPR = "ROUND(SUM(CASE WHEN price_ok THEN value_usd END)/NULLIF(SUM(CASE WHEN price_ok THEN kg END),0)*1000)";
  const METRICS = {
    shipments: { sql: "COUNT(*)", additive: true },
    tonnes: { sql: "ROUND(SUM(tonnes),1)", additive: true },
    value_usd_m: { sql: "ROUND(SUM(value_usd)/1e6,3)", additive: true },
    avg_price_usd_t: { sql: PRICE_EXPR, additive: false },
    buyers: { sql: "COUNT(DISTINCT buyer)", additive: false },
    suppliers: { sql: "COUNT(DISTINCT supplier)", additive: false },
  };

  const txt = (x) => { x = (x == null ? "" : String(x)).trim(); return NA.has(x) ? null : x; };
  const ctry = (x) => { x = (x == null ? "" : String(x)).trim(); return NA.has(x) ? null : (CTRY[x] || x); };
  const num = (x) => { if (x == null || x === "") return null; const n = Number(String(x).replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
  const ALIAS = { value: "valueusd", stdunitrate: "stdunitrateusd", unitrate: "unitrateusd" };
  const canon = (h) => { const k = String(h).toLowerCase().replace(/[^a-z0-9]/g, ""); return ALIAS[k] || k; };

  function parseSource(s) {
    const m = String(s || "").trim().match(/^(.*?)\s+(T\d)\s+(Import|Export)$/);
    if (!m) return [null, null, null];
    const name = m[1].trim();
    return [CTRY[name] || name, m[2], m[3]];
  }

  /* raw: object keyed by canon(header). opts: {flow, reporter} overrides when the file has no Source Country column. */
  function cleanRow(raw, batch, opts = {}) {
    const g = (k) => raw[k];
    let [reporter, tier, flow] = parseSource(g("sourcecountry"));
    if (opts.reporter) reporter = opts.reporter;
    if (opts.flow) flow = opts.flow;
    if (reporter === "Global directory") flow = "Directory";
    const d = String(g("date") || "").slice(0, 10);
    const buyer = txt(g("buyer")), sup = txt(g("supplier"));
    const rtype = reporter === "Global directory" ? "directory" : (buyer == null && sup == null ? "monthly_aggregate" : "shipment");
    const unit = (String(g("stdunit") || "").trim()) || null;
    const qty = num(g("stdquantity"));
    let kg = unit === "KGS" && qty && qty > 0 ? qty : null;
    const val = num(g("valueusd"));
    let pr = null, ok = 0, qflag = null;
    if (kg && val && val > 0) { pr = val / kg * 1000; ok = pr >= PRICE_MIN && pr <= PRICE_MAX ? 1 : 0; if (pr < PRICE_MIN) { kg = null; qflag = "qty_overstated"; } }
    const hs6 = String(g("hscode") || "").replace(/\D/g, "").slice(0, 6);
    const y = /^\d{4}/.test(d) ? parseInt(d.slice(0, 4), 10) : null;
    const id = g("recordid") ? String(g("recordid")) : "gen-" + hash([d, hs6, g("buyer"), g("supplier"), g("stdquantity"), g("valueusd"), g("billoflading"), reporter, flow].join("|"));
    return [id, d, y, d.slice(0, 7), y ? `${y}-Q${Math.floor((parseInt(d.slice(5, 7), 10) - 1) / 3) + 1}` : null,
      hs6, hs6, String(g("productdescription") || "").slice(0, 300),
      flow, reporter, tier, rtype,
      ctry(g("countryoforigin")), ctry(g("countryofdestination")), buyer, sup, ctry(g("buyercountry")),
      txt(g("portoforigin")), txt(g("portofdestination")),
      qty, unit, kg, kg ? kg / 1000 : null, val, pr, ok, txt(g("incoterms")), txt(g("shipmentmode")), num(g("containerteu")),
      txt(g("billoflading")), txt(g("vesselname")), txt(g("carriername")), batch, qflag];
  }
  function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

  /* state: {dims:[], metrics:[], filters:{col:[values]}, text, monthFrom, monthTo, priceOkOnly, likeForLike, sortMetric, sortDir}
     "" in a filter array means NULL. Returns {sql, params}. */
  function buildExploreSQL(st) {
    const where = [], params = [];
    for (const [col, vals] of Object.entries(st.filters || {})) {
      if (!vals || !vals.length || !DIMS[col] && col !== "hs6") continue;
      const real = vals.filter((v) => v !== ""), hasNull = vals.includes("");
      const parts = [];
      if (real.length) { parts.push(`${col} IN (${real.map(() => "?").join(",")})`); params.push(...real); }
      if (hasNull) parts.push(`${col} IS NULL`);
      where.push("(" + parts.join(" OR ") + ")");
    }
    if (st.monthFrom) { where.push("month >= ?"); params.push(st.monthFrom); }
    if (st.monthTo) { where.push("month <= ?"); params.push(st.monthTo); }
    if (st.text && st.text.trim()) {
      const t = "%" + st.text.trim() + "%";
      where.push("(buyer LIKE ? OR supplier LIKE ? OR description LIKE ? OR bl LIKE ?)"); params.push(t, t, t, t);
    }
    if (st.priceOkOnly) where.push("price_ok = 1");
    if (st.likeForLike && st.monthFrom && st.monthTo) {
      const a = parseInt(st.monthFrom.slice(0, 4), 10), b = parseInt(st.monthTo.slice(0, 4), 10);
      where.push(`(reporter||'|'||flow||'|'||hs6) IN (SELECT reporter||'|'||flow||'|'||hs6 FROM shipments WHERE year BETWEEN ${a} AND ${b} GROUP BY 1 HAVING COUNT(DISTINCT year)=${b - a + 1})`);
    }
    const dims = (st.dims || []).filter((d) => DIMS[d]);
    const mets = (st.metrics && st.metrics.length ? st.metrics : ["shipments"]).filter((m) => METRICS[m]);
    const sel = [...dims.map((d) => DIMS[d] + " AS " + d), ...mets.map((m) => METRICS[m].sql + " AS " + m)];
    let sql = `SELECT ${sel.join(", ")} FROM shipments` + (where.length ? " WHERE " + where.join(" AND ") : "");
    if (dims.length) {
      sql += " GROUP BY " + dims.map((_, i) => i + 1).join(",");
      const sm = mets.includes(st.sortMetric) ? st.sortMetric : mets[0];
      const timeFirst = TIME_DIMS.has(dims[0]);
      sql += timeFirst ? ` ORDER BY ${dims.map((_, i) => i + 1).join(",")}` : ` ORDER BY ${sm} ${st.sortDir === "asc" ? "ASC" : "DESC"}`;
      sql += " LIMIT 50000";
    }
    return { sql, params, dims, mets, whereSql: where.length ? " WHERE " + where.join(" AND ") : "" };
  }

  /* rows -> chart data. cols=[dims..., metrics...]. Returns {labels, series:[{name,data}]} */
  function pivot(cols, rows, dims, metric, topN = 15, topSeries = 8) {
    const mi = cols.indexOf(metric), additive = METRICS[metric] ? METRICS[metric].additive : true;
    if (dims.length === 0) return { labels: [], series: [] };
    const time = TIME_DIMS.has(dims[0]);
    if (dims.length === 1) {
      let r = rows.map((x) => [x[0] == null ? "(blank)" : String(x[0]), x[mi]]);
      if (!time) { r.sort((a, b) => (b[1] || 0) - (a[1] || 0)); r = r.slice(0, topN); }
      return { labels: r.map((x) => x[0]), series: [{ name: metric, data: r.map((x) => x[1]) }] };
    }
    const tot1 = new Map(), tot2 = new Map();
    for (const x of rows) { const a = x[0] == null ? "(blank)" : String(x[0]), b = x[1] == null ? "(blank)" : String(x[1]); const v = x[mi] || 0;
      tot1.set(a, (tot1.get(a) || 0) + v); tot2.set(b, (tot2.get(b) || 0) + v); }
    let labels = [...tot1.keys()];
    if (!time) labels = labels.sort((a, b) => tot1.get(b) - tot1.get(a)).slice(0, topN); else labels.sort();
    const keep = [...tot2.keys()].sort((a, b) => tot2.get(b) - tot2.get(a)).slice(0, topSeries);
    const cell = new Map(); for (const x of rows) cell.set((x[0] == null ? "(blank)" : String(x[0])) + "\u0001" + (x[1] == null ? "(blank)" : String(x[1])), x[mi]);
    const series = keep.map((s) => ({ name: s, data: labels.map((l) => (cell.has(l + "\u0001" + s) ? cell.get(l + "\u0001" + s) : null)) }));
    if (additive && tot2.size > keep.length) {
      series.push({ name: "Other", data: labels.map((l) => { let s = 0; for (const k of tot2.keys()) if (!keep.includes(k)) s += cell.get(l + "\u0001" + k) || 0; return s || null; }) });
    }
    return { labels, series };
  }

  function fmt(v) {
    if (v == null) return "";
    if (typeof v !== "number") return String(v);
    if (Number.isInteger(v)) return v.toLocaleString("en-US");
    return Math.abs(v) >= 100 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v.toLocaleString("en-US", { maximumFractionDigits: 3 });
  }
  function toCSV(cols, rows) {
    const q = (v) => { if (v == null) return ""; v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return [cols.map(q).join(","), ...rows.map((r) => r.map(q).join(","))].join("\n");
  }

  const api = { HS_NAME, DIMS, TIME_DIMS, METRICS, canon, parseSource, cleanRow, buildExploreSQL, pivot, fmt, toCSV, PRICE_MIN, PRICE_MAX };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.TL = api;
})(typeof window !== "undefined" ? window : globalThis);
