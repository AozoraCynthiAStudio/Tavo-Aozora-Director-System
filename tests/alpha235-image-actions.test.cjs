'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../src/core.cjs');
const {fixture,turn}=require('./helpers/equipment-fixture.cjs');
const rules=require('../src/assets/director-rules.json');
const stage=fs.readFileSync(path.join(__dirname,'../src/ui/stage.html'),'utf8');
const menu=fs.readFileSync(path.join(__dirname,'../src/ui/menu.html'),'utf8');
const controller=fs.readFileSync(path.join(__dirname,'../src/ui/controller.js'),'utf8');
const reader=fs.readFileSync(path.join(__dirname,'../src/ui/reader.js'),'utf8');
const appSource=fs.readFileSync(path.join(__dirname,'../src/app.cjs'),'utf8');
const empty=()=>({HEAD:null,TOP:[],LOWER:null,FULL:null,LEGWEAR:null,FOOTWEAR:null,HAND:null,ACCESSORIES:null});
const plan=(scene='medium shot, 1girl, a woman sitting beside a window, looking outside')=>({scene,description:'她坐在窗边望向窗外。',characters:[{name:'林清雪',form:'默认形态',identity:'adult woman, long black hair, brown eyes',equipment:empty()}]});
function count(text,part){return String(text).split(part).length-1;}

test('alpha235: a text-only assistant reply has no automatic image call; clicking supplement makes one director-text call and one image call',async()=>{
 const f=fixture();let textCalls=0,seen='';
 try{
  await f.app.load();
  const body='她结束了工作，走到窗边，望着夜色中的街道。';
  await turn(f,{mid:2,input:'继续',body,plan:null});
  assert.equal(f.calls,0,'ordinary text-only reply must not call the image provider');
  assert.equal(await f.app.readRecord(2),null,'ordinary text-only reply must not create an empty visual record');
  f.tavo.generate=async prompt=>{
   textCalls++;seen=String(prompt);const id=seen.match(/<ad-visual id="([^"]+)"/)?.[1];assert.ok(id,'supplement prompt must carry a unique visual id');
   return Core.VisualProtocol.format(plan(),id)+'\n<ad-wardrobe id="'+id+'">{"updates":[]}</ad-wardrobe>';
  };
  await f.app.supplement(2,'镜头靠近一些，突出她望向窗外的神情。');
  const record=await f.app.readRecord(2);
  assert.equal(textCalls,1,'supplement should make exactly one existing director text request');
  assert.equal(f.calls,1,'supplement should submit exactly one image request');
  assert.equal(record.status,'done');assert.equal(record.kind,'story_cg');assert.equal(record.images.length,1);
  assert.match(record.images[0].prompt,/looking outside/);
  assert.match(seen,/事后补图模式/);assert.match(seen,/不得续写、改写、复述、总结或输出任何剧情正文/);
  assert.equal(count(seen,rules.adultGate),1,'supplement uses the same single-pass rule set');
  assert.equal(Core.storyText(f.messages.get(2).content),body,'supplement must not rewrite the visible saved story');
 }finally{f.app.close();}
});

test('alpha235: story-CG adjustment works without registration DNA and remains image-local',async()=>{
 const f=fixture();let textCalls=0,seen='';
 try{
  await turn(f,{mid:235,body:'她坐在窗边，望着窗外。',plan:plan()});
  const before=await f.app.readRecord(235),source=before.images[0];
  assert.ok(source);assert.equal(source.plan.characters[0].registrationDNA,undefined);
  f.tavo.generate=async prompt=>{textCalls++;seen=String(prompt);return JSON.stringify({scene:'medium close-up, a woman sitting beside a window, turning her face toward the camera, calm expression',changes:[{index:0,identity:'adult woman, long black hair, amber eyes'}],dnaChanges:[],wardrobeUpdates:[]});};
  await f.app.tune(235,source.id,'让她转过脸看向镜头，眼睛改成琥珀色。');
  const after=await f.app.readRecord(235),candidate=after.images.at(-1);
  assert.equal(textCalls,1);assert.equal(after.images.length,2);
  assert.match(candidate.prompt,/turning her face toward the camera/);
  assert.match(candidate.prompt,/amber eyes/);
  assert.equal(source.plan.characters[0].identity,'adult woman, long black hair, brown eyes');
  assert.equal(candidate.plan.characters[0].identity,'adult woman, long black hair, amber eyes');
  assert.deepEqual(f.app.snapshot().profiles,[],'image adjustment must not write formal character profiles');
  assert.match(seen,/调整玩家当前选中的图片/);
 }finally{f.app.close();}
});

