#!/usr/bin/env python3
"""Bundle already-accepted original audio + estimated captions for OFFLINE PRIVATE PREVIEW only."""
import argparse,hashlib,json,pathlib,re,shutil
SRT_SHA="1daf7a269c0a39ab8c9bab59048c6c36293ce5ee5a9e878bb8971f689126271f"
OPEN="大家好，歡迎來到 TAIWAN STOCK！"
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument("--original",type=pathlib.Path,required=True);p.add_argument("--candidate",type=pathlib.Path,required=True);p.add_argument("--out",type=pathlib.Path,required=True);a=p.parse_args()
 src=json.loads((a.original/"source.json").read_text());pr=json.loads((a.original/"audio/audio-proof.json").read_text())
 proof=json.loads((a.candidate/"proof.json").read_text());srt=(a.candidate/"candidate.srt").read_bytes();assert hashlib.sha256(srt).hexdigest()==SRT_SHA==proof["srt_sha256"]
 lines=srt.decode("utf-8").strip().split("\n\n");blocks=[]
 for i,b in enumerate(lines,1):
  rows=b.splitlines();assert len(rows)>=3 and int(rows[0])==i; assert re.fullmatch(r"\d\d:\d\d:\d\d,\d{3} --> \d\d:\d\d:\d\d,\d{3}",rows[1]);blocks.append("\n".join(rows[2:]))
 assert len(blocks)==14 and blocks[0]==OPEN
 assert "".join(blocks)=="".join(x["speech_text"] for x in src["scenes"])
 assert len(src["scenes"])==len(pr["scenes"])==7 and pr["measured_total_audio_seconds"]==79.416
 assert proof["verified_internal_boundaries"]=="0/15" and proof["release_gate"]=="BLOCKED" and proof["publication_authorized"] is False
 a.out.mkdir(parents=True,exist_ok=True);aud=a.out/"audio";aud.mkdir(exist_ok=True)
 rec=[]
 for sc,pf in zip(src["scenes"],pr["scenes"]):
  assert sc["scene"]==pf["scene"] and sc["speech_text"]==sc["caption_text"]==sc["display_text"]==pf["spoken_text"]
  fp=a.original/("audio/%02d.mp3"%sc["scene"]);assert digest(fp)==pf["mp3_sha256"];dest=aud/fp.name;shutil.copyfile(fp,dest);rec.append({"scene":sc["scene"],"sha256":digest(dest),"duration_seconds":pf["duration_seconds"]})
 (a.out/"candidate.srt").write_bytes(srt)
 manifest={"schema":"M5-PRIVATE-PREVIEW-HANDOFF-v1","status":"PRIVATE_OFFLINE_PREVIEW_READY_NOT_ACOUSTICALLY_VERIFIED","timing_status":"TIMING_ESTIMATED_NOT_SYNC_VERIFIED","origin_run":38151900627,"origin_artifact":11707176177,"source_audio_artifact":11697447563,"audio":rec,"duration_seconds":79.416,"srt_sha256":SRT_SHA,"blocks":14,"fixed_opening_unsplit":True,"text_exact_match":True,"actual_acoustic_boundaries":"0/15","release_gate":"BLOCKED","locks":{"model_inference_authorized":False,"pronunciation_approved":False,"forced_alignment_executed":False,"acoustic_sentence_boundary_verified":False,"publication_authorized":False,"prompt_b_eligible":False},"no_youtube":True,"no_production":True}
 (a.out/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
 print("M5_PRIVATE_PREVIEW_HANDOFF_PASS scenes=7 cues=14 duration=79.416 timing=ESTIMATED acoustic=0/15 release=BLOCKED")
if __name__=="__main__":main()
