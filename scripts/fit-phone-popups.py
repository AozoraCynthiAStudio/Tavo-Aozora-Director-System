from pathlib import Path
p=Path(r"Y:/Workspace/Tavo/测试版/Aozora-PhantomPop-alpha207-phone-20261110/src/ui/phantom.js")
s=p.read_text(encoding="utf-8-sig")
a=s.index("  for(const id of known){")
b=s.index("  const actions=",a)
s=s[:a]+"""  for(const id of known){const d=$(id);if(d)mountDialog(d);}
  mountDialog(picker);
  fitDialogs();
"""+s[b:]
a=s.index(" let frame=0,disposed=false;")
s=s[:a]+"""
 const popupObservers=[];
 function mountDialog(dialog){
  if(dialog.dataset.ppPopup)return;
  dialog.dataset.ppPopup='true';dialog.classList.add('ph-dialog');
  const nodes=[...dialog.childNodes];
  const position=document.createElement('div');position.className='ph-pop-position';
  const card=document.createElement('div');card.className='ph-pop-card';
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
   const scale=Math.max(.1,Math.min((area.width-16)/360,(area.height-16)/Math.max(1,card.offsetHeight),1.2));
   card.style.transform='scale('+scale+')';
   dialog.querySelector('.ph-pop-position').style.height=card.offsetHeight+'px';
   dialog.dataset.ppFitted='true';
  }
 }
"""+s[a:]
s=s.replace("document.addEventListener('click',click,true);","window.visualViewport?.addEventListener('resize',fitDialogs);window.addEventListener('resize',fitDialogs);"+chr(10)+" document.addEventListener('click',click,true);")
s=s.replace("disposed=true;observer.disconnect();","disposed=true;popupObservers.forEach(ro=>ro.disconnect());window.visualViewport?.removeEventListener('resize',fitDialogs);window.removeEventListener('resize',fitDialogs);observer.disconnect();")
p.write_text(s,encoding="utf-8")
