#!/usr/bin/env python3
"""Fail-closed research-only BFI82U dated source and monetary reconciliation.
No credentials, no writes outside user-supplied artifact directory, no release actions.
"""
import argparse
import datetime as dt
import hashlib
import json
import pathlib
import urllib.error
import urllib.parse
import urllib.request

DATE = "20261013"
URL = "https://www.twse.com.tw/rwd/zh/fund/BFI82U?" + urllib.parse.urlencode(
    {"type": "day", "dayDate": DATE, "response": "json"})
REQUIRED = ("自營商(自行買賣)", "自營商(避險)", "投信",
            "外資及陸資(不含外資自營商)", "外資自營商", "合計")

def amount(v):
    s = str(v).strip().replace(",", "").replace("−", "-").replace("＋", "+")
    if not s or s in ("--", "N/A", "null"):
        raise ValueError("missing monetary amount")
    if s[0] in "+-":
        digits = s[1:]
    else:
        digits = s
    if not digits.isdecimal():
        raise ValueError("noninteger monetary amount")
    return int(s)

def validate(blob):
    obj = json.loads(blob)
    if obj.get("stat") != "OK":
        raise ValueError("TWSE stat not OK")
    title = str(obj.get("title", ""))
    if "115年10月13日" not in title or "三大法人" not in title:
        raise ValueError("wrong dated source title")
    fields = obj.get("fields")
    data = obj.get("data")
    if not isinstance(fields, list) or len(fields) != 4:
        raise ValueError("unexpected column schema")
    if fields != ["單位名稱", "買進金額", "賣出金額", "買賣差額"]:
        raise ValueError("unexpected column labels")
    if not isinstance(data, list) or len(data) != len(REQUIRED):
        raise ValueError("unexpected number of rows")
    rows = {}
    for row in data:
        if not isinstance(row, list) or len(row) != 4:
            raise ValueError("invalid row")
        label = str(row[0]).strip()
        if label not in REQUIRED or label in rows:
            raise ValueError("invalid or duplicate investor type")
        buy, sell, net = map(amount, row[1:])
        if min(buy, sell) < 0 or buy - sell != net:
            raise ValueError("buy/sell/net mismatch: " + label)
        rows[label] = {"buy_twd": buy, "sell_twd": sell, "net_twd": net}
    if set(rows) != set(REQUIRED):
        raise ValueError("missing investor row")
    # Foreign dealers are already contained in dealers' flow, so excluded in aggregate.
    parts = REQUIRED[:4]
    for k in ("buy_twd", "sell_twd", "net_twd"):
        if sum(rows[p][k] for p in parts) != rows["合計"][k]:
            raise ValueError("aggregate mismatch: " + k)
    return {"source_title": title, "rows": rows, "aggregate_excludes_foreign_dealers": True}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("output_dir")
    args = p.parse_args()
    dest = pathlib.Path(args.output_dir)
    dest.mkdir(parents=True, exist_ok=True)
    checked_at = dt.datetime.now(dt.timezone.utc).isoformat()
    receipt = {"target_date": DATE, "request_url": URL, "retrieved_utc": checked_at,
               "source_http_receipt_verified": False, "institutional_BFI82U_amounts_verified": False,
               "publication_authorized": False, "upload_authorized": False,
               "purpose": "isolated_research_only"}
    try:
        req = urllib.request.Request(URL, headers={
            "User-Agent": "TAIWAN-STOCK-ResearchSourceAudit/1.0",
            "Accept": "application/json",
        })
        with urllib.request.urlopen(req, timeout=20) as res:
            raw = res.read(2_000_001)
            receipt["http_status"] = res.status
            receipt["response_url"] = res.geturl()
            receipt["content_type"] = res.headers.get("Content-Type")
            receipt["response_headers"] = dict(res.headers.items())
        receipt["raw_sha256"] = hashlib.sha256(raw).hexdigest()
        receipt["raw_length"] = len(raw)
        if receipt["http_status"] != 200 or len(raw) > 2_000_000:
            raise ValueError("invalid HTTP status or raw response size")
        if urllib.parse.urlparse(receipt["response_url"]).hostname not in ("www.twse.com.tw", "twse.com.tw"):
            raise ValueError("unexpected redirect host")
        parsed = validate(raw)
        receipt.update(parsed)
        receipt["source_http_receipt_verified"] = True
        receipt["institutional_BFI82U_amounts_verified"] = True
        (dest / "bfi82u-20261013-original-response.json").write_bytes(raw)
    except Exception as exc:
        receipt["error_type"] = type(exc).__name__
        receipt["error_message"] = str(exc)[:300]
    (dest / "bfi82u-20261013-research-receipt.json").write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if not receipt["institutional_BFI82U_amounts_verified"]:
        raise SystemExit("BFI82U_NOT_CERTIFIED: " + receipt.get("error_message", "source unavailable"))
    print("BFI82U_RESEARCH_DATE_AND_MONEY_PASS", receipt["raw_sha256"])

if __name__ == "__main__":
    main()
