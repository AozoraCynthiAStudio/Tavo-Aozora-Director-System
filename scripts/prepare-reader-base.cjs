const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/Sylva/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const root=process.argv[2],browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage();
 const css=fs.readFileSync(path.join(root,'src/ui/reader.css'),'utf8');
 const filtered=await page.evaluate(css=>{
  const sheet=new CSSStyleSheet();sheet.replaceSync(css);
  function walk(rules){let out='';for(const r of rules){if(r.type===CSSRule.STYLE_RULE){if(!r.selectorText.includes('ad-launcher')&&!r.selectorText.includes('ad-settings'))out+=r.cssText+'\n';}else if(r.type===CSSRule.MEDIA_RULE)out+='@media '+r.conditionText+'{'+walk(r.cssRules)+'}\n';else if(r.type===CSSRule.KEYFRAMES_RULE)out+=r.cssText+'\n';}return out;}return walk(sheet.cssRules);
 },css);
 fs.writeFileSync(path.join(root,'src/ui/reader-base.css'),filtered);
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
