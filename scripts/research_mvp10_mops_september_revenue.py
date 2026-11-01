#!/usr/bin/env python3
"""Research-only official MOPS historical revenue receipt and exact company-row check.
Runs in isolated CI. Never writes to repository canonical data or publishes media.
"""
import hashlib
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request

PERIOD = "115_9"
BASE = "https://mopsov.twse.com.tw/nas/t21/sii/"
TARGETS = {
    "2305": {"name": "全友", "revenue_thousand_ntd": 196565, "previous_year_thousand_ntd": 62840, "yoy_pct": 212.80},
    "3416": {"name": "融程電", "revenue_thousand_ntd": 534569, "previous_year_thousand_ntd": 272871, "yoy_pct": 95.90},
    "6672": {"name": "騰輝電子-KY", "revenue_thousand_ntd": 1020897, "previous_year_thousand_ntd": 338399, "yoy_pct": 201.68},
}

class RevenueRows(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.in_tr = False
        self.cell_depth = 0
        self.cell = []
        self.cells = []

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.in_tr = True
            self.cells = []
        elif self.in_tr and tag in ("td", "th"):
            self.cell_depth += 1
            if self.cell_depth == 1:
                self.cell = []

    def handle_data(self, data):
        if self.in_tr and self.cell_depth:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.in_tr and self.cell_depth:
            self.cell_depth -= 1
            if self.cell_depth == 0:
                self.cells.append(" ".join("".join(self.cell).split()))
        elif tag == "tr" and self.in_tr:
            if self.cells:
                self.rows.append(self.cells)
            self.in_tr = False
            self.cell_depth = 0

def digits(s):
    raw = str(s).replace(",", "").replace("＋", "+").strip()
    return float(raw) if re.fullmatch(r"[+-]?\d+(?:\.\d+)?", raw) else None

def verify_columns(code, cells, expected):
    """MOPS t21sc03 table positions: code,name,current,prior,yearago,MoM,YoY,cumulative,yearago cumulative,cumulativeYoY,note."""
    if len(cells) < 11:
        return {"verified": False, "reason": "TOO_FEW_COLUMNS"}
    code_matched = str(cells[0]).strip().lstrip("0") == code
    name_matched = cells[1] == expected["name"]
    current = digits(cells[2])
    yearago = digits(cells[4])
    yoy = digits(cells[6])
    last = (digits(cells[5]), digits(cells[9]))
    correct = (code_matched and name_matched and current == expected["revenue_thousand_ntd"] and
               yearago == expected["previous_year_thousand_ntd"] and yoy is not None and
               abs(yoy - expected["yoy_pct"]) < 0.005)
    return {
        "verified": bool(correct), "reason": "ALL_FIELD_POSITIONS_MATCH" if correct else "FIELD_POSITION_MISMATCH",
        "company_name": cells[1], "revenue_thousand_ntd": current, "last_year_thousand_ntd": yearago,
        "mom_pct": last[0], "official_yoy_pct": yoy, "cumulative_revenue_thousand_ntd": digits(cells[7]),
        "cumulative_last_year_thousand_ntd": digits(cells[8]), "cumulative_yoy_pct": last[1],
        "company_filing_note": cells[10], "column_indices_verified": [0,1,2,4,6,7,8,9,10],
    }

def retrieve(suffix, output):
    url = f"{BASE}t21sc03_{PERIOD}_{suffix}.html"
    record = {"url": url, "http_status": None, "response_sha256": None,
              "response_length": 0, "encoding": None, "error": None, "target_rows": {}}
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; MarketResearchEvidence/1.0)",
            "Accept": "text/html,application/xhtml+xml",
        })
        with urllib.request.urlopen(req, timeout=18) as resp:
            record["http_status"] = resp.status
            b = resp.read(12 * 1024 * 1024 + 1)
        if len(b) > 12 * 1024 * 1024:
            raise ValueError("OFFICIAL_HTML_EXCEEDS_12MB")
        record["response_sha256"] = hashlib.sha256(b).hexdigest()
        record["response_length"] = len(b)
        if record["http_status"] != 200 or not b:
            raise ValueError("OFFICIAL_HTTP_NOT_OK")
        for enc in ("cp950", "big5", "utf-8"):
            try:
                decoded = b.decode(enc)
                record["encoding"] = enc
                break
            except UnicodeDecodeError:
                continue
        else:
            raise ValueError("OFFICIAL_ENCODING_NOT_DECODABLE")
        parser = RevenueRows()
        parser.feed(decoded)
        for row in parser.rows:
            matches = [x for x in row if re.fullmatch(r"0?(2305|3416|6672)", x)]
            if not matches:
                continue
            code = matches[0].lstrip("0")
            if code in record["target_rows"]:
                raise ValueError("DUPLICATED_COMPANY_CODE_ROW:" + code)
            # Preserve all table cells for human-verifiable source-field positions.
            record["target_rows"][code] = row[:24]
    except Exception as exc:
        record["error"] = type(exc).__name__ + ": " + str(exc)[:400]
    return record

