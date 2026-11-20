/* Faint scroll-position hints for native WebView scroll owners. */
(()=>{
 'use strict';window.ADirectorScrollHints?.dispose();
 const selector=['.pp-ui .pp-page','.pp-ui textarea','.ph-pop-card textarea','.ph-choice-options','#ad-record-content','#ar-directory-list','#ar-prose','.ad-log-detail-body'].join(',');
 const entries=new Map();let frame=0,disposed=false;
 const write=(el,key,value)=>{if(el.style[key]!==value)el.style[key]=value;};
 function update(entry){
  const {el,rail,thumb}=entry;const visible=el.isConnected&&el.getClientRects().length&&getComputedStyle(el).visibility==='visible'&&el.clientHeight>0&&el.scrollHeight>el.clientHeight+2;
  if(!visible){if(!rail.hidden)rail.hidden=true;return;}
  const host=el.closest('dialog[open]')||el.closest('#ad-reader')||document.body;if(rail.parentElement!==host)host.append(rail);
  const rect=el.getBoundingClientRect(),box=host===document.body?{left:0,top:0}:host.getBoundingClientRect();
  const surface=el.closest('.pp-ui,.ar-surface,.ph-pop-card'),edge=surface?.getBoundingClientRect(),scale=edge?edge.width/Math.max(1,surface.clientWidth):1;const desired=el.tagName==='TEXTAREA'?rect.right+3*scale:Math.max(rect.right+5*scale,edge?edge.right-(surface.classList.contains('ph-pop-card')?22:8)*scale:rect.right+5);const railLeft=Math.min(desired,edge?edge.right-4*scale:innerWidth-4);
  const height=Math.max(0,rect.height-10),thumbHeight=Math.min(height,Math.max(18,height*el.clientHeight/el.scrollHeight)),travel=Math.max(0,height-thumbHeight);
  const ratio=Math.max(0,Math.min(1,el.scrollTop/Math.max(1,el.scrollHeight-el.clientHeight)));
  write(rail,'left',(railLeft-box.left)+'px');write(rail,'top',(rect.top-box.top+5)+'px');write(rail,'height',height+'px');
  write(thumb,'height',thumbHeight+'px');write(thumb,'transform','translateY('+(travel*ratio)+'px)');if(rail.hidden)rail.hidden=false;
 }
 function mount(el){
  const rail=document.createElement('span'),thumb=document.createElement('i');rail.className='ad-scroll-hint';rail.dataset.adSurface='scroll-hint';rail.setAttribute('aria-hidden','true');rail.hidden=true;rail.append(thumb);thumb.className='ad-scroll-thumb';el.dataset.adScrollManaged='true';
  const entry={el,rail,thumb,timer:0};entry.scroll=()=>{rail.classList.add('is-scrolling');update(entry);clearTimeout(entry.timer);entry.timer=setTimeout(()=>rail.classList.remove('is-scrolling'),650);};
  entry.resize=new ResizeObserver(schedule);entry.resize.observe(el);el.addEventListener('scroll',entry.scroll,{passive:true});entry.input=()=>update(entry);el.addEventListener('input',entry.input,{passive:true});entries.set(el,entry);update(entry);
 }
 function remove(entry){clearTimeout(entry.timer);entry.resize.disconnect();entry.el.removeEventListener('scroll',entry.scroll);entry.el.removeEventListener('input',entry.input);entry.el.removeAttribute('data-ad-scroll-managed');entry.rail.remove();}
 function refresh(){frame=0;if(disposed)return;for(const [el,entry]of entries)if(!el.isConnected){remove(entry);entries.delete(el);}for(const el of document.querySelectorAll(selector))if(!entries.has(el))mount(el);for(const entry of entries.values())update(entry);}
 function schedule(){if(!frame&&!disposed)frame=requestAnimationFrame(refresh);}
 const observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['open','hidden','data-current-page','data-directory','data-pp-ready','data-film-view','data-profile-editing']});window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);
 window.ADirectorScrollHints={refresh:schedule,dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);for(const e of entries.values())remove(e);entries.clear();}};schedule();
})();
