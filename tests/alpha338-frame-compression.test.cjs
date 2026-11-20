'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture,turn,core}=require('./helpers/equipment-fixture.cjs');

const equipment=name=>({...Object.fromEntries(core.Wardrobe.SLOTS.map(slot=>[slot,null])),FULL:[{name,state:'worn'}]});
const scene='wide shot, 2girls, a stormy observatory, the woman on the left stands gripping a cable, the woman on the right kneels and raises a brass lantern';
const verbose=Array.from({length:20},(_,i)=>'detailed face and hair description with redundant modifier '+i).join(', ');
const plan={scene,characters:[
 {name:'林夏',identity:'adult woman, black ponytail, green eyes, '+verbose+', mole below left eye',equipment:equipment('navy wool cape')},
 {name:'许晴',identity:'adult woman, short copper bob, amber eyes, '+verbose+', freckles',equipment:equipment('rust red jacket and cream trousers')}
]};
const summary={characters:[
 {index:0,identity:'girl, black ponytail, green eyes, mole below left eye',outfit:'navy wool cape'},
 {index:1,identity:'girl, short copper bob, amber eyes, freckles',outfit:'rust red jacket and cream trousers'}
]};

test('frame compression updates only appearance and clothing in the canonical NAI request',()=>{
 const compiled=core.compose(plan,{positive:'game cg'},{format:'nai45'});
 const request=core.frameCompressionPrompt(compiled,{positive:'game cg'},{pictureRequest:'提灯'});
 assert.match(request,/提灯/);
 const next=core.applyFrameCompression(compiled,{positive:'game cg'},JSON.stringify(summary),'test');
 assert.equal(next.sections.base,compiled.sections.base);
 assert.equal(next.renderedScene,compiled.renderedScene);
 assert.equal(next.requestedSeed,compiled.requestedSeed);
 assert.equal(next.budgetAudit.overBudget,false);
 assert.equal(next.budgetAudit.sections.characters[1].outfit,'rust red jacket and cream trousers');
 assert.equal(next.renderAudit.frameCompression.status,'applied');
 assert.match(compiled.prompt,/redundant/);
 assert.doesNotMatch(next.prompt,/redundant/);
 assert.throws(()=>core.applyFrameCompression(compiled,{},JSON.stringify({characters:[summary.characters[1],summary.characters[0]]}),'test'),/顺序/);
});

test('generic image prompts retain natural sentences and ordinary prompts skip compression',()=>{
 const compiled=core.compose(plan,{positive:'game cg'},{format:'generic'});
 const natural={characters:summary.characters.map(c=>({...c,identity:c.identity.replace(/^girl/,'adult woman')}))};
 const next=core.applyFrameCompression(compiled,{positive:'game cg'},JSON.stringify(natural),'test');
 assert.match(next.prompt,/林夏 is wearing navy wool cape/);
 assert.match(next.prompt,/kneels and raises a brass lantern/);
 assert.equal(next.budgetAudit,null);
 assert.equal(core.frameCompressionPrompt(next,{positive:'game cg'}),'');
});

test('NAI keeps the original type when compressed phrases omit it and refuses an incompatible explicit type',()=>{
 const compiled=core.compose(plan,{},{format:'nai45'});
 const phrases={characters:summary.characters.map(c=>({...c,identity:c.identity.replace(/^girl, /,'adult woman, ')}))};
 const next=core.applyFrameCompression(compiled,{},JSON.stringify(phrases),'test');
 assert.ok(next.sections.characters.every(c=>c.identity.startsWith('girl, adult woman,')));
 assert.ok(next.sections.characters.every(c=>!c.identity.includes('girl, girl,')));
 phrases.characters[0].identity='boy, black ponytail';
 assert.throws(()=>core.applyFrameCompression(compiled,{},JSON.stringify(phrases),'test'),/人物类型/);
});

test('story image submission sends the compressed request while saving the full plan',async t=>{
 const f=fixture();
 t.after(()=>f.app.close());
 await f.app.load();
 let calls=0;
 let phase;
 f.app.subscribe(event=>{if(event.type==='activity')phase=event.activity.phase;});
 f.tavo.generate=async(prompt,options)=>{
  calls++;
  assert.equal(phase,'generating');
  assert.match(prompt,/本帧精简/);
  assert.equal(options.context,false);
  return JSON.stringify(summary);
 };
 await turn(f,{mid:11,plan,body:'她们在天文台交接提灯。'});
 const record=await f.app.readRecord(11);
 assert.equal(calls,1);
 assert.equal(record.status,'done');
 assert.equal(record.images[0].renderAudit.frameCompression.status,'applied');
 assert.match(record.images[0].plan.characters[0].identity,/redundant/);
 assert.doesNotMatch(f.compiled[0].prompt,/redundant/);
});

test('invalid compression falls back without blocking the image request',async t=>{
 const f=fixture();
 t.after(()=>f.app.close());
 await f.app.load();
 f.tavo.generate=async()=>'{invalid';
 await turn(f,{mid:11,plan,body:'她们在天文台交接提灯。'});
 const record=await f.app.readRecord(11);
 assert.equal(record.status,'done');
 assert.equal(record.images[0].renderAudit.frameCompression.status,'fallback');
 assert.match(f.compiled[0].prompt,/redundant/);
});