test('alpha235: story-CG DNA changes remain image-local and cannot detach an existing DNA snapshot',async()=>{
 const f=fixture();
 const dna={schema:1,slots:{typeAge:'adult woman, 24 years old',hair:'long black hair',eyes:'brown eyes'}};
 const sourcePlan={scene:'medium shot, 1girl, standing beside a window',characters:[{name:'林清雪',form:'默认形态',identity:Core.DNA.snapshotIdentity(dna),registrationDNA:dna,equipment:empty()}]};
 try{
  await turn(f,{mid:236,body:'她站在窗边。',plan:sourcePlan});
  const before=await f.app.readRecord(236),source=before.images[0];
  f.tavo.generate=async()=>JSON.stringify({changes:[{index:0,identity:'adult woman, silver hair'}],wardrobeUpdates:[]});
  await assert.rejects(f.app.tune(236,source.id,'把头发改成银色'),{code:'TUNING_NO_VISIBLE_CHANGE',message:/没有可应用的画面变化/});
  const retained=await f.app.readRecord(236);
  assert.equal(retained.images.length,1);
  assert.deepEqual(retained.images[0].plan.characters[0].registrationDNA,source.plan.characters[0].registrationDNA);
  f.tavo.generate=async()=>JSON.stringify({dnaChanges:[{index:0,slots:{hair:'long silver hair'}}],wardrobeUpdates:[]});
  await f.app.tune(236,source.id,'把头发改成银色');
  const after=await f.app.readRecord(236),candidate=after.images.at(-1);
  assert.equal(after.images.length,2);assert.match(candidate.prompt,/long silver hair/);
  assert.match(source.plan.characters[0].identity,/long black hair/);
  assert.deepEqual(f.app.snapshot().profiles,[]);
 }finally{f.app.close();}
});

test('alpha235: reroll/add can recover the selected image plan when the parent record has no root plan',async()=>{
 const f=fixture();
 try{
  const sourcePlan=plan('medium shot, 1girl, holding a bright red umbrella at a rainy station');
  await turn(f,{mid:237,body:'她在雨中的车站等车。',plan:sourcePlan});
  const first=await f.app.readRecord(237),source=first.images[0];
  await f.store.mutateRecord(237,r=>({...r,plan:null}));
  await f.app.generate(237,true,source.id,null,'append');
  const after=await f.app.readRecord(237);
  assert.equal(after.images.length,2);
  assert.equal(after.plan.scene,source.plan.scene);
  assert.match(f.compiled.at(-1).prompt,/bright red umbrella/);
 }finally{f.app.close();}
});

test('alpha235: card and history gate adjustment and motion on source capabilities',()=>{
 assert.match(stage,/id="addock-tune"[^>]*aria-label="调整当前画面"/);
 assert.doesNotMatch(stage,/addock-intro-tune/);
 assert.match(menu,/id="addock-tune-dialog"/);
 assert.match(menu,/id="addock-tune-method"/);
 assert.match(controller,/\$\('addock-tune'\)\.hidden=!supportsTune\(item\)/);
 assert.match(controller,/motion:'addock-motion'/);
 assert.match(reader,/canEditSource\?\[/);
 assert.match(reader,/canRequestMotion\?\[/);
 assert.match(reader,/tune:'addock-tune',motion:'addock-motion'/);
});

test('alpha235: no-plan supplement action is wired from both current card and history detail to the same app.supplement entry',()=>{
 assert.match(controller,/canSupplementBody=emptyVisual&&!canRecoverPlan&&!!story/);
 assert.match(controller,/canSupplementBody\?openSupplement\(mid\)/);
 assert.match(controller,/app\.supplement\(target\.mid,request\)/);
 assert.match(controller,/if\(action==='supplement'\)\{openSupplement\(messageId\);return;\}/);
 assert.match(reader,/supplement=action==='add'&&!record\?\.plan&&!item&&recoverableScene/);
 assert.match(appSource,/async function supplement\(mid,sceneRequest=''/);
 assert.match(appSource,/return generate\(key,true,null,plan,'append',\{supplement:true/);
});
