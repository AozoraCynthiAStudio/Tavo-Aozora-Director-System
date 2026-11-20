'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Core=require('../src/core.cjs'),Boundary=require('../src/protocol-boundary.cjs');
const {fixture}=require('./helpers/equipment-fixture.cjs');
const catalog=require('../src/assets/director-rules.json');
const story='她走到窗边。';
const foreign='<other-mod><title>画面</title><state>状态</state></other-mod>\n<qr><opt>继续</opt></qr>';
const actor={name:'Alice',identity:'adult woman, black hair',equipment:Core.Wardrobe.normalizeEquipment({TOP:[{name:'blue coat'}]})};
const plan={scene:'medium shot, a woman standing beside a window',characters:[actor]};
const cases=[['ad-wardrobe',Core.Wardrobe,'ad-equipment'],['ad-physical-state',Core.PhysicalState,'ad-physical-state']];

test('well-formed owned JSON blocks parse and strip without consuming the surrounding content',()=>{
 for(const [tag,api]of cases){
  const block='<'+tag+' id="task">{"updates":[]}</'+tag+'>';
  const text=story+block+foreign;
  assert.deepEqual(api.parseUpdates(text),[]);
  assert.equal(api.strip(text),story+foreign);
  assert.equal(api.strip(api.strip(text)),api.strip(text));
 }
});

test('unclosed JSON consumes only owned data and preserves adjacent prose and markup',()=>{
 for(const [tag,api]of cases)for(const data of ['{"updates":[]}','{\n"updates":[]\n}','{"updates":[\n']){
  for(const tail of ['\n'+story+'\n'+foreign,foreign]){
   const text='前文\n<'+tag+'>'+data+tail;
   assert.throws(()=>api.parseUpdates(text),/不完整/);
   const clean=api.strip(text);
   assert.ok(clean.includes(story)||!tail.includes(story));assert.ok(clean.includes(foreign));
   assert.doesNotMatch(clean,new RegExp('<'+tag+'>'));
  }
 }
});

test('foreign elements, comments, code examples and similar names are not owned data',()=>{
 for(const [tag,api]of cases){
  const block='<'+tag+'>{"updates":[]}</'+tag+'>';
  for(const text of ['<other-mod>'+block+'</other-mod>','<!--'+block+'-->','```xml\n'+block+'\n```\n', '<'+tag+'-extra>{"updates":[]}</'+tag+'-extra>']){
   assert.deepEqual(api.parseUpdates(text),[]);assert.equal(api.strip(text),text);
  }
 }
});

test('nested opening tags cannot absorb another block or consume following content',()=>{
 for(const [tag,api]of cases){
  const text='<'+tag+'>{"updates":[]}<'+tag+'>{"updates":[]}</'+tag+'>'+foreign;
  assert.throws(()=>api.parseUpdates(text),/不完整|重复/);
  assert.equal(api.strip(text),foreign);
 }
});

test('different owned protocols cannot nest into or swallow one another',()=>{
 const text='<ad-wardrobe>{"updates":[]}<ad-physical-state>{"updates":[]}</ad-physical-state>\n'+story+foreign;
 assert.throws(()=>Core.Wardrobe.parseUpdates(text),/不完整/);
 assert.deepEqual(Core.PhysicalState.parseUpdates(text),[]);
 assert.ok(Core.Wardrobe.strip(text).includes('<ad-physical-state>'));
 assert.equal(Core.PhysicalState.strip(Core.Wardrobe.strip(text)).trim(),story+foreign);
});

test('JSON quoted braces, escapes and angle characters do not confuse the boundary',()=>{
 for(const [tag,api]of cases){
  const data=JSON.stringify({updates:[{note:'text } \\" <example> [ next'}]});
  const text='<'+tag+'>'+data+'</'+tag+'>'+foreign;
  assert.equal(api.parseUpdates(text)[0].note,'text } \\" <example> [ next');
  assert.equal(api.strip(text),foreign);
 }
});

