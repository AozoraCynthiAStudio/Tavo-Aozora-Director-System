const {chromium}=require('playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path'),fs=require('node:fs');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true}),p=await b.newPage();
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const out=path.join(__dirname,'../dist/phantom-check');fs.mkdirSync(out,{recursive:true});
 for(const [width,height] of [[390,844],[360,640],[1280,900]]){
  await p.setViewportSize({width,height});await p.goto(pathToFileURL(path.join(__dirname,'../dist/studio-review/index.html')).href);
  await p.waitForSelector('#ad-settings[open]');
  await p.screenshot({path:path.join(out,'home-'+width+'.png'),fullPage:true});
  console.log(width,await p.locator('#ad-settings').evaluate(e=>({rect:e.getBoundingClientRect().toJSON(),phase:document.querySelector('#ad-launcher').dataset.phase})));
 }
 await p.setViewportSize({width:390,height:844});
 for(const name of ['profiles','styles','seeds','api','logs','frame','params']){
  await p.locator('[data-studio-nav='+name+']').click();
  await p.waitForTimeout(150);
  await p.screenshot({path:path.join(out,name+'.png')});
 }
 console.log('Errors',errors);
 fs.writeFileSync(path.join(out,'errors.json'),JSON.stringify(errors));
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
