'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Rules=require('../src/director-rules.cjs');
const Core=require('../src/core.cjs');
const catalog=require('../src/assets/director-rules.json');
const {fixture,turn}=require('./helpers/equipment-fixture.cjs');

function request(extra={}){
 return {id:'alpha233-gate',kind:'story_cg',request:'',storyInput:'继续普通剧情',targetName:'玩家角色',targetForm:'默认形态',style:{positive:'game cg'},config:{format:'nai45',shot:'near',maxActors:2},...extra};
}
function count(text,part){return String(text).split(part).length-1;}

test('alpha233: every story-CG text request receives all seven rules once, with a single applicability instruction',()=>{
 const ordinary=Core.buildInstruction(request(),catalog,[]);
 const explicitlyAdult=Core.buildInstruction(request({request:'本轮明确属于成人场景'}),catalog,[]);
 const gate=ordinary.indexOf(catalog.adultGate);
 const details=ordinary.indexOf(catalog.adultFraming);
 assert.ok(gate>=0&&details>gate);
 for(const key of Rules.ADULT_KEYS){assert.equal(count(ordinary,catalog[key]),1,`${key} should appear exactly once`);}
 assert.doesNotMatch(ordinary,/PASS|FAIL/);
 assert.equal(ordinary,Core.buildInstruction(request({adultGatePassed:true}),catalog,[]),'legacy external gate flags must not change prompt composition');
 assert.match(explicitlyAdult,/【成人画面·表面接触】/);
});

test('alpha233: initial character design excludes all six adult rules; selected-source tuning may use the same one-pass block',()=>{
 const design=Core.buildInstruction(request({kind:'character_intro',request:'设计角色'}),catalog,[]);
 assert.doesNotMatch(design,/【成人规则第一阶段/);
 assert.doesNotMatch(design,/【成人画面·/);
 assert.equal(Rules.buildAdultContext(catalog,{kind:'character_intro',request:'设计角色'}),'');
 const sourceTune=Rules.buildAdultContext(catalog,{kind:'character_intro',sourceImage:true,request:'只调整原图镜头'});
 for(const key of Rules.ADULT_KEYS)assert.equal(count(sourceTune,catalog[key]),1,`${key} should be included for selected-source tuning`);
 assert.match(sourceTune,/所有参与者明确成年/);
});

test('alpha233: ordinary source image operations receive the same seven-rule block; Gate decides whether six are active',()=>{
 const context=Rules.buildAdultContext(catalog,{kind:'story_cg',sourceImage:true,request:'调整镜头',sourceScene:'medium shot, two adults talking in a cafe',sourcePrompt:'adult woman, adult man, cafe conversation'});
 for(const key of Rules.ADULT_KEYS)assert.equal(count(context,catalog[key]),1,`${key} should be included exactly once`);
 assert.match(context,/普通场景按普通规则处理/);
});

test('alpha233: a new story turn performs no auxiliary Gate call and does not import the previous image Gate context',async()=>{
 const f=fixture();
 try{
  f.setInput('继续普通剧情，角色在咖啡厅聊天。');
  await f.app.queueNext({kind:'story_cg'});
  const event={generationId:'alpha233-new-turn',chatId:1,text:await f.tavo.input.get()};
  await f.app.prepare(event);
  assert.equal(f.textCalls,0,'prepare must not call an auxiliary text model for Gate');
  for(const key of Rules.ADULT_KEYS)assert.equal(count(event.text,catalog[key]),1,`${key} should be in the same normal director request`);
  assert.doesNotMatch(event.text,/来源图片实际完整Prompt（数据）/);
  assert.equal(typeof f.app.evaluateAdultGate,'undefined');
 }finally{f.app.close();}
});

