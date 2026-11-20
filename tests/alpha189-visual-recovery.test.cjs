'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Core=require('../src/core.cjs');
const {createStore}=require('../src/storage.cjs');
const {createApp}=require('../src/app.cjs');
const rules=require('../src/assets/director-rules.json');
const equipment={HEAD:null,TOP:[{name:'white t-shirt',visible:true}],LOWER:[{name:'grey trousers',visible:true}],FULL:null,LEGWEAR:null,FOOTWEAR:[{name:'grey sneakers',visible:true}],HAND:null,ACCESSORIES:null};
const dna={schema:1,slots:{typeAge:'adult man, 22 years old',hair:'short black hair',eyes:'brown eyes',face:'slim face',build:'slim delicate build'}};
const scene='medium shot, 1boy, standing near an elevator, holding a watermelon, warm light';
const story='你低头咬了一口西瓜。瓜很甜，汁水顺着指缝滴下来。';
const plan={scene,sourceExcerpt:story,description:'他站在电梯旁抱着西瓜。',characters:[{name:'阿明',form:'默认形态',identity:'adult man, 22 years old, short black hair, brown eyes, slim face',registrationDNA:dna,equipment}]};
function fixture(){
 const vars=new Map(),messages=new Map(),files=new Map();let input='继续剧情',calls=0;
 const tavo={chat:{current:async()=>({id:1})},variable:{get:async(k,s='chat')=>structuredClone(vars.get(s+':'+k)),set:async(k,v,s='chat')=>vars.set(s+':'+k,structuredClone(v))},file:{exists:async n=>files.has(n),load:async n=>files.get(n)||null,save:async(n,v)=>{files.set(n,v);return 'files/chat/'+n;},delete:async n=>files.delete(n)},message:{get:async id=>messages.get(Number(id))},input:{get:async()=>input,set:async v=>{input=v}}};
 vars.set('chat:aozora_director_v1.config',{format:'nai45',imageService:'generic'});
 const provider={generate:async(compiled,job,guard)=>{await guard();calls++;return {pointer:'files/chat/test-alpha189-'+calls+'.png',seed:1,seedSource:'response',requestedSeed:compiled.requestedSeed}}};
 const app=createApp(tavo,Core,createStore(tavo,Core),provider,{rules,styles:[{id:'test',format:'nai45',basis:'NAI 4.5',positive:'game cg',negative:'lowres',useNegative:true}]});
 return {app,tavo,messages,get calls(){return calls}};
}
async function runFixture(transform){
 const f=fixture();await f.app.load();await f.app.queueNext({kind:'story_cg'});
 const prepare={generationId:'alpha189-g',chatId:1,text:await f.tavo.input.get()};await f.app.prepare(prepare);
 const id=prepare.text.match(/<ad-visual id="([^"]+)"/)[1];
 const e={generationId:'alpha189-g',chatId:1,text:transform(Core.VisualProtocol.format(plan,id),id)};
 f.app.success(e);f.messages.set(2,{id:2,role:'assistant',content:e.text});await f.app.onSaved({chatId:1,message:{id:2,role:'assistant'}});
 return {f,e,record:await f.app.readRecord(2),id};
}
test('alpha.189: missing visual wrapper with uniquely valid fields still generates once, hides JSON and preserves story',async()=>{
 const {f,e,record}=await runFixture(block=>block.replace(/^<ad-visual[^>]*>/,'').replace('</ad-visual>','')+'\n'+story);
 assert.equal(f.calls,1);assert.equal(record.status,'done');assert.equal(record.plan.scene,scene);
 assert(!e.text.includes('登记DNA：'));assert(!e.text.includes('装备：'));assert(e.text.includes(story));assert.match(e.text,/ad-director/);f.app.close();
});
test('alpha.189: valid fields with unclosed visual wrapper can be safely recovered',async()=>{
 const {f,e,record}=await runFixture(block=>block.replace('</ad-visual>','')+'\n'+story);
 assert.equal(f.calls,1);assert.equal(record.status,'done');assert(!e.text.includes('<ad-visual'));assert(e.text.includes(story));f.app.close();
});
test('alpha.189: a model-authored foreign visual id is treated as structure, then rebound internally to this generation',async()=>{
 const {f,e,record,id}=await runFixture(block=>block.replace(/id="[^"]+"/,'id="foreign_request"')+'\n'+story);
 assert.equal(f.calls,1);assert.equal(record.status,'done');assert.equal(record.plan.scene,scene);assert.notEqual(record.requestId,'foreign_request');
 assert(!e.text.includes('ad-visual'));assert(!e.text.includes('ad-wardrobe'));assert(e.text.includes(story));assert.match(e.text,/ad-director:/);f.app.close();
});
test('alpha.189: identical duplicate visual blocks yield one picture and never leak DNA',async()=>{
 const {f,e,record}=await runFixture(block=>block+'\n'+block+'\n'+story);
 assert.equal(f.calls,1);assert.equal(record.status,'done');assert.equal(record.plan.scene,scene);assert(!e.text.includes('登记DNA：'));assert(!e.text.includes('装备：'));assert(e.text.includes(story));f.app.close();
});
test('alpha.189: out-of-order group number is normalized without discarding the scene',async()=>{
 const {f,e,record}=await runFixture(block=>block.replace('【人物 1】','【人物 2】')+'\n'+story);
 assert.equal(f.calls,1);assert.equal(record.status,'done');assert.equal(record.plan.scene,scene);assert(!e.text.includes('登记DNA：'));assert(!e.text.includes('装备：'));assert(e.text.includes(story));f.app.close();
});
test('alpha.189: unwrapped group with CRLF and irregular numbering preserves the current scene',async()=>{
 const {f,e,record}=await runFixture(block=>block.replace(/^<ad-visual[^>]*>/,'').replace('</ad-visual>','').replace('【人物 1】','【人物 2】').replaceAll('\n','\r\n')+'\r\n'+story);
 assert.equal(f.calls,1);assert.equal(record.status,'done');assert.equal(record.plan.scene,scene);assert(!e.text.includes('登记DNA：'));assert(!e.text.includes('装备：'));assert(e.text.includes(story));f.app.close();
});
