'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Core=require('../src/core.cjs'),Official=require('../src/official-direct.cjs');
const empty=()=>({HEAD:[],TOP:[],LOWER:[],FULL:[],LEGWEAR:[],FOOTWEAR:[],HAND:[],ACCESSORIES:[]});
const dna={schema:1,slots:{typeAge:'adult woman',hair:'long dark hair',eyes:'blue eyes',face:'oval face'}};
const plan={scene:'medium shot, 1girl, classroom, a girl sitting on a chair',characters:[{name:'A',form:'默认形态',identity:Core.DNA.snapshotIdentity(dna),registrationDNA:dna,equipment:{...empty(),TOP:[{name:'white shirt',state:'',visible:true}]}}]};
const nai=Core.compose(plan,{positive:'game cg',negative:'lowres',useNegative:true},{format:'nai45'});
const generic=Core.compose(plan,{positive:'cinematic still',negative:'lowres',useNegative:true},{format:'generic'});
function seedBody(compiled){return Official.staticRequestBody(compiled,{width:832,height:1216});}
test('alpha185 native NAI request isolates Base and character captions without repeating pipe prompt',()=>{
 const compiled={...nai,requestedSeed:42};const req=seedBody(compiled);
 assert.equal(Official.applyNativeNaiCaptions(req,compiled),true);
 assert.equal(req.input,nai.sections.base);
 assert.equal(req.parameters.v4_prompt.caption.base_caption,nai.sections.base);
 assert.equal(req.parameters.v4_prompt.caption.char_captions.length,1);
 assert.equal(req.parameters.v4_prompt.caption.char_captions[0].char_caption,nai.sections.characters[0].prompt);
 assert.equal(req.parameters.v4_prompt.use_coords,false);
 assert.equal(req.parameters.v4_prompt.use_order,true);
 assert.equal(req.parameters.v4_negative_prompt.caption.base_caption,compiled.options.negativePrompt);
 assert.equal(req.parameters.v4_negative_prompt.caption.char_captions.length,1);
 assert.equal(req.parameters.seed,42);
});
test('alpha185 generic never becomes NAI captions even on official native provider',()=>{
 const compiled={...generic,requestedSeed:42};const req=seedBody(compiled),before=structuredClone(req);
 assert.equal(Official.applyNativeNaiCaptions(req,compiled),false);
 assert.deepEqual(req,before);
 assert.equal(req.parameters.v4_prompt.caption.char_captions.length,0);
 assert.equal(req.input,generic.prompt);
 assert.equal(generic.syntax,'generic-natural-language');
});
test('alpha240 third-party native request keeps one prompt string',async()=>{
 const original=global.fetch;let seen;
 global.fetch=async(_url,options)=>{seen=JSON.parse(options.body);return {ok:false,status:401,headers:{get:()=>null},text:async()=>''};};
 try{await assert.rejects(Official.generate({variable:{get:async()=>({provider:'thirdparty',thirdParty:{url:'https://nai.rinko.ai/native',apiKey:'relay-test-key'}})},file:{load:async()=>{throw Error('unused');}}},{...nai,requestedSeed:7,staticDirect:true,directProvider:'thirdparty'},{id:'relay'},async()=>{}),/HTTP 401/);}
 finally{global.fetch=original;}
 assert.equal(seen.input,nai.prompt);
 assert.equal(seen.parameters.v4_prompt.caption.base_caption,nai.prompt);
 assert.deepEqual(seen.parameters.v4_prompt.caption.char_captions,[]);
});
test('alpha185 malformed / stale NAI section data falls back to prior working pipe request',()=>{
 const compiled={...nai,sections:{...nai.sections,base:'wrong'}};const req=seedBody(compiled);
 assert.equal(Official.applyNativeNaiCaptions(req,compiled),false);
 assert.equal(req.input,compiled.prompt);
 assert.deepEqual(req.parameters.v4_prompt.caption.char_captions,[]);
});
test('alpha185 optional relation is not a generation veto and multiword tags are permitted',()=>{
 assert.equal(Core.VisualProtocol.relation('source#holding hands'),'source#holding hands');
 assert.equal(Core.VisualProtocol.relation('source#hug, on all fours, target#hug'),'source#hug, on all fours, target#hug');
 assert.equal(Core.VisualProtocol.relation('full description of all actions'),'full description of all actions');
 assert.equal(Core.VisualProtocol.relation('not a tag.'),'not a tag.');
 const withTag={...plan,characters:[{...plan.characters[0],relation:'not a tag.'}]};
 assert.equal(Core.compose(withTag,{positive:'game cg'},{format:'nai45'}).sections.characters[0].relation,'not a tag.');
});
test('alpha185 scene ambiguity stays a warning and generic has no NAI cast preference',()=>{
 const result=Core.compose({...plan,scene:'medium shot, 1girl, museum, portrait of a queen on the wall'},{positive:'cinematic still'},{format:'generic'});
 assert.match(result.prompt,/portrait of a queen/);
 assert.equal(result.renderAudit.crop,'unknown');
 assert.ok(result.renderAudit.warning);
 const rules=require('../src/assets/director-rules.json');
 const instructions=Core.buildInstruction({id:'alpha185',kind:'story_cg',storyInput:'开始',style:{},config:{format:'generic'}},rules,[]);
 assert.match(instructions,/入镜人数按玩家要求和画面决定/);
 assert.doesNotMatch(instructions,/自动主要角色上限/);
});


test('alpha190 NAI base prompt places style before Scene and DNA instruction requires one concise phrase per slot',()=>{
 const compiled=Core.compose(plan,{positive:'artist:test, game cg'},{format:'nai45'});
 assert.equal(compiled.sections.base,'artist:test, game cg, medium shot, 1girl, classroom, a girl sitting on a chair');
 const rules=require('../src/assets/director-rules.json');
 const instructions=Core.buildInstruction({id:'alpha190',kind:'character_intro',targetName:'曲曼',targetForm:'默认形态',style:{positive:'artist:test, game cg'},config:{format:'nai45'}},rules,[]);
 assert.match(instructions,/同一部位的颜色、形状等信息合并成一条/);
 assert.match(instructions,/不堆叠同义碎片/);
 assert.match(instructions,/登记DNA：\{"schema":1,"slots":\{"typeAge":"adult woman","hair":"short black hair","eyes":"brown eyes"\}\}/);
});
