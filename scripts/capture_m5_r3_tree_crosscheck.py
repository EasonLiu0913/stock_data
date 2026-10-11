#!/usr/bin/env python3
"""Research-only pinned HF tree/siblings comparison; metadata APIs only, no resolve/raw/weights."""
import hashlib,json,pathlib,re,time,urllib.parse,urllib.request
from collections import Counter
BASE=pathlib.Path("m5-r3-tree-proof"); BASE.mkdir(exist_ok=True)
SOURCES={"Qwen/Qwen3-ASR-0.6B":"5eb144179a02acc5e5ba31e748d22b0cf3e303b0","Qwen/Qwen3-ForcedAligner-0.6B":"c7cbfc2048c462b0d63a45797104fc9db3ad62b7","Systran/faster-whisper-small":"536b0662742c02347bc0e980a01041f333bce120","funasr/paraformer-zh":"d7811ee3ac581fbcfdeb37c98c6ba674028433dc"}
def api(url):
 assert url.startswith("https://huggingface.co/api/models/") and ("?blobs=true" in url or "/tree/" in url)
 req=urllib.request.Request(url,headers={"Accept":"application/json","User-Agent":"M5-R3-metadata-audit/1"})
 with urllib.request.urlopen(req,timeout=20) as resp:
  assert resp.status==200 and "json" in resp.headers.get("Content-Type","")
  body=resp.read(2000001); assert len(body)<=2000000
 return json.loads(body)
proof={"schema":"M5-R3-TREE-CROSSCHECK-v1","time_utc":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"metadata_only":True,"model_download_bytes":0,"repos":[],"release_gate":"BLOCKED"}
for name,sha in SOURCES.items():
 x={"repository":name,"revision":sha,"tree_matches_siblings":False,"ordinary_git_file_sha256_complete":False,"weight_license_approved":False,"errors":[]}
 try:
  pinned=api("https://huggingface.co/api/models/"+name+"/revision/"+sha+"?blobs=true")
  assert pinned.get("sha")==sha
  siblings=pinned["siblings"]; assert isinstance(siblings,list) and siblings
  # Hugging Face tree endpoint provides paginated records with Link rel=next; bounded pages.
  base="https://huggingface.co/api/models/"+name+"/tree/"+sha+"?recursive=true&expand=true"
  url=base; entries=[]; visited=set()
  for _ in range(12):
   assert url not in visited;visited.add(url)
   req=urllib.request.Request(url,headers={"Accept":"application/json","User-Agent":"M5-R3-metadata-audit/1"})
   with urllib.request.urlopen(req,timeout=20) as response:
    assert response.status==200 and "json" in response.headers.get("Content-Type","")
    body=response.read(2000001); assert len(body)<=2000000
    chunk=json.loads(body); assert isinstance(chunk,list);entries+=chunk
    link=response.headers.get("Link",""); nexturl=None
    for part in link.split(","):
     if 'rel="next"' in part:
      m=re.search(r'<([^>]+)>',part)
      if m: nexturl=m.group(1)
   if not nexturl: break
   assert nexturl.startswith("https://huggingface.co/api/models/"+name+"/tree/"+sha+"?");url=nexturl
  else: raise ValueError("pagination exceeded")
  files=[e for e in entries if e.get("type")=="file"]
  def path(v): return v.get("rfilename",v.get("path"))
  sp={path(y):y for y in siblings};tp={path(y):y for y in files}
  assert len(sp)==len(siblings) and len(tp)==len(files)
  x["sibling_count"]=len(sp);x["tree_file_count"]=len(tp);x["tree_entry_count"]=len(entries)
  x["tree_matches_siblings"]=set(sp)==set(tp)
  x["missing_in_tree"]=sorted(set(sp)-set(tp));x["extra_in_tree"]=sorted(set(tp)-set(sp))
  x["files"]=[]
  for p in sorted(set(sp)&set(tp)):
   a,b=sp[p],tp[p]
   l=a.get("lfs") or {}; l2=b.get("lfs") or {}
   sha256=l.get("sha256") or (l2.get("oid") if re.fullmatch("[0-9a-f]{64}",str(l2.get("oid",""))) else None)
   blob=a.get("blobId") or b.get("oid")
   x["files"].append({"path":p,"upstream_lfs_sha256":sha256,"upstream_git_object_id":blob,"local_sha256_verified":False})
  x["tree_metadata_consistency_pass"]=x["tree_matches_siblings"]
 except Exception as exc:x["errors"].append(type(exc).__name__+":"+str(exc)[:120])
 proof["repos"].append(x)
raw=(json.dumps(proof,ensure_ascii=False,indent=2)+"\n").encode();(BASE/"tree-proof.json").write_bytes(raw)
(BASE/"tree-proof.sha256").write_text(hashlib.sha256(raw).hexdigest()+"  tree-proof.json\n")
print("M5_R3_TREE_METADATA_ONLY matched="+str(sum(q["tree_matches_siblings"] for q in proof["repos"]))+"/4 models_downloaded=0 ordinary_git_sha256_verified=false release=BLOCKED")
