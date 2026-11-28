'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Core=require('../src/core.cjs');
const Budget=require('../src/prompt-budget.cjs');
const Rules=require('../src/director-rules.cjs');
const rules=require('../src/assets/director-rules.json');
const html=fs.readFileSync(require('node:path').join(__dirname,'../src/ui/menu.html'),'utf8');
function prompt({shot='near',format='nai45',maxActors=2,kind='story_cg',request='',storyInput='继续剧情',adultGatePassed=false,adultContextCue=false}={}){
 return Core.buildInstruction({id:'alpha225',kind,request,storyInput,adultGatePassed,adultContextCue,targetName:'示例角色',targetForm:'默认形态',style:{positive:'game cg'},config:{format,shot,maxActors,ratio:'api'}},rules,[]);
}

test('automatic NAI framing follows the story without a two-person cap',()=>{
 const text=prompt({maxActors:6});
 assert.doesNotMatch(text,/最多两位清晰主体/);
 assert.doesNotMatch(text,/剧情参与者超过上限/);
 assert.match(text,/不建立完整人物栏、不增加人数标签/);
 assert.equal(Core.settings({maxActors:6}).maxActors,undefined);
});

test('player framing is chosen from the action with no gender-specific exclusion',()=>{
 for(const format of ['nai45','generic'])for(const shot of ['near','full']){
  const text=prompt({format,shot});
  assert.doesNotMatch(text,/男性玩家策略|女性玩家策略|默认不以完整清晰人物入镜|保留画外参与者的局部出镜|不要为了展示完整身体/);
  assert.match(text,/取景围绕本轮最需要看清的动作和身体部位决定/);
 }
});

test('alpha225: explicit player camera instructions retain highest priority',()=>{
 const text=prompt({request:'请让玩家角色露脸，与女主完整双人同框'});
 assert.match(text,/玩家明确指定的机位、景别、只拍的身体部位、不露脸要求和入镜人物优先/);
 assert.match(text,/玩家本轮画面要求：请让玩家角色露脸，与女主完整双人同框/);
});

test('alpha225: body-size and height differences remain visible within a crop without widening the camera',()=>{
 const text=prompt();
 assert.match(text,/身高差与体型差/);
 assert.match(text,/肩线、坐姿高度/);
 assert.match(text,/躯干、肢体或场景参照/);
});

test('alpha225: scale difference is included in multi-person character design, player framing is not',()=>{
 const text=prompt({kind:'character_intro',storyInput:'',request:'设计两名身高体型差异明显的角色',maxActors:2});
 assert.match(text,/身高差与体型差/);
 assert.doesNotMatch(text,/玩家角色的默认出镜策略/);
 assert.doesNotMatch(text,/最多两位清晰主体/);
});

test('alpha225: generic format keeps player and scale rules but not NAI cast-count preference',()=>{
 const text=prompt({format:'generic'});
 assert.doesNotMatch(text,/玩家角色的默认出镜策略/);
 assert.match(text,/身高差与体型差/);
 assert.doesNotMatch(text,/最多两位清晰主体/);
 assert.doesNotMatch(text,/最多两位清晰主体/);
});

test('alpha225: the height helper does not inject a camera-widening scene cue',()=>{
 const scene='medium close-up, two people seated close together, one much taller and broader than the other';
 const plan={scene,characters:[
  {name:'A',form:'默认形态',identity:'adult woman, 188 cm tall, broad muscular build',equipment:{HEAD:[],TOP:[],LOWER:[],FULL:[],LEGWEAR:[],FOOTWEAR:[],HAND:[],ACCESSORIES:[]}},
  {name:'B',form:'默认形态',identity:'adult man, 160 cm tall, slender build',equipment:{HEAD:[],TOP:[],LOWER:[],FULL:[],LEGWEAR:[],FOOTWEAR:[],HAND:[],ACCESSORIES:[]}}
 ]};
 const result=Core.compose(plan,{positive:'game cg',useNegative:false},{format:'nai45'});
 assert.ok(result.renderedScene.startsWith(scene));
 assert.doesNotMatch(result.renderedScene,/wide shot|full-body|head-to-toe/);
 assert.match(result.prompt,/one much taller and broader than the other/);
 assert.doesNotMatch(result.prompt,/188 cm tall/);
 assert.doesNotMatch(result.prompt,/160 cm tall/);
});

test('alpha225: budget keeps the ×1.8 estimator and raises the soft warning threshold to 512',()=>{
 assert.deepEqual(Budget.risk('a b c d'),{words:4,estimate:7,method:'whitespace-times-1.80-not-exact-t5'});
 const below=Budget.converge({scene:'',characters:[]},{},{base:Array(272).fill('word').join(' '),characters:[]});
 assert.equal(below.audit.after.estimate,490);
 assert.equal(below.audit.overBudget,false);
 const at=Budget.converge({scene:'',characters:[]},{},{base:Array(284).fill('word').join(' '),characters:[]});
 assert.equal(at.audit.after.estimate,511);
 assert.equal(at.audit.overBudget,false);
 const above=Budget.converge({scene:'',characters:[]},{},{base:Array(285).fill('word').join(' '),characters:[]});
 assert.equal(above.audit.after.estimate,513);
 assert.equal(above.audit.overBudget,true);
 assert.equal(above.audit.target,512);
 assert.equal(above.audit.warningThreshold,512);
 assert.match(above.audit.warning,/超过512/);
});

