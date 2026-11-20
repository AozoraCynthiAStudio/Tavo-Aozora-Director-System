'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture,turn,core}=require('./helpers/equipment-fixture.cjs');

const name='林夏',form='默认形态';
const dna={schema:1,slots:{
 typeAge:'adult woman',
 height:'very tall, 185 cm',
 hair:'black low ponytail with wispy curtain bangs and a few glossy wisps',
 eyes:'round amber eyes, bright amber eyes',
 extra1:'small mole below left eye'
}};
const equipment=Object.fromEntries(core.Wardrobe.SLOTS.map(slot=>[slot,null]));
const plan={scene:'medium shot, standing beside a window',characters:[{
 name,form,registrationDNA:dna,equipment,appearanceOverrides:{eyes:'round green eyes, bright green eyes'}
}]};

async function candidate(f){
 await f.app.load();
 const record=await f.store.mutateRecord(2,r=>({...r,kind:'character_intro',images:[{
  id:'candidate',kind:'character_intro',plan:core.normalizedPlan(plan)
 }]}));
 return record.images[0];
}

test('registration compresses the selected effective DNA once and outpainting uses the saved phrases',async t=>{
 const f=fixture();
 t.after(()=>f.app.close());
 const image=await candidate(f);
 let calls=0;
 f.tavo.generate=async(prompt,options)=>{
  calls++;
  assert.equal(options.context,false);
  assert.match(prompt,/round green eyes, bright green eyes/);
  assert.doesNotMatch(prompt,/amber eyes|standing beside a window/);
  return {content:[{type:'thinking',text:'Ignore this'}, {type:'text',text:'<think>Discard this</think>\n'+JSON.stringify({slots:{hair:'black low ponytail, wispy curtain bangs',eyes:'round bright green eyes'}})}]};
 };
 const job=await f.app.registerCharacter(2,image.id,name,form);
 assert.deepEqual(await f.store.get('profiles','chat'),[]);
 await f.app.confirmRegistration(job.id,job.proposal.identity);
 const [profile]=await f.store.get('profiles','chat');
 assert.equal(calls,1);
 assert.equal(profile.registrationDNA.slots.hair,'black low ponytail, wispy curtain bangs');
 assert.equal(profile.registrationDNA.slots.eyes,'round bright green eyes');
 assert.equal(profile.registrationDNA.slots.extra1,dna.slots.extra1);
 assert.equal(profile.registrationDNA.slots.height,dna.slots.height);
 assert.deepEqual((await f.app.readRecord(2)).images[0].plan,image.plan);
 const reused=core.reuseRegisteredIdentity({...plan,characters:[{name,form,equipment,identity:'person'}]},{kind:'story_cg'},[profile]).plan;
 for(const format of ['nai45','generic']){
  const compiled=core.compose(reused,{}, {format});
  assert.match(compiled.prompt,/round bright green eyes/);
  assert.doesNotMatch(compiled.prompt,/glossy wisps/);
 }
});

test('invalid compression uses the original candidate DNA and waits for confirmation',async t=>{
 const previous={name,form,identity:'adult woman, short black hair'};
 const f=fixture([], [previous]);
 t.after(()=>f.app.close());
 const image=await candidate(f);
 for(const response of ['',JSON.stringify({slots:{height:'175 cm'}})]){
  f.tavo.generate=async()=>response;
  const job=await f.app.registerCharacter(2,image.id,name,form);
  assert.equal(job.status,'review');
  assert.equal(job.usedOriginalDNA,true);
  assert.deepEqual(await f.store.get('profiles','chat'),[previous]);
  assert.equal(job.proposal.registrationDNA.slots.height,dna.slots.height);
  assert.equal(job.proposal.registrationDNA.slots.eyes,'round green eyes, bright green eyes');
 }
 const job=await f.store.get('registration','chat');
 await f.app.confirmRegistration(job.id,job.proposal.identity);
 const [profile]=await f.store.get('profiles','chat');
 assert.deepEqual(profile.registrationDNA,job.proposal.registrationDNA);
 assert.deepEqual((await f.app.readRecord(2)).images[0].plan,image.plan);
});

