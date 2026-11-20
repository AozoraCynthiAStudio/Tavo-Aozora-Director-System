(function directorUI(tavo){
  'use strict';
  const host=(()=>{try{if(window.top.document)return window.top;}catch{}return window;})();
  const studioDefaultStyles=__AD_STUDIO_DEFAULTS__;
  const studioCoverCatalog=__AD_STUDIO_COVERS__;
  const $=id=>document.getElementById(id),dock=$('adirector-cg-dock'),memory=window.ADirectorImageMemory||host.ADirectorImageMemory;
  if(!dock)return;
  const motionImage=document.createElement('img');motionImage.id='addock-motion-image';motionImage.alt='动态变化帧';motionImage.hidden=true;$('addock-main-image').after(motionImage);
  const motionPlayButton=document.createElement('button');motionPlayButton.id='addock-motion-play';motionPlayButton.type='button';motionPlayButton.className='addock-motion-play';motionPlayButton.hidden=true;motionPlayButton.setAttribute('aria-label','播放动态');motionPlayButton.title='播放动态';motionPlayButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg><span>播放动态</span>';$('addock-stage').append(motionPlayButton);
  const motionButton=document.createElement('button');motionButton.id='addock-motion';motionButton.type='button';motionButton.className='addock-btn';motionButton.title='以当前静态图申请动态';motionButton.setAttribute('aria-label','申请动态');motionButton.innerHTML='<svg class="addock-line-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h3l2-5 4 10 2-5h5"/></svg><span class="addock-action-caption">动态</span>';$('addock-add').after(motionButton);
  const viewerMotionImage=document.createElement('img');viewerMotionImage.id='addock-fullview-motion-image';viewerMotionImage.alt='动态变化帧';viewerMotionImage.hidden=true;$('addock-fullview-image').after(viewerMotionImage);
  const viewerMotionButton=document.createElement('button');viewerMotionButton.id='addock-fullview-motion-play';viewerMotionButton.type='button';viewerMotionButton.className='addock-btn';viewerMotionButton.hidden=true;viewerMotionButton.textContent='播放动态';viewerMotionButton.setAttribute('aria-label','播放动态');$('addock-fullview').querySelector('.addock-fullview-bottom').append(viewerMotionButton);
  const motionDialog=document.createElement('dialog');motionDialog.id='addock-motion-dialog';motionDialog.className='ad-modal ad-action-modal';motionDialog.innerHTML='<div class="ad-dialog-body"><h3>申请动态</h3><label>希望画面出现的变化<textarea id="addock-motion-request" rows="4" maxlength="800" placeholder="例如：轻轻扭头看向旁边，发梢随动作摆动"></textarea></label><small class="ad-muted">生成一个目标定格并与原图交替播放。直接说你想怎么变，导演会根据原图安排下一帧。</small><p id="ad-motion-error" role="alert" hidden></p></div><footer><button type="button" id="addock-motion-cancel">取消</button><button type="button" id="addock-motion-submit" class="ad-primary">申请动态</button></footer>';document.body.append(motionDialog);
  for(const id of ['addock-main-image','addock-motion-image','addock-fullview-image','addock-fullview-motion-image'])memory?.clear($(id));
  const root=$('ad-launcher');let app=null,core=null,unsubscribe=null,disposed=false,record=null,mid='',imageIndex=0,requestKind='story_cg',renderEpoch=0,viewer=false,follow=true,contextEpoch=0,historyViewerContext=null,historySessionContext=null;
  const promptButton=document.createElement('button');promptButton.id='ad-viewer-prompt';promptButton.type='button';promptButton.className='addock-btn';promptButton.title='生成记录';promptButton.setAttribute('aria-label','生成记录');promptButton.innerHTML='<svg class="addock-line-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg>';$('addock-fullview-seed').before(promptButton);
  const motionSpeeds=[{label:'正常',duration:2000},{label:'快速',duration:1400},{label:'慢速',duration:3000}];
  let motionSpeed=0;
  const cardMotionControls=document.createElement('div');
  cardMotionControls.className='ad-card-motion-controls';
  $('addock-stage').append(cardMotionControls);
  cardMotionControls.append($('addock-count'));
  const viewerMotionControls=document.createElement('div');
  viewerMotionControls.className='ad-viewer-motion-controls';
  viewerMotionButton.before(viewerMotionControls);
  viewerMotionControls.append(viewerMotionButton);
  const speedButtons=[cardMotionControls,viewerMotionControls].map(parent=>{
    const button=document.createElement('button');
    button.className='ad-motion-speed';
    button.type='button';
    button.hidden=true;
    parent.append(button);
    return button;
  });
  function syncMotionControls(){
    const speed=motionSpeeds[motionSpeed];
    speedButtons.forEach((button,index)=>{
      button.hidden=!(index?viewerMotionPlaying:motionPlaying);
      button.textContent=speed.label;
      button.setAttribute('aria-label','播放速度 '+speed.label+'，点击切换');
    });
    for(const id of ['addock-motion-image','addock-fullview-motion-image'])$(id).style.setProperty('--ad-motion-duration',speed.duration+'ms');
    const animated=viewerMotionPlaying&&!!active()?.motion?.sourcePointer;
    const download=$('addock-fullview-download'),label=animated?'下载动态 GIF':'下载静态图';
    download.dataset.exportMode=animated?'motion':'static';
    download.title=label;
    download.setAttribute('aria-label',label);
    download.querySelector('.ad-viewer-action-label').textContent=label;
  }
  const viewerActions=document.createElement('nav');viewerActions.id='ad-viewer-actions';viewerActions.setAttribute('aria-label','图片操作');$('addock-fullview').querySelector('.addock-fullview-bottom').prepend(viewerActions);for(const [id,label]of [['ad-viewer-prompt','生成记录'],['addock-fullview-download','下载'],['addock-fullview-delete','删除'],['addock-fullview-seed','收藏种子']]){const button=$(id);button.title=label;button.setAttribute('aria-label',label);button.querySelectorAll('span').forEach(n=>n.remove());const text=document.createElement('span');text.className='ad-viewer-action-label';text.textContent=label;button.append(text);viewerActions.append(button);}
  let registrationState=null;const registrationDefaultIcon=$('addock-dna-open').querySelector('svg')?.innerHTML||'';
  function paintRegistration(){const r=registrationState,match=r&&String(r.mid)===String(mid)&&r.imageId===active()?.id&&r.state==='busy'&&Date.now()<r.noticeUntil;if(match){const node=$('ad-card-state');node.hidden=false;node.dataset.phase='preparing';node.querySelector('.ad-phase-label').textContent='登记中';}const button=$('addock-dna-open'),item=active(),registered=!!item&&!!app?.snapshot().profiles.some(p=>String(p.sourceMessageId)===String(mid)&&p.sourceImageId===item.id);button.disabled=r?.state==='busy';button.dataset.registered=String(registered);button.title=registered?'已登记角色':'登记角色';button.setAttribute('aria-label',button.title);const icon=button.querySelector('svg');if(icon)icon.innerHTML=registered?'<path d="M2 21v-3a7 7 0 0 1 14 0M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M17 14l3 3 4-6"/>':registrationDefaultIcon;const caption=button.querySelector('.addock-action-caption');if(caption)caption.textContent=registered?'已登记':'登记';}
  const fallbackAttempts=new WeakMap();
  let styleEditing='',favoriteImage=null,lastImage='',lastMotionImage='',lastViewerImage='',lastViewerMotionImage='',thumbSignature='',zoom=1,pan={x:0,y:0},pointer=null,motionPlaying=false,viewerMotionPlaying=false,selectedImageId='';const logs=[],bindings=[];
  let deleteTarget=null,displayLoading=false,displayError='',lastGlobalPhase='',seedImageId='',settingsStageContext=null,canSupplementBody=false,canRecoverPlan=false;
  const bind=(node,event,fn)=>{if(!node)return;const listener=e=>{try{if(host.__ADirectorApp!==app)connect();Promise.resolve(fn(e)).catch(handleUiError);}catch(error){handleUiError(error);}};node.addEventListener(event,listener);bindings.push([node,event,listener]);};
  function dismissEditing(){const active=document.activeElement;if(active?.matches('input,textarea,[contenteditable=true]'))active.blur();}
  function openDialog(node){dismissEditing();window.ADirectorSettingsNotices?.prepareDialog(node);node.hidden=false;node.querySelectorAll('[autofocus]').forEach(n=>n.removeAttribute('autofocus'));const target=node.querySelector('header button:not([disabled])')||node.querySelector('button:not([disabled])')||node;if(target===node)node.tabIndex=-1;target.setAttribute('autofocus','');node.showModal();target.focus({preventScroll:true});}
  const show=id=>{const node=$(id);if(node?.showModal){if(!node.open){node.querySelectorAll('[aria-invalid=true]').forEach(n=>n.removeAttribute('aria-invalid'));openDialog(node);}}else if(node)node.hidden=false;};
  const hide=id=>{const node=$(id);if(node?.close)node.close();else if(node)node.hidden=true;};
  function handleUiError(error){if(error?.code==='UNCHANGED_FIXED_SEED'){show('ad-seed-locked');return;}if($('ad-settings').open)settingsNotice(error?.message||String(error),true);else if(!dock.hidden){displayError=error?.message||String(error);paintState();}else status(error?.message||String(error));}
  function invalidField(id,message){const node=$(id);if(!node)return;node.setAttribute('aria-invalid','true');node.dataset.originalPlaceholder??=node.placeholder||'';if(!node.value)node.placeholder=message;node.focus({preventScroll:true});}
  for(const node of document.querySelectorAll('.ad-modal input,.ad-modal textarea,.ad-modal select')){bind(node,'input',()=>{node.removeAttribute('aria-invalid');if(node.dataset.originalPlaceholder!==undefined){node.placeholder=node.dataset.originalPlaceholder;delete node.dataset.originalPlaceholder;}});bind(node,'invalid',event=>{event.preventDefault();invalidField(node.id,node.validity.valueMissing?'请填写此项':'请检查填写内容');});}
  const noticeCleanups=[];
  // Fade only the scrolling edge; keep the final item crisp when the end is reached.
  const contentViewport=$('ad-workspace-content');let scrollEdgeFrame=0;
  function updateScrollEdge(){if(scrollEdgeFrame||disposed)return;scrollEdgeFrame=requestAnimationFrame(()=>{scrollEdgeFrame=0;if(disposed)return;const more=contentViewport.scrollHeight-contentViewport.clientHeight-contentViewport.scrollTop>2,value=String(more);if(contentViewport.dataset.scrollMore!==value)contentViewport.dataset.scrollMore=value;const above=String(contentViewport.scrollTop>2);if(contentViewport.dataset.scrollAbove!==above)contentViewport.dataset.scrollAbove=above;});}
  bind(contentViewport,'scroll',updateScrollEdge);bind(host,'resize',updateScrollEdge);
  const scrollEdgeResize=new ResizeObserver(updateScrollEdge);scrollEdgeResize.observe(contentViewport);
  const scrollEdgeContent=new MutationObserver(updateScrollEdge);scrollEdgeContent.observe(contentViewport,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  noticeCleanups.push(()=>{cancelAnimationFrame(scrollEdgeFrame);scrollEdgeResize.disconnect();scrollEdgeContent.disconnect();});updateScrollEdge();
  const esc=x=>core?core.escapeHtml(x):String(x||'').replace(/[&<>"']/g,'');
  function clearSettingsNotice(){$('studio-feedback-live').textContent='';window.ADirectorSettingsNotices?.clear();}
  function settingsNotice(message,error=false){if(disposed)return;$('studio-feedback-live').textContent=message;const warning=/警告|超出|已解绑|暂未|请重新|待确认|未自动生图|预算/i.test(String(message||''));window.ADirectorSettingsNotices?.show(message,error?{kind:'error'}:warning?{kind:'warning'}:{});}
  const saveFeedbackTimers=new WeakMap();
  function startSaveFeedback(button){
    clearTimeout(saveFeedbackTimers.get(button));
    button.disabled=true;
    button.dataset.saveFeedback='saving';
    button.setAttribute('aria-busy','true');
    return Date.now();
  }
  function finishSaveFeedback(button,started,error){
    if(error)settingsNotice(error.message,true);
    saveFeedbackTimers.set(button,setTimeout(()=>{
      if(disposed)return;
      button.disabled=false;
      button.removeAttribute('aria-busy');
      if(!error){button.removeAttribute('data-save-feedback');return;}
      button.dataset.saveFeedback='error';
      saveFeedbackTimers.set(button,setTimeout(()=>button.removeAttribute('data-save-feedback'),1500));
    },Math.max(0,260-(Date.now()-started))));
  }
  function status(message){if(disposed)return;$('addock-status').textContent=String(message||'');if($('ad-next').open)$('ad-next-error').textContent=String(message||'');}
  function needsSettingsAttention(message){return /失败|错误|无效|未完成|未能|无法|不可用|未保存|未成功|出错|权限|警告|超出|已解绑|暂未|请重新|待确认|未自动生图|预算|error|failed|timeout|HTTP\s*[45]\d{2}/i.test(String(message||''));}
  function currentCardMessage(snapshot=app.snapshot()){return String(snapshot.latestMessageId||'');}
  function stageImages(){return follow?(app?.cardImages?.(mid,record)||[]):app?.isRegenerating?.(mid)?[]:record?.images||[];}
  function active(){const selected=record?.images?.[imageIndex],images=stageImages();return images.find(image=>image.id===selected?.id)||images.find(image=>image.id===record?.currentImageId)||images[0]||null;}
  function motionOrigin(item,images=record?.images||[]){return !!core?.hasMotionOrigin?.(item,images);}
  function genericModeSelected(config=app?.snapshot()?.config){if(config&&core?.imageServiceMode)return core.imageServiceMode(config)==='generic';if(config)return config.imageService==='generic'||config.format==='generic';return $('ad-format').value==='generic';}
  function supportsImageEditing(item){if(!item||!app||!core?.supportsNaiImageEdit)return false;const sourceConfig={...(record?.config||{}),...(item.config||{})};return core.supportsNaiImageEdit({...item,config:sourceConfig},app.snapshot().config);}
  function supportsMotionRequest(item,kind=record?.kind){return supportsImageEditing(item)&&(item?.kind||kind)!=='character_intro'&&!item?.motion?.sourcePointer;}
  function syncNaiOnlyNavigation(generic=genericModeSelected()){
    for(const button of document.querySelectorAll('[data-studio-nav="api"],[data-studio-nav="frame"],[data-studio-nav="params"],#ad-tabs [data-page="api"]')){
      if(button.hidden!==generic)button.hidden=generic;
    }
  }
  let cardPosition=null,cardDrag=null;
  const cardWide=()=>matchMedia('(min-width:901px) and (hover:hover) and (pointer:fine)').matches;
  const cardHandle=document.createElement('button');cardHandle.id='ad-card-drag';cardHandle.type='button';cardHandle.title='双击可以回到默认位置';cardHandle.setAttribute('aria-label','拖动卡片，双击可以回到默认位置');cardHandle.innerHTML='<i></i><i></i><i></i>';dock.append(cardHandle);
  function placeCard(x,y){const top=(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tavo-inset-top-bar'))||56)+8,width=dock.offsetWidth,height=dock.offsetHeight,left=Math.max(12,Math.min(innerWidth-width-12,x)),up=Math.max(top,Math.min(innerHeight-height-16,y));for(const [key,value]of Object.entries({left:left+'px',top:up+'px',right:'auto',bottom:'auto',margin:'0',transform:'none'}))dock.style.setProperty(key,value,'important');return {x:left/Math.max(1,innerWidth-width),y:up/Math.max(1,innerHeight-height)};}
  function syncCardPosition(){if(cardWide()){if(cardPosition&&!dock.hidden)cardPosition=placeCard(cardPosition.x*(innerWidth-dock.offsetWidth),cardPosition.y*(innerHeight-dock.offsetHeight));else for(const key of ['left','right','transform'])dock.style.removeProperty(key);}else{cardDrag=null;for(const key of ['top','bottom','margin'])dock.style.removeProperty(key);for(const [key,value]of Object.entries({left:'50%',right:'auto',transform:'translateX(-50%)'}))dock.style.setProperty(key,value,'important');}}
  bind(cardHandle,'pointerdown',e=>{if(!cardWide()||e.button!==0)return;const box=dock.getBoundingClientRect();cardDrag={id:e.pointerId,x:e.clientX,y:e.clientY,left:box.left,top:box.top};cardHandle.classList.add('is-dragging');cardHandle.setPointerCapture(e.pointerId);e.preventDefault();});
  bind(cardHandle,'pointermove',e=>{if(!cardDrag||e.pointerId!==cardDrag.id)return;cardPosition=placeCard(cardDrag.left+e.clientX-cardDrag.x,cardDrag.top+e.clientY-cardDrag.y);e.preventDefault();});
  for(const event of ['pointerup','pointercancel'])bind(cardHandle,event,e=>{cardDrag=null;cardHandle.classList.remove('is-dragging');if(cardHandle.hasPointerCapture(e.pointerId))cardHandle.releasePointerCapture(e.pointerId);});
  bind(cardHandle,'dblclick',()=>{cardPosition=null;for(const key of ['left','top','right','bottom','margin','transform'])dock.style.removeProperty(key);});
  function sizeStage(){const inset=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tavo-inset-top-bar'))||56;const usable=Math.max(180,innerHeight-inset-88-12),maxHeight=Math.min(usable*.76,innerHeight*.5,520),width=Math.min(innerWidth*.96,560,(maxHeight-2)*19/13+2),height=(width-2)/(19/13)+2;dock.style.setProperty('--az-photo-card-width',width.toFixed(2)+'px');dock.style.setProperty('--az-photo-card-height',height.toFixed(2)+'px');dock.dataset.photoPortrait='false';dock.dataset.photoNarrow='false';syncCardPosition();}
  let exportNotice=null;
  function showExportNotice(message){
    const entry={message};
    exportNotice=entry;
    paintState();
    setTimeout(()=>{if(exportNotice===entry){exportNotice=null;if(!disposed)paintState();}},3000);
  }
  const shortPhaseLabels={preparing:'准备中','prompt-ready':'等待生成',queued:'等待生成',generating:'生成中',saving:'保存中',loading:'加载中',done:'生成完成',failed:'生成未完成',uncertain:'待确认',cancelled:'已取消'};
  const phaseLabel=state=>shortPhaseLabels[state.phase]||state.label;
  const cardIsVisible=()=>!dock.hidden&&dock.dataset.view==='current'&&!reader?.isOpen()&&!viewer;
  let cardResult=null,cardResultTimer=null;
  function clearCardResult(){clearTimeout(cardResultTimer);cardResult=null;cardResultTimer=null;}
  noticeCleanups.push(clearCardResult);
  function keepCardResult(task){
    if(!cardIsVisible()||String(task?.messageId||'')!==String(mid)||!mid||!['done','failed','uncertain','cancelled'].includes(task.phase))return;
    clearCardResult();
    cardResult=core.Status.describe(task);
    cardResultTimer=setTimeout(()=>{clearCardResult();if(!disposed)paintState();},3000);
  }
  const terminalNotices=new Map(),viewerNotices=new Map();$('addock-fullview-return-bottom').before($('addock-fullview-notice'));
  const viewedCompletions=new Map(),viewedFailures=new Set();
  const failureKey=(messageId,value)=>[
    String(messageId||''),String(value?.operationId||value?.jobId||value?.generationId||''),
    String(value?.errorCode||''),String(value?.error||'')
  ].join('|');
  function uncertainKey(chatId,value){
    if(!chatId||!value)return '';
    const messageId=value.messageId||'';
    const taskId=value.operationId||value.jobId||value.generationId||'';
    if(!messageId&&!taskId)return '';
    return JSON.stringify([chatId,String(messageId),String(taskId||value.updatedAt||''),taskId?'':core.fingerprint(String(value.error||''))]);
  }
  function recordFailureAcknowledged(){
    return !!record?.images?.length&&['failed','uncertain'].includes(record.status)
      &&viewedFailures.has(failureKey(mid,record));
  }
  function paintLauncherCaption(text){const node=$('ad-launcher-caption');node.querySelectorAll('.ad-caption-dots').forEach(n=>n.remove());let copy=node.querySelector('.ad-caption-copy');if(!copy){copy=document.createElement('span');copy.className='ad-caption-copy';node.replaceChildren(copy);}if(copy.textContent!==text)copy.textContent=text;node.hidden=!text;}
  function paintLauncherBadge(phase){
    const node=$('ad-launcher-badge'),icons={done:'<path d="m5 12 4 4L19 6"/>',failed:'<path d="M12 5v9"/><circle cx="12" cy="19" r="1" fill="currentColor"/>',uncertain:'<path d="M8 8a4 4 0 0 1 8 0c0 3-4 3-4 6"/><circle cx="12" cy="19" r="1" fill="currentColor"/>'};
    if(node.dataset.phase!==phase){node.dataset.phase=phase;node.innerHTML=icons[phase]?'<svg class="ad-badge-icon" viewBox="0 0 24 24" aria-hidden="true">'+icons[phase]+'</svg>':'';}
    const hidden=!['preparing','prompt-ready','queued','generating','saving','loading','done','failed','uncertain'].includes(phase);if(node.hidden!==hidden)node.hidden=hidden;
  }
  function paintState(){
    if(!app||!core?.Status)return;
    const snapshot=app.snapshot(),running=snapshot.activity;
    const cardVisible=cardIsVisible();
    const cardNotice=cardVisible&&String(cardResult?.messageId||'')===String(mid)?cardResult:null;
    let global=running?.busy?running:snapshot.pending?core.Status.describe({phase:'pending'}):running&&running.phase!=='idle'?running:core.Status.fromRecord(record);
    const currentUncertain=global===running?running:record;
    if(cardVisible&&record?.status==='uncertain')app.acknowledgeUncertain(snapshot.chatId,uncertainKey(snapshot.chatId,record));
    if(global.phase==='uncertain'&&app.uncertainViewed(snapshot.chatId,uncertainKey(snapshot.chatId,currentUncertain)))
      global=core.Status.describe({phase:'idle',messageId:global.messageId||mid});
    if(cardVisible&&record?.images?.length){
      if(['failed','uncertain'].includes(record.status)&&record.error)viewedFailures.add(failureKey(mid,record));
      if(['failed','uncertain'].includes(running?.phase)&&String(running.messageId||'')===mid&&running.error)viewedFailures.add(failureKey(mid,running));
      if(viewedFailures.size>80)viewedFailures.delete(viewedFailures.values().next().value);
    }
    if(['failed','uncertain'].includes(global.phase)&&viewedFailures.has(failureKey(global.messageId||mid,global)))
      global=core.Status.describe({phase:'idle',messageId:global.messageId||mid});
    const launcherState=cardNotice||global;
    if(global.phase==='done'){
      const completedMessage=String(global.messageId||mid||'');
      const imageId=completedMessage===String(mid)?String(record?.currentImageId||active()?.id||''):'';
      if(imageId&&!dock.hidden&&dock.dataset.view==='current'&&!reader?.isOpen()&&!viewer){
        viewedCompletions.set(completedMessage,imageId);
        if(viewedCompletions.size>80)viewedCompletions.delete(viewedCompletions.keys().next().value);
      }
      const viewed=viewedCompletions.get(completedMessage);
      if(imageId&&viewed===imageId)global=core.Status.describe({phase:'idle'});
    }
    root.dataset.phase=launcherState.phase;root.title='Aozora导演系统 · '+launcherState.label;root.setAttribute('aria-label',root.title);paintLauncherBadge(launcherState.phase);paintLauncherCaption(cardNotice?phaseLabel(cardNotice):global.phase==='idle'?'':phaseLabel(global));
    if(lastGlobalPhase!==launcherState.phase){$('ad-launcher-live').textContent=launcherState.label;lastGlobalPhase=launcherState.phase;}
    const regenerating=app.isRegenerating?.(mid);
    const same=running&&(running.messageId?String(running.messageId)===mid:follow&&!mid),recordState=core.Status.fromRecord(record),local=same&&running.busy?running:recordState.busy?recordState:same&&running.phase!=='idle'?running:recordState;
    let state=regenerating?core.Status.describe({phase:'preparing'}):local.busy?local:displayError?core.Status.describe({phase:'failed',error:displayError}):displayLoading?core.Status.describe({phase:'loading'}):local;
    if(recordFailureAcknowledged())state=core.Status.describe({phase:'idle',messageId:mid});
    if(cardNotice)state=cardNotice;
    paintRecoveryPlaceholder(state);
    const target=currentCardMessage(snapshot);
    const awaitingNewReply=follow&&target!==mid;
    if(regenerating||awaitingNewReply){$('addock-main-image').hidden=true;$('addock-motion-image').hidden=true;$('addock-placeholder-image').hidden=true;}
    else if(active()&&!displayLoading&&!motionPlaying&&$('addock-main-image').dataset.adirectorImgState==='ready')$('addock-main-image').hidden=false;
    const hasStageImage=!!active()&&!awaitingNewReply;
    dock.dataset.directorPhase=state.phase;dock.dataset.directorPixels=String(hasStageImage);dock.dataset.directorManyActions=String(hasStageImage&&active()?.kind==='character_intro');
    let terminalExpired=false;
    if(hasStageImage&&['failed','uncertain','cancelled'].includes(state.phase)){const key=[mid,state.operationId||record?.jobId||running?.operationId||'',state.phase,state.error||displayError].join('|');if(!terminalNotices.has(key)){terminalNotices.set(key,Date.now()+3000);if(terminalNotices.size>80)terminalNotices.delete(terminalNotices.keys().next().value);setTimeout(()=>{if(!disposed)paintState();},3050);}terminalExpired=Date.now()>=terminalNotices.get(key);}
    const failure=state.phase==='failed'||(state.phase==='uncertain'&&state.error)?core.Status.imageFailure(state):null;
    for(const id of ['ad-card-state','ad-fullview-state']){
      const node=$(id),isCard=id==='ad-card-state',visibleImage=isCard?hasStageImage:!!active();
      const showResult=isCard&&!!cardNotice;
      const centered=isCard&&visibleImage&&['failed','uncertain','cancelled'].includes(state.phase);
      const unchanged=state.errorCode==='TUNING_NO_VISIBLE_CHANGE';
      node.dataset.phase=state.phase;node.dataset.pixels=String(visibleImage);
      node.dataset.notice=String(centered||(!isCard&&visibleImage&&state.phase==='failed'));
      node.dataset.result=String(showResult);
      node.hidden=!showResult&&(state.phase==='done'||(state.phase==='idle'&&visibleImage)||terminalExpired);
      const label=centered&&state.phase==='failed'?(unchanged?'画面未变化，原图已保留':'生成失败'):phaseLabel(state);
      node.querySelector('.ad-phase-label').textContent=state.phase==='idle'&&!visibleImage?'暂无画面':centered&&state.phase==='uncertain'?'结果待确认':label;
      const hint=centered
        ? state.phase==='uncertain'?'请先查看运行记录':state.phase==='failed'&&!unchanged?'原因见运行记录':''
        : failure&&!visibleImage?(unchanged?state.error:[failure.title,failure.hint].filter(Boolean).join('。')):'';
      node.querySelector('.ad-phase-hint').textContent=hint;
    }
    $('addock-placeholder').hidden=true;
    $('addock-fullview').dataset.directorPhase=state.phase;
    $('addock-story-state').textContent=state.label;$('addock-story-state').dataset.phase=state.phase;const notice=$('addock-fullview-notice'),image=active(),mismatch=viewer&&state.phase==='done'&&image?.verification?.seedMismatch===true;notice.hidden=true;if(mismatch){const key=[mid,image.id,image.requestedSeed,image.seed].join('|');if(!viewerNotices.has(key)){viewerNotices.set(key,Date.now()+4000);if(viewerNotices.size>80)viewerNotices.delete(viewerNotices.keys().next().value);setTimeout(()=>{if(!disposed)paintState();},4050);}notice.textContent='Seed 未按设定返回，详见生成记录';notice.hidden=Date.now()>=viewerNotices.get(key);}else notice.textContent='';
    if(viewer&&exportNotice){notice.textContent=exportNotice.message;notice.hidden=false;}
    const sourceImage=active(),canEditSource=supportsImageEditing(sourceImage),canApplyMotion=supportsMotionRequest(sourceImage,record?.kind);
    for(const id of ['addock-generate','addock-add','addock-motion','addock-tune'])$(id).disabled=state.busy;
    $('addock-generate').disabled=state.busy||awaitingNewReply||(!record?.plan&&!sourceImage?.plan);
    $('addock-add').disabled=state.busy||awaitingNewReply||(!record?.plan&&!sourceImage?.plan&&!canSupplementBody&&!canRecoverPlan);
    $('addock-add').title=record?.plan?'新增画面（固定 Seed 仅阻止完全相同的请求）':canRecoverPlan?'恢复本轮已有画面方案':'从这条已生成的正文补充画面';
    $('addock-motion').disabled=state.busy||!canApplyMotion;
    $('addock-tune').disabled=state.busy||!canEditSource;
    paintRegistration();
  }
  async function openDetails(){dismissEditing();if(!mid)return;closeViewer();dock.hidden=false;dock.dataset.view='detail';$('addock-story-body').hidden=false;$('addock-detail-return').hidden=false;$('addock-story-content').textContent='正在读取本轮剧情…';const selected=mid,message=await app.getMessage(mid);if(selected!==mid)return;const parsed=new DOMParser().parseFromString(core.storyText(message?.content||message?.text||''),'text/html');parsed.querySelectorAll('script,style,think,UpdateVariable').forEach(n=>n.remove());$('addock-story-content').textContent=parsed.body.textContent.trim()||'这条回复暂无可展示的剧情文字';paintState();}
  function returnFromDetails(){dock.dataset.view='current';$('addock-story-body').hidden=true;$('addock-detail-return').hidden=true;return render();}
  bind($('addock-detail-return'),'click',returnFromDetails);
  let logSequence=0;
  const taskStatuses={preparing:'准备提示词','prompt-ready':'方案已就绪',queued:'等待生成',ready:'待手动生成',generating:'正在生成',saving:'正在保存',extracting:'提取特征',review:'待确认',done:'已完成',failed:'失败',uncertain:'结果待确认',cancelled:'已取消'};
  function logReport(rows){return JSON.stringify({product:'Aozora导演系统',version:core?.VERSION||'unknown',exportedAt:new Date().toISOString(),tasks:rows},null,2);}
  async function downloadLog(rows){await tavo.file.export('aozora-report-'+Date.now()+'.json',logReport(rows),{encoding:'utf8'});}
  function errorLabel(row){const d=row.diagnostics||{},raw=[d.errorCode,d.errorDetail,row.error].filter(Boolean).join(' '),http=d.errorStatus||raw.match(/HTTP\s*[:：]?\s*(\d{3})/i)?.[1],code=String(d.errorCode||'').trim()||raw.match(/"code"\s*:\s*"([^"\n]{1,80})"/)?.[1]||raw.match(/"type"\s*:\s*"([^"\n]{1,80})"/)?.[1];return [http?'HTTP '+http:'',code].filter((v,i,a)=>v&&a.indexOf(v)===i).join(' · ')||'未返回错误代码';}
  let selectedLog=null;
  function logTime(row){return new Date(row.startedAt).toLocaleTimeString('zh-CN',{hour12:false});}
  function renderLogDetail(row){
    $('ad-log-detail-task').textContent=row.title;
    const badge=$('ad-log-detail-status');badge.dataset.status=row.status;badge.textContent=taskStatuses[row.status]||'进行中';
    const seconds=((row.finishedAt||row.updatedAt||row.startedAt)-row.startedAt)/1000;
    $('ad-log-detail-meta').textContent=[logTime(row),'耗时 '+Math.max(0,seconds).toFixed(1)+' 秒',row.messageId?'回复 '+row.messageId:''].filter(Boolean).join(' · ');
    const failed=!!row.error||row.status==='failed',code=$('ad-log-detail-code');
    $('ad-log-reason-title').textContent=failed?'失败原因':'任务结果';
    code.textContent=failed?errorLabel(row):'';code.hidden=!failed||code.textContent==='未返回错误代码';
    $('ad-log-detail-reason').textContent=failed?(row.error||row.diagnostics?.errorDetail||'未返回具体错误信息。'):row.warning||(row.status==='uncertain'?'结果待确认，可导出记录协助排查。':badge.textContent);
  }
  function renderLogs(){
    const list=$('ad-log-list'),focused=document.activeElement?.closest('.ad-log-entry')?.taskRecord;
    list.replaceChildren();$('ad-log-count').textContent=logs.length+' / 80 项任务';$('ad-log-export').disabled=$('ad-log-clear').disabled=!logs.length;
    if(!logs.length){list.innerHTML=resourceEmpty("logs","暂无运行记录","生成、角色登记和错误信息会显示在这里。");return;}
    for(const row of [...logs].reverse()){
      const card=document.createElement('article');card.className='ad-log-entry';card.dataset.logId=String(row.id);card.taskRecord=row;
      const button=document.createElement('button');button.type='button';button.className='city-log-open';button.setAttribute('aria-haspopup','dialog');
      button.innerHTML='<i class="city-log-icon" aria-hidden="true"></i><span class="city-log-copy"><strong>'+esc(row.title)+'</strong><time>'+esc(logTime(row))+'</time></span><span class="ad-log-badge" data-status="'+esc(row.status)+'">'+esc(taskStatuses[row.status]||'进行中')+'</span>';
      button.onclick=()=>{selectedLog=row;$('ad-log-detail-feedback').textContent='';renderLogDetail(row);$('ad-log-detail').querySelector('.ad-log-detail-body').scrollTop=0;show('ad-log-detail');};
      card.append(button);list.append(card);
      if(focused===row)button.focus({preventScroll:true});
    }
    if($('ad-log-detail').open&&selectedLog)renderLogDetail(selectedLog);
  }
    function writeLog(event){
    let value,key,phase,title,diagnostics;
    if(event.type==='activity'){value=event.task||event.activity;if(!value?.operationId||String(value.operationId).startsWith('restored:'))return;phase=value.phase;if(!taskStatuses[phase])return;key=value.operationId;title=value.taskType||'生成画面';diagnostics=value.diagnostics;}
    else if(event.type==='record'){const r=event.record;if(!r||!['queued','ready','generating','failed','uncertain'].includes(r.status)&&!event.imageCompleted)return;value={messageId:event.messageId,requestId:r.requestId,chatId:r.chatId,error:r.error,warning:r.warning};key=r.jobId||'text:'+r.generationId;phase=event.imageCompleted?'done':r.status;title='生成画面';const image=r.images?.find(i=>i.id===r.currentImageId)||r.images?.at(-1);diagnostics={seedVerification:image?.seedVerification||{status:image?.seed==null?'not-returned':image.seed===image.requestedSeed?'matched':'mismatch',requestedSeed:image?.requestedSeed??null,returnedSeed:image?.seed??null,source:image?.seedSource||null},requestAudit:image?.requestAudit,metadataStorage:image?.metadata?.metadataStorage,budgetAudit:event.imageCompleted?image?.budgetAudit:r.budgetAudit,timings:r.timings,errorSource:r.errorSource,errorCode:r.errorCode,errorStatus:r.errorStatus,errorDetail:r.errorDetail,verification:image?.verification,providerFields:image?.providerFields};}
    else if(event.type==='registration'){const job=event.job;if(!job?.id)return;value={messageId:job.sourceMessageId,error:job.error};key=job.id;phase=job.status;title='登记角色 · '+job.name;}
    else if(event.type==='closed'){for(const row of logs)if(!row.finishedAt){row.status='cancelled';row.finishedAt=row.updatedAt=Date.now();row.stages.push({phase:'cancelled',at:row.finishedAt});}return;}
    else return;
    const chat=String(value.chatId||''),now=Date.now();let row=logs.find(r=>r.keys.includes(key)&&(!chat||!r.chatId||chat===r.chatId));
    if(!row&&value.requestId&&!String(key).startsWith('text:'))row=[...logs].reverse().find(r=>r.requestId===value.requestId&&!r.imageJobId&&!r.finishedAt&&(!chat||!r.chatId||chat===r.chatId));
    if(!row){row={id:++logSequence,keys:[],title,startedAt:now,updatedAt:now,status:phase,stages:[]};logs.push(row);if(logs.length>80)logs.shift();}
    if(!row.keys.includes(key))row.keys.push(key);if(String(key).startsWith('image_'))row.imageJobId=key;if(value.taskType||event.type==='registration')row.title=title;row.chatId=chat||row.chatId||'';row.requestId=value.requestId||row.requestId||'';row.messageId=value.messageId||row.messageId||'';row.updatedAt=now;row.status=phase;row.error=phase==='done'?'':value.error||row.error||'';if(value.warning!==undefined)row.warning=value.warning;if(diagnostics)row.diagnostics=diagnostics;if(row.stages.at(-1)?.phase!==phase){row.stages.push({phase,at:now});if(row.stages.length>20)row.stages.shift();}if(['done','failed','cancelled','uncertain'].includes(phase))row.finishedAt=now;else delete row.finishedAt;if(!$('ad-log-list').closest('[data-ad-page]').hidden)renderLogs();
  }

  function closeStage(){renderEpoch++;contextEpoch++;historyViewerContext=null;historySessionContext=null;dock.hidden=true;viewer=false;motionPlaying=false;viewerMotionPlaying=false;if($('addock-fullview').open)$('addock-fullview').close();$('addock-fullview').hidden=true;for(const id of ['addock-main-image','addock-motion-image','addock-fullview-image','addock-fullview-motion-image'])memory?.clear($(id));$('addock-thumbs').querySelectorAll('img').forEach(n=>memory?.clear(n));lastImage='';lastMotionImage='';lastViewerImage='';lastViewerMotionImage='';thumbSignature='';}
  function paintRecoveryPlaceholder(state){
    if(!$('addock-placeholder-text'))return;
    const busy=!!state?.busy,failed=record?.status==='failed'&&!record?.plan&&!(record?.images?.length);
    $('addock-placeholder-text').textContent=busy?(state.label||'正在准备画面'):record?.status==='uncertain'?'生成结果待确认':failed?'生成未完成':'暂无图片';
    $('addock-placeholder-hint').textContent=busy?(state.hint||'正在处理当前任务。'):failed&&canSupplementBody?'本轮画面方案不完整。可点击「＋」补图，或重新生成本轮对话。':record?.error||(record?.plan?'点击新增，生成一张新画面':canRecoverPlan?'点击新增，恢复本轮已有的画面方案。':canSupplementBody?'点击新增，从这条已生成的正文补充画面。':'设定下一轮导演后，发送消息开始。');
    $('addock-status').textContent=busy?'正在处理当前任务，之前的失败提示已暂时收起':(recordFailureAcknowledged()?'':record?.error)||'';
  }
  async function refreshRecoveryAvailability(messageId,recordSnapshot){
    const target=String(messageId||'');if(!target||!app)return;
    const [message,latest]=await Promise.all([app.getMessage(target),app.readRecord(target)]);
    if(disposed||String(mid)!==target)return;
    record=latest||recordSnapshot||record;
    const raw=String(message?.content||message?.text||''),emptyVisual=!record?.plan&&!(record?.images?.length)&&!['queued','generating'].includes(record?.status),failed=!!core.readFailure(raw);
    canRecoverPlan=emptyVisual&&!failed&&(/<ad-visual\b/i.test(raw)||!!core.readSaved(raw));
    canSupplementBody=emptyVisual&&!canRecoverPlan&&!!core.storyText(raw);
    await render();
  }
  async function loadRecord(id,keepSelection=false){
    if(!app)return;const epoch=++renderEpoch;const [next,message]=await Promise.all([app.readRecord(id),app.getMessage(id)]);if(disposed||epoch!==renderEpoch||(follow&&String(id)!==currentCardMessage()))return;
    const before=active()?.id;if(String(id)!==mid){displayError='';displayLoading=false;}mid=String(id);record=next;const raw=String(message?.content||message?.text||''),story=core.storyText(raw),emptyVisual=!record?.plan&&!(record?.images?.length)&&!['queued','generating'].includes(record?.status);canRecoverPlan=emptyVisual&&!core.readFailure(raw)&&(/<ad-visual\b/i.test(raw)||!!core.readSaved(raw));canSupplementBody=emptyVisual&&!canRecoverPlan&&!!story;imageIndex=keepSelection?Math.max(0,record?.images?.findIndex(x=>x.id===before)||0):Math.max(0,record?.images?.findIndex(x=>x.id===record?.currentImageId)??-1);await render();
  }
  function clearCardRecord(){
    renderEpoch++;mid='';record=null;imageIndex=0;canSupplementBody=false;canRecoverPlan=false;displayError='';displayLoading=false;
    return render();
  }
  function followCurrentReply(){
    if(!follow)return;
    const latest=currentCardMessage();
    if(latest===mid)return;
    return latest?loadRecord(latest):clearCardRecord();
  }
  async function openStage(id){const context=++contextEpoch;historyViewerContext=null;historySessionContext=null;if(viewer)closeViewer(false);dismissEditing();if(!app){status('导演运行时尚未就绪');return;}const snapshot=app.snapshot();if(snapshot.activity?.phase==='uncertain'&&!snapshot.pending)app.acknowledgeUncertain(snapshot.chatId,uncertainKey(snapshot.chatId,snapshot.activity));hide('ad-settings');dock.hidden=false;dock.dataset.view='current';$('addock-story-body').hidden=true;$('addock-detail-return').hidden=true;dock.dataset.mobilePhoto='true';dock.dataset.size='normal';sizeStage();follow=!id;paintState();if(follow)await app.readCurrentReply();if(disposed||context!==contextEpoch)return;const wanted=id||currentCardMessage();if(wanted)await loadRecord(wanted);else await clearCardRecord();}
  async function render(){
    if(disposed)return;paintState();if(dock.hidden)return;const registered=app.snapshot().profiles.some(p=>p.sourceImageId===active()?.id&&String(p.sourceMessageId)===mid);$('addock-dna-open').dataset.registered=String(registered);$('addock-dna-open').title=registered?'已登记 · 再次登记':'登记角色';const item=active(),busy=['queued','generating'].includes(record?.status);$('addock-round-label').textContent=mid?'回复 '+mid:'当前回复';
    const generate=$('addock-generate'),add=$('addock-add'),hasMotion=!!item?.motion?.sourcePointer,hasMotionOrigin=motionOrigin(item),action=record?.recoverableImage?'recover':item?'reroll':'new',failedWithoutImage=record?.status==='failed'&&!item;generate.hidden=hasMotionOrigin;add.hidden=hasMotionOrigin;generate.dataset.motionOrigin=String(hasMotionOrigin);add.dataset.motionOrigin=String(hasMotionOrigin);generate.dataset.actionState=action;generate.title=generate.ariaLabel=action==='recover'?'恢复已返回图片':failedWithoutImage?'重试图片生成':'重抽当前画面（固定 Seed 可对照不同画风和参数）';generate.querySelector('.addock-action-caption').textContent=action==='recover'?'恢复':failedWithoutImage?'重试':'重抽';
    const images=stageImages(),count=images.length,page=images.indexOf(item)+1;for(const id of ['addock-count','addock-fullview-count']){const node=$(id);node.hidden=count<2;node.textContent=count>1?page+' / '+count:'';if(id==='addock-count'&&count>1){const label=document.createElement('span'),slash=document.createElement('span');slash.className='ad-count-separator';slash.textContent=' / ';label.append(document.createTextNode(String(page)),slash,document.createTextNode(String(count)));node.replaceChildren(label);}node.setAttribute('aria-label',count>1?'第 '+page+' 张，共 '+count+' 张':'');}
    if(item?.id!==selectedImageId){selectedImageId=item?.id||'';motionPlaying=false;viewerMotionPlaying=false;}
    syncMotionControls();
    $('addock-placeholder').hidden=!!item;$('addock-main-image').hidden=!item;$('addock-motion-image').hidden=!(motionPlaying&&hasMotion);$('addock-motion-play').hidden=!hasMotion;$('addock-motion-play').setAttribute('aria-label',motionPlaying?'查看静态图片':'播放动态');$('addock-motion-play').title=motionPlaying?'查看静态图片':'播放动态';$('addock-motion-play').querySelector('span').textContent=motionPlaying?'查看静态':'播放动态';$('addock-motion-play').querySelector('svg').innerHTML=motionPlaying?'<path d="M7 5h3v14H7zM14 5h3v14h-3z"/>':'<path d="M8 5.5v13l10-6.5z"/>';
    $('addock-ui-status').hidden=true;$('addock-prev').hidden=$('addock-next').hidden=count<2;$('addock-dna-open').hidden=!item||item.kind!=='character_intro';$('addock-tune').hidden=!supportsImageEditing(item);$('addock-motion').hidden=!supportsMotionRequest(item,record?.kind);
    $('addock-keep').disabled=!item;$('addock-keep').title='删除图片';$('addock-status').textContent=busy?'图片任务处理中，收起面板仍继续；阶段耗时见记录':(recordFailureAcknowledged()?'':record?.error)||'';
    if(!item){renderEpoch++;displayError='';displayLoading=false;motionPlaying=false;viewerMotionPlaying=false;for(const id of ['addock-main-image','addock-motion-image','addock-fullview-image','addock-fullview-motion-image'])memory?.clear($(id));$('addock-motion-play').hidden=true;$('addock-fullview-motion-play').hidden=true;if(viewer)closeViewer(false);lastImage='';lastMotionImage='';lastViewerImage='';lastViewerMotionImage='';paintState();return;}
    const current=++renderEpoch;
    try{
      const mainPointer=item.pointer,motionPointer=motionPlaying&&hasMotion?item.motion.sourcePointer:'';
      if(mainPointer!==lastImage){memory?.clear($('addock-main-image'));displayError='';displayLoading=true;paintState();const src=await app.imageUrl(mainPointer);if(disposed||current!==renderEpoch||dock.hidden)return;lastImage=mainPointer;fallbackAttempts.delete($('addock-main-image'));await memory.set($('addock-main-image'),src,'stage');}
      if(motionPointer!==lastMotionImage){memory?.clear($('addock-motion-image'));lastMotionImage=motionPointer;if(motionPointer){displayLoading=true;paintState();const src=await app.imageUrl(motionPointer);if(disposed||current!==renderEpoch||dock.hidden)return;fallbackAttempts.delete($('addock-motion-image'));await memory.set($('addock-motion-image'),src,'stage');}else $('addock-motion-image').hidden=true;}

      if(current!==renderEpoch||disposed||dock.hidden)return;
      $('addock-motion-image').hidden=!(motionPlaying&&hasMotion);displayLoading=false;paintState();
      if(viewer){
        $('addock-fullview-seed').hidden=false;$('addock-fullview-seed').disabled=item.seed===null||item.seed===undefined||item.seed==='';$('addock-fullview-seed').title=$('addock-fullview-seed').disabled?'本图未返回 Seed':'收藏种子';for(const id of ['addock-fullview-prev','addock-fullview-next']){$(id).hidden=count<2;$(id).disabled=count<2;}
        $('addock-fullview-motion-play').hidden=!hasMotion;$('addock-fullview-motion-play').textContent=viewerMotionPlaying?'查看静态':'播放动态';$('addock-fullview-motion-play').setAttribute('aria-label',viewerMotionPlaying?'查看静态图片':'播放动态');
        const viewerPointer=item.pointer,viewerOverlayPointer=viewerMotionPlaying&&hasMotion?item.motion.sourcePointer:'';
        if(viewerPointer!==lastViewerImage){memory?.clear($('addock-fullview-image'));const src=await app.imageUrl(viewerPointer);if(current!==renderEpoch||disposed)return;lastViewerImage=viewerPointer;fallbackAttempts.delete($('addock-fullview-image'));await memory.set($('addock-fullview-image'),src,'viewer');}
        if(viewerOverlayPointer!==lastViewerMotionImage){memory?.clear($('addock-fullview-motion-image'));lastViewerMotionImage=viewerOverlayPointer;if(viewerOverlayPointer){const src=await app.imageUrl(viewerOverlayPointer);if(current!==renderEpoch||disposed)return;fallbackAttempts.delete($('addock-fullview-motion-image'));await memory.set($('addock-fullview-motion-image'),src,'viewer');}else $('addock-fullview-motion-image').hidden=true;}
        $('addock-fullview-motion-image').hidden=!(viewerMotionPlaying&&hasMotion);paintState();$('addock-fullview-count').textContent=$('addock-count').textContent;transform();
      }
    }catch(error){if(current===renderEpoch&&!disposed){displayLoading=false;displayError=error.message;lastImage='';paintState();status('图片读取未完成：'+error.message);}}
  }
  async function move(delta){const images=stageImages();if(images.length<2)return;const target=images[(images.indexOf(active())+delta+images.length)%images.length];imageIndex=record.images.findIndex(image=>image.id===target.id);zoom=1;pan={x:0,y:0};lastTap=0;motionPlaying=false;viewerMotionPlaying=false;transform();await render();}
  async function openViewer(){const item=active();if(!item)return;viewer=true;viewerMotionPlaying=motionPlaying;motionPlaying=false;dock.hidden=false;$('addock-fullview').hidden=false;if(!$('addock-fullview').open)openDialog($('addock-fullview'));$('addock-fullview-return-label').textContent=$('ad-settings').open?'返回角色档案':reader?.isOpen()?'返回历史详情':'返回卡片';$('addock-fullview-backdrop').removeAttribute('src');$('addock-fullview-seed').hidden=false;$('addock-fullview-seed').disabled=item.seed===null||item.seed===undefined||item.seed==='';$('addock-fullview-seed').title=$('addock-fullview-seed').disabled?'本图未返回 Seed':'收藏种子';zoom=1;pan={x:0,y:0};transform();await render();}
  function closeViewer(restoreContext=true){exportNotice=null;const saved=historyViewerContext;historyViewerContext=null;viewer=false;viewerMotionPlaying=false;if($('addock-fullview').open)$('addock-fullview').close();$('addock-fullview').hidden=true;memory.clear($('addock-fullview-image'));memory.clear($('addock-fullview-motion-image'));lastViewerImage='';lastViewerMotionImage='';zoom=1;pan={x:0,y:0};transform();if($('ad-settings').open&&profileEditing)profilePicture($('ad-profile-portrait'),profileEditing,profileEpoch)();if(saved&&restoreContext)restoreCardContext(saved).catch(handleUiError);}
  function transform(){if($('addock-zoom-reset'))$('addock-zoom-reset').textContent=Math.round(zoom*100)+'%';const value='translate('+pan.x+'px,'+pan.y+'px) scale('+zoom+')';$('addock-fullview-image').style.transform=value;$('addock-fullview-motion-image').style.transform=value;}
  async function recoverDisplay(img,role){
    const item=active();
    if(!item||disposed)return;
    const isMotionOverlay=img.id==='addock-motion-image'||img.id==='addock-fullview-motion-image';
    const pointer=isMotionOverlay?item.motion?.sourcePointer:item.pointer;
    if(!pointer)return;
    if(fallbackAttempts.get(img)===pointer){
      img.hidden=true;
      if(role==='stage'){
        $('addock-placeholder').hidden=false;
        $('addock-placeholder-text').textContent='图片文件暂时无法显示';
        $('addock-placeholder-hint').textContent='已保留生成记录，不会自动重新生图';
      }
      displayLoading=false;displayError='图片文件解码失败，生成记录已保留';paintState();status(displayError);return;
    }
    fallbackAttempts.set(img,pointer);
    try{
      const data=await app.imageUrl(pointer,true),current=active();
      const expected=current&&(isMotionOverlay?current.motion?.sourcePointer:current.pointer);
      if(disposed||dock.hidden||expected!==pointer)return;
      await memory.set(img,data,role);
    }catch(error){
      const current=active(),expected=current&&(isMotionOverlay?current.motion?.sourcePointer:current.pointer);
      if(expected===pointer){
        img.hidden=true;
        if(role==='stage'){
          $('addock-placeholder').hidden=false;
          $('addock-placeholder-text').textContent='图片已生成，读取失败';
          $('addock-placeholder-hint').textContent=error.message;
        }
        status(error.message);
      }
    }
  }
  for(const [id,role] of [['addock-main-image','stage'],['addock-motion-image','stage'],['addock-fullview-image','viewer'],['addock-fullview-motion-image','viewer']]){bind($(id),'error',()=>recoverDisplay($(id),role));bind($(id),'load',()=>{if(active()&&$(id).naturalWidth>0){displayError='';$(id).hidden=id==='addock-motion-image'?!motionPlaying:id==='addock-fullview-motion-image'?!viewerMotionPlaying:false;if(role==='stage')$('addock-placeholder').hidden=true;}});}
  function captureCardContext(){return {messageId:mid,imageId:active()?.id||'',currentImageId:record?.currentImageId,follow,hidden:dock.hidden,view:dock.dataset.view,mobilePhoto:dock.dataset.mobilePhoto,size:dock.dataset.size,motionPlaying,selectedImageId};}
  async function restoreCardContext(saved){
    if(!saved||disposed)return;const epoch=++contextEpoch;renderEpoch++;dock.hidden=true;
    let target,next,savedMessage;
    try{
      do{
        target=saved.follow?currentCardMessage():saved.messageId;
        [next,savedMessage]=target?await Promise.all([app.readRecord(target),app.getMessage(target)]):[null,null];
        if(disposed||epoch!==contextEpoch)return;
      }while(saved.follow&&target!==currentCardMessage());
    }catch(error){if(disposed||epoch!==contextEpoch)return;throw error;}
    follow=saved.follow;mid=String(target||'');record=next;const savedRaw=String(savedMessage?.content||savedMessage?.text||''),emptyVisual=!next?.plan&&!(next?.images?.length)&&!['queued','generating'].includes(next?.status);canRecoverPlan=emptyVisual&&!core.readFailure(savedRaw)&&(/<ad-visual\b/i.test(savedRaw)||!!core.readSaved(savedRaw));canSupplementBody=emptyVisual&&!canRecoverPlan&&!!core.storyText(savedRaw);
    const desired=target===saved.messageId&&next?.currentImageId===saved.currentImageId?saved.imageId:next?.currentImageId;const at=next?.images?.findIndex(i=>i.id===desired)??-1;imageIndex=at>=0?at:Math.max(0,next?.images?.findIndex(i=>i.id===next.currentImageId)??0);
    for(const name of ['view','mobilePhoto','size']){if(saved[name]===undefined)delete dock.dataset[name];else dock.dataset[name]=saved[name];}
    motionPlaying=saved.motionPlaying;selectedImageId=saved.selectedImageId;lastImage='';lastMotionImage='';displayError='';displayLoading=false;dock.hidden=saved.hidden;
    if(!dock.hidden)await render();else paintState();
  }
  function captureSettingsStageContext(){
    if(dock.hidden||viewer||reader?.isOpen()||!['current','detail'].includes(dock.dataset.view))return null;
    return {...captureCardContext(),latestMessageId:String(app?.snapshot().latestMessageId||'')};
  }
  async function restoreSettingsStage(saved){
    if(!saved||disposed||dock.hidden||!app)return;
    const latest=currentCardMessage();
    const target=saved.follow?latest:saved.messageId;
    if(!target){await clearCardRecord();return;}
    if(saved.follow&&latest&&latest!==String(saved.latestMessageId||saved.messageId)){await loadRecord(latest);return;}
    const next=await app.readRecord(target);
    if(disposed||dock.hidden)return;
    if(saved.follow&&currentCardMessage()!==target){await followCurrentReply();return;}
    if(next?.images?.length){
      mid=String(target);record=next;canSupplementBody=false;canRecoverPlan=false;
      const desired=saved.imageId&&next.images.some(i=>i.id===saved.imageId)?saved.imageId:next.currentImageId||next.images.at(-1)?.id;
      const at=next.images.findIndex(i=>i.id===desired);imageIndex=at>=0?at:0;
    }else if(String(target)!==String(mid)||!record?.images?.length){mid=String(target);record=next;imageIndex=0;const savedMessage=await app.getMessage(target);const savedRaw=String(savedMessage?.content||savedMessage?.text||''),emptyVisual=!next?.plan&&!(next?.images?.length)&&!['queued','generating'].includes(next?.status);canRecoverPlan=emptyVisual&&!core.readFailure(savedRaw)&&(/<ad-visual\b/i.test(savedRaw)||!!core.readSaved(savedRaw));canSupplementBody=emptyVisual&&!canRecoverPlan&&!!core.storyText(savedRaw);}
    displayError='';displayLoading=false;await render();
  }
  function beginHistorySession(){if(!reader?.isOpen())historySessionContext=captureCardContext();}
  async function openReader(id){beginHistorySession();return reader?.open(id);}
  function closeHistorySession(){const saved=historySessionContext;historySessionContext=null;if(viewer)closeViewer(false);if(saved)restoreCardContext(saved).catch(handleUiError);else closeStage();}
  async function performReaderAction(action,messageId,imageId){
    if(action==='supplement'){openSupplement(messageId);return;}
    if(['add','reroll','tune','motion'].includes(action)){
      const target=await app.readRecord(messageId),selected=target?.images?.find(i=>i.id===imageId),canEdit=supportsImageEditing(selected);
      if(motionOrigin(selected,target?.images||[])&&['add','reroll'].includes(action))return;
      if(action==='add')return app.generate(messageId,true,imageId);
      if(action==='reroll')return target?.recoverableImage?app.recover(messageId):app.generate(messageId,true,imageId,null,imageId?'replace':'append');
      if(action==='tune'&&!canEdit)return;
      if(action==='motion'&&!supportsMotionRequest(selected,target?.kind))return;
    }
    const saved=captureCardContext(),epoch=++contextEpoch;let keepViewer=false;follow=false;
    try{
      await loadRecord(messageId);if(disposed||epoch!==contextEpoch)return;
      const selectedIndex=record?.images?.findIndex(i=>i.id===imageId)??-1;
      if(action==='register'&&selectedIndex<0)throw Error('所选人物图已不存在，请重新选择后登记');
      imageIndex=Math.max(0,selectedIndex);dock.hidden=false;await render();
      if(disposed||epoch!==contextEpoch)return;
      if(action==='viewer'){historyViewerContext=saved;await openViewer();keepViewer=viewer;}
      else{const id={tune:'addock-tune',motion:'addock-motion',register:'addock-dna-open',delete:'addock-keep'}[action];if(id)$(id).click();}
    }finally{if(!keepViewer&&epoch===contextEpoch){if(historyViewerContext===saved)historyViewerContext=null;await restoreCardContext(saved);}}
  }
  async function openHistory(){dismissEditing();beginHistorySession();if(reader)await reader.openCatalog(mid||app.snapshot().latestMessageId);}
  function nextDialog(kind){if(!app)return;requestKind=kind==='character_intro'?'character_intro':'story_cg';const character=requestKind==='character_intro';$('ad-next-form').reset();$('ad-target').value='';$('ad-form').value='默认形态';$('ad-request-label').textContent=character?'人物特征调整 · 可选':'画面要求 · 可选';$('ad-request').placeholder=character?'例如：头发改成短发、气质更成熟、眉形更明显；留空按角色设定设计':'留空由导演根据剧情决定';$('ad-request-hint').textContent=character?'主要用于调整人物外貌与气质，也可补充姿势、服装或镜头要求。':'可指定场景、动作或镜头；留空自动导演。';$('ad-target-row').hidden=$('ad-form-row').hidden=!character;$('ad-target').required=character;$('ad-target').disabled=$('ad-form').disabled=!character;$('ad-next-title').textContent=character?'设计人物外观':'导演下一幕';$('ad-request').value='';$('ad-next-error').textContent='';const s=app.snapshot();document.querySelectorAll('[name=ad-shot]').forEach(n=>n.checked=n.value===s.config.shot);show('ad-next');}
  function selectOptions(node,values,current){node.replaceChildren();for(const value of values){const option=document.createElement('option');option.value=value.id;option.textContent=value.name;node.append(option);}node.value=current||values[0]?.id||'';}

  let relayReturn='settings',connectionProvider='thirdparty',motionParameters={},motionConnectionUrl='',motionConnectionConfigured=false,motionSettingsReady=false,motionSettingsLoadEpoch=0,motionSaveTimer=0,motionSaveRevision=0,motionSaveQueue=Promise.resolve(),motionLastSavedSignature='';
  function motionFieldVisibility(){}
  function readMotionFields(){return {...motionParameters,strength:readMotionStrength(),noise:Number($('local-noise').value),noiseSchedule:$('local-schedule').value.toLowerCase(),seedMode:'source',sizeMode:'source'};}
  function readMotionStrength(){
    const input=$('local-strength'),value=input.valueAsNumber;
    if(!Number.isFinite(value))return motionParameters.strength??0.85;
    return Number(Math.max(Number(input.min),Math.min(Number(input.max),value)).toFixed(2));
  }
  function motionParameterSignature(value){return JSON.stringify(value);}
  function syncSizePresets(){const value=$('studio-width').value+','+$('studio-height').value;document.querySelectorAll('[data-studio-size]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.studioSize===value)));}
  function staticConnectionState(state){const node=$('studio-static-connection-state');node.dataset.state=state;node.textContent=({saved:'已保存',dirty:'待保存',saving:'保存中…',error:'保存失败',unchanged:'未修改',empty:'未配置'})[state];$('local-relay-key').dataset.connectionState=state;}
  function motionConnectionState(state){const node=$('studio-motion-connection-state');node.dataset.state=state;node.textContent=({saved:'已保存',dirty:'待保存',saving:'保存中…',error:'保存失败',unchanged:'未修改',empty:'未配置'})[state];$('local-motion-key').dataset.connectionState=state;}
  function updateMotionConnectionDirty(){const changed=$('local-motion-url').value.trim()!==motionConnectionUrl||!!$('local-motion-key').value.trim();motionConnectionState(changed?'dirty':motionConnectionConfigured?'unchanged':'empty');}
  function officialAddressFeedback(kind){if(kind==='static')staticConnectionState('dirty');else motionConnectionState('dirty');const motion=kind==='motion',input=$(motion?'local-motion-url':'local-relay-url'),button=$(motion?'local-motion-official':'local-use-official');input.classList.add('studio-address-filled');button.textContent='✓ 已填入';status(motion?'已填入 NAI 官方地址，填写 API Key 后自动保存':'已填入 NAI 官方地址，保存后生效');clearTimeout(button._feedbackTimer);button._feedbackTimer=setTimeout(()=>{input.classList.remove('studio-address-filled');button.textContent='填入官方地址';},2200);}
  function directorVisibility(){
    const cfg=app.snapshot().config,generic=genericModeSelected(cfg),service=generic?'generic':cfg.imageService||(cfg.format==='nai45'?'official':'generic');
    $('ad-format').value=generic?'generic':'nai45';$('local-ratio').hidden=!generic;$('local-official-size').hidden=true;$('local-relay-entry').hidden=generic;$('local-connection-title').textContent='NAI 4.5 Full API 配置';$('local-width').value=cfg.width||1216;$('local-height').value=cfg.height||832;
    syncNaiOnlyNavigation(generic);
    if(generic){if($('addock-motion-dialog').open)hide('addock-motion-dialog');if($('addock-tune-dialog').open)hide('addock-tune-dialog');}
    const frameOpen=!$('studio-frame-panel').hidden,paramsOpen=!$('local-relay-page').hidden&&$('local-relay-page').dataset.filmView==='params';
    if(generic&&($('ad-settings').dataset.currentPage==='api'||frameOpen||paramsOpen))page('settings');
    const heading=document.querySelector('[data-ad-page="settings"] .ad-seed-heading');/* Help copy belongs below the Seed input, not inside the heading. */$('local-seed-hint').hidden=false;
  }
  function syncMotionConnection(connection,clearKey=true,state='unchanged'){
    motionConnectionUrl=connection.url;
    motionConnectionConfigured=!!connection.configured;
    $('local-motion-url').value=connection.url;
    const key=$('local-motion-key');
    if(clearKey)key.value='';
    key.placeholder=connection.configured?'已保存；填写新密钥可替换':'填写 API Key';
    motionConnectionState(state);
  }
  async function refreshOfficialApi(provider){
    const epoch=++motionSettingsLoadEpoch;motionSettingsReady=false;motionConnectionState('unchanged');
    await motionSaveQueue;
    if(epoch!==motionSettingsLoadEpoch)return;
    try{
      const connection=await app.motionConnectionStatus();if(epoch!==motionSettingsLoadEpoch)return;syncMotionConnection(connection);
      const result=await app.officialApiStatus(provider),p=result.parameters;if(epoch!==motionSettingsLoadEpoch)return;
      motionParameters=p;$('local-motion-provider').value=result.provider==='thirdparty'?'relay':'official';$('local-official-connect').hidden=true;$('local-official-link').hidden=result.provider!=='official';$('local-relay-connect').hidden=result.provider!=='thirdparty';const key=document.querySelector('#local-official-connect input');key.value='';key.placeholder=result.configured?'已保存；填写新密钥可替换':'填写 API Key';$('local-strength').value=Number(p.strength).toFixed(2);$('local-noise').value=p.noise;const names={exponential:'Exponential',native:'Native',karras:'Karras',polyexponential:'Polyexponential'};$('local-schedule').value=names[p.noiseSchedule]||'Exponential';motionLastSavedSignature=motionParameterSignature(readMotionFields());
    }finally{if(epoch===motionSettingsLoadEpoch)motionSettingsReady=true;}
  }
  let relayLoadEpoch=0;
  async function openRelay(from,provider,view="connection"){connectionProvider=provider||(from==='api'?($('local-motion-provider').value==='official'?'official':'thirdparty'):(app.snapshot().config.imageService==='official'?'official':'thirdparty'));relayReturn=from;page('settings');const epoch=relayLoadEpoch;const relay=$('local-relay-page');relay.dataset.filmView=view;if(view==='params')$('local-static-advanced').closest('details').open=true;$('local-director-main').hidden=true;relay.hidden=false;$('ad-settings').dataset.studioView='detail';studioUpdateHeading();const data=await app.generationSettings(),r=data.relay;if(epoch!==relayLoadEpoch)return;connectionProvider=data.connection.provider;$('local-connection-heading').textContent='NAI 4.5 Full API';$('local-relay-url').value=data.connection.url;$('local-relay-key').value='';$('local-relay-key').placeholder=data.connection.configured?'已保存；填写新密钥可替换':'填写 API Key';staticConnectionState('unchanged');$('local-relay-width').value=r.width;$('local-relay-height').value=r.height;const fields=$('local-static-advanced').querySelectorAll('input');fields[0].value=r.steps;fields[1].value=r.scale;const sampler=$('local-static-advanced').querySelector('select');sampler.value=r.sampler;$('ad-workspace-content').scrollTo(0,0);}
  function page(name,preserveMotionProvider=false,panel="home"){if(name==='api'&&genericModeSelected())name='settings';if(name==='settings'&&genericModeSelected()&&panel!=='home')panel='home';relayLoadEpoch++;flushStyleDraft();clearSettingsNotice();const previousPage=$('ad-settings').dataset.currentPage;$('film-quick').close();$('local-relay-page').removeAttribute('data-film-view');dismissEditing();const motionProvider=preserveMotionProvider&&name==='api'?($('local-motion-provider').value==='relay'?'thirdparty':'official'):null;document.querySelectorAll('#local-official-connect input[type=password],#local-relay-key,#local-motion-key').forEach(i=>i.value='');$('local-director-main').hidden=false;$('local-relay-page').hidden=true;if(name==='api')refreshOfficialApi(motionProvider||undefined).catch(e=>status(e.message));if(name!=='profiles'){releaseProfiles();$('ad-settings').dataset.profileEditing='false';}$('ad-settings').dataset.currentPage=name;document.querySelectorAll('#ad-tabs [data-page]').forEach(n=>n.setAttribute('aria-selected',String(n.dataset.page===name)));if(previousPage!==name)$('ad-workspace-content')?.scrollTo(0,0);document.querySelectorAll('[data-ad-page]').forEach(n=>n.hidden=n.dataset.adPage!==name);studioRoute(name,panel);if(name==='settings')directorVisibility();if(name==='profiles')renderProfiles();if(name==='styles')styleView(false);if(name==='seeds')renderSeeds();if(name==='logs')renderLogs();const tab=document.querySelector('#ad-tabs [data-page="'+name+'"]');if(matchMedia('(max-width:900px), (max-aspect-ratio:1/1)').matches)tab?.scrollIntoView({block:'nearest',inline:'nearest'});}
  let settingsFieldsDirty=true;
  function settingsDialog(name){
    if(!app)return;
    const validPages=['settings','resources','profiles','styles','seeds','api','logs','tutorial','tutorial-motion'];
    const remembered=$('ad-settings').dataset.currentPage||'settings';
    const resume=name===undefined&&$('ad-settings').dataset.studioVisited==='true'&&validPages.includes(remembered);
    let target=name===undefined?(validPages.includes(remembered)?remembered:'settings'):name;
    const s=app.snapshot(),cfg=s.config;if(genericModeSelected(cfg)&&target==='api')target='settings';
    if(!cfg.imageService){const change={imageService:cfg.format==='nai45'?'official':'generic',width:1216,height:832};Object.assign(cfg,change);app.saveConfig(change).catch(e=>status(e.message));}
    if(settingsFieldsDirty){$('ad-ratio').value=cfg.ratio;selectOptions($('ad-active-style'),app.availableStyles(),cfg.styleId);syncSeedControls(cfg,true);$('ad-auto-generate').checked=cfg.autoGenerate;$('ad-auto-expand').checked=cfg.autoExpand;settingsFieldsDirty=false;}
    // Do not overwrite unsaved style-editor input when simply reopening the dialog.
    if(target==='styles'&&(!resume||$('ad-style-editor').hidden))editStyle(s.styles.some(x=>x.id===styleEditing)?styleEditing:cfg.styleId,false);
    if(resume){
      if(target==='profiles'){
        if($('ad-profile-editor').hidden)renderProfiles();
        else if(profileEditing)profilePicture($('ad-profile-portrait'),profileEditing,profileEpoch)();
      }else if(target==='styles'&&$('ad-style-editor').hidden)renderStyleCards();
      else if(target==='seeds')renderSeeds();
      else if(target==='logs')renderLogs();
      studioUpdateHeading();
    }else page(target);
    $('ad-settings').dataset.studioVisited='true';
    if(!$('ad-settings').open)settingsStageContext=captureSettingsStageContext();
    show('ad-settings');
  }
  const trashIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
  let managementAction=null;
  function confirmManagement(title,description,action){$('ad-manage-title').textContent=title;$('ad-manage-description').textContent=description;$('ad-manage-error').hidden=true;managementAction=action;show('ad-manage-confirm');}
  bind($('ad-manage-cancel'),'click',()=>hide('ad-manage-confirm'));
  bind($('ad-manage-submit'),'click',async()=>{const button=$('ad-manage-submit');button.disabled=true;try{await managementAction?.();hide('ad-manage-confirm');}catch(error){$('ad-manage-error').textContent=error.message;$('ad-manage-error').hidden=false;}finally{button.disabled=false;}});
  function requestProfileDelete(p){confirmManagement('删除角色档案？',p.name+' · '+p.form+'：删除登记及对应服装状态。旧聊天和候选图片仍保留，但重新设计不再自动继承旧DNA。',async()=>{await app.deleteProfile(p);renderProfiles();status('角色档案已删除');});}
  bind($('ad-profile-delete'),'click',()=>{if(profileEditing)requestProfileDelete(profileEditing);});
  function requestStyleDelete(p){if(!p)return;confirmManagement('删除画风？','删除“'+p.name+'”。正在使用时会切换至当前格式下可用的默认画风。',async()=>{const wasEditing=!$('ad-style-editor').hidden&&styleEditing===p.id;await app.deleteStyle(p.id);if(wasEditing)styleView(false);else renderStyleCards();paintStyleSelection(app.snapshot().config.styleId);status('画风已删除');});}
  bind($('ad-style-delete'),'click',()=>requestStyleDelete(app.snapshot().styles.find(s=>s.id===styleEditing)));
  bind($('ad-style-restore'),'click',()=>confirmManagement('重置内置画风','仅恢复四款 NAI 4.5 内置画风的默认内容，并补回已删除的内置画风。你自建、复制和导入的画风会全部保留，不会删除或重置；通用基础模板也保持不变。对四款内置画风本身的修改会被覆盖，如需保留请先复制。',async()=>{await app.restoreDefaultStyles();settingsDialog('styles');styleView(false);status('四款内置画风已恢复，你的自建画风已保留');}));
  bind($('ad-profile-portrait'),'click',async()=>{const p=profileEditing,epoch=profileEpoch;if(!p)return;const rec=await app.readRecord(p.sourceMessageId),source=rec?.images?.find(i=>i.id===p.sourceImageId);if(!source?.pointer)throw Error('登记画面已不可用');if(epoch!==profileEpoch||disposed)return;await performReaderAction('viewer',p.sourceMessageId,source.id);});
  let styleBrowseScroll=0;
  function styleView(editing){if(!editing)flushStyleDraft();const content=$('ad-workspace-content'),wasEditing=!$('ad-style-editor').hidden;if(editing&&!wasEditing)styleBrowseScroll=content.scrollTop;$('ad-style-browse').hidden=editing;$('ad-style-editor').hidden=!editing;$('ad-style-library-toolbar').hidden=editing;if(!editing)renderStyleCards();if(wasEditing!==editing)content.scrollTop=editing?0:styleBrowseScroll;}
  function studioCanonicalStyle(style){
    const canonical=studioDefaultStyles.find(p=>p.id===style.id);
    if(!canonical)return false;
    const prompt=value=>String(value??'').trim().replace(/\s*,\s*/g,',');
    return ['name','format','basis','useNegative'].every(key=>String(style[key]??'')===String(canonical[key]??''))
      &&['positive','negative'].every(key=>prompt(style[key])===prompt(canonical[key]));
  }
  function studioBuiltinCover(style){
    if(!studioCanonicalStyle(style))return '';
    return studioCoverCatalog[style.id]||'';
  }
  function studioStyleArtwork(style){
    const cover=style.cover||studioBuiltinCover(style);if(cover)return '<img class="studio-preset-cover" src="'+esc(cover)+'" alt="" aria-hidden="true"><span class="studio-preset-kind">内置画风 · 示意封面</span>';
    return '';
  }
  let styleSelectionRevision=0,styleSelectionQueue=Promise.resolve();
  function paintStyleSelection(id){for(const card of $('ad-style-cards').querySelectorAll('.ad-style-preset-card')){const selected=card.dataset.styleId===id;if(card.dataset.active!==String(selected))card.dataset.active=String(selected);if(selected){if(card.getAttribute('aria-current')!=='true')card.setAttribute('aria-current','true');}else if(card.hasAttribute('aria-current'))card.removeAttribute('aria-current');}$('ad-active-style').value=id;}
  function selectStyleCard(id,name){if($('ad-style-cards').querySelector('.ad-style-preset-card[data-active=true]')?.dataset.styleId===id)return;const revision=++styleSelectionRevision;paintStyleSelection(id);styleSelectionQueue=styleSelectionQueue.then(async()=>{try{await app.saveConfig({styleId:id});if(revision!==styleSelectionRevision)return;styleEditing=id;paintStyleSelection(app.snapshot().config.styleId);status('已使用画风：'+name);}catch(error){if(revision===styleSelectionRevision){paintStyleSelection(app.snapshot().config.styleId);status(error.message);}}});return styleSelectionQueue;}
  function resourceEmpty(kind,title,copy){
    return '<div class="ad-resource-empty" data-kind="'+kind+'"><span class="ad-resource-empty-mark" aria-hidden="true"></span><strong>'+title+'</strong><p>'+copy+'</p></div>';
  }
  function renderStyleCards(){const list=$('ad-style-cards'),s=app.snapshot(),scope=$('ad-style-scope'),rows=scope.value==='all'?s.styles:app.availableStyles();$('city-style-scope').textContent=scope.selectedOptions[0].textContent;$('ad-style-current-format').textContent='当前：'+(s.config.format==='nai45'?'NAI 4.5':'通用');list.replaceChildren();if(!rows.length){list.innerHTML=resourceEmpty("styles","此范围暂无画风","可新建或导入画风，也可以切换显示范围。");return;}rows.forEach((p,i)=>{const wrapper=document.createElement('div');wrapper.className='ad-style-preset';const card=document.createElement('button');card.type='button';card.className='ad-style-preset-card';card.dataset.styleId=p.id;wrapper.dataset.coverKind=p.cover||studioBuiltinCover(p)?'image':'empty';const compatible=core.styleMatches(p,s.config.format);card.disabled=!compatible;card.title=compatible?'使用此画风':'请先在导演设置中切换到对应格式';card.dataset.active=String(p.id===s.config.styleId);card.setAttribute('aria-label','使用画风：'+p.name);if(p.id===s.config.styleId)card.setAttribute('aria-current','true');card.innerHTML=studioStyleArtwork(p)+'<span class="ad-style-card-top"><small class="ad-style-model">'+esc((core.styleFormat(p)==='nai45'?'NAI 4.5':core.styleFormat(p)==='generic'?'通用':core.styleFormat(p))+(p.basis&&p.basis!==(core.styleFormat(p)==='nai45'?'NAI 4.5':core.styleFormat(p)==='generic'?'通用':core.styleFormat(p))?' · '+p.basis:''))+'</small></span><strong>'+esc(p.name)+'</strong><span class="ad-style-card-number" aria-hidden="true">'+String(i+1).padStart(2,'0')+'</span>';card.onclick=()=>selectStyleCard(p.id,p.name);wrapper.onclick=event=>{if(event.target===wrapper&&!card.disabled)card.click();};const edit=document.createElement('button');edit.type='button';edit.className='ad-style-edit';edit.title='编辑画风';edit.setAttribute('aria-label','编辑画风：'+p.name);edit.onclick=()=>editStyle(p.id);const remove=document.createElement('button');remove.type='button';remove.className='ad-style-remove';remove.title='删除画风';remove.setAttribute('aria-label','删除画风：'+p.name);remove.onclick=()=>requestStyleDelete(p);const actions=document.createElement('div');actions.className='city-style-actions';edit.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6 4 4M4 20l1-5L17 3l4 4L9 19z"/></svg><span>编辑</span>';remove.innerHTML=trashIcon+'<span>删除</span>';actions.append(edit,remove);wrapper.append(card,actions);if(!studioBuiltinCover(p)){const cover=document.createElement('button');cover.type='button';cover.className='city-style-cover-upload';cover.setAttribute('aria-label',(p.cover?'更换封面：':'上传封面：')+p.name);cover.title=p.cover?'更换封面':'上传封面';if(!p.cover)cover.innerHTML='<span aria-hidden="true">＋</span><small>上传封面</small>';cover.onclick=()=>{styleCoverTarget=p.id;$('city-style-cover-error').hidden=true;$('city-style-cover-file').click();};wrapper.append(cover);}list.append(wrapper);});}

  let styleCoverTarget='';
  function editStyle(id,open=true){flushStyleDraft();styleEditing=id;const s=app.snapshot().styles.find(x=>x.id===id);if(!s)return;$('city-style-save-state').textContent='修改后自动保存';if(![...$('ad-style-format').options].some(o=>o.value===core.styleFormat(s))){const option=document.createElement('option');option.value=core.styleFormat(s);option.textContent=core.styleFormat(s);$('ad-style-format').append(option);}$('ad-style-format').value=core.styleFormat(s);$('ad-style-name').value=s.name;$('ad-style-basis').value=s.basis||'通用';$('ad-style-positive').value=s.positive;$('ad-style-negative').value=s.negative;$('ad-style-use-negative').checked=s.useNegative;$('ad-style-model-badge').textContent=s.basis||'未标注';$('ad-style-editor-title').textContent=s.name;if(open)styleView(true);}

  let styleDraft=null,styleDraftTimer,styleSaveQueue=Promise.resolve(true);
  function captureStyleDraft(){
    return {id:styleEditing,name:$('ad-style-name').value,format:$('ad-style-format').value,
      basis:$('ad-style-basis').value,positive:$('ad-style-positive').value,
      negative:$('ad-style-negative').value,useNegative:$('ad-style-use-negative').checked};
  }
  function scheduleStyleSave(){
    styleDraft=captureStyleDraft();
    $('city-style-save-state').textContent='正在保存…';
    clearTimeout(styleDraftTimer);
    styleDraftTimer=setTimeout(flushStyleDraft,450);
  }
  function flushStyleDraft(){
    clearTimeout(styleDraftTimer);
    if(!styleDraft)return styleSaveQueue;
    const value=styleDraft;
    styleDraft=null;
    styleSaveQueue=styleSaveQueue.then(async()=>{
      const styles=app.snapshot().styles;
      if(!styles.some(style=>style.id===value.id))return false;
      try{
        await app.saveStyles(styles.map(style=>style.id===value.id?{...style,...value}:style));
        if(!styleDraft&&styleEditing===value.id)$('city-style-save-state').textContent='已自动保存';
        if(!$('ad-style-browse').hidden&&$('ad-settings').dataset.currentPage==='styles')renderStyleCards();
        return true;
      }catch(error){
        if(!styleDraft&&styleEditing===value.id){
          styleDraft=value;
          $('city-style-save-state').textContent='保存失败';settingsNotice(error.message,true);
        }
        return false;
      }
    });
    return styleSaveQueue;
  }
  async function duplicateSelectedStyle(){const snapshot=app.snapshot();const selected=(!$('ad-style-editor').hidden&&styleEditing)||$('ad-style-cards').querySelector('.ad-style-preset-card[data-active=true]')?.dataset.styleId||snapshot.config.styleId;const source=snapshot.styles.find(x=>x.id===selected);if(!source)throw Error('请先选择一款画风');const content=$('ad-workspace-content'),top=content.scrollTop,wasEditing=!$('ad-style-editor').hidden,value={...structuredClone(source),id:core.id('style'),name:(source.name||'未命名画风')+' · 副本'};await app.saveStyles([...snapshot.styles,value]);styleEditing=value.id;renderStyleCards();editStyle(value.id,false);if(!wasEditing)$('ad-style-editor').hidden=true;content.scrollTop=top;status('已复制画风');}
  let profileEpoch=0,profileObserver=null,profileEditing=null;
  function releaseProfiles(){profileEpoch++;profileObserver?.disconnect();profileObserver=null;document.querySelectorAll('#ad-profile-list img,#ad-profile-portrait img').forEach(img=>memory?.clear(img));}
  function profilePicture(box,p,epoch){
    const image=document.createElement('img'),placeholder=document.createElement('span');let avatar=null;try{avatar=window.ADirectorAvatar.stored(p.avatar);}catch{}
    image.alt=avatar?'人物头像':'登记画面';image.decoding='async';image.hidden=true;placeholder.className='ad-profile-placeholder';placeholder.innerHTML='<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="21" r="11"/><path d="M12 57v-7c0-12 8-18 20-18s20 6 20 18v7"/></svg><small>暂无登记画面</small>';box.replaceChildren(placeholder,image);box.dataset.ready='false';box.dataset.avatar=String(!!avatar);
    let started=false;return async()=>{if(started)return;started=true;const valid=()=>!disposed&&epoch===profileEpoch&&box.isConnected;const ready=()=>{if(valid()){image.hidden=false;placeholder.hidden=true;box.dataset.ready='true';}};const assign=async src=>{if(avatar)memory.adopt(image,{url:src,role:'thumb',release(){}},src,'thumb');else await memory.set(image,src,'thumb');if(valid()){image.hidden=false;image.loading='eager';}};try{
      let pointer=avatar?.pointer;if(!pointer){if(!p.sourceMessageId||!p.sourceImageId)return;const rec=await app.readRecord(p.sourceMessageId);if(!valid())return;pointer=rec?.images?.find(i=>i.id===p.sourceImageId)?.pointer;if(!pointer)return;}
      const src=await app.imageUrl(pointer);if(!valid())return;image.onload=ready;image.onerror=async()=>{image.onerror=null;try{const embedded=await app.imageUrl(pointer,true);if(valid()){image.onerror=()=>{if(valid()){image.hidden=true;placeholder.hidden=false;placeholder.querySelector('small').textContent='头像暂不可用';}};await assign(embedded);}}catch{if(valid())placeholder.querySelector('small').textContent='头像暂不可用';}};await assign(src);if(valid()&&image.complete&&image.naturalWidth)ready();
    }catch{if(valid())placeholder.querySelector('small').textContent='登记画面暂不可用';}};
  }
  bind($('ad-profile-avatar'),'click',async()=>{if(!profileEditing)return;const source=structuredClone(profileEditing),epoch=profileEpoch,button=$('ad-profile-avatar');button.disabled=true;$('ad-profile-error').hidden=true;try{const rec=await app.readRecord(source.sourceMessageId),image=rec?.images?.find(i=>i.id===source.sourceImageId);if(!image)throw Error('原始登记画面已不可用');const url=await app.imageUrl(image.pointer,true);if(epoch!==profileEpoch)return;const draft=await window.ADirectorAvatarPicker.open({source:url,value:source.avatar});if(!draft||epoch!==profileEpoch)return;const updated=await app.setProfileAvatar(source,draft);if(epoch!==profileEpoch)return;profileEditing=structuredClone(updated);profilePicture($('ad-profile-portrait'),profileEditing,profileEpoch)();status('头像已保存');}catch(error){if(epoch===profileEpoch){$('ad-profile-error').textContent=error.message;$('ad-profile-error').hidden=false;}}finally{button.disabled=false;}});

  function renderProfiles(){
    releaseProfiles();profileEditing=null;$('ad-settings').dataset.profileEditing='false';$('ad-profiles-browse').hidden=false;$('ad-profile-editor').hidden=true;const list=$('ad-profile-list'),snapshot=app.snapshot(),epoch=profileEpoch;list.replaceChildren();$('ad-profile-count').textContent=snapshot.profiles.length+' 位';
    if(!snapshot.profiles.length){list.innerHTML=resourceEmpty("profiles","还没有登记角色","可从人物 CG 登记角色，之后在这里管理姓名与形态。");return;}
    if(typeof IntersectionObserver==='function')profileObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){profileObserver?.unobserve(entry.target);entry.target.loadPreview();}},{root:$('ad-workspace-content'),rootMargin:'80px'});
    snapshot.profiles.forEach(p=>{const node=document.createElement('button');node.type='button';node.className='ad-profile-card';node.setAttribute('aria-label','编辑'+p.name+' · '+p.form);node.innerHTML='<span class="ad-profile-photo"></span><span class="ad-profile-meta"><strong>'+esc(p.name)+'</strong><small><span class="city-profile-form">'+esc(p.form||'默认形态')+'</span><span class="city-profile-registered">已登记</span></small></span><span class="city-profile-arrow" aria-hidden="true"></span>';node.onclick=()=>editProfile(p);const wrapper=document.createElement('div');wrapper.className='ad-profile-card-wrap';const remove=document.createElement('button');remove.type='button';remove.className='ad-trash ad-profile-remove';remove.title='删除角色档案';remove.setAttribute('aria-label','删除'+p.name+' · '+p.form);remove.innerHTML=trashIcon;remove.onclick=()=>requestProfileDelete(p);wrapper.append(node,remove);list.append(wrapper);node.loadPreview=profilePicture(node.querySelector('.ad-profile-photo'),p,epoch);if(profileObserver)profileObserver.observe(node);else node.loadPreview();});
  }
  function editProfile(p){dismissEditing();releaseProfiles();profileEditing=structuredClone(p);$('ad-settings').dataset.profileEditing='true';$('ad-profiles-browse').hidden=true;$('ad-profile-editor').hidden=false;$('ad-profile-error').hidden=true;for(const [id,value]of [['name',p.name],['aliases',(p.aliases||[]).join('，')],['form',p.form]])$('ad-profile-'+id).value=value;$('ad-workspace-content').scrollTop=0;profilePicture($('ad-profile-portrait'),p,profileEpoch)();$('ad-profile-editor').tabIndex=-1;$('ad-profile-editor').focus({preventScroll:true});}
  bind($('ad-profile-cancel'),'click',()=>renderProfiles());
  bind($('ad-profile-editor'),'submit',async e=>{e.preventDefault();if(!profileEditing)return;const source=profileEditing,button=$('ad-profile-save');button.disabled=true;$('ad-profile-error').hidden=true;try{await app.editProfile(source,{name:$('ad-profile-name').value,aliases:$('ad-profile-aliases').value,form:$('ad-profile-form').value});profileEditing=structuredClone(app.snapshot().profiles.find(p=>p.name===$('ad-profile-name').value.trim()&&p.form===$('ad-profile-form').value.trim())||source);status('角色档案已保存');}catch(error){$('ad-profile-error').textContent=error.message;$('ad-profile-error').hidden=false;}finally{button.disabled=false;}});

  function renderSeeds(){
    const list=$('ad-seed-list'),snapshot=app.snapshot();
    list.replaceChildren();
    $('city-seed-count').textContent=snapshot.favorites.length+' 条';
    if(!snapshot.favorites.length){list.innerHTML=resourceEmpty("seed","还没有收藏的 Seed","可以添加 Seed，也可以从 CG 或导演首页收藏。");return;}
    for(const favorite of snapshot.favorites){
      const row=document.createElement('article');
      row.className='city-seed-row';
      const active=snapshot.config.seedFixed&&String(snapshot.config.seedValue)===String(favorite.seed);
      row.dataset.active=String(active);
      const note=favorite.note?.trim();
      const seedIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-7m0 3C4 17 4 10 4 7c7 0 8 4 8 7 0-4 1-7 8-7 0 5-2 9-8 10"/></svg>';
      row.innerHTML='<span class="city-seed-row-icon" aria-hidden="true">'+seedIcon+'</span><div class="city-seed-row-copy">'+
        (note||favorite.model?'<div class="city-seed-row-meta">'+
          (note?'<strong class="city-seed-note" title="'+esc(note)+'">'+esc(note)+'</strong>':'')+
          (favorite.model?'<small class="city-seed-model" title="'+esc(favorite.model)+'">'+esc(favorite.model)+'</small>':'')+'</div>':'')+
        '<span class="city-seed-row-number">'+esc(favorite.seed)+'</span></div>';
      const use=document.createElement('button');
      use.type='button';use.className='city-seed-use';use.textContent=active?'已固定':'使用';
      use.onclick=async()=>{try{core.seedValue(favorite.seed,app.snapshot().config.format);await app.saveConfig({seedValue:String(favorite.seed),seedFixed:true});syncSeedControls(app.snapshot().config);renderSeeds();status('已使用 Seed：'+favorite.seed);}catch(error){status(error.message);}};
      const remove=document.createElement('button');
      remove.type='button';remove.className='city-seed-remove';remove.setAttribute('aria-label','删除收藏：'+favorite.seed);remove.innerHTML=trashIcon;
      remove.onclick=async()=>{try{await app.saveFavorites(app.snapshot().favorites.filter(item=>!(String(item.seed)===String(favorite.seed)&&item.model===favorite.model)));renderSeeds();status('Seed 收藏已移除');}catch(error){status(error.message);}};
      row.append(use,remove);list.append(row);
    }
  }

  function openFavorite(item,allowModelEntry=false){if(item&&!allowModelEntry&&app.snapshot().favorites.some(f=>String(f.seed)===String(item.seed))){status('这个 Seed 已收藏，可在种子收藏中管理');seedCollectState();return;}favoriteImage=structuredClone(item);
    const manual=!item,field=$('ad-favorite-seed');
    $('ad-favorite-title').textContent=manual?'添加 Seed':'收藏 Seed';
    $('ad-favorite-submit').textContent=manual?'添加到收藏':'收藏';
    $('ad-favorite-value').hidden=manual;
    $('ad-favorite-value').innerHTML=manual?'':'<span class="seed-value-label">Seed</span><strong>'+esc(item.seed)+'</strong>';
    $('ad-favorite-seed-field').hidden=!manual;
    field.value='';field.disabled=!manual;field.required=manual;
    $('ad-favorite-model').value='';$('ad-favorite-note').value='';$('ad-favorite-error').textContent='';show('ad-seed-favorite');}
  function favorite(){const item=active();if(item?.seed===null||item?.seed===undefined)return;openFavorite(item,true);}
  let promptImage=null;
  function promptSections(summary,page){
    if(page==='final'){
      const prompt=summary.finalPrompt;
      return [['正面提示词',prompt.positive||'未保存'],...(prompt.characters||[]).map((text,i)=>['人物 '+(i+1),text]),['负面提示词',prompt.negative||'未发送']];
    }
    const plan=summary.directorPlan;
    if(!plan)return [['场景','暂无可用导演方案']];
    const sections=[];
    if(plan.sourceExcerpt)sections.push(['正文依据',plan.sourceExcerpt]);
    for(const [key,label]of [['event','本轮事件'],['moment','选定瞬间'],['framing','镜头安排']])if(plan.directorSummary?.[key])sections.push([label,plan.directorSummary[key]]);
    sections.push(['场景',plan.scene]);
    if(plan.description)sections.push(['画面描述',plan.description]);
    for(const character of plan.characters){
      const {name,form,identity,relation,equipment}=character;
      const outfit=Object.entries(equipment).flatMap(([slot,value])=>core.Wardrobe.garmentItems(slot,value))
        .filter(item=>item.visible!==false).map(({name,state})=>[name,state].filter(Boolean).join(', ')).join(', ');
      const inner=Object.entries(equipment).flatMap(([slot,value])=>{
        if(value?.inner?.length!==0)return [];
        return [slot==='TOP'?'未穿上身内衣':'未穿内裤'];
      }).join('，');
      sections.push([[name,form].filter(Boolean).join(' · '),[identity,relation,outfit,inner].filter(Boolean).join('\n')]);
    }
    return sections;
  }
  function showPromptPage(page='plan'){
    if(!promptImage)return;
    const content=$('ad-record-content');
    content.replaceChildren();
    for(const [label,text] of promptSections(promptImage.summary,page)){
      const section=document.createElement('section'),heading=document.createElement('h4'),body=document.createElement('pre');
      section.className='ad-record-section';heading.textContent=label;body.textContent=text||'';
      section.append(heading,body);content.append(section);
    }
    content.dataset.page=page;
    document.querySelectorAll('[data-ad-prompt-tab]').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.adPromptTab===page)));
  }
  function showPrompt(){
    const image=active();
    if(!image||!record)return;
    promptImage={image,record,summary:app.imageGenerationRecord(record,image)};
    $('ad-prompt-export-status').textContent='';
    showPromptPage();show('ad-prompt');
  }
  document.querySelectorAll('[data-ad-prompt-tab]').forEach(node=>bind(node,'click',()=>showPromptPage(node.dataset.adPromptTab)));
  async function exportGenerationRecord(detailed=false){
    const selection=promptImage;
    if(!selection)return;
    const buttons=[$('ad-prompt-download'),$('ad-prompt-diagnostics')],feedback=$('ad-prompt-export-status');
    buttons.forEach(button=>button.disabled=true);
    feedback.textContent='';
    try{
      const id=String(selection.image.id).replace(/[^a-z0-9_-]/gi,'_');
      const report=detailed?app.imageGenerationRecord(selection.record,selection.image,true):core.redactRecord(selection.summary);
      const content=detailed?JSON.stringify(report,null,2)
        :[['plan','导演方案'],['final','最终提示词']].map(([page,title])=>'【'+title+'】\n'+promptSections(report,page).map(([label,text])=>label+'\n'+text).join('\n\n')).join('\n\n');
      await tavo.file.export('Aozora-'+(detailed?'generation-diagnostics-':'generation-record-')+id+(detailed?'.json':'.txt'),content,{encoding:'utf8'});
    }catch(error){if(promptImage===selection)feedback.textContent='导出失败。'+(error?.message||'');}
    finally{buttons.forEach(button=>button.disabled=false);}
  }

  const reader=window.ADirectorCreateReader?.(tavo,{app:()=>app,core:()=>core,hasMotionOrigin:(item,images)=>motionOrigin(item,images),close:closeHistorySession,returnToCard:()=>openStage(),settings:()=>settingsDialog(),action:async(action,messageId,imageId)=>{try{return await performReaderAction(action,messageId,imageId);}catch(error){if(error?.code==='UNCHANGED_FIXED_SEED'){show('ad-seed-locked');return;}throw error;}}});
  let launcherDrag=null,launcherSuppressUntil=0,launcherPlaced=false;
  function placeLauncher(x,y){const width=root.offsetWidth||46,height=root.offsetHeight||46,top=(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tavo-inset-top-bar'))||56)+8;const left=Math.max(10,Math.min(innerWidth-width-10,x)),up=Math.max(top,Math.min(innerHeight-height-14,y));for(const [key,value]of Object.entries({left:left+'px',top:up+'px',right:'auto',bottom:'auto'}))root.style.setProperty(key,value,'important');root.dataset.labelSide=left<140?'right':'left';launcherPlaced=true;return {x:left/Math.max(1,innerWidth-width),y:up/Math.max(1,innerHeight-height)};}
  const suppressLauncherClick=event=>{if(Date.now()<launcherSuppressUntil){event.preventDefault();event.stopImmediatePropagation();}};root.addEventListener('click',suppressLauncherClick,true);noticeCleanups.push(()=>root.removeEventListener('click',suppressLauncherClick,true));
  try{const pos=JSON.parse(sessionStorage.getItem('aozora.director.launcher.position')||'null');if(pos)placeLauncher(pos.x*(innerWidth-root.offsetWidth),pos.y*(innerHeight-root.offsetHeight));}catch{}
  bind(root,'pointerdown',event=>{if(event.isPrimary===false||event.button>0)return;const box=root.getBoundingClientRect();launcherDrag={id:event.pointerId,x:event.clientX,y:event.clientY,left:box.left+(box.width-root.offsetWidth)/2,top:box.top+(box.height-root.offsetHeight)/2,moved:false};try{root.setPointerCapture?.(event.pointerId);}catch{}});
  bind(window,'pointermove',event=>{const drag=launcherDrag;if(!drag||drag.id!==event.pointerId)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<3)return;drag.moved=true;event.preventDefault();placeLauncher(drag.left+dx,drag.top+dy);});
  bind(window,'pointerup',event=>{const drag=launcherDrag;if(!drag||drag.id!==event.pointerId)return;if(drag.moved){launcherSuppressUntil=Date.now()+450;const pos=placeLauncher(root.offsetLeft,root.offsetTop);try{sessionStorage.setItem('aozora.director.launcher.position',JSON.stringify(pos));}catch{}}launcherDrag=null;root.releasePointerCapture?.(event.pointerId);});
  bind(root,'pointercancel',()=>{if(launcherDrag?.moved)launcherSuppressUntil=Date.now()+450;launcherDrag=null;});bind(window,'resize',()=>{if(launcherPlaced){try{const pos=JSON.parse(sessionStorage.getItem('aozora.director.launcher.position')||'null');if(pos)placeLauncher(pos.x*(innerWidth-root.offsetWidth),pos.y*(innerHeight-root.offsetHeight));}catch{}}});
  bind(root,'click',()=>reader?.isOpen()?reader.close():dock.hidden?openStage():closeStage());

  $('addock-stage').append(dock.querySelector('.addock-actions'));bind(window,'resize',sizeStage);
  dock.querySelectorAll('.addock-detail-heading,.addock-history-heading').forEach(n=>n.hidden=true);
  bind($('addock-config'),'click',()=>settingsDialog());bind($('addock-close'),'click',closeStage);
  const cardStage=$('addock-stage');
  let cardSwipe=null,cardSwipeClickPending=false,cardSwipeClickTimer=0;
  bind(cardStage,'pointerdown',event=>{
    if(event.isPrimary===false){cardSwipe=null;return;}
    if(event.button>0||viewer||stageImages().length<2||event.target.closest('button'))return;
    cardSwipe={id:event.pointerId,x:event.clientX,y:event.clientY,axis:null};
  });
  bind(cardStage,'pointermove',event=>{
    if(!cardSwipe||event.pointerId!==cardSwipe.id)return;
    const dx=event.clientX-cardSwipe.x,dy=event.clientY-cardSwipe.y;
    if(!cardSwipe.axis&&Math.max(Math.abs(dx),Math.abs(dy))>10)cardSwipe.axis=Math.abs(dx)>Math.abs(dy)*1.2?'horizontal':'vertical';
    if(cardSwipe.axis==='horizontal'){
      cardStage.setPointerCapture?.(event.pointerId);
      if(event.cancelable)event.preventDefault();
    }
  });
  bind(cardStage,'pointerup',event=>{
    const swipe=cardSwipe;if(!swipe||event.pointerId!==swipe.id)return;
    cardSwipe=null;
    if(cardStage.hasPointerCapture?.(event.pointerId))cardStage.releasePointerCapture(event.pointerId);
    const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;
    if(swipe.axis!=='vertical'&&Math.abs(dx)>=40&&Math.abs(dx)>Math.abs(dy)*1.2){
      cardSwipeClickPending=true;clearTimeout(cardSwipeClickTimer);cardSwipeClickTimer=setTimeout(()=>{cardSwipeClickPending=false;cardSwipeClickTimer=0;},700);return move(dx<0?1:-1);
    }
  });
  bind(cardStage,'pointercancel',()=>{cardSwipe=null;});
  bind(cardStage,'dragstart',event=>{if(event.target.matches('img'))event.preventDefault();});
  const suppressCardSwipeClick=event=>{if(!cardSwipeClickPending)return;cardSwipeClickPending=false;clearTimeout(cardSwipeClickTimer);cardSwipeClickTimer=0;event.preventDefault();event.stopImmediatePropagation();};
  cardStage.addEventListener('click',suppressCardSwipeClick,true);
  noticeCleanups.push(()=>{clearTimeout(cardSwipeClickTimer);cardStage.removeEventListener('click',suppressCardSwipeClick,true);});
  bind($('addock-main-image'),'click',openViewer);bind($('addock-prev'),'click',()=>move(-1));bind($('addock-next'),'click',()=>move(1));
  bind($('addock-fullview'),'cancel',event=>{event.preventDefault();closeViewer();});bind($('addock-fullview'),'close',()=>{if(viewer&&!$('addock-fullview').open)closeViewer();});
  bind($('addock-fullview-prev'),'click',()=>move(-1));bind($('addock-fullview-next'),'click',()=>move(1));bind($('addock-fullview-close'),'click',closeViewer);bind($('addock-fullview-return-bottom'),'click',closeViewer);
  for(const button of speedButtons)bind(button,'click',event=>{
    event.stopPropagation();
    motionSpeed=(motionSpeed+1)%motionSpeeds.length;
    syncMotionControls();
  });
  bind($('addock-fullview-download'),'click',async()=>{
    const item=active(),button=$('addock-fullview-download');
    if(!item||button.disabled)return;
    const animated=viewerMotionPlaying&&!!item.motion?.sourcePointer;
    const duration=motionSpeeds[motionSpeed].duration;
    button.disabled=true;
    try{
      let result;
      if(animated){
        const frames=await Promise.all([item.pointer,item.motion.sourcePointer].map(pointer=>app.imageUrl(pointer,true)));
        const data=await window.ADirectorMotionExport.encode(frames,duration);
        result=await tavo.file.export('aozora-motion-'+Date.now()+'.gif',data.split(',')[1],{encoding:'base64'});
      }else{
        result=await app.download(item.pointer);
      }
      if(result!==false&&!result?.cancelled&&viewer)showExportNotice(animated?'动态图已保存':'静态图已保存');
    }catch(error){
      if(viewer)showExportNotice('保存失败：'+error.message);
    }finally{button.disabled=false;}
  });
  bind($('addock-fullview-seed'),'click',favorite);bind($('ad-viewer-prompt'),'click',showPrompt);
  bind(motionPlayButton,'click',event=>{event.stopPropagation();if(!active()?.motion?.sourcePointer)return;motionPlaying=!motionPlaying;render();});
  bind(viewerMotionButton,'click',()=>{if(!active()?.motion?.sourcePointer)return;viewerMotionPlaying=!viewerMotionPlaying;render();});
  bind($('addock-history-button'),'click',openHistory);bind($('addock-history-return'),'click',()=>{dock.dataset.view='current';$('addock-history').hidden=true;return render();});
  bind($('addock-characters-button'),'click',()=>settingsDialog('profiles'));
  bind($('ad-seed-locked-close'),'click',()=>hide('ad-seed-locked'));
  bind($('addock-generate'),'click',()=>{const item=active();if(motionOrigin(item))return;if(record?.recoverableImage)return app.recover(mid);if(!item)return record?.plan?app.generate(mid,true):undefined;return app.generate(mid,true,item.id,null,'replace');});
  bind($('addock-add'),'click',()=>{const item=active();if(motionOrigin(item))return;if(!item)return record?.plan?app.generate(mid,true):canRecoverPlan?app.generate(mid,true):canSupplementBody?openSupplement(mid):undefined;return app.generate(mid,true,item.id);});bind($('addock-keep'),'click',requestDelete);
  let registrationTarget=null,tuneTarget=null,motionTarget=null,supplementTarget=null;
  function openSupplement(messageId){supplementTarget={mid:String(messageId||mid)};$('addock-scene-request').value='';$('ad-scene-error').hidden=true;show('addock-scene-dialog');}
  bind($('addock-scene-cancel'),'click',()=>{supplementTarget=null;hide('addock-scene-dialog');});
  bind($('addock-scene-dialog'),'close',()=>{if(!$('addock-scene-dialog').open)supplementTarget=null;});
  async function submitImageDialog(dialogId,buttonId,submit){
    const button=$(buttonId);
    if(button.disabled)return;
    button.disabled=true;
    try{
      hide(dialogId);
      await submit();
    }finally{button.disabled=false;}
  }
  bind($('addock-scene-submit'),'click',()=>{
    const target=supplementTarget;if(!target)return;
    const request=$('addock-scene-request').value.trim();
    return submitImageDialog('addock-scene-dialog','addock-scene-submit',()=>app.supplement(target.mid,request));
  });
  bind($('addock-motion'),'click',()=>{const item=active();if(!supportsMotionRequest(item,record?.kind))return;motionTarget={mid,imageId:item.id};$('addock-motion-request').value='';$('ad-motion-error').hidden=true;show('addock-motion-dialog');});
  bind($('addock-motion-cancel'),'click',()=>hide('addock-motion-dialog'));
  bind($('addock-motion-dialog'),'close',()=>{if(!$('addock-motion-dialog').open)motionTarget=null;});
  bind($('addock-motion-submit'),'click',()=>{
    const target=motionTarget;if(!target)return;
    if(!supportsMotionRequest(active(),record?.kind)){hide('addock-motion-dialog');motionTarget=null;return;}
    const request=$('addock-motion-request').value.trim();
    if(!request){invalidField('addock-motion-request','请填写想看的动作变化');return;}
    return submitImageDialog('addock-motion-dialog','addock-motion-submit',()=>app.animate(target.mid,target.imageId,request));
  });
  function prepareRegistrationAvatar(target){const image=$('ad-registration-avatar-image');image.hidden=true;target.avatar=null;target.avatarReady=(async()=>{const url=await app.imageUrl(target.pointer,true);if(registrationTarget!==target)return;target.avatarSource=url;const avatar=await window.ADirectorAvatarPicker.createDefault(url);if(registrationTarget!==target)return;target.avatar=avatar;image.src=avatar.dataUrl;image.hidden=false;})().catch(()=>{if(registrationTarget===target)$('ad-registration-status').textContent='原图暂不可用，可稍后调整头像。';});}
  bind($('ad-registration-avatar'),'click',async()=>{const target=registrationTarget;if(!target)return;await target.avatarReady;if(registrationTarget!==target||!target.avatarSource)return;const draft=await window.ADirectorAvatarPicker.open({source:target.avatarSource,value:target.avatar});if(draft&&registrationTarget===target){target.avatar=draft;$('ad-registration-avatar-image').src=draft.dataUrl;$('ad-registration-avatar-image').hidden=false;}});
  bind($('addock-dna-open'),'click',()=>{
    const item=active(),person=item?.plan?.characters?.[0];
    if(item?.kind!=='character_intro'||!person)return;
    registrationTarget={mid,imageId:item.id,pointer:item.pointer};
    $('addock-dna-name').value=person.name||'';
    $('addock-dna-form').value=person.form||'默认形态';
    $('ad-registration-error').hidden=true;
    $('ad-registration-status').textContent='';
    show('addock-dna-dialog');
    prepareRegistrationAvatar(registrationTarget);
  });
  bind($('addock-dna-cancel'),'click',()=>{registrationTarget=null;hide('addock-dna-dialog');});
  bind($('addock-dna-dialog'),'close',()=>{if(!$('addock-dna-dialog').open)registrationTarget=null;});
  bind($('ad-registration-result-close'),'click',()=>hide('ad-registration-result'));
  bind($('addock-dna-submit'),'click',async()=>{if(!registrationTarget||registrationState?.state==='busy')return;const sourceTarget=registrationTarget,target={mid:sourceTarget.mid,imageId:sourceTarget.imageId},name=$('addock-dna-name').value.trim(),form=$('addock-dna-form').value.trim()||'默认形态';if(!name){invalidField('addock-dna-name','请填写人物姓名');return;}$('addock-dna-submit').disabled=true;try{await sourceTarget.avatarReady;}finally{$('addock-dna-submit').disabled=false;}if(registrationTarget!==sourceTarget||!$('addock-dna-dialog').open)return;target.avatar=sourceTarget.avatar;const task={mid:target.mid,imageId:target.imageId,state:'busy',text:'正在登记 · '+name,noticeUntil:Date.now()+3000};registrationState=task;registrationTarget=null;hide('addock-dna-dialog');paintRegistration();setTimeout(()=>{if(registrationState===task&&!disposed)paintRegistration();},3050);try{const job=await app.registerCharacter(target.mid,target.imageId,name,form);await app.confirmRegistration(job.id,job.proposal.identity,target.avatar);if(registrationState!==task)return;task.state='done';task.text='登记完成 · '+name;await render();paintRegistration();$('ad-registration-result-title').textContent='登记完成';const result=$('ad-registration-result-text'),person=document.createElement('strong'),shape=document.createElement('span'),message=document.createElement('span');person.className='ad-registered-name';person.textContent=name;shape.className='ad-registered-form';shape.textContent=form;message.className='ad-registered-message';message.textContent=job.usedOriginalDNA?'精简未通过校验，已按原外貌登记':'已保存到角色档案';const identity=document.createElement('div');identity.className='ad-registration-identity';identity.append(person,shape);result.replaceChildren(identity,message);show('ad-registration-result');}catch(error){if(registrationState!==task)return;task.state='failed';task.text='登记失败 · '+error.message;paintRegistration();$('ad-registration-result-title').textContent='登记失败';$('ad-registration-result-text').textContent=error.message;show('ad-registration-result');}});

  function syncTuneMethod(){
    const character=tuneTarget?.character===true,canEditSource=supportsImageEditing(active());let method=tuneTarget?.method||'text2img';
    if(!canEditSource&&method==='img2img'){method='text2img';if(tuneTarget)tuneTarget.method=method;}
    const img=method==='img2img',newScene=method==='new-scene';
    $('addock-tune-method').checked=img;
    $('addock-tune-new-scene').checked=newScene;
    $('addock-tune-switch').hidden=character||!canEditSource;
    $('addock-tune-new-scene-switch').hidden=character||!canEditSource;
    $('addock-tune-method-hint').hidden=character||!canEditSource;
    $('addock-character-tune-hint').hidden=!character;
    const shotField=$('addock-tune-shot-field');
    shotField.hidden=img;shotField.dataset.newScene=String(newScene);
    if(newScene)shotField.querySelector('[value=near]').checked=true;
    $('addock-tune-method-hint').textContent=img?'基于所选图片调整，需配置动态API':newScene?'从当前剧情选景，也可指定独立画面':'基于当前场景调整画面';
    $('addock-tune-request').placeholder=character?'例如：把眼睛改成灰绿色':newScene?'重新选一个想看的场景画出来吧':'例如：让她转头看向窗外';
  }
  for(const [id,method] of [['addock-tune-method','img2img'],['addock-tune-new-scene','new-scene']])bind($(id),'change',event=>{
    if(!tuneTarget||tuneTarget.character)return;
    if(!supportsImageEditing(active())){tuneTarget.method='text2img';syncTuneMethod();return;}
    tuneTarget.method=event.currentTarget.checked?method:'text2img';
    if(tuneTarget.method==='new-scene')$('addock-tune-shot-field').querySelector('[value=near]').checked=true;
    syncTuneMethod();
  });
  bind($('addock-tune'),'click',()=>{
    const item=active();if(!supportsImageEditing(item))return;
    const character=(item.kind||record?.kind)==='character_intro';
    tuneTarget={mid,imageId:item.id,character,method:'text2img'};
    $('addock-tune-title').textContent=character?'微调人物':'调整剧情画面';
    document.querySelector('[name=ad-tune-shot][value=near]').checked=true;
    $('addock-tune-request').value='';$('ad-tune-error').hidden=true;
    syncTuneMethod();show('addock-tune-dialog');
  });
  bind($('addock-tune-cancel'),'click',()=>hide('addock-tune-dialog'));
  bind($('addock-tune-dialog'),'close',()=>{if(!$('addock-tune-dialog').open)tuneTarget=null;});
  bind($('addock-tune-submit'),'click',()=>{
    const target=tuneTarget;if(!target)return;
    const request=$('addock-tune-request').value.trim(),method=target.method;
    if(!request&&method!=='new-scene'){invalidField('addock-tune-request','请填写要调整的内容');return;}
    const shot=method==='img2img'?undefined:$('addock-tune-shot-field').querySelector('input:checked')?.value;
    return submitImageDialog('addock-tune-dialog','addock-tune-submit',()=>app.tune(target.mid,target.imageId,request,{method,shot}));
  });

  function requestDelete(){const item=active();if(!item)return;deleteTarget={messageId:mid,imageId:item.id};$('ad-image-delete-error').textContent='';show('ad-image-delete');}
  bind($('addock-fullview-delete'),'click',requestDelete);bind($('ad-image-delete-cancel'),'click',()=>{deleteTarget=null;hide('ad-image-delete');});
  bind($('ad-image-delete-confirm'),'click',async()=>{if(!deleteTarget)return;const target=deleteTarget,button=$('ad-image-delete-confirm');button.disabled=true;try{await app.removeImage(target.messageId,target.imageId);deleteTarget=null;hide('ad-image-delete');}catch(error){$('ad-image-delete-error').textContent=error.message;}finally{button.disabled=false;}});
  for(const id of ['addock-cover','addock-fullview-cover','addock-members','addock-history-all','addock-history-cg','addock-history-order','addock-story-expand'])if($(id))$(id).hidden=true;
  bind($('ad-next-cancel'),'click',()=>hide('ad-next'));bind($('ad-next-form'),'submit',async e=>{e.preventDefault();await app.queueNext({kind:requestKind,request:$('ad-request').value,targetName:requestKind==='character_intro'?$('ad-target').value:'',targetForm:requestKind==='character_intro'?$('ad-form').value:'',shot:document.querySelector('[name=ad-shot]:checked').value});hide('ad-next');});

  bind($('local-motion-official'),'click',()=>{$('local-motion-url').value='https://image.novelai.net/ai/generate-image';$('local-motion-key').value='';$('local-motion-key').placeholder='填写 API Key';officialAddressFeedback('motion');});bind($('local-motion-provider'),'change',()=>refreshOfficialApi($('local-motion-provider').value==='relay'?'thirdparty':'official'));
  for(const id of ['local-relay-url','local-relay-key'])bind($(id),'input',()=>{staticConnectionState('dirty');clearSettingsNotice();});
  for(const id of ['local-motion-url','local-motion-key'])bind($(id),'input',()=>{updateMotionConnectionDirty();clearSettingsNotice();});
  bind($('local-motion-url'),'blur',()=>{if($('local-motion-key').value.trim())queueMotionAutoSave('connection',180);});
  bind($('local-motion-key'),'blur',()=>{if($('local-motion-key').value.trim())queueMotionAutoSave('connection',180);});
  // Preserve native editing defaults and keep clipboard events away from host shortcuts.
  for(const id of ['local-relay-url','local-relay-key','local-motion-url','local-motion-key']){const input=$(id);for(const event of ['keydown','keyup','keypress','paste','copy','cut','contextmenu'])bind(input,event,e=>e.stopPropagation());}
  for (const [prefix, keySelector] of [['static-api', '#local-relay-key'], ['motion-api', '#local-motion-key']]) {
    const keyField = document.querySelector(keySelector);
    const revealKey = document.querySelector('#' + prefix + '-reveal');
    bind(revealKey,'click', () => {
      const visible = keyField.type === 'password';
      keyField.type = visible ? 'text' : 'password';
      revealKey.setAttribute('aria-pressed', String(visible));
      revealKey.textContent = visible ? '隐藏' : '显示';
    });
    bind(document.querySelector('#' + prefix + '-paste'),'click', async () => {
      const note = document.querySelector('#' + prefix + '-paste-note');
      try {
        const value = await navigator.clipboard.readText();
        if (value) {
          keyField.value = value.trim();
          keyField.dispatchEvent(new Event('input', { bubbles: true }));
        }
        note.textContent = value ? '' : '剪贴板为空';
      } catch {
        note.textContent = '请在密钥输入框中手动粘贴';
      }
      keyField.focus();
    });
  }
  bind($('local-use-official'),'click',()=>{$('local-relay-url').value='https://image.novelai.net/ai/generate-image';$('local-relay-key').value='';$('local-relay-key').placeholder='填写 API Key';officialAddressFeedback('static');});bind($('local-open-official-motion'),'click',()=>openRelay('api','official'));bind($('local-open-relay'),'click',()=>openRelay('settings'));bind($('local-open-relay-motion'),'click',()=>openRelay('api'));const closeRelayPage=()=>page(relayReturn,relayReturn==='api');bind($('local-relay-back'),'click',closeRelayPage);bind($('local-relay-back-bottom'),'click',closeRelayPage);
  function commitMotionStrength(){
    $('local-strength').value=readMotionStrength().toFixed(2);
    queueMotionAutoSave('parameters',120);
  }
  bind($('local-strength'),'change',commitMotionStrength);
  bind($('local-strength'),'keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}
  });
  bind($('local-strength'),'blur',()=>{
    $('local-strength').value=readMotionStrength().toFixed(2);
  });
  for(const button of document.querySelectorAll('[data-strength-step]'))bind(button,'click',()=>{
    const input=$('local-strength');
    input.value=(readMotionStrength()+Number(button.dataset.strengthStep)*Number(input.step)).toFixed(2);
    commitMotionStrength();
  });
  bind($('local-noise'),'input',()=>queueMotionAutoSave('parameters',500));
  bind($('local-noise'),'change',()=>queueMotionAutoSave('parameters',120));
  bind($('local-schedule'),'change',()=>queueMotionAutoSave('parameters',120));
  bind($('local-motion-reset'),'click',()=>{$('local-strength').value='0.85';$('local-noise').value='0';$('local-schedule').selectedIndex=0;queueMotionAutoSave('parameters',160);});
  for(const b of document.querySelectorAll('[data-local-size]'))bind(b,'click',async()=>{const [w,h]=b.dataset.localSize.split(',').map(Number),relay=!!b.closest('#local-relay-page');$(relay?'local-relay-width':'local-width').value=w;$(relay?'local-relay-height':'local-height').value=h;if(!relay){await app.saveConfig({width:w,height:h,imageService:'official'});status('分辨率已自动保存');}});
  for(const id of ['local-width','local-height'])bind($(id),'change',async()=>{const change={width:Number($('local-width').value),height:Number($('local-height').value),imageService:'official'};validateSize(change);await app.saveConfig(change);status('分辨率已自动保存');});
  function validateSize(value){for(const k of ['width','height'])if(!Number.isInteger(value[k])||value[k]<64||value[k]>2048||value[k]%64)throw Error('宽高须为64–2048之间的64倍数');if(value.width*value.height>3145728)throw Error('尺寸总像素超出限制');}
  function staticProviderFor(address){
    if(!address||$('local-relay-url').validity.typeMismatch)throw Error('请填写有效的 HTTPS API 地址');
    return new URL(address).hostname==='image.novelai.net'?'official':'thirdparty';
  }
  function queueMotionAutoSave(kind='parameters',delay=450){
    if(!motionSettingsReady||!app)return;
    clearTimeout(motionSaveTimer);
    const revision=++motionSaveRevision,epoch=motionSettingsLoadEpoch,snapshot={url:$('local-motion-url').value.trim(),key:$('local-motion-key').value.trim(),parameters:readMotionFields()};
    const signature=motionParameterSignature(snapshot.parameters);
    motionConnectionState('dirty');
    motionSaveTimer=setTimeout(()=>{
      motionSaveQueue=motionSaveQueue.catch(()=>{}).then(async()=>{
        if(revision!==motionSaveRevision)return;
        if(kind==='connection'){
          const changedUrl=snapshot.url!==motionConnectionUrl;
          if(!snapshot.url)throw Error('请填写有效的 HTTPS API 地址');
          if(changedUrl&&!snapshot.key)throw Error('更换 API 地址后请填写对应的 API Key');
          if(!snapshot.key&&!motionConnectionConfigured){if(epoch===motionSettingsLoadEpoch)motionConnectionState('empty');return;}
          if(epoch===motionSettingsLoadEpoch)motionConnectionState('saving');
          const connection=await app.saveMotionConnection(snapshot.key||undefined,snapshot.url,snapshot.parameters,'auto');
          if(revision!==motionSaveRevision||epoch!==motionSettingsLoadEpoch)return;
          const fieldsUnchanged=$('local-motion-url').value.trim()===snapshot.url&&$('local-motion-key').value.trim()===snapshot.key;
          motionConnectionUrl=connection.url;motionConnectionConfigured=!!connection.configured;
          if(fieldsUnchanged)syncMotionConnection(connection,true,'saved');else updateMotionConnectionDirty();
          motionParameters=snapshot.parameters;motionLastSavedSignature=motionParameterSignature(snapshot.parameters);
          return;
        }
        if(signature===motionLastSavedSignature){if(epoch===motionSettingsLoadEpoch)updateMotionConnectionDirty();return;}
        if(epoch===motionSettingsLoadEpoch)motionConnectionState('saving');
        if(snapshot.url===motionConnectionUrl&&motionConnectionConfigured)await app.saveMotionConnection(undefined,snapshot.url,snapshot.parameters,'auto');
        else await app.saveMotionParameters(snapshot.parameters);
        if(revision!==motionSaveRevision||epoch!==motionSettingsLoadEpoch)return;
        motionParameters=snapshot.parameters;motionLastSavedSignature=signature;
        const connectionDirty=$('local-motion-url').value.trim()!==motionConnectionUrl||!!$('local-motion-key').value.trim();
        motionConnectionState(connectionDirty?'dirty':'saved');
      }).catch(error=>{
        if(revision!==motionSaveRevision||epoch!==motionSettingsLoadEpoch)return;
        motionConnectionState('error');
        settingsNotice(error.message,true);
      });
    },Math.max(0,delay));
  }
  for(const b of document.querySelectorAll('[data-local-save]'))bind(b,'click',async()=>{const started=startSaveFeedback(b);let saveError;clearSettingsNotice();try{if(b.closest('#local-relay-page')){const fields=$('local-static-advanced').querySelectorAll('input'),sampler=$('local-static-advanced').querySelector('select'),value={apiFormat:'auto',width:Number($('local-relay-width').value),height:Number($('local-relay-height').value),steps:Number(fields[0].value),scale:Number(fields[1].value),sampler:sampler.value};validateSize(value);if($('local-relay-page').dataset.filmView==='params'){const current=await app.generationSettings();await app.saveGenerationSettings(value,undefined,current.connection.url,current.connection.provider);staticConnectionState('saved');settingsNotice('生成参数已保存');return;}const key=$('local-relay-key').value.trim(),address=$('local-relay-url').value.trim(),provider=staticProviderFor(address),saved=await app.officialApiStatus(provider);if(!key&&provider!==connectionProvider)throw Error('切换 API 服务后请填写对应密钥');if(!key&&!saved.configured)throw Error('请填写当前服务的 API Key');await app.saveGenerationSettings(value,key||undefined,address,provider);connectionProvider=provider;staticConnectionState('saved');$('local-relay-key').value='';$('local-relay-key').placeholder='已保存；填写新密钥可替换';await studioSummary();}}catch(error){if(b.closest('#local-relay-page'))staticConnectionState('error');saveError=error;}finally{finishSaveFeedback(b,started,saveError);}});
  bind($('ad-settings'),'close',()=>{flushStyleDraft();document.querySelectorAll('#ad-settings input[type=password]').forEach(i=>i.value='');releaseProfiles();const saved=settingsStageContext;settingsStageContext=null;if(saved)restoreSettingsStage(saved).catch(handleUiError);});bind($('ad-settings-close'),'click',()=>{releaseProfiles();hide('ad-settings');});document.querySelectorAll('#ad-tabs button').forEach(n=>bind(n,'click',()=>page(n.dataset.page)));
  for(const [id,key]of [['ad-format','format'],['ad-ratio','ratio'],['ad-active-style','styleId']])bind($(id),'change',async()=>{const service=$('ad-format').value,value=$(id).value;await app.saveConfig(key==='format'?{format:service==='generic'?'generic':'nai45',imageService:service==='generic'?'generic':'nai45',width:app.snapshot().config.width||1216,height:app.snapshot().config.height||832}:{[key]:value});if(key==='format'){directorVisibility();studioSummary().catch(e=>status(e.message));selectOptions($('ad-active-style'),app.availableStyles(),app.snapshot().config.styleId);styleEditing=app.snapshot().config.styleId;renderStyleCards();}status('设置已自动保存');});
  for(const [id,key]of [['ad-auto-generate','autoGenerate'],['ad-auto-expand','autoExpand']])bind($(id),'change',async()=>{const checked=$(id).checked;await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));await app.saveConfig({[key]:checked});status('设置已自动保存');});
  bind($('ad-style-scope'),'change',renderStyleCards);
  bind($('city-style-cover-file'),'change',async()=>{
    const input=$('city-style-cover-file'),file=input.files[0],id=styleCoverTarget,error=$('city-style-cover-error');
    input.value='';
    if(!file||!id)return;
    try{
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024)throw Error('请选择不超过 12 MB 的 JPG、PNG 或 WebP 图片');
      const image=await createImageBitmap(file);
      let cover;
      try{
        const canvas=document.createElement('canvas');
        canvas.width=320;canvas.height=192;
        const scale=Math.max(320/image.width,192/image.height);
        const width=image.width*scale,height=image.height*scale;
        canvas.getContext('2d').drawImage(image,(320-width)/2,(192-height)/2,width,height);
        cover=canvas.toDataURL('image/jpeg',.84);
      }finally{image.close();}
      const styles=app.snapshot().styles;
      if(!styles.some(style=>style.id===id))return;
      await app.saveStyles(styles.map(style=>style.id===id?{...style,cover}:style));
      renderStyleCards();
    }catch(e){error.textContent=e.message;error.hidden=false;}
  });
  for(const id of ['ad-style-name','ad-style-basis','ad-style-positive','ad-style-negative'])bind($(id),'input',scheduleStyleSave);
  for(const id of ['ad-style-format','ad-style-use-negative'])bind($(id),'change',scheduleStyleSave);
  bind($('ad-style-apply'),'click',async()=>{
    const id=styleEditing,button=$('ad-style-apply');
    button.disabled=true;
    try{
      if(!await flushStyleDraft())return;
      await app.saveConfig({styleId:id});
      const applied=app.snapshot().config.styleId;
      paintStyleSelection(applied);
      $('city-style-save-state').textContent=applied===id?'已应用画风：'+(app.snapshot().styles.find(x=>x.id===id)?.name||'当前画风'):'请先切换到对应模式';
    }catch(error){$('city-style-save-state').textContent='应用失败';settingsNotice(error.message,true);}
    finally{button.disabled=false;}
  });bind($('ad-style-copy'),'click',()=>duplicateSelectedStyle());bind($('ad-style-new'),'click',async()=>{const id=core.id('style');await app.saveStyles([...app.snapshot().styles,{id,name:'新画风',positive:'',negative:'',useNegative:app.snapshot().config.format==='nai45',format:app.snapshot().config.format,basis:app.snapshot().config.format==='nai45'?'NAI 4.5':'通用'}]);styleEditing=id;settingsDialog('styles');editStyle(id);dismissEditing();status('新画风已创建');});
  bind($('ad-style-export'),'click',async()=>{const data=app.snapshot().styles.find(x=>x.id===app.snapshot().config.styleId);if(!data)throw Error('请先选择一款画风');const path=await tavo.file.save('ad_style_'+core.id()+'.json',JSON.stringify(data,null,2),{encoding:'utf8',scope:'chat'});await tavo.file.export(path);status('已发起画风导出');});
  bind($('ad-style-import'),'click',async()=>{const paths=await tavo.file.import({scope:'chat',extensions:['json'],multiple:false});if(!paths.length)return;const data=JSON.parse(await tavo.file.load(paths[0],{encoding:'utf8'}));if(!data||typeof data.name!=='string'||typeof data.positive!=='string')throw Error('画风文件缺少名称或正面词');const id=core.id('style');await app.saveStyles([...app.snapshot().styles,{...data,id}]);styleEditing=id;settingsDialog('styles');editStyle(id);status('画风已导入');});
  function seedCollectState(){for(const [inputId,buttonId]of [['ad-director-seed','ad-director-seed-save'],['ad-seed','ad-seed-save']]){const value=$(inputId).value.trim(),button=$(buttonId);let valid=false,seed;try{seed=core.seedValue(value,app.snapshot().config.format);valid=true;}catch{}const saved=valid&&app.snapshot().favorites.some(f=>String(f.seed)===String(seed));button.disabled=!valid;button.dataset.saved=String(saved);button.setAttribute('aria-pressed',String(saved));button.setAttribute('aria-label',saved?'这个 Seed 已收藏':'收藏 Seed');button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>'+(saved?'已收藏':'收藏');}}

  function syncSeedControls(cfg,followLatest=false){const latest=app.snapshot().latestImage,value=followLatest&&!cfg.seedFixed&&latest?(latest.seed==null?'':String(latest.seed)):cfg.seedValue;for(const prefix of ['ad-seed','ad-director-seed']){$(prefix).value=value;$(prefix+'-fixed').checked=cfg.seedFixed;}const emptyLabel=followLatest&&!cfg.seedFixed&&latest&&latest.seed==null?'图片未返回 Seed':'—';$('ad-seed').placeholder=emptyLabel;$('ad-director-seed').placeholder=emptyLabel;for(const id of ['city-seed-lock-label','city-collection-seed-lock-label'])$(id).textContent=cfg.seedFixed?'已锁定':'锁定';$('ad-director-seed-error').hidden=true;seedCollectState();}
  function refreshLatestSeed(){const snapshot=app.snapshot(),id=snapshot.latestImage?.id||'';if(id===seedImageId)return;seedImageId=id;if(!snapshot.config.seedFixed)syncSeedControls(snapshot.config,true);}

  async function saveSeedConfig(prefix='ad-seed'){const cfg=app.snapshot().config,value=$(prefix).value.trim(),fixed=$(prefix+'-fixed').checked;try{if(fixed&&!value)throw Error('暂无可锁定的 Seed，请先生成图片或使用已收藏的 Seed。');if(value||fixed)core.seedValue(value,cfg.format);await app.saveConfig({seedFixed:fixed,seedValue:value});syncSeedControls(app.snapshot().config,!fixed&&cfg.seedFixed);if($('ad-settings').dataset.currentPage==='seeds')renderSeeds();status(fixed?'已固定当前 Seed':'Seed 设置已更新');}catch(error){for(const name of ['ad-seed-fixed','ad-director-seed-fixed'])$(name).checked=cfg.seedFixed;settingsNotice(error.message);throw error;}}
  for(const prefix of ['ad-seed','ad-director-seed']){bind($(prefix+'-fixed'),'change',()=>saveSeedConfig(prefix));}
  bind($('ad-director-seed-save'),'click',()=>{const value=$('ad-director-seed').value.trim();if(!value){settingsNotice('暂无可收藏的 Seed，请先生成图片或选用已收藏的 Seed。');return;}const seed=core.seedValue(value,app.snapshot().config.format),latest=app.snapshot().latestImage;openFavorite(latest?.seed!==null&&latest?.seed!==undefined&&String(latest.seed)===value?latest:{seed,seedSource:'manual'});});
  bind($('ad-seed-save'),'click',()=>{const value=$('ad-seed').value.trim();if(!value){settingsNotice('暂无可收藏的 Seed，请先生成图片或选用已收藏的 Seed。');return;}const seed=core.seedValue(value,app.snapshot().config.format);openFavorite({seed,seedSource:'manual'});});
  bind($('ad-seed-add'),'click',()=>openFavorite(null));
  bind($('ad-favorite-cancel'),'click',()=>hide('ad-seed-favorite'));bind($('ad-seed-favorite-form'),'submit',async e=>{e.preventDefault();const button=e.currentTarget.querySelector('[type=submit]');button.disabled=true;try{
    const model=$('ad-favorite-model').value.trim();
    const item=favoriteImage??{seed:core.seedValue($('ad-favorite-seed').value)};
    if(!favoriteImage&&app.snapshot().favorites.some(f=>String(f.seed)===String(item.seed)&&f.model===model))throw Error('这个模型下已收藏该 Seed。');
    await app.favorite(item,model,$('ad-favorite-note').value);hide('ad-seed-favorite');renderSeeds();status('Seed 已收藏');}catch(error){$('ad-favorite-error').textContent=error.message;}finally{button.disabled=false;}});
  bind($('ad-prompt-close'),'click',()=>hide('ad-prompt'));
  bind($('ad-prompt'),'close',()=>{promptImage=null;});
  bind($('ad-prompt-download'),'click',()=>exportGenerationRecord());
  bind($('ad-prompt-diagnostics'),'click',()=>exportGenerationRecord(true));
  bind($('ad-log-export'),'click',async()=>{await downloadLog(logs);status('已发起记录导出');});
  bind($('ad-log-detail-close'),'click',()=>hide('ad-log-detail'));
  bind($('ad-log-detail'),'close',()=>{
    const row=selectedLog;selectedLog=null;
    if(row&&!$('ad-log-list').closest('[data-ad-page]').hidden){
      [...$('ad-log-list').children].find(card=>card.taskRecord===row)?.querySelector('button')?.focus({preventScroll:true});
    }
  });
  bind($('ad-log-detail-export'),'click',async()=>{
    if(!selectedLog)return;
    const button=$('ad-log-detail-export'),feedback=$('ad-log-detail-feedback');
    button.disabled=true;feedback.textContent='';feedback.removeAttribute('aria-label');feedback.removeAttribute('title');
    try{await downloadLog([selectedLog]);status('已发起记录导出');}catch(error){feedback.textContent=error.message;feedback.title=error.message;}finally{button.disabled=false;}
  });
  bind($('ad-log-clear'),'click',()=>{logs.length=0;renderLogs();status('任务记录已清空');});
  bind($('addock-fullview-image-wrap'),'wheel',e=>{e.preventDefault();zoom=Math.max(1,Math.min(4,zoom+(e.deltaY<0?.2:-.2)));if(zoom===1)pan={x:0,y:0};transform();});
  const touches=new Map();let pinch=null,lastTap=0;
  const distance=()=>{const [a,b]=[...touches.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
  for(const [id,delta]of [['addock-zoom-out',-.25],['addock-zoom-reset',0],['addock-zoom-in',.25]])bind($(id),'click',()=>{zoom=delta?Math.max(1,Math.min(4,zoom+delta)):1;if(zoom===1)pan={x:0,y:0};transform();});
  const toggleZoom=()=>{zoom=zoom===1?2:1;pan={x:0,y:0};transform();};
  bind($('addock-fullview-image-wrap'),'dblclick',e=>{if(e.target.closest('button'))return;if(!e.sourceCapabilities?.firesTouchEvents)toggleZoom();});
  bind($('addock-fullview-image-wrap'),'pointerdown',e=>{if(e.target.closest('button'))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});pointer={x:e.clientX,y:e.clientY,pan:{...pan},at:Date.now(),multi:touches.size>1};if(touches.size===2)pinch={distance:distance(),zoom};e.currentTarget.setPointerCapture?.(e.pointerId);});
  bind($('addock-fullview-image-wrap'),'pointermove',e=>{if(!touches.has(e.pointerId))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size>1&&pinch){zoom=Math.max(1,Math.min(4,pinch.zoom*distance()/Math.max(1,pinch.distance)));if(pointer)pointer.multi=true;transform();}else if(pointer&&zoom>1){pan={x:pointer.pan.x+e.clientX-pointer.x,y:pointer.pan.y+e.clientY-pointer.y};transform();}});
  bind($('addock-fullview-image-wrap'),'pointerup',e=>{if(!touches.has(e.pointerId))return;if(pointer&&!pointer.multi){const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(zoom===1&&Math.abs(dx)>60)move(dx<0?1:-1);else if(e.pointerType==='touch'&&Math.hypot(dx,dy)<12&&Date.now()-pointer.at<250){const now=Date.now();if(now-lastTap<300){toggleZoom();lastTap=0;}else lastTap=now;}}touches.delete(e.pointerId);pinch=null;pointer=null;});
  bind($('addock-fullview-image-wrap'),'pointercancel',e=>{touches.delete(e.pointerId);pinch=null;pointer=null;lastTap=0;});
  bind(host,'keydown',e=>{if(viewer&&e.key==='Escape')closeViewer();else if(viewer&&e.key==='ArrowLeft')move(-1);else if(viewer&&e.key==='ArrowRight')move(1);});
  function command(detail){if(!app){host.__ADirectorPendingCommand=detail;return;}host.__ADirectorPendingCommand=null;if(detail.name==='next')nextDialog(detail.kind);if(detail.name==='stage')return openStage();if(detail.name==='settings')settingsDialog();}
  bind(host,'adirector:state',e=>{
    const event=e.detail;
    if(event.type==='ready'&&host.__ADirectorApp!==app)connect();
    if(event.type==='removed'){
      document.querySelectorAll('.addock-history-row').forEach(node=>{if(node.dataset.messageId===String(event.messageId))node.remove();});
      if(String(event.messageId)===mid){
        deleteTarget=null;hide('ad-image-delete');if(viewer)closeViewer(false);
        if(event.replaced){renderEpoch++;record=null;imageIndex=0;render().catch(handleUiError);}
        else if(!follow){follow=true;Promise.resolve(followCurrentReply()).catch(handleUiError);}
      }
    }
    if(event.type==='closed'){deleteTarget=null;hide('ad-image-delete');}
  });
  bind(host,'adirector:command',e=>command(e.detail));
  function onState(event){
    if(event.type==='regeneration'&&String(event.messageId)===mid){renderEpoch++;render().catch(handleUiError);}
    if(['settings','styles','ready'].includes(event.type))settingsFieldsDirty=true;
    reader?.refresh(event).catch(error=>status(error.message));
    if(['record','removed','ready'].includes(event.type))refreshLatestSeed();
    writeLog(event);
    if(event.type==='settings'){seedCollectState();studioSummary().catch(e=>status(e.message));}
    if(event.type==='notice'){if($('ad-settings').open&&needsSettingsAttention(event.message))settingsNotice(event.message);else status(event.message);}
    if(event.type==='message'||event.type==='ready'||(event.type==='removed'&&!event.replaced))Promise.resolve(followCurrentReply()).catch(handleUiError);
    if(event.type==='record'&&((follow&&String(event.messageId)===String(currentCardMessage()))||String(event.messageId)===String(mid))){
      mid=String(event.messageId);record=event.record;
      if(record?.plan||record?.images?.length){canSupplementBody=false;canRecoverPlan=false;}
      if(['queued','generating'].includes(record.status)){displayError='';displayLoading=false;}
      imageIndex=Math.max(0,record.images.findIndex(i=>i.id===record.currentImageId));
      refreshRecoveryAvailability(mid,record).catch(e=>status(e.message));
    }
    if(event.type==='activity'){
      const task=event.task||event.activity;
      if(event.task)keepCardResult(task);
      if(task?.phase==='preparing'&&(task.messageId?String(task.messageId)===String(mid):follow))displayError='';
    }
    if(event.type==='record'&&event.imageCompleted&&app.snapshot().config.autoExpand&&String(event.messageId)===String(currentCardMessage())&&app.cardImages(event.messageId,event.record).length&&dock.hidden&&!reader?.isOpen()&&!viewer&&!document.querySelector('.ad-modal[open]'))openStage().catch(error=>status(error.message));
    if(event.type==='closed'){
      hide('ad-prompt');promptImage=null;
      clearCardResult();viewedCompletions.clear();viewedFailures.clear();$('film-quick').close();registrationState=null;paintRegistration();releaseProfiles();displayLoading=false;displayError='';settingsStageContext=null;closeStage();hide('ad-settings');hide('ad-next');hide('addock-motion-dialog');hide('addock-scene-dialog');mid='';record=null;canSupplementBody=false;canRecoverPlan=false;
    }
    if(event.type==='ready')status('导演运行时已就绪');
    paintState();
  }

  function connect(){const current=host.__ADirectorApp;if(disposed||!current)return false;if(current===app)return true;unsubscribe?.();app=current;core=host.__ADirectorCore;unsubscribe=app.subscribe(onState);seedImageId='';refreshLatestSeed();root.disabled=false;paintState();status(host.__ADirectorBootError||'导演界面已连接');if(host.__ADirectorPendingCommand)Promise.resolve(command(host.__ADirectorPendingCommand)).catch(e=>status(e.message));return true;}

  // Studio navigation reuses the existing controls and their persistence handlers.
  let studioReady=false,studioEpoch=0;
  function studioPanel(name){
    if(!studioReady)return;
    const panelBefore=[...document.querySelectorAll('[data-studio-panel]')].find(p=>!p.hidden)?.dataset.studioPanel;
    $('ad-settings').dataset.studioView=name==='home'&&$('ad-settings').dataset.currentPage==='settings'?'home':'detail';
    for(const n of document.querySelectorAll('[data-studio-panel]'))n.hidden=n.dataset.studioPanel!==name;
    if(panelBefore!==name)$('ad-workspace-content').scrollTop=0;
  }
  async function studioSummary(refreshFields=false){
    if(!app||!studioReady)return;const epoch=++studioEpoch,s=app.snapshot(),cfg=s.config;
    const style=s.styles.find(x=>x.id===cfg.styleId);
    $('studio-style-name').textContent=style?.name||'选择画风';
    const cover=$('city-home-style-cover'),art=style?.cover;
    cover.hidden=!art;
    if(art&&cover.getAttribute('src')!==art)cover.src=art;
    const generic=genericModeSelected(cfg);const data=await app.generationSettings(cfg.imageService==='official'?'official':cfg.imageService==='relay'?'thirdparty':undefined);if(epoch!==studioEpoch)return;studioUpdateHeading();
    $('studio-frame-summary').textContent=(generic?'跟随通用 API':data.relay.width+' × '+data.relay.height+' px');
    $('studio-service-summary').textContent=generic?'跟随 Tavo':data.connection.configured?'已配置':'未配置';
    $('studio-service').dataset.configured=String(!generic&&data.connection.configured);
    $('studio-service').disabled=generic;$('film-params').hidden=generic;
    $('studio-frame-size').hidden=generic;$('studio-home-quick-size').hidden=generic;
    if(refreshFields||$('studio-frame-panel').hidden){$('studio-width').value=data.relay.width;$('studio-height').value=data.relay.height;}syncSizePresets();
  }
  function studioRoute(name,panel){
    if(!studioReady)return;studioPanel(panel);
    const resource=['profiles','styles','seeds'].includes(name);
    $('studio-resources').hidden=!resource;
    for(const b of document.querySelectorAll('[data-studio-resource]'))b.setAttribute('aria-selected',String(b.dataset.studioResource===name));
    const navPage=name==='tutorial-motion'?'tutorial':name;for(const b of document.querySelectorAll('[data-studio-nav]'))b.setAttribute('aria-selected',String(b.dataset.studioNav===navPage));
    if(name==='settings'){for(const id of ['studio-size-status','studio-quick-size-status']){$(id).textContent='未修改';$(id).dataset.error='false';}studioSummary(panel==='frame').catch(e=>status(e.message));}
  }
  let studioHeadingObserver;
  function studioUpdateHeading(){
    if(!studioReady)return;const selected=$('ad-settings').dataset.currentPage;let title='导演工作台';
    if(!$('local-relay-page').hidden)title=$('local-relay-page').dataset.filmView==='params'?'生成参数':'静态 API 设置';else if(!$('studio-frame-panel').hidden)title='图片尺寸';else if(selected==='resources')title='资源';else if(selected==='tutorial')title='使用教程';else if(selected==='tutorial-motion')title='动态 CG 示例';else if(selected==='api')title='动态设置';else if(selected==='logs')title='运行记录';else if(selected==='profiles')title=$('ad-profile-editor').hidden?'人物档案':'编辑角色';else if(selected==='styles')title=$('ad-style-editor').hidden?'画风管理':'编辑画风';else if(selected==='seeds')title='种子收藏';
    const navPage=selected==='tutorial-motion'?'tutorial':selected;for(const b of document.querySelectorAll('[data-studio-nav]'))b.setAttribute('aria-selected',String(b.dataset.studioNav===(title==='图片尺寸'?'frame':title==='生成参数'?'params':navPage)));
    if($('studio-page-title').textContent!==title)$('studio-page-title').textContent=title;
    const headings={
      '导演工作台':['home','DIRECTOR’S DESK'],'静态 API 设置':['static','STATIC API'],'生成参数':['params','GENERATION'],
      '图片尺寸':['size','IMAGE SIZE'],'资源':['resources','ASSETS'],'动态设置':['motion','DYNAMIC CG'],'运行记录':['logs','RUNTIME LOGS'],
      '人物档案':['profiles','CHARACTERS'],'编辑角色':['profile','EDIT CHARACTER'],'画风管理':['styles','STYLE PRESETS'],
      '编辑画风':['style','EDIT STYLE'],'种子收藏':['seed','SEED LIBRARY'],'使用教程':['tutorial','QUICK GUIDE'],'动态 CG 示例':['motionGuide','DYNAMIC CG']
    };
    const [art,captionText]=headings[title];
    $('studio-page-title').dataset.deskRoute=art;
    const caption=document.querySelector('.city-title-caption');
    if(caption.textContent!==captionText)caption.textContent=captionText;
    if(caption.hidden===Boolean(captionText))caption.hidden=!captionText;
    const editingStyle=selected==='styles'&&!$('ad-style-editor').hidden,editingProfile=selected==='profiles'&&!$('ad-profile-editor').hidden;const showResources=false;if($('studio-resources').hidden===showResources)$('studio-resources').hidden=!showResources;
    $('ad-settings').dataset.resourceTabs=String(showResources);$('studio-global-back').setAttribute('aria-label',editingStyle?'返回画风列表':editingProfile?'返回角色列表':!$('local-relay-page').hidden&&relayReturn==='api'?'返回动态设置':'返回上一级');
    if($('ad-style-delete').hidden===editingStyle)$('ad-style-delete').hidden=!editingStyle;if($('ad-profile-delete').hidden===editingProfile)$('ad-profile-delete').hidden=!editingProfile;
    const generic=genericModeSelected();$('city-mode').textContent=$('ad-format').selectedOptions[0]?.textContent||'';syncNaiOnlyNavigation(generic);if($('studio-static-fields').hidden!==generic)$('studio-static-fields').hidden=generic;if($('studio-generic-note').hidden===generic)$('studio-generic-note').hidden=!generic;
  }
  function studioBack(){
    const selected=$('ad-settings').dataset.currentPage;
    if(!$('local-relay-page').hidden){page(relayReturn,relayReturn==='api');return;}
    if(selected==='tutorial-motion'){page('tutorial');return;}
    if(selected==='profiles'&&!$('ad-profile-editor').hidden){page('profiles');return;}
    if(selected==='styles'&&!$('ad-style-editor').hidden){styleView(false);return;}
    if(!$('studio-frame-panel').hidden){studioPanel('home');return;}
    if($('film-quick').open){$('film-quick').close();return;}
    if(['profiles','styles','seeds'].includes(selected)){page('settings');return;}
    if(selected==='settings'){hide('ad-settings');return;}
    page('settings');
  }
  function setupStudio(){
    bind($('studio-global-back'),'click',studioBack);
    let swipeStart=null;
    bind(contentViewport,'touchstart',event=>{
      swipeStart=null;
      if(event.touches.length!==1||event.target.closest('input,textarea,select,[contenteditable=true]'))return;
      const {identifier,clientX,clientY}=event.touches[0];
      swipeStart={identifier,clientX,clientY};
    });
    bind(contentViewport,'touchcancel',()=>{swipeStart=null;});
    bind(contentViewport,'touchend',event=>{
      const start=swipeStart;swipeStart=null;
      if(!start||event.touches.length)return;
      const touch=[...event.changedTouches].find(point=>point.identifier===start.identifier);
      if(!touch)return;
      const horizontal=Math.abs(touch.clientX-start.clientX),vertical=Math.abs(touch.clientY-start.clientY);
      if(horizontal>=64&&horizontal>vertical*1.6)studioBack();
    });
    studioHeadingObserver=new MutationObserver(()=>studioUpdateHeading());studioHeadingObserver.observe($('ad-workspace-content'),{subtree:true,attributes:true,attributeFilter:['hidden']});
    for(const b of document.querySelectorAll('[data-studio-resource]'))bind(b,'click',()=>page(b.dataset.studioResource));
    for(const b of document.querySelectorAll('[data-studio-nav]'))bind(b,'click',async()=>{
      const route=b.dataset.studioNav;
      if(genericModeSelected()&&['api','frame','params'].includes(route))return;
      if(route==='frame'){page('settings',false,'frame');studioUpdateHeading();return;}
      if(route==='params'){await openRelay('settings',undefined,'params');return;}
      if($('ad-settings').open){
        const selected=$('ad-settings').dataset.currentPage;
        const inSubview=!$('local-relay-page').hidden||!$('studio-frame-panel').hidden||selected==='styles'&&!$('ad-style-editor').hidden||selected==='profiles'&&!$('ad-profile-editor').hidden;
        if(selected===route&&!inSubview)return;
        page(route);return;
      }
      settingsDialog(route);
    });
    let pickerTrigger;
    const picker=$('film-quick');
    function placePicker(){
      if(!picker.open||!pickerTrigger)return;
      const paper=$('ad-workspace-content').getBoundingClientRect();
      const {clientWidth,clientHeight}=document.documentElement;
      const left=Math.max(8,paper.left+5),right=Math.min(clientWidth-8,paper.right-5);
      const width=Math.min(300,right-left);
      picker.style.width=width+'px';
      picker.style.left=(left+(right-left-width)/2)+'px';
      const title=$('studio-page-title').getBoundingClientRect();
      const bottom=Math.min(clientHeight-8,paper.bottom-6);
      const top=Math.max(8,Math.min(title.bottom+16,bottom-140));
      picker.style.top=top+'px';
      picker.style.maxHeight=Math.min(286,bottom-top)+'px';
    }
    function showPicker(){
      picker.showModal();
      placePicker();
      (picker.querySelector('[aria-pressed=true]')||$('film-quick-close')).focus({preventScroll:true});
    }
    bind(window,'resize',placePicker);
    const closePicker=()=>{$('film-quick').close();pickerTrigger?.focus();};
    bind($('film-quick-close'),'click',closePicker);
    bind($('film-quick'),'cancel',event=>{event.preventDefault();closePicker();});
    bind($('film-quick'),'click',event=>{if(event.target!==$('film-quick'))return;const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closePicker();});
    function openSelectPicker(trigger,select,title){
      pickerTrigger=trigger;
      $('city-picker-title').textContent=title;
      const options=$('film-style-options');
      options.replaceChildren();
      for(const option of select.options){
        const button=document.createElement('button');
        button.type='button';button.textContent=option.textContent;
        button.setAttribute('aria-pressed',String(option.selected));
        bind(button,'click',()=>{
          select.value=option.value;
          select.dispatchEvent(new Event('change',{bubbles:true}));
          studioUpdateHeading();
          closePicker();
        });
        options.append(button);
      }
      showPicker();
    }
    bind($('city-mode'),'click',()=>openSelectPicker($('city-mode'),$('ad-format'),'切换模式'));
    bind($('city-style-scope'),'click',()=>openSelectPicker($('city-style-scope'),$('ad-style-scope'),'显示范围'));
    bind($('film-style-manage'),'click',()=>settingsDialog('styles'));
    bind($('studio-style'),'click',()=>{
      pickerTrigger=$('studio-style');
      $('city-picker-title').textContent='切换画风';
      const current=app.snapshot().config.styleId;
      const options=$('film-style-options');
      options.replaceChildren();
      for(const style of app.availableStyles()){
        const button=document.createElement('button');
        button.type='button';
        button.textContent=style.name;
        button.setAttribute('aria-pressed',String(style.id===current));
        bind(button,'click',async()=>{
          await selectStyleCard(style.id,style.name);
          $('film-quick').close();
          await studioSummary();
          $('studio-style').focus();
        });
        options.append(button);
      }
      showPicker();
    });
    bind($('studio-frame'),'click',()=>{page('settings',false,'frame');studioUpdateHeading();});
    for(const b of document.querySelectorAll('[data-tutorial-home]'))bind(b,'click',()=>page('settings'));
    for(const b of document.querySelectorAll('[data-tutorial-motion]'))bind(b,'click',()=>page('tutorial-motion'));
    for(const b of document.querySelectorAll('[data-tutorial-return]'))bind(b,'click',()=>page('tutorial'));
    bind($('studio-service'),'click',()=>openRelay('settings'));
    bind($('film-params'),'click',()=>openRelay('settings',undefined,'params'));
    bind($('studio-logs'),'click',()=>page('logs'));
    for(const b of document.querySelectorAll('.studio-back,.studio-home-return'))bind(b,'click',()=>{page('settings');});
    let sizeSaveQueue=Promise.resolve(),sizeSaveRevision=0;
    function autoSaveSize(quiet=false){const value={width:Number($('studio-width').value),height:Number($('studio-height').value)},revision=++sizeSaveRevision,labels=[$('studio-size-status'),$('studio-quick-size-status')];const tell=(msg,error=false)=>{for(const node of labels){node.textContent=msg;node.dataset.error=String(error);}};try{validateSize(value);}catch(error){tell('尺寸无效',true);settingsNotice(error.message,true);return Promise.resolve();}tell('保存中…');sizeSaveQueue=sizeSaveQueue.catch(()=>{}).then(async()=>{const cfg=app.snapshot().config,d=await app.generationSettings(cfg.imageService==='official'?'official':cfg.imageService==='relay'?'thirdparty':undefined);if(d.relay.width===value.width&&d.relay.height===value.height){if(revision===sizeSaveRevision)tell('未修改');return;}await app.saveGenerationSettings({...d.relay,...value},undefined,d.connection.url,d.connection.provider);if(revision===sizeSaveRevision){await studioSummary();tell('尺寸已保存 · '+value.width+' × '+value.height);if(!quiet)status('已应用 '+value.width+' × '+value.height);}}).catch(error=>{if(revision===sizeSaveRevision){tell('保存失败，请重试',true);settingsNotice(error.message,true);}});return sizeSaveQueue;}
    for(const b of document.querySelectorAll('[data-studio-size]'))bind(b,'click',async()=>{const [w,h]=b.dataset.studioSize.split(',');$('studio-width').value=w;$('studio-height').value=h;syncSizePresets();await autoSaveSize(!!b.closest('#studio-home-quick-size'));});
    for(const id of ['studio-width','studio-height']){bind($(id),'input',()=>{syncSizePresets();$('studio-size-status').textContent='待保存';$('studio-size-status').dataset.error='false';});bind($(id),'change',()=>autoSaveSize());}
    studioReady=true;studioUpdateHeading();
  }
  setupStudio();

  root.disabled=true;let attempts=0;const timer=setInterval(()=>{if(connect()||++attempts>=40){clearInterval(timer);if(!app){root.disabled=false;root.onclick=()=>{if(!connect())status('导演入口尚未加载，请重新打开聊天');};}}},250);
  const observer=new MutationObserver(()=>{if(root.isConnected||disposed)return;disposed=true;reader?.destroy();for(const clean of noticeCleanups)clean();releaseProfiles();studioHeadingObserver?.disconnect();clearInterval(timer);unsubscribe?.();for(const [n,t,f]of bindings)n.removeEventListener(t,f);observer.disconnect();memory?.clear($('addock-main-image'));memory?.clear($('addock-motion-image'));memory?.clear($('addock-fullview-image'));memory?.clear($('addock-fullview-motion-image'));motionDialog.remove();});observer.observe(root.parentNode,{childList:true});
  host.__ADirectorUI={openReader,readerState:()=>reader?.state(),openStage,nextDialog,settingsDialog,openDetails,state:()=>({messageId:mid,record,viewer,disposed,phase:dock.dataset.directorPhase}),version:'0.1.0-alpha.223'};
})(tavo);








