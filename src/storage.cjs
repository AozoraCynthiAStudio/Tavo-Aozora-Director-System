'use strict';
function createStore(tavo,core){
  let chatId=null,epoch=0,queue=Promise.resolve();
  const prefix='aozora_director_v1';
  async function bind(){const chat=await tavo.chat.current();const next=String(chat?.id||'');if(!next)throw Error('当前聊天尚未就绪');if(chatId!==next){chatId=next;epoch++;}return token();}
  function token(){return {chatId,epoch};}
  async function guard(t){const chat=await tavo.chat.current();if(!t||String(chat?.id)!==t.chatId||t.epoch!==epoch)throw Error('聊天已切换，请返回原聊天继续');}
  async function get(name,scope='chat',fallback=null){const raw=await tavo.variable.get(prefix+'.'+name,scope);if(raw===undefined||raw===null||raw==='')return fallback;if(typeof raw==='string'){try{return JSON.parse(raw);}catch{return fallback;}}return raw;}
  async function set(name,value,scope='chat',t=token()){return write(async()=>{await guard(t);return tavo.variable.set(prefix+'.'+name,value,scope);});}
  function write(fn){const result=queue.catch(()=>{}).then(fn);queue=result.catch(()=>{});return result;}
  function filename(mid){return 'ad_record_'+encodeURIComponent(String(mid)).replace(/%/g,'_')+'.json';}
  async function readRecord(mid){if(!await tavo.file.exists(filename(mid),{scope:'chat'}))return null;const raw=await tavo.file.load(filename(mid),{encoding:'utf8',scope:'chat'});if(!raw)return null;try{return typeof raw==='string'?JSON.parse(raw):raw;}catch{throw Error('图片记录格式损坏');}}
  async function mutateRecord(mid,fn,t=token()){
    return write(async()=>{
      await guard(t);let current=await readRecord(mid)||{messageId:String(mid),chatId:t.chatId,images:[],status:'idle'};
      await guard(t);const next=await fn(structuredClone(current));if(!next)return current;
      const saved=await tavo.file.save(filename(mid),JSON.stringify(next),{encoding:'utf8',scope:'chat'});if(!saved)throw Error('记录文件保存未确认');
      await guard(t);const proof=await readRecord(mid);if(!proof||JSON.stringify(proof)!==JSON.stringify(next))throw Error('记录回读不一致');
      let index=await get('index','chat',[]);index=index.filter(x=>String(x.messageId)!==String(mid));index.unshift({messageId:String(mid),count:next.images.length,updatedAt:Date.now(),kind:next.kind,status:next.status});
      await guard(t);await tavo.variable.set(prefix+'.index',index,'chat');return proof;
    });
  }
  async function removeRecord(mid,t=token()){return write(async()=>{await guard(t);const current=await readRecord(mid);let index=await get('index','chat',[]);await guard(t);await tavo.variable.set(prefix+'.index',index.filter(x=>String(x.messageId)!==String(mid)),'chat');if(await tavo.file.exists(filename(mid),{scope:'chat'})){await guard(t);await tavo.file.delete(filename(mid),{scope:'chat'});}return current;});}
  return {bind,token,guard,get,set,readRecord,mutateRecord,removeRecord,write,close(){epoch++;chatId=null;}};
}
if(typeof module!=='undefined')module.exports={createStore};
