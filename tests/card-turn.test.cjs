'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture,turn}=require('./helpers/equipment-fixture.cjs');
const {plan}=require('./fixtures/shot4313.json');

function setup(){
  const f=fixture();
  f.tavo.message.count=async()=>f.messages.size;
  f.tavo.message.find=async(range,filter)=>{
    const rows=[...f.messages.values()];
    const page=range===-1?rows.slice(-1):Array.isArray(range)?rows.slice(range[0],range[1]+1):rows;
    return {items:page.filter(message=>!filter?.role||message.role===filter.role)};
  };
  return f;
}

function deleted(f,...ids){
  for(const id of ids)f.messages.delete(id);
  return Promise.all(ids.map(messageId=>f.app.onDeleted({chatId:1,messageId})));
}

test('rollback follows the latest surviving assistant reply even when it has no picture',async()=>{
  const f=setup();
  await f.app.load();
  try{
    await turn(f,{mid:2,plan});
    await turn(f,{mid:4,body:'这条回复还没有画面。'});
    await turn(f,{mid:6,plan});
    assert.equal(f.app.snapshot().latestMessageId,'6');
    const old=await f.app.readRecord(2);
    assert.equal(f.app.cardImages(2,old).length,0);

    await deleted(f,6);
    assert.equal(f.app.snapshot().latestMessageId,'4');
    assert.equal(await f.app.readRecord(4),null);
    assert.equal(f.app.cardImages(4,null).length,0);

    await deleted(f,4,5);
    assert.equal(f.app.snapshot().latestMessageId,'2');
    assert.equal(f.app.cardImages(2,old)[0].id,old.currentImageId);
    assert.equal(f.calls,2);
  }finally{f.app.close();}
});

test('older update notifications and cancelled new turns keep the current saved picture',async()=>{
  const f=setup();
  await f.app.load();
  try{
    await turn(f,{mid:2,plan});
    await turn(f,{mid:4,plan});
    const saved=await f.app.readRecord(4);
    await f.app.onSaved({chatId:1,type:'message:updated',message:{id:2,role:'assistant'}});
    assert.equal(f.app.snapshot().latestMessageId,'4');
    assert.equal(f.app.cardImages(4,saved)[0].id,saved.currentImageId);

    await f.app.prepare({chatId:1,generationId:'cancelled',source:'reply',text:'新一轮'});
    assert.equal(f.app.cardImages(4,saved)[0].id,saved.currentImageId);
    f.app.terminal({chatId:1,generationId:'cancelled',type:'generation:cancelled'});
    assert.equal(f.app.cardImages(4,saved)[0].id,saved.currentImageId);

    await f.app.prepare({chatId:1,generationId:'redo',source:'regeneration',messageId:4,text:''});
    assert.deepEqual(f.app.cardImages(4,saved),[]);
    f.app.terminal({chatId:1,generationId:'redo',type:'generation:cancelled'});
    assert.equal(f.app.cardImages(4,saved)[0].id,saved.currentImageId);
  }finally{f.app.close();}
});

test('reload resolves the chat reply and ignores obsolete card-turn metadata',async()=>{
  const f=setup();
  await f.app.load();
  try{
    await turn(f,{mid:2,plan});
    const saved=await f.app.readRecord(2);
    await f.store.set('cardTurn',{messageId:'99',generationId:'deleted'});
    f.messages.set(3,{id:3,role:'user',content:'尚未收到回复'});
    delete f.tavo.message.count;
    await f.app.load();
    assert.equal(f.app.snapshot().latestMessageId,'2');
    assert.equal(f.app.cardImages(2,saved)[0].id,saved.currentImageId);

    await deleted(f,2);
    assert.equal(f.app.snapshot().latestMessageId,'');
    assert.equal(f.app.cardImages(2,saved).length,0);
  }finally{f.app.close();}
});
