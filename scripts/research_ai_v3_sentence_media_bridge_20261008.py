#!/usr/bin/env python3
"""Research-only V3 sentence audio to caption/card timeline; no rendering or publishing."""
import hashlib,json,pathlib,sys
root=pathlib.Path(sys.argv[1]); source=json.loads((root/"source.json").read_text()); proof=json.loads((root/"audio"/"audio-proof.json").read_text())
assert proof["contract"]=="AI_V3_SENTENCE_AUDIO_RESEARCH_ONLY"
assert proof["research_master_sha256"]==source["research_master_sha256"]
assert proof["publication_authorized"] is False and proof["mp4_generated"] is False
assert len(proof["sentences"])==21
assert [len(p["speech_sentences"]) for p in source["media_input"]]==[4,5,3,3,3,3]
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
assert n==21 and proof["opening_30_to_90_seconds_pass"] is True
bridge={"contract":"AI_V3_SENTENCE_MEDIA_BRIDGE_RESEARCH_ONLY","target_date":"20261008","research_master_sha256":proof["research_master_sha256"],"voice":proof["voice"],"rate":proof["rate"],"total_seconds":round(cursor,3),"sentences":timeline,"publication_authorized":False,"render_authorized":False,"timed_srt_generated":False,"mp4_generated":False}
(root/"media-bridge.json").write_text(json.dumps(bridge,ensure_ascii=False,indent=2)+"\n")
print(f"V3_MEDIA_BRIDGE_PASS sentences={n} total_seconds={cursor:.3f} no_srt=true no_render=true no_publish=true")