test('alpha225: budget instruction says 512 and UI describes near framing and clear-subject cap accurately',()=>{
 const text=prompt();
 assert.match(text,/×1\.80/);
 assert.match(text,/建议约512以内/);
 assert.doesNotMatch(text,/目标约480以内/);
 assert.match(html,/近景优先/);
 assert.match(html,/全身优先/);
 assert.doesNotMatch(html,/studio-actor-options|ad-max/);
});



test('explicit NAI group requests set the limit for that frame',()=>{
 const request={kind:'story_cg',config:{format:'nai45'}};
 const two={scene:'medium shot, 1girl, 1boy, a third participant’s hand enters at the frame edge',characters:[{},{}]};
 const three={scene:'medium shot, 2girls, 1boy',characters:[{},{},{}]};
 assert.equal(Core.validateCastLimit(two,request).allowedLimit,null);
 assert.equal(Core.validateCastLimit(three,{...request,storyInput:'三个人在房间里聊天。'}).overPreference,false);
 const actors=three.characters.map((_,i)=>({name:'Actor '+i,identity:'adult person',equipment:Core.Wardrobe.normalizeEquipment({})}));
 assert.doesNotThrow(()=>Core.validateDirectorPlan({...three,characters:actors},{...request,storyInput:'三个人在房间里聊天。'}));
 assert.equal(Core.compose({...three,characters:actors},{},request.config).sections.characters.length,3);
 assert.equal(Core.validateCastLimit(three,{...request,request:'三人清晰同框'}).allowedLimit,3);
 assert.doesNotThrow(()=>Core.validateCastLimit(two,{...request,request:'三人清晰同框'}));
 assert.equal(Core.validateCastLimit(three,{...request,config:{format:'generic'}}).applied,false);
});

test('NAI count totals are not added to their own categories',()=>{
 const request={kind:'story_cg',config:{format:'nai45',maxActors:2}};
 const two=[{},{}];
 for(const scene of ['2people, 1boy, 1girl, living room','1girl, 2 persons, 1boy','1woman, 1girl, 1man, 1boy']){
  assert.equal(Core.validateCastLimit({scene,characters:two},request).sceneTagCount,2);
 }
 assert.doesNotThrow(()=>Core.validateCastLimit({scene:'2people, 1boy, 2girls',characters:two},request));
 assert.doesNotThrow(()=>Core.validateCastLimit({scene:'3people, 1boy, 1girl',characters:two},request));
 assert.equal(Core.validateCastLimit({scene:'2people, 1boy, 1girl',characters:[{}]},request).sceneTagCount,2);
 assert.doesNotThrow(()=>Core.validateCastLimit({scene:'1girl',characters:two},request));
 assert.doesNotThrow(()=>Core.validateCastLimit({scene:'7people',characters:two},request));
});

test('NAI assembly removes total-count tags and reconciles category tags with confirmed actor types',()=>{
 const equipment={HEAD:null,TOP:null,LOWER:null,FULL:null,LEGWEAR:null,FOOTWEAR:null,HAND:null,ACCESSORIES:null};
 const characters=[
  {name:'A',identity:'registered appearance',registrationDNA:{schema:1,slots:{typeAge:'adult man',face:'feminine features'}},equipment},
  {name:'B',identity:'registered appearance',registrationDNA:{schema:1,slots:{typeAge:'adult woman',face:'masculine features'}},equipment}
 ];
 const original={scene:'medium close-up, 2people, 2girls, seated beside a window',characters};
 const result=Core.compose(original,{},{format:'nai45'});
 assert.equal(result.renderedScene,'medium close-up, 1boy, 1girl, seated beside a window');
 assert.doesNotMatch(result.prompt,/2people|2girls/);
 assert.match(result.sections.characters[0].prompt,/^boy, adult man/);
 assert.match(result.sections.characters[1].prompt,/^girl, adult woman/);
 assert.deepEqual(result.scaleAudit.sceneRemoved,['2people','2girls']);
 const unknown=Core.compose({...original,scene:'2 people, 1girl, 1boy, kitchen',characters:characters.map(c=>({...c,registrationDNA:undefined,identity:'short hair'}))},{},{format:'nai45'});
 assert.equal(unknown.renderedScene,'1girl, 1boy, kitchen');
});

test('a clear Scene-only companion counts toward the cap without needing an appearance group',()=>{
 const equipment={HEAD:null,TOP:null,LOWER:null,FULL:null,LEGWEAR:null,FOOTWEAR:null,HAND:null,ACCESSORIES:null};
 const config={format:'nai45',maxActors:2};
 const request={kind:'story_cg',config};
 const plan={scene:'medium shot, 2people, 1boy, 1girl, a man hands a parcel to the seated woman',characters:[{name:'A',identity:'adult woman',equipment}]};
 const count=Core.validateCastLimit(plan,request);
 assert.equal(count.sceneTagCount,2);
 assert.equal(count.characterCount,1);
 const result=Core.compose(plan,{},config);
 assert.match(result.renderedScene,/1boy, 1girl/);
 assert.doesNotMatch(result.renderedScene,/2people/);
 assert.equal(result.sections.characters.length,1);
 assert.doesNotThrow(()=>Core.validateCastLimit({...plan,scene:'2boys, 1girl, kitchen'},request));
});
