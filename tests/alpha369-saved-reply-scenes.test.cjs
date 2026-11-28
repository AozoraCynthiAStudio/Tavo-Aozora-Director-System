'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../src/core.cjs');
const Rules=require('../src/director-rules.cjs');
const catalog=require('../src/assets/director-rules.json');
const {fixture,turn}=require('./helpers/equipment-fixture.cjs');

const body='她穿着蓝色雨衣走出书店，在门口撑开雨伞，然后沿街道离开。';
const clothes=Core.Wardrobe.normalizeEquipment({TOP:[{name:'blue raincoat'}],LOWER:[{name:'black trousers'}],FOOTWEAR:[{name:'brown shoes'}]});
const actor={name:'Alice',form:'默认形态',identity:'adult woman, black hair, brown eyes',equipment:clothes};
const summary={event:'她离开书店。',moment:'她在门口撑开雨伞。',framing:'侧面中景，保留雨伞与双手。'};
function scenePlan(scene='side view, medium shot, 1girl, a woman opens an umbrella outside a bookstore',changes={}){
 return {scene,directorSummary:summary,characters:[structuredClone(actor)],...changes};
}
function request(overrides={}){
 return {id:'saved-reply-test',kind:'story_cg',sceneSelection:'saved-reply',request:'',storyInput:body,config:{format:'nai45',shot:'near'},...overrides};
}
async function persistentState(f){
 return {equipment:await f.store.get('equipmentV2','chat'),physical:await f.store.get('physicalStateV1','chat'),profiles:await f.store.get('profiles','chat',[])};
}
function installDirector(f,makePlan){
 const seen=[];
 f.tavo.generate=async prompt=>{seen.push(String(prompt));return Core.VisualProtocol.format(makePlan(String(prompt)),'protocol');};
 return seen;
}

test('saved-reply catalog changes only selection, saved-story correspondence and independent-picture quality scope',()=>{
 const original=structuredClone(catalog),frozen=Object.freeze({...catalog});
 const saved=Rules.savedReplyCatalog(frozen);
 assert.deepEqual(catalog,original);
 assert.deepEqual(Object.keys(original).filter(key=>saved[key]!==original[key]),['requestBoundary','narrativeBridge','qualityPolicy']);
 for(const key of [...Rules.ADULT_KEYS,'sceneComposition','scaleDifference','wardrobeState'])assert.equal(saved[key],original[key]);
 assert.match(saved.requestBoundary,/梳理正文已发生的事件→判断情节性质与选景重点→选定关键瞬间/);
 assert.match(saved.requestBoundary,/具体事件或时刻在正文出现过时，先定位该瞬间/);
 assert.match(saved.requestBoundary,/具体画面内容且正文没有出现过时/);
 assert.match(saved.requestBoundary,/只指定人物、机位、景别或裁切等部分维度，不等于指定了正文外的事件/);
 assert.match(saved.narrativeBridge,/独立画面，非正文事件/);
});

test('complete prompts isolate saved-picture selection from automatic recovery and next-turn narrative construction',()=>{
 for(const format of ['nai45','generic'])for(const wanted of ['','侧面近景，只画 Alice','画她坐在热气球里看日落']){
  const input=request({request:wanted,config:{format,shot:'near'}});
  const saved=Core.buildInstruction(input,catalog,[],{visualOnly:true});
  assert.match(saved,/【事后补图模式·画面选择】/);
  assert.match(saved,/正文用于提供既有事实，不构思新的剧情进展/);
  assert.match(saved,/不得续写、改写、复述、总结或输出任何剧情正文/);
  assert.match(saved,/关闭视觉块后结束，不输出或修改正文/);
  assert.match(saved,/只写简短结果，不写分析步骤、比较过程或 Gate 的 PASS\/FAIL/);
  assert.match(saved,/本轮镜头范围：近景优先/);
  assert.ok(saved.includes(catalog.sceneComposition));
  assert.equal(saved.split(catalog.adultGate).length-1,1);
  assert.doesNotMatch(saved,/【下一轮选景】|【定格与正文】|先在内部构思本轮剧情的大致事件/);
  const recovery=Core.buildInstruction({...input,sceneSelection:undefined},catalog,[],{visualOnly:true});
  assert.ok(recovery.includes(catalog.requestBoundary));
  assert.ok(recovery.includes(catalog.narrativeBridge));
  assert.doesNotMatch(recovery,/【事后补图模式·画面选择】|【导演记录与正文边界】/);
  const nextTurn=Core.buildInstruction(input,catalog,[]);
  assert.match(nextTurn,/【下一轮选景】/);
  assert.doesNotMatch(nextTurn,/【事后补图模式·画面选择】/);
 }
});

