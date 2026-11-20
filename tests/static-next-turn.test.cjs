'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,core}=require('./helpers/equipment-fixture.cjs');

const description='曲曼站在窗边，肩头落着暖色灯光。';
const prose='【静态画面】曲曼站在窗边，暖色灯光落在她的肩头。';
for(const kind of ['character_intro','story_cg']){
 for(const mode of ['normal','block-only','raw-save'])test(kind+' static reply '+mode,async()=>{
  const f=fixture();await f.app.load();
  try{
   const request=await f.app.queueNext(kind==='character_intro'?{kind,targetName:'曲曼'}:{kind});
   const input=await f.tavo.input.get();
   f.messages.set(1,{id:1,role:'user',content:input});
   const prepare={generationId:'static',chatId:1,source:'reply',text:input};
   await f.app.prepare(prepare);
   assert.match(prepare.text,/<\/ad-visual>\s+【静态画面】她在柔和的窗光里回过头。/);
   assert.match(prepare.text,/也必须同时输出视觉块和这段正文/);
   const plan={scene:'medium shot, 1girl, standing by a window in warm light',description,characters:[{name:'曲曼',identity:'adult woman, short black hair',equipment:Object.fromEntries(core.Wardrobe.SLOTS.map(slot=>[slot,null]))}]};
   const raw=core.VisualProtocol.format(plan,'protocol')+(mode==='normal'?'\n\n'+prose:'')+'\n<qr><opt>保存</opt></qr>';
   const completed={generationId:'static',chatId:1,text:raw};
   f.app.success(completed);
   const expected=(mode==='normal'?prose:'【静态画面】'+description+'\n')+'\n<qr><opt>保存</opt></qr>';
   assert.equal(core.storyText(completed.text),expected);
   f.messages.set(2,{id:2,role:'assistant',content:mode==='raw-save'?raw:completed.text});
   const event={type:'message:added',chatId:1,generationId:'static',message:{id:2,role:'assistant'}};
   await f.app.onSaved(event);
   await f.app.onSaved(event);
   const saved=f.messages.get(2).content;
   assert.equal(core.storyText(saved),expected);
   assert.doesNotMatch(saved,/<ad-visual>|登记DNA：/);
   assert.equal(core.readSaved(saved).requestId,request.id);
   const record=await f.app.readRecord(2);
   assert.equal(record.storyInput,'');
   assert.equal(record.status,'done');
   assert.equal(f.calls,1);
  }finally{f.app.close();}
 });
}
