'use strict';
// Daily gainers text representation v2. Typed tokens are the source of truth.
// Free prose cannot be independently rewritten in caption and speech branches.
const fs = require('node:fs');
const crypto = require('node:crypto');

const digits = '零一二三四五六七八九';
const units = ['', '十', '百', '千'];
const bigUnits = ['', '萬', '億', '兆'];

function integerSpoken(number) {
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('Unsafe number');
  if (number === 0) return '零';
  const chunks = [];
  let n = number;
  while (n > 0) { chunks.unshift(n % 10000); n = Math.floor(n / 10000); }
  let result = '';
  let zero = false;
  for (let index = 0; index < chunks.length; index++) {
    const v = chunks[index];
    if (!v) { zero = true; continue; }
    if (result && (zero || v < 1000)) result += '零';
    const chars = String(v).padStart(4, '0');
    let segment = '', pendingZero = false;
    for (let i = 0; i < 4; i++) {
      const d = Number(chars[i]);
      if (!d) { if (segment) pendingZero = true; continue; }
      if (pendingZero) segment += '零';
      segment += digits[d] + units[3 - i];
      pendingZero = false;
    }
    result += segment + bigUnits[chunks.length - 1 - index];
    zero = false;
  }
  return result.replace(/^一十/, '十');
}
function decimalSpoken(n) {
  const s = String(n);
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(s)) throw new Error('Unverified numeric literal: ' + s);
  const [whole, fraction] = s.split('.');
  return integerSpoken(Number(whole)) + (fraction ? '點' + [...fraction].map(x => digits[Number(x)]).join('') : '');
}
function dateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('Invalid date token');
  const [, year, month, day] = match;
  const d = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw new Error('Invalid calendar date');
  return {year: Number(year), month:Number(month), day:Number(day)};
}
function stockIndex(raw) {
  const index = new Map();
  for (const row of raw.stocks || []) {
    const code = String(row.code || '');
    const name = String(row.name || '').trim();
    if (!/^\d{4,6}$/.test(code) || !name || index.has(code)) throw new Error('Ambiguous raw stock identity: ' + code);
    index.set(code, name);
  }
  return index;
}
function renderToken(token, mode, stocks) {
  switch (token.type) {
    case 'text': {
      if (typeof token.value !== 'string') throw new Error('Invalid text');
      return token.value;
    }
    case 'stock': {
      const code = String(token.code);
      const name = stocks.get(code);
      if (!name) throw new Error('Stock not in verified raw universe: ' + code);
      return mode === 'display' ? name + '（' + code + '）' : name;
    }
    case 'date': {
      const {month, day} = dateParts(token.value);
      return mode === 'speech' ? integerSpoken(month) + '月' + integerSpoken(day) + '日' : month + '/' + day;
    }
    case 'number': {
      const value = String(token.value);
      const speech = decimalSpoken(value);
      const display = value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return mode === 'speech' ? speech : display;
    }
    case 'percent': {
      const value = String(token.value);
      const spoken = decimalSpoken(value);
      return mode === 'speech' ? '百分之' + spoken : value + '%';
    }
    case 'month': {
      const month=Number(token.value);
      if(!Number.isInteger(month)||month<1||month>12) throw new Error('Invalid month token');
      return mode==='speech' ? integerSpoken(month)+'月' : month+'月';
    }
    case 'numeric_phrase': {
      const caption=String(token.caption||'');
      const speech=String(token.speech||'');
      if(!/^\d[\d,]*(?:\.\d+)?(?:%|億|萬|張|元|檔|季|日)?$/.test(caption) || !/[零一二三四五六七八九十百千萬億兆兩]/.test(speech))
        throw new Error('Invalid explicit numeric phrase');
      return mode==='speech'?speech:caption;
    }
    case 'stock_code': {
      const code = String(token.code);
      if (!stocks.has(code)) throw new Error('Unknown stock code');
      return mode === 'speech' ? [...code].map(d => digits[Number(d)]).join('') : code;
    }
    default: throw new Error('Unknown token type: ' + token.type);
  }
}
function buildVariants(doc, raw, rules) {
  if (doc.schema_version !== 2 || !Array.isArray(doc.scenes)) throw new Error('Master v2 required');
  if (doc.target_date !== raw.target_date) throw new Error('Date mismatch');
  if (rules.version !== 'daily-gainers-text-presentation-v1') throw new Error('Unsupported rules version');
  const stocks = stockIndex(raw);
  const sources = JSON.stringify({doc,raw_stock_identities:[...stocks.entries()],rules});
  const manifest = {schema_version:2,target_date:doc.target_date,rules_version:rules.version,
    source_sha256:crypto.createHash('sha256').update(sources).digest('hex')};
  const output = {display:[],captions:[],speech:[],manifest};
  doc.scenes.forEach((scene, i) => {
    // A cue is the indivisible alignment unit. Both formats are rendered
    // from the very same semantic tokens; no independent summarization.
    if (!Array.isArray(scene.cues) || !scene.cues.length)
      throw new Error('Missing semantic cues for scene ' + i);
    const cues = scene.cues.map((tokens, j) => {
      if (!Array.isArray(tokens) || !tokens.length)
        throw new Error('Empty semantic cue ' + i + ':' + j);
      for (const token of tokens) {
        if (token.type === 'text' && (/[0-9０-９]/.test(token.value) ||
            /[零一二三四五六七八九十百千萬億兆兩点點]{2,}/.test(token.value)))
          throw new Error('Ambiguous numbers in free-text token: ' + token.value);
      }
      return {
        display: tokens.map(t => renderToken(t, 'display', stocks)).join(''),
        caption: tokens.map(t => renderToken(t, 'captions', stocks)).join(''),
        speech: tokens.map(t => renderToken(t, 'speech', stocks)).join('')
      };
    });
    for (const mode of ['display','captions','speech']) {
      const key = mode === 'captions' ? 'caption' : mode;
      output[mode].push({id:i+1,text:cues.map(c=>c[key]).join('')});
    }
    if (cues.some(c => !c.caption || !c.speech))
      throw new Error('Empty rendered caption/speech cue');
    output.cue_pairs ??= [];
    output.cue_pairs.push({id:i+1, caption_cues:cues.map(c=>({caption:c.caption,speech:c.speech}))});
    manifest.scene_count = i+1;
  });
  for (const mode of ['display','captions','speech','cue_pairs'])
    manifest[mode+'_sha256']=crypto.createHash('sha256').update(JSON.stringify(output[mode])).digest('hex');
  return output;
}
module.exports={integerSpoken,decimalSpoken,dateParts,stockIndex,renderToken,buildVariants};
if (require.main===module) {
  const [masterFile,rawFile,rulesFile,outDir]=process.argv.slice(2);
  if (![masterFile,rawFile,rulesFile,outDir].every(Boolean)) throw new Error('Usage: node scripts/daily_gainers_text_variants.js master.json raw.json rules.json output-dir');
  const parsed = [masterFile,rawFile,rulesFile].map(f=>JSON.parse(fs.readFileSync(f,'utf8')));
  const output=buildVariants(...parsed);
  fs.mkdirSync(outDir,{recursive:true});
  for(const name of ['display','captions','speech','cue_pairs','manifest'])
    fs.writeFileSync(require('node:path').join(outDir,name+'.json'),JSON.stringify(output[name],null,2)+'\n');
  console.log(JSON.stringify({date:output.manifest.target_date,rules:output.manifest.rules_version,scenes:output.manifest.scene_count,status:'PASS'}));
}
