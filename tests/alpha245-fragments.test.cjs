'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {fixture,turn,core}=require('./helpers/equipment-fixture.cjs');
const {SLOTS}=require('../src/wardrobe.cjs');

const profile={name:'顾远',aliases:['阿远'],form:'默认形态',registrationDNA:{schema:1,slots:{
 skin:'tan skin',hair:'silver hair',height:'190 cm tall',extra1:'scar on right wrist',extra2:'tattoo on left wrist'
}}};
const equipment=Object.fromEntries(SLOTS.map(slot=>[slot,null]));
const scene='medium close-up, 1girl, a single red mug rests between the seated woman’s hands on its sides and two hands @limb1@ supporting its base';
const plan={scene,description:'她坐着接住红杯。',fragments:[{name:'阿远',region:'hands-and-forearms',side:'right'}],characters:[{name:'林夏',identity:'adult woman',equipment}]};

test('normal director flow attaches only known local details to the shared object contact',async()=>{
 const f=fixture([{name:'顾远',equipment:{...equipment,ACCESSORIES:[
  {name:'watch on right wrist',visible:true},{name:'bracelet',visible:true}
 ]}}],[profile]);
 await f.app.load();
 try{
  await f.app.saveConfig({format:'nai45'});
  const {prep}=await turn(f,{plan});
  assert.match(prep.text,/共同接触的道具只点名一次/);
  const {prompt,sections}=f.compiled[0];
  assert.equal(sections.characters.length,1);
  assert.equal((prompt.match(/red mug/g)||[]).length,1);
  assert.match(sections.base,/two hands with tan skin and scar on right wrist and watch on right wrist supporting its base/);
  assert.doesNotMatch(prompt,/@limb|silver hair|190 cm|left wrist|bracelet|顾远/);
 }finally{f.app.close();}
});

test('missing, ambiguous, or misplaced references leave the original contact intact',()=>{
 for(const [value,profiles] of [
  [plan,[]],
  [plan,[profile,{...profile,name:'另一人'}]],
  [{...plan,fragments:[{name:'阿远',region:'feet'}]},[profile]]
 ]){
  const result=core.resolveFragments(value,profiles);
  assert.equal(result.scene,scene.replace(' @limb1@',''));
 }
 const result=core.resolveFragments({...plan,fragments:[{name:'阿远',region:'hands-and-forearms'}]},[profile]);
 assert.match(result.scene,/two hands with tan skin/);
 assert.doesNotMatch(result.scene,/right wrist|left wrist/);
});
