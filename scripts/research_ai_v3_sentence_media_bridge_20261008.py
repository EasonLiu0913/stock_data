#!/usr/bin/env python3
"""Research-only V3 sentence audio to caption/card timeline; no rendering or publishing."""
import hashlib,json,pathlib,sys
root=pathlib.Path(sys.argv[1]); source=json.loads((root/"source.json").read_text()); proof=json.loads((root/"audio"/"audio-proof.json").read_text())
assert proof["contract"]=="AI_V3_SENTENCE_AUDIO_RESEARCH_ONLY"
assert proof["research_master_sha256"]==source["research_master_sha256"]
assert proof["publication_authorized"] is False and proof["mp4_generated"] is False
assert all(len(p["speech_sentences"])==len(p["caption_sentences"])>0 for p in source["media_input"])
expected_count=sum(len(p["speech_sentences"]) for p in source["media_input"])
assert len(proof["sentences"])==expected_count
timeline=[]; cursor=0.0; n=0
for scene in source["media_input"]:
 assert scene["claim_ids"]==scene["card_claim_ids"], "scene claim/card mismatch"
 for i,(spoken,caption) in enumerate(zip(scene["speech_sentences"],scene["caption_sentences"]),1):
  item=proof["sentences"][n]; n+=1
  assert item["part"]==scene["id"] and item["sentence"]==i
  assert item["spoken_text"]==spoken and item["caption_text"]==caption
  assert item["claim_ids"]==scene["claim_ids"] and item["card_claim_ids"]==scene["card_claim_ids"]
  path=root/"audio"/item["file"]
  assert path.is_file() and path.stat().st_size>=100
  assert hashlib.sha256(path.read_bytes()).hexdigest()==item["sha256"]
  duration=float(item["duration_seconds"]); assert 0.1<duration<120
  timeline.append({"scene":scene["id"],"sentence":i,"audio_file":item["file"],"audio_sha256":item["sha256"],"start_seconds":round(cursor,3),"end_seconds":round(cursor+duration,3),"spoken_text":spoken,"caption_text":caption,"claim_ids":item["claim_ids"],"card_claim_ids":item["card_claim_ids"]})
  cursor+=duration
assert n==expected_count and proof["opening_30_to_90_seconds_pass"] is True
bridge={"contract":"AI_V3_SENTENCE_MEDIA_BRIDGE_RESEARCH_ONLY","target_date":"20261008","research_master_sha256":proof["research_master_sha256"],"voice":proof["voice"],"rate":proof["rate"],"total_seconds":round(cursor,3),"sentences":timeline,"publication_authorized":False,"render_authorized":False,"timed_srt_generated":False,"mp4_generated":False}
(root/"media-bridge.json").write_text(json.dumps(bridge,ensure_ascii=False,indent=2)+"\n")

def srt_clock(seconds):
 milliseconds=round(seconds*1000)
 hours,remaining=divmod(milliseconds,3600000)
 minutes,remaining=divmod(remaining,60000)
 secs,millis=divmod(remaining,1000)
 return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
assert all(timeline[i]["end_seconds"]<=timeline[i+1]["start_seconds"] for i in range(len(timeline)-1))
assert all(row["caption_text"].strip() for row in timeline)
srt="".join(f'{i}\n{srt_clock(row["start_seconds"])} --> {srt_clock(row["end_seconds"])}\n{row["caption_text"]}\n\n' for i,row in enumerate(timeline,1))
assert srt.count(" --> ")==expected_count
(root/"research-sentence-captions.srt").write_text(srt,encoding="utf-8")
caption_proof={"contract":"AI_V3_RESEARCH_SENTENCE_SRT_ONLY","research_master_sha256":proof["research_master_sha256"],"sentence_count":expected_count,"total_seconds":round(cursor,3),"srt_sha256":hashlib.sha256(srt.encode()).hexdigest(),"publication_authorized":False,"render_authorized":False,"mp4_generated":False}
(root/"research-caption-proof.json").write_text(json.dumps(caption_proof,ensure_ascii=False,indent=2)+"\n")
print(f'V3_RESEARCH_SENTENCE_SRT_PASS blocks={expected_count} total_seconds={cursor:.3f} no_render=true no_publish=true')
print(f"V3_MEDIA_BRIDGE_PASS sentences={n} total_seconds={cursor:.3f} research_srt=true no_render=true no_publish=true")
