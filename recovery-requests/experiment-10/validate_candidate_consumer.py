import json,sys,pathlib
def validate(old,promotion,candidate,output):
    assert len(old['items'])==11 and len(promotion['new_claims'])==6
    assert candidate['items'][:11]==old['items']
    assert candidate['items'][11:]==promotion['new_claims']
    ids=[z['claim_id'] for z in candidate['items']]
    assert ids==['EXP10-20261012-%03d'%i for i in range(1,18)]
    assert len(candidate['original_denied_audit'])==16 and candidate['original_denied_audit']==old['denied']
    assert candidate['promoted_from_prior_denied']==[dict(claim_id=z['claim_id'],code=z['code'],url=z['url'],promotion_sha=candidate['source_promotion_sha']) for z in promotion['new_claims']]
    promoted={(z['code'],z['url']) for z in promotion['new_claims']}
    expected=[z for z in old['denied'] if (z['code'],z['url']) not in promoted]
    expected+= [dict(code=z['code'],url=z['url'],ai_use=False) for z in promotion['rejected_cross_stock_entries']]
    assert candidate['denied']==expected and len(candidate['denied'])==20
    blocked={(z['code'],z['url']) for z in candidate['denied']}
    assert not blocked.intersection((z['code'],z['url']) for z in candidate['items'])
    assert candidate['target_date']==output['target_date']=='20261012'
    assert len(candidate['roster'])==len(output['stocks'])==55
    lookup={z['claim_id']:z for z in candidate['items']}
    assert candidate['production']==output['production']=='DENY_ALL'
    assert candidate['publication_authorized'] is False and output['publication_authorized'] is False
    for base,stock in zip(candidate['roster'],output['stocks']):
        assert base['code']==stock['code']
        assert base['claim_ids']==stock['claim_ids']
        assert base['news_state']==stock['news_state'] and stock['news_state']!='NO_NEWS_EXISTS'
        assert base['catalyst_status']==stock['catalyst_status']=='UNVERIFIED'
        assert [z['claim_id'] for z in stock['assertions']]==stock['claim_ids']
        for a in stock['assertions']:
            c=lookup[a['claim_id']]
            assert c['ai_use'] is True and c['causal_allowed'] is False and a['causal_inference'] is False
            for key in ('code','url','source_date','publisher','evidence_kind'):
                assert a[key]==c[key]
            assert a['statement']==c['allowed_statement']
            assert (a['code'],a['url']) not in blocked
    return True
if __name__=='__main__':
    base=pathlib.Path(sys.argv[1])
    inputs=[json.loads((base/f).read_text()) for f in ('claim-provenance.json','safe-claim-promotion.json','candidate-claim-provenance.json','candidate-consumer-output.json')]
    validate(*inputs)
    print('EXPERIMENT10_ADDITIVE_CONSUMER PASS stocks=55 claims=17')
