'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {core,fixture,turn}=require('./helpers/equipment-fixture.cjs');
const rules=require('../src/assets/director-rules.json');

const equipment=Object.fromEntries(core.Wardrobe.SLOTS.map(slot=>[slot,null]));
const item=(name,state='worn')=>({name,state,visible:true});
const dna={schema:1,slots:{typeAge:'adult woman',height:'180 cm tall',hair:'black bob',eyes:'round amber eyes',extra1:'mole below left eye'}};
const actor={name:'林夏',form:'默认形态',registrationDNA:dna,identity:core.DNA.snapshotIdentity(dna),
 equipment:{...equipment,TOP:[item('navy coat','left cuff rolled')],LOWER:[item('long black skirt')],ACCESSORIES:[item('burgundy scarf')]}};
const plan={scene:'portrait, looking toward the window',characters:[{...actor,frameSelection:{appearance:['hair','eyes'],outfit:['navy coat']}}]};

test('frame selection round-trips and safely selects short prompts in both formats',()=>{
 const serialized=core.VisualProtocol.format(plan,'f');
 const parsed=core.readDirectorOutput(serialized,{kind:'story_cg'},[]).plan;
 assert.deepEqual(parsed.characters[0].frameSelection,plan.characters[0].frameSelection);
 for(const format of ['nai45','generic']){
  const r=core.compose(parsed,{}, {format});
  assert.match(r.prompt,/black bob|round amber eyes/);
  assert.match(r.prompt,/mole below left eye/);
  assert.match(r.prompt,/left cuff rolled/);
  assert.match(r.prompt,/burgundy scarf/);
  assert.doesNotMatch(r.prompt,/180 cm|long black skirt/);
  assert.ok(r.renderAudit.removed.some(item=>item.reason==='frame-selection'));
  assert.equal(core.frameCompressionPrompt(r,{}),'');
 }
 assert.equal(parsed.characters[0].registrationDNA.slots.height,'180 cm tall');
 assert.equal(parsed.characters[0].equipment.LOWER[0].name,'long black skirt');
});

test('an invalid reference falls back for its own field and old plans keep compiling',()=>{
 const base=core.compose({...plan,characters:[actor]},{},{format:'nai45'});
 const r=core.compose({...plan,characters:[{...actor,frameSelection:{appearance:['unknown'],outfit:['navy coat']}}]},{},{format:'nai45'});
 assert.equal(r.sections.characters[0].identity,base.sections.characters[0].identity);
 assert.doesNotMatch(r.sections.characters[0].outfit,/long black skirt/);
 const legacy=core.compose({...plan,characters:[{...actor,registrationDNA:undefined,
  frameSelection:{appearance:['black bob'],outfit:['dark green coat']}}]},{},{format:'nai45'});
 assert.match(legacy.sections.characters[0].outfit,/long black skirt/);
 assert.match(legacy.sections.characters[0].identity,/black bob/);
 assert.equal(legacy.sections.characters[0].identity,base.sections.characters[0].identity);
 assert.match(legacy.sections.characters[0].identity,/round amber eyes/);
});

test('first design accepts compact structured DNA and legacy plain descriptions',()=>{
 const request={kind:'character_intro',targetName:'林夏',config:{format:'nai45'}};
 const instr=core.buildInstruction(request,rules,[]);
 assert.match(instr,/登记DNA：\{"schema":1,"slots"/);
 const wrap=fields=>'<ad-visual>\n场景：portrait, looking toward the window\n人物：林夏\n'+fields+'\n</ad-visual>';
 const direct=core.readDirectorOutput(wrap('登记DNA：{"schema":1,"slots":{"typeAge":"adult woman","hair":"black bob, black bob","eyes":"brown eyes"}}'),request,[]).plan;
 assert.equal(direct.characters[0].registrationDNA.slots.hair,'black bob');
 assert.equal(direct.characters[0].registrationDNA.slots.eyes,'brown eyes');
 const legacy=core.readDirectorOutput(wrap('外貌：adult woman, black bob, brown eyes'),request,[]).plan;
 assert.equal(legacy.characters[0].registrationDNA.slots.hair,'black bob');
});

test('tuning replaces stale selections and preserves the newly changed slot',async t=>{
 const f=fixture();
 t.after(()=>f.app.close());
 await f.app.load();
 await turn(f,{mid:11,plan,body:'她站在窗边。'});
 const original=(await f.app.readRecord(11)).images[0];
 assert.deepEqual(original.plan.characters[0].frameSelection,plan.characters[0].frameSelection);
 f.tavo.generate=async prompt=>{
  assert.match(prompt,/frameSelections/);
  return JSON.stringify({scene:'medium shot, seated by the window',dnaChanges:[{index:0,slots:{eyes:'blue eyes, blue eyes'}}],frameSelections:[{index:0,appearance:['hair'],outfit:['navy coat']}]});
 };
 await f.app.tune(11,original.id,'坐下，瞳色变为蓝色');
 const revised=(await f.app.readRecord(11)).images.at(-1);
 assert.equal(revised.plan.characters[0].registrationDNA.slots.eyes,'blue eyes');
 assert.deepEqual(revised.plan.characters[0].frameSelection.appearance,['hair','eyes']);
 assert.match(revised.prompt,/blue eyes/);
 assert.doesNotMatch(revised.prompt,/round amber eyes/);
});
