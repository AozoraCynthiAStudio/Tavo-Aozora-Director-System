'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Core=require('../src/core.cjs');
const {fixture}=require('./helpers/equipment-fixture.cjs');
const empty={HEAD:null,TOP:[],LOWER:null,FULL:null,LEGWEAR:null,FOOTWEAR:null,HAND:null,ACCESSORIES:null};
const plan={scene:'medium shot, one woman, quiet apartment at night, warm lamp light',description:'她坐在灯下。',characters:[{name:'Alice',form:'默认形态',identity:'adult woman, long black hair, dark eyes',equipment:empty}]};

async function saveTurn(f,{generationId,source='reply',text='继续',messageId=2,body='她坐在灯下。',visualId='model-authored-id',valid=true}={}){
 const event={generationId,chatId:1,source,text};
 await f.app.prepare(event);
 const preparedPrompt=event.text;
 const bound=(await f.app.exportDiagnostics()).events.filter(x=>x.event==='generation.prepare.bound'&&x.generationId===generationId).at(-1);
 const visual=valid?Core.VisualProtocol.format({...plan,sourceExcerpt:body},visualId):'<ad-visual id="'+visualId+'">不是有效的视觉方案</ad-visual>';
 event.text='<!--ad-director:'+encodeURIComponent(JSON.stringify({requestId:'spoofed-old-request',plan}))+'-->\n<bubble>'+body+'</bubble>\n'+visual+'\n<ad-wardrobe id="another-model-id">{"updates":[]}</ad-wardrobe>';
 f.app.success(event);
 f.messages.set(messageId,{id:messageId,index:messageId,role:'assistant',content:event.text});
 await f.app.onSaved({chatId:1,message:{id:messageId,role:'assistant'}});
 return {event,preparedPrompt,bound,message:await f.app.getMessage(messageId),record:await f.app.readRecord(messageId)};
}

test('alpha237 visual and wardrobe protocol ids are structural only, including omitted ids',()=>{
 const noId=Core.VisualProtocol.format(plan,'');
 assert.match(noId,/^<ad-visual>/);
 assert.equal(Core.parseVisual(noId,'expected-internal-id').plan.scene,plan.scene);
 const foreign=Core.VisualProtocol.format(plan,'foreign-generation-id');
 assert.equal(Core.parseVisual(foreign,'expected-internal-id').plan.scene,plan.scene);
 assert.deepEqual(Core.Wardrobe.parseUpdates('<ad-wardrobe id="foreign">{"updates":[]}</ad-wardrobe>','expected'),[]);
 assert.deepEqual(Core.Wardrobe.parseUpdates('<ad-wardrobe>{"updates":[]}</ad-wardrobe>','expected'),[]);
 assert.throws(()=>Core.parseVisual(foreign+'\n'+foreign,'expected'),/重复/);
});

test('alpha237 regeneration keeps the Tavo message floor and task id, but rotates the internal request and generation ids',async()=>{
 const f=fixture();await f.app.load();
 f.setInput('继续');await f.app.queueNext({kind:'story_cg'});
 const userText=await f.tavo.input.get();f.messages.set(1,{id:1,role:'user',content:userText});
 const first=await saveTurn(f,{generationId:'g-alpha237-1',source:'reply',text:userText,messageId:2,body:'她坐在灯下。',visualId:'copied-old-id'});
 assert.equal(first.record.status,'done');
 const firstRequestId=first.bound.requestId,taskId=first.bound.taskId;
 assert.equal(Core.readSaved(first.message.content).requestId,firstRequestId,'model-copied internal markers must be stripped before plugin-owned binding');
 assert(firstRequestId);assert.equal(taskId,firstRequestId);
 assert.doesNotMatch(first.preparedPrompt,new RegExp(firstRequestId));
 assert.match(first.preparedPrompt,/id="protocol"/);
 assert.equal((await f.app.saveConfig({adultComicInset:true})).config.adultComicInset,undefined);
 const second=await saveTurn(f,{generationId:'g-alpha237-2',source:'regeneration',text:'',messageId:2,body:'她放下画笔，抬头看向你。',visualId:'a-different-model-id'});
 assert.doesNotMatch(second.preparedPrompt,/localized x-ray overlay|漫画剖面小窗/);
 assert.equal(second.record.status,'done');
 assert.equal(second.record.messageId,'2');
 assert.equal(second.record.generationId,'g-alpha237-2');
 assert.equal(second.record.taskId,taskId);
 assert.notEqual(second.record.requestId,firstRequestId);
 assert.equal(second.bound.taskId,taskId);
 assert.notEqual(second.bound.requestId,firstRequestId);
 assert.equal(f.calls,2);
 assert.match(Core.storyText(second.message.content),/她放下画笔，抬头看向你/);
 f.app.close();
});

