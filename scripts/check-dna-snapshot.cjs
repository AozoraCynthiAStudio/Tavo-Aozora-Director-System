'use strict';
// Focused offline lifecycle check only. No host, paid provider or full suite.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture,turn,core}=require('../tests/helpers/equipment-fixture.cjs');
const dna=values=>core.DNA.snapshot({schema:1,slots:Object.fromEntries(core.DNA.keys.map(k=>[k,values[k]||'']))});
const initial=dna({typeAge:'adult woman, 29 years old',height:'188 cm tall',hair:'short brown bob',eyes:'dark narrow eyes',face:'strong jawline',bodyA:'exceptionally long legs',bodyB:'E cup',markA:'single canine tooth'});
const actor={name:'A',form:'默认形态',identity:core.DNA.snapshotIdentity(initial),registrationDNA:initial,equipment:core.Wardrobe.normalizeEquipment({TOP:[{name:'white shirt'}]}),action:'holding a cup'};
async function main(){
 const tall='adult woman, 188 cm tall, very tall, tall broad athletic build, thick muscular limbs, wide hips, exceptionally long legs';
 const small='adult man, 22 years old, 120 cm tall, very short stature, slender small build';
 for(const crop of ['portrait','upper']){const projected=core.DNA.project(tall,crop);for(const fact of ['188 cm tall','very tall','thick muscular limbs','wide hips','exceptionally long legs'])assert(projected.identity.includes(fact),fact);}
 assert(core.DNA.project(small,'upper').identity.includes('very short stature'));
 const bodyPlan={scene:'medium close-up, seated at a table',characters:[{...actor,identity:tall,registrationDNA:undefined},{...actor,name:'B',identity:small,registrationDNA:undefined}]};
 const rendered=core.compose(bodyPlan,{}, {format:'nai45'});assert(rendered.prompt.includes('tall female'));assert(rendered.prompt.includes('120 cm tall'));assert(rendered.prompt.includes('very short stature'));assert.equal(rendered.renderAudit.crop,'upper');
 const local=core.DNA.project('adult woman, fair skin, blue eyes, black hair, 188 cm tall, broad athletic build','feet');assert(!local.identity.includes('blue eyes'));assert(local.identity.includes('broad athletic build'));
 const formatted=core.VisualProtocol.format({scene:'portrait, cafe',characters:[actor]},'snapshot');
 assert.deepEqual(core.parseVisual(formatted,'snapshot').plan.characters[0].registrationDNA,initial);
 const rules=require('../src/assets/director-rules.json');
 const instruction=core.buildInstruction({id:'design',kind:'character_intro',targetName:'A',targetForm:'默认形态',config:{format:'nai45'}},rules,[]);
 assert(instruction.includes('同次体型对比'));assert(instruction.includes('不占槽位'));assert(instruction.includes('登记DNA：'));assert(instruction.includes('纯稳定外貌')||instruction.includes('仅含最终稳定外貌'));
 const old={name:'A',form:'默认形态',identity:'adult woman, 188 cm tall, long black hair, green eyes, small fang',aliases:['alias'],enabled:true};
 const f=fixture([],[old]);await f.app.load();await turn(f,{plan:{scene:'portrait, cafe',characters:[actor]}});
 await f.store.mutateRecord(2,r=>({...r,kind:'character_intro',images:r.images.map(i=>({...i,kind:'character_intro'}))}));
 const first=(await f.app.readRecord(2)).images[0],original=structuredClone(first);
 assert.deepEqual(first.plan.characters[0].registrationDNA,initial);
 assert(first.prompt.includes('exceptionally long legs'));assert(initial.slots.bodyA.includes('long legs'));
 const job=await f.app.registerCharacter(2,first.id,'A','默认形态');assert.equal(f.textCalls,0);await f.app.confirmRegistration(job.id,job.proposal.identity);
 let profile=f.app.snapshot().profiles[0];assert.deepEqual(profile.registrationDNA,initial);assert(!profile.identity.includes('long black hair'));assert(!profile.identity.includes('green eyes'));assert.deepEqual(profile.aliases,['alias']);
 const registered=structuredClone(profile),tuned=dna({...initial.slots,eyes:'violet narrow eyes'});let textCalls=0;
 f.tavo.generate=async prompt=>{textCalls++;assert(prompt.includes('dnaSnapshots'));assert(prompt.includes('完整最终快照'));return JSON.stringify({changes:[{index:0,identity:core.DNA.snapshotIdentity(tuned)}],dnaSnapshots:[{index:0,registrationDNA:tuned}],wardrobeUpdates:[]})};
 await f.app.tune(2,first.id,'眼睛改成紫色');assert.equal(textCalls,1);assert.deepEqual(f.app.snapshot().profiles[0],registered);
 let record=await f.app.readRecord(2),candidate=record.images.at(-1);assert.notEqual(candidate.id,first.id);assert.deepEqual(candidate.plan.characters[0].registrationDNA,tuned);assert.deepEqual(record.images[0],original);
 const next=await f.app.registerCharacter(2,candidate.id,'A','默认形态');await f.app.confirmRegistration(next.id,next.proposal.identity);assert.equal(textCalls,1);profile=f.app.snapshot().profiles[0];assert.deepEqual(profile.registrationDNA,tuned);assert(!profile.identity.includes('dark narrow eyes'));assert(profile.identity.includes('violet narrow eyes'));
 // A compatibility tuning reply may change appearance but omit the new snapshot.
 // It must not silently retain and register the source image's stale snapshot.
 f.tavo.generate=async()=>{textCalls++;return JSON.stringify({changes:[{index:0,identity:'adult woman, short red hair'}],wardrobeUpdates:[]})};
 await f.app.tune(2,candidate.id,'头发改红色');record=await f.app.readRecord(2);const missing=record.images.at(-1);assert.equal(missing.plan.characters[0].registrationDNA,undefined);assert(missing.prompt.includes('short red hair'));
 f.tavo.generate=async prompt=>{textCalls++;assert(prompt.includes('旧图片登记兼容提取'));assert(!prompt.includes('previousIdentity'));return JSON.stringify({registrationDNA:dna({typeAge:'adult woman',hair:'short red hair'})})};
 const fallback=await f.app.registerCharacter(2,missing.id,'A','默认形态');await f.app.confirmRegistration(fallback.id,fallback.proposal.identity);assert.equal(textCalls,3);
 const report={version:'0.1.0-alpha.168',passed:true,scope:'focused-offline-snapshot-lifecycle',realHost:false,realModelCalls:0,checks:['protocol and saved candidate retain complete DNA','portrait and upper framing preserve lifelong body traits and stature words','numeric height and short/tall descriptors coexist','same-reply comparison rules add no slots or calls','structured registration makes zero text calls','same-name/form DNA replaces old traits without merge','tuning makes one text call and leaves profile unchanged','tuned registration makes zero extra calls','original image prompt and seed untouched','missing updated snapshot cannot inherit stale DNA','legacy fallback extracts once without profile merging']};
 fs.mkdirSync(path.join(__dirname,'../dist'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../dist/dna-snapshot-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exitCode=1});