test('generic picture headings and field labels remain ordinary content',()=>{
 for(const text of ['场景：雨天\n人物：Alice\n'+story,'【画面】\n场景：雨天\n【人物 1】\n姓名：Alice\n'+story]){
  assert.equal(Core.hideBrokenVisual(text),text);assert.equal(Core.storyText(text),text);
  assert.equal(Core.readDirectorOutput(text,{kind:'story_cg'},[]).plan,undefined);
 }
});

test('foreign wrappers and examples cannot become the selected visual frame',()=>{
 const own=Core.VisualProtocol.format(plan,'task');
 for(const text of ['<other-mod>'+own+'</other-mod>','<!--'+own+'-->','```xml\n'+own+'\n```',own.replaceAll('ad-visual','ad-visual-other')]){
  assert.equal(Core.hideBrokenVisual(text),text);assert.equal(Core.readDirectorOutput(text,{kind:'story_cg'},[]).plan,undefined);
 }
 const actual=own+'\n<other-mod>【画面】\n场景：another scene</other-mod>';
 assert.equal(Core.parseVisual(actual).plan.scene,plan.scene);
 assert.ok(Core.hideBrokenVisual(actual).includes('<other-mod>'));
});

test('unclosed visual data stops before prose and other structures',()=>{
 const raw=Core.VisualProtocol.format(plan,'task').replace('</ad-visual>','')+'\n'+story+'\n'+foreign;
 const clean=Core.hideBrokenVisual(raw);
 assert.equal(clean,story+'\n'+foreign);
 assert.equal(Core.readDirectorOutput(raw,{kind:'story_cg'},[]).plan.scene,plan.scene);
});

test('bare recovery requires an explicit task and a full protocol signature',()=>{
 const raw=Core.VisualProtocol.format(plan,'task').replace(/<\/?ad-visual\b[^>]*>/g,'');
 assert.equal(Core.hideBrokenVisual(raw),raw.trim());
 assert.throws(()=>Core.parseVisual(raw));
 assert.equal(Core.parseVisual(raw,'active-task').plan.scene,plan.scene);
 assert.equal(Core.hideBrokenVisual(raw+'\n'+story,{allowBare:true}),story);
});

test('owned comments strip by exact prefix, preserving unrelated comments',()=>{
 for(const [tag,api,prefix]of cases){
  const comment='<!--'+prefix+':'+encodeURIComponent(JSON.stringify({id:'task',chatId:'1',updates:[]}))+'-->';
  assert.equal(api.strip(story+comment+'<!--unrelated:keep-->'),story+'<!--unrelated:keep-->');
  for(const wrapped of ['<other-mod>'+comment+'</other-mod>','```html\n'+comment+'\n```']){assert.equal(api.readPayload(wrapped),null);assert.equal(api.strip(wrapped),wrapped);}
 }
 const comment=Core.readableBlock({id:'task'},plan);
 for(const wrapped of ['<other-mod>'+comment+'</other-mod>','```html\n'+comment+'\n```']){assert.equal(Core.readSaved(wrapped),null);assert.equal(Core.storyText(wrapped),wrapped);}
 assert.equal(Core.readSaved(comment).requestId,'task');
});

test('malformed update blocks in a real reply preserve prose and unrelated structures',async()=>{
 const f=fixture();await f.app.load();
 try{
  f.setInput('继续');await f.app.queueNext({kind:'story_cg'});
  const event={generationId:'boundary',chatId:1,source:'reply',text:await f.tavo.input.get()};await f.app.prepare(event);
  event.text=story+'\n'+Core.VisualProtocol.format(plan,'protocol')+'\n<ad-wardrobe>{"updates":[]}\n'+foreign;
  f.app.success(event);
  assert.ok(event.text.includes(story));assert.ok(event.text.includes(foreign));assert.doesNotMatch(event.text,/<ad-wardrobe>/);
 }finally{f.app.close();}
});

test('format instruction requires complete independent blocks and preserves the existing call model',()=>{
 const prompt=Core.buildInstruction({kind:'story_cg',storyInput:'继续',config:{format:'nai45'}},catalog,[]);
 assert.match(prompt,/每块独立且只出现一次，不互相嵌套/);
 assert.match(prompt,/不要只输出裸的/);
 assert.equal(Boundary.ownedTags('<ad-visual-other>text</ad-visual-other>','ad-visual').length,0);
});
