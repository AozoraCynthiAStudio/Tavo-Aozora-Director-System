'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../src/core.cjs');

const empty=Object.fromEntries(Core.Wardrobe.SLOTS.map(slot=>[slot,null]));
const equipment=(...names)=>({...empty,ACCESSORIES:names.map(name=>({name,visible:true}))});
const people=[
 {name:'Lin',identity:'adult woman, long black hair, pale ivory skin, small mole directly below the left eye',equipment:equipment('burgundy silk scarf with soft folds','round gold glasses','silver wristwatch','navy belt with brass ring')},
 {name:'Qing',identity:'adult woman, short red hair, bright amber eyes, small scar just above the right eyebrow',equipment:equipment('muted green cotton scarf with subtle folds','rectangular silver glasses')}
];

test('common hand and finger close-ups retain the wristwatch and exclude belt hardware',()=>{
 for(const scene of ['close-up of her gloved hands, fingers touch the key','extreme close-up of fingers, a brass key','hands only, without showing her face']){
  const r=Core.compose({scene,characters:[people[0]]},{},{format:'nai45'});
  assert.equal(r.renderAudit.crop,'hands',scene);
  assert.match(r.sections.characters[0].outfit,/silver wristwatch/);
  assert.doesNotMatch(r.sections.characters[0].outfit,/belt/);
  assert.doesNotMatch(r.sections.characters[0].identity,/mole|hair/);
 }
});

test('hand and face combined framing retains face details even when the camera clause is later',()=>{
 for(const scene of ['close-up of hands and face, she looks at a ring','by the window, close-up of hands and face','close-up of hands, her face is also visible in the background']){
  const r=Core.compose({scene,characters:[people[0]]},{},{format:'nai45'});
  assert.equal(r.renderAudit.crop,'unknown',scene);
  assert.equal(r.renderAudit.faceOffFrame,false);
  assert.match(r.sections.characters[0].identity,/mole directly below the left eye/);
 }
});

test('frame compression retains fields that swap or drop protected facts while accepting the other fields',()=>{
 const style={positive:'game cg'};
 for(const format of ['nai45','generic']){
  const base=Core.compose({scene:'medium shot, two women compare their keys',characters:people},style,{format});
  const response={characters:[
   {index:0,identity:'adult woman',outfit:'green scarf, rectangular silver glasses'},
   {index:1,identity:'short red hair, scar above right brow',outfit:'green scarf, rectangular silver glasses'}
  ]};
  const result=Core.applyFrameCompression(base,style,JSON.stringify(response),'f');
  assert.equal(result.sections.base,base.sections.base);
  assert.equal(result.sections.characters[0].identity,base.sections.characters[0].identity);
  assert.equal(result.sections.characters[0].outfit,base.sections.characters[0].outfit);
  assert.equal(result.sections.characters[1].outfit,'green scarf, rectangular silver glasses');
  assert.match(result.sections.characters[1].identity,/scar above right brow/);
  assert.deepEqual(result.renderAudit.frameCompression.retained.map(x=>x.field),['identity','outfit']);
 }
});

test('when all attempts lose positional marks or scarf colors the old prompt is kept and audited',()=>{
 const base=Core.compose({scene:'medium shot, two women face each other',characters:people},{},{format:'nai45'});
 const response={characters:[
  {index:0,identity:'black hair, mole below right eye',outfit:'scarf, gold glasses'},
  {index:1,identity:'red hair, scar above left brow',outfit:'burgundy scarf, silver glasses'}
 ]};
 const result=Core.applyFrameCompression(base,{},JSON.stringify(response),'f');
 assert.equal(result.prompt,base.prompt);
 assert.equal(result.renderAudit.frameCompression.status,'retained');
 assert.equal(result.renderAudit.frameCompression.retained.length,4);
});
