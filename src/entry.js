// Host integration only. The build wraps the independent modules above this file.
(function installDirector(tavo){
  'use strict';
  const host=(()=>{try{if(window.top.document)return window.top;}catch{}return window;})();
  if(host.__ADirectorApp?.close)host.__ADirectorApp.close();
  const store=createStore(tavo,Core),provider=createProvider(tavo,Core);
  const notify=(type,detail)=>host.dispatchEvent(new host.CustomEvent('adirector:state',{detail:{type,...detail}}));
  const app=createApp(tavo,Core,store,provider,Assets,notify);host.__ADirectorApp=app;
  host.__ADirectorCore=Core;host.__ADirectorBootError='';
  let ready=app.load().catch(error=>{host.__ADirectorBootError=error.message;app.notice(error.message);throw error;});ready.catch(()=>{});
  const safe=fn=>async event=>{try{await ready;return await fn(event);}catch(error){app.notice(error.message);try{await tavo.utils.toast(error.message);}catch{}}};
  const open=(name,kind)=>{host.__ADirectorPendingCommand={name,kind};host.dispatchEvent(new host.CustomEvent('adirector:command',{detail:{name,kind}}));if(!host.document.getElementById('ad-launcher'))try{Promise.resolve(tavo.utils.toast('Aozora导演系统界面尚未挂载，请重新进入聊天；操作已暂存')).catch(()=>{});}catch{}};
  tavo.plugin.onInputAction('next-director',()=>open('next','story_cg'));
  tavo.plugin.onInputAction('character-director',()=>open('next','character_intro'));
  tavo.plugin.onInputAction('cancel-director',safe(async()=>{const hasTask=!!app.snapshot().pending;if(hasTask)await app.cancelPending();const message=hasTask?'已取消本轮任务':'当前没有待执行任务';app.notice(message);await tavo.utils.toast(message);}));
  tavo.plugin.onSidebarAction('open-settings',()=>open('settings'));
  tavo.plugin.on('generation:prepare',safe(e=>{app.traceText?.('host.generation.prepare',e.text,{generationId:String(e.generationId||''),eventChatId:String(e.chatId||''),source:String(e.source||'')});return app.prepare(e);}));
  // Intentionally no await or host writes on pre-save success critical path.
  tavo.plugin.on('generation:success',e=>{try{app.traceText?.('host.generation.success',e.text,{generationId:String(e.generationId||''),eventChatId:String(e.chatId||'')});app.success(e);app.traceText?.('host.generation.success.after-director',e.text,{generationId:String(e.generationId||''),eventChatId:String(e.chatId||'')});}catch(error){app.trace?.('host.generation.success-handler-error',{generationId:String(e.generationId||''),eventChatId:String(e.chatId||''),error:String(error?.message||error)});app.notice(error.message);}});
  tavo.plugin.on('generation:error',e=>{app.trace?.('host.generation.error',{generationId:String(e.generationId||''),eventChatId:String(e.chatId||''),error:String(e.error?.message||e.error||'')});app.terminal(e);});
  tavo.plugin.on('generation:cancelled',e=>{app.trace?.('host.generation.cancelled',{generationId:String(e.generationId||''),eventChatId:String(e.chatId||'')});app.terminal(e);});
  // A notification must never await image generation or acquire host writes inline.
  const pendingSaves=new Map();
  const finishSave=(key,state)=>{if(state.timer!==null)clearTimeout(state.timer);state.timer=null;if(pendingSaves.get(key)===state)pendingSaves.delete(key);};
  const scheduleSave=(key,state,delay=0)=>{
    if(state.cancelled||pendingSaves.get(key)!==state)return;
    if(state.timer!==null)clearTimeout(state.timer);
    state.timer=host.setTimeout(()=>{state.timer=null;flushSave(key,state);},delay);
  };
  const flushSave=async(key,state)=>{
    if(state.cancelled||pendingSaves.get(key)!==state)return;
    let retry=false;
    try{
      while(state.latest&&!state.cancelled&&pendingSaves.get(key)===state){
        const next=state.latest;state.latest=null;
        await ready;
        if(state.cancelled||pendingSaves.get(key)!==state)break;
        const outcome=await app.onSaved(next);
        if(outcome==='retry'){
          if(!state.latest)state.latest=next;
          retry=true;break;
        }
        state.retryDelay=250;
      }
    }catch(error){if(!state.cancelled)app.notice(error.message);finishSave(key,state);return;}
    if(state.cancelled||pendingSaves.get(key)!==state)return;
    if(retry){const delay=state.retryDelay||250;state.retryDelay=Math.min(delay*2,5000);scheduleSave(key,state,delay);}
    else if(state.latest)scheduleSave(key,state);
    else finishSave(key,state);
  };
  const saved=(eventType,e)=>{
    const message=e.message||e,event={...e,type:eventType,message:{...message},receivedAt:Date.now()},key=String(e.chatId)+':'+String(message?.id);
    try{app.traceText?.('host.'+eventType,message?.content||message?.text||'',{eventChatId:String(e.chatId||''),messageId:String(message?.id||''),role:String(message?.role||''),isUser:!!message?.isUser,generationId:String(e.generationId||''),source:String(e.source||''),queuedWhileSavePending:pendingSaves.has(key)});}catch{}
    const state=pendingSaves.get(key);
    if(state){state.latest=event;if(state.timer!==null)scheduleSave(key,state);return;}
    const next={latest:event,timer:null,retryDelay:250,cancelled:false};pendingSaves.set(key,next);scheduleSave(key,next);
  };
  tavo.plugin.on('message:added',e=>saved('message:added',e));
  tavo.plugin.on('message:updated',e=>saved('message:updated',e));
  tavo.plugin.on('message:deleted',e=>{
    const messageId=e.message?.id||e.messageId,key=String(e.chatId)+':'+String(messageId),state=pendingSaves.get(key);
    if(state){state.cancelled=true;finishSave(key,state);}
    Promise.resolve(ready).then(()=>app.onDeleted(e)).then(async()=>{const current=await tavo.chat.current();if(String(current?.id||'')===String(e.chatId||''))await app.exportDiagnostics?.();}).catch(error=>app.notice(error.message));
  });
  tavo.plugin.on('chat:closed',()=>{for(const [key,state]of pendingSaves){state.cancelled=true;finishSave(key,state);}app.close();});
  tavo.plugin.on('chat:opened',()=>{ready=app.load().then(()=>app.trace?.('host.chat.opened',{})).catch(error=>{app.notice(error.message);throw error;});ready.catch(()=>{});});
})(tavo);
