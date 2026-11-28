'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Core=require('../src/core.cjs'),Rules=require('../src/director-rules.cjs');
const rules=require('../src/assets/director-rules.json');
function req(kind='story_cg',format='nai45',storyInput='继续剧情',extra={}){
 return {id:'req186',kind,request:'',targetName:'示例角色',targetForm:'默认形态',storyInput,style:{positive:'game cg'},config:{format,maxActors:3},...extra};
}
test('alpha225 catalog keeps distinct responsibilities for scene space, player framing, scale and cast composition',()=>{
 assert.deepEqual(Object.keys(rules),Rules.REQUIRED);
 assert.equal(Rules.validateCatalog(rules),true);
 assert.ok(Object.values(rules).every(x=>x.startsWith('【')&&!/\bAction[：:]|<cg-design\b/i.test(x)));
});
test('alpha186 compiler includes only task/format-specific director rules',()=>{
 const storyNai=Rules.compileRuleLayers(req(),rules).map(r=>r.name);
 const storyGeneric=Rules.compileRuleLayers(req('story_cg','generic'),rules).map(r=>r.name);
 const design=Rules.compileRuleLayers(req('character_intro','nai45'),rules).map(r=>r.name);
 const standalone=Rules.compileRuleLayers(req('story_cg','nai45',''),rules).map(r=>r.name);
 assert.ok(storyNai.some(x=>x.endsWith('sceneComposition')));
 assert.ok(!storyNai.some(x=>x.endsWith('playerCamera')));
 assert.ok(storyNai.some(x=>x.endsWith('scaleDifference')));
 assert.ok(storyNai.some(x=>x.endsWith('castComposition')));
 assert.ok(storyNai.some(x=>x.endsWith('narrativeBridge')));
 assert.ok(!standalone.some(x=>x.endsWith('narrativeBridge')));
 assert.ok(!storyNai.some(x=>x.endsWith('characterDesign')));
 assert.ok(design.some(x=>x.endsWith('characterDesign')));
 assert.ok(storyGeneric.some(x=>x.endsWith('genericFormat')));
 assert.ok(!storyGeneric.some(x=>x.endsWith('nai45Format')));
 assert.ok(!storyGeneric.some(x=>x.endsWith('castComposition')));
 assert.ok(!storyGeneric.some(x=>x.endsWith('playerCamera')));
 assert.ok(storyGeneric.some(x=>x.endsWith('scaleDifference')));
 assert.ok(!storyNai.some(x=>x.endsWith('genericFormat')));
 assert.ok(storyNai.some(x=>x.endsWith('qualityPolicy')));
});
test('the visual prompt shows one short example and includes outfit updates only for story replies',()=>{
 for(const kind of ['story_cg','character_intro'])for(const format of ['nai45','generic']){
  const text=Core.buildInstruction(req(kind,format),rules,[]);
  assert.equal([...text.matchAll(/<ad-visual id="protocol">/g)].length,1);
  if(kind==='story_cg'){
   assert.match(text,/关闭唯一画面块后再写正文/);
  }else{
   assert.match(text,/只必填一行英文场景/);
   assert.doesNotMatch(text,/^正文依据：/m);
  }
  assert.match(text,/人物：/);
  assert.doesNotMatch(text,/^【人物\s+\d+】/m);
  assert.equal([...text.matchAll(/^登记DNA：/gm)].length,kind==='character_intro'?1:0);
  assert.match(text,/<ad-wardrobe id="protocol">/);
 }
});
test('a static request keeps the explicit scene, shot and selected ratio',()=>{
 const r=req('story_cg','nai45','',{config:{format:'nai45',maxActors:4,shot:'full',ratio:'2:3'},request:'只画女主在图书馆窗边读书'});
 const text=Core.buildInstruction(r,rules,[]);
 assert.match(text,/只画女主在图书馆窗边读书/);
 assert.doesNotMatch(text,/最多两位清晰主体/);
 assert.match(text,/本轮镜头范围：全身/);
 assert.match(text,/构图参考画幅 2:3/);
 assert.match(text,/只拍摄静态画面/);
 assert.doesNotMatch(text,/<ad-wardrobe id="protocol">/);
});
test('only the NAI example includes category count tags',()=>{
 const generic=Core.buildInstruction(req('story_cg','generic'),rules,[]);
 const nai=Core.buildInstruction(req('story_cg','nai45'),rules,[]);
 assert.match(generic,/场景：medium close-up, waist-up framing, soft window light/);
 assert.match(nai,/场景：medium close-up, waist-up framing, 1girl/);
});

test('two-character framing preserves the action when adjusting the camera',()=>{
 for(const format of ['nai45','generic']){
  const text=Core.buildInstruction(req('story_cg',format,'我递杯给她'),rules,[]);
  assert.match(text,/先用角度与裁切找到能看懂主要动作的镜头/);
  assert.match(text,/保留已明确的位置、支撑、动作和接触点/);
  assert.match(text,/明确指定的镜头、人物、道具或环境优先/);
 }
});
