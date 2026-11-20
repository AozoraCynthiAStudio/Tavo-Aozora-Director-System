'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Core=require('../src/core.cjs');
const rules=require('../src/assets/director-rules.json');
const {fixture,turn}=require('./helpers/equipment-fixture.cjs');

function instruction(kind,storyInput){return Core.buildInstruction({id:'alpha193-test',kind,targetName:'曲曼',targetForm:'默认形态',storyInput,style:{positive:'artist:test'},config:{format:'nai45'}},rules,[]);}

test('alpha193 one shared DNA paragraph is included once in character design and story changes',()=>{
 for(const [kind,story]of [['character_intro',''],['story_cg','继续剧情']]){
  const text=instruction(kind,story);
  assert.equal(text.split(Core.DNA.instruction).length-1,1,'a task must receive exactly one copy of the canonical DNA principle');
  assert.match(text,/统一人物DNA原则（首次设计、人物微调、剧情外貌变化通用）/);
  assert.match(text,/同一部位的颜色、形状等信息合并成一条/);
  assert.match(text,/AI自行补充的外貌不得触发超12槽/);
  assert.match(text,/已占用时，才允许extra5/);
 }
 assert.match(instruction('character_intro',''),/^登记DNA：/m);
});

test('alpha193 Aozora strips its own fields while preserving QR and archive markup after wardrobe',()=>{
 const empty={HEAD:null,TOP:[],LOWER:null,FULL:null,LEGWEAR:null,FOOTWEAR:null,HAND:null,ACCESSORIES:null};
 const plan={scene:'medium shot, 1girl, kitchen',description:'她坐在厨房里。',characters:[{name:'曲曼',form:'默认形态',identity:'adult woman, round black eyes',equipment:empty}]};
 const visual=Core.VisualProtocol.format(plan,'alpha193-sample');
 const wardrobe='<ad-wardrobe id="alpha193-sample">{"updates":[]}</ad-wardrobe>';
 const lore='<apt-drawer><dtitle>人物状态</dtitle></apt-drawer>\n<qr><opt>继续聊天</opt></qr>';
 const full=visual+'\n她微笑着听你说话。\n'+wardrobe+'\n'+lore;
 const parsed=Core.parseVisual(full,'alpha193-sample');
 assert.equal(parsed.plan.characters.length,1);
 assert.deepEqual(Core.Wardrobe.parseUpdates(full,'alpha193-sample'),[]);
 const processed=Core.renderVisual(full,parsed,{id:'alpha193-sample',storyInput:'继续剧情'},parsed.plan);
 const visible=Core.storyText(processed);
 assert.match(visible,/她微笑着听你说话/);
 assert.match(visible,/<apt-drawer><dtitle>人物状态<\/dtitle><\/apt-drawer>/);
 assert.match(visible,/<qr><opt>继续聊天<\/opt><\/qr>$/);
 assert.doesNotMatch(visible,/<ad-visual|<ad-wardrobe|登记DNA：/);
});

test('alpha193 microtuning receives the same DNA paragraph only once',async()=>{
 const f=fixture();await f.app.load();
 const plan={scene:'medium shot, 1girl, kitchen',characters:[{name:'曲曼',form:'默认形态',identity:'adult woman, round black eyes',registrationDNA:{schema:1,slots:{typeAge:'adult woman',eyes:'round black eyes'}},equipment:{HEAD:null,TOP:[],LOWER:null,FULL:null,LEGWEAR:null,FOOTWEAR:null,HAND:null,ACCESSORIES:null}}]};
 await turn(f,{mid:11,plan,body:'她站在厨房。'});
 const rec=await f.app.readRecord(11);assert.equal(rec.status,'done');
 let prompt='';f.tavo.generate=async value=>{prompt=value;return JSON.stringify({dnaChanges:[{index:0,slots:{eyes:'round amber eyes'}}],wardrobeUpdates:[]});};
 try{
  await f.app.tune(11,rec.images[0].id,'瞳色改琥珀色，眼型不变');
  assert.equal(prompt.split(Core.DNA.instruction).length-1,1);
  assert.match(prompt,/【微调专属】/);
  assert.match(prompt,/不机械翻译原句/);
  const newRec=await f.app.readRecord(11);
  assert.match(newRec.images.at(-1).prompt,/round amber eyes/);
 }finally{f.app.close();}
});


test('alpha194 standalone static caption is preserved even when other visible structures exist',()=>{
 const request={id:'alpha194-cap',storyInput:'',request:'测试静态描述',kind:'character_intro',targetName:'曲曼',targetForm:'默认形态'};
 const plan={scene:'1girl, standing',description:'曲曼站在门口抱着西瓜，微微低头看向你。',characters:[]};
 const block=Core.VisualProtocol.format(plan,request.id);
 const text=block+'\n\n<qr><opt>就这个，登记吧</opt></qr>';
 const parsed=Core.parseVisual(text,request.id);
 const visible=Core.renderVisual(text,parsed,request,plan);
 assert.match(visible,/【静态画面】曲曼站在门口抱着西瓜，微微低头看向你。/);
 assert.match(visible,/<qr><opt>就这个，登记吧<\/opt><\/qr>/);
});
