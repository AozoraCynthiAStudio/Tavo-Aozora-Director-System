'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../src/core.cjs');

const item=(name,state='',visible=true)=>({name,state,visible});
const equipment=Object.fromEntries(Core.Wardrobe.SLOTS.map(slot=>[slot,null]));
const actor={
 name:'Lin',form:'默认形态',
 registrationDNA:{schema:1,slots:{typeAge:'adult woman',hair:'black ponytail',eyes:'gray eyes',height:'186 cm tall',skin:'pale skin',extra1:'crescent scar on left knuckle',extra2:'mole below right eye'}},
 equipment:{...equipment,HEAD:[item('red beret')],TOP:[item('white lace cuff blouse','left cuff rolled')],LOWER:[item('dark skirt')],FOOTWEAR:[item('leather boots')],HAND:[item('black leather glove','on left hand'),item('another glove','',false)],ACCESSORIES:[item('gold ring on right index finger'),item('nose ring'),item('pearl necklace')]}
};
const other={
 name:'Qing',form:'默认形态',
 identity:'adult woman, olive skin, black bob, narrow shoulders, painted fingernails',
 equipment:{...equipment,TOP:[item('navy jacket','rolled cuffs')],LOWER:[item('cream trousers')],ACCESSORIES:[item('silver bracelet')]}
};
const scene='close-up of hands, hands only, two hands across the counter, a hand on the left passes a brass key to the hand on the right';
const plan={scene,characters:[actor,other]};

test('hand close-up retains local marks and ownership while excluding off-frame appearance and clothes',()=>{
 const before=structuredClone(plan);
 for(const format of ['nai45','generic']){
  const result=Core.compose(plan,{}, {format});
  assert.equal(result.renderAudit.crop,'hands');
  assert.equal(result.renderedScene,scene);
  const [left,right]=result.sections.characters;
  assert.match(left.identity,/crescent scar on left knuckle/);
  assert.match(left.outfit,/white lace cuff, left cuff rolled/);
  assert.match(left.outfit,/black leather glove, on left hand/);
  assert.match(left.outfit,/gold ring on right index finger/);
  assert.match(right.identity,/painted fingernails/);
  assert.match(right.outfit,/rolled cuffs, silver bracelet/);
  assert.doesNotMatch(result.prompt,/black bob|black ponytail|mole below|gray eyes|186 cm|dark skirt|cream trousers|blouse|navy jacket|beret|boots|nose ring|pearl necklace|another glove/);
  assert.ok(result.renderAudit.removed.some(row=>row.reason==='outside-hand-closeup'&&row.text==='dark skirt'));
 }
 assert.deepEqual(plan,before);
});

test('normal and ambiguous shots keep the relevant full outfit',()=>{
 for(const scene of ['medium shot, hands holding a brass key','close-up of hands, medium shot, either height works']){
  const result=Core.compose({...plan,scene},{},{format:'nai45'});
  assert.notEqual(result.renderAudit.crop,'hands');
  assert.match(result.sections.characters[0].outfit,/white lace cuff blouse/);
  assert.match(result.sections.characters[1].outfit,/cream trousers/);
 }
});
