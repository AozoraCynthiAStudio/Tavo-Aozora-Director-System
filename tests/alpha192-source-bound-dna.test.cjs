'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Core=require('../src/core.cjs');
const rules=require('../src/assets/director-rules.json');
const DNA=Core.DNA;

test('alpha192 first-character design only allows extra5 for explicit card/worldbook/player facts, not AI embellishments',()=>{
 const instruction=Core.buildInstruction({id:'alpha192-first',kind:'character_intro',targetName:'测试人物',targetForm:'默认形态',style:{positive:'artist:test'},config:{format:'nai45'}},rules,[]);
 assert.match(instruction,/人物卡、世界书或玩家明确/);
 assert.match(instruction,/四个扩展槽已占用/);
 assert.match(instruction,/AI自行补充的外貌不得触发超12槽/);
 assert.match(instruction,/超12槽/);
 assert.match(instruction,/同一部位的颜色、形状等信息合并成一条/);
});

test('alpha192 story appearance and tuning instructions prioritize replacing slots and require user-requested extras',()=>{
 const instruction=Core.buildInstruction({id:'alpha192-story',kind:'story_cg',storyInput:'你好',style:{positive:'artist:test'},config:{format:'nai45'}},rules,[]);
 assert.match(instruction,/人物卡、世界书或玩家明确指定的特征/);
 assert.match(instruction,/AI自行补充的外貌不得触发超12槽/);
 const appSource=require('node:fs').readFileSync(require('node:path').join(__dirname,'../src/app.cjs'),'utf8');
 assert.match(appSource,/core.DNA.instruction/);
 assert.match(appSource,/独立新特征按统一人物DNA原则使用扩展槽/);
 assert.match(Core.DNA.instruction,/不机械翻译原句/);
});

test('alpha192 preserves all explicit extra5 facts and legacy slots without length pruning',()=>{
 const old=DNA.snapshot({slots:{typeAge:'adult woman',eyes:'round black eyes',bodyA:'broad shoulders',bodyB:'wide hips',markA:'scar on knee',markB:'mole under eye'}});
 const snapshot=DNA.snapshot({slots:{...old.slots,extra5:'two black curved horns'}});
 assert.equal(snapshot.slots.extra1,'broad shoulders');
 assert.equal(snapshot.slots.extra3,'scar on knee');
 assert.equal(snapshot.slots.extra5,'two black curved horns');
 assert.match(DNA.snapshotIdentity(snapshot),/two black curved horns$/);
 assert.equal(DNA.snapshotIdentity(DNA.snapshot(snapshot)),DNA.snapshotIdentity(snapshot));
 const withEyeEdit=DNA.snapshot({slots:{...snapshot.slots,...DNA.overrides({eyes:'narrow black eyes'})}});
 assert.equal(withEyeEdit.slots.eyes,'narrow black eyes');
 assert.equal(withEyeEdit.slots.extra5,'two black curved horns');
});
