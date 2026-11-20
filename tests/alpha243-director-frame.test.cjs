'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {fixture,core}=require('./helpers/equipment-fixture.cjs');
const {staticRequestBody}=require('../src/official-direct.cjs');

test('NAI director and initial request share the selected API dimensions',async()=>{
  for(const [width,height,label] of [[1216,832,'横图'],[1024,1024,'方图'],[832,1216,'竖图'],[1152,896,'横图']]){
    const f=fixture();
    const key='aozora_direct_official_v1';
    const saveSize=(w,h)=>f.tavo.variable.set(key,{provider:'thirdparty',thirdParty:{generation:{width:w,height:h}}},'global');
    await saveSize(width,height);
    await f.app.load();
    try{
      await f.app.saveConfig({imageService:'nai45',format:'nai45',ratio:'16:9'});
      await f.app.queueNext({kind:'story_cg',request:'拍摄窗边的场景'});
      const draft=await f.tavo.input.get();
      f.messages.set(1,{id:1,role:'user',content:draft});
      const prep={generationId:'frame',chatId:1,source:'reply',text:draft};
      await f.app.prepare(prep);
      assert.ok(prep.text.includes(width+' × '+height+' 像素（'+label+'）'));
      assert.doesNotMatch(prep.text,/构图参考画幅 16:9/);
      await saveSize(960,960);
      const plan={scene:'medium shot, a quiet room with a window',description:'窗边的房间。',characters:[]};
      const event={generationId:'frame',chatId:1,text:core.VisualProtocol.format(plan,'protocol')+'\n<ad-wardrobe id="protocol">{"updates":[]}</ad-wardrobe>'};
      f.app.success(event);
      f.messages.set(2,{id:2,role:'assistant',content:event.text});
      await f.app.onSaved({chatId:1,message:{id:2,role:'assistant'}});
      assert.equal(f.compiled.length,1);
      const first=staticRequestBody(f.compiled[0],f.compiled[0].directSettings);
      assert.deepEqual([first.parameters.width,first.parameters.height],[width,height]);
      await f.app.generate(2,true);
      assert.equal(f.compiled.length,2);
      const reroll=staticRequestBody(f.compiled[1],f.compiled[1].directSettings);
      assert.deepEqual([reroll.parameters.width,reroll.parameters.height],[960,960]);
    }finally{f.app.close();}
  }
});
