'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Motion=require('../src/motion-prompt.cjs'),Core=require('../src/core.cjs');
const {fixture,turn}=require('./helpers/equipment-fixture.cjs');
const scene='medium shot, 1girl, a woman holds a book by a window';
const target='medium shot, 1girl, a woman raises a book by a window';
const plan={scene,characters:[{name:'Alice',identity:'adult woman, green eyes',equipment:Core.Wardrobe.normalizeEquipment({TOP:[{name:'blue coat'}]})}]};
const data=()=>({scene:target,focuses:[{text:'raises a book',weight:5}],poseEdits:[]});
const compiled=Core.compose(plan,{positive:'game cg'},{format:'nai45'}),source={...compiled,plan};
const wraps=[
 ['plain text',value=>JSON.stringify(value)],
 ['direct object',value=>value],
 ['text response',value=>({text:JSON.stringify(value)})],
 ['content response',value=>({content:JSON.stringify(value)})],
 ['content blocks',value=>({content:[{type:'text',text:JSON.stringify(value)}]})],
 ['nested message',value=>({choices:[{message:{role:'assistant',content:JSON.stringify(value)}}]})],
 ['structured result',value=>({result:value})],
 ['JSON string envelope',value=>JSON.stringify({result:value})],
 ['fenced scene',value=>'```json\n'+JSON.stringify(value)+'\n```'],
 ['prose wrapper',value=>'说明\n'+JSON.stringify({unrelated:1})+'\n'+JSON.stringify(value)],
 ['thinking excluded',value=>'<think>'+JSON.stringify({...value,scene:'an abandoned alternative'})+'</think>\n'+JSON.stringify(value)],
 ['escaped quotes',value=>'说明\n'+JSON.stringify({...value,note:'a sign reads "quiet {please}"'})],
 ['double encoded',value=>JSON.stringify(JSON.stringify(value))]
];
for(const [name,wrap]of wraps)test('response parser accepts '+name+' without dropping current scene data',()=>{
 const result=Motion.editOriginal(wrap(data()),source);
 assert.match(result.prompt,/5::raises a book::/);
 assert.deepEqual(result.prompt.split('|').slice(1),compiled.prompt.split('|').slice(1));
});

test('multiple returned targets select an available scene instead of blocking generation',()=>{
 for(const values of [[data(),{...data(),scene:target+', outside'}],[data(),{...data(),focuses:[{text:'raises a book',weight:4}]}]]){
  assert.match(Motion.editOriginal(values.map(JSON.stringify).join('\n'),source).prompt,/raises a book/);
 }
});

test('empty, refusal, truncated and wrong-field responses have distinguishable parse failures',()=>{
 assert.throws(()=>Motion.editOriginal({content:[]},source),error=>error.code==='MOTION_RESPONSE_EMPTY');
 assert.throws(()=>Motion.editOriginal('无法完成请求',source),error=>error.code==='TEXT_MODEL_REFUSED');
 for(const raw of ['{"scene":"not closed','{"target":"wrong field"}'])assert.throws(()=>Motion.editOriginal(raw,source),error=>error.code==='MOTION_RESPONSE_INVALID');
});

test('explicit model refusals are distinguished from transport and JSON failures',()=>{
 for(const raw of ["I can't help with this request.","I'm sorry, I cannot assist with that request.",'抱歉，我无法帮助完成该请求。']){
  assert.throws(()=>Motion.editOriginal(raw,source),error=>error.code==='TEXT_MODEL_REFUSED');
 }
 assert.equal(Core.Status.imageFailure({code:'TEXT_MODEL_REFUSED'}).title,'文本模型拒绝请求');
 const valid={...data(),scene:target+', a sign reads "I cannot help"'};
 assert.match(Motion.editOriginal(JSON.stringify(valid),source).prompt,/raises a book/);
});

