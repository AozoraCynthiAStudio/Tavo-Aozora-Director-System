/* Settings-shell notices only. Do not add generic status rows to popups. */
(()=>{
 'use strict';window.ADirectorSettingsNotices?.dispose();
 const settings=document.getElementById('ad-settings');if(!settings)return;
 const node=document.createElement('div');node.id='ad-settings-notification';node.dataset.adSurface='settings-notice';node.hidden=true;node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.setAttribute('aria-atomic','true');
 const glyph=document.createElement('span'),label=document.createElement('span');glyph.className='ad-notice-glyph';glyph.setAttribute('aria-hidden','true');label.className='ad-notice-text';node.append(glyph,label);settings.append(node);
 const svg=path=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+path+'</svg>',icons={success:svg('<path d="m5 12 4 4L19 6"/>'),warning:svg('<path d="M12 5v9"/><circle cx="12" cy="19" r="1" fill="currentColor"/>'),error:svg('<path d="m6 6 12 12M18 6 6 18"/>'),info:svg('<circle cx="12" cy="12" r="9"/><path d="M12 10v7M12 6v1"/>')};
 let timer=0,closing=0,frame=0,current=null,pending=null,disposed=false;
 const clean=text=>String(text||'').replace(/\s+/g,' ').trim();
 const ignore=text=>!text||/^(修改后自动保存|自动保存|设置自动保存|点选即保存|保存中[.…]*|正在保存[.…]*|待保存|修改中[.…]*|导演界面已连接|导演运行时已就绪|导演界面已连接到运行时)$/.test(text);
 function kind(text){if(/失败|错误|无效|未完成|未能|无法|不可用|未保存|未成功|出错|权限|error|failed|invalid|unauthorized|forbidden|timeout|HTTP\s*[45]\d{2}/i.test(text))return 'error';if(/警告|重复|请先|暂无|尚未|未配置|待确认|请填写/.test(text))return 'warning';return /已|成功|完成|复制|恢复|导入|导出/.test(text)?'success':'info';}
 function childDialogOpen(){return [...document.querySelectorAll('dialog[open]')].some(dialog=>dialog!==settings);}
 function clearVisible(){clearTimeout(timer);clearTimeout(closing);timer=0;closing=0;if(node.hidden){current=null;return;}node.classList.add('is-leaving');closing=setTimeout(()=>{node.hidden=true;node.classList.remove('is-leaving');current=null;},matchMedia('(prefers-reduced-motion: reduce)').matches?0:150);}
 function clear(){pending=null;clearVisible();}
 function show(text,options={}){
  text=clean(text);if(disposed||!settings.open||ignore(text))return false;
  const tone=options.kind||kind(text);
  if(childDialogOpen()){pending={text,options:{...options,kind:tone}};clearVisible();return true;}
  pending=null;clearTimeout(timer);clearTimeout(closing);node.classList.remove('is-leaving');const fresh=node.hidden;node.hidden=false;
  if(!current||current.text!==text||current.kind!==tone){label.textContent=text;glyph.innerHTML=icons[tone]||icons.info;node.dataset.kind=tone;node.setAttribute('aria-label',text);}
  current={text,kind:tone};place();if(fresh&&!matchMedia('(prefers-reduced-motion: reduce)').matches)node.animate([{opacity:0},{opacity:1}],{duration:140});
  const duration=options.duration||({success:2500,info:3000,warning:4200,error:6000}[tone]);timer=setTimeout(clearVisible,duration);return true;
 }
 function flushPending(){if(!pending)return;if(!settings.open){pending=null;return;}if(childDialogOpen())return;const item=pending;pending=null;show(item.text,item.options);}
 const set=(key,value)=>{if(node.style[key]!==value)node.style[key]=value};
 function place(){frame=0;if(disposed||node.hidden||!settings.open)return;
  const area=settings.getBoundingClientRect(),card=settings.querySelector('.pp-canvas'),box=card?.getBoundingClientRect();
  const left=box?box.left-area.left+12:Math.max(14,area.width-394),width=box?box.width-24:Math.min(area.width-28,380);
  set('left',left+'px');set('maxWidth',Math.max(140,width)+'px');
  const height=node.getBoundingClientRect().height,bottom=Math.min(innerHeight,area.bottom)-area.top-8;
  let top=box?box.bottom-area.top+8:bottom-height;if(top+height>bottom)top=bottom-height;if(top<8)top=8;
  set('top',top+'px');
 }
 function schedule(){if(!frame&&!disposed&&!node.hidden)frame=requestAnimationFrame(place);}
 // Kept as a compatibility hook for existing dialog openers. It deliberately creates no popup UI.
 function prepareDialog(dialog){if(dialog&&dialog!==settings)clearVisible();}
 const modalObserver=new MutationObserver(()=>{flushPending();schedule();});modalObserver.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
 settings.addEventListener('close',clear);
 window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);
 window.ADirectorSettingsNotices={show,clear,prepareDialog,reposition:schedule,dispose(){disposed=true;clearTimeout(timer);clearTimeout(closing);cancelAnimationFrame(frame);modalObserver.disconnect();settings.removeEventListener('close',clear);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);node.remove();}};
})();