test('alpha233: tuning one selected source image performs exactly one text call containing Gate and all six conditional rules',async()=>{
 const f=fixture();
 const empty={HEAD:[],TOP:[],LOWER:[],FULL:[],LEGWEAR:[],FOOTWEAR:[],HAND:[],ACCESSORIES:[]};
 const dnaA={schema:1,slots:{typeAge:'adult man, 28 years old',height:'175 cm tall',build:'average build'}};
 const dnaB={schema:1,slots:{typeAge:'adult woman, 29 years old',height:'168 cm tall',build:'slim build'}};
 const plan={scene:'medium shot, clearly adult sexual interaction between two explicitly adult participants, private room',characters:[
  {name:'玩家角色',form:'默认形态',identity:Core.DNA.snapshotIdentity(dnaA),registrationDNA:dnaA,equipment:empty},
  {name:'角色B',form:'默认形态',identity:Core.DNA.snapshotIdentity(dnaB),registrationDNA:dnaB,equipment:empty}
 ]};
 try{
  await turn(f,{mid:233,input:'继续',body:'这一幕继续。',plan});
  const record=await f.app.readRecord(233),source=record.images[0];
  assert.ok(source);
  let seen='',calls=0;
  f.tavo.generate=async prompt=>{calls++;seen=String(prompt);return JSON.stringify({scene:'medium shot, clearly adult sexual interaction between two explicitly adult participants, camera shifted slightly left, private room',changes:[],wardrobeUpdates:[]});};
  await f.app.tune(233,source.id,'镜头稍微向左调整，不改变其他内容');
  assert.equal(calls,1,'tuning should use one text call total, not Gate plus tune calls');
  for(const key of Rules.ADULT_KEYS)assert.equal(count(seen,catalog[key]),1,`${key} should be included exactly once`);
  assert.match(seen,/原图实际生图提示词（基准，不要忽略）/);
  assert.match(seen,/成人画面适用范围/);
 }finally{f.app.close();}
});

