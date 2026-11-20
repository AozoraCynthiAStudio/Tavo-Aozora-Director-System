(() => {
  const controls = [
    ['mast','招牌','.studio-topbar'],
    ['heading','页面标题','.film-title'],
    ['navigation','侧栏导航','#studio-navigation'],
    ['mode','模式行','.film-mode>label'],
    ['api','静态 API 行','#studio-service'],
    ['style','画风行','.studio-home-style-rail'],
    ['ratioTitle','快捷比例标题','.studio-quick-size-heading'],
    ['ratioWide','横图','.studio-size-presets-quick button:nth-child(1)'],
    ['ratioPortrait','竖图','.studio-size-presets-quick button:nth-child(2)'],
    ['ratioSquare','方图','.studio-size-presets-quick button:nth-child(3)'],
    ['seed','Seed 整组','.film-seed-row'],
    ['favorite','收藏按钮','#ad-director-seed-save'],
    ['lock','锁定按钮','.film-seed-row .studio-seed-toggle'],
    ['auto','自动生成行','.studio-option-row:nth-child(1)'],
    ['expand','完成后展开行','.studio-option-row:nth-child(2)'],
    ['close','关闭按钮','#ad-settings-close'],
    ['back','返回按钮','#studio-global-back'],
    ['headingText','导演工作台大标题','#studio-page-title'],
    ['headingCaption','标题旁英文','.city-title-caption'],
    ['modeLabel','模式文字','.film-mode .ad-field-title'],
    ['modeButton','模式按钮','#city-mode'],
    ['apiLabel','静态 API 文字','#studio-service strong'],
    ['apiStatus','API 状态按钮','#studio-service-summary'],
    ['styleLabel','画风文字','.studio-home-style-index'],
    ['styleButton','画风按钮','#studio-style'],
    ['styleName','当前画风名称','#studio-style-name'],
    ['ratioHeading','快捷比例文字','.studio-quick-size-heading strong'],
    ['ratioHint','快捷比例说明','.city-ratio-note'],
    ['seedLabel','当前 Seed 标签','.film-seed-row>label:first-child'],
    ['seedValue','Seed 数值框','.film-seed-value'],
    ['seedNumber','Seed 数字','#ad-director-seed'],
    ['favoriteIcon','收藏图标','#ad-director-seed-save svg'],
    ['lockIcon','锁定图标','.film-seed-row .studio-seed-toggle svg'],
    ['autoLabel','自动生成文字','.studio-option-row:nth-child(1) .studio-option-label'],
    ['autoSwitch','自动生成开关','.studio-option-row:nth-child(1) .studio-toggle'],
    ['expandLabel','完成后展开文字','.studio-option-row:nth-child(2) .studio-option-label'],
    ['expandSwitch','完成后展开开关','.studio-option-row:nth-child(2) .studio-toggle']
  ].map(([id,label,selector])=>({id,label,selector}));
  const send=(type,data={})=>parent.postMessage({type,...data},'*');
  let enabled=false,selected='heading',edits={},drag=null;

  const css=document.createElement('style');
  css.textContent='[data-preview-editing] [data-preview-tunable]{cursor:move;touch-action:none}[data-preview-editing] [data-preview-picked]{outline:2px dashed #1cb7d1!important;outline-offset:2px}';
  document.head.append(css);
  function apply(){
    document.documentElement.toggleAttribute('data-preview-editing',enabled);
    for(const {selector,id} of controls){
      const node=document.querySelector(selector);
      if(!node)continue;
      node.dataset.previewTunable=id;
      const value=edits[id];
      node.style.translate=value?(value.x||0)+'px '+(value.y||0)+'px':'';
      node.style.width=value?.width?value.width+'px':'';
      node.style.height=value?.height?value.height+'px':'';
      node.style.minHeight=value?.height?'0':'';
      node.style.maxHeight=value?.height?'none':'';
      if(value?.fontSize)node.style.setProperty('font-size',value.fontSize+'px','important');else node.style.removeProperty('font-size');
      if(value?.gap!=null)node.style.setProperty('gap',value.gap+'px','important');else node.style.removeProperty('gap');
      node.toggleAttribute('data-preview-picked',enabled&&id===selected);
    }
  }
  function select(id){
    selected=id;
    apply();
    send('aozora-tuning-selection',{id,patch:edits[id]||{}});
  }
  addEventListener('message',event=>{
    if(event.source!==parent||event.data?.type!=='aozora-tuning')return;
    const data=event.data;
    enabled=data.enabled;
    edits=data.edits||{};
    selected=data.selected||'heading';
    apply();
    send('aozora-tuning-controls',{controls:controls.map(({id,label})=>({id,label}))});
  });
  document.addEventListener('pointerdown',event=>{
    const node=event.target.closest('[data-preview-tunable]');
    if(!enabled||!node||event.button!==0)return;
    event.preventDefault();
    const id=node.dataset.previewTunable;
    select(id);
    drag={id,pointer:event.pointerId,x:event.clientX,y:event.clientY,patch:{...edits[id]}};
    node.setPointerCapture(event.pointerId);
  },true);
  document.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointer)return;
    const {id,patch,x,y}=drag;
    edits[id]={...patch,x:Math.round((patch.x||0)+event.clientX-x),y:Math.round((patch.y||0)+event.clientY-y)};
    apply();
    send('aozora-tuning-selection',{id,patch:edits[id]});
  },true);
  for(const type of ['pointerup','pointercancel'])document.addEventListener(type,event=>{
    if(drag?.pointer===event.pointerId)drag=null;
  },true);
  document.addEventListener('click',event=>{
    if(!enabled||!event.target.closest('[data-preview-tunable]'))return;
    event.preventDefault();event.stopImmediatePropagation();
  },true);
})();

