"""One standalone diagnostic artifact; never edits a narrative message or retries."""
from pathlib import Path
exec(Path(__file__).with_name('tavo_probe.py').read_text(encoding='utf-8').split('init=rpc(')[0])
import time
rpc('initialize',{'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'Aozora-prompt-transport-check','version':VERSION}})
chat=call('tavo_current_chat_get',{})['chat'];cid=chat['id'];name='ad_alpha5_transport_'+str(int(time.time()))+'.png'
prompt='1girl, cafe interior, daytime, holding a blue mug, simple illustration | girl, adult woman, black hair, high ponytail, green eyes, red coat, holding a blue mug with both hands'
request={'chatId':cid,'prompt':prompt,'options':{'saveAs':name,'scope':'chat','timeout':60000}}
save('transport-probe-request.json',request);started=time.time();print('SUBMIT_ONE_DIAGNOSTIC',name,flush=True)
try:
 result=call('tavo_image_generate',request);save('transport-probe-result.json',result);print('RESULT',json.dumps(result,ensure_ascii=False)[:700],flush=True)
 path=result.get('path') if isinstance(result,dict) else result
 if not path:raise RuntimeError('No durable image path')
 data=call('tavo_file_load',{'chatId':cid,'name':str(path).split('/')[-1],'options':{'scope':'chat','encoding':'base64'}})['content'];content=base64.b64decode(data);(OUT/'private-transport-probe.png').write_bytes(content)
 metadata={};at=8
 while content.startswith(b'\x89PNG') and at+12<=len(content):
  length=int.from_bytes(content[at:at+4],'big');kind=content[at+4:at+8];chunk=content[at+8:at+8+length]
  if kind==b'tEXt' and b'\0'in chunk:
   key,value=chunk.split(b'\0',1);metadata[key.decode('latin1')]=value.decode('utf-8','replace')
  at+=length+12
 parsed=json.loads(metadata.get('Comment','{}'));caption=parsed.get('v4_prompt',{}).get('caption',{});used=' '.join([parsed.get('prompt',''),caption.get('base_caption','')]+[c.get('char_caption','') for c in caption.get('char_captions',[])])
 report={'status':'returned','elapsedSeconds':round(time.time()-started,2),'path':path,'source':metadata.get('Source'),'generationSeconds':metadata.get('Generation_time'),'actualPrompt':parsed.get('prompt'),'actualBase':caption.get('base_caption'),'actualCharacterPrompts':caption.get('char_captions',[]),'traitsInMetadata':{word:word in used for word in ['black hair','high ponytail','green eyes','red coat','blue mug']},'scope':'Direct Tavo image API; no main-dialogue hook or visual-quality acceptance'}
 save('transport-probe-report.json',report);print('TRANSPORT_CHECK',json.dumps(report,ensure_ascii=False),flush=True)
except Exception as error:
 save('transport-probe-report.json',{'status':'unconfirmed','error':str(error),'elapsedSeconds':round(time.time()-started,2),'autoRetried':False});print('DIAGNOSTIC_FAILED',str(error),flush=True);sys.exit(2)
