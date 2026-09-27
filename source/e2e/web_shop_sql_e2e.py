#!/usr/bin/env python3
"""Rollback-only PostgreSQL contract tests in a random isolated schema.
Requires an authorized management token in ~/.secrets. No production business rows
are read or written: projections go to a QA sink; synthetic Auth rows also roll back.
"""
from pathlib import Path
import json,re,urllib.request,urllib.error,uuid,sys
root=Path(__file__).resolve().parents[2]
ref=re.search(r"url: 'https://([^.]+)",(root/'source/js/cloud.js').read_text()).group(1)
token=Path('/home/user/.secrets/supabase_access_token').read_text().strip()
qa='web_shop_qa_'+uuid.uuid4().hex[:8]
sql=(root/'supabase/web_shop.sql').read_text().rsplit('commit;',1)[0]
sql=sql.replace('web_shop',qa).replace('public.web_store',qa+'.catalogue_sink')
anchor='create schema if not exists '+qa+';'
sql=sql.replace(anchor,anchor+'\ncreate table '+qa+'.catalogue_sink (like public.web_store including all);',1)
sql+='\n'+(root/'source/e2e/web_shop_contract.sql').read_text().replace('web_shop',qa)+'\nrollback;'
req=urllib.request.Request('https://api.supabase.com/v1/projects/'+ref+'/database/query',headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'},data=json.dumps({'query':sql}).encode(),method='POST')
try:
 with urllib.request.urlopen(req,timeout=90) as r: print(r.read().decode())
except urllib.error.HTTPError as e:
 print('SQL contract failure:',e.code,e.read().decode()[:7000]);sys.exit(1)
