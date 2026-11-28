'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Motion=require('../src/motion-prompt.cjs'),Core=require('../src/core.cjs');
const {fixture,turn}=require('./helpers/equipment-fixture.cjs');
const scene='medium shot, 1girl, a woman holds a blue book beside a window, warm sunlight';
const target='medium shot, 1girl, a woman raises the blue book beside a window, warm sunlight';
const plan={scene,directorSummary:{event:'她拿着书。',moment:'翻开书的一瞬。',framing:'侧面中景。'},characters:[{name:'Alice',identity:'adult woman, red curly hair, green eyes',equipment:Core.Wardrobe.normalizeEquipment({TOP:[{name:'blue coat'}],LOWER:[{name:'black trousers'}]})}]};
const change=()=>JSON.stringify({scene:target,focuses:[{text:'raises the blue book',weight:5}],poseEdits:[]});
async function setup(){
 const f=fixture();await f.app.load();await turn(f,{mid:2,input:'继续',body:'她拿着蓝色书站在窗边。',plan});
 await f.app.saveConfig({format:'nai45',imageService:'nai45'});
 await f.store.mutateRecord(2,r=>({...r,images:r.images.map(image=>({...image,config:{...image.config,format:'nai45',imageService:'nai45'}}))}));
 await f.tavo.variable.set('aozora_motion_connection_v1',{provider:'official',apiKey:'local-fixture-only'},'global');
 return {f,source:(await f.app.readRecord(2)).images[0]};
}

test('motion source is the saved submitted scene, with stale alternatives rejected or replaced',()=>{
 const compiled=Core.compose(plan,{positive:'game cg'},{format:'nai45'}),image={plan,...compiled};
 const resolved=Motion.sourceForEdit({...image,renderedScene:'a stale scene'});
 assert.equal(resolved.renderedScene,compiled.renderedScene);
 assert.equal(resolved.plan.scene,compiled.renderedScene);
 assert.equal(image.plan.scene,scene);
 const restored=Motion.sourceForEdit({...image,renderedScene:'missing',sections:{},plan:{...plan,scene:'also missing'}});
 assert.ok(compiled.prompt.split('|')[0].includes(restored.renderedScene));
});

test('valid motion remains one text call and preserves style, identity and clothes exactly',async()=>{
 const {f,source}=await setup();
 try{
  let calls=0;f.tavo.generate=async prompt=>{calls++;assert.match(prompt,/来源图片结构/);return change();};
  await f.app.animate(2,source.id,'举起书');
  const image=(await f.app.readRecord(2)).images.at(-1);
  assert.equal(calls,1);assert.ok(image.motion);
  assert.deepEqual(image.prompt.split('|').slice(1),source.prompt.split('|').slice(1));
  assert.match(image.prompt,/5::raises the blue book::/);
  assert.equal(Core.storyText(f.messages.get(2).content),'她拿着蓝色书站在窗边。');
 }finally{f.app.close();}
});

for(const still of [false,true])test((still?'img2img':'animation')+' reads current structured image data and accepts a complete target scene in one call',async()=>{
 const {f,source}=await setup();
 try{
  let calls=0;f.tavo.generate=async prompt=>{calls++;assert.match(prompt,/来源图片结构/);assert.ok(prompt.includes(source.renderedScene));assert.ok(prompt.includes('red curly hair'));assert.ok(prompt.includes('blue coat'));assert.doesNotMatch(prompt,/格式修正/);return JSON.stringify({scene:target,focuses:[{text:'raises the blue book',weight:5}],poseEdits:[]});};
  if(still)await f.app.tune(2,source.id,'举起书',{method:'img2img'});else await f.app.animate(2,source.id,'举起书');
  const record=await f.app.readRecord(2),image=record.images.at(-1);
  assert.equal(calls,1);assert.equal(f.calls,2);assert.equal(record.images.length,2);assert.equal(!!image.motion,!still);
  assert.deepEqual(image.prompt.split('|').slice(1),source.prompt.split('|').slice(1));
  assert.deepEqual(f.compiled.at(-1).options.referenceImages,[source.pointer]);
  assert.match(image.prompt,/5::raises the blue book::/);
 }finally{f.app.close();}
});

