import json,sys,pathlib
def validate(provenance, output):
    claims={x['claim_id']:x for x in provenance['items']}
    assert len(claims)==11 and len(provenance['roster'])==55
    assert output['target_date']==provenance['target_date']=='20261012'
    assert output['production']=='DENY_ALL' and output['publication_authorized'] is False
    assert len(output['stocks'])==55
    for s,base in zip(output['stocks'],provenance['roster']):
        assert s['code']==base['code']
        assert s['catalyst_status']=='UNVERIFIED'
        assert s['news_state']==base['news_state']
        assert s['claim_ids']==base['claim_ids']
        assert len(s['assertions'])==len(s['claim_ids'])
        assert [z['claim_id'] for z in s['assertions']]==s['claim_ids']
        for z in s['assertions']:
            assert z['claim_id'] in claims
            c=claims[z['claim_id']]
            assert c['ai_use'] is True and c['causal_allowed'] is False
            for key in ('code','url','source_date','publisher','evidence_kind'):
                assert z[key]==c[key]
            assert z['statement']==c['allowed_statement']
            assert z['causal_inference'] is False
    assert not any((x['code'],x['url']) in {(z['code'],z['url']) for z in provenance['denied']} for s in output['stocks'] for x in s['assertions'])
    return True
if __name__=='__main__':
    p=json.loads(pathlib.Path(sys.argv[1]).read_text());o=json.loads(pathlib.Path(sys.argv[2]).read_text())
    validate(p,o)
    print('EXPERIMENT10_CONSUMER_ACCEPT PASS stocks=55 claims=11 production=DENY_ALL')
