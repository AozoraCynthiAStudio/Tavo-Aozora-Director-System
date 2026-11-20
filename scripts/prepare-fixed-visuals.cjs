const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/Sylva/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const root=process.argv[2],preview='Y:/Workspace/Tavo/UI预览/全屏工作台-HTML';
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:390,height:780}});
 const roots=['character-studio','style-studio','seed-studio','motion-studio','logs-studio','size-studio','params-studio','static-api-studio'];
 let output='/* Fixed 390×780 menu. Rules are sourced from the approved UI preview. */\n';
 for(const name of ['styles.css','characters.css','styles-page.css','seeds.css','motion.css','logs.css','size.css','params.css','static-api.css','title-shared.css']){
  const css=fs.readFileSync(path.join(preview,name),'utf8');
  output+=await page.evaluate(({css,roots})=>{
   const sheet=new CSSStyleSheet();sheet.replaceSync(css);
   function selector(s){
    s=s.trim();
    if(s==='*')return '.pp-ui, .pp-ui *';
    if(s===':root'||s==='body')return '.pp-ui';
    if(s===':focus-visible')return '.pp-ui :focus-visible';
    s=s.replace(/\.studio(?=[\s.#:[>+~]|$)/g,'.pp-ui');
    for(const root of roots)s=s.replaceAll('.'+root,'.pp-ui.'+root);
    s=s.replace(/\.pp-ui\.pp-ui/g,'.pp-ui');
    return s.startsWith('.pp-ui')?s:'.pp-ui '+s;
   }
   function walk(rules){
    let out='';
    for(const rule of rules){
     if(rule.type===CSSRule.STYLE_RULE){
      // Split only at top-level commas; :is() selectors may contain nested commas.
      const parts=[];let depth=0,start=0;
      for(let i=0;i<rule.selectorText.length;i++){const c=rule.selectorText[i];if(c==='('||c==='[')depth++;if(c===')'||c===']')depth--;if(c===','&&!depth){parts.push(rule.selectorText.slice(start,i));start=i+1;}}
      parts.push(rule.selectorText.slice(start));
      out+=parts.map(selector).join(',')+'{'+rule.style.cssText+'}\n';
     }else if(rule.type===CSSRule.MEDIA_RULE){
      if(rule.conditionText.includes('prefers-reduced-motion'))out+='@media '+rule.conditionText+'{'+walk(rule.cssRules)+'}\n';
      else if(matchMedia(rule.conditionText).matches)out+=walk(rule.cssRules);
     }else if(rule.type===CSSRule.KEYFRAMES_RULE)out+=rule.cssText+'\n';
    }
    return out;
   }
   return walk(sheet.cssRules);
  },{css,roots});
 }
 output=output.replace(/url\(["']?assets\/([^"')]+)["']?\)/g,(_,name)=>'url("__WORKBENCH_'+name+'__")');
 fs.writeFileSync(path.join(root,'src/ui/workbench.css'),output);
 const legacy=fs.readFileSync(path.join(root,'src/ui/phantom.css'),'utf8');
 const surfaces=await page.evaluate(css=>{
  const sheet=new CSSStyleSheet();sheet.replaceSync(css);
  function walk(rules){let out='';for(const r of rules){if(r.type===CSSRule.STYLE_RULE){if(!r.selectorText.includes('#ad-settings'))out+=r.cssText+'\n';}else if(r.cssRules)out+='@'+(r.type===CSSRule.MEDIA_RULE?'media '+r.conditionText:r.name? 'keyframes '+r.name:'')+'{'+(r.type===CSSRule.KEYFRAMES_RULE?[...r.cssRules].map(v=>v.cssText).join('\n'):walk(r.cssRules))+'}\n';}return out;}return walk(sheet.cssRules);
 },legacy);
 fs.writeFileSync(path.join(root,'src/ui/phantom-surfaces.css'),surfaces);
 await browser.close();
 console.log('Approved preview CSS isolated; legacy settings skins excluded');
})().catch(e=>{console.error(e);process.exit(1)});
