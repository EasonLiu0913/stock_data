#!/usr/bin/env python3
"""Isolated apples-to-apples SQLite sizing: identical 4-digit security records and indices."""
import json, os, sqlite3, tempfile
from pathlib import Path

src=Path('/tmp/turso-v3.ndjson')
rows=[json.loads(s) for s in src.read_text().splitlines() if s]
assert len(rows)>10000, f'Unexpectedly small dataset: {len(rows)}'
keys=['foreign_buy','foreign_sell','foreign_net','trust_buy','trust_sell','trust_net','dealer_net','total_net']
measurements={}
for mode in ('json','structured'):
    f=tempfile.mktemp(prefix='turso-poc-'+mode+'-',suffix='.sqlite')
    db=sqlite3.connect(f)
    db.execute('PRAGMA journal_mode=DELETE')
    db.execute('PRAGMA page_size=4096')
    if mode=='json':
        db.execute('CREATE TABLE d(trade_date TEXT NOT NULL,stock_id TEXT NOT NULL,row_json TEXT NOT NULL,PRIMARY KEY(trade_date,stock_id))')
        records=[(r['trade_date'],r['stock_id'],json.dumps([r.get(k) for k in keys],separators=(',',':'),ensure_ascii=False)) for r in rows]
        db.executemany('INSERT INTO d VALUES(?,?,?)',records)
    else:
        db.execute('CREATE TABLE d(trade_date TEXT NOT NULL,stock_id TEXT NOT NULL,'+','.join(k+' INTEGER' for k in keys)+',PRIMARY KEY(trade_date,stock_id))')
        db.executemany('INSERT INTO d VALUES('+','.join(['?']*(2+len(keys)))+')',[[r['trade_date'],r['stock_id']]+[r[k] for k in keys] for r in rows])
    db.execute('CREATE INDEX idx_stock_date ON d(stock_id,trade_date)')
    db.commit()
    size=os.path.getsize(f)
    assert db.execute('SELECT COUNT(*) FROM d').fetchone()[0]==len(rows)
    measurements[mode]={'bytes_with_index':size,'bytes_per_row':round(size/len(rows),1)}
    db.close()
    os.remove(f)
ratio=round(measurements['structured']['bytes_with_index']/measurements['json']['bytes_with_index'],4)
result={'row_count':len(rows),'sqlite_same_rows_index_comparison':measurements,'structured_to_json_ratio':ratio,'limitations':'Local SQLite measurements exclude existing Turso v2 tables, network usage and provider-specific storage overhead; JSON comparison stores identical eight measures as compact arrays.'}
print('[TURSO-SIZE] CAPACITY_PASS '+json.dumps(result))
Path('/tmp/turso-v3-sizing.json').write_text(json.dumps(result,indent=2))