test('alpha233: adult rules are not independently re-evaluated in app code or imported from a previous turn',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../src/app.cjs'),'utf8');
 assert.doesNotMatch(app,/evaluateAdultGate/);
 assert.doesNotMatch(app,/previousAdultSource/);
 assert.doesNotMatch(app,/adultGatePassed\s*=/);
 assert.match(app,/buildAdultContext\(assets\.rules,\{kind:image\.kind\|\|rec\.kind,sourceImage:true/);
});

test('alpha233: Gate criteria are explicit, conservative, and remain the only classification source',()=>{
 assert.match(catalog.adultGate,/成人性互动且所有参与者明确成年/);
 assert.match(catalog.adultGate,/普通场景按普通规则处理/);
});

test('alpha233: a new image reroll or same-plan add reuses the saved plan and makes zero text-model calls',async()=>{
 const f=fixture();
 const empty={HEAD:[],TOP:[],LOWER:[],FULL:[],LEGWEAR:[],FOOTWEAR:[],HAND:[],ACCESSORIES:[]};
 const dna={schema:1,slots:{typeAge:'adult woman, 29 years old',height:'168 cm tall',build:'slim build'}};
 const plan={scene:'medium shot, 1girl, a woman standing beside a window',characters:[{name:'角色A',form:'默认形态',identity:Core.DNA.snapshotIdentity(dna),registrationDNA:dna,equipment:empty}]};
 try{
  await turn(f,{mid:234,input:'继续',body:'她站在窗边。',plan});
  const source=(await f.app.readRecord(234)).images[0];
  assert.equal(f.textCalls,0);
  await f.app.generate(234,true,source.id,null,'replace');
  await f.app.generate(234,true,source.id,null,'append');
  assert.equal(f.textCalls,0,'reroll and same-plan add must not call text AI or Gate');
 }finally{f.app.close();}
});

test('alpha233: dynamic request performs its Gate and edit in one existing text call',async()=>{
 const f=fixture();
 const empty={HEAD:[],TOP:[],LOWER:[],FULL:[],LEGWEAR:[],FOOTWEAR:[],HAND:[],ACCESSORIES:[]};
 const dna={schema:1,slots:{typeAge:'adult woman, 29 years old',height:'168 cm tall',build:'slim build'}};
 const plan={scene:'medium shot, 1girl, a woman seated beside a window, both hands on her lap',characters:[{name:'角色A',form:'默认形态',identity:Core.DNA.snapshotIdentity(dna),registrationDNA:dna,equipment:empty}]};
 try{
  await turn(f,{mid:235,input:'继续',body:'她坐在窗边。',plan});
  const source=(await f.app.readRecord(235)).images[0];
  let calls=0,seen='';
  f.tavo.generate=async prompt=>{calls++;seen=String(prompt);return JSON.stringify({edits:[{character:-1,from:'',to:'camera slightly closer',focuses:[{text:'camera slightly closer',weight:5}]}]});};
  await f.app.animate(235,source.id,'镜头稍微靠近');
  assert.equal(calls,1,'dynamic request must combine Gate and scene edit in its existing single text call');
  for(const key of Rules.ADULT_KEYS)assert.equal(count(seen,catalog[key]),1,`${key} should be included exactly once`);
  assert.match(seen,/原Scene（数据）/);
  assert.match(seen,/把玩家自然语言里的变化意图导演成下一帧/);
  assert.match(seen,/沿用原Scene中已有的背景布局|沿用.*背景布局/);
  assert.match(seen,/保留玩家明确要求的全部互不冲突变化/);
  assert.match(seen,/不能仅因它是牵连变化就自动降权/);
  assert.doesNotMatch(seen,/默认仍用1.5/);
  assert.match(seen,/成人画面适用范围/);
 }finally{f.app.close();}
});

test('legacy volume is independent of the acting character’s physique and camera',()=>{
 const request={kind:'story_cg',config:{format:'nai45',maxActors:2,shot:'near'}};
 const volume=catalog.adultVolume;
 for(const prompt of [Core.buildInstruction(request,catalog,[]),Rules.buildAdultContext(catalog,{sourceImage:true})]){
  assert.ok(prompt.includes(volume));
   assert.match(prompt,/不改变既定姿势、朝向、接触和裁切/);
 }
 assert.match(volume,/尺寸基准仍按普通成年男性的平均身高计算/);
 assert.match(volume,/没有适用的已保存档案时，按人物设定与自然比例呈现/);
 assert.match(volume,/一般偏大用 large penis/);
 assert.match(volume,/不跟着该玩家控制角色自己的高矮、骨架、体格或整体体型缩小或放大/);
 assert.match(volume,/明确表达极大体量用 huge penis/);
 assert.doesNotMatch(volume,/gigantic/);
 assert.match(volume,/沿用既定机位、透视和裁切/);
});

test('visible anatomy is named and bound to its owner without reframing',()=>{
 const request={kind:'story_cg',config:{format:'nai45'}};
 for(const prompt of [Core.buildInstruction(request,catalog,[]),Rules.buildAdultContext(catalog,{sourceImage:true})]){
   assert.match(prompt,/首次提及使用明确英文解剖名词/);
   assert.match(prompt,/写清归属、自然连接和接触位置/);
 }
});

test('both director paths specify visible action phase and surface contact ownership',()=>{
 const request={kind:'story_cg',config:{format:'nai45',maxActors:2}};
 for(const prompt of [Core.buildInstruction(request,catalog,[]),Rules.buildAdultContext(catalog,{sourceImage:true})]){
    assert.match(prompt,/在同一个英文动作句写明当前静止阶段、实际可见部分及归属/);
  assert.match(prompt,/写清执行者、实际用于接触的身体部位，以及对方被碰到的具体位置/);
    assert.match(prompt,/保留玩家指定的参与者、身体结构、执行者、器官、目标和进入位置/);
    assert.match(prompt,/动作结构/);
  assert.match(prompt,/尺寸基准仍按普通成年男性的平均身高计算/);
 }
});

test('named surface contact points are preserved and assigned to the acting character',()=>{
 const request={kind:'story_cg',config:{format:'nai45',maxActors:2}};
 for(const prompt of [Core.buildInstruction(request,catalog,[]),Rules.buildAdultContext(catalog,{sourceImage:true})]){
  assert.match(prompt,/在同一句保留该部位和目标接触点/);
  assert.match(prompt,/用明确的人物称谓标明执行者/);
  assert.doesNotMatch(catalog.adultSurface,/湿润高光|几滴可见汗珠/);
 }
});

test('specialized action tags are restricted to NAI 4.5 story directions and explicit matching',()=>{
 const build=(format,imageService,kind='story_cg')=>Core.buildInstruction({kind,config:{format,imageService}},catalog,[]);
 const enabled=build('nai45','nai45');
 assert.match(enabled,/符合上述成人画面适用范围，并且玩家本轮明确指定/);
 assert.match(enabled,/footjob、thigh sex、paizuri/);
 assert.match(enabled,/missionary、doggystyle、prone bone、cowgirl position/);
 assert.match(enabled,/frottage.*legjob/);
 assert.match(enabled,/按字面写实际接触，不据此套入专有动作标签/);
 for(const prompt of [build('generic','generic'),build('nai45','generic'),build('nai45','nai45','character_intro')]){
  assert.doesNotMatch(prompt,/动作与体位候选标签/);
 }
});
