'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../src/core.cjs'),Visual=Core.VisualProtocol;
const catalog=require('../src/assets/director-rules.json');

const excerpt='她把伞举过头顶，轻声说：“走吧。”\r\n雨水顺着蓝色雨衣落下。';
const body='书店关门了。\r\n'+excerpt+'\r\n她随后沿街道走远。';
function plan(sourceExcerpt=excerpt){
 return {scene:'side view, medium shot, 1girl, a woman raises an umbrella outside a bookstore',
  ...(sourceExcerpt===undefined?{}:{sourceExcerpt}),
  directorSummary:{event:'她离开书店。',moment:'她举起伞的一瞬。',framing:'侧面中景，伞和双手入画。'},
  characters:[{name:'Alice',form:'默认形态',identity:'adult woman, black hair',equipment:Core.Wardrobe.normalizeEquipment({TOP:[{name:'blue raincoat'}]})}]};
}
function request(picture='',format='nai45'){
 return {id:'grounded370',kind:'story_cg',storyInput:'她准备离开书店。',request:picture,config:{format,shot:'near'}};
}
function inspected(run,status){
 const report=run();assert.equal(report.status,status);
 if(status!=='matched')assert.equal(report.sourceExcerpt,undefined);
}

test('source paragraph round-trips exact text as one JSON line through strict and tolerant protocols',()=>{
 const raw=Visual.format(plan(),'grounded');
 assert.match(raw,/正文依据："/);
 assert.equal(raw.split('\n').filter(line=>line.startsWith('正文依据：')).length,1);
 assert.equal(Core.parseVisual(raw).plan.sourceExcerpt,excerpt);
 assert.equal(Core.readDirectorOutput(raw,request(),[]).plan.sourceExcerpt,excerpt);
 assert.equal(Core.parseVisual(raw.replace(/<\/?ad-visual\b[^>]*>/g,''),'active-task').plan.sourceExcerpt,excerpt);
 const plain=raw.replace(/^正文依据：.*$/m,'正文依据：她把伞举过头顶。');
 assert.equal(Core.parseVisual(plain).plan.sourceExcerpt,'她把伞举过头顶。');
});

test('optional grounding inspection matches the actual story and reports mismatches without throwing',()=>{
 const proof=Core.inspectStoryGrounding(plan(),body);
 assert.equal(proof.status,'matched');
 assert.equal(proof.sourceExcerpt,excerpt.replace(/\r\n/g,'\n'));
 assert.equal(proof.bodyHash,Core.fingerprint(Core.storyText(body).replace(/\r\n/g,'\n')));
 assert.equal(proof.at,'书店关门了。\n'.length);
 assert.equal(Core.inspectStoryGrounding(plan(excerpt.replace(/\r\n/g,'\n')),body).status,'matched');
 inspected(()=>Core.inspectStoryGrounding(plan(excerpt.replace('轻声说','轻轻说')),body),'unmatched');
 inspected(()=>Core.inspectStoryGrounding(plan(excerpt.replace('她把伞','她  把伞')),body),'unmatched');
 inspected(()=>Core.inspectStoryGrounding(plan('书店关门了。\n她随后沿街道走远。'),body),'unmatched');
});

test('a quote present only inside the hidden visual data is not story evidence',()=>{
 const raw=Visual.format(plan(),'grounded');
 inspected(()=>Core.inspectStoryGrounding(plan(),raw+'\n她安静地坐着。'),'unmatched');
 inspected(()=>Core.inspectStoryGrounding(plan(),'<ad-visual>\n正文依据：'+JSON.stringify(excerpt)+'\n</ad-visual>'),'unmatched');
 for(const hidden of ['<!--'+excerpt+'-->','<think>'+excerpt+'</think>','<analysis>'+excerpt+'</analysis>','<qr><opt>'+excerpt+'</opt></qr>','<apt-drawer>'+excerpt+'</apt-drawer>'])inspected(()=>Core.inspectStoryGrounding(plan(),hidden+'\n她坐在窗边。'),'unmatched');
 assert.equal(Core.inspectStoryGrounding(plan(),body+'\n<qr><opt>'+excerpt+'</opt></qr>').status,'matched');
 inspected(()=>Core.inspectStoryGrounding(plan(),excerpt+'\n稍后。\n'+excerpt),'ambiguous');
 const full=body+'\n'+raw+'\n<qr><opt>继续</opt></qr>';
 assert.equal(Core.inspectStoryGrounding(plan(),full).status,'matched');
});

test('missing, oversized or marked-up optional evidence is unavailable without coercion or truncation',()=>{
 for(const value of [undefined,null,{},[],12,'','   ','x'.repeat(2001),'<p>她把伞举过头顶。</p>']){
  inspected(()=>Core.inspectStoryGrounding({sourceExcerpt:value},body),'unavailable');
 }
 const long='x'.repeat(2000);
 assert.equal(Core.inspectStoryGrounding({sourceExcerpt:long},long).status,'matched');
 assert.equal(Visual.sourceExcerpt('x'.repeat(2001)),undefined);
 assert.equal(Core.normalizedPlan(plan('x'.repeat(2001))).sourceExcerpt,undefined);
});

test('legacy visual plans remain parseable without making optional evidence a global requirement',()=>{
 const legacy=plan();delete legacy.sourceExcerpt;
 const raw=Visual.format(legacy,'legacy');
 assert.equal(Core.parseVisual(raw).plan.sourceExcerpt,undefined);
 assert.ok(Core.readDirectorOutput(raw,request(),[]).plan);
 inspected(()=>Core.inspectStoryGrounding(Core.parseVisual(raw).plan,body),'unavailable');
});

test('source evidence is exported with the selected image and cannot enter either image prompt format',()=>{
 const source=plan(),without=plan();delete without.sourceExcerpt;
 for(const format of ['nai45','generic']){
  const withEvidence=Core.compose(source,{},{format}),plain=Core.compose(without,{},{format});
  assert.equal(withEvidence.prompt,plain.prompt);
  assert.doesNotMatch(withEvidence.prompt,/正文依据|雨水顺着蓝色雨衣落下/);
 }
 const record=Core.generationRecord({plan:plan('另一段正文')},{plan:source,prompt:'final',options:{}});
 assert.equal(record.directorPlan.sourceExcerpt,excerpt);
});

test('next-turn prompts finalize one visual block before writing the matching story',()=>{
 for(const format of ['nai45','generic'])for(const picture of ['','只画Alice，侧面近景','画她在书店门口撑伞']){
  const text=Core.buildInstruction(request(picture,format),catalog,[]);
  assert.match(text,/先写一个 <ad-visual> 块/);
  assert.match(text,/关闭唯一画面块后再写正文/);
  assert.match(text,/正文让定格中的动作和当时状态自然发生/);
  assert.match(text,/装备」只列定格当下相对开场变化/);
  assert.match(text,/无变化省略/);
  assert.doesNotMatch(text,/正文后画面提取|正文依据：|导演记录与正文边界|【本帧取用】/);
  assert.equal(text.split(catalog.adultGate).length-1,1);
  assert.equal((text.match(/<ad-visual id="protocol">/g)||[]).length,1);
  if(picture)assert.ok(text.includes(picture));
 }
});

test('saved-reply pictures, recovery, static and character modes keep their original output boundaries',()=>{
 const base=request();
 for(const [input,options]of [
  [{...base,sceneSelection:'saved-reply'},{visualOnly:true}],
  [base,{visualOnly:true}],
  [{...base,storyInput:''},{}],
  [{...base,kind:'character_intro',targetName:'Alice'},{}]
 ]){
  const text=Core.buildInstruction(input,catalog,[],options);
  assert.doesNotMatch(text,/【正文后画面提取】|正文依据：/);
  if(options.visualOnly)assert.doesNotMatch(text,/正文完成后写一个 <ad-visual>/);
 }
 const saved=Core.buildInstruction({...base,sceneSelection:'saved-reply'},catalog,[],{visualOnly:true});
 assert.match(saved,/关闭视觉块后结束，不输出或修改正文/);
 const staticText=Core.buildInstruction({...base,storyInput:''},catalog,[]);
 assert.match(staticText,/本轮无剧情行动：只设计静态画面/);
});
