#!/usr/bin/env python3
"""Metadata-only research capture. No model download, import, installation or inference."""
import hashlib, json, os, pathlib, re, shutil, time, urllib.request
OUT=pathlib.Path("m5-r3-metadata-proof"); OUT.mkdir(exist_ok=True)
MODELS=["Qwen/Qwen3-ASR-0.6B","Qwen/Qwen3-ForcedAligner-0.6B","Systran/faster-whisper-small","funasr/paraformer-zh"]
def get(url):
    assert url.startswith("https://huggingface.co/api/models/") and ("?blobs=true" in url)
    req=urllib.request.Request(url,headers={"User-Agent":"M5-R3-metadata-only-research/1.0","Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=20) as res:
        assert res.status==200 and "json" in res.headers.get("Content-Type","")
        raw=res.read(2_000_001); assert len(raw)<=2_000_000, "metadata too large"
    return json.loads(raw)
results={"schema":"M5-R3-OFFICIAL-METADATA-CAPTURE-v1","captured_at_utc":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"metadata_only":True,"downloaded_weight_bytes":0,"snapshots":[],"runner":{}}
for name in MODELS:
    try:
        root=get("https://huggingface.co/api/models/"+name+"?blobs=true")
        rev=root.get("sha")
        assert isinstance(rev,str) and re.fullmatch("[0-9a-f]{40}",rev)
        pinned=get("https://huggingface.co/api/models/"+name+"/revision/"+rev+"?blobs=true")
        assert pinned.get("sha")==rev
        entries=pinned.get("siblings")
        assert isinstance(entries,list) and entries
        items=[]
        for e in entries:
            path=e["rfilename"]; assert isinstance(path,str) and not path.startswith("/") and ".." not in pathlib.PurePosixPath(path).parts
            lfs=e.get("lfs") or {}
            digest=lfs.get("sha256")
            blob=e.get("blobId")
            size=e.get("size",lfs.get("size"))
            items.append({"path":path,"size_bytes":size,"lfs_sha256":digest,"git_blob_id":blob,"upstream_digest_present":bool(digest or blob)})
        assert len(items)==len({e["path"] for e in items})
        result={"repo":name,"revision":rev,"official_api_url":"https://huggingface.co/api/models/"+name+"/revision/"+rev+"?blobs=true","license_metadata":pinned.get("cardData",{}).get("license") if isinstance(pinned.get("cardData"),dict) else None,"manifest":sorted(items,key=lambda x:x["path"]),"manifest_count":len(items),"every_file_has_upstream_digest":all(x["upstream_digest_present"] for x in items),"review_approved":False}
        results["snapshots"].append(result)
    except Exception as e:
        results["snapshots"].append({"repo":name,"status":"CAPTURE_FAILED","error":type(e).__name__,"revision":None,"manifest":[],"review_approved":False})
# No model binaries, no downloads; this only measures the empty CI environment.
mem={}
for line in pathlib.Path("/proc/meminfo").read_text().splitlines():
    if line.startswith(("MemTotal:","MemAvailable:")):
        k,v=line.split(":",1); mem[k]=int(v.strip().split()[0])*1024
disk=shutil.disk_usage(".")
results["runner"]={"cpu_count_reported":os.cpu_count(),"mem_total_bytes":mem.get("MemTotal"),"mem_available_bytes":mem.get("MemAvailable"),"disk_total_bytes":disk.total,"disk_free_bytes":disk.free,"measured_model_runtime":False,"fit_approved":False}
p=OUT/"metadata.json";raw=(json.dumps(results,ensure_ascii=False,indent=2)+"\n").encode();p.write_bytes(raw)
(OUT/"metadata.sha256").write_text(hashlib.sha256(raw).hexdigest()+"  metadata.json\n")
print("M5_R3_METADATA_CAPTURE_ONLY repositories="+str(len(results["snapshots"]))+" pinned="+str(sum(bool(x.get("revision")) for x in results["snapshots"]))+" model_downloads=0 inference=false release=BLOCKED")
