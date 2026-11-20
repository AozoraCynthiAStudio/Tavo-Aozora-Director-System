"""Local Tavo MCP: audit/package and optional one-image interface validation. No UI automation."""
import os, json, urllib.request, sys, base64, struct, zlib, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dist';OUT.mkdir(exist_ok=True)
VERSION=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
PACKAGE=OUT/('Aozora_Director_'+VERSION+'.tpg')
token=os.environ['ADIRECTOR_MCP_TOKEN']
session=''; counter=0
def rpc(method,params=None):
    global session,counter
    counter+=1; payload={'jsonrpc':'2.0','id':counter,'method':method}
    if params is not None:payload['params']=params
    headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json, text/event-stream'}
    if session:headers['Mcp-Session-Id']=session
    req=urllib.request.Request('http://127.0.0.1:7347/mcp',json.dumps(payload,ensure_ascii=False).encode(),headers)
    with urllib.request.urlopen(req,timeout=180) as response:
        session=response.headers.get('Mcp-Session-Id',session);raw=response.read().decode()
    if raw.lstrip().startswith('data:'):raw='\n'.join(s[5:].strip() for s in raw.splitlines() if s.startswith('data:'))
    obj=json.loads(raw)
    if obj.get('error'):raise RuntimeError(obj['error'])
    return obj['result']
def call(name,arguments):
    value=rpc('tools/call',{'name':name,'arguments':arguments})
    if value.get('isError'):raise RuntimeError(value.get('content'))
    texts=[x['text'] for x in value.get('content',[]) if x.get('type')=='text']
    if len(texts)==1:
        try:return json.loads(texts[0])
        except json.JSONDecodeError:return texts[0]
    return value
def save(name,value):
    (OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
init=rpc('initialize',{'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'Aozora-Director-MVP','version':'0.1.0'}})
print('CONNECTED',init['serverInfo'],flush=True)
if '--probe-image' in sys.argv:
    chat=call('tavo_current_chat_get',{})
    current=chat.get('chat',chat);chat_id=int(current['id'])
    options={'saveAs':'ad_mvp_interface_probe.png','scope':'chat','aspectRatio':'16:9','extraBody':{'seed':123456,'v4_prompt':{'caption':{'base_caption':'2girls, a quiet train station, side by side, warm light, clean illustration','char_captions':[{'char_caption':'girl, black hair, green eyes, red coat, on the left','centers':[]},{'char_caption':'girl, blonde hair, blue eyes, blue coat, on the right','centers':[]}]},'use_coords':False,'use_order':True}}}
    if '--baseline' in sys.argv:options={'saveAs':'ad_mvp_baseline_probe.png','scope':'chat'}
    save('live-probe-request-baseline.json' if '--baseline' in sys.argv else 'live-probe-request-nai.json',{'chatId':chat_id,'prompt':'2girls, a quiet train station, side by side, warm light, clean illustration','options':options})
    try:result=call('tavo_image_generate',{'chatId':chat_id,'prompt':'2girls, a quiet train station, side by side, warm light, clean illustration','options':options})
    except Exception as error:
        save('live-probe-error-baseline.json' if '--baseline' in sys.argv else 'live-probe-error-nai.json',{'error':str(error),'options':options,'route':'MCP only','newImageConfirmed':False})
        print('IMAGE_FAILED',str(error),flush=True);sys.exit(2)
    save('live-probe-result.json',result);print('IMAGE_RESULT',json.dumps(result,ensure_ascii=False)[:1800],flush=True)
    pointer=result.get('path') if isinstance(result,dict) else None
    if pointer:
        raw=call('tavo_file_load',{'chatId':chat_id,'name':pointer.rsplit('/',1)[-1],'options':{'scope':'chat','encoding':'base64'}})
        if isinstance(raw,dict):
            print('FILE_FIELDS',list(raw),flush=True)
            data=raw.get('content') or raw.get('data') or raw.get('base64')
        else:data=raw
        if isinstance(data,str):
            content=base64.b64decode(data.split(',',1)[-1] if data.startswith('data:') else data)
            (OUT/'live-probe-image.png').write_bytes(content)
            metadata={};dims=None
            if content.startswith(b'\x89PNG\r\n\x1a\n'):
                at=8
                while at+12<=len(content):
                    size=struct.unpack('>I',content[at:at+4])[0];kind=content[at+4:at+8];chunk=content[at+8:at+8+size]
                    if kind==b'IHDR':dims=struct.unpack('>II',chunk[:8])
                    if kind in [b'tEXt',b'zTXt']:
                        name,_,value=chunk.partition(b'\0')
                        if kind==b'zTXt':value=zlib.decompress(value[1:])
                        text=value.decode('utf-8',errors='replace')
                        try:metadata[name.decode()]=json.loads(text)
                        except json.JSONDecodeError:metadata[name.decode()]=text
                    at+=size+12
            report={'dimensions':dims,'sha256':hashlib.sha256(content).hexdigest(),'metadata':metadata,'actualModelsCalled':True,'route':'MCP image API only; not plugin hooks','requestSeed':123456,'samplingParametersOverridden':False,'dataBytes':len(content)}
            save('live-probe-metadata.json',report);print('IMAGE_FILE',{'dimensions':dims,'metadataKeys':list(metadata),'bytes':len(content)},flush=True)
else:
    audit=call('tavo_plugin_audit',{'sourcePath':str(OUT/'plugin')});save('tavo-audit.json',audit)
    issues=audit.get('localizationAudit',{}).get('issues',[])
    print('AUDIT',{'ok':audit.get('ok'),'assetAudit':audit.get('assetAudit'),'warnings':len([x for x in issues if x.get('severity')=='warning'])},flush=True)
    package=call('tavo_plugin_package',{'sourcePath':str(OUT/'plugin'),'outputPath':str(PACKAGE),'includeZipBase64':False});save('tavo-package.json',package)
    print('PACKAGED',json.dumps({k:v for k,v in package.items() if k not in ['localizationAudit','manifest','zipBase64']},ensure_ascii=False)[:1200],flush=True)
    if '--install' in sys.argv:
        install=call('tavo_plugin_install',{'zipPath':str(PACKAGE)});save('tavo-install.json',install);print('INSTALLED',json.dumps(install,ensure_ascii=False)[:800],flush=True)
        contributions=call('tavo_plugin_get_runtime_contributions',{});save('tavo-contributions.json',contributions)
