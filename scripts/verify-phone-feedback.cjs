const {chromium}=require('playwright'),path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:428,height:936},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const out=path.join(__dirname,'../dist/phone-check');fs.mkdirSync(out,{recursive:true});
 const url=pathToFileURL(path.join(__dirname,'../dist/studio-review/index.html')).href;
 await page.goto(url);await page.waitForSelector('#ad-settings[data-pp-ready=true][open]');
 await page.evaluate(()=>document.documentElement.style.setProperty('--tavo-inset-top-bar','96px'));
 await page.waitForTimeout(100);
 await page.screenshot({path:path.join(out,'menu.png')});
 const shape=await page.locator('.pp-ui').evaluate(e=>{const r=e.getBoundingClientRect();return {w:e.clientWidth,h:e.clientHeight,renderedWidth:r.width,renderedHeight:r.height};});
 if(shape.w!==390||shape.h!==780||shape.renderedWidth<380)throw Error('Menu area too small '+JSON.stringify(shape));
 await page.locator('#ad-settings-close').click();
 for(const kind of ['story_cg','character_intro']){
  await page.evaluate(kind=>__ADirectorUI.nextDialog(kind),kind);
  await page.waitForSelector('#ad-next[data-pp-fitted=true][open]');
  if(kind==='story_cg'&&await page.locator('#ad-target-row').isVisible())throw Error('Hidden character field exposed');
  const r=await page.locator('#ad-next .ph-pop-card').boundingBox();
  if(r.x<4||r.right>424||r.y<96||r.y+r.height>936)throw Error('Popup outside usable screen '+JSON.stringify(r));
  await page.screenshot({path:path.join(out,kind+'.png')});
  await page.locator('#ad-next-cancel').click();
 }
 await page.goto(url+'?surface=viewer');
 await page.waitForSelector('#addock-fullview[open]');
 await page.evaluate(()=>document.documentElement.style.setProperty('--tavo-inset-top-bar','96px'));
 await page.screenshot({path:path.join(out,'viewer.png')});
 const bar=await page.locator('.addock-fullview-bar').boundingBox();
 if(bar.y<96)throw Error('Viewer overlaps host top bar');
 if(errors.length)throw Error(errors.join());
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({phoneViewport:[428,936],hostTop:96,shape,popupsFit:true,viewerTop:bar.y,errors,physicalPhoneVerified:false},null,2));
 console.log('PASS phone-only: larger menu area, hidden fields, two fitted dialogs and viewer safe top');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
