'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {verifyArchive}=require('../scripts/verify_daily_gainers_m2_primary_archive');
const root=path.join(__dirname,'../data_research/twse-market-opening/primary-archive/20261008');
function fixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m2-archive-'));for(const n of fs.readdirSync(root))fs.copyFileSync(path.join(root,n),path.join(dir,n));return dir;}
test('exact archived official raw response is verified but never published',()=>{const v=verifyArchive();assert.equal(v.raw_bytes_verified,true);assert.equal(v.status,'partial');assert.equal(v.prompt_b_eligible,false);assert.equal(v.per_security_5pct.validated,false);assert.equal(v.industry_categories,34);});
test('byte changes fail SHA-256',()=>{const d=fixture(),p=path.join(d,'20261008-bfi82u.json');fs.appendFileSync(p,' ');assert.throws(()=>verifyArchive(d),/raw SHA/);});
test('altered manifest fails',()=>{const d=fixture(),p=path.join(d,'20261008-fmtqik.manifest.json');const v=JSON.parse(fs.readFileSync(p));v.sha256='0'.repeat(64);fs.writeFileSync(p,JSON.stringify(v));assert.throws(()=>verifyArchive(d),/raw SHA/);});
test('missing sector file fails closed',()=>{const d=fixture();fs.unlinkSync(path.join(d,'20261008-bfiamu.json'));assert.throws(()=>verifyArchive(d));});
