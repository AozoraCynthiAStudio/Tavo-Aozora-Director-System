from pathlib import Path
exec(Path(__file__).with_name('tavo_probe.py').read_text(encoding='utf-8').split('init=rpc(')[0])
rpc('initialize',{'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'Aozora-image-debug','version':'0.1'}})
available=rpc('tools/list')['tools'];filetools=[t for t in available if t['name'].startswith('tavo_file_')];save('image-debug-tools.json',filetools)
for t in filetools:
 if t['name'] in ['tavo_file_list','tavo_file_load','tavo_file_url']:print(json.dumps(t,ensure_ascii=False))
chat=call('tavo_current_chat_get',{})['chat'];cid=chat['id'];print('CHAT',cid)
index=call('tavo_variable_get',{'scope':'chat','chatId':cid,'name':'aozora_director_v1.index'});save('image-debug-index.json',index);print('INDEX',json.dumps(index,ensure_ascii=False))
listing=call('tavo_file_list',{'chatId':cid,'options':{'scope':'chat','limit':200}});save('image-debug-files.json',listing);print('LIST_KEYS',list(listing));items=listing.get('files',listing.get('items',[]));print('AD_FILES',[x for x in items if 'ad_' in x.get('name','') or 'ad_' in x.get('path','')])