test('invalid optional focus is skipped while the valid target generates once',async()=>{
 const {f,source}=await setup();try{let calls=0;f.tavo.generate=async()=>{calls++;return JSON.stringify({scene:target,focuses:[{text:'absent',weight:5}]});};
 await f.app.animate(2,source.id,'举起书');assert.equal(calls,1);assert.equal(f.calls,2);
 }finally{f.app.close();}
});

test('complete scene JSON wrapped or echoed by prose is accepted when the target scene is unambiguous',()=>{
 const source=Core.compose(plan,{positive:'game cg'},{format:'nai45'});
 const object=JSON.stringify({scene:target,focuses:[{text:'raises the blue book',weight:5}],poseEdits:[]});
 const result=Motion.editOriginal('导演方案如下：'+object+'\n确认：'+object,{...source,plan});
 assert.match(result.prompt,/5::raises the blue book::/);
});
test('unmatched focus does not block the target or widen weighting to the whole scene',()=>{
 const compiled=Core.compose(plan,{},{format:'nai45'});
 const raw=JSON.stringify({edits:[{character:-1,from:'holds a blue book',to:'raises the book',focuses:[{text:'absent',weight:5}]}]});
 assert.match(Motion.editOriginal(raw,{plan,...compiled}).prompt,/raises the book/);
});

test('motion replay uses the exact accepted prompt without another text call',async()=>{
 const {f,source}=await setup();
 try{
  let calls=0;f.tavo.generate=async()=>{calls++;return change();};
  await f.app.animate(2,source.id,'举起书');
  const motion=(await f.app.readRecord(2)).images.at(-1);
  await f.app.repeatMotion(2,motion.id);
  const replay=(await f.app.readRecord(2)).images.at(-1);
  assert.equal(calls,1);assert.equal(replay.prompt,motion.prompt);
  assert.deepEqual(f.compiled.at(-1).options.referenceImages,[source.pointer]);
 }finally{f.app.close();}
});

test('a subsequent edit can address a weighted scene without losing original character sections',async()=>{
 const {f,source}=await setup();
 try{
  f.tavo.generate=async()=>change();await f.app.animate(2,source.id,'举起书');
  const prior=(await f.app.readRecord(2)).images.at(-1);
  f.tavo.generate=async()=>JSON.stringify({edits:[{character:-1,from:'raises the blue book',to:'holds the blue book near her face',focuses:[{text:'holds the blue book near her face',weight:4}]}]});
  await f.app.animate(2,prior.id,'把书拿近一些');
  const next=(await f.app.readRecord(2)).images.at(-1);
  assert.match(next.prompt,/4::holds the blue book near her face::/);
  assert.deepEqual(next.prompt.split('|').slice(1),source.prompt.split('|').slice(1));
 }finally{f.app.close();}
});

test('a NAI 4.5 character candidate can make and replay a dynamic frame',async()=>{
 const {f,source}=await setup();
 try{
  await f.store.mutateRecord(2,r=>({...r,kind:'character_intro',images:r.images.map(image=>({...image,kind:'character_intro'}))}));
  f.tavo.generate=async()=>change();
  await f.app.animate(2,source.id,'举起书');
  const first=(await f.app.readRecord(2)).images.at(-1);
  assert.equal(first.kind,'character_intro');
  assert.equal(first.motion.sourcePointer,source.pointer);
  await f.app.repeatMotion(2,first.id,'replace');
  const next=await f.app.readRecord(2);
  assert.equal(next.images[0].id,source.id);
  assert.equal(next.images.at(-1).motion.sourcePointer,source.pointer);
 }finally{f.app.close();}
});