async function setup(){
 const f=fixture();await f.app.load();await turn(f,{mid:2,body:'她站在窗边拿着书。',plan});
 await f.app.saveConfig({format:'nai45',imageService:'nai45'});
 await f.store.mutateRecord(2,r=>({...r,images:r.images.map(i=>({...i,config:{...i.config,format:'nai45',imageService:'nai45'}}))}));
 await f.tavo.variable.set('aozora_motion_connection_v1',{provider:'official',apiKey:'fixture-only'},'global');
 return {f,image:(await f.app.readRecord(2)).images[0]};
}
for(const still of [false,true])test((still?'img2img':'animation')+' receives structured and block responses through the actual app entry',async()=>{
 const {f,image}=await setup();
 try{
  let calls=0;f.tavo.generate=async()=>{calls++;return still?{content:[{type:'text',text:JSON.stringify(data())}]}:data();};
  await f.app.animate(2,image.id,'举起书',still);
  assert.equal(calls,1);assert.equal(f.calls,2);
  const result=(await f.app.readRecord(2)).images.at(-1);
  assert.match(result.prompt,/raises a book/);
  assert.deepEqual(result.prompt.split('|').slice(1),image.prompt.split('|').slice(1));
  assert.deepEqual(f.compiled.at(-1).options.referenceImages,[image.pointer]);
 }finally{f.app.close();}
});

for(const still of [false,true])test((still?'img2img':'animation')+' preserves the source and reports a model refusal without retry or image submission',async()=>{
 const {f,image}=await setup(),events=[],off=f.app.subscribe(event=>events.push(event));
 try{
  const before=await f.app.readRecord(2),message=structuredClone(f.messages.get(2));
  let calls=0;f.tavo.generate=async()=>{calls++;return "I can't help with this request.";};
  await assert.rejects(f.app.animate(2,image.id,'举起书',still),error=>error.code==='TEXT_MODEL_REFUSED');
  assert.equal(calls,1);assert.equal(f.calls,1);
  assert.deepEqual((await f.app.readRecord(2)).images,before.images);
  assert.deepEqual(f.messages.get(2),message);
  const failure=events.find(e=>e.type==='activity'&&e.task?.diagnostics);
  assert.equal(failure.task.diagnostics.errorCode,'TEXT_MODEL_REFUSED');
  assert.match(failure.task.diagnostics.responseText,/can't help/);
 }finally{off();f.app.close();}
});

test('a failing app response emits redacted evidence in the same exported activity data',async()=>{
 const {f,image}=await setup(),events=[];const off=f.app.subscribe(event=>events.push(event));
 try{
  f.tavo.generate=async()=>({content:[{type:'text',text:'No JSON returned; Bearer sk-123456789012345678901234'}]});
  await assert.rejects(f.app.animate(2,image.id,'举起书'),error=>error.code==='MOTION_RESPONSE_INVALID');
  const event=events.find(e=>e.type==='activity'&&e.task?.diagnostics);
  assert.ok(event);assert.equal(event.task.diagnostics.responseType,'object');
  assert.match(event.task.diagnostics.responseText,/No JSON returned/);
  assert.doesNotMatch(event.task.diagnostics.responseText,/sk-123456789012345678901234/);
  assert.equal(event.task.diagnostics.version,require('../package.json').version);
  assert.match(event.task.diagnostics.responseEnvelope,/content/);
  assert.doesNotMatch(event.task.diagnostics.responseEnvelope,/sk-123456789012345678901234/);
  assert.equal(f.calls,1);
 }finally{off();f.app.close();}
});

test('exported preparation-failure logs retain the response evidence and running version',()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const source=fs.readFileSync(path.join(__dirname,'../src/ui/controller.js'),'utf8');
 const begin=source.indexOf('    function writeLog('),end=source.indexOf('  function closeStage(',begin);
 const exportLine=source.split('\n').find(line=>line.includes('function logReport(rows)'));
 const sandbox={core:Core,Date,logs:[],logSequence:0,taskStatuses:{failed:'失败'},$:()=>({closest:()=>({hidden:true})})};
 vm.createContext(sandbox);vm.runInContext(source.slice(begin,end)+'\n'+exportLine+'\nthis.write=writeLog;this.export=logReport;',sandbox);
 sandbox.write({type:'activity',task:{operationId:'visual-test',phase:'failed',messageId:'2',error:'failed',diagnostics:{errorCode:'MOTION_RESPONSE_INVALID',responseText:'The actual returned text'}}});
 const report=JSON.parse(sandbox.export(sandbox.logs));
 assert.equal(report.version,Core.VERSION);
 assert.equal(report.tasks[0].diagnostics.responseText,'The actual returned text');
});
