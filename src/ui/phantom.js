/* UI-only integration. Data and command handlers remain in controller.js. */
(()=>{
 'use strict';
 window.__ADPhantomDispose?.();
 const root=document.getElementById('ad-settings');if(!root)return;
 const $=id=>document.getElementById(id);
 const avatar=document.createElement('span');avatar.className='ph-avatar';avatar.setAttribute('aria-hidden','true');$('ad-launcher')?.prepend(avatar);
 const picker=document.createElement('dialog');picker.id='ph-choice';picker.className='ph-dialog';
 const fill=document.createElement('i');fill.className='ph-fill';fill.setAttribute('aria-hidden','true');
 const title=document.createElement('h3');title.id='ph-choice-title';title.className='ph-heading';
 picker.setAttribute('aria-labelledby',title.id);
 const choices=document.createElement('div');choices.className='ph-choice-options';
 const footer=document.createElement('footer');const back=document.createElement('button');back.type='button';back.textContent='返回';back.addEventListener('click',()=>picker.close());
 footer.append(back);picker.append(fill,title,choices,footer);document.body.append(picker);
 function choose(select){
  if(!select||select.disabled)return;
  let label=select.labels?.[0]?.cloneNode(true);label?.querySelectorAll('select,button,input,small,output').forEach(n=>n.remove());
  title.textContent=select.id==='ad-format'?'当前模式':label?.querySelector('.ad-field-title')?.textContent.trim()||select.getAttribute('aria-label')||label?.textContent.trim()||'选择选项';choices.replaceChildren();
  for(const option of select.options){
   if(option.hidden)continue;const b=document.createElement('button');b.type='button';b.textContent=option.textContent;b.disabled=option.disabled;b.setAttribute('aria-pressed',String(option.selected));
   b.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));picker.close();});choices.append(b);
  }
  if(!picker.open){window.ADirectorSettingsNotices?.prepareDialog(picker);picker.showModal();}
 }
 function click(event){
  const select=event.target.closest('select');
  if(select&&root.contains(select)){event.preventDefault();event.stopImmediatePropagation();choose(select);return;}
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.id==='city-mode'||button.id==='city-style-scope'){event.preventDefault();event.stopImmediatePropagation();choose($(button.id==='city-mode'?'ad-format':'ad-style-scope'));return;}
  if(button.id==='studio-style'){event.preventDefault();event.stopImmediatePropagation();root.querySelector('[data-studio-nav=styles]')?.click();}
 }
 function pointer(event){if(event.button!==undefined&&event.button!==0)return;const select=event.target.closest('select');if(select&&root.contains(select)){event.preventDefault();event.stopImmediatePropagation();}}
 function key(event){if(event.key!=='Enter'&&event.key!==' ')return;const select=event.target.closest('select');if(select&&root.contains(select)){event.preventDefault();choose(select);}}
 const known=['ad-next','ad-log-detail','ad-seed-favorite','ad-prompt','ad-image-delete','addock-scene-dialog','addock-tune-dialog','addock-dna-dialog','ad-manage-confirm','ad-registration-result','ad-seed-locked','addock-motion-dialog','ad-avatar-crop'];

 const popupObservers=[];
 function mountDialog(dialog){
  if(dialog.dataset.ppPopup)return;
  dialog.dataset.ppPopup='true';dialog.dataset.adSurface='popup';dialog.classList.add('ph-dialog');
  const nodes=[...dialog.childNodes];
  const position=document.createElement('div');position.className='ph-pop-position';
  const card=document.createElement('div');card.className='ph-pop-card';
  if(dialog.id==='ad-avatar-crop')card.classList.add('ad-avatar-crop-card');
  card.append(...nodes);
  let f=card.querySelector('.ph-fill');if(!f){f=document.createElement('i');f.className='ph-fill';f.setAttribute('aria-hidden','true');card.prepend(f);}
  card.querySelector('h3')?.classList.add('ph-heading');
  card.querySelectorAll('button').forEach(b=>{if(b.textContent.trim()==='取消')b.textContent='返回';});
  position.append(card);dialog.append(position);
  const ro=new ResizeObserver(fitDialogs);ro.observe(card);popupObservers.push(ro);
 }
 function fitDialogs(){
  for(const dialog of document.querySelectorAll('dialog.ph-dialog[open]')){
   const card=dialog.querySelector('.ph-pop-card');if(!card)continue;
   const area=dialog.getBoundingClientRect();
   const maxScale=dialog.id==='ad-avatar-crop' ? 0.95 : 1.2;
   const scale=Math.max(.1,Math.min((area.width-32)/360,(area.height-16)/Math.max(1,card.offsetHeight),maxScale));
   const transform='scale('+scale+')';if(card.style.transform!==transform)card.style.transform=transform;
   const visibleHeight=card.offsetHeight*scale,center=Math.max(visibleHeight/2+12,Math.min(area.height-visibleHeight/2-12,area.height*.42));
   const position=dialog.querySelector('.ph-pop-position');const y=center+'px';if(position.style.top!==y)position.style.top=y;
   dialog.querySelector('.ph-pop-position').style.height=card.offsetHeight+'px';
   dialog.dataset.ppFitted='true';
  }
  window.ADirectorSettingsNotices?.reposition();
 }
 let frame=0,disposed=false;
 function decorate(){
  frame=0;if(disposed)return;if(!root.isConnected){window.__ADPhantomDispose?.();return;}
  for(const id of known){const d=$(id);if(d)mountDialog(d);}
  mountDialog(picker);
  fitDialogs();
  const actions=$('ad-viewer-actions'),bar=document.querySelector('#addock-fullview .addock-fullview-bar'),close=$('addock-fullview-close');
  if(actions&&bar&&close&&actions.parentElement!==bar)bar.insertBefore(actions,close);
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(decorate);}
 const observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open','hidden','data-directory']});
 window.visualViewport?.addEventListener('resize',fitDialogs);window.addEventListener('resize',fitDialogs);
 let touchY=null;
 function popupTouchStart(event){
  touchY=event.touches.length===1&&event.target.closest?.('dialog.ph-dialog[open]')?event.touches[0].clientY:null;
 }
 function popupTouchMove(event){
  if(touchY===null||event.touches.length!==1)return;
  const dialog=event.target.closest?.('dialog.ph-dialog[open]');
  if(!dialog)return;
  const y=event.touches[0].clientY,dy=y-touchY;touchY=y;
  if(!dy)return;
  for(let node=event.target;node&&node!==dialog;node=node.parentElement){
   if(!/^(auto|scroll)$/.test(getComputedStyle(node).overflowY)||node.scrollHeight<=node.clientHeight)continue;
   if(dy>0?node.scrollTop>0:node.scrollTop+node.clientHeight<node.scrollHeight-1)return;
  }
  if(event.cancelable)event.preventDefault();
 }
 document.addEventListener('touchstart',popupTouchStart,{capture:true,passive:true});
 document.addEventListener('touchmove',popupTouchMove,{capture:true,passive:false});
 document.addEventListener('click',click,true);document.addEventListener('pointerdown',pointer,true);document.addEventListener('keydown',key,true);decorate();
 window.__ADPhantomDispose=()=>{disposed=true;popupObservers.forEach(ro=>ro.disconnect());window.visualViewport?.removeEventListener('resize',fitDialogs);window.removeEventListener('resize',fitDialogs);observer.disconnect();cancelAnimationFrame(frame);document.removeEventListener('touchstart',popupTouchStart,true);document.removeEventListener('touchmove',popupTouchMove,true);document.removeEventListener('click',click,true);document.removeEventListener('pointerdown',pointer,true);document.removeEventListener('keydown',key,true);picker.remove();avatar.remove();};
})();