def run(output_dir):
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    result = {
        "schema_version": 1, "research_only": True,
        "official_source_period": "ROC115/09", "target_trade_date": "20261008",
        "expected_company_records": TARGETS,
        "pages": [retrieve(0, out), retrieve(1, out)],
        "official_revenue_claims_validated": [],
        "official_column_proof": {},
        "not_validated_codes": [],
        "source_content_present": False,
        "company_event_caused_market_movement_verified": False,
        "full_market_summary_approved": False,
        "render_authorized": False, "publication_authorized": False,
    }
    # Numeric values must appear in a *single same-code row*. The table's
    # exact column mappings still need independent inspection; numerical
    # presence alone is not certification of table meaning.
    for code, expected in TARGETS.items():
        hits = [(p, p["target_rows"][code]) for p in result["pages"] if code in p["target_rows"]]
        if len(hits) != 1:
            result["not_validated_codes"].append({"code": code, "reason": "OFFICIAL_ROW_ABSENT_OR_DUPLICATE"})
            continue
        page, row = hits[0]
        proof = verify_columns(code, row, expected)
        result["official_column_proof"][code] = proof
        if proof["verified"] and page["http_status"] == 200:
            result["official_revenue_claims_validated"].append(code)
        else:
            result["not_validated_codes"].append({"code": code, "reason": proof["reason"]})
    result["source_content_present"] = any(p["response_sha256"] and p["target_rows"] for p in result["pages"])
    result["official_table_columns_verified"] = len(result["official_revenue_claims_validated"]) == 3
    result["decision"] = ("OFFICIAL_HISTORICAL_REVENUE_FIELDS_MATCHED_NO_CAUSATION"
                          if len(result["official_revenue_claims_validated"]) == 3 else
                          "BLOCKED_INCOMPLETE_OFFICIAL_HISTORICAL_RECEIPTS")
    dest = out / "20261008-mops-revenue-original-receipt.json"
    dest.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "decision": result["decision"],
        "codes_row_matched": result["official_revenue_claims_validated"],
        "not_validated_codes": result["not_validated_codes"],
        "official_table_columns_verified": result["official_table_columns_verified"],
        "official_column_proof": result["official_column_proof"],
        "pages": [{"http_status": p["http_status"], "response_length": p["response_length"],
                   "sha256": p["response_sha256"], "encoding": p["encoding"],
                   "codes_found": list(p["target_rows"]), "error": p["error"]} for p in result["pages"]],
        "receipt_sha256": hashlib.sha256(dest.read_bytes()).hexdigest(),
        "render_authorized": False,
    }, ensure_ascii=False, indent=2))
    return result

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 scripts/research_mvp10_mops_september_revenue.py OUTPUT_DIR")
    run(sys.argv[1])
