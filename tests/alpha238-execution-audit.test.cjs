'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('alpha238 adds execution audit to exported generation record without changing director prompt rules',()=>{
 const app=read('src/app.cjs'),provider=read('src/provider.cjs'),direct=read('src/official-direct.cjs'),controller=read('src/ui/controller.js');
 assert.match(app,/aozora-director-output-audit-v1/);
 assert.match(app,/UNKNOWN_NOT_EMITTED_BY_OUTPUT_PROTOCOL/);
 assert.match(app,/aozora-execution-audit-v1/);
 assert.match(provider,/aozora-prompt-transport-audit-v1/);
 assert.match(direct,/aozora-provider-wire-audit-v1/);
 assert.match(controller,/app\.imageGenerationRecord\(selection\.record,selection\.image,true\)/);
 assert.match(controller,/generation-diagnostics-/);

});

test('alpha238 audit never stores API credentials or image payload bytes in wire audit',()=>{
 const direct=read('src/official-direct.cjs');
 assert.match(direct,/authorizationValue:'REDACTED'/);
 assert.match(direct,/imagePayloadIncluded:!!(image||naiImage)/);
 assert.match(direct,/imagePayloadBytes:/);
 assert.doesNotMatch(direct,/authorizationValue:key/);
});

test('alpha238 persists director output, adult-rule availability and plan-to-compile audit in image record',async()=>{
 const {fixture,turn,core}=require('./helpers/equipment-fixture.cjs');
 const f=fixture();await f.app.load();
 const plan={scene:'medium shot, 1girl, quiet room, woman seated by a window',description:'她坐在窗边。',characters:[{name:'Alice',form:'默认形态',identity:'adult woman, long black hair',equipment:{HEAD:[],TOP:[],LOWER:[],FULL:[],LEGWEAR:[],FOOTWEAR:[],HAND:[],ACCESSORIES:[]}}]};
 await turn(f,{mid:2,input:'请生成画面',body:'她坐在窗边。',plan,generationId:'alpha238-audit'});
 const record=await f.app.readRecord(2),image=record.images[0];
 assert.equal(record.directorOutputAudit.schema,'aozora-director-output-audit-v1');
 assert.equal(record.directorOutputAudit.source.visualBlockCount,1);
 assert.equal(record.directorOutputAudit.adultRules.gateResult,'UNKNOWN_NOT_EMITTED_BY_OUTPUT_PROTOCOL');
 assert.equal(image.executionAudit.schema,'aozora-execution-audit-v1');
 assert.deepEqual(image.executionAudit.comparison.directorCharacterNames,['Alice']);
 assert.deepEqual(image.executionAudit.comparison.compiledCharacterNames,['Alice']);
 assert.equal(image.executionAudit.visualConsistency.status,'UNKNOWN_NOT_EVALUATED');
 f.app.close();
});
