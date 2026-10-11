#!/usr/bin/env python3
"""Research-only reversible seven-scene transcript draft and English acoustic-evidence gate."""
import argparse,hashlib,json,pathlib,re,unicodedata,zipfile
from opencc import OpenCC
EXPECTED="b29ab56784279c000a73e5174736c9d3d4eea7f2b330ce7d69f1919cdaee7a2a"
def digest(b):return hashlib.sha256(b).hexdigest()
def kind(ch):
 if ch.isspace():return "space"
 if "LATIN" in unicodedata.name(ch,"") or ch.isascii() and ch.isalpha():return "latin"
 if "\u4e00"<=ch<="\u9fff":return "han"
 if ch.isdigit():return "numeric"
 return "punctuation_or_other"
def main():
 ap=argparse.ArgumentParser()
 for key in ("audio_zip","lexical_proof","phone_proof","output"):ap.add_argument("--"+key.replace("_","-"),required=True)
 a=ap.parse_args();out=pathlib.Path(a.output);out.parent.mkdir(parents=True,exist_ok=True)
 proof={"contract":"M5-SEVEN-SCENE-REVERSIBLE-DRAFT-v1","pronunciation_approved":False,"publication_authorized":False,"acoustic_sentence_boundary_verified":False,"forced_alignment_executed":False,"internal_boundaries_verified":0,"english_actual_spoken_reading_verified":False,"scenes":[],"blockers":[]}
 try:
  raw=pathlib.Path(a.audio_zip).read_bytes()
  if digest(raw)!=EXPECTED:raise ValueError("source zip hash mismatch")
  lex=json.loads(pathlib.Path(a.lexical_proof).read_text());phones=json.loads(pathlib.Path(a.phone_proof).read_text())
  if not lex["model_assets_verified"] or not phones["phone_inventory_verified"] or not phones["dictionary_phone_schema_verified"]:raise ValueError("authentic MFA evidence not established")
  byscene={}
  for item in lex["items"]:
   byscene.setdefault(item["scene"],[]).append(item)
  if len(lex["items"])!=22:raise ValueError("OOV ledger count")
  cc=OpenCC("t2s")
  with zipfile.ZipFile(a.audio_zip) as z:
   src=json.loads(z.read("source.json"))
   if src.get("publication_authorized") is not False or len(src["scenes"])!=7:raise ValueError("source lock/scene count")
   for scene_no,s in enumerate(src["scenes"],1):
    original=s["speech_text"]
    if original!=s["caption_text"] or original!=s["display_text"]:raise ValueError("source transcript mismatch")
    if scene_no==1 and original!="大家好，歡迎來到 TAIWAN STOCK！":raise ValueError("immutable first opening mismatch")
    audio=z.read(f"audio/{scene_no:02d}.mp3")
    spans=[];pos=0
    while pos<len(original):
     typ=kind(original[pos]);end=pos+1
     while end<len(original) and kind(original[end])==typ:end+=1
     token=original[pos:end];norm=cc.convert(token) if typ=="han" else token
     chars=[{"source_offset":pos+j,"source_char":ch,"mapped":cc.convert(ch) if typ=="han" else ch} for j,ch in enumerate(token)]
     reversible=all(len(x["mapped"])==1 for x in chars) and "".join(x["mapped"] for x in chars)==norm
     spans.append({"original_start":pos,"original_end":end,"original":token,"type":typ,"draft_normalized":norm,"normalization":"OpenCC t2s" if typ=="han" else "identity","one_to_one":reversible,"source_character_map":chars,"approved_mfa_token":None,"approved_pronunciation":None,"review_status":"PENDING"})
     pos=end
    if "".join(t["original"] for t in spans)!=original or any(not x["one_to_one"] for x in spans):raise ValueError("nonreversible token span")
    observed=[]
    for item in byscene.get(scene_no,[]):
     token=original[item["original_offset"][0]:item["original_offset"][1]]
     if token!=item["source_span"]:raise ValueError("ledger occurrence mismatch")
     observed.append({"source_span":token,"offset":item["original_offset"],"normalized":item["normalized_span"],"normalized_dictionary_entries":item["normalized_dictionary_entries"],"dictionary_raw_fields":item["normalized_raw_dictionary_fields"],"pronunciation_approved":False})
    proof["scenes"].append({"scene":scene_no,"speech_text":original,"source_utf8_sha256":digest(original.encode()),"original_mp3_sha256":digest(audio),"original_zip_audio_member":f"audio/{scene_no:02d}.mp3","draft_spans":spans,"ledger_occurrences":observed,"approved_mfa_transcript":None,"human_review_complete":False})
  opener=proof["scenes"][0]
  eng=[t for t in opener["draft_spans"] if t["type"]=="latin"]
  if [t["original"] for t in eng]!=["TAIWAN","STOCK"]:raise ValueError("opening English terms not exactly preserved")
  proof["english_acoustic_evidence"]={"source_scene":1,"original_audio_sha256":opener["original_mp3_sha256"],"source_exact":"大家好，歡迎來到 TAIWAN STOCK！","english_tokens":[{"token":t["original"],"original_offset":[t["original_start"],t["original_end"]],"dictionary_exact_entry":0,"observed_spoken_reading":None,"auditory_evidence":None,"phone_sequence":None,"human_verified":False} for t in eng],"reading_hypotheses":[],"acoustic_analysis_executed":False,"status":"BLOCKED_PENDING_INDEPENDENT_ORIGINAL_AUDIO_REVIEW"}
  proof["blockers"]=["Draft spans are reversible source partition, NOT approved linguistic word segmentation","Original scene-1 audio must be independently reviewed for actual TAIWAN STOCK spoken realization; no default English or spelled-letter hypothesis","22 dictionary evidence occurrences are not final word-level pronunciation approvals","No MFA alignment or 15 subtitle-boundary evidence"]
 except Exception as e:proof["blockers"].append("BLOCKED: "+str(e))
 out.write_text(json.dumps(proof,ensure_ascii=False,indent=2)+"\n")
 if len(proof["scenes"])!=7 or any(s.startswith("BLOCKED:") for s in proof["blockers"]):raise SystemExit(2)
 print("REVERSIBLE_DRAFT scenes=7 english_reading_approved=false alignment=false")
if __name__=="__main__":main()
