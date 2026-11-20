'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {core,fixture,turn}=require('./helpers/equipment-fixture.cjs');
const equip=name=>core.Wardrobe.normalizeEquipment({TOP:[{name}],LOWER:[{name:'black trousers'}],FOOTWEAR:[{name:'brown shoes'}]});
const actor={name:'Alice',form:'默认形态',identity:'adult woman, red curly hair, green eyes, dark skin',equipment:equip('blue coat')};
const body='她穿着蓝色外套在窗边翻开书。随后，她放下书走进厨房。';
const source='她穿着蓝色外套在窗边翻开书。';
const plan=()=>({scene:'side view, medium shot, 1girl, a woman in a blue coat opens a book beside a window',sourceExcerpt:source,characters:[structuredClone(actor)]});
async function queued(f,id='grounded'){
 f.setInput('让她翻开书。');await f.app.queueNext({kind:'story_cg'});
 const input=await f.tavo.input.get();f.messages.set(1,{id:1,role:'user',content:input});
 const event={generationId:id,chatId:1,source:'reply',text:input};await f.app.prepare(event);return event;
}
async function saved(f,event,visual,prose=body){
 event.text=prose+'\n'+core.VisualProtocol.format(visual,'protocol')+'\n<ad-wardrobe>{"updates":[]}</ad-wardrobe>';
 f.app.success(event);f.messages.set(2,{id:2,index:2,role:'assistant',content:event.text});
 await f.app.onSaved({chatId:1,message:{id:2,role:'assistant'}});return f.app.readRecord(2);
}

test('valid post-story extraction binds the image to literal prose without another text call',async()=>{
 const f=fixture([actor]);await f.app.load();
 try{
  const event=await queued(f),record=await saved(f,event,plan());
  assert.equal(record.status,'done');assert.equal(f.calls,1);assert.equal(f.textCalls,0);
  assert.equal(record.images[0].plan.sourceExcerpt,source);
  assert.equal(core.storyText(f.messages.get(2).content),body);
  assert.equal(core.generationRecord(record,record.images[0]).directorPlan.sourceExcerpt,source);
  assert.doesNotMatch(record.images[0].prompt,/她穿着|正文依据/);
 }finally{f.app.close();}
});

test('missing or unmatched optional citations do not block a valid frame or add a text call',async()=>{
 for(const excerpt of [undefined,'她在码头挥手。']){
  const f=fixture([actor]);await f.app.load();
  try{
   const event=await queued(f),record=await saved(f,event,{...plan(),sourceExcerpt:excerpt});
   assert.equal(record.status,'done');assert.equal(record.images[0].plan.sourceExcerpt,undefined);
   assert.equal(f.calls,1);assert.equal(f.textCalls,0);assert.equal(record.images.length,1);
   assert.equal(core.storyText(f.messages.get(2).content),body);
   await f.app.onSaved({chatId:1,message:{id:2,role:'assistant'}});
   assert.equal(f.calls,1);assert.equal(f.textCalls,0);
  }finally{f.app.close();}
 }
});

test('a host edit before save does not re-direct a valid Scene',async()=>{
 const f=fixture([actor]);await f.app.load();
 try{
  const event=await queued(f);
  event.text=body+'\n'+core.VisualProtocol.format(plan(),'protocol');f.app.success(event);
  const edited=event.text.replace(source,'她直接离开房间。');
  let repairs=0;
  f.tavo.generate=async prompt=>{repairs++;assert.match(prompt,/最接近原意/);return core.VisualProtocol.format({...plan(),sourceExcerpt:undefined,scene:'medium shot, 1girl, a woman in a blue coat leaves the room'},'protocol');};
  f.messages.set(2,{id:2,index:2,role:'assistant',content:edited});
  await f.app.onSaved({chatId:1,message:{id:2,role:'assistant'}});
  const record=await f.app.readRecord(2);
  assert.equal(record.status,'done');assert.equal(repairs,0);assert.equal(f.calls,1);
  assert.equal(record.images[0].plan.scene,plan().scene);
  assert.equal(record.images[0].plan.sourceExcerpt,undefined);
  assert.equal(core.storyText(f.messages.get(2).content),'她直接离开房间。随后，她放下书走进厨房。');
 }finally{f.app.close();}
});

test('selected-frame clothes and later narrative ending clothes stay separate',async()=>{
 const f=fixture([actor]);await f.app.load();
 try{
  const finalBody=source+'后来她脱下蓝色外套，换上红色夹克。';
  await turn(f,{mid:2,input:'先翻书，再换衣服。',body:finalBody,plan:plan(),updates:[{name:'Alice',form:'默认形态',regions:{TOP:[{name:'red jacket'}]},fact:'current'}]});
  const record=await f.app.readRecord(2);
  assert.equal(record.images[0].plan.characters[0].equipment.TOP[0].name,'blue coat');
  const ending=f.app.snapshot().wardrobe.find(c=>c.name==='Alice');
  assert.equal(ending.equipment.TOP[0].name,'red jacket');
 }finally{f.app.close();}
});