test('supplement selects a saved-story frame without changing prose or persistent wardrobe and physical events',async()=>{
 const f=fixture([actor]);await f.app.load();
 try{
  f.messages.set(2,{id:2,index:2,role:'assistant',content:body});
  const before=await persistentState(f),messageBefore=structuredClone(f.messages.get(2));
  const seen=installDirector(f,()=>scenePlan());
  await f.app.supplement(2,'');
  const record=await f.app.readRecord(2),image=record.images[0];
  assert.equal(seen.length,1);
  assert.equal(f.calls,1);
  assert.match(seen[0],/【事后补图模式·画面选择】/);
  assert.ok(seen[0].includes(body));
  assert.deepEqual(f.messages.get(2),messageBefore);
  assert.deepEqual(await persistentState(f),before);
  assert.deepEqual(image.plan.directorSummary,summary);
  assert.equal(image.plan.characters[0].equipment.TOP[0].name,'blue raincoat');
  assert.deepEqual(Core.generationRecord(record,image).directorPlan.directorSummary,summary);
  assert.equal(image.executionAudit.directorOutput.directorPlan.scene,image.plan.scene);
 }finally{f.app.close();}
});

test('a specifically requested independent picture keeps its clothes and summary image-local',async()=>{
 const f=fixture([actor]);await f.app.load();
 try{
  f.messages.set(2,{id:2,index:2,role:'assistant',content:body});
  const before=await persistentState(f),original=structuredClone(f.messages.get(2));
  const independent=scenePlan('medium shot, 1girl, a woman in a red coat sits in a hot air balloon at sunset',{
   directorSummary:{event:'独立画面，非正文事件',moment:'她坐在热气球中看日落。',framing:'侧面中景。'},
   characters:[{...actor,equipment:Core.Wardrobe.normalizeEquipment({...clothes,TOP:[{name:'red coat'}]})}]
  });
  const seen=installDirector(f,()=>independent);
  await f.app.supplement(2,'画她穿红色外套坐在热气球里看日落。');
  const record=await f.app.readRecord(2),image=record.images[0];
  assert.equal(seen.length,1);assert.equal(f.calls,1);
  assert.equal(image.plan.characters[0].equipment.TOP[0].name,'red coat');
  assert.match(image.prompt,/red coat/);
  assert.match(image.plan.directorSummary.event,/独立画面，非正文事件/);
  assert.equal(image.executionAudit.directorOutput.directorPlan.scene,image.plan.scene);
  assert.deepEqual(f.messages.get(2),original);
  assert.deepEqual(await persistentState(f),before);
 }finally{f.app.close();}
});

test('empty new-scene request does not inherit the source full-body request and identifies the previous moment',async()=>{
 const f=fixture();await f.app.load();
 try{
  await turn(f,{mid:2,input:'继续',body,plan:scenePlan(),generationId:'new-scene-source'});
  const initial=await f.app.readRecord(2),source=initial.images[0];
  await f.store.mutateRecord(2,r=>({...r,request:'全身',images:r.images.map(image=>image.id===source.id?{...image,directorContext:{...image.directorContext,request:'全身，头到脚完整入画'}}:image)}));
  const original=structuredClone(f.messages.get(2));
  const next=scenePlan('side view, medium shot, 1girl, a woman walks down a rainy street holding an umbrella',{
   directorSummary:{...summary,moment:'她撑伞沿街走远。'}
  });
  const seen=installDirector(f,()=>next);
  await f.app.tune(2,source.id,'',{method:'new-scene',shot:'near'});
  const record=await f.app.readRecord(2),image=record.images.at(-1);
  assert.equal(seen.length,1);
  assert.match(seen[0],/原图定格/);
  assert.ok(seen[0].includes(source.plan.scene));
  assert.ok(seen[0].includes(source.plan.directorSummary.moment));
  assert.match(seen[0],/玩家本轮画面要求：未指定/);
  assert.match(image.plan.scene,/medium shot/);
  assert.doesNotMatch(image.plan.scene,/full-body|head-to-toe/);
  assert.equal(image.directorContext.request,'');
  assert.equal(image.renderIntent.sources.pictureRequest,'');
  assert.equal(image.executionAudit.directorOutput.directorPlan.scene,image.plan.scene);
  assert.match(f.compiled.at(-1).renderedScene,/medium shot/);
  assert.doesNotMatch(f.compiled.at(-1).renderedScene,/full-body|head-to-toe/);
  assert.deepEqual(record.images[0].plan,source.plan);
  assert.deepEqual(f.messages.get(2),original);
 }finally{f.app.close();}
});

test('another candidate of the selected plan reuses its snapshot with zero director calls',async()=>{
 const f=fixture();await f.app.load();
 try{
  await turn(f,{mid:2,input:'继续',body,plan:scenePlan(),generationId:'same-plan-source'});
  const initial=await f.app.readRecord(2),source=initial.images[0];
  await f.store.mutateRecord(2,r=>({...r,plan:scenePlan('medium shot, a woman in a kitchen')}));
  let textCalls=0;
  f.tavo.generate=async()=>{textCalls++;throw Error('same-plan candidate must not call director');};
  await f.app.generate(2,true,source.id);
  const record=await f.app.readRecord(2),image=record.images.at(-1);
  assert.equal(textCalls,0);assert.equal(f.calls,2);
  assert.deepEqual(image.plan,source.plan);
  assert.deepEqual(image.executionAudit.directorOutput,source.executionAudit.directorOutput);
  assert.deepEqual(record.images[0].plan,source.plan);
  assert.equal(Core.storyText(f.messages.get(2).content),body);
 }finally{f.app.close();}
});

