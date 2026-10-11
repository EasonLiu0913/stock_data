#!/usr/bin/env python3
"""Bounded metadata/legal-text-only audit. Never fetch model, tokenizer, config or weight assets."""
import hashlib,json,pathlib,re,time,urllib.parse,urllib.request
P=pathlib.Path("m5-r3-small-text-proof");P.mkdir(exist_ok=True)
S={"Qwen/Qwen3-ASR-0.6B":"5eb144179a02acc5e5ba31e748d22b0cf3e303b0","Qwen/Qwen3-ForcedAligner-0.6B":"c7cbfc2048c462b0d63a45797104fc9db3ad62b7","Systran/faster-whisper-small":"536b0662742c02347bc0e980a01041f333bce120","funasr/paraformer-zh":"d7811ee3ac581fbcfdeb37c98c6ba674028433dc"}
MAX=131072
def read(url):
 req=urllib.request.Request(url,headers={"User-Agent":"M5-R3-small-text-only/1.0"})
 with urllib.request.urlopen(req,timeout=20) as r:
  assert r.status==200
  data=r.read(MAX+1);assert len(data)<=MAX
 return data
o={"schema":"M5-R3-SMALL-NONWEIGHT-TEXT-v1","captured_utc":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"items":[],"model_weight_downloads":0,"license_approved":False,"release_gate":"BLOCKED"}
for name,rev in S.items():
 api="https://huggingface.co/api/models/"+name+"/revision/"+rev+"?blobs=true"
 try:
  meta=json.loads(read(api));assert meta["sha"]==rev
  for f in meta["siblings"]:
   path=f["rfilename"]
   if path not in ("README.md","LICENSE","LICENSE.md","LICENSE.txt"):continue
   assert not f.get("lfs") and isinstance(f.get("size"),int) and 0<=f["size"]<=MAX
   url="https://huggingface.co/"+name+"/resolve/"+rev+"/"+urllib.parse.quote(path)
   b=read(url)
   blob=hashlib.sha1(b"blob "+str(len(b)).encode()+bytes([0])+b).hexdigest()
   expected=f.get("blobId")
   o["items"].append({"repository":name,"revision":rev,"path":path,"size":len(b),"sha256":hashlib.sha256(b).hexdigest(),"git_blob_sha1_expected":expected,"git_blob_sha1_calculated":blob,"git_blob_match":blob==expected,"content_not_archived":True,"license_review_approved":False})
 except Exception as e:o["items"].append({"repository":name,"revision":rev,"status":"CAPTURE_FAILED","error":type(e).__name__,"license_review_approved":False})
# GitHub official public git blob endpoint yields only pinned 1,075-byte LICENSE text, not model assets.
try:
 url="https://api.github.com/repos/snakers4/silero-vad/git/blobs/0bf5e90cac691b999d4a35044f97167d7bbbf0b9"
 b=read(url); j=json.loads(b)
 import base64
 raw=base64.b64decode(j["content"]);assert len(raw)==1075 and j["sha"]=="0bf5e90cac691b999d4a35044f97167d7bbbf0b9"
 calc=hashlib.sha1(b"blob "+str(len(raw)).encode()+bytes([0])+raw).hexdigest()
 o["items"].append({"repository":"snakers4/silero-vad","revision":"1e261b036686cd0017d500ee96acd1c4ba572a9d","path":"LICENSE","size":len(raw),"sha256":hashlib.sha256(raw).hexdigest(),"git_blob_sha1_expected":j["sha"],"git_blob_sha1_calculated":calc,"git_blob_match":calc==j["sha"],"content_not_archived":True,"license_review_approved":False})
except Exception as e:o["items"].append({"repository":"snakers4/silero-vad","path":"LICENSE","status":"CAPTURE_FAILED","error":type(e).__name__,"license_review_approved":False})
b=(json.dumps(o,ensure_ascii=False,indent=2)+"\n").encode();(P/"small-text.json").write_bytes(b);(P/"small-text.sha256").write_text(hashlib.sha256(b).hexdigest()+"  small-text.json\n")
print("M5_R3_NONWEIGHT_TEXT_ONLY captured="+str(sum(bool(x.get("sha256")) for x in o["items"]))+" weight_downloads=0 license_approved=false release=BLOCKED")
