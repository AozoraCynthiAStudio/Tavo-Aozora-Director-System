'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Core=require('../src/core.cjs'),Motion=require('../src/motion-prompt.cjs');
const {fixture,turn}=require('./helpers/equipment-fixture.cjs');
const styles=require('../src/assets/styles.json'),rules=require('../src/assets/director-rules.json'),{createApp}=require('../src/app.cjs');
const pose='leaning forward with both hands resting naturally on the edge of the wooden table';
const actor={name:'Alice',identity:'adult woman, green eyes',equipment:Core.Wardrobe.normalizeEquipment({TOP:[{name:'blue coat'}]})};
const plan={scene:'medium shot, 1girl, a woman standing at a wooden table',characters:[{...actor,relation:pose}]};

test('text-to-image preserves long natural poses and continues with untranslated fields or count differences',()=>{
 assert.equal(Core.VisualProtocol.relation(pose),pose);
 const parsed=Core.readDirectorOutput(Core.VisualProtocol.format(plan,'test'),{kind:'story_cg'},[]).plan;
 assert.equal(parsed.characters[0].relation,pose);
 const result=Core.compose({...parsed,scene:'3girls, 她站在桌边。'}, {},{format:'nai45'});
 assert.match(result.prompt,/leaning forward with both hands/);
 assert.ok(result.languageAudit.untranslatedFields.length);
 assert.doesNotThrow(()=>Core.validateDirectorPlan(parsed,{config:{format:'nai45'},request:'三人同框'}));
});

test('NAI translates a mixed-language scene before submitting but keeps the original director plan',async t=>{
 const f=fixture();t.after(()=>f.app.close());await f.app.load();
 const original='medium shot, 1girl, 她站在桌边';
 const translated='medium shot, 1girl, a woman stands beside the table';
 let calls=0;
 f.tavo.generate=async()=>{calls++;return JSON.stringify({scene:translated});};
 await turn(f,{mid:31,plan:{...plan,scene:original}});
 const record=await f.app.readRecord(31);
 assert.equal(calls,1);
 assert.equal(record.plan.scene,original);
 assert.equal(f.compiled[0].sections.scene,translated);
 assert.equal(record.images[0].languageAudit.sceneTranslation.status,'translated');
 assert.deepEqual(record.images[0].languageAudit.untranslatedFields,[]);
});

test('motion can generate without focuses, with unusable focuses or with a long pose',()=>{
 const compiled=Core.compose(plan,{},{format:'nai45'}),source={plan,...compiled};
 for(const focuses of [undefined,[],[{text:'not in scene',weight:5}],[{text:'sits at the table',weight:3.2},{text:'sits at the table',weight:4}]]){
  const result=Motion.editOriginal({scene:'medium shot, 1girl, a woman sits at the table',focuses,poseEdits:[{character:0,relation:pose}]},source);
  assert.match(result.prompt,/sits at the table/);assert.match(result.prompt,/leaning forward with both hands/);
 }
});

test('static character rendering keeps its original scene and never runs the narrative-change branch',async()=>{
 const f=fixture();await f.app.load();
 try{
  f.setInput('');await f.app.queueNext({kind:'character_intro',targetName:'Alice'});
  const input=await f.tavo.input.get();f.messages.set(1,{id:1,role:'user',content:input});
  const event={generationId:'static377',chatId:1,source:'reply',text:input};await f.app.prepare(event);
  const original={...plan,description:'她站在桌边。'};
  event.text=Core.VisualProtocol.format(original,'protocol');f.app.success(event);
  f.messages.set(2,{id:2,index:2,role:'assistant',content:event.text});await f.app.onSaved({chatId:1,message:{id:2,role:'assistant'}});
  const record=await f.app.readRecord(2);
  assert.equal(record.plan.scene,original.scene);assert.equal(f.textCalls,0);assert.equal(f.calls,1);
  assert.match(Core.storyText(event.text),/她站在桌边/);
 }finally{f.app.close();}
});

test('a missing Scene preserves the body without calling either provider',async()=>{
 const f=fixture([actor]);await f.app.load();
 try{
  f.setInput('她走到桌边。');await f.app.queueNext({kind:'story_cg'});
  const input=await f.tavo.input.get();f.messages.set(1,{id:1,role:'user',content:input});
  const event={generationId:'partial377',chatId:1,source:'reply',text:input};await f.app.prepare(event);
  const body='她走到桌边，翻开蓝色的书。';
  event.text=body+'\n<ad-visual>\n人物：Alice\n</ad-visual>';f.app.success(event);
  f.messages.set(2,{id:2,index:2,role:'assistant',content:event.text});
  f.tavo.generate=async()=>'<ad-visual>\n人物：Alice\n</ad-visual>';
  await f.app.onSaved({chatId:1,message:{id:2,role:'assistant'}});
  const record=await f.app.readRecord(2);
  assert.equal(record.errorCode,'DIRECTOR_PLAN_MISSING');assert.equal(f.calls,0);assert.equal(record.plan,null);
  assert.equal(Core.storyText(f.messages.get(2).content),body);
 }finally{f.app.close();}
});

test('former default style matches the supplied string exactly and migrates only its unchanged predecessor',async()=>{
 const wanted='0.8::artist:meekohopanes::, 0.5::artist:ru zhai::, game cg, [[shiny skin]], soft body, soft lineart, official art,beautiful lighting,novel illustration,-7::artist collaboration::';
 const previous=styles.find(style=>style.id==='meekohopanes_ru_zhai');
 assert.equal(previous.positive,wanted);
 const old='0.8::artist:meekohopanes::, 0.25::artist:ru zhai::, game cg, [[shiny skin]], soft body, soft lineart, official art, -7::artist collaboration::';
 for(const customize of [false,true]){
  const f=fixture(),saved={...previous,positive:old+(customize?', custom addition':'')};
  await f.tavo.variable.set('aozora_director_v1.styles',[saved,...styles.filter(style=>style.id!==previous.id)],'global');
  const app=createApp(f.tavo,Core,f.store,f.provider,{rules,styles});await app.load();
  try{assert.equal(app.snapshot().styles.find(s=>s.id===saved.id).positive,customize?saved.positive:wanted);}finally{app.close();}
 }
});

test('ordinary image tuning uses available visual data rather than retrying an auxiliary format',async()=>{
 const f=fixture();await f.app.load();
 try{
  await turn(f,{mid:2,body:'她站在桌边。',plan});
  const original=(await f.app.readRecord(2)).images[0];let calls=0;
  f.tavo.generate=async()=>{calls++;return '<ad-visual>\n场景：side view, a woman sitting at a wooden table\n</ad-visual>';};
  await f.app.tune(2,original.id,'坐下');
  const result=(await f.app.readRecord(2)).images.at(-1);
  assert.equal(calls,1);assert.equal(f.calls,2);assert.match(result.plan.scene,/sitting at a wooden table/);
  assert.deepEqual(result.plan.characters,original.plan.characters);
 }finally{f.app.close();}
});

test('an explicit text-service refusal remains a service outcome and is not retried as a format issue',async()=>{
 const f=fixture();await f.app.load();
 try{
  await turn(f,{mid:2,body:'她站在桌边。',plan});const original=(await f.app.readRecord(2)).images[0];let calls=0;
  f.tavo.generate=async()=>{calls++;return "I cannot help with this request.";};
  await assert.rejects(f.app.tune(2,original.id,'坐下'),error=>error.code==='TEXT_MODEL_REFUSED');
  assert.equal(calls,1);assert.equal(f.calls,1);
 }finally{f.app.close();}
});
