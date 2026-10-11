#!/usr/bin/env python3
import json,sys
from pathlib import Path
source=json.loads(Path(sys.argv[1]).read_text())
review=json.loads(Path(sys.argv[2]).read_text())
assert source["publication_authorized"] is False
assert review["source_video_sha256"]==source["source_video_sha256"]
assert review["reviewer"] and review["reviewed_at"]
assert len(review["scenes"])==7
assert [x["scene"] for x in review["scenes"]]==list(range(1,8))
assert all(x["result"] in ("pass","fail","needs_review") for x in review["scenes"])
assert isinstance(review["scene06_join_listened"],bool)
passed=all(x["result"]=="pass" for x in review["scenes"]) and review["scene06_join_listened"]
print(json.dumps(dict(status="HUMAN_REVIEW_ATTESTATION_RECORDED" if passed else "HUMAN_REVIEW_NOT_PASSED",human_attested_pass=passed,publication_authorized=False,subtitle_sync_certified=False)))
if not passed:sys.exit(1)
