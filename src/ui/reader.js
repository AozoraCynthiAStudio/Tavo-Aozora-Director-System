/* Aozora scene reader: read-only message presentation; image commands reuse existing lifecycle. */
window.ADirectorCreateReader=function(tavo,api){
 const el=document.createElement('section');el.id='ad-reader';el.dataset.adSurface='reader';el.hidden=true;el.setAttribute('aria-label','Aozora导演系统 · 历史详情');el.innerHTML=`<header class="ar-top"><span id="ar-floor">本轮故事</span><nav><button id="ar-directory">目录</button><button id="ar-settings" aria-label="导演设置" title="导演设置"><svg class="addock-line-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.7 2.8h2.6l.4 2.1c.58.14 1.12.37 1.63.68l1.86-.98 1.84 1.84-.98 1.86c.31.51.54 1.05.68 1.63l2.1.4v2.6l-2.1.4a7.2 7.2 0 0 1-.68 1.63l.98 1.86-1.84 1.84-1.86-.98a7.2 7.2 0 0 1-1.63.68l-.4 2.1h-2.6l-.4-2.1a7.2 7.2 0 0 1-1.63-.68l-1.86.98-1.84-1.84.98-1.86a7.2 7.2 0 0 1-.68-1.63l-2.1-.4v-2.6l2.1-.4c.14-.58.37-1.12.68-1.63l-.98-1.86 1.84-1.84 1.86.98c.51-.31 1.05-.54 1.63-.68l.4-2.1Z"/><circle cx="12" cy="12" r="2.5"/></svg></button><button id="ar-close" aria-label="关闭历史" title="关闭历史，返回原卡片">×</button></nav></header><main id="ar-scroll"><div class="ar-layout"><section class="ar-visual"><div class="ar-stage"><i class="ar-ornament">✦</i><i class="ar-ornament second">✧</i><img id="ar-image" alt="本轮图片，点击查看大图"><span id="ar-count"></span><button id="ar-image-prev" aria-label="上一张图片">‹</button><button id="ar-image-next" aria-label="下一张图片">›</button><div id="ar-image-state" class="ad-generation-state" role="status" aria-live="polite"><svg class="ad-camera-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" aria-hidden="true"><rect x="3" y="6" width="12" height="12" rx="1"/><path d="m15 10 6-3v10l-6-3M7 10h4"/></svg><div><strong class="ad-phase-label"></strong><small class="ad-phase-hint"></small></div></div></div><nav id="ar-tools" aria-label="图片操作"></nav></section><article id="ar-prose"></article></div></main><footer class="ar-bottom"><button id="ar-prev" aria-label="上一幕" title="上一幕">← 上一幕</button><button id="ar-directory-prev">← 上一页</button><button id="ar-return">返回目录</button><button id="ar-next" aria-label="下一幕" title="下一幕">下一幕 →</button><span id="ar-directory-page" aria-label="目录页码"></span><button id="ar-directory-next">下一页 →</button></footer><aside id="ar-directory-panel" hidden><div class="ar-directory-controls"><button id="ar-order">倒序排列 ↓</button><button id="ar-latest">回到最新</button><button id="ar-filter" role="switch" aria-label="只看有 CG 的对话" aria-checked="false"><span>仅有 CG</span><i aria-hidden="true"></i></button></div><div id="ar-directory-list"></div></aside><div id="ar-notice" role="status" hidden></div>`;document.body.append(el);el.querySelector('.ar-stage').append(el.querySelector('#ar-tools'));const motionImage=document.createElement('img');motionImage.id='ar-motion-image';motionImage.alt='动态变化帧';motionImage.hidden=true;el.querySelector('#ar-image').after(motionImage);const motionControls=document.createElement('div');motionControls.className='ar-motion-controls';const motionSpeedButton=document.createElement('button');motionSpeedButton.type='button';motionSpeedButton.className='ad-motion-speed ar-motion-speed';motionSpeedButton.hidden=true;const motionPlayButton=document.createElement('button');motionPlayButton.id='ar-motion-play';motionPlayButton.type='button';motionPlayButton.className='ar-motion-play';motionPlayButton.hidden=true;motionPlayButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg><span>播放动态</span>';motionControls.append(el.querySelector('#ar-count'),motionSpeedButton);el.querySelector('.ar-stage').append(motionControls,motionPlayButton);
 const frame=document.createElement('div');frame.className='ar-frame pp-position';
 const canvas=document.createElement('div');canvas.className='ar-canvas pp-canvas';
 const surface=document.createElement('div');surface.className='ar-surface';
 while(el.firstChild)surface.append(el.firstChild);
 const mast=document.createElement('header');mast.className='ar-mast';
 const heading=document.createElement('div');heading.className='ar-page-heading';heading.innerHTML='<strong>历史目录</strong><small>STORY ARCHIVE</small>';
 const paper=document.createElement('div');paper.className='ar-paper';paper.setAttribute('aria-hidden','true');
 const ribbon=document.createElement('div');ribbon.className='ar-ribbon';ribbon.setAttribute('aria-hidden','true');
 const screen=document.createElement('div');screen.className='pp-screen-bg';screen.setAttribute('aria-hidden','true');
 const housing=document.createElement('div');housing.className='pp-housing';housing.setAttribute('aria-hidden','true');
 const top=surface.querySelector('.ar-top'),floor=surface.querySelector('#ar-floor'),closeButton=surface.querySelector('#ar-close');
 mast.append(closeButton);surface.querySelector('.ar-stage').prepend(top);const headingMeta=document.createElement('div');headingMeta.className='ar-heading-meta';headingMeta.append(heading.querySelector('small'),floor);heading.append(headingMeta);
 const history=surface.querySelector('#ar-directory');history.replaceChildren(document.querySelector('#addock-history-button svg').cloneNode(true));history.className='ad-photo-control';history.setAttribute('aria-label','历史目录');history.title='历史目录';
 surface.querySelector('#ar-settings').className='ad-photo-control';
 surface.prepend(mast,paper,heading);surface.append(ribbon);canvas.append(screen,surface,housing);frame.append(canvas);el.append(frame);
 const fitReader=()=>{if(!el.hidden)window.ADirectorFrameLayout.fit(el,canvas);};
 window.ADirectorStatusSkin.mount(surface.querySelector('#ar-image-state'));
 const readerResize=new ResizeObserver(fitReader);readerResize.observe(el);
 const $=id=>el.querySelector('#'+id),memory=window.ADirectorImageMemory;let rows=[],current='',record=null,selected='',chat='',epoch=0,readEpoch=0,directoryPage=0,directoryDescending=true,onlyCg=false,cgCounts=new Map(),disposed=false,timer,sourceHash='',loading=false,pendingGeneration='',thumbEpoch=0;let rowsDirty=true,rowsRevision=0,cachedCount=null,cachedChat='';let motionPlaying=false,motionSpeed=0,motionEpoch=0;const motionSpeeds=[{label:'正常',duration:2000},{label:'快速',duration:1400},{label:'慢速',duration:3000}];const marks=new Map();memory?.clear($('ar-image'));memory?.clear(motionImage);
 function message(v){return v?.message||v;}
 const thumbnailJobs=new Map();
 async function thumbnailUrl(image,cid){const key=cid+'|'+image.pointer;if(thumbnailJobs.has(key))return thumbnailJobs.get(key);const job=(async()=>{const guard=async()=>{if(disposed||String((await tavo.chat.current())?.id)!==cid)throw Error('缩略图任务已过期');};await guard();const name=api.core().thumbnailName(image.pointer);if(await tavo.file.exists(name,{scope:'chat'})){await guard();return tavo.file.url(name,'chat');}const source=await api.app().imageUrl(image.pointer);let handle;try{handle=await memory.prepare(source,'thumb',()=>disposed,192);if(!handle?.owned||handle.fallback||!handle.url)throw Error('缩略图制作失败');const blob=await (await fetch(handle.url)).blob(),data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('缩略图编码失败'));reader.readAsDataURL(blob);});await guard();if(!await tavo.file.exists(image.pointer))throw Error('来源图片已移除');const saved=await tavo.file.save(name,data,{encoding:'dataUrl',scope:'chat'});if(!saved)throw Error('缩略图保存未确认');await guard();if(!await tavo.file.exists(image.pointer)){await tavo.file.delete(name,{scope:'chat'});throw Error('来源图片已移除');}return tavo.file.url(name,'chat');}finally{handle?.release();}})();thumbnailJobs.set(key,job);try{return await job;}finally{thumbnailJobs.delete(key);}}
 function releaseThumbnails(){thumbEpoch++;el.querySelectorAll('.ar-history-thumb img').forEach(img=>memory?.clear(img));memory?.evictRole?.('thumb');}
 async function loadThumbnails(items,token){for(const [r,box]of items){if(token!==thumbEpoch||el.hidden||$('ar-directory-panel').hidden)return;try{const data=await api.app().readRecord(r.id);if(token!==thumbEpoch)return;const image=data?.images?.find(i=>i.id===data.currentImageId)||data?.images?.[0];if(!image)continue;const source=await thumbnailUrl(image,chat);if(token!==thumbEpoch)return;const img=document.createElement('img');img.alt='';box.append(img);memory.adopt(img,{url:source,role:'thumb',release(){}},source,'thumb');if(token!==thumbEpoch){memory.clear(img);memory.evictRole?.('thumb');return;}box.dataset.loaded=String(img.dataset.adirectorImgState==='ready'||img.naturalWidth>0);}catch{box.dataset.loaded='false';}}}
 function syncChrome(catalog){el.dataset.overlay=String(!catalog&&el.dataset.hasVisual==='true');const title=heading.querySelector('strong'),caption=heading.querySelector('small');title.textContent=catalog?'历史目录':'故事阅读';caption.textContent=catalog?'STORY ARCHIVE':'SCENE READER';}
 function closeDirectory(){releaseThumbnails();$('ar-directory-panel').hidden=true;el.dataset.directory='false';syncChrome(false);$('ar-return').textContent='返回目录';}
 function collection(v){return Array.isArray(v)?v:v?.items||v?.messages||[];}
 function note(text){const notice=$('ar-notice');(el.dataset.directory==='true'?$('ar-directory-panel'):$('ar-scroll')).prepend(notice);notice.textContent=text;$('ar-notice').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('ar-notice').hidden=true,4000);}
 function savePosition(){if(current)marks.set(chat+':'+current,{scroll:$('ar-prose').scrollTop,image:selected});}
 function preview(text){const clean=api.core().storyText(text||''),doc=new DOMParser().parseFromString(clean,'text/html');doc.querySelectorAll('details,summary,script,style,think,updatevariable,[hidden],[aria-hidden="true"]').forEach(n=>n.remove());doc.querySelectorAll('[style]').forEach(n=>{if(n.style.display==='none'||n.style.visibility==='hidden')n.remove();});doc.querySelectorAll('p,div,br,h1,h2,h3,li,blockquote').forEach(n=>n.append(document.createTextNode(' ')));return (doc.body.textContent||'').replace(/\s+/g,' ').trim().slice(0,150);}
 async function fetchRows(token=epoch){
  const revision=rowsRevision;const [index,c]=await Promise.all([api.app().index({reconcile:false}),tavo.chat.current()]);if(disposed||token!==epoch)return null;
  cgCounts=new Map(index.map(r=>[String(r.messageId),Math.max(0,Number(r.count)||0)]));
  const cid=String(c?.chat?.id||c?.id||'');
  // chat.current().messageCount may be missing or represent only a loaded window.
  // Tavo's message.count() is the documented total number of conversation floors.
  let rawCount=null;
  if(typeof tavo.message.count==='function'){try{rawCount=await tavo.message.count();}catch{rawCount=null;}}
  if(disposed||token!==epoch)return null;
  const count=Number(rawCount),countKey=rawCount!==null&&rawCount!==undefined&&Number.isSafeInteger(count)&&count>=0?count:null;
  if(countKey!==null&&!rowsDirty&&cachedChat===cid&&cachedCount===countKey)return rows;
  if(typeof tavo.message.find!=='function'){rowsDirty=revision!==rowsRevision;cachedChat=cid;cachedCount=countKey;return index.map((r,i)=>({id:String(r.messageId),index:i})).reverse();}
  const all=[],pageSize=100;
  // Read unfiltered *floor* ranges. A role filter loses the positions of user/system
  // messages; Tavo find() does not promise an `index` field on returned messages.
  // An open-ended scan also works for older hosts without message.count(), rather
  // than silently clipping history to the first 100/200 floors.
  for(let start=0;;start+=pageSize){
   if(disposed||token!==epoch)return null;
   const batch=collection(await tavo.message.find([start,start+pageSize-1])).map(message);
   if(disposed||token!==epoch)return null;
   let newIds=0;
   for(let i=0;i<batch.length;i++){
    const m=batch[i];if(!m?.id)continue;
    newIds++;
    if(m.role!==undefined&&m.role!=='assistant')continue;
    const floor=Number(m.index);
    all.push({id:m.id,index:m.index!==undefined&&Number.isSafeInteger(floor)&&floor>=0?floor:start+i,text:m.content||m.text||m.plainText||''});
   }
   if(batch.length<pageSize||newIds===0)break;
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  const sorted=[...new Map(all.map(m=>[String(m.id),m])).values()].sort((a,b)=>a.index-b.index),recent=new Set(sorted.slice(-10).map(m=>String(m.id)));
  rowsDirty=revision!==rowsRevision;cachedChat=cid;cachedCount=countKey;return sorted.map(m=>({id:m.id,index:m.index,...(recent.has(String(m.id))?{preview:preview(m.text)}:{})}));
 }
 async function loadPreviews(items,token){let cursor=0;async function worker(){while(cursor<items.length){const [row,node]=items[cursor++];if(token!==thumbEpoch||el.hidden)return;try{const m=await api.app().getMessage(row.id);if(token!==thumbEpoch||el.hidden)return;if(!m){node.textContent='这条回复已删除';rowsDirty=true;continue;}row.preview=preview(m.content||m.text||m.plainText||'');node.textContent=row.preview||'本轮没有折叠区域外的正文';}catch{if(token===thumbEpoch)node.textContent='正文摘要暂不可用';}}}await Promise.all([worker(),worker()]);}

 function markdown(text){const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');return escape(text).split(/\n\s*\n/).map(p=>'<p>'+p.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\n/g,'<br>')+'</p>').join('');}
 function prose(text){const clean=api.core().storyText(text||''),doc=new DOMParser().parseFromString(/<[a-z][\s\S]*>/i.test(clean)?clean:markdown(clean),'text/html');doc.querySelectorAll('script,style,iframe,object,embed,link,meta,base,form,input,button,textarea,select,svg,math,think,updatevariable,summary,[hidden],[aria-hidden="true"]').forEach(n=>n.remove());doc.querySelectorAll('p,div,br,li,blockquote,h1,h2,h3,details,pre,tr').forEach(n=>n.append(document.createTextNode('\n\n')));const plain=(doc.body.textContent||'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim(),fragment=document.createDocumentFragment();for(const para of plain.split(/\n\s*\n/)){const p=document.createElement('p');p.textContent=para;fragment.append(p);}return fragment;}
 function paintNav(){const at=rows.findIndex(r=>String(r.id)===current);$('ar-prev').disabled=at<=0;$('ar-next').disabled=at<0||at>=rows.length-1;const row=rows[at];$('ar-floor').textContent=row?.index!==undefined?'第 '+(row.index+1)+' 楼':'回复 '+current;}
 const toolIcons={"add":"<svg class=\"addock-line-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"4\"/><path d=\"M12 7v10M7 12h10\"/></svg>","reroll":"<svg class=\"addock-line-icon addock-action-refresh\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 7v5h-5M4 17v-5h5M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2\"/></svg>","tune":"<svg class=\"addock-line-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z\"/><path d=\"m15 5 3 3\"/></svg>","register":"<svg class=\"addock-line-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"9\" cy=\"7\" r=\"3\"/><path d=\"M3 20v-3a6 6 0 0 1 12 0v3M19 4v6m-3-3h6\"/></svg>","delete":"<svg class=\"addock-line-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7\"/></svg>"};
 function renderTools(){
  const images=record?.images||[],item=images.find(i=>i.id===selected),busy=['queued','generating'].includes(record?.status),tools=$('ar-tools');
  tools.replaceChildren();
  const registered=!!item&&api.app().snapshot().profiles.some(p=>String(p.sourceMessageId)===current&&p.sourceImageId===item.id);
  const hasMotion=!!item?.motion?.sourcePointer,motionOrigin=api.hasMotionOrigin?.(item,images)||!!item?.motionDerived||!!item?.motion;
  motionPlayButton.hidden=!hasMotion;
  motionPlayButton.title=motionPlaying?'查看静态图':'播放动态';
  motionPlayButton.setAttribute('aria-label',motionPlayButton.title);
  motionPlayButton.querySelector('span').textContent=motionPlaying?'查看静态':'播放动态';
  motionPlayButton.querySelector('svg').innerHTML=motionPlaying?'<path d="M7 5h4v14H7zM14 5h4v14h-4z"/>':'<path d="M8 5.5v13l10-6.5z"/>';
  motionSpeedButton.hidden=!(hasMotion&&motionPlaying);
  motionSpeedButton.textContent=motionSpeeds[motionSpeed].label;
  motionSpeedButton.setAttribute('aria-label','播放速度：'+motionSpeeds[motionSpeed].label+'，点击切换');
   const editCore=api.core(),editApp=api.app(),sourceConfig={...(record?.config||{}),...(item?.config||{})},currentConfig=editApp?.snapshot().config,canNaiEdit=!!item&&!!editCore?.supportsNaiImageEdit?.({...item,config:sourceConfig},currentConfig),canEditSource=editCore?.supportsTextImageEdit?.(item),canRequestMotion=(canNaiEdit||(!!item?.pointer&&!!item.plan&&editCore?.supportsReferenceEdit(currentConfig)))&&!hasMotion;
   const canRepeat=!motionOrigin,actions=[...(canRepeat&&(record?.plan||item)?[['reroll','↻','重抽']]:[]),...(canRepeat&&(record?.plan||item||recoverableScene||recoverablePlan)?[['add','＋','新增']]:[]),...(canEditSource?[['tune','✎','调整画面']]:[]),...(canRequestMotion?[['motion','∿','动态']]:[]),...(item?.kind==='character_intro'?[['register','♙',registered?'已登记':'登记']]:[]),...(item?[['delete','♜','删除']]:[])];
  for(const [action,icon,title]of actions){
   const b=document.createElement('button');b.type='button';
   const paths={add:'M12 4v16M4 12h16',reroll:'M20 5v6h-6M4 19v-6h6M5 8a8 8 0 0 1 14-2M19 16a8 8 0 0 1-14 2',tune:'m5 16-1 5 5-1L20 9l-5-5ZM13 6l5 5',motion:'M3 12h4l2-5 4 10 2-5h6',register:'M2 21v-3a7 7 0 0 1 14 0M20 9v8M16 13h8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',delete:'M4 6h16M9 6V3h6v3M6 6l1 14h10l1-14M10 10v6M14 10v6'};
   b.className='ad-photo-control';b.dataset.action=action;
   const source=document.getElementById({add:'addock-add',reroll:'addock-generate',tune:'addock-tune',motion:'addock-motion',register:'addock-dna-open',delete:'addock-keep'}[action])?.querySelector('svg');
   b.innerHTML=(source?.outerHTML||toolIcons[action]||'<svg class="addock-line-icon" viewBox="0 0 24 24"><path d="'+(paths[action]||'')+'"/></svg>')+'<span>'+title+'</span>';
   b.disabled=busy||stageStatus().busy||(!record?.plan&&!item&&action==='reroll')||(!record?.plan&&!item&&action==='add'&&!recoverableScene&&!recoverablePlan);
   if(action==='register'){b.dataset.registered=String(registered);if(registered)b.querySelector('path').setAttribute('d','M2 21v-3a7 7 0 0 1 14 0M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M17 14l3 3 4-6');}
   b.setAttribute('aria-label',title);b.title=title;b.onclick=()=>run(action);tools.append(b);
  }
 }
 function readerImageStatus(phase,label,hint,pixels=false){const n=$('ar-image-state');n.dataset.phase=phase;n.dataset.pixels=String(pixels);n.querySelector('.ad-phase-label').textContent=label;n.querySelector('.ad-phase-hint').textContent=hint||'';}
 function stageStatus(){
  const activity=api.app().snapshot().activity,persisted=api.core().Status.fromRecord(record);
  if(api.app().isRegenerating?.(current))return api.core().Status.describe({phase:'preparing',messageId:current});
  const matches=String(activity?.messageId||'')===current;
  if(matches&&activity.busy)return activity;
  if(persisted.busy)return persisted;
  if(matches&&['failed','uncertain','cancelled'].includes(activity.phase))return activity;
  if(pendingGeneration===current)return api.core().Status.describe({phase:'queued',messageId:current});
  return persisted;
 }
 function paintStageStatus(hasImage){
  const phase=stageStatus(), state=$('ar-image-state');
  state.hidden=hasImage&&['idle','done'].includes(phase.phase);
  const failure=phase.phase==='failed'||(phase.phase==='uncertain'&&phase.error)?api.core().Status.imageFailure(phase):null;
  readerImageStatus(phase.phase,failure?.title||({idle:'暂无图片',preparing:'准备中','prompt-ready':'等待生成',queued:'等待生成',generating:'生成中',saving:'保存中',loading:'加载中',failed:'生成失败',uncertain:'待确认',cancelled:'已取消'}[phase.phase]||phase.label),failure?.hint||'',hasImage);
  renderTools();
 }
 let recoverableScene=false,recoverablePlan=false;
 function stopMotion(clear=false){
  motionPlaying=false;motionEpoch++;motionImage.hidden=true;
  if(clear){memory?.clear(motionImage);motionImage.dataset.pointer='';}
  renderTools();
 }
 async function toggleMotion(){
  const item=(record?.images||[]).find(image=>image.id===selected),pointer=item?.motion?.sourcePointer;
  if(!item||!pointer)return;
  if(motionPlaying){stopMotion();return;}
  const token=++motionEpoch;motionPlaying=true;
  motionImage.style.setProperty('--ad-motion-duration',motionSpeeds[motionSpeed].duration+'ms');
  renderTools();
  try{
   if(motionImage.dataset.pointer!==pointer||motionImage.dataset.adirectorImgState!=='ready'){
    const source=await api.app().imageUrl(pointer);
    if(token!==motionEpoch||el.hidden||!motionPlaying||selected!==item.id)return;
    motionImage.dataset.pointer=pointer;
    await memory.set(motionImage,source,'stage');
   }
   if(token!==motionEpoch||el.hidden||!motionPlaying||selected!==item.id)return;
   motionImage.hidden=false;
  }catch(error){
   if(token===motionEpoch){motionPlaying=false;motionImage.hidden=true;renderTools();}
   throw error;
  }
 }
 motionPlayButton.addEventListener('click',()=>toggleMotion().catch(error=>note('动态画面暂不可用：'+error.message)));
 motionSpeedButton.addEventListener('click',()=>{motionSpeed=(motionSpeed+1)%motionSpeeds.length;motionImage.style.setProperty('--ad-motion-duration',motionSpeeds[motionSpeed].duration+'ms');renderTools();});
 async function paintImage(){
  const r=record,images=api.app().isRegenerating?.(current)?[]:r?.images||[];
  if(!images.some(i=>i.id===selected))selected=r?.currentImageId||images[0]?.id||'';
  const at=images.findIndex(i=>i.id===selected),item=images[at],motionKey=item?item.id+'|'+(item.motion?.sourcePointer||''):'';
  if(motionImage.dataset.motionKey!==motionKey){motionPlaying=false;motionEpoch++;motionImage.hidden=true;memory?.clear(motionImage);motionImage.dataset.pointer='';motionImage.dataset.motionKey=motionKey;}
  el.dataset.emptyCg=String(!item);el.dataset.hasVisual='true';$('ar-image').hidden=!item;
  $('ar-count').hidden=images.length<2;$('ar-count').textContent=(at+1)+' / '+images.length;
  for(const id of ['ar-image-prev','ar-image-next'])$(id).hidden=images.length<2;
  const state=$('ar-image-state');paintStageStatus(!!item);
  if(!item){readEpoch++;memory?.clear($('ar-image'));return;}
  const pointer=item.pointer;
  if($('ar-image').dataset.pointer===pointer&&$('ar-image').dataset.adirectorImgState==='ready')return;
  const token=++readEpoch;
  if($('ar-image').dataset.pointer!==pointer){$('ar-image').dataset.pointer=pointer;memory?.clear($('ar-image'));}
  if(!stageStatus().busy){state.hidden=false;readerImageStatus('loading','正在加载','正在读取已保存的图片。',false);}
  try{
   const url=await api.app().imageUrl(pointer);
   if(token!==readEpoch||el.hidden)return;
   await memory.set($('ar-image'),url,'stage');
   if(token===readEpoch&&!el.hidden)paintStageStatus(true);
  }catch(error){
   if(token===readEpoch){
    if(stageStatus().busy)paintStageStatus(true);
    else{state.hidden=false;readerImageStatus('failed','图片读取失败','返回后可重新打开图片，不会自动生图。',false);}
   }
  }
 }
 async function go(id,direction=1){savePosition();const token=++epoch,app=api.app();current=String(id);const [m,r]=await Promise.all([app.getMessage(current),app.readRecord(current)]);if(token!==epoch||el.hidden)return;if(!m){rows=rows.filter(x=>String(x.id)!==current);note('这条回复已删除');paintNav();return;}record=r;const mark=marks.get(chat+':'+current);selected=mark?.image||r?.currentImageId||r?.images?.[0]?.id||'';const text=m.content||m.text||'';const emptyVisual=!r?.plan&&!(r?.images?.length)&&!['queued','generating'].includes(r?.status);recoverablePlan=emptyVisual&&!api.core().readFailure(text)&&(/<ad-visual\b/i.test(text)||!!api.core().readSaved(text));recoverableScene=emptyVisual&&!recoverablePlan&&!!api.core().storyText(text).trim();sourceHash=text;$('ar-prose').replaceChildren(prose(text));if(!$('ar-prose').textContent.trim())$('ar-prose').textContent='这条回复暂无可展示的正文。';paintNav();await paintImage();if(token!==epoch)return;$('ar-prose').scrollTop=mark?.scroll||0;closeDirectory();}
 async function open(id,catalog=false){const token=++epoch;el.hidden=false;fitReader();document.body.classList.add('ad-reader-active');el.setAttribute('aria-busy','true');if(catalog){syncChrome(true);releaseThumbnails();el.dataset.directory='true';$('ar-directory-panel').hidden=false;$('ar-floor').textContent='历史记录';const hint=document.createElement('p');hint.className='ar-directory-empty';hint.textContent='正在读取历史…';$('ar-directory-list').replaceChildren(hint);}try{const c=await tavo.chat.current();if(token!==epoch)return;const cid=String(c?.chat?.id||c?.id||'');if(cid!==chat){marks.clear();rows=[];rowsDirty=true;onlyCg=false;cgCounts.clear();chat=cid;}const next=await fetchRows(token);if(token!==epoch||!next)return;rows=next;const target=id||current&&rows.some(r=>String(r.id)===current)&&current||api.app().snapshot().latestMessageId||String(rows.at(-1)?.id||'');if(target&&!rows.some(r=>String(r.id)===String(target))){const m=await api.app().getMessage(target);if(token!==epoch)return;if(m)rows.push(m);}el.setAttribute('aria-busy','false');if(catalog){current=String(target||'');paintNav();directory(true);return;}if(target)await go(target);else{$('ar-prose').textContent='当前对话还没有可阅读的回复。';record=null;el.dataset.hasVisual='false';$('ar-floor').textContent='故事阅读';paintNav();}}catch(error){if(token===epoch&&!el.hidden){el.setAttribute('aria-busy','false');note('阅读页加载失败：'+error.message);}}}

 function close(backToCard=false){releaseThumbnails();savePosition();epoch++;readEpoch++;motionEpoch++;motionPlaying=false;el.hidden=true;document.body.classList.remove('ad-reader-active');memory?.clear($('ar-image'));memory?.clear(motionImage);if(backToCard)Promise.resolve(api.returnToCard?.(current)).catch(error=>note(error.message));else api.close();}
 async function run(action){
   const item=(record?.images||[]).find(i=>i.id===selected),supplement=action==='add'&&!record?.plan&&!item&&recoverableScene;
   if((api.hasMotionOrigin?.(item,record?.images||[])||item?.motionDerived||item?.motion)&&['add','reroll'].includes(action))return;
  if(loading||!current||(!record?.plan&&!item&&!(action==='add'&&(recoverableScene||recoverablePlan))))return;
  loading=true;const dispatched=supplement?'supplement':action,generating=dispatched==='add'||dispatched==='reroll';
  if(generating){pendingGeneration=current;paintStageStatus(!$('ar-image').hidden);}
  try{await api.action(dispatched,current,selected);if(!el.hidden){record=await api.app().readRecord(current);await paintImage();}}
  catch(error){note(error.message);}
  finally{loading=false;if(generating){pendingGeneration='';if(!el.hidden)paintStageStatus(!$('ar-image').hidden);}}
 }
 async function refresh(event){if(['message','removed','closed','ready'].includes(event.type)){rowsDirty=true;rowsRevision++;if(event.type==='message')for(const row of rows)delete row.preview;}if(event.type==='record'&&event.imageCompleted){const image=event.record?.images?.find(i=>i.id===event.record.currentImageId);if(image){const cid=String(event.record.chatId||'');if(cid)setTimeout(()=>{if(!disposed)thumbnailUrl(image,cid).catch(()=>{});},400);}}if(el.hidden)return;if(event.type==='activity'&&String(event.activity?.messageId||'')===current)paintStageStatus(!$('ar-image').hidden);if(event.type==='profiles')renderTools();if(event.type==='registration'&&String(event.job?.sourceMessageId)===current&&event.job.status==='extracting')note('正在登记角色，后台继续处理');if(event.type==='closed'){close();rows=[];marks.clear();current='';return;}if(event.type==='record'){cgCounts.set(String(event.messageId),event.record?.images?.length||0);if(!$('ar-directory-panel').hidden)directory();}if(event.type==='record'&&String(event.messageId)===current){savePosition();const previousRequest=record?.requestId;record=event.record;if(record.requestId!==previousRequest){const id=current,m=await api.app().getMessage(current);if(id!==current||el.hidden)return;const text=m?.content||m?.text||'';if(text!==sourceHash){const top=$('ar-prose').scrollTop;sourceHash=text;$('ar-prose').replaceChildren(prose(text));$('ar-prose').scrollTop=top;}}if(event.imageCompleted)selected=record.currentImageId||selected;await paintImage();}if(event.type==='regeneration'&&String(event.messageId)===current)await paintImage();if(event.type==='removed'&&event.replaced){cgCounts.set(String(event.messageId),0);if(String(event.messageId)===current){record=null;await paintImage();}return;}if(event.type==='removed'){rows=rows.filter(r=>String(r.id)!==String(event.messageId));if(String(event.messageId)===current){const next=rows.at(-1);if(next)await go(next.id);else{record=null;current='';el.dataset.hasVisual='false';$('ar-prose').textContent='这条回复已删除。';}}paintNav();}}
 $('ar-close').onclick=()=>close();$('ar-settings').onclick=()=>api.settings?.();$('ar-return').onclick=()=>el.dataset.directory==='true'?close():directory(true);for(const [id,delta]of [['ar-prev',-1],['ar-next',1]])$(id).onclick=()=>{const at=rows.findIndex(r=>String(r.id)===current),to=rows[at+delta];if(to)go(to.id,delta).catch(e=>note(e.message));};for(const [id,delta]of [['ar-image-prev',-1],['ar-image-next',1]])$(id).onclick=()=>{const list=record?.images||[],at=list.findIndex(i=>i.id===selected);if(list.length){selected=list[(at+delta+list.length)%list.length].id;paintImage();}};
 $('ar-image').onclick=()=>run('viewer');$('ar-image').onerror=async()=>{const item=record?.images?.find(i=>i.id===selected),token=readEpoch;if(!item)return;try{const url=await api.app().imageUrl(item.pointer,true);if(token===readEpoch&&!el.hidden)await memory.set($('ar-image'),url,'stage');}catch{note('图片文件暂不可用');}};
 function directoryRows(){return onlyCg?rows.filter(r=>(cgCounts.get(String(r.id))||0)>0):rows;}
 function directory(reset=false){releaseThumbnails();const thumbJobs=[],previewJobs=[],token=thumbEpoch,eligible=directoryRows(),latest=String(eligible.at(-1)?.id||'');if(reset){const sorted=directoryDescending?[...eligible].reverse():eligible,at=sorted.findIndex(r=>String(r.id)===current);directoryPage=Math.floor(Math.max(0,at)/10);}const list=$('ar-directory-list'),sorted=directoryDescending?[...eligible].reverse():eligible,pages=Math.max(1,Math.ceil(sorted.length/10));directoryPage=Math.max(0,Math.min(directoryPage,pages-1));list.replaceChildren();for(const r of sorted.slice(directoryPage*10,directoryPage*10+10)){const b=document.createElement('button');b.type='button';b.dataset.active=String(String(r.id)===latest);b.dataset.messageId=String(r.id);const floor=document.createElement('strong'),preview=document.createElement('span');floor.textContent=r.index!==undefined?'第 '+(r.index+1)+' 楼':'回复 '+r.id;const badge=document.createElement('small');badge.className='ar-cg-count';const total=cgCounts.get(String(r.id))||0;badge.dataset.hasCg=String(total>0);badge.textContent=total?total+' CG':'无 CG';floor.append(badge);preview.textContent=r.preview===undefined?'正在读取摘要…':r.preview||'本轮没有折叠区域外的正文';if(r.preview===undefined)previewJobs.push([r,preview]);const thumb=document.createElement('span');thumb.className='ar-history-thumb';thumb.dataset.hasCg=String(total>0);thumb.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18v16H3ZM3 17l6-6 4 4 3-3 5 5"/><circle cx="15" cy="8" r="1.5"/></svg>';b.append(thumb,floor,preview);if(total>0)thumbJobs.push([r,thumb]);b.onclick=()=>go(r.id).catch(e=>note(e.message));list.append(b);}if(!sorted.length){const empty=document.createElement('p');empty.className='ar-directory-empty';empty.textContent=onlyCg?'还没有包含 CG 的对话':'暂无可阅读的对话';list.append(empty);}$('ar-filter').setAttribute('aria-checked',String(onlyCg));$('ar-directory-page').textContent=(directoryPage+1)+' / '+pages;$('ar-directory-prev').disabled=directoryPage===0;$('ar-directory-next').disabled=directoryPage===pages-1;$('ar-order').textContent=directoryDescending?'倒序排列 ↓':'顺序排列 ↑';$('ar-directory-panel').hidden=false;el.dataset.directory='true';syncChrome(true);$('ar-floor').textContent='历史记录';$('ar-return').textContent='↪ 返回卡片';setTimeout(()=>{if(token!==thumbEpoch||el.hidden)return;loadPreviews(previewJobs,token);loadThumbnails(thumbJobs,token);},0);}
 $('ar-directory').onclick=async()=>{if(!$('ar-directory-panel').hidden){closeDirectory();return;}try{const token=epoch,next=await fetchRows(token);if(token!==epoch||!next||el.hidden)return;rows=next;directory(true);}catch(error){note(error.message);}};$('ar-latest').onclick=()=>{const last=directoryRows().at(-1);if(last)open(last.id);};$('ar-filter').onclick=()=>{onlyCg=!onlyCg;directoryPage=0;directory();};$('ar-order').onclick=()=>{directoryDescending=!directoryDescending;directoryPage=0;directory();};$('ar-directory-prev').onclick=()=>{directoryPage--;directory();};$('ar-directory-next').onclick=()=>{directoryPage++;directory();};
 async function openCatalog(id){await open(id,true);}
 return {open,openCatalog,close,refresh,isOpen:()=>!el.hidden,state:()=>({messageId:current,imageId:selected,rows:rows.length}),destroy(){disposed=true;readerResize.disconnect();clearTimeout(timer);close();el.remove();}};
};
