'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../src/core.cjs');
const Rules=require('../src/director-rules.cjs');
const rules=require('../src/assets/director-rules.json');
const {fixture}=require('./helpers/equipment-fixture.cjs');

const body='她走出书店，在雨里撑起伞，身上仍穿着蓝色雨衣。';
const plan={
  scene:'medium shot, 1girl, a woman opens an umbrella outside a bookstore in the rain',
  sourceExcerpt:body,
  description:'她在书店门外撑起伞。',
  characters:[{name:'Alice',form:'默认形态',identity:'adult woman, black hair, brown eyes',equipment:{HEAD:[],TOP:[{name:'blue raincoat',visible:true}],LOWER:[],FULL:[],LEGWEAR:[],FOOTWEAR:[],HAND:[],ACCESSORIES:[]}}]
};

function request(overrides={}){
  return {id:'auto365',kind:'story_cg',request:'',storyInput:'她收起账本，准备离开书店。',config:{format:'nai45',imageService:'nai45',shot:'near'},...overrides};
}

test('static, character and saved-reply tasks retain their own output boundaries',()=>{
  const staticText=Core.buildInstruction(request({storyInput:''}),rules,[]);
  assert.match(staticText,/本轮无剧情行动：只设计静态画面，不推进事件、关系或时间/);
  assert.doesNotMatch(staticText,/正文之后写一个 <ad-visual>|先完成本轮正文/);
  assert.doesNotMatch(staticText,/【下一轮选景】|【定格与正文】/);
  const character=Core.buildInstruction(request({kind:'character_intro',targetName:'Alice'}),rules,[]);
  assert.doesNotMatch(character,/【下一轮选景】|【定格与正文】/);
  const visualOnly=Core.buildInstruction(request(),rules,[],{visualOnly:true});
  assert.match(visualOnly,/从已完成的本轮内容选一个画面，只输出视觉块/);
  assert.match(visualOnly,/只使用本轮画面要求与下方已保存回复中的剧情事实/);
  assert.doesNotMatch(visualOnly,/正文之后写一个 <ad-visual>|先完成本轮正文|关闭视觉块后写正文/);
  assert.doesNotMatch(visualOnly,/【下一轮选景】|【定格与正文】/);
  assert.ok(visualOnly.includes(rules.requestBoundary));
  assert.ok(visualOnly.includes(rules.narrativeBridge));
});

test('alpha367 next-turn catalog adds adult-scene selection priority without mutating shared rules',()=>{
  const original=structuredClone(rules),frozen=Object.freeze({...rules});
  const automatic=Rules.nextTurnCatalog(frozen,request());
  const explicit=Rules.nextTurnCatalog(frozen,request({request:'只画 Alice'}));
  assert.notEqual(automatic,frozen);
  assert.deepEqual(rules,original);
  const changed=Object.keys(original).filter(key=>automatic[key]!==original[key]);
  assert.deepEqual(changed,['requestBoundary','narrativeBridge']);
  assert.notEqual(automatic.requestBoundary,explicit.requestBoundary);
  assert.equal(automatic.narrativeBridge,explicit.narrativeBridge);
  for(const key of Object.keys(original).filter(key=>!changed.includes(key)))assert.equal(explicit[key],original[key]);
  assert.match(automatic.requestBoundary,/只从本轮会实际写进正文的事件中选景/);
  assert.match(automatic.requestBoundary,/单有愿望、假设、提议或面向以后可能发生的计划不触发/);
  assert.match(automatic.requestBoundary,/符合成人画面适用范围，且玩家未锁定具体瞬间时/);
  assert.match(automatic.requestBoundary,/成人情节已经结束并进入后续生活场景时，按本轮当前事件选景/);
  assert.match(automatic.requestBoundary,/优先选择最有表现力/);
  assert.match(explicit.requestBoundary,/相对位置、身体朝向、接触点和动作阶段，已指定的都要保留/);
  assert.ok(explicit.requestBoundary.indexOf('先锁定玩家') < explicit.requestBoundary.indexOf('优先选择最有表现力'));
  assert.match(automatic.requestBoundary,/已确立的体量在构图自然可见时可纳入比较/);
  assert.match(automatic.requestBoundary,/表现力始终服从剧情事实和玩家明确要求/);
  assert.match(rules.adultFraming,/只有这些动作与结构固定后，才选择机位/);
  assert.match(rules.adultPresence,/为每位脸部入镜的人选一个主表情，再定强度/);
  assert.match(rules.adultPresence,/剧情明确平静、克制或玩家指定构图时照原意处理/);
  assert.match(rules.adultVolume,/按本帧明确尺寸、该角色已保存的尺寸、下述默认值的顺序使用/);
  assert.equal(automatic.adultGate,original.adultGate,'the existing one-pass adult gate remains unchanged');
});

