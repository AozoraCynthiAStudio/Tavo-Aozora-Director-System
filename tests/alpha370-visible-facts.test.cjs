'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../src/core.cjs');
const W=Core.Wardrobe;
const dna={schema:1,slots:{typeAge:'adult woman, 22 years old',height:'170 cm tall',hair:'long red curly hair',eyes:'green eyes',skin:'fair clear skin',face:'oval face',build:'average build'}};
const equipment=W.normalizeEquipment({HEAD:[],TOP:[{name:'blue coat'}],LOWER:[{name:'white skirt'}],FULL:[],LEGWEAR:[{name:'black tights'}],FOOTWEAR:[{name:'brown boots'}],HAND:[],ACCESSORIES:[]});
const actor={name:'Alice',form:'默认形态',registrationDNA:dna,identity:Core.DNA.snapshotIdentity(dna),equipment};
const full='full-body shot, head-to-toe framing, 1girl, a woman holding an umbrella';
const compose=(scene,selection,format='nai45')=>Core.compose({scene,characters:[{...actor,frameSelection:selection}]},{},{format});
function compress(compiled,identity,outfit){return Core.applyFrameCompression(compiled,{},JSON.stringify({characters:[{index:0,identity,outfit}]}),'visible-facts-test');}

test('empty frame selections cannot erase full-body identity or principal clothing',()=>{
 for(const format of ['nai45','generic']){
  const compiled=compose(full,{appearance:[],outfit:[]},format),character=compiled.sections.characters[0];
  for(const fact of ['long red curly hair','green eyes','fair clear skin','average build'])assert.ok(character.identity.includes(fact),fact);
  for(const garment of ['blue coat','white skirt','black tights','brown boots'])assert.ok(character.outfit.includes(garment),garment);
  assert.match(character.identity,/fair clear skin/);
 }
});

test('lower-body selection retains skin, hair, build and visible clothing without restoring off-frame facial details',()=>{
 const compiled=compose('lower-body shot, 1girl, a woman holding an umbrella, face out of frame',{appearance:['build'],outfit:[]});
 const character=compiled.sections.characters[0];
 for(const fact of ['fair clear skin','long red curly hair','average build'])assert.ok(character.identity.includes(fact),fact);
 assert.doesNotMatch(character.identity,/green eyes|oval face/);
 assert.match(character.outfit,/white skirt/);
 assert.match(character.outfit,/black tights/);
 assert.ok(!compiled.protectedAppearance[0].includes('green eyes'),'compression protection uses the already projected identity');
});

test('torso-only empty clothing selection preserves the actual coat instead of becoming an empty outfit',()=>{
 const compiled=compose('torso-only, 1girl, a woman holding an umbrella, face out of frame',{appearance:[],outfit:[]});
 assert.match(compiled.sections.characters[0].outfit,/blue coat/);
 assert.match(compiled.sections.characters[0].identity,/fair clear skin|average build/);
 assert.doesNotMatch(compiled.sections.characters[0].identity,/green eyes|oval face/);
});

test('selection may still omit a skirt outside a portrait without deleting the visible coat',()=>{
 const compiled=compose('portrait, 1girl, a woman looking toward a window',{appearance:['hair'],outfit:['blue coat']});
 assert.match(compiled.sections.characters[0].outfit,/blue coat/);
 assert.doesNotMatch(compiled.sections.characters[0].outfit,/white skirt|black tights/);
 assert.match(compiled.sections.characters[0].identity,/green eyes/);
});

test('registered visible DNA and outfit cannot be replaced by a different shorter set',()=>{
 const compiled=compose(full,undefined);
 const next=compress(compiled,'blonde hair','purple dress');
 assert.equal(next.prompt,compiled.prompt);
 assert.equal(next.renderAudit.frameCompression.status,'retained');
 assert.deepEqual(next.renderAudit.frameCompression.retained.map(row=>row.field),['identity','outfit']);
});

test('unregistered identity and clothing remain protected from color and garment swaps',()=>{
 const plain={name:'Alice',identity:'adult woman, long red hair, green eyes, fair skin',equipment};
 const compiled=Core.compose({scene:full,characters:[plain]},{},{format:'nai45'});
 for(const [identity,outfit]of [
  ['girl, blonde hair','purple dress'],
  ['girl, adult woman, long green hair, red eyes, fair skin',compiled.sections.characters[0].outfit],
  [compiled.sections.characters[0].identity,'blue skirt, white coat, black tights, brown boots']
 ]){
  const next=compress(compiled,identity,outfit);
  assert.equal(next.prompt,compiled.prompt);
  assert.equal(next.renderAudit.frameCompression.status,'retained');
 }
});

test('compression may remove exact repetitions and explicit ornamental clauses while preserving facts',()=>{
 const plain={name:'Alice',identity:'adult woman, black hair, green eyes, black hair, beautiful',equipment};
 const compiled=Core.compose({scene:full,characters:[plain]},{},{format:'nai45'});
 const original=compiled.sections.characters[0];
 const next=compress(compiled,'girl, adult woman, black hair, green eyes',original.outfit);
 assert.equal(next.renderAudit.frameCompression.status,'applied');
 assert.match(next.sections.characters[0].identity,/adult woman, black hair, green eyes/);
 assert.doesNotMatch(next.sections.characters[0].identity,/beautiful/);
 assert.equal(next.sections.characters[0].outfit,original.outfit);
});

test('compression preserves explicit user weights and their scope',()=>{
 const plain={name:'Alice',identity:'adult woman, 1.5::long red hair::, green eyes, beautiful',equipment};
 const compiled=Core.compose({scene:full,characters:[plain]},{},{format:'nai45'});
 const next=compress(compiled,'girl, adult woman, long red hair, green eyes',compiled.sections.characters[0].outfit);
 assert.equal(next.prompt,compiled.prompt);
 assert.match(next.prompt,/1\.5::long red hair::/);
});

test('a skirt-suit jacket is classified as a jacket and explicit jacket length stays unchanged',()=>{
 assert.equal(W.specificGarmentName('dark skirt suit jacket'),'dark skirt suit jacket, hip-length');
 assert.equal(W.specificGarmentName('dark skirt suit jacket, knee-length'),'dark skirt suit jacket, knee-length');
 assert.equal(W.specificGarmentName('dark pencil skirt'),'dark pencil skirt, knee-length');
});
