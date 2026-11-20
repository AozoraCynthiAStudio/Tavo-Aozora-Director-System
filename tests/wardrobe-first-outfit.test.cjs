'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,turn,core}=require('./helpers/equipment-fixture.cjs'),W=core.Wardrobe;
const g=name=>({name,visible:true,state:''});
const plan=equipment=>({scene:'full-body shot, head-to-toe framing, woman standing in a cafe',characters:[{name:'Alice',form:'默认形态',identity:'adult woman, black hair',equipment:W.normalizeEquipment(equipment)}]});

test('first pictured socks persist through an omitted ending block, reload and another camera shot',async()=>{
 const f=fixture();await f.app.load();
 await turn(f,{body:'Alice穿着白衬衫、蓝裙和黑色长袜走进咖啡馆。',plan:plan({TOP:[g('white blouse')],LOWER:[g('blue skirt')],LEGWEAR:[g('black thigh-high socks')],FOOTWEAR:[g('brown shoes')]}),omitBlock:true});
 assert.equal(f.app.snapshot().wardrobe[0].equipment.LEGWEAR[0].name,'black thigh-high socks');
 await f.app.load();
 await turn(f,{mid:4,body:'她坐下来，接着聊天。',plan:{...plan({}),scene:'upper-body shot, woman sitting in a cafe'}});
 assert.equal((await f.app.readRecord(4)).plan.characters[0].equipment.LEGWEAR[0].name,'black thigh-high socks');
 assert.equal(f.app.snapshot().wardrobe[0].equipment.LEGWEAR[0].name,'black thigh-high socks');
 assert.equal(f.textCalls,0);
});

test('explicitly absent socks persist and remain constrained when visible outfit selection omits them',async()=>{
 const f=fixture();await f.app.load();
 await turn(f,{body:'她穿着连衣裙和凉鞋，没穿袜子。',plan:plan({FULL:[g('white dress')],LEGWEAR:[],FOOTWEAR:[g('sandals')]})});
 await turn(f,{mid:4,body:'她仍站在窗边。',plan:plan({})});
 assert.deepEqual(f.app.snapshot().wardrobe[0].equipment.LEGWEAR,[]);
 assert.match(f.compiled[1].prompt,/no socks, no stockings/);
 const actor={...plan({LEGWEAR:[g('black socks')]}).characters[0],frameSelection:{outfit:[]}};
 const composed=core.compose({scene:'full-body shot, head-to-toe framing',characters:[actor]}, {}, {format:'nai45'});
 assert.match(composed.prompt,/black socks/);
 assert.doesNotMatch(W.forImage(plan({LEGWEAR:[]}).characters[0],{crop:'portrait'}).outfit,/no socks/);
});

test('ending changes override newly established frame clothing; known picture-only changes do not replace story clothing',()=>{
 const first=plan({LEGWEAR:[g('black socks')],FOOTWEAR:[g('brown shoes')]});
 const update=W.endingUpdates(first,[],[{name:'Alice',regions:{LEGWEAR:[]},fact:'current'}]);
 const ending=W.applyUpdates([],update)[0];
 assert.deepEqual(ending.equipment.LEGWEAR,[]);
 assert.equal(ending.equipment.FOOTWEAR[0].name,'brown shoes');
 const next=W.endingUpdates(plan({LEGWEAR:[g('white socks')]}),[ending],[]);
 assert.deepEqual(next,[]);
});

test('first confirmation of a missing layer preserves known outer clothing',()=>{
 const state=[{name:'Alice',form:'默认形态',equipment:W.normalizeEquipment({TOP:[g('blue shirt')]})}];
 const updates=W.endingUpdates(plan({TOP:{outer:[g('red shirt')],inner:[g('white bra')]},LEGWEAR:[]}),state,[]);
 const result=W.applyUpdates(state,updates)[0].equipment;
 assert.equal(result.TOP.outer[0].name,'blue shirt');
 assert.equal(result.TOP.inner[0].name,'white bra');
 assert.deepEqual(result.LEGWEAR,[]);
});

test('standalone image clothes do not initialize story clothing',async()=>{
 const f=fixture();await f.app.load();
 await f.app.queueNext({kind:'story_cg'});
 const prep={generationId:'solo',chatId:1,text:await f.tavo.input.get()};await f.app.prepare(prep);
 const event={generationId:'solo',chatId:1,text:core.VisualProtocol.format(plan({LEGWEAR:[g('black socks')]}),'protocol')+'\n【静态画面】她穿着黑袜站在窗边。'};
 f.app.success(event);f.messages.set(2,{id:2,index:2,role:'assistant',content:event.text});
 await f.app.onSaved({chatId:1,message:{id:2,role:'assistant'}});
 assert.deepEqual(f.app.snapshot().wardrobe,[]);
});
