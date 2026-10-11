#!/usr/bin/env python3
"""Research-only SRT draft from authenticated pre-existing audio artifact. Timing is estimated, NOT forced alignment."""
import hashlib,json,pathlib,re,sys,zipfile
archive=pathlib.Path(sys.argv[1]); dest=pathlib.Path(sys.argv[2]);dest.mkdir(parents=True,exist_ok=True)
EXPECTED="b29ab56784279c000a73e5174736c9d3d4eea7f2b330ce7d69f1919cdaee7a2a"
assert hashlib.sha256(archive.read_bytes()).hexdigest()==EXPECTED,"WRONG_ARCHIVE_SHA"
with zipfile.ZipFile(archive) as z:
 names=set(z.namelist());proof=json.loads(z.read("audio/audio-proof.json"));src=json.loads(z.read("source.json"))
 assert proof["target_date"]==src["target_date"]=="20261008" and len(proof["scenes"])==len(src["scenes"])==7
 assert proof["voice"]=="zh-TW-YunJheNeural" and proof["rate"]=="+15%"
 assert proof["publication_authorized"] is False and src["publication_authorized"] is False
 assert proof["target_60_to_90_seconds_pass"] is True
 durations=[];checks=[]
 for i,(a,s) in enumerate(zip(proof["scenes"],src["scenes"]),1):
  assert a["scene"]==s["scene"]==i
  assert a["spoken_text"]==s["speech_text"]==s["caption_text"]==s["display_text"]
  name="audio/"+a["filename"];assert name in names
  assert hashlib.sha256(z.read(name)).hexdigest()==a["mp3_sha256"]
  durations.append(float(a["duration_seconds"]));checks.append({"scene":i,"mp3_sha256":a["mp3_sha256"]})
 assert abs(sum(durations)-proof["measured_total_audio_seconds"])<0.001
 assert abs(sum(durations)-79.416)<0.002
def segments(t):
 # Every character preserved; punctuation stays with its sentence.
 out=[]
 for piece in re.findall(r"[^。！？!?；;]+[。！？!?；;]?|[。！？!?；;]",t):
  if not piece:continue
  if len(piece)<=30:out.append(piece);continue
  while len(piece)>30:
   out.append(piece[:30]);piece=piece[30:]
  if piece:out.append(piece)
 assert "".join(out)==t
 return out
def stamp(ms):
 ms=round(ms);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000)
 return f"{h:02}:{m:02}:{s:02},{ms:03}"
entries=[];bounds=[];clock=0.
for a,s,d in zip(proof["scenes"],src["scenes"],durations):
 start=clock;end=start+d;pieces=segments(s["caption_text"]);total=sum(len(x) for x in pieces)
 pos=start
 for j,t in enumerate(pieces):
  nxt=end if j==len(pieces)-1 else pos+d*len(t)/total
  entries.append((pos,nxt,t,a["scene"]));pos=nxt
 bounds.append({"scene":a["scene"],"start":round(start,3),"end":round(end,3),"duration":d})
 clock=end
assert len(entries)>7 and all(0<=x[0]<x[1]<=bounds[x[3]-1]["end"]+1e-7 for x in entries)
assert all("".join(x[2] for x in entries if x[3]==s["scene"])==s["speech_text"] for s in src["scenes"])
srt="\n\n".join(f"{i}\n{stamp(st*1000)} --> {stamp(en*1000)}\n{t}" for i,(st,en,t,scene) in enumerate(entries,1))+"\n"
(dest/"private-preview.srt").write_text(srt,encoding="utf-8")
e={"contract":"M5-V3-PRIVATE-ESTIMATED-SRT-v1","target_date":"20261008","audio_artifact_id":11697447563,"audio_zip_sha256":EXPECTED,"voice":proof["voice"],"rate":proof["rate"],"source_sha256":src["source_sha256"],"scene_boundaries":bounds,"subtitle_block_count":len(entries),"source_audio_total_seconds":proof["measured_total_audio_seconds"],"srt_last_end_seconds":round(clock,3),"text_exact_match_to_script":True,"all_blocks_within_scene_bounds":True,"all_mp3_hashes_verified":True,"timing_method":"sentence/punctuation weighted estimate from authentic scene durations, NOT acoustic forced alignment","acoustic_sentence_boundary_verified":False,"timed_srt_generated":True,"mp4_generated":False,"private_media_proof_complete":False,"publication_authorized":False}
(dest/"private-srt-proof.json").write_text(json.dumps(e,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(f"ESTIMATED_SRT_OK blocks={len(entries)} duration={clock:.3f} acoustic_verified=false")
