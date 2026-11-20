const {test}=require('node:test'),assert=require('node:assert/strict'),{fixture,core}=require('./helpers/equipment-fixture.cjs'),w=core.Wardrobe;
test('fresh chat creates exactly one empty V2 equipment ledger and no clothing mirrors or backups',async()=>{const f=fixture();const writes=[];const set=f.tavo.variable.set;f.tavo.variable.set=async(k,...args)=>{writes.push(k);return set(k,...args)};await f.app.load();const data=await f.store.get('equipmentV2');assert.deepEqual(data,{schema:2,events:[]});assert.deepEqual(f.app.snapshot().wardrobe,[]);assert(!writes.some(k=>/\.wardrobe$|wardrobeV1Backup/.test(k)));});
test('a snapshot without eight-region equipment is rejected rather than adapted',()=>{assert.throws(()=>core.normalizedPlan({scene:'room',characters:[{name:'A',identity:'adult woman'}]}),/八部位/);assert.throws(()=>w.normalizeCharacter({name:'A',equipment:{TOP:[]}}),/八部位/);});
test('only the current fact protocol is accepted',()=>{const state=[],patch={name:'A',fact:'migration',regions:{FULL:[]}};assert.deepEqual(w.validateUpdates([patch],state,{storyInput:'继续'}),[]);assert.equal(w.slots,undefined);assert.equal(w.normalizeSlots,undefined);assert.equal(w.migrateRows,undefined);assert.equal(w.advance,undefined);});
test('V2 character normalization does not retain duplicate clothing mirrors or arbitrary source fields',()=>{const c=w.normalizeCharacter({name:'A',form:'默认形态',identity:'adult woman',equipment:w.normalizeEquipment({}),extra:'ignored'});assert.deepEqual(Object.keys(c).sort(),['name','form','identity','equipmentVersion','equipment'].sort());});

test('a sent text turn without a queued director switches to no-director stage state only after generation starts', async () => {
 const f=fixture();await f.app.load();
 const before=f.app.snapshot();assert.equal(before.activity.phase,'idle');assert.equal(before.pending,null);
 const event={generationId:'plain-text-1',chatId:1,source:'reply',text:'普通正文'};
 await f.app.prepare(event);
 assert.equal(f.app.snapshot().activity.phase,'no-director');
 assert.equal(f.app.snapshot().activity.label,'未设置下一轮导演');
 f.app.success({generationId:'plain-text-1',chatId:1,text:event.text});
 f.messages.set(10,{id:10,index:10,role:'assistant',content:event.text});
 await f.app.onSaved({chatId:1,message:{id:10,role:'assistant'}});
 assert.equal(f.app.snapshot().latestMessageId,'10');
 assert.equal(f.app.snapshot().activity.phase,'idle');
});

test('queueing a next director without sending does not start a text or image task', async () => {
 const f=fixture();await f.app.load();
 await f.app.queueNext({kind:'story_cg',request:'下一幕'});
 assert.ok(f.app.snapshot().pending);
 assert.equal(f.app.snapshot().activity.phase,'idle');
});

test('a no-director stage remains active through an early message-added save and clears after text success', async () => {
 const f=fixture();await f.app.load();
 const event={generationId:'plain-text-early-save',chatId:1,source:'reply',text:'流式正文'};
 await f.app.prepare(event);
 f.messages.set(11,{id:11,index:11,role:'assistant',content:event.text});
 await f.app.onSaved({chatId:1,message:{id:11,role:'assistant'}});
 assert.equal(f.app.snapshot().activity.phase,'no-director');
 f.app.success({generationId:'plain-text-early-save',chatId:1,text:event.text});
 assert.equal(f.app.snapshot().activity.phase,'idle');
});
