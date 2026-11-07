#!/usr/bin/env python3
"""Append one or more Volza exports (.xlsx / .csv) to the raw DB, then rebuild data/trade.sqlite.
Usage:  python3 ingest.py data/incoming/file1.xlsx [file2.csv ...] [--flow Import|Export --reporter India]
Rows are de-duplicated on Record Id (a re-downloaded file adds nothing). Raw values are stored as text, untouched.
--flow/--reporter are only needed when the file has no 'Source Country' column."""
import sys, os, re, sqlite3, argparse, csv, hashlib, datetime
import build
ALIAS = {"value": "valueusd", "stdunitrate": "stdunitrateusd", "unitrate": "unitrateusd", "buyername": "buyer", "suppliername": "supplier", "billofladingno": "billoflading", "containerid": "containernoid", "masterbilloflading": "masterbilloflading", "masterbillofladingno": "masterbilloflading"}   # newer Volza headers ("Value $")
def canon(h):
    k = re.sub(r"[^a-z0-9]", "", str(h).lower()); return ALIAS.get(k, k)

NA_SET = {"", "-", "NA", "N/A", "NOT AVAILABLE", "NONE"}
def _t(x):
    x = (x or "").strip().upper() if x is not None else ""
    return "" if x in NA_SET else x
def _num(x):
    try: return round(float(str(x).replace(",", "")), 3)
    except Exception: return _t(x)
def _sig(r):
    return (str(r["Date"] or "")[:10], re.sub(r"\D", "", r["HS_Code"] or "")[:6], _t(r["Buyer"]), _t(r["Supplier"]), _num(r["Std_Quantity"]), _t(r["Std_Unit"]), _num(r["Value_usd"]),
            _t(r["Country_of_Origin"]), _t(r["Country_of_Destination"]), _t(r["Bill_of_Lading"]), re.sub(r"\s+", " ", _t(r["Source_Country"])))

def dedupe_by_content(db):
    """Different Volza export layouts give the same shipment different Record Ids (or none). Collapse rows that are the same shipment across batches,
    keeping the batch with the most lines for that signature (so genuinely repeated identical lines inside one batch are preserved)."""
    db.row_factory = sqlite3.Row
    groups = {}
    for r in db.execute("select rowid, * from shipments"):
        groups.setdefault(_sig(r), {}).setdefault(r["source_file"], []).append((r["rowid"], 0 if str(r["Record_Id"]).startswith("gen-") else 1))
    drop = []
    for bys in groups.values():
        if len(bys) < 2: continue
        best = max(bys.values(), key=lambda v: (len(v), sum(x[1] for x in v))); keep = {x[0] for x in best}
        drop += [rid for rows in bys.values() for rid, _ in rows if rid not in keep]
    db.executemany("delete from shipments where rowid=?", [(x,) for x in drop]); db.commit(); db.row_factory = None
    return len(drop)

def norm_date(s):
    s = s.strip()
    for f in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d-%b-%Y", "%d/%m/%Y", "%m/%d/%Y"):
        try: return datetime.datetime.strptime(s[:len(datetime.datetime.now().strftime(f))+2] if f=="%Y-%m-%d %H:%M:%S" else s, f).strftime("%Y-%m-%d")
        except ValueError: pass
    return s[:10]

def read_rows(path):
    """Yield (header, row). xlsx: uses the 'Global Search Data' sheet if present and finds the header row (Date + HS Code)."""
    if path.lower().endswith((".xlsx", ".xls")):
        import openpyxl
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = next((wb[n] for n in wb.sheetnames if n not in ("CalculationSheet", "Index")), wb.worksheets[0])
        it = ws.iter_rows(values_only=True); head = None
        for r in it:
            names = [canon(x) for x in r if x]
            if "date" in names and "hscode" in names: head = r; break
        if head is None: sys.exit(f"{path}: could not find a header row with Date and HS Code")
        for r in it:
            if r and r[0] is not None: yield head, r
    else:
        with open(path, newline="", encoding="utf-8-sig") as f:
            rd = csv.reader(f); head = next(rd)
            for r in rd: yield head, r

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("files", nargs="+"); ap.add_argument("--flow"); ap.add_argument("--reporter")
    a = ap.parse_args()
    db = sqlite3.connect(build.RAW)
    existing = {r[1]: canon(r[1]) for r in db.execute("pragma table_info(shipments)")}
    by_canon = {v: k for k, v in existing.items() if k}
    have_ids = {r[0] for r in db.execute("select Record_Id from shipments")}
    seen = {}
    for path in a.files:
        batch = os.path.splitext(os.path.basename(path))[0]; added = dup = 0; first = True; heads = None; seen = {}
        for head, row in read_rows(path):
            if first:
                heads = [str(h) for h in head]; first = False
                miss = [k for k in ("date", "hscode") if k not in map(canon, heads)]
                if miss: sys.exit(f"{path}: missing columns {miss}. Found {heads}")
                if "sourcecountry" not in map(canon, heads) and not (a.flow and a.reporter):
                    sys.exit(f"{path}: no 'Source Country' column; pass --flow and --reporter")
                for h in heads:   # new columns are added, nothing is dropped
                    if canon(h) not in by_canon:
                        col = re.sub(r"[^A-Za-z0-9]+", "_", h).strip("_"); db.execute(f'ALTER TABLE shipments ADD COLUMN "{col}" text'); by_canon[canon(h)] = col
            rec = {by_canon[canon(h)]: ("" if v is None else str(v)) for h, v in zip(heads, row) if h}
            if "Date" in rec: rec["Date"] = norm_date(rec["Date"])
            if a.flow and a.reporter and not rec.get("Source_Country"): rec["Source_Country"] = f"{a.reporter} T3  {a.flow}"
            if a.flow == "Import" and a.reporter and not rec.get("Country_of_Destination"): rec["Country_of_Destination"] = a.reporter
            rid = rec.get("Record_Id")
            if rid:   # the same Record Id can repeat inside one file (e.g. one bill of lading, several container lines): keep every line
                seen[rid] = seen.get(rid, 0) + 1
                if seen[rid] > 1: rid = f"{rid}-{seen[rid]}"
            if not rid:   # no Record Id in this export: stable hash of the row, +#n for genuinely identical rows within a file
                k = hashlib.md5(repr(sorted(rec.items())).encode()).hexdigest()[:14]
                seen[k] = seen.get(k, 0) + 1; rid = f"gen-{k}-{seen[k]}"
            rec["Record_Id"] = rid
            if rid in have_ids: dup += 1; continue
            rec["source_file"] = batch; rec["HS_Code"] = re.sub(r"\D", "", rec.get("HS_Code", ""))
            rec["hs6"] = rec["HS_Code"][:6]
            cols = list(rec); db.execute(f"INSERT INTO shipments({','.join(chr(34)+c+chr(34) for c in cols)}) VALUES({','.join('?'*len(cols))})", [rec[c] for c in cols])
            have_ids.add(rid); added += 1
        db.commit(); print(f"{path}: +{added} new rows, {dup} duplicates skipped")
    removed = dedupe_by_content(db); print(f"content dedupe removed {removed} cross-batch duplicate rows")
    db.close(); build.main()
if __name__ == "__main__": main()
