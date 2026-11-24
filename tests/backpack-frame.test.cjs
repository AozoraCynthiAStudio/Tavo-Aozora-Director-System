'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../src/core.cjs');
test('backpack stays in the selected scene and does not enter clothing or registered identity',()=>{
 const equipment=Object.fromEntries(core.Wardrobe.SLOTS.map(slot=>[slot,null]));
 const actor={name:'A',identity:'black hair',equipment};
 const backpack={name:'red backpack'};
 const baseline=[{...actor,equipment:{...equipment,ACCESSORIES:[backpack,{name:'handbag'},{name:'shoulder camera'},{name:'folded umbrella'},{name:'gold earrings'}]}}];
 const plan={scene:'A stands by the window',characters:[actor]};
 const next=core.Wardrobe.resolveFrame(plan,baseline).plan.characters[0];
 assert.deepEqual(next.equipment.ACCESSORIES.map(item=>item.name),['gold earrings']);
 assert.equal(core.Wardrobe.resolveFrame({...plan,scene:'A carries a red backpack'},baseline).plan.scene,'A carries a red backpack');
 const [identity]=core.reuseRegisteredIdentity(plan,{kind:'story_cg'},[{name:'A',identity:'black hair, red backpack, silver camera'}]).plan.characters;
 assert.equal(identity.identity,'black hair');
});
