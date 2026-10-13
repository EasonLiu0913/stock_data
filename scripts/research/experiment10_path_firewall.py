#!/usr/bin/env python3
"""Experiment10 fail-closed path-specific GitHub Actions side-effect firewall."""
import fnmatch, json, pathlib, re, hashlib, sys
import yaml
ROOT=pathlib.Path('.'); TARGETS=['recovery-requests/experiment-10/manifest.json','recovery-requests/experiment-10/news-batch-1516-1563.json','recovery-requests/experiment-10/ai-batch-1516-1563.json','recovery-requests/experiment-10/news-full-20261012.json','recovery-requests/experiment-10/ai-full-20261012.json','recovery-requests/experiment-10/validation.json']; BRANCH='research/daily-data-recovery-v2-exp01-20261013'
def arr(v):
 if v is None:return []
 return v if isinstance(v,list) else [v]
def pat(s, val):
 s=str(s);return fnmatch.fnmatchcase(val,s) or (s.endswith('/**') and val.startswith(s[:-3]+'/'))
def selected(spec,val,default):
 if spec is None:return default
 if isinstance(spec,dict):
  positives=arr(spec.get('branches',spec.get('paths',[])))
  excludes=arr(spec.get('branches-ignore',spec.get('paths-ignore',[])))
 else:positives=arr(spec);excludes=[]
 if positives and not any(pat(x,val) for x in positives):return False
 return not any(pat(x,val) for x in excludes)
def analyze(text,name):
 try: d=yaml.load(text,Loader=yaml.BaseLoader)
 except Exception as e:return {'file':name,'decision':'BLOCKED','reason':'YAML_PARSE_ERROR '+str(e)}
 if not isinstance(d,dict):return {'file':name,'decision':'BLOCKED','reason':'NOT_MAPPING'}
 on=d.get('on',{})
 if isinstance(on,str):on={on:None}
 if isinstance(on,list):on={x:None for x in on}
 if not isinstance(on,dict):return {'file':name,'decision':'BLOCKED','reason':'UNKNOWN_ON'}
 blockers=[];observed=[]
 for event in ('push','pull_request_target','workflow_run','repository_dispatch','workflow_dispatch','schedule'):
  if event not in on:continue
  spec=on[event];observed.append(event)
  if event=='push':
   if spec is None: blockers.append('UNFILTERED_PUSH');continue
   if not isinstance(spec,dict):blockers.append('UNKNOWN_PUSH_FILTER');continue
   if selected({'branches':spec.get('branches',[]),'branches-ignore':spec.get('branches-ignore',[])},BRANCH,True) and any(selected({'paths':spec.get('paths',[]),'paths-ignore':spec.get('paths-ignore',[])},target,True) for target in TARGETS):
    blockers.append('MATCHING_PUSH')
 # Other event families are not inherently caused by a contents push; inspect only potential push listener and its secondary effects.
 return {'file':name,'decision':'BLOCKED' if blockers else 'NON_MATCHING_PUSH','events':observed,'reason':blockers}
def main():
 docs=[]
 for p in sorted(ROOT.glob('.github/workflows/*.y*ml')):
  raw=p.read_bytes();rec=analyze(raw.decode('utf8'),str(p));rec['git_sha256']=hashlib.sha256(raw).hexdigest();docs.append(rec)
 assert len(docs)>=200, 'workflow scan unexpectedly incomplete'
 negatives=[
 ('unfiltered', 'on: {push: null}', 'BLOCKED'),
 ('exact', 'on:\\n  push:\\n    branches: [research/daily-data-recovery-v2-exp01-20261013]\\n    paths: [recovery-requests/experiment-10/**]', 'BLOCKED'),
 ('main_only','on:\\n  push:\\n    branches: [main]\\n    paths: [recovery-requests/experiment-10/**]','NON_MATCHING_PUSH'),
 ('other_path','on:\\n  push:\\n    branches: [research/daily-data-recovery-v2-exp01-20261013]\\n    paths: [recovery-requests/experiment-08/**]','NON_MATCHING_PUSH'),
 ]
 for name,t,expected in negatives:
  t=t.replace('\\n','\n');got=analyze(t,name)['decision'];assert got==expected,(name,got,expected)
 blocked=[x for x in docs if x['decision']=='BLOCKED']
 state={'schema':'experiment10-path-firewall-v1','target_branch':BRANCH,'target_prefix':'recovery-requests/experiment-10/','tested_paths':TARGETS,'workflow_count':len(docs),'negative_tests':len(negatives),'blocked':blocked,'workflow_manifest':docs,'production_safe_paths':[],'production':'DENY_ALL','decision':'PASS_RESEARCH_ONLY' if not blocked else 'BLOCKED'}
 out=ROOT/'tmp/research/experiment10-audit';out.mkdir(parents=True,exist_ok=True);(out/'audit.json').write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n')
 print('EXPERIMENT_10_PATH_AUDIT '+json.dumps({'decision':state['decision'],'workflows':len(docs),'negative_tests':len(negatives),'blockers':len(blocked),'production_safe_paths':0}))
 if blocked:sys.exit(2)
if __name__=='__main__':main()
