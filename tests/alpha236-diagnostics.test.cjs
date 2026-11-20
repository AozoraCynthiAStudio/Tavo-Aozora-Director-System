'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('alpha236 history reader uses injected core accessor and has no undefined bare core reference',()=>{
 const source=read('src/ui/reader.js');
 assert.match(source,/api\.core\(\)\.storyText\(text\)\.trim\(\)/);
 assert.doesNotMatch(source,/(?<![\w.$])core\.storyText\(/);
});

test('alpha236 diagnostic trace covers generation, message update/delete, rollback revisions and visual ids',()=>{
 const app=read('src/app.cjs'),entry=read('src/entry.js');
 for(const event of ['generation.prepare.received','generation.prepare.regeneration-resolved','generation.success.received','generation.success.visual-parsed','generation.success.parse-failed','message.saved.identity-check','message.saved.purge-triggered','message.deleted.received','message.deleted.revision-advanced','image.generate.body-hash-mismatch','image.provider-or-save.failed'])assert.ok(app.includes(event),event);
 for(const event of ["saved('message:added'","saved('message:updated'",'app.onDeleted','host.generation.prepare','host.generation.success'])assert.ok(entry.includes(event),event);
 assert.match(app,/aozora-director-runtime-diagnostics-v1/);
 assert.match(app,/slice\(-800\)/);
});

test('task logs retain their export and image diagnostics stay in the image record',()=>{
 const html=read('src/ui/menu.html'),controller=read('src/ui/controller.js');
 assert.doesNotMatch(html,/id="ad-log-diagnostic-export"/);
 assert.match(html,/id="ad-log-export"/);
 assert.match(controller,/imageGenerationRecord/);
 assert.doesNotMatch(controller,/Aozora_Director_alpha238_diagnostics_/);
});

test('alpha236 runtime diagnostic export preserves protocol ids and hashes without storing story text',async()=>{
 const {createApp}=require('../src/app.cjs');
 const tracker={snapshot:()=>({phase:'idle'}),update:(id,value)=>({operationId:id,...value}),drop(){},dropMessage(){},reset(){}};
 const core={...require('../src/core.cjs'),Status:{createTracker:()=>tracker},id:prefix=>prefix+'_test',settings:value=>value||{},fingerprint:value=>'hash-'+String(value).length};
 const writes=[];
 const store={token:()=>({chatId:'chat-test',epoch:1}),set:async(name,value,scope)=>{writes.push({name,value,scope});},close(){}};
 const app=createApp({},{...core},store,{}, {rules:{},styles:[]},()=>{});
 const story='<bubble>private story text</bubble><ad-visual id="request_test_123">{} </ad-visual><ad-wardrobe id="request_test_123">{"updates":[]}</ad-wardrobe>';
 app.traceText('test.visual-response',story,{generationId:'generation_test',requestId:'request_test_123',messageId:'4950'});
 const report=await app.exportDiagnostics();
 assert.equal(report.schema,'aozora-director-runtime-diagnostics-v1');
 assert.equal(report.events.length,1);
 assert.deepEqual(report.events[0].textAudit.visualIds,['request_test_123']);
 assert.deepEqual(report.events[0].textAudit.wardrobeIds,['request_test_123']);
 assert.equal(report.events[0].requestId,'request_test_123');
 assert.equal(JSON.stringify(report).includes('private story text'),false);
 assert.equal(writes.at(-1).name,'diagnostics');
 assert.equal(writes.at(-1).scope,'chat');
 app.close();
});