test('alpha365 character-design and generic prompts have no leaked mandatory adult reaction clause',()=>{
  for(const format of ['nai45','generic']){
    const design=Core.buildInstruction(request({kind:'character_intro',targetName:'Alice',storyInput:'',config:{format}}),rules,[]);
    assert.doesNotMatch(design,/成人互动画面要让这一帧|不能把双方都画成日常平静状态|不要让成人互动呈现成普通日常表情/);
    assert.doesNotMatch(design,/【成人画面·表现与反应】/);
    const story=Core.buildInstruction(request({config:{format}}),rules,[]);
    assert.doesNotMatch(story,/成人互动画面要让这一帧|不能把双方都画成日常平静状态|不要让成人互动呈现成普通日常表情/);
  }
  assert.match(rules.adultPresence,/把表现写进 Scene|将表现写进 Scene/);
  assert.match(rules.adultPresence,/剧情明确平静、克制或玩家指定构图时照原意处理/);
});

async function prepareQueued(f,generationId='auto365-first'){
  f.setInput('她收起账本，准备离开书店。');
  await f.app.queueNext({kind:'story_cg',request:''});
  const input=await f.tavo.input.get();
  f.messages.set(1,{id:1,role:'user',content:input});
  const event={generationId,chatId:1,source:'reply',text:input};
  await f.app.prepare(event);
  return event;
}

test('a pre-prose visual frame stays readable and generates once',async()=>{
  const f=fixture();await f.app.load();
  try{
    const event=await prepareQueued(f);
    assert.match(event.text,/先写一个 <ad-visual>/);
    event.text=Core.VisualProtocol.format({...plan,sourceExcerpt:undefined},'protocol')+'\n'+body;
    f.app.success(event);
    f.messages.set(2,{id:2,index:2,role:'assistant',content:event.text});
    await f.app.onSaved({chatId:1,message:{id:2,role:'assistant'}});
    const record=await f.app.readRecord(2),message=await f.app.getMessage(2);
    assert.equal(record.status,'done');
    assert.equal(record.plan.scene,plan.scene);
    assert.equal(record.plan.characters[0].equipment.TOP[0].name,'blue raincoat');
    assert.equal(Core.storyText(message.content),body);
    assert.equal(f.calls,1);
    assert.equal(f.textCalls,0);
  }finally{f.app.close();}
});

test('a missing scene waits for deliberate regeneration without duplicate submissions',async()=>{
  const f=fixture();await f.app.load();
  let auxiliaryCalls=0;
  f.tavo.generate=async()=>{auxiliaryCalls++;return '<ad-visual>\n人物：Alice\n外貌：adult woman, black hair\n</ad-visual>';};
  try{
    const event=await prepareQueued(f);
    event.text=body+'\n<ad-visual>\n人物：Alice\n外貌：adult woman, black hair\n</ad-visual>\n<ad-wardrobe>{"updates":[]}</ad-wardrobe>';
    f.app.success(event);
    f.messages.set(2,{id:2,index:2,role:'assistant',content:event.text});
    const saved={chatId:1,message:{id:2,role:'assistant'}};
    await f.app.onSaved(saved);
    const failed=await f.app.readRecord(2),failedRequestId=failed.requestId;
    assert.equal(failed.status,'failed');
    assert.equal(failed.errorCode,'DIRECTOR_PLAN_MISSING');
    assert.equal(failed.errorSource,'director-output');
    assert.equal(failed.plan,null);
    assert.equal(failed.images.length,0);
    assert.equal(f.calls,0);
    assert.equal(auxiliaryCalls,0);
    assert.equal(Core.storyText((await f.app.getMessage(2)).content),body);
    await f.app.onSaved(saved);
    assert.equal(auxiliaryCalls,0,'a duplicate host save is not another recovery request');
    assert.equal(f.calls,0);

    const retry={generationId:'auto365-manual-regeneration',chatId:1,source:'regeneration',messageId:2,text:''};
    await f.app.prepare(retry);
    retry.text=body+'\n'+Core.VisualProtocol.format(plan,'protocol')+'\n<ad-wardrobe>{"updates":[]}</ad-wardrobe>';
    f.app.success(retry);
    f.messages.set(2,{id:2,index:2,role:'assistant',content:retry.text});
    await f.app.onSaved(saved);
    const recovered=await f.app.readRecord(2);
    assert.equal(recovered.status,'done');
    assert.notEqual(recovered.requestId,failedRequestId,'a deliberate regeneration owns a fresh request');
    assert.equal(recovered.plan.scene,plan.scene);
    assert.equal(Core.storyText((await f.app.getMessage(2)).content),body);
    assert.equal(f.calls,1);
    assert.equal(auxiliaryCalls,0);
  }finally{f.app.close();}
});
