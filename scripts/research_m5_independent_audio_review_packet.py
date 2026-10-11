#!/usr/bin/env python3
"""Manual research-only evidence pack: no ASR, inferred pronunciation or alignment."""
import argparse,hashlib,json,pathlib,zipfile,collections
from opencc import OpenCC
ZIP_SHA="b29ab56784279c000a73e5174736c9d3d4eea7f2b330ce7d69f1919cdaee7a2a"
MP3_SHA="a84daf97cb8036d78d942d734fb0b9b4d0b0e7c45164d48d5bdb57e50c6f26aa"
DICT_SHA="0881d4e338e26509d022992cb5b897ead24a176448f534481238cb3a7fe949f0"
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 p=argparse.ArgumentParser()
 for name in ("audio_zip","dictionary","draft","phone_proof","output"):p.add_argument("--"+name.replace("_","-"),required=True)
 a=p.parse_args();out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
 b=pathlib.Path(a.audio_zip).read_bytes()
 if sha(b)!=ZIP_SHA:raise SystemExit("BLOCKED original artifact")
 with zipfile.ZipFile(a.audio_zip) as z:
  audio=z.read("audio/01.mp3");source=json.loads(z.read("source.json"))
 if sha(audio)!=MP3_SHA or source["scenes"][0]["speech_text"]!="大家好，歡迎來到 TAIWAN STOCK！":raise SystemExit("BLOCKED scene1 provenance")
 raw=pathlib.Path(a.dictionary).read_bytes()
 if sha(raw)!=DICT_SHA:raise SystemExit("BLOCKED dictionary provenance")
 proof=json.loads(pathlib.Path(a.phone_proof).read_text());draft=json.loads(pathlib.Path(a.draft).read_text())
 if not proof["phone_inventory_verified"] or not proof["dictionary_phone_schema_verified"] or len(draft["scenes"])!=7:raise SystemExit("BLOCKED upstream gate")
 phones=set(proof["acoustic_symbol_table"]["symbols"]);lex=collections.defaultdict(list)
 for n,line in enumerate(raw.decode("utf-8-sig").splitlines(),1):
  f=line.split("\t")
  if len(f)!=6:raise SystemExit("BLOCKED dictionary shape line "+str(n))
  ph=f[5].split()
  if not ph or not set(ph)<=phones:raise SystemExit("BLOCKED unsupported phones line "+str(n))
  if len(lex[f[0]])<4:lex[f[0]].append({"line":n,"phones":ph,"numeric_columns":f[1:5]})
 cc=OpenCC("t2s");scenes=[]
 for scene in draft["scenes"]:
  words=[];coverage=0
  for seg in scene["draft_spans"]:
   original=seg["original"];start=seg["original_start"];normalized=seg["draft_normalized"]
   if seg["type"]=="han":
    i=0
    while i<len(normalized):
     matches=[normalized[i:j] for j in range(i+1,len(normalized)+1) if normalized[i:j] in lex]
     w=max(matches,key=len) if matches else normalized[i];n=len(w)
     words.append({"source_offsets":[start+i,start+i+n],"original":original[i:i+n],"normalized":w,"lexicon_entries":lex.get(w,[]),"phones_compatible":bool(lex.get(w)),"linguistic_token_approved":False,"spoken_pronunciation_approved":False,"status":"EXPLORATORY_DICTIONARY_MATCH" if matches else "UNMATCHED_REVIEW_REQUIRED"})
     coverage+=n;i+=n
   else:
    words.append({"source_offsets":[start,seg["original_end"]],"original":original,"normalized":normalized,"lexicon_entries":lex.get(normalized,[]) if seg["type"]=="latin" else [],"phones_compatible":False,"linguistic_token_approved":False,"spoken_pronunciation_approved":False,"status":"LATIN_REQUIRES_INDEPENDENT_AUDIO_REVIEW" if seg["type"]=="latin" else "NON_SPEECH_OR_NUMERIC_REVIEW_REQUIRED"})
  if "".join(w["original"] for w in words)!=scene["speech_text"]:raise SystemExit("BLOCKED source roundtrip")
  scenes.append({"scene":scene["scene"],"source_utf8_sha256":scene["source_utf8_sha256"],"mp3_sha256":scene["original_mp3_sha256"],"candidate_units":words,"approved_mfa_transcript":None})
 review={"contract":"M5-SCENE1-INDEPENDENT-REVIEW-PACKET-v1","original_zip_sha256":ZIP_SHA,"original_scene1_mp3_sha256":MP3_SHA,"fixed_opening":source["scenes"][0]["speech_text"],"original_audio_member":"audio/01.mp3","review_method":"Independent listening of SHA-verified original MP3; annotate directly observed speech and uncertainty; not source-text copying, RMS interpretation or forced alignment","listen_performed":False,"independent_reviewer":None,"review_timestamp":None,"audio_playback_source_sha256":MP3_SHA,"english_word_observations":[{"source_token":t,"source_offset":offset,"heard_realization":None,"confidence":None,"observed_time_start_s":None,"observed_time_end_s":None,"time_method":None,"notes":None} for t,offset in [("TAIWAN",[9,15]),("STOCK",[16,21])]],"pronunciation_approved":False,"acoustic_sentence_boundary_verified":False,"publication_authorized":False,"forced_alignment_executed":False,"blockers":["No independent auditory review has been performed or supplied","Do not infer spoken realization from fixed written intro or signal RMS","No genuine word boundaries or MFA alignment obtained"]}
 (out/"scene1-independent-review-template.json").write_text(json.dumps(review,ensure_ascii=False,indent=2)+"\n")
 (out/"seven-scene-dictionary-candidates.json").write_text(json.dumps({"contract":"M5-DICTIONARY-CANDIDATE-TOKENS-v1","dictionary_sha256":DICT_SHA,"acoustic_phone_inventory_sha256":proof["acoustic_symbol_table"]["sha256"],"all_units_human_approved":False,"scenes":scenes,"publication_authorized":False,"acoustic_sentence_boundary_verified":False,"forced_alignment_executed":False},ensure_ascii=False,indent=2)+"\n")
 (out/"original-scene01.mp3").write_bytes(audio)
 print("INDEPENDENT_REVIEW_PACKET_CREATED scenes=7 listening=false align=false")
if __name__=="__main__":main()
