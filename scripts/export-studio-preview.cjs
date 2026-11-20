const fs=require('fs'),path=require('path');const read=p=>require('./read-ui-source.cjs').read(process.cwd(),p);const test=read('scripts/verify-studio.cjs');const match=test.match(/await page\.evaluate\((async\(\)=>\{const vars=new Map\(\);[\s\S]*?)\);await page\.addScriptTag\(\{content:read\('src\/ui\/image-memory.js'\)\}\)/);if(!match)throw Error('bootstrap missing');const entry=read('dist/plugin/entry.js').replace(read('src/entry.js'),'window.TestCore=Core;window.TestStore=createStore;window.TestApp=createApp;window.TestAssets=Assets;');const host=`document.documentElement.style.setProperty('--tavo-inset-top-bar','64px');const hostLabel=document.createElement('div');hostLabel.style='position:fixed;inset:0 0 auto;height:64px;background:#191919;color:#ddd;display:flex;align-items:center;justify-content:space-between;padding:0 20px;font:13px system-ui;pointer-events:none';hostLabel.innerHTML='<span>‹</span><span>本地预览 · 宿主区域示意</span><span>⋯</span>';document.body.append(hostLabel);`;
const logs=[
 {id:'preview-static',title:'静态图片生成',status:'done',startedAt:1760000000000,finishedAt:1760000012800},
 {id:'preview-motion',title:'动态 CG',status:'failed',startedAt:1760000060000,finishedAt:1760000063900,error:'示例：接口未返回图片'},
 {id:'preview-profile',title:'登记角色',status:'done',startedAt:1760000130000,finishedAt:1760000132800}
];
const profiles=['神崎 悠','白石 结衣','藤原 彻','雾岛 凛','小夜'].map((name,i)=>({
 id:'preview-character-'+i,name,aliases:[],form:i===4?'猫形态':'默认形态',
 previewPortrait:'data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'preview-assets','character-'+i+'.png')).toString('base64')
}));
const controller=read('src/ui/controller.js')
 .replace('const logs=[],bindings=[]','const logs='+JSON.stringify(logs)+',bindings=[]')
 .replace('if(!p.sourceMessageId||!p.sourceImageId)return;','if(p.previewPortrait){image.src=p.previewPortrait;image.hidden=false;placeholder.hidden=true;box.dataset.ready="true";return;}if(!p.sourceMessageId||!p.sourceImageId)return;');
const peripheral=read('scripts/preview-peripheral.js').replace('__PREVIEW_READER_SOURCE__',read('src/ui/reader.js')).replace('__PREVIEW_IMAGE__',profiles[1].previewPortrait);
const code=`(async()=>{window.fetch=async()=>{throw Error('本地预览不发送网络请求');};${entry};await (${match[1]})();${read('src/ui/image-memory.js')};${controller};${peripheral};await new Promise(resolve=>{const t=setInterval(()=>{if(window.__ADirectorUI&&!document.querySelector('#ad-launcher').disabled){clearInterval(t);resolve();}},50);});await __ADirectorApp.saveConfig({format:'nai45',imageService:'nai45',seedValue:'3828828633'});await __ADirectorApp.saveProfiles(${JSON.stringify(profiles)});await __ADirectorApp.saveFavorites([{seed:4286912037,model:'NAI 4.5 FULL',note:'夜色街景'},{seed:317598041,model:'NAI 4.5 FULL',note:'暮色城市'},{seed:776509186,model:'NAI 4.5 FULL',note:'时钟特写'}]);${host}
if(!await setupPeripheralPreview())__ADirectorUI.settingsDialog();
window.addEventListener('message',event=>{
 if(event.source!==parent||event.data?.type!=='aozora-preview-page')return;
 const page=event.data.page;
 if(['home','static','size','params','profiles','profile','styles','style','seed','motion','logs'].includes(page)){
  const routes={home:'settings',profiles:'profiles',profile:'profiles',styles:'styles',style:'styles',seed:'seeds',motion:'api',logs:'logs'};
  __ADirectorUI.settingsDialog(routes[page]||'settings');
  const controls={static:'#studio-service',size:'#studio-frame',params:'#film-params',profile:'.ad-profile-card',style:'.ad-style-edit'};
  if(controls[page])document.querySelector(controls[page])?.click();
 }
});

${read('src/ui/phantom.js')}
${read('src/ui/workbench.js')}
parent.postMessage({type:'aozora-preview-ready'},'*');})().catch(e=>{document.body.textContent=e.message;});`;
const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>青空导演工作台 · 真实界面本地预览</title><style>body{margin:0;background:#111}'+['stage','status','reader-base','phantom-surfaces','workbench','phone-surfaces'].map(name=>read('src/ui/'+name+'.css')).join('\n')+'</style><body>'+read('src/ui/menu.html')+read('src/ui/stage.html')+'<script>'+code.replace(/<\/script/gi,'<\\/script')+'</script></body></html>';
fs.mkdirSync('dist/studio-review',{recursive:true});fs.writeFileSync('dist/studio-review/index.html',html);console.log('Wrote interactive preview with actual controller/app and local-only host adapter.');

