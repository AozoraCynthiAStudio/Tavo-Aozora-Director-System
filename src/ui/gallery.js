'use strict';
window.ADirectorGallery=function(tavo,{app,openViewer,confirmManagement,container,openPage}){
  const pageSize=24;
  const handoff='aozora-director-gallery-chat';
  const dialog=container;
  const header=document.createElement('header'),tabs=document.createElement('nav'),body=document.createElement('section'),status=document.createElement('p');
  tabs.setAttribute('aria-label','图库范围');
  status.setAttribute('role','status');
  dialog.append(tabs,header,status,body);

  let files=[],page=0,position=-1,storyId='',revision=0,ascending=false,busy=false,scope='chat',groupId='',selecting=false,viewingStory=false,storyPage=0;
  const selected=new Set();
  function button(parent,label,action,disabled=false){
    const node=document.createElement('button');
    node.type='button';
    node.textContent=label;
    node.disabled=disabled;
    node.onclick=()=>Promise.resolve().then(action).catch(error=>{status.textContent=error.message;});
    parent.append(node);
    return node;
  }
  function reset(title){
    header.replaceChildren();header.classList.remove('logs-toolbar');
    body.replaceChildren();
    status.textContent='';
    const heading=document.createElement('h2');
    heading.textContent=title;
    header.append(heading);

    tabs.replaceChildren();
    for(const [value,label] of [['chat','故事图片'],['global','全局图库']]){
      const tab=button(tabs,label,value==='chat'?open:openGlobal,busy);
      tab.setAttribute('aria-pressed',String(scope===value));
    }

  }
  function close(){
    revision++;
    header.replaceChildren();tabs.replaceChildren();
    body.replaceChildren();
    files=[];
    position=-1;
    selected.clear();selecting=false;
  }
  async function open(){
    scope='chat';groupId='';position=-1;selected.clear();selecting=false;
    const version=++revision;
    viewingStory=false;reset('本地故事');
    if(typeof tavo.chat.find!=='function')throw Error('当前 Tavo 版本无法读取故事列表');
    const result=await tavo.chat.find();
    if(version!==revision)return;
    const stories=Array.isArray(result)?result:result?.items;
    if(!Array.isArray(stories))throw Error('无法读取故事列表');
    storyPage=Math.min(storyPage,Math.max(0,Math.ceil(stories.length/12)-1));
    for(const story of stories.slice(storyPage*12,(storyPage+1)*12)){
      const date=new Date(story.updatedAt||story.createdAt||NaN);
      const name=story.displayTitle||story.name||story.title||'未命名故事';
      button(body,name+(Number.isNaN(date.getTime())?'':' · '+date.toLocaleString()),async()=>{
        if(String(story.id)===String(app().snapshot().chatId))return loadFiles(story.id);
        if(typeof tavo.chat.open!=='function')throw Error('请打开此故事后进入本地图片');
        sessionStorage.setItem(handoff,String(story.id));
        try{
          const opened=await tavo.chat.open(Number(story.id));
          if(!opened)throw Error('无法打开此故事');
          resume();
        }catch(error){sessionStorage.removeItem(handoff);throw error;}
      },busy);
    }
    storyPager(stories.length,open);
    if(!stories.length)status.textContent='没有可读取的故事';
  }
  async function openGlobal(){
    scope='global';groupId='';position=-1;selected.clear();selecting=false;
    const version=++revision;
    viewingStory=false;reset('全局图库');
    status.textContent='正在读取图片…';
    const entries=await app().galleryFiles('global');
    if(version!==revision)return;
    const groups=new Map();
    for(const file of entries){
      if(!groups.has(file.chatId))groups.set(file.chatId,[]);
      groups.get(file.chatId).push(file);
    }
    status.textContent=groups.size?entries.length+' 张图片 · '+groups.size+' 个故事':'全局图库暂无图片。新版生成的青空图片会自动收录。';
    storyPage=Math.min(storyPage,Math.max(0,Math.ceil(groups.size/12)-1));
    for(const [id,items] of [...groups].slice(storyPage*12,(storyPage+1)*12)){
      const latest=items.reduce((value,file)=>String(file.modifiedAt||'')>value?String(file.modifiedAt):value,'');
      const date=latest?new Date(latest).toLocaleString():'';
      button(body,[items[0].storyName||'故事 '+id,items.length+' 张',date].filter(Boolean).join(' · '),()=>{
        files=items;groupId=id;storyId=String(app().snapshot().chatId);page=0;sortFiles();render();
      });
    }
    storyPager(groups.size,openGlobal);
  }
  function storyPager(total,reload){
    const pages=Math.ceil(total/12);if(pages<2)return;
    const pager=document.createElement('footer');pager.className='ad-gallery-pager';body.append(pager);
    button(pager,'上一页',()=>{storyPage--;return reload();},storyPage===0);
    const count=document.createElement('span');count.textContent=(storyPage+1)+' / '+pages;pager.append(count);
    button(pager,'下一页',()=>{storyPage++;return reload();},storyPage+1===pages);
  }
  function resume(){
    const id=sessionStorage.getItem(handoff);
    if(!id||id!==String(app()?.snapshot().chatId))return;
    openPage();
  }
  function enter(){
    const id=sessionStorage.getItem(handoff);
    const active=String(app()?.snapshot().chatId);
    if(id===active){sessionStorage.removeItem(handoff);loadFiles(id).catch(error=>{status.textContent=error.message;});return;}
    open().catch(error=>{status.textContent=error.message;});
  }
  async function loadFiles(id){
    const version=++revision;
    scope='chat';groupId='';
    if(storyId!==String(id)){storyId=String(id);page=0;}
    position=-1;
    selected.clear();selecting=false;
    reset('本地图片');
    status.textContent='正在读取图片…';
    const result=await app().galleryFiles();
    if(version!==revision)return;
    files=result;
    sortFiles();
    render();
  }
  function sortFiles(){
    files.sort((a,b)=>(String(a.modifiedAt||'').localeCompare(String(b.modifiedAt||''))||a.name.localeCompare(b.name))*(ascending?1:-1));
  }
  function picture(file){
    const image=document.createElement('img');
    image.alt=file.name;
    const chatId=app().snapshot().chatId;
    const missing=()=>{if(image.isConnected)image.closest('button, section')?.classList.add('ad-gallery-image-unavailable');};
    image.addEventListener('error',async()=>{
      try{
        if(!image.isConnected||chatId!==app().snapshot().chatId)return;
        const data=await app().imageUrl(file.path,true);
        if(image.isConnected&&chatId===app().snapshot().chatId)image.src=data;
      }catch{missing();}
    },{once:true});
    Promise.resolve(app().imageUrl(file.path)).then(url=>{if(image.isConnected&&chatId===app().snapshot().chatId)image.src=url;}).catch(missing);
    return image;
  }
  async function removeFromViewer(pointer){
    await app().deleteGalleryFiles([pointer],storyId,scope);
    files=files.filter(file=>file.path!==pointer);selected.delete(pointer);render();
  }
  function preview(index){return openViewer(files.slice(),index,removeFromViewer);}
  function back(){
    if(!viewingStory||busy)return busy;
    (scope==='global'?openGlobal:open)().catch(error=>{status.textContent=error.message;});
    return true;
  }
  function render(){
    viewingStory=true;reset(files.length+' 张图片');
    const tools=document.createElement('div');tools.className='ad-gallery-tools logs-toolbar';header.append(tools);
    const pages=Math.max(1,Math.ceil(files.length/pageSize));
    page=Math.max(0,Math.min(page,pages-1));
    const rows=files.slice(page*pageSize,(page+1)*pageSize);
    const toggle=()=>{selecting=!selecting;if(!selecting)selected.clear();render();};
    if(selecting){
      const all=rows.every(file=>selected.has(file.path));
      button(tools,all?'取消本页':'全选本页',()=>{for(const file of rows){if(all)selected.delete(file.path);else selected.add(file.path);}render();},busy||!rows.length);
      button(tools,'删除所选（'+selected.size+'）',()=>confirmFiles(files.filter(file=>selected.has(file.path))),busy||!selected.size);
    }else{
      button(tools,ascending?'最早优先':'最新优先',()=>{ascending=!ascending;sortFiles();page=0;render();},busy||files.length<2);
      button(tools,'清空故事图片',()=>confirmFiles(files),busy||!files.length).dataset.secondary='true';
    }
    button(tools,selecting?'完成多选':'多选',toggle,busy||!files.length);
    if(!files.length)status.textContent='这个故事没有可读取的青空图片';
    const grid=document.createElement('div');
    grid.className='ad-gallery-grid';
    body.append(grid);
    for(const [offset,file] of rows.entries()){
      const tile=document.createElement('article'),select=document.createElement('input');
      select.type='checkbox';
      select.checked=selected.has(file.path);
      select.disabled=busy;
      select.setAttribute('aria-label','选择 '+file.name);
      select.onchange=()=>{
        if(select.checked)selected.add(file.path);else selected.delete(file.path);
        render();
      };
      const thumbnail=picture(file);
      thumbnail.loading='lazy';
      const openImage=button(tile,'',()=>preview(page*pageSize+offset),busy);
      openImage.setAttribute('aria-label','查看 '+file.name);
      openImage.append(thumbnail);
      if(selecting)tile.append(select);
      grid.append(tile);
    }
    if(pages>1){
      const pager=document.createElement('footer');pager.className='ad-gallery-pager';body.append(pager);
      button(pager,'上一页',()=>{page--;render();},busy||page===0);
      const count=document.createElement('span');count.textContent=(page+1)+' / '+pages;pager.append(count);
      button(pager,'下一页',()=>{page++;render();},busy||page+1===pages);
    }
  }
  function confirmFiles(rows){
    if(busy||!rows.length)return;
    const id=storyId,targetScope=scope,targetGroup=groupId,pointers=rows.map(file=>file.path);
    const size=rows.reduce((total,file)=>total+Number(file.size||0),0);
    const description='将永久删除 '+rows.length+' 张图片，约 '+(size/1048576).toFixed(1)+' MiB。聊天正文会保留。';
    confirmManagement('确认删除图片？',description,async()=>{
      if(busy)return;
      busy=true;
      try{await app().deleteGalleryFiles(pointers,id,targetScope);}
      finally{busy=false;}
      if(dialog.hidden||String(app().snapshot().chatId)!==id)return;
      if(targetScope==='chat'){await loadFiles(id);return;}
      const entries=await app().galleryFiles('global');
      files=entries.filter(file=>file.chatId===targetGroup);position=-1;selected.clear();selecting=false;sortFiles();render();
    });
  }
  dialog.addEventListener('keydown',event=>{
    if(position<0||busy||!dialog.querySelector('.ad-gallery-large'))return;
    const target=position+(event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0);
    if(target!==position&&files[target]){event.preventDefault();preview(target);}
  });
  return {enter,resume,close,back,destroy:close};
};
