'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture,core}=require('./helpers/equipment-fixture.cjs');
const sample=require('./fixtures/shot4313.json');
const wardrobe=core.Wardrobe;
function dressed(name,top,lower,full){return wardrobe.normalizeCharacter({name,form:'默认形态',equipment:{HEAD:null,TOP:top,LOWER:lower,FULL:full,LEGWEAR:null,FOOTWEAR:null,HAND:null,ACCESSORIES:null}})}
test('length and coverage markers stay unambiguous without changing saved garment names',()=>{
 const r=dressed('A',[{name:'gray blouse'}],[{name:'gray casual pants'}],null);
 assert.equal(r.equipment.LOWER[0].name,'gray casual pants');
 const first=wardrobe.forImage(r).outfit;
 assert.match(first,/gray casual pants, full-length/);
 assert.match(first,/gray blouse, short sleeves/);
 assert.equal(wardrobe.forImage(r).outfit,first);
 const other=dressed('A',[{name:'long-sleeve top'}],[{name:'gray casual shorts'}],null);
 assert.match(wardrobe.forImage(other).outfit,/gray casual shorts/);
 assert.doesNotMatch(wardrobe.forImage(other).outfit,/full-length/);
 for(const [name,fragment] of [['navy skirt','knee-length'],['black boots','ankle-high'],['cotton socks','crew-length'],['open cardigan',''],['short skirt','']]){
  const value=wardrobe.specificGarmentName(name);if(fragment)assert.match(value,new RegExp(fragment));else assert.equal(value,name);
 }
});
test('known fully-unclothed state survives upper crop without changing camera or another actor',()=>{
 const x=dressed('A',[],[],null),y=dressed('B',[{name:'white shirt'}],[{name:'dark trousers'}],null);
 const scene={scene:'medium close-up, two people talking',characters:[{...x,identity:'adult woman, blue eyes'},{...y,identity:'adult man, brown eyes'}]};
 const result=core.compose(scene,{}, {format:'nai45'});
 assert.equal(result.renderAudit.crop,'upper');
 assert.match(result.sections.characters[0].outfit,/nude/);
 assert.doesNotMatch(result.sections.characters[1].outfit,/nude/);
 assert.doesNotMatch(result.sections.characters[0].outfit,/white shirt|dark trousers/);
 assert.equal(scene.characters[0].equipment.LOWER.length,0);
});
test('selected partial-removal belongs to its actor, not the partner, in an upper scene',()=>{
 const a=dressed('A',[],[],null),b=dressed('B',[],[{name:'gray homewear pants',state:'pulled down to knees',visible:true}],null);
 const plan={scene:'medium close-up, bedroom, gray pants caught at her knees',characters:[{...a,identity:'adult man'},{...b,identity:'adult woman'}]};
 const render=core.compose(plan,{}, {format:'nai45'});
 assert.match(render.sections.characters[0].outfit,/nude/);
 assert.doesNotMatch(render.sections.characters[0].outfit,/gray pants/);
 assert.match(render.sections.characters[1].outfit,/gray homewear pants, pulled down to knees/);
 assert.equal(render.renderAudit.crop,'upper');
 assert.deepEqual(render.renderAudit.adjusted,[]);
});
test('self-corrected multiple framing words never block a paid image by themselves',()=>{
 const x=dressed('A',[{name:'white shirt'}],[{name:'gray pants'}],null);
 const r=core.compose({scene:'medium shot, full body? no, medium close-up, cafe',characters:[{...x,identity:'adult woman'}]}, {}, {format:'nai45'});
 assert.equal(r.renderAudit.owner,'editorial-camera-uncertain');
 assert.match(r.renderAudit.warning,/已保留原提示词继续生成/);
 assert.match(r.prompt,/medium shot/);
});
test('both homepage and inner size presets use the same three values and shared selection',()=>{
 const html=fs.readFileSync(require.resolve('../src/ui/menu.html'),'utf8');
 const controller=fs.readFileSync(require.resolve('../src/ui/controller.js'),'utf8');
 for(const v of ['1216,832','832,1216','1024,1024'])assert.equal((html.match(new RegExp('data-studio-size="'+v+'"','g'))||[]).length,2);
 assert.match(html,/id="studio-home-quick-size"/);assert.match(html,/id="studio-frame-size"/);
 assert.match(controller,/querySelectorAll\('\[data-studio-size\]'\)/);
 assert.match(controller,/studio-quick-size-status/);
});
test('missing message-save notification is reconciled from the unique saved request marker',async()=>{
 const f=fixture();await f.app.load();
 f.setInput('继续');await f.app.queueNext({kind:'story_cg'});
 const text=await f.tavo.input.get();f.messages.set(1,{id:1,role:'user',content:text});
 const prep={generationId:'watch177',chatId:1,source:'reply',text};await f.app.prepare(prep);
 const id=prep.text.match(/<ad-wardrobe id="([^"]+)"/)[1];
 const body='两人并肩坐在烤肉店的小桌旁，她在暖灯下笑了。';
 const output={generationId:'watch177',chatId:1,text:body+'\n'+core.VisualProtocol.format({...sample.plan,sourceExcerpt:body},id)};
 f.app.success(output);f.messages.set(2,{id:2,role:'assistant',content:output.text});
 // Intentionally do NOT send message:added / message:updated.
 await new Promise(resolve=>setTimeout(resolve,1650));
 const result=await f.app.readRecord(2);assert.equal(result?.status,'done');assert.equal(f.calls,1);
 await f.app.onSaved({chatId:1,message:{id:2,role:'assistant'}});assert.equal(f.calls,1);
 f.app.close();
});
test('deleting an image commits removal before deferred file cleanup',async()=>{
 const f=fixture();await f.app.load();
 f.setInput('继续');await f.app.queueNext({kind:'story_cg'});const text=await f.tavo.input.get();f.messages.set(1,{id:1,role:'user',content:text});
 const prep={generationId:'remove177',chatId:1,source:'reply',text};await f.app.prepare(prep);const id=prep.text.match(/<ad-wardrobe id="([^"]+)"/)[1];
 const body='两人并肩坐在烤肉店的小桌旁，她在暖灯下笑了。';
 const e={generationId:'remove177',chatId:1,text:body+'\n'+core.VisualProtocol.format({...sample.plan,sourceExcerpt:body},id)};f.app.success(e);f.messages.set(2,{id:2,role:'assistant',content:e.text});await f.app.onSaved({chatId:1,message:{id:2,role:'assistant'}});
 const record=await f.app.readRecord(2),item=record.images[0];assert(item);
 const next=await f.app.removeImage(2,item.id);assert.equal(next.images.length,0);assert.equal((await f.app.readRecord(2)).images.length,0);
 await new Promise(resolve=>setTimeout(resolve,120));
 assert(!f.files.has('1:'+item.pointer));f.app.close();
});
