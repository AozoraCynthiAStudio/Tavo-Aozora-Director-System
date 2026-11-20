'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../src/core.cjs');
const rules=require('../src/assets/director-rules.json');
const {SLOTS}=require('../src/wardrobe.cjs');
const equipment={...Object.fromEntries(SLOTS.map(slot=>[slot,null])),FOOTWEAR:[],FULL:[{name:'long beige knit dress',visible:true}]};
const actor={name:'A',identity:'adult female, very tall woman (2.5 m), broad shoulders',equipment,relation:'seated on chair, source#receiving'};

test('hand framing excludes off-frame stature and clothes from the prompt',()=>{
 const plan={scene:'close-up of hands, 1girl, her hands steady a parcel as a hand from outside the frame slides beneath it',characters:[actor]};
 const compiled=Core.compose(plan,{},{format:'nai45'});
 assert.equal(compiled.renderedScene,plan.scene);
 assert.doesNotMatch(compiled.prompt,/2\.5 m|barefoot|tall woman|broad shoulders|knit dress/);
 assert.ok(compiled.renderAudit.removed.some(row=>row.slot==='FULL'&&row.reason==='outside-hand-closeup'));
 assert.deepEqual(actor.equipment.FOOTWEAR,[]);
 assert.match(actor.identity,/2\.5 m/);
 const wider=Core.compose({...plan,scene:'full body, 1girl, a woman stands by a table'},{},{format:'nai45'});
 assert.match(wider.prompt,/2\.5 m/);
 assert.match(wider.prompt,/barefoot/);
 assert.match(wider.prompt,/long beige knit dress/);
});

test('compile removes plain duplicates while preserving weighted phrases and actor scope',()=>{
 const positive='soft lineart, Soft Lineart, 1.2::gentle shading, warm light::';
 const scene='medium shot, 1girl, soft lineart, warm light, medium shot, seated on chair, long beige knit dress, woman seated in a long beige knit dress';
 const result=Core.compose({scene,characters:[actor]},{positive},{format:'nai45'});
 assert.equal(result.prompt.match(/soft lineart/gi).length,1);
 assert.equal(result.prompt.match(/medium shot/g).length,1);
 assert.equal(result.prompt.match(/seated on chair/g).length,1);
 assert.match(result.prompt,/1\.2::gentle shading, warm light::, medium shot, 1girl, warm light/);
 assert.match(result.renderedScene,/woman seated in a long beige knit dress/);
 assert.equal(result.prompt.match(/long beige knit dress/g).length,2);
 const two=Core.compose({scene,characters:[actor,{...actor,name:'B'}]},{positive},{format:'nai45'});
 assert.equal(two.sections.characters.length,2);
 assert.ok(two.sections.characters.every(row=>row.prompt.includes('long beige knit dress')));
});

test('generic output preserves actor pose without leaking NAI interaction markers',()=>{
 const result=Core.compose({scene:'A woman receives a parcel',characters:[actor]},{},{format:'generic'});
 assert.match(result.prompt,/A's pose: seated on chair/);
 assert.doesNotMatch(result.prompt,/source#/);
});

test('director gives a fixed NAI limit and keeps the main subject and visible contact in focus',()=>{
 const instruction=Core.buildInstruction({kind:'story_cg',config:{format:'nai45',maxActors:6}},rules,[]);
 assert.match(instruction,/最多两位清晰主体/);
 assert.match(instruction,/优先选一位/);
 assert.match(instruction,/背景只用最少线索/);
 assert.match(instruction,/【可选局部参与者】/);
 assert.match(instruction,/人物：角色姓名/);
 assert.doesNotMatch(instruction,/【人物 1】|装备固定八部位/);
 const generic=Core.buildInstruction({kind:'story_cg',config:{format:'generic',maxActors:6}},rules,[]);
 assert.doesNotMatch(generic,/最多两位清晰主体/);
});
