'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Rules=require('../src/director-rules.cjs');
const Core=require('../src/core.cjs');
const catalog=require('../src/assets/director-rules.json');
const ui=fs.readFileSync(path.join(__dirname,'../src/ui/menu.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../src/app.cjs'),'utf8');

function req(kind='story_cg',format='nai45',extra={}){
 return {id:'alpha234-clear-subject',kind,request:'',storyInput:'继续剧情',targetName:'示例角色',targetForm:'默认形态',style:{positive:'game cg'},config:{format,maxActors:2,shot:'near'},...extra};
}
function count(text,part){return String(text).split(part).length-1;}

test('alpha234: one shared clear-subject definition is required and included once in every director prompt',()=>{
 assert.ok(catalog.clearSubjectDefinition);
 assert.ok(Rules.REQUIRED.includes('clearSubjectDefinition'));
 for(const kind of ['story_cg','character_intro'])for(const format of ['nai45','generic']){
  const text=Core.buildInstruction(req(kind,format),catalog,[]);
  assert.equal(count(text,catalog.clearSubjectDefinition),1,`${kind}/${format} should receive the shared definition exactly once`);
 }
});

test('alpha234: player fragments, ordinary cast all defer to the same definition',()=>{
 for(const key of ['castComposition','identityContinuity','nai45Format']){
  assert.match(catalog[key],/统一清晰主体定义/,`${key} should reference the shared definition`);
 }
 assert.match(catalog.clearSubjectDefinition,/可辨认的脸/);
 assert.match(catalog.clearSubjectDefinition,/足够的上半身、身体或人物轮廓/);
 assert.match(catalog.clearSubjectDefinition,/无法独立辨认为一个人物形象时，不计入清晰主体/);
 assert.match(catalog.clearSubjectDefinition,/不因其属于玩家局部、画面边缘或遮挡而改变/);
 assert.match(catalog.castComposition,/按「统一清晰主体定义」统计画面实际可辨认的人物/);
});


test('alpha234: cast selection has no player-specific camera rule or structured player ID',()=>{
 assert.equal(Object.hasOwn(catalog,'playerCamera'),false);
 assert.doesNotMatch(app,/playerCharacterId|player_character_id/);
});

test('alpha234: the built-in cast rule replaces the actor-limit UI',()=>{
 assert.doesNotMatch(ui,/studio-actor-options|ad-max/);
 assert.doesNotMatch(catalog.castComposition,/最多两位清晰主体/);
});
