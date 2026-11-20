'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Core=require('../src/core.cjs'),{createStore}=require('../src/storage.cjs'),{createApp}=require('../src/app.cjs');
const rules=require('../src/assets/director-rules.json');
const empty=()=>({HEAD:[],TOP:[],LOWER:[],FULL:[],LEGWEAR:[],FOOTWEAR:[],HAND:[],ACCESSORIES:[]});
const identity='adult woman, 29 years old, curly black hair, wide brown eyes, broad face, strong jaw, 188 cm tall, tanned skin, muscular build';
const dna={schema:1,slots:{typeAge:'adult woman, 29 years old',height:'188 cm tall',skin:'tanned skin',hair:'curly black hair',eyes:'wide brown eyes',face:'broad face, strong jaw',build:'muscular build'}};
function fixture(){
 let chat=1,calls=0,input='继续剧情';const vars=new Map(),files=new Map(),messages=new Map(),compiled=[];
 const tavo={chat:{current:async()=>({id:chat})},variable:{get:async(k,s='chat')=>structuredClone(vars.get(s+':'+(s==='chat'?chat:'')+':'+k)),set:async(k,v,s='chat')=>vars.set(s+':'+(s==='chat'?chat:'')+':'+k,structuredClone(v))},file:{exists:async n=>files.has(chat+':'+n),load:async n=>files.get(chat+':'+n)||null,save:async(n,data)=>{files.set(chat+':'+n,data);return 'files/chat/'+n;},delete:async n=>files.delete(chat+':'+n)},message:{get:async id=>messages.get(Number(id))},input:{get:async()=>input,set:async text=>{input=text;}},generate:async()=>JSON.stringify({changes:[],wardrobeUpdates:[]})};
 vars.set('chat:1:aozora_director_v1.config',{format:'nai45',imageService:'generic'});
 const provider={generate:async(compiledPrompt,job,guard)=>{await guard();calls++;compiled.push(structuredClone(compiledPrompt));const pointer='files/chat/image_test_'+calls+'.png';files.set(chat+':'+pointer,'image');return {pointer,seed:42,seedSource:'response',requestedSeed:compiledPrompt.requestedSeed};}};
 const app=createApp(tavo,Core,createStore(tavo,Core),provider,{rules,styles:[{id:'s',format:'nai45',basis:'NAI 4.5',name:'test style',positive:'game cg',negative:'lowres',useNegative:true}]});
 return {app,tavo,messages,compiled,vars,get calls(){return calls},setGenerate:fn=>tavo.generate=fn};
}
async function deliver(f,kind='story_cg'){
 await f.app.load();await f.app.queueNext(kind==='character_intro'?{kind,targetName:'曲曼',targetForm:'默认形态'}:{kind});
 const prep={generationId:'g184',chatId:1,text:await f.tavo.input.get()};await f.app.prepare(prep);const id=prep.text.match(/<ad-visual id="([^"]+)"/)[1];
 const p={scene:'medium shot, 1girl, old apartment, the woman seated beside a window, both hands on her lap, smiling',description:'她坐在窗边，手放在膝上。',characters:[{name:'曲曼',form:'默认形态',identity:Core.DNA.snapshotIdentity(dna),registrationDNA:dna,equipment:{...empty(),FULL:[{name:'black dress',state:'worn',visible:true}],LEGWEAR:[{name:'sheer black pantyhose',state:'worn',visible:true}]}}]};
 const body='她穿着黑色连衣裙和黑色薄连裤袜，坐在窗边，微笑着把双手放在膝上。';
 const event={generationId:'g184',chatId:1,text:body+'\n'+Core.VisualProtocol.format({...p,sourceExcerpt:body},id)};
 f.app.success(event);f.messages.set(2,{id:2,role:'assistant',content:event.text});await f.app.onSaved({chatId:1,message:{id:2,role:'assistant'}});
 const record=await f.app.readRecord(2);return {record,id,p};
}
test('v184 end-to-end: queue -> generate text with single Scene -> save image -> reroll, without losing appearance/stockings',async()=>{
 const f=fixture(),{record}=await deliver(f);assert.equal(f.calls,1);assert.equal(record.status,'done');assert.equal(record.images.length,1);
 const image=record.images[0];assert.ok(!Object.hasOwn(image.plan.characters[0],'action'));assert.match(image.prompt,/both hands on her lap/);assert.match(image.prompt,/sheer black pantyhose/);
 await f.app.generate(2,true,image.id);assert.equal(f.calls,2);const next=await f.app.readRecord(2);assert.equal(next.images.length,2);
 assert.ok(f.compiled.every(c=>!c.characters.some(x=>Object.hasOwn(x,'action'))));f.app.close();
});
test('v184 image tuning changes one full Scene and appends separate candidate without rewriting registered DNA',async()=>{
 const f=fixture(),{record}=await deliver(f,'character_intro');const source=record.images[0];
 let promptSeen='';f.setGenerate(async prompt=>{promptSeen=prompt;return JSON.stringify({scene:'medium shot, 1girl, old apartment, the woman standing next to a table, arms folded, looking at the viewer',changes:[],wardrobeUpdates:[],dnaSnapshots:[{index:0,registrationDNA:dna}]});});
 await f.app.tune(2,source.id,'把姿势改成站在桌旁抱臂');const next=await f.app.readRecord(2);
 assert.match(promptSeen,/唯一|scene/i);assert.equal(next.images.length,2);assert.match(next.images[1].prompt,/arms folded/);assert.ok(!Object.hasOwn(next.images[1].plan.characters[0],'action'));assert.match(next.images[1].prompt,/sheer black pantyhose/);
 assert.match(next.images[1].prompt,/broad face, strong jaw/);assert.match(next.images[0].prompt,/both hands on her lap/);f.app.close();
});
test('v185 unregistered character candidate supports two successive DNA slot edits, keeps all candidates and formal profile untouched',async()=>{
 const f=fixture(),{record}=await deliver(f,'character_intro'),original=record.images[0];
 f.setGenerate(async prompt=>{
   assert.match(prompt,/dnaChanges/);
   assert.match(prompt,/原图实际生图提示词/);
   return JSON.stringify({dnaChanges:[{index:0,slots:{eyes:'amber eyes'}}],changes:[],wardrobeUpdates:[]});
 });
 await f.app.tune(2,original.id,'把眼睛改成琥珀色');
 let next=await f.app.readRecord(2);
 assert.equal(next.images.length,2);
 const amber=next.images[1];
 assert.match(amber.prompt,/amber eyes/);
 assert.match(amber.prompt,/curly black hair/);
 assert.equal(amber.plan.characters[0].registrationDNA.slots.eyes,'amber eyes');
 assert.equal(original.plan.characters[0].registrationDNA.slots.eyes,'wide brown eyes');
 f.setGenerate(async()=>JSON.stringify({dnaChanges:[{index:0,slots:{hair:'short silver hair'}}],wardrobeUpdates:[]}));
 await f.app.tune(2,amber.id,'把头发改为银色短发');
 next=await f.app.readRecord(2);
 assert.equal(next.images.length,3);
 const silver=next.images[2];
 assert.match(silver.prompt,/short silver hair/);
 assert.match(silver.prompt,/amber eyes/);
 assert.equal(silver.plan.characters[0].registrationDNA.slots.eyes,'amber eyes');
 assert.equal(silver.plan.characters[0].registrationDNA.slots.hair,'short silver hair');
 assert.equal(f.calls,3);
 assert.match(original.prompt,/curly black hair/);
 // Neither tuning operation silently registers the candidate.
 assert.deepEqual(f.app.snapshot().profiles,[]);
 f.app.close();
});
