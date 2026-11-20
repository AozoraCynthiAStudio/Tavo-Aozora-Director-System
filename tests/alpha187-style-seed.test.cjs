'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,turn,core}=require('./helpers/equipment-fixture.cjs');
const builtins=require('../src/assets/styles.json');
const anime=builtins.find(x=>x.id==='mignon_allenes');
const semi=builtins.find(x=>x.id==='meekohopanes_ru_zhai');
const originalScene='medium shot, 1girl, old elevator, holding a whole watermelon, warm corridor light';
const plan={scene:originalScene,description:'她抱着一个西瓜。',characters:[{name:'曲曼',form:'默认形态',identity:'adult woman, black ponytail, warm brown eyes',equipment:{HEAD:[],TOP:[{name:'gray sweatshirt',state:'',visible:true}],LOWER:[],FULL:[],LEGWEAR:[],FOOTWEAR:[],HAND:[],ACCESSORIES:[]}}]};

async function setup(initialStyle=anime){
 const f=fixture();await f.app.load();
 await f.app.saveStyles([anime,semi,{id:'generic-test',format:'generic',name:'自然写实',positive:'cinematic digital painting',negative:'low resolution',useNegative:true}]);
 await f.app.saveConfig({styleId:initialStyle.id,format:'nai45',ratio:'16:9',seedFixed:true,seedValue:'12345'});
 await turn(f,{mid:2,plan});
 const rec=await f.app.readRecord(2);assert.equal(rec.status,'done');return {f,source:rec.images[0]};
}

test('alpha187 only strips complete known style clauses, preserving scene facts and independent style words',()=>{
 const combined=originalScene+', '+anime.positive;
 assert.equal(core.cleanSceneStyles(combined,[anime,semi]),originalScene);
 assert.equal(core.cleanSceneStyles(combined+', '+semi.positive,[anime,semi]),originalScene);
 assert.equal(core.cleanSceneStyles(originalScene+', an anime poster on the wall',[anime]),originalScene+', an anime poster on the wall');
 assert.equal(core.cleanSceneStyles('portrait of a woman, game cg on a computer display',[anime,semi]),'portrait of a woman, game cg on a computer display');
 assert.equal(core.cleanSceneStyles(originalScene+', watercolor texture',[{positive:'watercolor texture'}]),originalScene);
 assert.equal(core.cleanSceneStyles(originalScene+', artist:unknown',[anime,semi]),originalScene+', artist:unknown');
});

test('alpha187 33.zip historical-style contamination is removed on recompile, without replacing original shot or cast',async()=>{
 const {f,source}=await setup(anime);
 // Same shape as 33.zip: record.plan is clean, but a saved image plan/scene
 // contains an entire older ACG preset. The source scene is not replaced by
 // record.plan because later candidates may have different poses/framing.
 const contaminated=originalScene+', '+anime.positive;
 await f.store.mutateRecord(2,r=>{r.images[0].plan.scene=contaminated;r.images[0].renderedScene=contaminated;return r;},f.store.token());
 await f.app.saveConfig({styleId:semi.id});
 await f.app.generate(2,true,source.id);
 let rec=await f.app.readRecord(2);
 assert.equal(f.calls,2);
 const next=rec.images.at(-1);
 assert.equal(next.plan.scene,originalScene);
 assert.equal(next.renderedScene,originalScene);
 assert.equal(rec.plan.scene,originalScene);
 assert.equal(next.sections.base,semi.positive.replace(/,\s*/g,', ')+', '+originalScene);
 assert.equal(next.prompt.split(' | ')[0],next.sections.base);
 assert.doesNotMatch(next.prompt,/artist:mignon|anime coloring|cel shading/);
 assert.equal(next.options.negativePrompt,semi.negative,'old negative style must also be replaced');
 assert.match(next.sections.characters[0].prompt,/black ponytail/);
 // Repeating with the same Seed and current style is identical, even though
 // a historical candidate with a contaminated Scene still exists.
 await assert.rejects(f.app.generate(2,true,next.id),{code:'UNCHANGED_FIXED_SEED'});
 assert.equal(f.calls,2);
 rec=await f.app.readRecord(2);assert.equal(rec.status,'done');assert.equal(rec.images.length,2);
 f.app.close();
});

