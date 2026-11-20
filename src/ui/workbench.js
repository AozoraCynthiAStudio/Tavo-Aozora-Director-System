/* Adapt existing controller-owned elements into the approved fixed canvas. */
(()=>{
 'use strict';
 window.__AozoraWorkbenchDispose?.();
 const $=id=>document.getElementById(id),root=$('ad-settings');
 if(!root)return;
 const make=(tag,cls)=>{const el=document.createElement(tag);el.className=cls;return el;};
 const add=(id,cls)=>{const el=$(id);if(el)el.classList.add(...cls.split(' '));return el;};
 const mast=root.querySelector('.studio-topbar'),nav=$('studio-navigation'),paper=$('ad-workspace-content'),title=paper.querySelector('.film-title'),back=$('studio-global-back');
 root.classList.add('pp-menu-dialog');
 const position=make('div','pp-position'),canvas=make('div','pp-canvas'),screen=make('div','pp-screen-bg'),ui=make('div','pp-ui'),desk=make('div','desk'),foot=make('footer','footer');
 const housing=make('div','pp-housing');housing.setAttribute('aria-hidden','true');
 const nameplate=make('span','pp-nameplate');nameplate.textContent='Aozora Director';nameplate.setAttribute('aria-hidden','true');
 mast.className='mast';mast.querySelectorAll('.phone-art,.film-brand,.studio-page-heading-art,.studio-logo').forEach(el=>el.hidden=true);
 add('ad-settings-close','close');
 nav.className='rail';paper.classList.add('paper');title.className='film-title page-heading';
 title.querySelectorAll('.phone-art,.film-title-ticket').forEach(el=>el.hidden=true);
 back.className='return';back.querySelectorAll('*').forEach(el=>el.hidden=true);
 const footerArt=make('div','footer-art pp-footer-art');footerArt.setAttribute('aria-hidden','true');foot.append(footerArt,back);
 desk.append(nav,paper);ui.append(mast,desk,foot);canvas.append(screen,ui,housing,nameplate);position.append(canvas);root.append(position);
 for(const button of nav.querySelectorAll('button')){
  const label={settings:'导演',profiles:'角色',styles:'画风',seeds:'Seed',api:'动态',logs:'记录',frame:'尺寸',params:'参数',tutorial:'教程'}[button.dataset.studioNav];
  button.setAttribute('aria-label',label);
 }
 const tutorialIconSources={
  history:['addock-history-button','.addock-line-icon'],settings:['addock-config','.addock-line-icon'],
  reroll:['addock-generate','.addock-action-refresh'],add:['addock-add','.addock-line-icon'],
  tune:['addock-tune','.addock-line-icon'],register:['addock-dna-open','.addock-line-icon'],
  motion:['addock-motion','.addock-line-icon'],delete:['addock-keep','.addock-line-icon']
 };
 for(const slot of document.querySelectorAll('[data-tutorial-icon]')){
  const source=tutorialIconSources[slot.dataset.tutorialIcon],button=source&&$(source[0]),svg=button?.querySelector(source[1]);
  if(!svg)continue;
  const icon=svg.cloneNode(true);icon.removeAttribute('hidden');icon.setAttribute('aria-hidden','true');icon.classList.add('tutorial-inline-icon');slot.replaceChildren(icon);
 }
 // Home controls retain their IDs and listener-bearing nodes.
 const home=$('studio-home');home.classList.add('controls','pp-home');
 home.querySelector('.film-mode').classList.add('pp-home-mode');
 const modeLabel=$('ad-format').closest('label');modeLabel.classList.add('row');
 const modeHeading=modeLabel.querySelector('.ad-field-heading');modeHeading.classList.add('label');modeHeading.insertAdjacentHTML('afterbegin','<i class="pp-field-icon pp-gear" aria-hidden="true"></i>');
 add('city-mode','control dark');
 const service=$('studio-service');service.classList.add('row','pp-service-row');
 const serviceName=service.querySelector('strong'),summary=$('studio-service-summary');
 const apiLabel=make('span','label');apiLabel.innerHTML='<i class="pp-field-icon pp-link" aria-hidden="true"></i>';apiLabel.append(serviceName);
 summary.classList.add('control','light');service.replaceChildren(apiLabel,summary);
 const styleRow=home.querySelector('.studio-home-style-rail');styleRow.classList.add('row');
 const styleLabel=styleRow.querySelector('.studio-home-style-index');styleLabel.classList.add('label');styleLabel.querySelector('b')?.remove();
 styleLabel.insertAdjacentHTML('afterbegin','<i class="pp-field-icon pp-reel" aria-hidden="true"></i>');
 add('studio-style','control style-card');
 const ratio=$('studio-home-quick-size');ratio.classList.add('ratios');
 const ratioHeading=ratio.querySelector('.studio-quick-size-heading');ratioHeading.classList.add('ratio-heading');
 const ratioTitle=document.createElement('h2');ratioTitle.textContent='快捷小图比例';ratioHeading.querySelector('strong').replaceWith(ratioTitle);
 const note=ratioHeading.querySelector('.city-ratio-note');if(note){const small=document.createElement('small');small.textContent=note.textContent;note.replaceWith(small);}
 ratio.querySelector('.studio-size-presets').classList.add('ratio-list');
 const shapes=['wide','portrait','square'],labels=['横图','竖图','方图'];
 ratio.querySelectorAll('[data-studio-size]').forEach((b,i)=>{b.classList.add('ratio',shapes[i]);b.textContent=labels[i];});
 const seedPanel=home.querySelector('.studio-home-seed-panel');seedPanel.classList.add('pp-home-seed');
 const seedRow=seedPanel.querySelector('.film-seed-row');seedRow.classList.add('row','seed');
 const seedLabel=seedRow.querySelector('label');seedLabel.classList.add('label');seedLabel.insertAdjacentHTML('afterbegin','<i class="pp-field-icon pp-gear" aria-hidden="true"></i>');
 add('ad-director-seed','control light');
 const actions=make('div','seed-actions');
 actions.append($('ad-director-seed-save'),seedRow.querySelector('.studio-seed-toggle'));seedPanel.append(actions);
 for(const row of home.querySelectorAll('.studio-option-row')){
  row.classList.add('option');row.querySelector('.studio-option-icon').hidden=true;
  const label=row.querySelector('.studio-option-label');label.querySelector('small')?.remove();
  row.querySelector('.studio-toggle').hidden=true;
 }
 // Pages share one viewport and scroll only in their content panes.
 for(const section of paper.querySelectorAll(':scope > section'))section.classList.add('pp-page');
 add('ad-profiles-browse','pp-character-browser');
 add('ad-profile-list','pp-character-list');
 add('ad-profile-editor','pp-character-editor');
 root.querySelector('.ad-profile-edit-body').classList.add('character-edit-layout');
 root.querySelector('.ad-profile-fields').classList.add('character-fields');
 root.querySelector('.ad-profile-actions').classList.add('character-editor-actions');
 root.querySelector('.studio-profile-heading').classList.add('character-list-heading');
 root.querySelector('.ad-profile-edit-body aside').classList.add('pp-character-preview');
 root.querySelector('.ad-profile-note').classList.add('character-note');
 add('ad-style-browse','pp-style-browser');add('ad-style-editor','pp-style-editor');add('ad-style-cards','pp-style-cards');
 add('ad-style-library-toolbar','style-toolbar');
 root.querySelector('.ad-style-filter').classList.add('style-scope');
 root.querySelector('.ad-style-meta-fields').classList.add('style-meta-fields');
 root.querySelector('.ad-style-savebar').classList.add('style-editor-actions');
 root.querySelectorAll('.city-style-form>label').forEach(el=>el.classList.add('style-prompt'));
 add('ad-style-apply','apply-style');
 add('city-current-seed','seed-current');
 const collectionRow=$('city-current-seed').querySelector('.film-seed-row');
 collectionRow.classList.add('row','seed');
 const collectionLabel=collectionRow.querySelector('label');collectionLabel.classList.add('label');collectionLabel.insertAdjacentHTML('afterbegin','<i class="pp-field-icon pp-gear" aria-hidden="true"></i>');
 const collectionActions=make('div','seed-actions');collectionActions.append($('ad-seed-save'),collectionRow.querySelector('.studio-seed-toggle'));$('city-current-seed').append(collectionActions);

 root.querySelector('.city-seed-list-heading').classList.add('seed-heading','seed-list-heading');
 add('ad-seed-list','pp-seed-list');add('ad-seed-add','pp-seed-add');
 root.querySelector('.ad-log-toolbar').classList.add('logs-toolbar');add('ad-log-list','pp-logs-list');
 add('ad-motion-settings','pp-motion-form');
 const relay=$('local-relay-page');relay.classList.add('pp-static-form');
 root.querySelectorAll('.city-static-connection').forEach(el=>el.classList.add('motion-section'));
 root.querySelectorAll('.city-setting-field').forEach(el=>el.classList.add('motion-field'));
 root.querySelectorAll('.city-setting-field-head').forEach(el=>el.classList.add('motion-field-head'));
 root.querySelectorAll('.local-actions').forEach(el=>el.classList.add('motion-actions'));
 root.querySelectorAll('.static-api-tools').forEach(el=>el.classList.add('motion-tools'));
 root.querySelector('.motion-advanced-heading').classList.add('motion-heading');
 add('local-motion-advanced','motion-section motion-advanced');
 root.querySelector('.city-motion-options').classList.add('motion-grid');
 root.querySelector('.city-motion-scale').classList.add('motion-scale');
 add('studio-frame-panel','pp-size-page');
 root.querySelector('.studio-dimensions').classList.add('size-dimensions');
 root.querySelector('#studio-frame-panel .studio-size-presets').classList.add('size-presets');

 root.querySelectorAll('#studio-frame-panel .studio-group-heading').forEach(el=>el.classList.add('size-heading'));
 root.querySelectorAll('#studio-frame-panel .studio-help-copy,#studio-frame-panel .city-size-hint').forEach(el=>el.classList.add('size-note'));
 add('local-static-advanced','pp-params');
 const params=$('local-static-advanced');
 params.querySelector('.local-params-heading').classList.add('params-heading');
 params.querySelector('.local-grid').classList.add('params-grid');
 // The real title observer continues to own title text and selected navigation.
 const feedbackText=new WeakMap();
 let frame=0,lastScale=1,disposed=false,wasOpen=false;
 function fit(){
  const scale=window.ADirectorFrameLayout.fit(root,canvas);if(!scale)return;lastScale=scale;
  const text=scale.toFixed(4);if(root.dataset.ppScale!==text)root.dataset.ppScale=text;if(root.dataset.ppReady!=='true')root.dataset.ppReady='true';
 }
 function refresh(){
  frame=0;if(disposed)return;
  if(!root.isConnected){window.__AozoraWorkbenchDispose?.();return;}
  const page=root.dataset.currentPage;
  ui.classList.toggle('character-studio',page==='profiles');
  ui.classList.toggle('style-studio',page==='styles');
  ui.classList.toggle('seed-studio',page==='seeds');
  ui.classList.toggle('motion-studio',page==='api');
  ui.classList.toggle('logs-studio',page==='logs');
  ui.classList.toggle('tutorial-studio',page==='tutorial'||page==='tutorial-motion');
  ui.classList.toggle('tutorial-motion-studio',page==='tutorial-motion');
  ui.classList.toggle('size-studio',!$('studio-frame-panel').hidden);
  ui.classList.toggle('params-studio',relay.dataset.filmView==='params'&&!relay.hidden);
  ui.classList.toggle('static-api-studio',!relay.hidden&&relay.dataset.filmView!=='params');
  for(const wrap of root.querySelectorAll('.ad-profile-card-wrap:not([data-pp-ready])')){
   wrap.dataset.ppReady='true';wrap.classList.add('character-card');
   wrap.querySelector('.ad-profile-card').classList.add('character-open');
   wrap.querySelector('.ad-profile-photo').classList.add('character-photo');
   wrap.querySelector('.ad-profile-meta').classList.add('character-meta');
   wrap.querySelector('.ad-profile-meta small').classList.add('character-sub');
   wrap.querySelector('.city-profile-form').classList.add('character-form');
   wrap.querySelector('.city-profile-registered').classList.add('character-registered');
   const arrow=wrap.querySelector('.city-profile-arrow');arrow.classList.add('character-arrow');arrow.textContent='›';
   wrap.querySelector('.ad-profile-remove').classList.add('character-remove');
  }
  for(const wrap of root.querySelectorAll('.ad-style-preset:not([data-pp-ready])')){
   wrap.dataset.ppReady='true';wrap.classList.add('style-tile');
   const card=wrap.querySelector('.ad-style-preset-card');card.classList.add('style-select');
   const artwork=card.querySelector('.studio-preset-cover');
   if(artwork)artwork.classList.add('pp-style-art');
   const name=card.querySelector('strong'),model=card.querySelector('.ad-style-model');
   const meta=make('span','style-meta');meta.append(name);if(model)meta.append(model);card.append(meta);
   card.querySelectorAll('.ad-style-card-top,.ad-style-card-number').forEach(el=>el.hidden=true);
   wrap.querySelector('.city-style-actions').classList.add('style-card-tools');
   wrap.querySelector('.ad-style-edit').classList.add('style-edit');wrap.querySelector('.ad-style-remove').classList.add('style-card-delete');
   wrap.querySelectorAll('.city-style-actions span').forEach(el=>el.hidden=true);
  }
  for(const wrap of root.querySelectorAll('.ad-style-preset')){const active=wrap.querySelector('.ad-style-preset-card').dataset.active;if(wrap.dataset.active!==active)wrap.dataset.active=active;}
  for(const row of root.querySelectorAll('.city-seed-row:not([data-pp-ready])')){
   row.dataset.ppReady='true';row.classList.add('seed-item');
   row.querySelector('.city-seed-row-icon').classList.add('seed-emblem');
   row.querySelector('.city-seed-row-copy').classList.add('seed-copy');
   row.querySelector('.city-seed-use').classList.add('seed-use');row.querySelector('.city-seed-remove').classList.add('seed-remove');
  }

  for(const card of root.querySelectorAll('.ad-log-entry:not([data-pp-ready])')){
   card.dataset.ppReady='true';
   const row=card.taskRecord,button=card.querySelector('button');if(!row||!button)continue;
   card.dataset.status=row.status;
   const badge=button.querySelector('.ad-log-badge');
   const copy=make('span','log-copy'),line=make('span','log-title-line');
   const name=document.createElement('strong');name.textContent=row.title;
   line.append(name,badge);
   const meta=make('span','log-meta');
   const seconds=Math.max(0,((row.finishedAt||row.updatedAt||row.startedAt)-(row.startedAt||0))/1000);
   meta.textContent=[new Date(row.startedAt||Date.now()).toLocaleTimeString('zh-CN',{hour12:false}),'耗时 '+seconds.toFixed(1)+' 秒',row.messageId?'回复 '+row.messageId:''].filter(Boolean).join(' · ');
   const summary=make('span','log-summary');summary.textContent=row.error||row.warning||(row.status==='done'?'任务已完成':row.status==='uncertain'?'结果待确认，可导出详情协助排查。':'查看运行详情');
   copy.append(line,meta,summary);
   const symbol=make('span','log-symbol');symbol.setAttribute('aria-hidden','true');symbol.innerHTML='<svg viewBox="0 0 32 36"><path d="M7 4h15l5 6v22H5V6ZM21 4v7h6M9 16h13M9 21h13M9 26h8M2 10v24h19" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
   const arrow=make('span','log-arrow');arrow.textContent='›';arrow.setAttribute('aria-hidden','true');
   button.replaceChildren(symbol,copy,arrow);
  }
  if($('ad-log-export').textContent!=='导出全部详情')$('ad-log-export').textContent='导出全部详情';
  if($('ad-log-detail-export').textContent!=='导出详情')$('ad-log-detail-export').textContent='导出详情';
  for(const status of root.querySelectorAll('.pp-ui [role="status"]:not(.ad-sr-only)')){
   const text=status.textContent.trim(),old=feedbackText.get(status);feedbackText.set(status,text);
   status.dataset.ppFeedback=/失败|错误|无效/.test(text)?'error':/已.*保存|已.*应用|成功|完成/.test(text)?'success':'pending';
   if(old!==undefined&&text&&old!==text&&!matchMedia('(prefers-reduced-motion: reduce)').matches){status._ppFlash?.cancel();status._ppFlash=status.animate([{backgroundColor:'#d8ad6766'},{backgroundColor:'transparent'}],{duration:650});}
  }
  if(root.open&&!wasOpen)fit();wasOpen=root.open;window.ADirectorScrollHints?.refresh();
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(refresh);}
 const observer=new MutationObserver(schedule);
 observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['open','hidden','data-current-page','data-film-view','data-active']});
 const resizeObserver=new ResizeObserver(fit);resizeObserver.observe(root);
 window.visualViewport?.addEventListener('resize',fit);
 refresh();
 window.__AozoraWorkbenchDispose=()=>{disposed=true;observer.disconnect();resizeObserver.disconnect();cancelAnimationFrame(frame);window.visualViewport?.removeEventListener('resize',fit);};
})();
