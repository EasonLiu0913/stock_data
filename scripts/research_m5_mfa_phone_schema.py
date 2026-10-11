#!/usr/bin/env python3
"""M5 research-only provenance: inspect acoustic ZIP phone sources and MFA lexicon columns."""
import argparse,collections,hashlib,json,pathlib,zipfile,re
A={"acoustic":("pretrained_models/acoustic/mandarin_mfa.zip","c4c91c499ada0de35346481d4af69c7328075ddb0ce16a8cfb19fc74d0401199"),"dictionary":("pretrained_models/dictionary/mandarin_china_mfa.dict","0881d4e338e26509d022992cb5b897ead24a176448f534481238cb3a7fe949f0"),"g2p":("pretrained_models/g2p/mandarin_china_mfa.zip","005a9cc869d606a19ae3338cdcdd283c8b6384968cfed76c0e30fa58137a6034")}
def hashfile(p):
 h=hashlib.sha256()
 with open(p,"rb") as f:
  for chunk in iter(lambda:f.read(1024*1024),b""):h.update(chunk)
 return h.hexdigest()
def numeric(x):
 try:return float(x)
 except ValueError:return None
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--root",required=True);ap.add_argument("--output",required=True);a=ap.parse_args()
 out=pathlib.Path(a.output);out.parent.mkdir(parents=True,exist_ok=True)
 proof={"contract":"M5-REAL-MFA-PHONE-SCHEMA-RESEARCH-v1","publication_authorized":False,"acoustic_sentence_boundary_verified":False,"forced_alignment_executed":False,"phone_inventory_verified":False,"dictionary_phone_schema_verified":False,"blockers":[]}
 try:
  root=pathlib.Path(a.root)
  for kind,(rel,expected) in A.items():
   p=root/rel
   if not p.is_file() or hashfile(p)!=expected:raise ValueError("authentic "+kind+" sha256 mismatch")
  with zipfile.ZipFile(root/A["acoustic"][0]) as z:
   names=z.namelist()
   proof["acoustic_zip_phone_related_members"]=[{"path":n,"size":z.getinfo(n).file_size,"sha256":hashlib.sha256(z.read(n)).hexdigest()} for n in names if not n.endswith("/") and ("phone" in n.lower() or n.endswith(("meta.yaml","meta.yml","meta.json")))]
   # Do not claim the acoustic inventory from a heuristic ZIP filename match.
   phonefiles=[n for n in names if n.endswith("/phones.txt") or n=="phones.txt"]
   if len(phonefiles)==1:
    raw=z.read(phonefiles[0]).decode("utf-8")
    entries=[s.split() for s in raw.splitlines() if s.strip()]
    if entries and all(len(t)==2 and t[1].isdigit() for t in entries):
     proof["acoustic_symbol_table"]={"path":phonefiles[0],"sha256":hashlib.sha256(z.read(phonefiles[0])).hexdigest(),"symbols":[t[0] for t in entries]}
     proof["phone_inventory_verified"]=True
   proof["acoustic_archive_file_count"]=len(names)
  lex=collections.Counter();shapes=collections.Counter();phones=collections.Counter();invalid=[];examples={}
  with open(root/A["dictionary"][0],encoding="utf-8-sig") as f:
   for line_no,line in enumerate(f,1):
    if not line.strip():continue
    col=line.rstrip("\r\n").split("\t")
    if len(col)<2:invalid.append(line_no);continue
    head=col[0];tail=col[1:]
    # Official MFA columns: headword, optional pronunciation probability,
    # optional following-silence probability and 2 correction factors, pronunciation.
    fields=tail[0].split() if len(tail)==1 else []
    if len(tail)==1: prefix=[];pron=fields
    elif len(tail)==2 and numeric(tail[0]) is not None:prefix=[tail[0]];pron=tail[1].split()
    elif len(tail)==5 and all(numeric(x) is not None for x in tail[:4]):prefix=tail[:4];pron=tail[4].split()
    else:invalid.append(line_no);continue
    if not pron or any(numeric(x) is not None for x in pron):invalid.append(line_no);continue
    shapes[len(prefix)]+=1;lex[head]+=1
    for symbol in pron:phones[symbol]+=1
    if head in ("台湾","证交所","自营商","三大","法人","卖","超","TAIWAN","STOCK") and len(examples.get(head,[]))<4:examples.setdefault(head,[]).append({"numeric_prefix":prefix,"phones":pron,"line_number":line_no})
  proof["dictionary"]={"entry_count":sum(shapes.values()),"headword_count":len(lex),"optional_numeric_prefix_count":dict(shapes),"invalid_count":len(invalid),"invalid_first_lines":invalid[:15],"distinct_pronunciation_symbols":len(phones),"pronunciation_symbols":sorted(phones),"candidate_evidence":examples,"english_exact_entries":{"TAIWAN":lex["TAIWAN"],"STOCK":lex["STOCK"]}}
  if invalid:raise ValueError("dictionary ambiguous column schema on "+str(len(invalid))+" lines")
  if not proof["phone_inventory_verified"]:
   proof["blockers"].append("Acoustic ZIP lacks unique verified Kaldi phones.txt symbol table; inspect model metadata explicitly before comparing phones")
  else:
   # Kaldi table may include disambiguation / positional variants; only raw intersection reported.
   acoustic=set(proof["acoustic_symbol_table"]["symbols"]);dictionary=set(phones)
   proof["literal_symbol_comparison"]={"dictionary_not_in_acoustic":sorted(dictionary-acoustic),"acoustic_not_in_dictionary":sorted(acoustic-dictionary)}
   proof["dictionary_phone_schema_verified"]=not bool(dictionary-acoustic)
   if not proof["dictionary_phone_schema_verified"]:proof["blockers"].append("Dictionary symbols not a direct subset of raw acoustic symbol table; require validated MFA mapping")
  proof["blockers"].append("TAIWAN STOCK actual spoken realization not verified; do not approve candidate reading")
 except Exception as e:proof["blockers"].append("BLOCKED: "+str(e))
 out.write_text(json.dumps(proof,ensure_ascii=False,indent=2)+"\n")
 if any(s.startswith("BLOCKED:") for s in proof["blockers"]):raise SystemExit(2)
 print("PHONE_SCHEMA_RESEARCH_WRITTEN phones_verified="+str(proof["phone_inventory_verified"])+" alignment=false")
if __name__=="__main__":main()
