from pathlib import Path
exec((Path(__file__).with_name('tavo_probe.py')).read_text(encoding='utf-8').split('init=rpc(')[0])
rpc('initialize',{'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'Aozora-UI-diagnostic','version':'0.1'}})
available=rpc('tools/list')['tools']
selected=[t for t in available if any(word in t['name'] for word in ['plugin','log','render','setting','webview','console'])]
save('ui-diagnostic-tools.json',selected)
print(json.dumps([{'name':t['name'],'description':t.get('description','')[:130]} for t in selected],ensure_ascii=False))
chat=call('tavo_current_chat_get',{});print('CURRENT_CHAT_KEYS',list(chat));print('CHAT_FIELDS',list(chat.get('chat',chat)));print('CHAT_ID',chat.get('chat',chat).get('id'))
plugin=call('tavo_plugin_get',{'pluginId':'com.aozora.director'});save('ui-plugin-state.json',plugin);print('PLUGIN_META',{k:v for k,v in plugin.items() if isinstance(v,(str,int,bool))})
runtime=call('tavo_plugin_get_runtime_contributions',{});save('ui-runtime-before-fix.json',runtime)
print('RUNTIME_FRAGMENTS',[{'pluginId':v.get('pluginId'),'id':v.get('id'),'htmlBytes':len(v.get('html',''))} for v in runtime.get('htmlFragmentRuntimeEntries',[])])
