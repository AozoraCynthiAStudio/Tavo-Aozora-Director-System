const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright');const root=path.resolve(__dirname,'..'),read=f=>require('./read-ui-source.cjs').read(root,f);(async()=>{const b=await chromium.launch({headless:true,channel:'msedge'});try{const page=await b.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setContent('<html><head><meta charset="utf-8"><style>body{margin:0;background:#41464e}'+read('src/ui/menu.css')+read('src/ui/workspace.css')+read('src/ui/studio.css')+'</style></head><body>'+read('src/ui/menu.html')+read('src/ui/stage.html')+'</body></html>');const entry=read('dist/plugin/entry.js').replace(read('src/entry.js'),'window.TestCore=Core;window.TestStore=createStore;window.TestApp=createApp;window.TestAssets=Assets;');await page.addScriptTag({content:entry});await page.evaluate(async()=>{const vars=new Map();window.tavo={chat:{current:async()=>({id:'local-ui-test'})},variable:{get:async(k,s)=>structuredClone(vars.get(s+':'+k)),set:async(k,v,s)=>vars.set(s+':'+k,structuredClone(v))},file:{exists:async()=>false,load:async()=>null},message:{get:async()=>null},input:{get:async()=>'',set:async()=>{}},image:{generate:async()=>{throw Error('No model calls in UI test');}}};window.__ADirectorCore=TestCore;window.__ADirectorApp=TestApp(tavo,TestCore,TestStore(tavo,TestCore),{generate:async()=>{throw Error('No image calls');}},TestAssets);await __ADirectorApp.load();});await page.addScriptTag({content:read('src/ui/image-memory.js')});await page.addScriptTag({content:read('src/ui/controller.js')});await page.waitForFunction(()=>window.__ADirectorUI&&!document.querySelector('#ad-launcher').disabled);await page.evaluate(()=>__ADirectorUI.settingsDialog());
fs.mkdirSync(path.join(root,'dist/studio-review'),{recursive:true});
await page.evaluate(()=>{document.documentElement.style.setProperty('--tavo-inset-top-bar','64px');const host=document.createElement('div');host.setAttribute('aria-hidden','true');host.style='position:absolute;top:0;left:0;right:0;height:64px;background:#191919;color:#ddd;display:flex;align-items:center;justify-content:space-between;padding:0 20px;font:13px system-ui;pointer-events:none';host.innerHTML='<span>‹</span><span>当前故事 · 宿主区域示意</span><span>⋯</span>';document.querySelector('#ad-settings').append(host);});
await page.evaluate(()=>__ADirectorApp.saveConfig({format:'nai45',imageService:'nai45'}));
const results=[];
for(const [width,height] of [[390,844],[360,740],[844,390],[1440,960]]){
await page.setViewportSize({width,height});await page.evaluate(()=>__ADirectorUI.settingsDialog());
await page.waitForFunction(()=>document.querySelector('#studio-frame-summary').textContent.includes('px'));
await page.screenshot({animations:'disabled',path:path.join(root,'dist/studio-review/home-'+width+'.png')});
await page.click('#studio-frame');assert(await page.locator('#studio-frame-panel').isVisible());
assert.equal(await page.locator('#ad-max').count(),0);
await page.fill('#studio-width','1024');await page.fill('#studio-height','1024');await page.click('#studio-size-save');
await page.waitForFunction(()=>document.querySelector('#ad-settings-status').textContent==='分辨率已保存');
assert.equal(await page.evaluate(async()=>(await __ADirectorApp.generationSettings()).relay.width),1024);
await page.fill('#ad-director-seed','123456');await page.locator('#ad-director-seed').dispatchEvent('change');
await page.check('#ad-director-seed-fixed');await page.waitForFunction(()=>__ADirectorApp.snapshot().config.seedFixed===true);
await page.screenshot({animations:'disabled',path:path.join(root,'dist/studio-review/frame-'+width+'.png')});
await page.click('#studio-global-back');assert(await page.locator('#studio-home').isVisible());
await page.locator('#ad-auto-generate').check({force:true});await page.locator('#ad-auto-generate').dispatchEvent('change');await page.waitForFunction(()=>__ADirectorApp.snapshot().config.autoGenerate===true);
await page.click('#studio-service');await page.selectOption('#ad-format','nai45');
await page.fill('#local-relay-url','https://image.novelai.net/ai/generate-image');await page.fill('#local-relay-key','studio-test-only-key-1234567890');
await page.click('#local-relay-page [data-local-save]');await page.waitForFunction(()=>document.querySelector('#ad-settings-status').textContent==='API 配置已保存');assert.equal(await page.inputValue('#local-relay-key'),'');
await page.click('#studio-global-back');await page.click('[data-studio-nav=resources]');
for(const name of ['profiles','styles','seeds']){await page.click('[data-studio-resource='+name+']');assert(await page.locator('[data-ad-page='+name+']').isVisible());}
await page.screenshot({animations:'disabled',path:path.join(root,'dist/studio-review/resources-'+width+'.png')});
await page.click('[data-studio-nav=api]');assert(await page.locator('[data-ad-page=api]').isVisible());await page.screenshot({animations:'disabled',path:path.join(root,'dist/studio-review/motion-'+width+'.png')});
await page.click('[data-studio-nav=settings]');await page.click('#studio-logs');assert(await page.locator('[data-ad-page=logs]').isVisible());await page.click('[data-studio-nav=settings]');
const bounds=await page.evaluate(()=>{const d=document.querySelector('#ad-settings').getBoundingClientRect(),head=document.querySelector('.studio-topbar').getBoundingClientRect(),nav=document.querySelector('#studio-navigation').getBoundingClientRect();return {w:d.width,h:d.height,top:head.top,bottom:nav.bottom,overflow:document.documentElement.scrollWidth-innerWidth};});
console.log(bounds);assert.equal(bounds.w,width);assert.equal(bounds.h,height);assert(bounds.top>=64);assert(bounds.bottom<=height-24+1);assert.equal(bounds.overflow,0);results.push({width,height,...bounds});
}
// Reopening must retain actual saved settings.
await page.evaluate(()=>{document.querySelector('#ad-settings').close();__ADirectorUI.settingsDialog();});await page.click('#studio-frame');assert.equal(await page.locator('#ad-max').count(),0);assert.equal(await page.inputValue('#ad-director-seed'),'123456');
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(root,'dist/studio-review/verification.json'),JSON.stringify({results,persisted:['resolution','casting','seed','autoGenerate','api'],actualModelCalls:0,pageErrors:errors},null,2));console.log('PASS actual app/controller: 4 viewports, navigation, resolution, casting, Seed, auto generation, API save/key clearing, reopening, safe bounds. No model calls.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

