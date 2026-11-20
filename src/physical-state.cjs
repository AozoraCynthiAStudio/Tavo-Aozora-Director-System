'use strict';
const ProtocolBoundary=typeof require==='function'?require('./protocol-boundary.cjs'):DirectorProtocolBoundary;
// Persistent, player-authored physical facts. Image-frame edits never update this state.
const clean=value=>String(value??'').trim();
const norm=value=>clean(value).normalize('NFKC').toLowerCase();
const actorKey=actor=>norm(actor.name)+'|'+norm(actor.form||'默认形态');
const emptyBundle=()=>({schema:1,events:[]});
const emptyState=()=>({schema:1,characterScales:[],scaleRelations:[],adultVolumes:[]});

function identity(raw,profiles=[]){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('身体设定人物无效');
 const name=clean(raw.name),form=clean(raw.form)||'默认形态';
 if(!name||name.length>80||form.length>80)throw Error('身体设定姓名或形态无效');
 const matches=profiles.filter(profile=>norm(profile.form||'默认形态')===norm(form)&&[profile.name,...(profile.aliases||[])].some(alias=>norm(alias)===norm(name)));
 const unique=[...new Map(matches.map(profile=>[actorKey(profile),profile])).values()];
 if(unique.length>1)throw Error('身体设定人物别名存在歧义');
 const found=unique[0];return {name:clean(found?.name||name),form:clean(found?.form||form)};
}
function reverseScaleValue(value){
 if(!value)return value;
 return {
  ...(value.height?{height:{...value.height,taller:value.height.taller==='a'?'b':value.height.taller==='b'?'a':'equal'}}:{}),
  ...(value.physique?{physique:{...value.physique,larger:value.physique.larger==='a'?'b':value.physique.larger==='b'?'a':'equal'}}:{})
 };
}
function canonicalPair(a,b,value){return actorKey(a)>actorKey(b)?{a:b,b:a,value:reverseScaleValue(value)}:{a,b,value};}
function number(value,min,max){return Number.isFinite(value)&&value>=min&&value<=max;}
function scaleValue(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(key=>!['height','physique'].includes(key)))throw Error('尺度关系内容无效');
 const value={};
 if(raw.height!==undefined){
  const height=raw.height;
  if(!height||typeof height!=='object'||Array.isArray(height)||Object.keys(height).some(key=>!['taller','differenceCm'].includes(key))||!['a','b','equal'].includes(height.taller))throw Error('身高差内容无效');
  if(height.differenceCm!==undefined&&!number(height.differenceCm,0,300))throw Error('身高差数值无效');
  value.height={taller:height.taller,...(height.differenceCm!==undefined?{differenceCm:Math.round(height.differenceCm*10)/10}:{})};
 }
 if(raw.physique!==undefined){
  const physique=raw.physique;
  if(!physique||typeof physique!=='object'||Array.isArray(physique)||Object.keys(physique).some(key=>!['larger','description'].includes(key))||!['a','b','equal'].includes(physique.larger))throw Error('体型差内容无效');
  const description=clean(physique.description||'');
  if(description.length>240||/[<>|\u0000-\u001f]/.test(description))throw Error('体型差描述无效');
  value.physique={larger:physique.larger,...(description?{description}:{})};
 }
 if(!Object.keys(value).length)throw Error('尺度关系不能为空');
 return value;
}
function volumeValue(raw){
 if(raw===null)return null;
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(key=>!['tier','custom'].includes(key)))throw Error('成人尺寸内容无效');
 const tier=clean(raw.tier||'');
 // Read legacy presets at the current upper tier while preserving explicit custom dimensions.
 if(tier==='gigantic'&&!raw.custom)return {tier:'huge'};
 if(['large','huge'].includes(tier)&&!raw.custom)return {tier};
 const custom=clean(raw.custom||'');
 if(custom&&custom.length<=120&&!/[<>|\u0000-\u001f]/.test(custom))return {custom};
 throw Error('成人尺寸档位或自定义描述无效');
}
function characterScaleValue(raw){
 if(raw===null)return null;
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(key=>!['heightCm','build'].includes(key)))throw Error('个体身高体型内容无效');
 const value={};
 if(raw.heightCm!==undefined){if(raw.heightCm!==null&&!number(raw.heightCm,20,400))throw Error('人物身高数值无效');value.heightCm=raw.heightCm===null?null:Math.round(raw.heightCm*10)/10;}
 if(raw.build!==undefined){const build=raw.build===null?'':clean(raw.build);if(raw.build!==null&&!build||build.length>160||/[<>|\u0000-\u001f]/.test(build))throw Error('人物体型描述无效');value.build=raw.build===null?null:build;}
 if(!Object.keys(value).length)throw Error('人物身高体型更新不能为空');
 return value;
}
function validateUpdates(raw,profiles=[]){
 if(!Array.isArray(raw)||raw.length>24)throw Error('身体设定更新列表无效');
 return raw.map(update=>{
  if(!update||typeof update!=='object'||Array.isArray(update))throw Error('身体设定更新无效');
  if(update.kind==='adultVolume'){
   if(Object.keys(update).some(key=>!['kind','character','value'].includes(key)))throw Error('成人尺寸更新字段无效');
   return {kind:'adultVolume',character:identity(update.character,profiles),value:volumeValue(update.value)};
  }
  if(update.kind==='characterScale'){
   if(Object.keys(update).some(key=>!['kind','character','value'].includes(key)))throw Error('个体尺度更新字段无效');
   return {kind:'characterScale',character:identity(update.character,profiles),value:characterScaleValue(update.value)};
  }
  if(update.kind==='scaleRelation'){
   if(Object.keys(update).some(key=>!['kind','a','b','value'].includes(key)))throw Error('尺度关系更新字段无效');
   let a=identity(update.a,profiles),b=identity(update.b,profiles);
   if(actorKey(a)===actorKey(b))throw Error('尺度关系必须关联两名不同人物');
   const pair=canonicalPair(a,b,update.value===null?null:scaleValue(update.value));
   return {kind:'scaleRelation',...pair};
  }
  throw Error('未知的身体设定类型');
 });
}
function normalizeBundle(value){
 if(value==null)return emptyBundle();
 if(!value||value.schema!==1||!Array.isArray(value.events)||Object.keys(value).some(key=>!['schema','events'].includes(key)))throw Error('身体设定存档结构无效');
 const events=value.events.map(event=>{
  if(!event||typeof event!=='object'||!event.messageId||!Array.isArray(event.updates))throw Error('身体设定事件无效');
  return {...event,messageId:String(event.messageId),order:Number.isFinite(Number(event.order))?Number(event.order):Date.now(),updates:validateUpdates(event.updates)};
 });
 return {schema:1,events:sortEvents(events)};
}
function applyUpdates(state,updates){
 const next=structuredClone(state||emptyState());
 for(const update of updates){
  if(update.kind==='adultVolume'){
   const key=actorKey(update.character),at=next.adultVolumes.findIndex(row=>actorKey(row.character)===key);
   if(at>=0)next.adultVolumes.splice(at,1);
   if(update.value)next.adultVolumes.push({character:update.character,value:update.value});
   continue;
  }
  if(update.kind==='characterScale'){
   const key=actorKey(update.character),at=next.characterScales.findIndex(row=>actorKey(row.character)===key);
   const previous=at>=0?next.characterScales.splice(at,1)[0]:null;
   if(update.value){const value={...(previous?.value||{})};for(const [field,entry] of Object.entries(update.value)){if(entry===null)delete value[field];else value[field]=entry;}if(Object.keys(value).length)next.characterScales.push({character:update.character,value});}
   continue;
  }
  const key=[actorKey(update.a),actorKey(update.b)].sort().join('<>'),at=next.scaleRelations.findIndex(row=>[actorKey(row.a),actorKey(row.b)].sort().join('<>')===key);
  if(at>=0)next.scaleRelations.splice(at,1);
  if(update.value)next.scaleRelations.push({a:update.a,b:update.b,value:update.value});
 }
 next.characterScales.sort((x,y)=>actorKey(x.character).localeCompare(actorKey(y.character)));
 next.scaleRelations.sort((x,y)=>(actorKey(x.a)+'|'+actorKey(x.b)).localeCompare(actorKey(y.a)+'|'+actorKey(y.b)));
 next.adultVolumes.sort((x,y)=>actorKey(x.character).localeCompare(actorKey(y.character)));
 return next;
}
function replay(bundle,events=bundle.events){let state=emptyState();for(const event of sortEvents(events))state=applyUpdates(state,event.updates);return state;}
function sortEvents(events){return [...events].sort((a,b)=>a.order-b.order);}
function commitEvent(bundle,event){const events=bundle.events.filter(old=>String(old.messageId)!==String(event.messageId));if(event.updates.length)events.push(event);return {...bundle,events:sortEvents(events)};}
function removeEvent(bundle,messageId){return {...bundle,events:bundle.events.filter(event=>String(event.messageId)!==String(messageId))};}
function stateBefore(bundle,messageId,order=null){const event=bundle.events.find(row=>String(row.messageId)===String(messageId)),position=event?.order??order??Number(messageId);return Number.isFinite(position)?replay(bundle,bundle.events.filter(row=>row.order<position)):replay(bundle);}
function stateAt(bundle,messageId,order=null){const event=bundle.events.find(row=>String(row.messageId)===String(messageId)),position=event?.order??order??Number(messageId);return Number.isFinite(position)?replay(bundle,bundle.events.filter(row=>row.order<=position)):replay(bundle);}
function renameActor(bundle,oldActor,newActor){
 const oldKey=actorKey(oldActor),rename=value=>actorKey(value)===oldKey?{name:clean(newActor.name),form:clean(newActor.form)||'默认形态'}:value;
 const events=bundle.events.map(event=>({...event,updates:event.updates.map(update=>{
  if(update.kind==='adultVolume'||update.kind==='characterScale')return {...update,character:rename(update.character)};
  return {kind:update.kind,...canonicalPair(rename(update.a),rename(update.b),update.value)};
 })}));
 return {...bundle,events};
}
function removeActor(bundle,actor){
 const key=actorKey(actor),events=bundle.events.map(event=>({...event,updates:event.updates.filter(update=>update.kind==='adultVolume'||update.kind==='characterScale'
  ?actorKey(update.character)!==key
  :actorKey(update.a)!==key&&actorKey(update.b)!==key)})).filter(event=>event.updates.length);
 return {...bundle,events};
}
function promptState(state){
 return {
  characterScales:(state?.characterScales||[]).map(({character,value})=>({character:{name:character.name,form:character.form},value})),
  scaleRelations:(state?.scaleRelations||[]).map(({a,b,value})=>({a:{name:a.name,form:a.form},b:{name:b.name,form:b.form},...value})),
  adultVolumes:(state?.adultVolumes||[]).map(({character,value})=>({character:{name:character.name,form:character.form},value}))
 };
}
function protectScale(plan,state){
 const active=new Set([...(plan.characters||[]),...(plan.fragments||[])].map(actorKey)),anchored=new Set((state?.characterScales||[]).map(row=>actorKey(row.character)));
 for(const relation of state?.scaleRelations||[])if(active.has(actorKey(relation.a))&&active.has(actorKey(relation.b))){anchored.add(actorKey(relation.a));anchored.add(actorKey(relation.b));}
 if(!anchored.size)return plan;
 return {...plan,characters:(plan.characters||[]).map(actor=>{
  if(!anchored.has(actorKey(actor))||!actor.frameSelection?.appearance)return actor;
  const available=actor.registrationDNA?.slots||{},keep=['height','build'].filter(key=>available[key]);
  return keep.length?{...actor,frameSelection:{...actor.frameSelection,appearance:[...new Set([...actor.frameSelection.appearance,...keep]) ]}}:actor;
 })};
}
function scaleInstruction(state){
 const rows=state?.scaleRelations||[],characters=state?.characterScales||[];if(!rows.length&&!characters.length)return '';
 return [
  '【固定的身高与体型设定】以下是已设定的人物事实及双人关系。人物身高、体型基准优先使用已保存值；玩家本轮明确重新设定长期事实时以本轮新事实更新，单帧画面要求不覆盖持久设定。双人关系只在对应两人共同参与当前画面时应用。无论两人都全身入镜，还是一人全身、另一人部分入镜，都应在当前可见范围内保留差异。服从玩家明确指定的机位和裁切，不拉远镜头、不补画画外身体；通过可见的头肩高度、躯干宽度、肢体粗细、接触尺度或同框参照表现。优先保持透视和空间距离合理；若当前裁切没有可比较的可见部位，不得为展示差异破坏构图或编造画外身体。',
  JSON.stringify({characters:characters.map(({character,value})=>({character:character.name+'（'+character.form+'）',...value})),relations:rows.map(({a,b,value})=>({a:a.name+'（'+a.form+'）',b:b.name+'（'+b.form+'）',...value}))})
 ].join('\n');
}
function adultInstruction(state){
 const rows=state?.adultVolumes||[];if(!rows.length)return '';
 return '【已保存的玩家角色专属尺寸档案】以下数据仅在 符合成人画面适用范围、人物确认为玩家控制的成年角色且当前画面实际涉及该器官时读取和应用；其他情况视为未提供。玩家本轮未明确更改时，已保存值优先于成人规则中的默认值。'+JSON.stringify(rows.map(({character,value})=>({character:{name:character.name,form:character.form},value:value?.tier==='gigantic'?{tier:'huge'}:value})));
}
function updateInstruction({allowScale=true,allowAdult=true}={}){
 if(!allowScale&&!allowAdult)return '';
 const exampleCharacter='{"kind":"characterScale","character":{"name":"角色甲","form":"默认形态"},"value":{"heightCm":190,"build":"broad, muscular build"}}';
 const exampleScale='{"kind":"scaleRelation","a":{"name":"角色甲","form":"默认形态"},"b":{"name":"角色乙","form":"默认形态"},"value":{"height":{"taller":"a","differenceCm":20},"physique":{"larger":"a","description":"broader shoulders and a heavier build"}}}';
 const exampleAdult='{"kind":"adultVolume","character":{"name":"玩家控制角色","form":"默认形态"},"value":{"tier":"huge"}}';
 return [
  '【持久身体设定同步】只记录玩家明确设定的长期身体事实或明确的长期更改；不要从模型自己写的正文、一次性画面要求、姿势、视角、勃起状态或透视效果推断持久变化。没有更新时省略此块。若输出，在正文与 <ad-wardrobe> 更新块之后输出一个 <ad-physical-state>JSON</ad-physical-state>，格式为 {"updates":[...]}；不得把内容写进可见正文。个体身高/体型使用：'+(allowScale?exampleCharacter+'；只改其中一项时只填写该字段，未提到的已保存字段沿用，明确清空某一项时该字段写 null':'当前任务不更新个体尺度。')+'；双人关系使用：'+(allowScale?exampleScale:'当前任务不更新双人关系。'),
  allowAdult?'成人尺寸仅记录已明确确认属于成年玩家控制角色的本人尺寸设定或更改；当前定格不符合成人画面适用范围、玩家角色身份不明、对象为 NPC、或只是勃起/当前画面显大时不更新。档位可用 large、huge；玩家给了其他明确尺寸时用 custom 原意短语。玩家明确降低长期档位时保存较小的新值；明确将长期设定恢复为自然比例时，value 写 null。格式示例：'+exampleAdult:'当前任务不更新成人尺寸。',
  allowScale?'玩家只要求本张图片表现得更明显时，仅按本帧规则处理，不改持久关系。只有明确设定或长期更改两名角色的固定身高/体型关系时，才输出 scaleRelation；更新时返回该关系的完整当前值，明确取消时 value 写 null。':'',
  '尺寸更新只返回玩家明确描述的该角色本人。只有玩家明确取消或重设该项时才清空/替换旧值；普通剧情措辞、他人评价和情绪反应不覆盖档案。'
 ].filter(Boolean).join('\n');
}
function parseUpdates(text){
 const source=String(text||''),blocks=ProtocolBoundary.jsonBlocks(source,'ad-physical-state');
 if(blocks.some(block=>!block.complete))throw Error('身体设定更新块不完整');if(blocks.length>1)throw Error('身体设定更新块重复');if(!blocks.length)return [];
 let value;try{value=JSON.parse(blocks[0].inner);}catch{throw Error('身体设定更新数据格式错误');}
 if(!value||!Array.isArray(value.updates))throw Error('身体设定更新缺少 updates');return value.updates;
}
function payload(value){return '<!--ad-physical-state:'+encodeURIComponent(JSON.stringify(value))+'-->';}
function readPayload(text){const match=ProtocolBoundary.ownedComments(text||'','ad-physical-state').find(m=>m.text.startsWith('<!--ad-physical-state:'));if(!match)return null;try{const value=JSON.parse(decodeURIComponent(match.inner));if(!value.id||!value.chatId||!Array.isArray(value.updates))throw Error();return value;}catch{throw Error('身体设定保存数据损坏');}}
function strip(text){return ProtocolBoundary.stripJson(String(text||''),'ad-physical-state','ad-physical-state');}

module.exports={actorKey,emptyBundle,emptyState,identity,validateUpdates,normalizeBundle,applyUpdates,replay,sortEvents,commitEvent,removeEvent,stateBefore,stateAt,renameActor,removeActor,promptState,protectScale,scaleInstruction,adultInstruction,updateInstruction,parseUpdates,payload,readPayload,strip};
