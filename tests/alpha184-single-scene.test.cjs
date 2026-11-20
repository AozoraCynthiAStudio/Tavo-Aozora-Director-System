'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Core=require('../src/core.cjs'),Visual=require('../src/visual-protocol.cjs'),Budget=require('../src/prompt-budget.cjs'),Motion=require('../src/motion-prompt.cjs');
const rules=require('../src/assets/director-rules.json');
const cleanEquip=()=>({HEAD:[],TOP:[],LOWER:[],FULL:[],LEGWEAR:[],FOOTWEAR:[],HAND:[],ACCESSORIES:[]});
const style={positive:'0.45::artist:mignon::, artist:allenes, game cg, anime coloring, clean lineart, cel shading, year 2024',negative:'lowres, blurry',useNegative:true};
const woman={name:'曲曼',form:'默认形态',identity:'adult woman, 29 years old, 188 cm tall, broad face, strong jaw, muscular build, tanned skin, wide eyes',equipment:{...cleanEquip(),FULL:[{name:'black mini dress',state:'worn',visible:true}],LEGWEAR:[{name:'sheer black pantyhose',state:'worn',visible:true}]}};
const man={name:'小轩',form:'默认形态',identity:'adult man, 22 years old, 160 cm tall, round face, slim build, black hair',equipment:{...cleanEquip(),TOP:[{name:'white shirt',state:'worn',visible:true}]}};
const scene='medium shot, 1boy, 1girl, bedroom, tall woman seated beside short man on a bed, her legs resting on the mattress, his hand on her shoulder, both looking at each other';
const plan={scene,description:'两人在床边相互看着，手放在肩头。',characters:[woman,man]};

test('v184 director catalog and generated grouped protocol have a single authoritative scene, no Action block',()=>{
 Core.RuleCompiler.validateCatalog(rules);
 for(const kind of ['story_cg','character_intro']){
  const instruction=Core.buildInstruction({id:'req184',kind,storyInput:'本轮剧情',request:'',targetName:'曲曼',targetForm:'默认形态',style,config:{format:'nai45'}},rules,[]);
  assert.match(instruction,/【单Scene导演】/);assert.doesNotMatch(instruction,/^动作：|\baction\s*:/mi);
  assert.match(instruction,/场景：/);assert.match(instruction,/装备/);
  assert.doesNotMatch(instruction,/×1\.60/);assert.match(instruction,/×1\.80/);
 }
});

