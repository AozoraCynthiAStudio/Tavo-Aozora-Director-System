'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture,turn}=require('./helpers/equipment-fixture.cjs');

test('global gallery keeps a single image and its prompt after source message deletion',async()=>{
 const f=fixture(),global=new Map();
 const theme={path:'files/chat/aozora_theme_background.png',name:'aozora_theme_background.png'};await f.app.load();
 f.tavo.file.save=async(name,data,options)=>{if(options?.scope==='global'){const pointer='files/global/'+name;global.set(pointer,data);return pointer;}f.files.set('1:'+name,data);return 'files/chat/'+name;};
 f.tavo.file.load=async(name,options)=>options?.scope==='global'?global.get('files/global/'+name):f.files.get('1:'+name);
 f.tavo.file.exists=async pointer=>global.has(pointer)||f.files.has('1:'+pointer);
 f.tavo.file.delete=async(name,options)=>{assert.notEqual(name,theme.path);if(options?.scope==='global')global.delete('files/global/'+name);else global.delete(name);};
 f.tavo.file.list=async({scope})=>({files:scope==='global'?[...global.keys()].map(path=>({path,name:path.split('/').at(-1)})):[theme]});
 f.provider.generate=async(spec,job,guard)=>{await guard();const pointer=await f.tavo.file.save(job.filename,'image',{scope:'global'});return {pointer,seed:123};};
 try{
  await turn(f,{mid:2,plan:{scene:'medium close-up, woman standing in a cafe',characters:[]}});
  const [file]=await f.app.galleryFiles('global');assert.equal(file.chatId,'1');
  assert.deepEqual((await f.app.galleryFiles()).map(image=>image.path),[file.path]);
  await assert.rejects(f.app.deleteGalleryFiles([file.path,theme.path],1),/不属于青空图库/);
  assert.ok(global.has(file.path));
  f.messages.delete(2);await f.app.onDeleted({chatId:1,messageId:2});
  assert.equal((await f.app.galleryFiles('global')).length,1);
  assert.match((await f.app.galleryRecord(file.path)).summary.finalPrompt.positive,/cafe/);
  await f.app.deleteGalleryFiles([file.path],1,'global');assert.equal(global.size,0);
 }finally{f.app.close();}
});

test('download uses original bytes for both global and chat pictures on hosts rejecting path exports',async()=>{
 const f=fixture();await f.app.load();
 const pointer='files/global/ad_image_c1_image_abc_def.png',chat='files/chat/ad_image_image_abc_def.png';
 const bytes='iVBORw0KGgo=',calls=[];
 f.tavo.file.load=async(path,options)=>{assert.ok([pointer,chat].includes(path));assert.deepEqual(options,{encoding:'base64'});return bytes;};
 f.tavo.file.export=async(...args)=>{if(args.length===1)throw Error('File export requires a chat-scoped internal path');calls.push(args);};
 try{
  await f.app.download(pointer);
  await f.app.download(chat);
  assert.deepEqual(calls,[['ad_image_c1_image_abc_def.png',bytes,{encoding:'base64'}],['ad_image_image_abc_def.png',bytes,{encoding:'base64'}]]);
 }finally{f.app.close();}
});
