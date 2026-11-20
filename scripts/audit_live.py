from pathlib import Path
exec(Path(__file__).with_name('tavo_probe.py').read_text(encoding='utf-8').split('init=rpc(')[0])
rpc('initialize',{'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'Aozora-live-audit','version':'0.1'}})
ts=rpc('tools/list')['tools'];selected=[t for t in ts if 'chat' in t['name'] and any(v in t['name'] for v in ['search','find','current'])];save('live-audit-tools.json',selected);print(json.dumps(selected,ensure_ascii=False)[:6500])
current=call('tavo_current_chat_get',{})['chat'];cid=current['id'];print('CURRENT',{'id':cid,'name':current.get('name'),'messageCount':current.get('messageCount')})
for name in ['config','pending','requests','index','profiles']:
 result=call('tavo_variable_get',{'scope':'chat','chatId':cid,'name':'aozora_director_v1.'+name});save('live-'+name+'.json',result);print('VAR',name,'found',result.get('found'),'valueType',type(result.get('value')).__name__)
messages=call('tavo_message_find',{'chatId':cid,'range':[-min(12,max(1,current.get('messageCount',12))),-1]});save('live-messages.json',messages)
print('MESSAGE_KEYS',list(messages) if isinstance(messages,dict) else 'list')
print('CONFIG',json.dumps(json.loads((OUT/'live-config.json').read_text(encoding='utf-8')).get('value'),ensure_ascii=False))
index=json.loads((OUT/'live-index.json').read_text(encoding='utf-8')).get('value') or [];print('INDEX',json.dumps(index,ensure_ascii=False))
requests=json.loads((OUT/'live-requests.json').read_text(encoding='utf-8')).get('value') or {}
for key,r in requests.items():print('REQUEST',json.dumps({k:r.get(k) for k in ['id','kind','storyInput','request','targetName','generationId','createdAt']},ensure_ascii=False))
for m in messages.get('items',[]):print('MSG',json.dumps({'id':m.get('id'),'role':m.get('role'),'keys':list(m),'text':str(m.get('content',m.get('text','')))[:450]},ensure_ascii=False))
for row in index[:8]:
 mid=str(row['messageId']);r=call('tavo_file_load',{'chatId':cid,'name':'ad_record_'+mid+'.json','options':{'encoding':'utf8','scope':'chat'}});save('live-record-'+mid+'.json',r);print('RECORD',mid,'keys',list(r) if isinstance(r,dict) else type(r).__name__)
if '--images' in sys.argv:
 for mid in [str(row['messageId']) for row in index[:3] if row.get('count',0)>0]:
  raw=json.loads((OUT/('live-record-'+mid+'.json')).read_text(encoding='utf-8'))['content'];record=json.loads(raw) if isinstance(raw,str) else raw
  image=record['images'][-1];pointer=image['pointer'];loaded=call('tavo_file_load',{'chatId':cid,'name':pointer.split('/')[-1],'options':{'scope':'chat','encoding':'base64'}})
  data=loaded.get('content','');data=re.sub(r'^data:[^,]*,','',data) if 're' in globals() else data
  content=base64.b64decode(data);(OUT/('private-live-image-'+mid+'.png')).write_bytes(content)
  metadata={};at=8
  if content.startswith(b'\x89PNG'):
   while at+12<=len(content):
    size=int.from_bytes(content[at:at+4],'big');kind=content[at+4:at+8];chunk=content[at+8:at+8+size]
    if kind==b'tEXt' and b'\0'in chunk:
     name,value=chunk.split(b'\0',1);metadata[name.decode('latin1')]=value.decode('utf-8','replace')
    if kind==b'zTXt' and b'\0'in chunk:
     name,value=chunk.split(b'\0',1)
     try:metadata[name.decode('latin1')]=zlib.decompress(value[1:]).decode('utf-8','replace')
     except Exception:pass
    at+=size+12
  save('private-live-metadata-'+mid+'.json',metadata);print('IMAGE_FILE',mid,len(content),'METADATA',json.dumps(metadata,ensure_ascii=False)[:6500])
