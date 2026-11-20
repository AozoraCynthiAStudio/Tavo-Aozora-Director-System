from pathlib import Path
exec(Path(__file__).with_name('tavo_probe.py').read_text(encoding='utf-8').split('init=rpc(')[0])
rpc('initialize',{'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'Aozora-contract-debug','version':'0.1'}})
selected=[x for x in rpc('tools/list')['tools'] if any(v in x['name'] for v in ['image','config','capabilit'])];save('image-contract-tools.json',selected)
print(json.dumps([{'name':x['name'],'description':x.get('description','')} for x in selected],ensure_ascii=False))
try:
 resources=rpc('resources/list');save('image-contract-resources.json',resources);print('RESOURCES',json.dumps(resources,ensure_ascii=False)[:7000])
except Exception as error:print('NO_RESOURCE_LIST',str(error))
