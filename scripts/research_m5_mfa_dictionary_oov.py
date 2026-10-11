#!/usr/bin/env python3
"""Research-only authentic asset and original-offset dictionary audit; never emits pronunciations."""
import argparse,hashlib,json,pathlib,zipfile
ASSETS={"acoustic":("pretrained_models/acoustic/mandarin_mfa.zip","c4c91c499ada0de35346481d4af69c7328075ddb0ce16a8cfb19fc74d0401199"),"dictionary":("pretrained_models/dictionary/mandarin_china_mfa.dict","0881d4e338e26509d022992cb5b897ead24a176448f534481238cb3a7fe949f0"),"g2p":("pretrained_models/g2p/mandarin_china_mfa.zip","005a9cc869d606a19ae3338cdcdd283c8b6384968cfed76c0e30fa58137a6034")}
AUDIO="b29ab56784279c000a73e5174736c9d3d4eea7f2b330ce7d69f1919cdaee7a2a"
def digest(p):
 h=hashlib.sha256()
 with open(p,"rb") as f:
  for b in iter(lambda:f.read(1048576),b""):h.update(b)
 return h.hexdigest()
def main():
 ap=argparse.ArgumentParser()
 for name in ("model_root","audio_zip","ledger","output"):ap.add_argument("--"+name.replace("_","-"),required=True)
 a=ap.parse_args();out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
 p={"contract":"M5-DICTIONARY-OOV-RESEARCH-v1","publication_authorized":False,"acoustic_sentence_boundary_verified":False,"forced_alignment_executed":False,"oov_review_complete":False,"model_assets_verified":False,"items":[],"blockers":[]}
 try:
  root=pathlib.Path(a.model_root)
  for typ,(rel,want) in ASSETS.items():
   file=root/rel
   if not file.is_file() or not file.stat().st_size or digest(file)!=want:raise ValueError("missing/mismatched authentic "+typ)
  p["model_assets_verified"]=True
  if digest(a.audio_zip)!=AUDIO:raise ValueError("authentic audio ZIP mismatch")
  with zipfile.ZipFile(a.audio_zip) as z:source=json.loads(z.read("source.json"))
  if source.get("publication_authorized") is not False:raise ValueError("publication lock altered")
  scenes=source["scenes"];ledger=json.loads(pathlib.Path(a.ledger).read_text())["items"]
  if len(scenes)!=7 or len(ledger)!=22:raise ValueError("scene/ledger count mismatch")
  lex={}
  with open(root/ASSETS["dictionary"][0],encoding="utf-8-sig") as f:
   for line in f:
    fields=line.rstrip("\n").split("\t")
    if len(fields)>1:lex[fields[0]]=lex.get(fields[0],0)+1
  for i,item in enumerate(ledger):
   scene=scenes[item["scene"]-1];token=item["source_span"]
   if scene["speech_text"][item["source_start"]:item["source_end"]]!=token:raise ValueError("original source offset mismatch at "+str(i))
   p["items"].append({"index":i,"scene":item["scene"],"source_span":token,"original_offset":[item["source_start"],item["source_end"]],"literal_dictionary_entries":lex.get(token,0),"literal_dictionary_status":"PRESENT" if token in lex else "ABSENT_LITERAL_ONLY","normalized_span":None,"pronunciation":None,"human_reviewed":False,"status":"PENDING_REVIEW"})
  p["blockers"]=["Literal absence is not confirmed normalized/tokenized OOV","Traditional/Simplified reversible mapping, TAIWAN STOCK spoken reading, pronunciations and phone inventory require independent approval"]
 except Exception as e:p["blockers"].append("BLOCKED: "+str(e))
 finally:(out/"dictionary-oov-proof.json").write_text(json.dumps(p,ensure_ascii=False,indent=2)+"\n")
 if not p["model_assets_verified"] or len(p["items"])!=22:raise SystemExit(2)
 print("PRIVATE_DICTIONARY_AUDIT_COMPLETE occurrences=22 pronunciations_approved=0 forced_alignment=false")
if __name__=="__main__":main()
