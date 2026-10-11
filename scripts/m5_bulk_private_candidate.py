#!/usr/bin/env python3
"""Private candidate SRT; preserve original audio; RMS is never declared true alignment."""
import argparse,array,hashlib,io,json,math,pathlib,re,subprocess,urllib.request,zipfile
ARTIFACT_ID=11697447563
ZIP_SHA="b29ab56784279c000a73e5174736c9d3d4eea7f2b330ce7d69f1919cdaee7a2a"
def sha(b):return hashlib.sha256(b).hexdigest()
def fetch(token):
 url="https://api.github.com/repos/EasonLiu0913/stock_data/actions/artifacts/"+str(ARTIFACT_ID)+"/zip"
 req=urllib.request.Request(url,headers={"Authorization":"Bearer "+token,"Accept":"application/vnd.github+json","User-Agent":"m5-private-audio-research"})
 with urllib.request.urlopen(req,timeout=40) as res:
  b=res.read(6000001);assert len(b)<6000001,"bounded artifact exceeded"
 assert sha(b)==ZIP_SHA,"original artifact ZIP SHA256 mismatch"
 z=zipfile.ZipFile(io.BytesIO(b))
 names=set(z.namelist());expect={"source.json","audio/audio-proof.json"}|{"audio/%02d.mp3"%i for i in range(1,8)}
 assert expect<=names
 return {p:z.read(p) for p in expect}
def parts(t):
 p=[x.strip() for x in re.findall(r'[^。！？!?]+[。！？!?]?',t) if x.strip()]
 assert "".join(p)==t
 return p
def rms(mp3):
 p=subprocess.run(["ffmpeg","-v","error","-i","pipe:0","-ac","1","-ar","16000","-f","s16le","pipe:1"],input=mp3,capture_output=True,check=True)
 x=array.array("h");x.frombytes(p.stdout);n=320
 return [math.sqrt(sum(v*v for v in x[i:i+n])/max(1,len(x[i:i+n]))) for i in range(0,len(x),n)]
def boundaries(p,r):
 if len(p)<2:return []
 d=len(r);n=sum(map(len,p));ans=[];last=0
 for j in range(1,len(p)):
  guess=round(d*sum(map(len,p[:j]))/n);lo=max(last+4,guess-round(d*.12));hi=min(d-4,guess+round(d*.12))
  if hi<=lo:k=max(last+1,min(d-1,guess))
  else:k=min(range(lo,hi),key=lambda q:(sum(r[max(0,q-2):min(d,q+3)])/len(r[max(0,q-2):min(d,q+3)]),abs(q-guess)*.0001))
  ans.append(round(k*.02,3));last=k
 return ans
def stamp(t):
 ms=round(t*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000)
 return f"{h:02}:{m:02}:{s:02},{ms:03}"
def run(files,out):
 src=json.loads(files["source.json"]);proof=json.loads(files["audio/audio-proof.json"])
 assert len(src["scenes"])==len(proof["scenes"])==7 and proof["measured_total_audio_seconds"]==79.416
 assert src["scenes"][0]["speech_text"]=="大家好，歡迎來到 TAIWAN STOCK！"
 pos=0.;entries=[];audits=[]
 for scene,audio in zip(src["scenes"],proof["scenes"]):
  assert scene["scene"]==audio["scene"] and scene["speech_text"]==scene["caption_text"]==scene["display_text"]==audio["spoken_text"]
  b=files["audio/%02d.mp3"%audio["scene"]];assert sha(b)==audio["mp3_sha256"]
  ss=parts(scene["speech_text"]);edges=boundaries(ss,rms(b));ts=[0]+edges+[audio["duration_seconds"]]
  for i,text in enumerate(ss):
   start=pos+ts[i];end=pos+ts[i+1];assert end>start
   entries.append((start,end,text))
  audits.append({"scene":scene["scene"],"audio_sha256":sha(b),"sentence_count":len(ss),"candidate_boundaries_local_seconds":edges,"acoustically_verified_boundaries":0})
  pos+=audio["duration_seconds"]
 assert round(pos,3)==79.416 and entries[0][2]=="大家好，歡迎來到 TAIWAN STOCK！"
 assert "".join(x[2] for x in entries)=="".join(x["speech_text"] for x in src["scenes"])
 srt="\n\n".join(f"{i}\n{stamp(a)} --> {stamp(b)}\n{t}" for i,(a,b,t) in enumerate(entries,1))+"\n"
 report={"schema":"M5-BULK-CANDIDATE-v1","audio_original_artifact_id":ARTIFACT_ID,"audio_zip_sha256":ZIP_SHA,"source_json_sha256":sha(files["source.json"]),"scenes":audits,"scene_count":7,"duration_seconds":79.416,"srt_blocks":len(entries),"srt_sha256":sha(srt.encode()),"text_exact_match":True,"fixed_opening_unsplit":True,"candidate_method":"20ms RMS local minima guided by sentence text lengths; hypothesis, NOT acoustic verification","verified_internal_boundaries":"0/15","model_weights_downloaded":False,"model_inference_executed":False,"pronunciation_approved":False,"forced_alignment_executed":False,"acoustic_sentence_boundary_verified":False,"publication_authorized":False,"prompt_b_eligible":False,"release_gate":"BLOCKED"}
 out.mkdir(parents=True,exist_ok=True);(out/"candidate.srt").write_text(srt);(out/"proof.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
 print(f"M5_BULK_PRIVATE_CANDIDATE_PASS scenes=7 duration=79.416 blocks={len(entries)} exact_text=true opening_unsplit=true verified_boundaries=0/15 release=BLOCKED")
def main():
 p=argparse.ArgumentParser();p.add_argument("--input-zip");p.add_argument("--github-token");p.add_argument("--output",required=True);a=p.parse_args()
 if a.input_zip:
  b=pathlib.Path(a.input_zip).read_bytes();assert sha(b)==ZIP_SHA;z=zipfile.ZipFile(io.BytesIO(b));files={k:z.read(k) for k in ["source.json","audio/audio-proof.json"]+["audio/%02d.mp3"%i for i in range(1,8)]}
 else:
  assert a.github_token;files=fetch(a.github_token)
 run(files,pathlib.Path(a.output))
if __name__=="__main__":main()
