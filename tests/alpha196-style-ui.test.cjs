'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {fixture}=require('./helpers/equipment-fixture.cjs');
const {createApp}=require('../src/app.cjs');
const rules=require('../src/assets/director-rules.json');
const styles=require('../src/assets/styles.json');
const anime=styles.find(x=>x.id==='mignon_allenes');
const oldPositive='0.45::artist:mignon::, artist:allenes, game cg, anime coloring, clean lineart, cel shading, year 2024';
const oldNegative='lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad proportions, deformed body, bad hands, extra fingers, missing fingers, extra limbs, distorted face, asymmetrical eyes, cross-eyed, messy lineart, thick lineart, oversaturated, venetian blinds, slatted shadows, striped shadows, grid texture, strong rim lighting, glowing outline';
const v197Positive='0.65::artist:ru zhai::, 0.75::artist:yuyu (yuyuworks)::, game cg, best quality, natural shading, diffuse light, official art';
const v197Negative='lowres, blurry, jpeg artifacts, watermark, bad anatomy, bad proportions, bad hands, extra fingers, distorted face, thick lineart, plastic skin, flat color, flat shading, blown highlights, overexposed background, exaggerated anatomy, disproportionately large torso, shiny skin,3::blush,blush stickers::,flushed face';

async function savedApp(previous){
 const f=fixture();
 await f.tavo.variable.set('aozora_director_v1.styles',[styles[0],previous,...styles.slice(2)],'global');
 await f.tavo.variable.set('aozora_director_v1.animeStylePresetV181',true,'global');
 const app=createApp(f.tavo,require('../src/core.cjs'),f.store,f.provider,{rules,styles});
 await app.load();return {f,app};
}

test('alpha198 installs updated anime CG prompt in bundled default',()=>{
 assert.equal(anime.positive,'artist:cc lin,0.1::artist:kidmo::,0.1::artist:akkijin::,2::game cg::,official art');
 assert.equal(anime.negative,'lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad proportions, deformed body, bad hands, extra fingers, missing fingers, extra limbs, distorted face, asymmetrical eyes, cross-eyed, messy lineart, thick lineart, oversaturated');
 assert.equal(anime.useNegative,true);
 assert.equal(styles.find(x=>x.id==='meekohopanes_ru_zhai').positive.includes('artist:meekohopanes'),true);
});

test('alpha198 upgrades untouched alpha197 anime preset once and persists result',async()=>{
 const {f,app}=await savedApp({...anime,positive:v197Positive,negative:v197Negative});
 const actual=app.snapshot().styles.find(x=>x.id==='mignon_allenes');
 assert.equal(actual.positive,anime.positive);assert.equal(actual.negative,anime.negative);
 assert.equal(await f.tavo.variable.get('aozora_director_v1.animeStylePresetV198','global'),true);
 assert.equal((await f.tavo.variable.get('aozora_director_v1.styles','global')).find(x=>x.id==='mignon_allenes').positive,anime.positive);
 app.close();
});

test('alpha198 never overwrites a customized existing style',async()=>{
 const modified={...anime,positive:oldPositive+', artist:my preference',negative:oldNegative};
 const {app}=await savedApp(modified);
 const actual=app.snapshot().styles.find(x=>x.id==='mignon_allenes');
 assert.equal(actual.positive,modified.positive);assert.equal(actual.negative,modified.negative);
 app.close();
});

test('style editor autosaves separately from apply and retains delete and copy',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../src/ui/controller.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../src/ui/menu.html'),'utf8');
 assert.match(html,/id="ad-style-apply"[^>]*>应用画风/);
 assert.ok(ui.includes('if(!await flushStyleDraft())return;'));
 assert.ok(ui.includes('await app.saveConfig({styleId:id});'));
 assert.match(ui,/className='ad-style-remove'/);
 assert.match(ui,/remove.onclick=\(\)=>requestStyleDelete\(p\)/);
 assert.ok(ui.includes('setTimeout(flushStyleDraft,450)'));
 assert.match(ui,/async function duplicateSelectedStyle\(\)/);
 assert.match(ui,/bind\(\$\('ad-style-copy'\),'click',\(\)=>duplicateSelectedStyle\(\)\)/);
 assert.match(ui,/renderStyleCards\(\);editStyle\(value\.id,false\);/);
 assert.doesNotMatch(ui,/styleEditing=value.id;settingsDialog\('styles'\)/);
});


for(const positive of ['artist:atdan, 0.25::artist:ask (askzy)::, game cg, official art, soft lineart, novel illustration','artist:atdan, 0.25::artist:ask (askzy)::,2::game cg::, official art','artist:atdan, 0.25::artist:ask (askzy)::,2::game cg::, official art, soft cool lighting, cool color palette'])test('alpha409 updates the installed stock positive prompt and keeps saved negative settings: '+positive,async()=>{
 const previous={...anime,positive,negative:'custom negative',useNegative:false};
 const {f,app}=await savedApp(previous);
 try{
  const saved=await f.tavo.variable.get('aozora_director_v1.styles','global');
  assert.deepEqual(saved.find(style=>style.id===anime.id),{...previous,positive:anime.positive});
 }finally{app.close();}
});
