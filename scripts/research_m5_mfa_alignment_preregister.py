#!/usr/bin/env python3
"""Immutable seven-scene alignment PRE-REGISTRATION ONLY; never synthesize or align."""
import argparse,hashlib,json,pathlib,zipfile
AUDIO_SHA="b29ab56784279c000a73e5174736c9d3d4eea7f2b330ce7d69f1919cdaee7a2a"
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument("--audio-zip",required=True);p.add_argument("--output",required=True);a=p.parse_args()
 raw=pathlib.Path(a.audio_zip).read_bytes()
 if sha(raw)!=AUDIO_SHA:raise SystemExit("BLOCKED: original artifact hash mismatch")
 with zipfile.ZipFile(a.audio_zip) as z:
  src=json.loads(z.read("source.json"));proof=json.loads(z.read("audio/audio-proof.json"))
  if src["publication_authorized"] is not False or len(src["scenes"])!=7:raise SystemExit("BLOCKED: release lock or scene count")
  entries=[]
  for i,s in enumerate(src["scenes"],1):
   audio=z.read(f"audio/{i:02d}.mp3")
   if not (s["speech_text"]==s["caption_text"]==s["display_text"]):raise SystemExit("BLOCKED: transcript mismatch")
   if i==1 and s["speech_text"]!="大家好，歡迎來到 TAIWAN STOCK！":raise SystemExit("BLOCKED: fixed intro altered")
   entries.append({"scene":i,"source_speech_text":s["speech_text"],"source_utf8_sha256":sha(s["speech_text"].encode()),"mp3_sha256":sha(audio),"audio_path_in_original_zip":f"audio/{i:02d}.mp3","approved_mfa_transcript":None,"transcript_tokenization_approved":False,"pronunciation_review_complete":False,"alignment_executed":False,"word_intervals":None,"phone_intervals":None})
 out={"contract":"M5-MFA-SEVEN-SCENE-PREREGISTRATION-v1","source_audio_zip_sha256":AUDIO_SHA,"scene_count":7,"scenes":entries,"internal_caption_boundaries_expected":15,"internal_caption_boundaries_verified":0,"forced_alignment_executed":False,"acoustic_sentence_boundary_verified":False,"publication_authorized":False,"blockers":["TAIWAN STOCK actual spoken pronunciation not approved","Lexicon phone and optional weight schema review pending","Reversible normalized complete seven-scene transcripts not approved","No MFA align authorized by this preregistration"]}
 dest=pathlib.Path(a.output);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n")
 print("PREREGISTRATION_ONLY scenes=7 alignment=false boundaries_verified=0")
if __name__=="__main__":main()