test('registration accepts good compression while preserving bad slots and first-time candidate edits',async t=>{
 const f=fixture();
 t.after(()=>f.app.close());
 const image=await candidate(f);
 const parent={...image,id:'parent',plan:core.normalizedPlan({...plan,characters:[{...plan.characters[0],appearanceOverrides:{eyes:'amber eyes'}}]})};
 await f.store.mutateRecord(2,r=>({...r,images:[parent,{...image,directorContext:{sourceImageId:parent.id}}]}));
 f.tavo.generate=async(prompt)=>{
  assert.match(prompt,/特征，由程序保留原值[^\n]*eyes/);
  return JSON.stringify({slots:{
   height:'185 m',
   eyes:'blue eyes',
   hair:'black low ponytail, wispy curtain bangs',
   extra1:'small mole below right eye'
  }});
 };
 const job=await f.app.registerCharacter(2,image.id,name,form);
 assert.equal(job.proposal.registrationDNA.slots.height,dna.slots.height);
 assert.equal(job.proposal.registrationDNA.slots.eyes,'round green eyes, bright green eyes');
 assert.equal(job.proposal.registrationDNA.slots.hair,'black low ponytail, wispy curtain bangs');
 assert.equal(job.proposal.registrationDNA.slots.extra1,dna.slots.extra1);
 assert.equal(job.usedOriginalDNA,false);
});

test('candidate tuning retains missing legacy snapshot slots and does not submit empty replies',async t=>{
 const f=fixture();t.after(()=>f.app.close());
 const image=await candidate(f);
 f.messages.set(2,{id:2,role:'assistant',content:'She stands beside a window.'});
 await f.store.mutateRecord(2,r=>({...r,plan:image.plan,config:{format:'nai45'}}));
 f.tavo.generate=async()=>({text:''});
 await assert.rejects(f.app.tune(2,image.id,'瞳色改蓝色'),/未返回微调方案/);
 assert.equal(f.calls,0);
 f.tavo.generate=async()=>JSON.stringify({dnaSnapshots:[{index:0,registrationDNA:{schema:1,slots:{eyes:'round blue eyes'}}}]});
 await f.app.tune(2,image.id,'瞳色改蓝色');
 const [original,updated]=(await f.app.readRecord(2)).images;
 assert.equal(updated.plan.characters[0].registrationDNA.slots.hair,dna.slots.hair);
 assert.equal(updated.plan.characters[0].registrationDNA.slots.eyes,'round blue eyes');
 assert.deepEqual(original.plan,image.plan);
 assert.equal(f.calls,1);
});

test('registration shortening retains distinctive facial structure and accepts extractive edits',()=>{
 const source=core.DNA.snapshot({eyes:'narrow amber eyes, bright amber eyes, gentle gaze',face:'angular square face, well-defined cheekbones',hair:'short black bob, smooth texture'});
 const compressed=core.DNA.readRegistrationCompression(JSON.stringify({slots:{eyes:'round amber eyes',face:'round face',hair:'long black bob'}}),source);
 assert.deepEqual(compressed.dna,source);
 assert.deepEqual(compressed.rejectedSlots,['eyes','face','hair']);
 const good=core.DNA.readRegistrationCompression(JSON.stringify({slots:{eyes:'narrow amber eyes',hair:'short black bob'}}),source);
 assert.equal(good.dna.slots.eyes,'narrow amber eyes');
 assert.equal(good.dna.slots.hair,'short black bob');
 assert.deepEqual(good.rejectedSlots,[]);
});

test('story image tuning applies the latest slot and retains other effective overrides',async t=>{
 const f=fixture([], [{name,form,identity:core.DNA.snapshotIdentity(dna),registrationDNA:dna,enabled:true}]);
 t.after(()=>f.app.close());
 await f.app.load();
 const sourcePlan={...plan,characters:[{...plan.characters[0],appearanceOverrides:{eyes:'round green eyes',hair:'short black bob'}}]};
 await turn(f,{mid:11,body:'林夏站在窗边。',plan:sourcePlan});
 const old=(await f.app.readRecord(11)).images[0];
 f.tavo.generate=async()=>JSON.stringify({dnaChanges:[{index:0,slots:{eyes:'round blue eyes'}}]});
 await f.app.tune(11,old.id,'把瞳色改成蓝色');
 const [original,tuned]=(await f.app.readRecord(11)).images;
 assert.match(original.prompt,/round green eyes/);
 assert.match(tuned.prompt,/round blue eyes/);
 assert.match(tuned.prompt,/short black bob/);
 assert.doesNotMatch(tuned.prompt,/round green eyes/);
 assert.equal(tuned.plan.characters[0].appearanceOverrides,undefined);
 assert.equal(f.app.snapshot().profiles[0].registrationDNA.slots.eyes,dna.slots.eyes);
});
