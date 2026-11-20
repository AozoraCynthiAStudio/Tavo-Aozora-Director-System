'use strict';
const {chromium}=require('playwright');
const path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const out=path.join(__dirname,'../dist/fixed-frame-check');fs.mkdirSync(out,{recursive:true});
 const cases=[
  {name:'android-small',width:360,height:640,dpr:3,mobile:true},
  {name:'android-tall',width:412,height:915,dpr:2.625,mobile:true},
  {name:'iphone',width:390,height:844,dpr:3,mobile:true},
  {name:'phone-wide',width:430,height:932,dpr:3,mobile:true},
  {name:'narrow',width:320,height:700,dpr:2,mobile:true},
  {name:'tablet',width:768,height:1024,dpr:2,mobile:true},
  {name:'desktop',width:1440,height:900,dpr:1,mobile:false},
  {name:'desktop-wide',width:1920,height:1080,dpr:1,mobile:false}
 ];
 const report=[];
 for(const item of cases){
  const context=await browser.newContext({viewport:{width:item.width,height:item.height},deviceScaleFactor:item.dpr,isMobile:item.mobile,hasTouch:item.mobile});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(__dirname,'../dist/studio-review/index.html')).href);
  await page.waitForSelector('#ad-settings[data-pp-ready=true][open]');
  const geometry=await page.evaluate(()=>{
   const root=document.querySelector('#ad-settings'),frame=document.querySelector('.pp-canvas').getBoundingClientRect(),ui=document.querySelector('.pp-ui'),r=ui.getBoundingClientRect();
   return {hostTop:root.getBoundingClientRect().top,frame:frame.toJSON(),width:ui.clientWidth,height:ui.clientHeight,ratio:r.width/r.height,scale:Number(root.dataset.ppScale)};
  });
  if(geometry.width!==390||geometry.height!==780||Math.abs(geometry.ratio-.5)>.001)throw Error(item.name+' design canvas changed');
  const r=geometry.frame;
  if(r.left<0||r.top<geometry.hostTop-1||r.right>item.width+1||r.bottom>item.height+1)throw Error(item.name+' frame clipped');
  const pages=[];
  for(const route of ['settings','profiles','styles','seeds','api','logs','frame','params']){
   await page.locator('[data-studio-nav='+route+']').click();
   await page.waitForTimeout(60);
   const result=await page.evaluate(()=>{
    const ui=document.querySelector('.pp-ui'),pane=[...document.querySelectorAll('#ad-workspace-content>.pp-page')].find(e=>!e.hidden);
    return {width:ui.clientWidth,height:ui.clientHeight,overflow:pane?pane.scrollWidth>pane.clientWidth+2:false,title:document.querySelector('#studio-page-title').textContent};
   });
   if(result.width!==390||result.height!==780||result.overflow)throw Error(item.name+' '+route+' '+JSON.stringify(result));
   pages.push(result.title);
  }
  await page.locator('[data-studio-nav=profiles]').click();
  await page.waitForSelector('.character-card');
  const stable=await page.locator('.pp-ui .mast').boundingBox();
  await page.evaluate(()=>{const list=document.querySelector('#ad-profile-list'),first=list.firstElementChild;for(let i=0;i<30;i++)list.append(first.cloneNode(true));});
  const scroll=await page.evaluate(()=>{
   const pane=document.querySelector('[data-ad-page=profiles]');
   pane.scrollTop=pane.scrollHeight;
   return {scroll:pane.scrollTop,height:pane.clientHeight,total:pane.scrollHeight};
  });
  if(scroll.scroll<=0)throw Error('Long list cannot scroll');
  const after=await page.locator('.pp-ui .mast').boundingBox();
  if(Math.abs(stable.y-after.y)>.1)throw Error('Header moved while scrolling');
  if(errors.length)throw Error(errors.join());
  await page.locator('[data-studio-nav=settings]').click();
  if(['iphone','android-small','desktop'].includes(item.name))await page.screenshot({path:path.join(out,item.name+'.png')});
  report.push({device:item.name,geometry,pages,longListScroll:scroll.scroll,pageErrors:errors});
  await context.close();
 }
 fs.writeFileSync(path.join(out,'responsive.json'),JSON.stringify({referenceCanvas:[390,780],maxHousingScale:1.3,cases:report,physicalPhoneVerified:false},null,2));
 console.log('PASS 8 device profiles × 8 pages; fixed aspect, housing bounds and independent long-list scrolling');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
