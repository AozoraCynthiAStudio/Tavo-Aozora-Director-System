'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Core=require('../src/core.cjs');
const DNA=Core.DNA;
const rules=require('../src/assets/director-rules.json');

test('alpha191 character introduction asks for eight essential slots and leaves optional extras blank',()=>{
 const instruction=Core.buildInstruction({id:'test191',kind:'character_intro',targetName:'新人物',targetForm:'默认形态',style:{positive:'game cg'},config:{format:'nai45'}},rules,[]);
 assert.deepEqual(DNA.keys.slice(0,8),['typeAge','height','skin','hair','hairDetail','eyes','face','build']);
 assert.deepEqual(DNA.keys.slice(8),['extra1','extra2','extra3','extra4']);
 assert.match(instruction,/八个基础槽/);
 assert.match(instruction,/eyes优先合并眼型瞳色/);
 assert.match(instruction,/face以脸型为主/);
 assert.match(instruction,/稳定辨识特征：必须同时满足来源明确/);
 assert.match(instruction,/不为凑数量补造/);
 assert.doesNotMatch(instruction,/bodyA\/bodyB身体比例/);
 assert.doesNotMatch(instruction,/markA\/markB独特标记/);
});

test('alpha191 empty optional extras do not add fragments to a new DNA prompt',()=>{
 const snapshot=DNA.snapshot({schema:1,slots:{typeAge:'adult woman',hair:'short black bob',eyes:'round black eyes',face:'oval face'}});
 assert.equal(DNA.snapshotIdentity(snapshot),'adult woman, short black bob, round black eyes, oval face');
 assert.equal(DNA.keys.filter(k=>snapshot.slots[k]).length,4);
 assert.equal(snapshot.slots.extra1,'');
});

test('alpha191 legacy body/mark slots migrate without loss or phrase rewriting',()=>{
 const old={schema:1,slots:{typeAge:'adult woman, 29 years old',height:'188cm tall',skin:'tan skin',hair:'short black hair',hairDetail:'side swept bangs',eyes:'dark almond eyes',face:'square jaw',build:'athletic build',bodyA:'very large breasts',bodyB:'wide hips',markA:'scar on knee',markB:'mole below left eye'}};
 const expected=['typeAge','height','skin','hair','hairDetail','eyes','face','build','bodyA','bodyB','markA','markB'].map(k=>old.slots[k]).join(', ');
 const migrated=DNA.snapshot(old);
 assert.equal(DNA.snapshotIdentity(old),expected);
 assert.equal(DNA.snapshotIdentity(migrated),expected);
 assert.equal(migrated.slots.extra1,'very large breasts');
 assert.equal(migrated.slots.extra2,'wide hips');
 assert.equal(migrated.slots.extra3,'scar on knee');
 assert.equal(migrated.slots.extra4,'mole below left eye');
 assert.deepEqual(DNA.snapshot(migrated),migrated);
});

test('alpha191 player tuning merges an eye change and appends an essential extra beyond twelve without losing originals',()=>{
 const previous=DNA.snapshot({slots:{typeAge:'adult woman',hair:'long black hair',eyes:'round black eyes',face:'oval face',extra1:'broad shoulders',extra2:'distinct scar on left knee',extra3:'mole below right eye',extra4:'pointed ears'}});
 const edits=DNA.overrides({eyes:'slightly elongated round black eyes',extra5:'small horn on forehead'});
 const final=DNA.snapshot({schema:1,slots:{...previous.slots,...edits}});
 assert.equal(final.slots.hair,'long black hair');
 assert.equal(final.slots.eyes,'slightly elongated round black eyes');
 assert.equal(final.slots.extra1,'broad shoulders');
 assert.equal(final.slots.extra5,'small horn on forehead');
 assert.match(DNA.snapshotIdentity(final),/pointed ears, small horn on forehead$/);
 // Previously stored changes referencing old slot names remain compatible.
 assert.deepEqual(DNA.overrides({markA:'small scar'}),{extra3:'small scar'});
});

test('alpha191 both legacy and extended DNA reach the actual NAI character prompt unchanged',()=>{
 const old=DNA.snapshot({slots:{typeAge:'adult woman',eyes:'dark almond eyes',bodyA:'broad shoulders',markA:'scar on left knee'}});
 const updated=DNA.snapshot({slots:{...old.slots,extra5:'pointed ears'}});
 const plan={scene:'medium shot, 1girl, kitchen, seated at a table',characters:[{name:'A',form:'默认形态',identity:'placeholder',registrationDNA:updated,equipment:{HEAD:[],TOP:[{name:'blue dress',visible:true}],LOWER:[],FULL:[],LEGWEAR:[],FOOTWEAR:[],HAND:[],ACCESSORIES:[]}}]};
 const composed=Core.compose(plan,{positive:'artist:test, game cg',negative:'bad anatomy',useNegative:true},{format:'nai45'});
 assert.match(composed.sections.base,/^artist:test, game cg, medium shot/);
 assert.equal(composed.sections.characters[0].identity,'girl, adult woman, dark almond eyes, broad shoulders, scar on left knee, pointed ears');
 assert.match(composed.sections.characters[0].prompt,/pointed ears, blue dress/);
});