test('partial saved-reply output preserves story state without submitting an image',async()=>{
 const f=fixture([actor]);await f.app.load();
 try{
  f.messages.set(2,{id:2,index:2,role:'assistant',content:body});
  const original=structuredClone(f.messages.get(2)),before=await persistentState(f);
  let textCalls=0;
  f.tavo.generate=async()=>{textCalls++;return '<ad-visual>\n人物：Alice\n外貌：adult woman, black hair\n</ad-visual>';};
  await assert.rejects(f.app.supplement(2,'侧面近景'),/未生成可用的画面方案/);
  assert.equal(textCalls,1);assert.equal(f.calls,0);
  assert.deepEqual(f.messages.get(2),original);
  assert.deepEqual(await persistentState(f),before);
 }finally{f.app.close();}
});

test('incomplete new-scene output preserves existing pictures without submitting an image',async()=>{
 const f=fixture();await f.app.load();
 try{
  await turn(f,{mid:2,input:'继续',body,plan:scenePlan(),generationId:'bad-new-scene-source'});
  const before=await f.app.readRecord(2),source=before.images[0],original=structuredClone(f.messages.get(2));
  let textCalls=0;
  f.tavo.generate=async()=>{textCalls++;return 'No usable visual fields';};
  await assert.rejects(f.app.tune(2,source.id,'侧面近景',{method:'new-scene',shot:'near'}),/未生成可用的画面方案/);
  const after=await f.app.readRecord(2);
  assert.equal(textCalls,1);assert.equal(f.calls,1);
  assert.deepEqual(after.images,before.images);
  assert.deepEqual(f.messages.get(2),original);
 }finally{f.app.close();}
});

for(const [imageService,format] of [['nai5','nai45'],['nai45','nai45'],['generic','generic'],['gpt-image','generic'],['seedream','generic']])test(imageService+' edits a saved frame and selects a new scene via text-to-image',async()=>{
 const f=fixture();await f.app.load();
 try{
  await f.app.saveConfig({imageService,format,naiTransport:'tavo',nai5Transport:'tavo',gptImageTransport:'tavo',seedreamTransport:'tavo'});
  await turn(f,{mid:2,body,plan:scenePlan()});
  const source=(await f.app.readRecord(2)).images[0];
  const original=structuredClone(f.messages.get(2));
  assert.equal(Core.supportsTextImageEdit(source),true);
  assert.equal(Core.supportsTextImageEdit({...source,plan:null}),false);
  assert.equal(Core.supportsNaiImageEdit(source,f.app.snapshot().config),imageService==='nai45');
  f.tavo.generate=async()=>JSON.stringify({scene:'A woman holds an umbrella outside a bookstore, viewed from the front.'});
  await f.app.tune(2,source.id,'改成正面镜头');
  installDirector(f,()=>scenePlan('A woman walks down a rainy street holding an umbrella.'));
  await f.app.tune(2,source.id,'画她沿街走远',{method:'new-scene',shot:'near'});
  const record=await f.app.readRecord(2);
  assert.equal(record.images.length,3);
  assert.deepEqual(record.images[0].plan,source.plan);
  assert.deepEqual(f.messages.get(2),original);
  assert.match(record.images[1].prompt,/viewed from the front/i);
  assert.match(record.images[2].prompt,/walks down a rainy street/i);
  assert.ok(record.images.every(image=>image.config.imageService===imageService&&image.syntax===source.syntax));
 }finally{f.app.close();}
});

test('new scene requires confirmation before using a different image service',async()=>{
 const f=fixture();await f.app.load();
 try{
  await f.app.saveConfig({imageService:'nai5',format:'nai45',nai5Transport:'tavo'});
  await turn(f,{mid:2,body,plan:scenePlan()});
  const source=(await f.app.readRecord(2)).images[0];
  await f.app.saveConfig({imageService:'seedream',format:'generic',seedreamTransport:'tavo'});
  await assert.rejects(f.app.tune(2,source.id,'画她沿街走远',{method:'new-scene'}),{code:'NEW_SCENE_SERVICE_CONFIRMATION_REQUIRED'});
  assert.equal(f.textCalls,0);
  assert.equal(f.calls,1);
  assert.equal((await f.app.readRecord(2)).images.length,1);
  installDirector(f,()=>scenePlan('A woman walks down a rainy street holding an umbrella.'));
  await f.app.tune(2,source.id,'画她沿街走远',{method:'new-scene',confirmedService:'seedream'});
  const updated=await f.app.readRecord(2);
  assert.equal(updated.images.length,2);
  assert.equal(updated.images[1].config.imageService,'seedream');
 }finally{f.app.close();}
});
