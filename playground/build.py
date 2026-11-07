#!/usr/bin/env python3
"""Rebuild data/trade.sqlite (clean, typed, what the website loads) from data/raw/volza_raw.sqlite (untouched Volza rows).
Run:  python3 build.py        (also called by ingest.py)"""
import sqlite3, re, os, json, datetime
ROOT = os.path.dirname(os.path.abspath(__file__))
RAW, OUT = f"{ROOT}/data/raw/volza_raw.sqlite", f"{ROOT}/data/trade.sqlite"

HS_NAME = {"440210": "Bamboo charcoal", "440220": "Shell / nut charcoal", "440290": "Other wood charcoal",
           "380210": "Activated carbon"}
CTRY = {"Srilanka": "Sri Lanka", "SaudiArabia": "Saudi Arabia", "UnitedKingdom": "United Kingdom", "NewZealand": "New Zealand",
        "CostaRica": "Costa Rica", "Columbia": "Colombia", "USA": "United States", "Korea": "South Korea",
        "PhilippinesComplete": "Philippines", "GlobalDirectory": "Global directory"}
NA = {"", "NA", "N/A", "Not Available", "-", "Z To Order and NA", "To Order", "TO ORDER"}
PRICE_MIN, PRICE_MAX = 50, 15000   # USD/t sanity band; outside = flagged price_ok=0 (rows kept)

def num(x):
    try: return float(str(x).replace(",", ""))
    except: return None
def txt(x):
    x = (x or "").strip()
    return None if x in NA else x
def ctry(x):
    x = (x or "").strip()
    return None if x in NA else CTRY.get(x, x)

def parse_source(s):
    m = re.match(r"^(.*?)\s+(T\d)\s+(Import|Export)$", (s or "").strip())
    if not m: return None, None, None
    name = m.group(1).strip()
    return CTRY.get(name, name), m.group(2), m.group(3)

def main():
    raw = sqlite3.connect(RAW); raw.row_factory = sqlite3.Row
    if os.path.exists(OUT): os.remove(OUT)
    out = sqlite3.connect(OUT)
    out.execute("""CREATE TABLE shipments(
      id TEXT PRIMARY KEY, date TEXT, year INT, month TEXT, quarter TEXT,
      hs6 TEXT, product TEXT, description TEXT,
      flow TEXT, reporter TEXT, tier TEXT, record_type TEXT,
      origin TEXT, destination TEXT, buyer TEXT, supplier TEXT, buyer_country TEXT,
      port_origin TEXT, port_destination TEXT,
      qty REAL, unit TEXT, kg REAL, tonnes REAL, value_usd REAL,
      price_usd_t REAL, price_ok INT, incoterm TEXT, mode TEXT, teu REAL, bl TEXT, vessel TEXT, carrier TEXT,
      batch TEXT, qty_flag TEXT)""")
    rows = []; skipped = 0
    for r in raw.execute("select * from shipments"):
        reporter, tier, flow = parse_source(r["Source_Country"])
        d = (r["Date"] or "")[:10]
        buyer, sup = txt(r["Buyer"]), txt(r["Supplier"])
        if reporter == "Global directory": flow = "Directory"   # buyer/supplier listing, not dated trade: keep out of Import/Export totals
        rtype = ("directory" if reporter == "Global directory" else
                 "monthly_aggregate" if (buyer is None and sup is None) else "shipment")
        unit = (r["Std_Unit"] or "").strip() or None
        qty = num(r["Std_Quantity"])
        kg = qty if unit == "KGS" and qty and qty > 0 else None
        val = num(r["Value_usd"])
        pr, ok, qflag = None, 0, None
        if kg and val and val > 0:
            pr = val / kg * 1000
            ok = int(PRICE_MIN <= pr <= PRICE_MAX)
            if pr < PRICE_MIN: kg, qflag = None, "qty_overstated"   # implied price under the floor: source quantity is in the wrong unit; keep the row, drop its tonnage
        hs6 = (r["HS_Code"] or "")[:6]
        if hs6 not in HS_NAME or hs6 == "380210": skipped += 1; continue   # keep the clean table to the HSNs in scope (raw keeps everything)
        y = int(d[:4]) if d[:4].isdigit() else None
        rows.append((r["Record_Id"], d, y, d[:7], f"{y}-Q{(int(d[5:7])-1)//3+1}" if y else None,
          hs6, hs6, (r["Product_Description"] or "")[:300],
          flow, reporter, tier, rtype,
          ctry(r["Country_of_Origin"]), ctry(r["Country_of_Destination"]), buyer, sup, ctry(r["Buyer_Country"]),
          txt(r["Port_of_Origin"]), txt(r["Port_of_Destination"]),
          qty, unit, kg, kg/1000 if kg else None, val,
          pr, ok, txt(r["Incoterms"]), txt(r["Shipment_Mode"]), num(r["Container_TEU"]),
          txt(r["Bill_of_Lading"]), txt(r["Vessel_Name"]), txt(r["Carrier_Name"]), r["source_file"], qflag))
    out.executemany("INSERT OR IGNORE INTO shipments VALUES(" + ",".join("?"*34) + ")", rows)
    for c in ("hs6","year","origin","destination","buyer","flow","reporter","record_type","month"):
        out.execute(f"CREATE INDEX ix_{c} ON shipments({c})")
    # lineage + metadata the site shows
    out.execute("CREATE TABLE meta(k TEXT PRIMARY KEY, v TEXT)")
    n = out.execute("select count(*) from shipments").fetchone()[0]
    meta = {"built": "October 2026", "rows": n,
            "batches": json.dumps([x[0] for x in out.execute("select distinct batch from shipments")]),
            "price_band_usd_t": f"{PRICE_MIN}-{PRICE_MAX}"}
    out.executemany("INSERT INTO meta VALUES(?,?)", meta.items())
    out.commit(); out.execute("VACUUM"); out.close()
    print(f"skipped {skipped} out-of-scope rows (kept in raw)"); print(f"built {OUT}: {n} rows, {os.path.getsize(OUT)/1e6:.1f} MB")
if __name__ == "__main__": main()
