'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>require('./read-ui-source.cjs').read(root,p);
const source=read('scripts/verify-studio.cjs');
const match=source.match(/await page\.evaluate\((async\(\)=>\{const vars=new Map\(\);[\s\S]*?)\);await page\.addScriptTag\(\{content:read\('src\/ui\/image-memory.js'\)\}\)/);
if(!match)throw Error('Host mock not found');
const entry=read('dist/plugin/entry.js').replace(read('src/entry.js'),'window.TestCore=Core;window.TestStore=createStore;window.TestApp=createApp;window.TestAssets=Assets;');
const panel=fs.readFileSync(path.join(root,'dist/plugin/ui/panel.html'),'utf8');const scripts=[];const markup=panel.replace(/<script>([\s\S]*?)<\/script>/gi,(_,code)=>{scripts.push(code);return '';});
const portrait='data:image/png;base64,'+fs.readFileSync(path.join(root,'scripts/preview-assets/character-1.png')).toString('base64');
const peripheral=read('scripts/preview-peripheral.js').replace('__PREVIEW_READER_SOURCE__','').replace('__PREVIEW_IMAGE__',portrait);
const code='(async()=>{window.fetch=async()=>{throw Error("Read-only host mock");};'+entry+';await ('+match[1]+')();'+scripts.join('\n')+';'+peripheral+
';await new Promise(resolve=>{const id=setInterval(()=>{if(window.__ADirectorUI&&!document.querySelector("#ad-launcher").disabled){clearInterval(id);resolve();}},40);});'+
'await __ADirectorApp.saveConfig({format:"nai45",imageService:"official",seedValue:"3828828633"});'+
'await __ADirectorApp.saveProfiles([{id:"test-a",name:"测试角色",aliases:[],form:"默认形态"}]);'+
'await __ADirectorApp.saveFavorites([{seed:4286912037,model:"NAI 4.5 FULL",note:"夜色街景"}]);'+
'if(!await setupPeripheralPreview())await __ADirectorUI.settingsDialog();})().catch(e=>{document.body.dataset.previewError=e.message;console.error(e);});';
const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#171119}html{--tavo-inset-top-bar:64px}</style><body>'+
markup+'<script>'+code.split('</'+'script').join('<'+String.fromCharCode(92)+'/script')+'</script></body></html>';
fs.mkdirSync(path.join(root,'dist/packaged-preview'),{recursive:true});
fs.writeFileSync(path.join(root,'dist/packaged-preview/index.html'),html);
console.log('Exact packaged panel preview created, using only a local host mock.');