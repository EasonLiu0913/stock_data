'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {SOURCES,inspect,sha,MAX_BYTES}=require('../scripts/research_twse_official_event_source_pilot');
test('sources are HTTPS TWSE allowlisted and bounded',()=>{assert.equal(SOURCES.length,3);assert.ok(SOURCES.every(s=>new URL(s.url).protocol==='https:'&&new URL(s.url).hostname.endsWith('twse.com.tw')));assert.equal(MAX_BYTES,1048576)});
test('SHA256 of raw response remains reproducible',()=>{const bytes=Buffer.from('<html>公文通函 依日期查詢</html>');const x=inspect(bytes,SOURCES[0],200,'text/html');assert.equal(x.sha256,sha(bytes));assert.equal(x.bytes,bytes.length)});
test('even successful HTML fetch never proves page totals or effective-date completeness',()=>{const x=inspect(Buffer.from('<html>公告日期 生效日期</html>'),SOURCES[1],200,'text/html');assert.equal(x.server_total_count_verified,false);assert.equal(x.pagination_parameters_verified,false);assert.equal(x.effective_date_exhaustiveness_verified,false)});
