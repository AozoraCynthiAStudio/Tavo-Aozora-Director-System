const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true}),p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(pathToFileURL(path.join(__dirname,'../dist/packaged-preview/index.html')).href);
 await p.waitForSelector('#ad-settings[data-pp-ready=true][open]');
 await p.screenshot({path:path.join(__dirname,'../dist/fixed-frame-check/exact-package-phone.png')});
 const shape=await p.locator('.pp-ui').evaluate(e=>({width:e.clientWidth,height:e.clientHeight}));
 if(shape.width!==390||shape.height!==780)throw Error('Canvas mismatch');
 for(const route of ['profiles','styles','seeds','api','logs','frame','params']){
  await p.locator('[data-studio-nav='+route+']').click();
 }
 await p.locator('[data-studio-nav=settings]').click();await p.locator('#city-mode').click();
 await p.waitForSelector('#ph-choice[open]');await p.locator('#ph-choice footer button').click();
 await p.locator('#ad-settings-close').click();await p.evaluate(()=>__ADirectorUI.nextDialog('story_cg'));
 await p.waitForSelector('#ad-next[open]');
 if(!await p.locator('#ad-next').getAttribute('class').then(v=>v.includes('ph-dialog')))throw Error('Shared dialog skin missing');
 await p.screenshot({path:path.join(__dirname,'../dist/fixed-frame-check/exact-package-dialog.png')});
 if(errors.length)throw Error(errors.join());
 console.log('Exact distributed fragment: phone layout, all routes, mode picker and shared action dialog passed');
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
