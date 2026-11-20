from pathlib import Path
import json,re,datetime
out=Path(__file__).resolve().parents[1]/'dist'
messages={str(x['id']):x for x in json.loads((out/'live-messages.json').read_text(encoding='utf-8'))['items']}
requests=json.loads((out/'live-requests.json').read_text(encoding='utf-8'))['value']
print('PROFILES',json.dumps(json.loads((out/'live-profiles.json').read_text(encoding='utf-8'))['value'],ensure_ascii=False))
for file in out.glob('live-record-*.json'):
 raw=json.loads(file.read_text(encoding='utf-8'))['content'];r=json.loads(raw) if isinstance(raw,str) else raw;mid=str(r['messageId']);request=requests.get(r.get('requestId'),{});m=messages.get(mid,{})
 print('RECORD',mid,'STATUS',r.get('status'),'ERROR',r.get('error'),'IMAGES',len(r.get('images',[])),'CREATED',request.get('createdAt'),'MSG_TIME',m.get('timestamp'))
 print('PLAN',json.dumps(r.get('plan'),ensure_ascii=False))
 text=re.sub(r'<!--ad-director:.*?-->','',m.get('content',''),flags=re.S).strip();print('PROSE',text[:1800])
 for image in r.get('images',[])[-1:]:
  print('IMAGE',json.dumps({k:image.get(k) for k in ['id','pointer','createdAt','seed','seedSource','providerFields']},ensure_ascii=False))
  print('PROMPT',image.get('prompt'));print('OPTIONS',json.dumps(image.get('options'),ensure_ascii=False))
