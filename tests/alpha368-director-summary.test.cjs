'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Core=require('../src/core.cjs'),Visual=Core.VisualProtocol;
const rules=require('../src/assets/director-rules.json');
const {fixture,turn}=require('./helpers/equipment-fixture.cjs');
const summary={event:'她离开书店，在门外撑伞。',moment:'雨伞刚刚打开的一瞬。',framing:'侧面中景，保留伞和伸出的手。'};
const body='她在书店门外撑起伞，随后走进雨里。';
function plan(notes=summary){return {scene:'side view, medium shot, 1girl, a woman opens an umbrella outside a bookstore',...(notes?{directorSummary:notes}:{}),characters:[{name:'Alice',identity:'adult woman, black hair',equipment:Core.Wardrobe.normalizeEquipment({TOP:[{name:'blue raincoat'}]})}]};}

test('director summary survives strict and tolerant parsing but cannot affect the image prompt',()=>{
 const raw=Visual.format(plan(),'summary');
 assert.deepEqual(Core.parseVisual(raw).plan.directorSummary,summary);
 const unwrapped=raw.replace(/<\/?ad-visual\b[^>]*>/g,'');
 assert.deepEqual(Core.parseVisual(unwrapped+'\n'+body,'active-task').plan.directorSummary,summary);
 const loose=raw.replace(/【画面】|【人物 1】/g,'').replace('姓名：Alice','人物：Alice');
 const read=Core.readDirectorOutput(loose,{kind:'story_cg'},[]);
 assert.deepEqual(read.plan.directorSummary,summary);
 assert.equal(Core.compose(plan(),{},{format:'nai45'}).prompt,Core.compose(plan(null),{},{format:'nai45'}).prompt);
 assert.equal(Core.compose(plan(),{},{format:'generic'}).prompt,Core.compose(plan(null),{},{format:'generic'}).prompt);
});

test('summary stays inside hidden saved data and never replaces story or foreign markup',async()=>{
 const f=fixture();await f.app.load();
 try{
  const lore='<qr><opt>继续走</opt></qr>';
  const {event}=await turn(f,{mid:2,input:'她走出书店。',body:body+'\n'+lore,plan:plan(),generationId:'summary-first'});
  assert.equal(Core.storyText(event.text),body+'\n'+lore);
  assert.deepEqual(Core.readSaved(event.text).plan.directorSummary,summary);
  const record=await f.app.readRecord(2),image=record.images[0];
  assert.deepEqual(image.plan.directorSummary,summary);
  assert.deepEqual(Core.generationRecord(record,image).directorPlan.directorSummary,summary);
  assert.equal(Core.generationRecord(record,image,true).version,require('../package.json').version);
  assert.equal(f.textCalls,0,'summary must not add a text-model request');
  assert.doesNotMatch(image.prompt,/本轮事件|选定瞬间|镜头安排|她离开书店/);
  const other={...image,id:'other',plan:plan({...summary,moment:'另一个瞬间。'})};
  assert.equal(Core.generationRecord({...record,plan:other.plan},image).directorPlan.directorSummary.moment,summary.moment,'record uses the selected image snapshot');
 }finally{f.app.close();}
});

test('optional malformed summary cannot veto a valid frame or leak on broken visual cleanup',()=>{
 const raw=Visual.format(plan(null),'summary');
 assert.equal(Core.parseVisual(raw).plan.directorSummary,undefined);
 assert.equal(Visual.directorSummary({event:123,moment:[],framing:null}),undefined);
 assert.deepEqual(Visual.directorSummary({event:' <b>event</b>\n fact ',steps:'private'}),{event:'event fact'});
 assert.equal(Visual.directorSummary({event:'a'.repeat(300)}).event.length,160);
 const broken=Visual.format(plan(),'summary').replace(/场景：[^\n]+/,'场景：');
 assert.equal(Core.storyText(Core.hideBrokenVisual(broken+'\n'+body)),body);
});

test('director-plan UI and text export include summary fields and old records still render',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/ui/controller.js'),'utf8');
 const begin=source.indexOf('  function promptSections('),end=source.indexOf('  function showPromptPage(',begin);
 const sections=vm.runInNewContext(source.slice(begin,end)+'\npromptSections;',{core:Core});
 const current=Core.generationRecord({}, {plan:plan(),prompt:'final',options:{}});
 assert.deepEqual(Array.from(sections(current,'plan'),row=>row[0]),['本轮事件','选定瞬间','镜头安排','场景','Alice']);
 assert.equal(sections(current,'final')[0][1],'final');
 const legacy=Core.generationRecord({}, {plan:plan(null),prompt:'final',options:{}});
 assert.equal(sections(legacy,'plan')[0][0],'场景');
});

test('editing a source image does not copy its old moment or camera summary',async()=>{
 const f=fixture();await f.app.load();
 try{
  await turn(f,{mid:2,input:'继续剧情',body,plan:plan(),generationId:'summary-edit'});
  const first=(await f.app.readRecord(2)).images[0];
  f.tavo.generate=async()=>JSON.stringify({scene:'front view, medium shot, 1girl, a woman holding an umbrella outside a bookstore'});
  await f.app.tune(2,first.id,'改成正面镜头');
  const record=await f.app.readRecord(2);
  assert.deepEqual(record.images[0].plan.directorSummary,summary);
  assert.equal(record.images.at(-1).plan.directorSummary,undefined);
 }finally{f.app.close();}
});
