'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./helpers/equipment-fixture.cjs');
const core=require('../src/core.cjs');
const {createApp}=require('../src/app.cjs');
const rules=require('../src/assets/director-rules.json');
const styles=require('../src/assets/styles.json');

const builtin=styles.find(style=>style.id==='meekohopanes_ru_zhai');
const oldPositive='{artist:meekohopanes}, {artist:ru zhai}, [artist:liang xing], [[artist:ciloranko]], 0.4::artist:kittew::, game cg, [[shiny skin]], soft body, soft lineart';
const oldNegative=builtin.negative;

async function loadWith(savedStyles){
  const f=fixture();
  await f.tavo.variable.set('aozora_director_v1.styles',savedStyles,'global');
  await f.tavo.variable.set('aozora_director_v1.config',{imageService:'nai45',format:'nai45',styleIds:{nai45:builtin.id}},'chat');
  const app=createApp(f.tavo,core,f.store,f.provider,{rules,styles});
  await app.load();
  return {f,app};
}

test('alpha364 migrates the untouched former default style and keeps NAI selection identity',async()=>{
  const old={...builtin,name:'东方半写实 CG',positive:oldPositive,negative:oldNegative};
  const {f,app}=await loadWith([old,...styles.filter(style=>style.id!==builtin.id)]);
  const current=app.snapshot().styles.find(style=>style.id===builtin.id);
  assert.equal(current.name,'东方半写实游戏 CG');
  assert.equal(current.positive,builtin.positive);
  assert.equal(current.negative,oldNegative);
  assert.equal(await f.tavo.variable.get('aozora_director_v1.stylePresetV364','global'),true);
  await app.saveConfig({format:'nai45'});
  assert.equal(app.snapshot().config.styleId,builtin.id);
  app.close();
});

test('alpha364 leaves a customized former default style untouched',async()=>{
  const custom={...builtin,name:'我的画风',positive:oldPositive+', custom addition'};
  const {app}=await loadWith([custom,...styles.filter(style=>style.id!==builtin.id)]);
  const current=app.snapshot().styles.find(style=>style.id===builtin.id);
  assert.equal(current.name,custom.name);
  assert.equal(current.positive,custom.positive);
  app.close();
});
