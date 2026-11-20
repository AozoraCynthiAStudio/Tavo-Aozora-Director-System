'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,turn,core}=require('./helpers/equipment-fixture.cjs'),W=core.Wardrobe;
const g=name=>({name,visible:true,state:''});
const base=W.normalizeEquipment({TOP:[g('white blouse')],LOWER:[g('navy skirt')],FOOTWEAR:[g('brown shoes')]});
const state=[{name:'Alice',form:'默认形态',equipment:base}];
const plan=e=>({scene:'in the hallway',characters:[{name:'Alice',form:'默认形态',identity:'black hair, blue eyes',action:'standing',equipment:e}]});

test('normal text-only chat persists actual outfit change without asking for citations',async()=>{
 const f=fixture(state);await f.app.load();
 await turn(f,{body:'Alice换上红色鞋子。',updates:[{name:'Alice',fact:'current',regions:{FOOTWEAR:[g('red shoes')]}}]});
 assert.equal(f.calls,0);assert.equal(f.app.snapshot().wardrobe[0].equipment.FOOTWEAR[0].name,'red shoes');
 await f.app.load();assert.equal(f.app.snapshot().wardrobe[0].equipment.FOOTWEAR[0].name,'red shoes');
});

test('director uses the frame outfit and the next turn starts from the saved ending outfit',async()=>{
 const f=fixture(state);await f.app.load();
 await turn(f,{body:'Alice穿上红鞋走向门口。回家后，她换上蓝拖鞋。',plan:plan(W.normalizeEquipment({...base,FOOTWEAR:[g('red shoes')]})),updates:[{name:'Alice',fact:'current',regions:{FOOTWEAR:[g('blue slippers')]}}]});
 const record=await f.app.readRecord(2);
 assert.equal(f.calls,1);assert.equal(record.status,'done');
 assert.equal(record.plan.characters[0].equipment.FOOTWEAR[0].name,'red shoes');
 assert.match(f.compiled[0].prompt,/red shoes/);
 assert.doesNotMatch(f.compiled[0].prompt,/blue slippers/);
 assert.equal(f.app.snapshot().wardrobe[0].equipment.FOOTWEAR[0].name,'blue slippers');
 await turn(f,{mid:4,body:'Alice在客厅坐下。',plan:plan(W.normalizeEquipment({}))});
 const next=await f.app.readRecord(4);
 assert.equal(next.plan.characters[0].equipment.FOOTWEAR[0].name,'blue slippers');
});

test('a missing ending block leaves the saved wardrobe intact even when the frame has a different outfit',async()=>{
 const f=fixture(state);await f.app.load();
 await turn(f,{body:'Alice换上红靴。',plan:plan(W.normalizeEquipment({...base,FOOTWEAR:[g('red boots')]})),omitBlock:true});
 const record=await f.app.readRecord(2);
 assert.equal(record.status,'done');assert.equal(record.plan.characters[0].equipment.FOOTWEAR[0].name,'red boots');
 assert.equal(f.app.snapshot().wardrobe[0].equipment.FOOTWEAR[0].name,'brown shoes');
});

test('an unclosed non-JSON update removes only its marker and does not guess which following text is prose',async()=>{
 const f=fixture(state);await f.app.load();
 f.setInput('继续');const prep={generationId:'badmeta',chatId:1,text:'继续'};
 await f.app.prepare(prep);const id=prep.text.match(/<ad-wardrobe id="([^"]+)"/)[1];
 const event={generationId:'badmeta',chatId:1,text:'Alice继续说话。<ad-wardrobe id="'+id+'">BROKEN'};
 f.app.success(event);
 assert.equal(core.storyText(event.text),'Alice继续说话。BROKEN');
 assert.doesNotMatch(event.text,/<ad-wardrobe/);
 assert.equal(f.calls,0);
});