test('a broken visual response allows explicit supplement on the original saved reply',async()=>{
 const f=fixture();await f.app.load();
 try{
  f.setInput('继续');await f.app.queueNext({kind:'story_cg',request:'聚焦 Alice'});
  const userText=await f.tavo.input.get();f.messages.set(1,{id:1,role:'user',content:userText});
  let textCalls=0;
  f.tavo.generate=async prompt=>{textCalls++;assert.match(prompt,/聚焦 Alice/);return Core.VisualProtocol.format({...plan,scene:'medium shot, one woman hands over a drawing tablet, quiet apartment at night, warm lamp light',sourceExcerpt:'她完成了画稿，把平板递给你。'},'');};
  const result=await saveTurn(f,{generationId:'g-alpha310-repaired',source:'reply',text:userText,messageId:2,body:'她完成了画稿，把平板递给你。',valid:false});
  assert.equal(result.record.errorCode,'DIRECTOR_PLAN_MISSING');
  assert.equal(textCalls,0);assert.equal(f.calls,0);
  await f.app.supplement(2,'聚焦 Alice');
  assert.equal((await f.app.readRecord(2)).status,'done');
  assert.equal(textCalls,1);assert.equal(f.calls,1);
  assert.equal(Core.storyText(result.message.content),'<bubble>她完成了画稿，把平板递给你。</bubble>');
 }finally{f.app.close();}
});

test('a missed save event records the missing plan without generating',async()=>{
 const f=fixture();await f.app.load();
 try{
  f.setInput('继续');await f.app.queueNext({kind:'story_cg'});
  const userText=await f.tavo.input.get();f.messages.set(1,{id:1,role:'user',content:userText});
  const event={generationId:'g-alpha310-missed-save',chatId:1,source:'reply',text:userText};await f.app.prepare(event);
  event.text='<ad-visual>\n人物：Alice\n外貌：adult woman, dark eyes\n</ad-visual>\n<bubble>她看向窗外。</bubble>';
  f.app.success(event);f.messages.set(2,{id:2,role:'assistant',content:event.text});
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{unsubscribe();reject(Error('saved reply did not report recovery failure'));},4000);
   const unsubscribe=f.app.subscribe(update=>{if(update.record?.errorCode==='DIRECTOR_PLAN_MISSING'){clearTimeout(timer);unsubscribe();resolve();}});
  });
  const record=await f.app.readRecord(2);
  assert.equal(record?.status,'failed');assert.equal(record?.generationId,'g-alpha310-missed-save');
  assert.equal(record?.errorCode,'DIRECTOR_PLAN_MISSING');
  assert.equal(record.plan,null);assert.equal(f.calls,0);assert.equal(f.textCalls,0);
  assert.equal(Core.storyText((await f.app.getMessage(2)).content),'<bubble>她看向窗外。</bubble>');
 }finally{f.app.close();}
});

test('regeneration hides the previous visual during text generation and clears it on same-message replacement',async()=>{
 const f=fixture();
 const events=[];f.app.subscribe(event=>events.push(event));
 await f.app.load();
 try{
  f.setInput('继续');
  await f.app.queueNext({kind:'story_cg'});
  const draft=await f.tavo.input.get();
  f.messages.set(1,{id:1,role:'user',content:draft});
  await saveTurn(f,{generationId:'card-original',text:draft,messageId:2,body:'她看向窗外。'});
  const old=(await f.app.readRecord(2)).images[0].id;
  const cancelled={generationId:'card-cancel',chatId:1,source:'regeneration',messageId:2,text:''};
  await f.app.prepare(cancelled);
  assert.equal(f.app.isRegenerating(2),true);
  assert.equal((await f.app.readRecord(2)).images[0].id,old);
  f.app.terminal({generationId:cancelled.generationId,type:'generation:cancelled'});
  assert.equal(f.app.isRegenerating(2),false);
  assert.equal((await f.app.readRecord(2)).images[0].id,old);
  await f.app.saveConfig({autoGenerate:false});
  await saveTurn(f,{generationId:'card-replacement',source:'regeneration',messageId:2,body:'她重新坐下。'});
  assert.equal(f.app.isRegenerating(2),false);
  assert.deepEqual((await f.app.readRecord(2)).images,[]);
  assert.ok(events.some(event=>event.type==='removed'&&event.replaced&&event.messageId==='2'));
  assert.equal(String(f.app.snapshot().latestMessageId),'2');
 }finally{f.app.close();}
});