test('alpha187 fixed Seed blocks only an identical request, leaving previous image and status untouched',async()=>{
 const {f,source}=await setup();
 await assert.rejects(f.app.generate(2,true,source.id),{code:'UNCHANGED_FIXED_SEED'});
 assert.equal(f.calls,1);let rec=await f.app.readRecord(2);assert.equal(rec.status,'done');assert.equal(rec.images.length,1);
 assert.equal(rec.error||'','');
 await f.app.saveConfig({styleId:semi.id});
 await f.app.generate(2,true,source.id);
 assert.equal(f.calls,2);
 const different= (await f.app.readRecord(2)).images.at(-1);
 assert.equal(different.options.extraBody.seed,12345);
 assert.doesNotMatch(different.prompt,/artist:mignon/);
 await assert.rejects(f.app.generate(2,true,different.id),{code:'UNCHANGED_FIXED_SEED'});
 assert.equal(f.calls,2);
 await f.app.saveConfig({ratio:'2:3'});
 await f.app.generate(2,true,different.id);
 const ratioImage=(await f.app.readRecord(2)).images.at(-1);
 assert.equal(f.calls,3);assert.equal(ratioImage.options.aspectRatio,'2:3');assert.equal(ratioImage.requestedSeed,12345);
 await f.app.saveConfig({seedValue:'23456'});
 await f.app.generate(2,true,ratioImage.id);
 assert.equal(f.calls,4);
 assert.equal((await f.app.readRecord(2)).images.at(-1).requestedSeed,23456);
 assert.equal(f.textCalls,0,'ordinary reroll must not ask the text model to direct a new scene');
 f.app.close();
});

test('alpha187 generic prompt stays generic and uses only the selected general style',async()=>{
 const {f,source}=await setup();
 await f.app.saveConfig({format:'generic',imageService:'generic',styleId:'generic-test'});
 await f.app.generate(2,true,source.id);
 const image=(await f.app.readRecord(2)).images.at(-1);
 assert.equal(image.syntax,'generic-natural-language');
 assert.match(image.prompt,/cinematic digital painting/);
 assert.doesNotMatch(image.prompt,/artist:mignon|cel shading|\{artist:meekohopanes\}/);
 assert.equal(image.plan.scene,originalScene);
 assert.equal(image.requestedSeed,12345);
 f.app.close();
});

test('alpha187 user-authored clean Scene is not modified by switching styles',async()=>{
 const {f,source}=await setup();
 await f.app.saveConfig({styleId:semi.id});
 await f.app.generate(2,true,source.id);
 const image=(await f.app.readRecord(2)).images.at(-1);
 assert.equal(image.plan.scene,source.plan.scene);
 assert.equal(image.plan.characters[0].identity,source.plan.characters[0].identity);
 assert.match(image.prompt,/warm corridor light/);
 assert.equal(image.options.extraBody.seed,source.options.extraBody.seed);
 f.app.close();
});

test('alpha187 official native static settings: fixed Seed permits real scale/size edits, ignores img2img-only changes',async()=>{
 const f=fixture();await f.app.load();await f.app.saveStyles([anime,semi]);
 await f.app.saveConfig({format:'nai45',imageService:'nai45',styleId:anime.id,seedFixed:true,seedValue:'12345',ratio:'api'});
 const p={model:'nai-diffusion-4-5-full',width:1216,height:832,scale:5.5,steps:28,sampler:'k_dpmpp_2m',noiseSchedule:'exponential',strength:0.65,noise:0,seedMode:'random'};
 await f.tavo.variable.set('aozora_direct_official_v1',{provider:'official',officialGeneration:p},'global');
 await turn(f,{mid:2,plan});const first=(await f.app.readRecord(2)).images[0];
 assert.equal(first.config.generationParameters.scale,5.5);
 await assert.rejects(f.app.generate(2,true,first.id),{code:'UNCHANGED_FIXED_SEED'});
 assert.equal(f.calls,1);
 // These only apply to img2img, and must not accidentally bypass duplicate protection.
 await f.tavo.variable.set('aozora_direct_official_v1',{provider:'official',officialGeneration:{...p,strength:0.75,noise:0.3}},'global');
 await assert.rejects(f.app.generate(2,true,first.id),{code:'UNCHANGED_FIXED_SEED'});
 assert.equal(f.calls,1);
 await f.tavo.variable.set('aozora_direct_official_v1',{provider:'official',officialGeneration:{...p,scale:6.5}},'global');
 await f.app.generate(2,true,first.id);
 let next=(await f.app.readRecord(2)).images.at(-1);
 assert.equal(f.calls,2);assert.equal(next.config.generationParameters.scale,6.5);
 assert.equal(next.options.extraBody.seed,12345);
 await f.tavo.variable.set('aozora_direct_official_v1',{provider:'official',officialGeneration:{...p,scale:6.5,width:832,height:1216}},'global');
 await f.app.generate(2,true,next.id);
 next=(await f.app.readRecord(2)).images.at(-1);
 assert.equal(f.calls,3);assert.equal(next.options.extraBody.width,832);assert.equal(next.options.extraBody.height,1216);
 assert.equal(f.textCalls,0);
 f.app.close();
});

test('alpha187 UI no longer vetoes fixed Seed before effective-request comparison',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const controller=fs.readFileSync(path.join(__dirname,'../src/ui/controller.js'),'utf8');
 const reader=fs.readFileSync(path.join(__dirname,'../src/ui/reader.js'),'utf8');
 assert.doesNotMatch(controller,/fixedSeedNotice/);
 assert.doesNotMatch(controller,/固定 Seed 时不能重抽|固定 Seed 时不能新增/);
 assert.doesNotMatch(reader,/固定 Seed 时不能重抽/);
 assert.match(controller,/app\.generate\(mid,true,item\.id/);
});