test('v184 strict protocol roundtrip contains scene, DNA, equipment and optional short relation only',()=>{
 const text=Visual.format({...plan,characters:[{...woman,relation:'source#hug'}, {...man,relation:'target#hug'}]},'req184');
 assert.doesNotMatch(text,/^动作：/m);assert.match(text,/^关系：source#hug$/m);
 const result=Core.parseVisual(text,'req184').plan;assert.equal(result.scene,scene);assert.equal(result.characters[0].relation,'source#hug');
 assert.deepEqual(result.characters[0].equipment.LEGWEAR,[{name:'sheer black pantyhose',state:'worn',visible:true}]);
 assert.deepEqual(Object.keys(result.characters[0]).filter(x=>x==='action'),[]);
 assert.throws(()=>Core.parseVisual(text.replace('关系：source#hug','动作：holding his hand'),'req184'),/视觉数据格式不完整|未知人物字段/);
 assert.equal(Core.parseVisual(text.replace('关系：source#hug','关系：full description of all actions'),'req184').plan.characters[0].relation,'full description of all actions','natural pose descriptions are retained');
});

test('v184 NAI format places ALL actor interactions into Base scene once, character boxes isolate identity + wardrobe',()=>{
 const result=Core.compose(plan,style,{format:'nai45'});const parts=result.prompt.split(' | ');
 assert.equal(parts.length,3);assert.match(parts[0],/his hand on her shoulder/);
 assert.doesNotMatch(parts[1],/shoulder|seated|looking at|resting on mattress/);
 assert.doesNotMatch(parts[2],/shoulder|seated|looking at|resting on mattress/);
 assert.match(parts[1],/sheer black pantyhose/);assert.doesNotMatch(parts[1],/bare legs/);
 assert.match(parts[2],/white shirt/);assert.ok(!parts[2].includes('pantyhose'));
 assert.ok(result.characters.every(c=>!Object.hasOwn(c,'action')));
 assert.deepEqual(result.scaleAudit.sceneAdded,[],'no compiler generated height comparisons');
});

test('v184 NAI relation anchors are optional and never synthesize another full actor Action',()=>{
 const result=Core.compose({...plan,characters:[{...woman,relation:'source#hug'},{...man,relation:'target#hug'}]},style,{format:'nai45'});
 assert.match(result.prompt.split(' | ')[1],/source#hug/);assert.match(result.prompt.split(' | ')[2],/target#hug/);
 assert.equal((result.prompt.match(/his hand on her shoulder/g)||[]).length,1);
 assert.throws(()=>Core.compose({...plan,characters:[{...woman,action:'hugs her'},man]},style,{format:'nai45'}),/不接受旧人物动作字段/);
});

test('v184 generic format keeps whole scene and no duplicate actor action',()=>{
 const r=Core.compose(plan,{positive:'cinematic still',useNegative:false},{format:'generic'});
 assert.equal((r.prompt.match(/his hand on her shoulder/g)||[]).length,1);
 assert.match(r.prompt,/sheer black pantyhose/);assert.doesNotMatch(r.prompt,/source#|target#/);
});

test('v184 budget uses 1.8 and never prunes registered DNA or explicit Scene',()=>{
 assert.deepEqual(Budget.risk('a b c d'),{words:4,estimate:7,method:'whitespace-times-1.80-not-exact-t5'});
 const oversized={...plan,scene:scene+', '+Array.from({length:175},(_,i)=>'foreground detail '+i).join(', ')};
 const r=Core.compose(oversized,style,{format:'nai45'});
 assert.ok(r.budgetAudit.overBudget);assert.ok(r.budgetAudit.removed.every(x=>x.field!=='scene'&&x.field!=='identity'));
 assert.match(r.prompt,/sheer black pantyhose/);assert.ok(r.prompt.includes(oversized.scene.trim()));
});

test('v184 dynamic image editing only changes Base scene; identity and clothing boxes are untouched',()=>{
 const r=Core.compose(plan,style,{format:'nai45'});
 const source={plan,sections:r.sections,prompt:r.prompt};
  const target=Motion.editOriginal(JSON.stringify({edits:[{character:-1,from:'his hand on her shoulder',to:'his hand on the sofa armrest',focuses:[{text:'his hand on the sofa armrest',weight:5}]}]}),source);
 const old=r.prompt.split('|'),after=target.prompt.split('|');assert.equal(old.length,after.length);
 assert.equal(old[1],after[1]);assert.equal(old[2],after[2]);assert.match(after[0],/sofa armrest/);
 assert.throws(()=>Motion.editOriginal(JSON.stringify({edits:[{character:0,from:'round face',to:'small eyes',weight:5}]}),source),/修改字段无效/);
});

test('v184 confirmation of registered DNA remains immutable during story rendering',()=>{
 const snapshot={schema:1,slots:{typeAge:'adult woman, 29 years old',height:'188 cm tall',skin:'tanned skin',hair:'curly black hair',face:'broad face, strong jaw',eyes:'wide brown eyes',build:'muscular build',markA:'faint scar on left knee'}};
 const registered={name:'曲曼',form:'默认形态',registrationDNA:snapshot,identity:Core.DNA.snapshotIdentity(snapshot)};
 const before=Core.reuseRegisteredIdentity({scene,characters:[{...woman,identity:'registered appearance'}]}, {kind:'story_cg'},[registered]);
 assert.equal(before.plan.characters[0].identity,Core.DNA.snapshotIdentity(snapshot));
 const r=Core.compose(before.plan,style,{format:'nai45'});
 for(const value of Object.values(snapshot.slots))if(value)assert.ok(r.prompt.includes(value));
});

test('dynamic pose edits replace only the selected character relation suffix',()=>{
 const original=Core.compose(plan,style,{format:'nai45'});
 const characters=plan.characters.map((actor,index)=>({...actor,relation:index===0?'facing viewer':''}));
 const composed=Core.compose({...plan,characters},style,{format:'nai45'});
 const source={plan:{...plan,characters},sections:composed.sections,prompt:composed.prompt,renderedScene:composed.renderedScene};
  const edit={character:-1,from:'his hand on her shoulder',to:'his hand on the sofa armrest',focuses:[{text:'his hand on the sofa armrest',weight:5}]};
 const changed=Motion.editOriginal(JSON.stringify({edits:[edit],poseEdits:[{character:0,relation:'looking toward window'}]}),source);
 const before=source.prompt.split('|'),after=changed.prompt.split('|');
 assert.equal(after[1],before[1].replace('facing viewer','looking toward window'));
 assert.equal(after[2],before[2]);
 assert.match(after[0],/his hand on the sofa armrest/);
  const moderate=Motion.editOriginal(JSON.stringify({edits:[{character:-1,from:edit.from,to:edit.to,focuses:[{text:'his hand on the sofa armrest',weight:1.5}]},{character:-1,from:'',to:'slightly leaning forward',focuses:[{text:'slightly leaning forward',weight:1.2}]}]}),source);
 assert.match(moderate.prompt,/1\.5::his hand on the sofa armrest::/);
 assert.match(moderate.prompt,/1\.2::slightly leaning forward::/);
 const added=Motion.editOriginal(JSON.stringify({edits:[edit],poseEdits:[{character:1,relation:'sitting upright'}]}),source);
 assert.match(added.prompt.split('|')[2],/sitting upright/);
 assert.equal(Motion.editOriginal(JSON.stringify({edits:[edit],poseEdits:[{character:9,relation:'standing'}]}),source).poseEdits.length,0);
 assert.equal(original.sections.characters.length,composed.sections.characters.length);
});

test('a complete dynamic Scene rewrite weights only its explicit action phrase',()=>{
 const result=Core.compose(plan,style,{format:'nai45'});
 const source={plan,prompt:result.prompt,sections:result.sections,renderedScene:result.renderedScene};
  const edit={character:-1,from:result.renderedScene,to:'medium shot, her face in left profile, warm light',focuses:[{text:'her face in left profile',weight:5}]};
 const revised=Motion.editOriginal(JSON.stringify({edits:[edit]}),source);
 assert.match(revised.prompt,/medium shot, 5::her face in left profile::, warm light/);
  assert.equal(Motion.editOriginal(JSON.stringify({edits:[{...edit,focuses:[{text:'absent',weight:5}]}]}),source).edits[0].weight,0);
});

test('dynamic plan reads one valid JSON object wrapped by prose or fences',()=>{
 const result=Core.compose(plan,style,{format:'nai45'});
 const source={plan,prompt:result.prompt,sections:result.sections,renderedScene:result.renderedScene};
  const raw=JSON.stringify({edits:[{character:-1,from:'his hand on her shoulder',to:'his hand on the sofa armrest',focuses:[{text:'his hand on the sofa armrest',weight:5}]}]});
 const wrapped='修改如下。\n'+String.fromCharCode(96,96,96)+'json\n'+raw+'\n'+String.fromCharCode(96,96,96)+'\n以上是修改。';
 assert.match(Motion.editOriginal(wrapped,source).prompt,/5::his hand on the sofa armrest::/);
 assert.match(Motion.editOriginal('方案一 '+raw+' 方案二 '+raw,source).prompt,/sofa armrest/);
 assert.throws(()=>Motion.editOriginal('修改如下：{broken}',source),error=>error.code==='MOTION_RESPONSE_INVALID');
});
