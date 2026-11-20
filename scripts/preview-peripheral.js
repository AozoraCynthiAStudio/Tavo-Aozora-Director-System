__PREVIEW_READER_SOURCE__

async function setupPeripheralPreview(){
  const surface=new URLSearchParams(location.search).get('surface');
  if(!['directory','detail','viewer','dialog','launcher','notice'].includes(surface))return false;
  const byId=id=>document.getElementById(id);
  const imageUrl='__PREVIEW_IMAGE__';
  const texts=[
    '雨停以后，城市的倒影仍留在路面上。她从站台走下来，听见远处最后一班列车驶过。',
    '灯光扫过玻璃，一闪而逝。结衣转过头，望向对岸的高楼。<p>「我们在这儿再等一会儿吧。」她收起手里的车票，语气很轻。</p><p>桥上的车流逐渐慢下来。风吹过河岸，水面上的灯光一层层散开。</p>',
    '天边亮起一点微光。两人走进街角的咖啡店，把湿漉漉的外套挂在门边。',
    '门铃响了一声，店员把两杯热咖啡放到桌上。窗外的街道安静下来。'
  ];
  const rows=texts.map((content,i)=>({id:String(i+1),role:'assistant',content}));
  const cg={id:'demo-cg',pointer:'files/chat/preview-picture.png',seed:3828828633};
  const record={status:'done',currentImageId:cg.id,images:[cg],plan:{scene:'夜色中的站台',characters:[{name:'示例角色',form:'默认形态',identity:'深色短发',outfit:'长外套'}]}};
  const app=window.__ADirectorApp;
  Object.assign(app,{
    getMessage:async id=>rows.find(row=>row.id===String(id)),
    readRecord:async id=>String(id)==='2'?record:null,
    imageUrl:async()=>imageUrl,
    index:async()=>[{messageId:'2',count:1}]
  });
  window.tavo.message.count=async()=>rows.length;
  window.tavo.message.find=async([start,end])=>rows.slice(start,end+1);
  const file=window.tavo.file;
  const exists=file.exists;
  const url=file.url;
  file.exists=async(name,...args)=>name===window.TestCore.thumbnailName(cg.pointer)||exists(name,...args);
  file.url=async(name,...args)=>name===window.TestCore.thumbnailName(cg.pointer)?imageUrl:url?.(name,...args);
  if(surface==='directory'||surface==='detail'){
    await window.__ADirectorUI.openReader('2');
    if(surface==='directory'){byId('ar-directory').click();await new Promise(resolve=>setTimeout(resolve,100));}
  }else if(surface==='viewer'){
    await window.__ADirectorUI.openStage('2');
    byId('addock-main-image').click();
  }else if(surface==='dialog'){
    byId('addock-motion-dialog').showModal();
  }else{
    const launcher=byId('ad-launcher');
    launcher.dataset.phase=surface==='launcher'?'generating':'failed';
    byId('ad-launcher-caption').hidden=false;(byId('ad-launcher-caption').querySelector('.ad-caption-copy')||byId('ad-launcher-caption')).textContent=surface==='launcher'?'正在生成':'生成失败';
    if(surface==='notice'){
      window.__ADirectorUI.settingsDialog('api');
      await new Promise(resolve=>setTimeout(resolve,120));
      const field=byId('local-motion-key');
      field.value='short';
      document.querySelector('.ad-local-motion [data-local-save]').click();
    }
  }
  return true;
}
