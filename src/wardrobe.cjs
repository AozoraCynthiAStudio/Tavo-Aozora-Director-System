'use strict';
const ProtocolBoundary=typeof require==='function'?require('./protocol-boundary.cjs'):DirectorProtocolBoundary;
// Equipment v2: complete per-region snapshots; no string-based layering/removal arithmetic.
const SLOTS=['HEAD','TOP','LOWER','FULL','LEGWEAR','FOOTWEAR','HAND','ACCESSORIES'];
const LABELS={HEAD:'头部',TOP:'上身',LOWER:'下身',FULL:'跨部位',LEGWEAR:'腿部',FOOTWEAR:'脚部',HAND:'手部',ACCESSORIES:'饰品'};
const clean=x=>String(x??'').trim();
const norm=x=>clean(x).normalize('NFKC').toLowerCase();
const key=c=>norm(c.name)+'|'+norm(c.form||'默认形态');
const sceneProp=/\b(?:back[ -]?packs?|rucksacks?|knapsacks?|daypacks?|school[ -]?bags?|handbags?|purses?|tote bags?|shoulder bags?|crossbody bags?|messenger bags?|duffel bags?|satchels?|suitcases?|luggage|briefcases?|umbrellas?|cameras?|binoculars?|flashlights?|phones?|walking sticks?|tool[ -]?boxes?|handheld tools?|swords?|firearms?)\b|背包|双肩包|书包|手提包|挎包|行李|公文包|雨伞|相机|望远镜|手电筒|手机|手杖|工具箱|手持工具/i;
function withoutSceneProps(equipment){
 const strip=items=>{
  if(!Array.isArray(items)||!items.some(item=>sceneProp.test(item.name)))return items;
  const rest=items.filter(item=>!sceneProp.test(item.name));
  return rest.length?rest:null;
 };
 return Object.fromEntries(Object.entries(equipment).map(([slot,value])=>[
  slot,isLayered(value)?Object.fromEntries(Object.entries(value).map(([layer,items])=>[layer,strip(items)])):strip(value)
 ]));
}
const empty=()=>Object.fromEntries(SLOTS.map(s=>[s,null]));
const INNER_ITEMS={
 TOP:/\b(?:bra(?:ssiere)?s?|bralettes?|undershirts?)\b|胸罩|乳罩|文胸|胸衣|内衣/i,
 LOWER:/\b(?:underwear|underpants|panties|knickers|briefs|boxers|thongs?)\b|内裤|底裤/i
};
const isLayered=value=>!!value&&!Array.isArray(value)&&typeof value==='object';
function layers(slot,value){
 if(isLayered(value))return value;
 if(!value||!Object.hasOwn(INNER_ITEMS,slot))return {outer:value??null};
 const isInner=garment=>INNER_ITEMS[slot].test(garment.name.replaceAll('_',' '));
 const inner=value.filter(isInner);
 return inner.length?{outer:value.filter(garment=>!isInner(garment)),inner}:{outer:value};
}
function garmentItems(slot,value){
 const {outer,inner}=layers(slot,value);
 return [...(outer||[]),...(inner||[])];
}
// Clothes need a stable silhouette. Resolve vague length/coverage once when the
// garment becomes a snapshot item; never re-decide it per seed or per frame.
// Explicit user/model terms win. These conservative fallbacks are *only* for
// otherwise unspecified categories, not a new wardrobe or a wardrobe change.
function specificGarmentName(value){
 const original=clean(value),name=original.toLowerCase();
 const has=(r)=>r.test(name);
 if(has(/\b(?:pants|trousers)\b/)&&!has(/\b(?:shorts?|short[- ]pants|capri|cropped|ankle[- ]length|7\/8|3\/4|knee[- ]length|full[- ]length|long|bermuda|hot pants|culottes|three[- ]quarter)\b/))return original+', full-length';
 if(has(/\bskirts?\b/)&&!has(/\bskirt[- ]suit\s+(?:jackets?|blazers?)\b/)&&!has(/\b(?:mini|micro|short|knee[- ]length|midi|mid[- ]length|maxi|long|floor[- ]length|ankle[- ]length|calf[- ]length|above[- ]knee|below[- ]knee)\b/))return original+', knee-length';
 if(has(/\b(?:dresses|dress)\b/)&&!has(/\b(?:mini|short|knee[- ]length|midi|maxi|long|floor[- ]length|ankle[- ]length|calf[- ]length|above[- ]knee|below[- ]knee)\b/))return original+', knee-length';
 if(has(/\b(?:coats?|overcoats?)\b/)&&!has(/\b(?:short|cropped|waist[- ]length|hip[- ]length|knee[- ]length|long|mid[- ]length|full[- ]length|ankle[- ]length|trench|duffle|pea coat)\b/))return original+', knee-length';
 if(has(/\b(?:jackets?)\b/)&&!has(/\b(?:short|cropped|waist[- ]length|hip[- ]length|thigh[- ]length|knee[- ]length|calf[- ]length|full[- ]length|ankle[- ]length|long|oversized|bomber|blazer)\b/))return original+', hip-length';
 if(has(/\b(?:boots?)\b/)&&!has(/\b(?:ankle|mid[- ]calf|knee[- ]high|thigh[- ]high|over[- ]the[- ]knee|tall|short|long|calf[- ]high)\b/))return original+', ankle-high';
 if(has(/\bsocks?\b/)&&!has(/\b(?:ankle|crew|knee[- ]high|thigh[- ]high|over[- ]the[- ]knee|no[- ]show|low[- ]cut|mid[- ]calf|short|long)\b/))return original+', crew-length';
 if(has(/\btop\b/)&&!has(/\b(?:tank|crop|tube|halter|bikini|sleeveless|short[- ]sleeved?|long[- ]sleeved?|strappy|off[- ]shoulder)\b/))return original+', short sleeves';
 if(has(/\b(?:shirt|blouse)\b/)&&!has(/\bt[- ]shirt\b/)&&!has(/\b(?:sleeveless|short[- ]sleeved?|long[- ]sleeved?|three[- ]quarter|half[- ]sleeved?|rolled[- ]sleeves?|puffed[- ]sleeves?|cap[- ]sleeves?|off[- ]shoulder)\b/))return original+', short sleeves';
 return original;
}
function item(raw,inner=false){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!clean(raw.name))throw Error('装备物品必须有名称');
 if(raw.visible!==undefined&&typeof raw.visible!=='boolean')throw Error('装备可见性必须为 true 或 false');
 const out={name:clean(raw.name),state:clean(raw.state)};
 if(!inner||raw.visible!==undefined)out.visible=raw.visible!==false;
 if(/^(?:none|unknown|无|未知)$/i.test(out.name))throw Error('无衣物使用空列表，未知使用 null，不作为物品名称');
 if(out.name.length>300||out.state.length>160||/[<>|]/.test(out.name+out.state))throw Error('装备描述过长或含不支持的标记');
 if(raw.covers!==undefined){if(!Array.isArray(raw.covers)||raw.covers.some(s=>!SLOTS.includes(s)))throw Error('装备覆盖部位无效');out.covers=[...new Set(raw.covers)].sort((a,b)=>SLOTS.indexOf(a)-SLOTS.indexOf(b));}
 return out;
}
function itemList(raw,inner=false){if(raw===null)return null;if(!Array.isArray(raw))throw Error('装备部位必须是物品列表或 null');if(raw.length>12)throw Error('单个装备部位物品过多');return raw.map(garment=>item(garment,inner));}
function region(slot,raw){
 if(!isLayered(raw)||!Object.hasOwn(INNER_ITEMS,slot))return itemList(raw);
 if(Object.keys(raw).some(layer=>layer!=='outer'&&layer!=='inner'))throw Error('服装层级无效');
 const entries=Object.entries(raw).filter(([,value])=>value!==null);
 return entries.length?Object.fromEntries(entries.map(([layer,value])=>[layer,itemList(value,layer==='inner')])):null;
}
function normalizeEquipment(raw,complete=true){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('装备快照必须是对象');
 if(Object.keys(raw).some(s=>!SLOTS.includes(s)))throw Error('装备部位无效');
 return Object.fromEntries((complete?SLOTS:Object.keys(raw)).map(s=>{const items=region(s,Object.hasOwn(raw,s)?raw[s]:null);if(s==='FULL'&&items)for(const garment of items)if(!garment.covers)garment.covers=['TOP','LOWER'];return [s,items];}));
}
function normalizeCharacter(c){
 if(!c||!c.equipment||SLOTS.some(slot=>!Object.hasOwn(c.equipment,slot)))throw Error('只支持完整的八部位装备快照，请新建对话测试');
 const out={name:clean(c.name),form:clean(c.form)||'默认形态',equipmentVersion:2,equipment:normalizeEquipment(c.equipment)};
 if(c.nai5Face&&typeof c.nai5Face==='object')out.nai5Face=structuredClone(c.nai5Face);
 if(c.registrationDNA!==undefined)out.registrationDNA=structuredClone(c.registrationDNA);if(c.appearanceOverrides!==undefined)out.appearanceOverrides=structuredClone(c.appearanceOverrides);if(c.frameSelection!==undefined)out.frameSelection=structuredClone(c.frameSelection);if(c.identity!==undefined)out.identity=clean(c.identity);if(c.portraitAppearance)out.portraitAppearance=clean(c.portraitAppearance).slice(0,600);if(c.relation!==undefined)out.relation=clean(c.relation);if(c.source!==undefined)out.source=clean(c.source);if(c.messageId!==undefined)out.messageId=String(c.messageId);if(c.aliases!==undefined)out.aliases=[...c.aliases];return out;
}
function normalizeRows(rows=[]){if(!Array.isArray(rows))throw Error('装备人物列表无效');const seen=new Set();return rows.map(raw=>{const c=normalizeCharacter(raw),id=key(c);c.equipment=withoutSceneProps(c.equipment);if(seen.has(id))throw Error('装备人物身份重复');seen.add(id);return c;});}
function canonicalIdentity(c,state=[],profiles=[]){
 const form=norm(c.form||'默认形态'),name=norm(c.name),matches=[...profiles,...state].filter(p=>norm(p.form||'默认形态')===form&&[p.name,...(p.aliases||[])].some(n=>norm(n)===name));
 const identities=new Map(matches.map(p=>[key(p),p]));if(identities.size>1)throw Error('装备人物别名存在歧义，请使用正式姓名');
 const found=identities.values().next().value;return {name:clean(found?.name||c.name),form:clean(found?.form||c.form)||'默认形态'};
}
function validateUpdates(raw,state,request={},narrative='',profiles=[],options={}){
 // The text model decides what changed. Keep only schema, identity and value checks here.
 const result=[];let working=normalizeRows(state);
 for(const patch of (Array.isArray(raw)?raw:[]).slice(0,48)){
  try{
   if(!patch||typeof patch!=='object'||!clean(patch.name)||patch.fact&&patch.fact!=='current')continue;
   const identity=canonicalIdentity(patch,working,profiles);
   const proposed=withoutSceneProps(normalizeEquipment(patch.regions,false));
   const old=working.find(row=>key(row)===key(identity));
   if(options.initialKeys?.has(key(identity))&&!old)continue;
   const regions={};
   for(const [slot,value] of Object.entries(proposed)){
    const difference=regionChange(slot,old?.equipment[slot],value);
    if(difference!==undefined)regions[slot]=difference;
   }
   if(!Object.keys(regions).length)continue;
   const update={...identity,regions,fact:'current'};
   result.push(update);working=applyUpdates(working,[update]);
  }catch{/* Discard only this malformed model proposal. The story can still draw. */}
 }
 return result;
}
function applyUpdates(state,updates){
 const rows=normalizeRows(state);
 for(const patch of updates){let at=rows.findIndex(r=>key(r)===key(patch));if(at<0){rows.push(normalizeCharacter({...patch,equipment:empty()}));at=rows.length-1;}
  const row=rows[at],equipment=mergeRegions(row.equipment,patch.regions);
  rows[at]=normalizeCharacter({...row,equipment:withoutSceneProps(equipment),source:'equipment-v2'});
 }
 return rows;
}
function sameItems(a,b){
 const comparable=items=>items?.map(garment=>JSON.stringify(garment)).sort()||null;
 return JSON.stringify(comparable(a))===JSON.stringify(comparable(b));
}
function regionChange(slot,previous,value){
 if(value===null)return undefined;
 if(Object.hasOwn(INNER_ITEMS,slot)&&(isLayered(value)||layers(slot,previous).inner!==undefined)){
  const before=layers(slot,previous);
  const proposed=Array.isArray(value)&&!value.length?{outer:[],inner:[]}:layers(slot,value);
  const changed=Object.entries(proposed).filter(([layer,items])=>items!==null&&!sameItems(items,before[layer]));
  return changed.length?Object.fromEntries(changed):undefined;
 }
 return sameItems(value,previous)?undefined:value;
}
function mergeRegions(equipment,regions,{replay=false}={}){
 const next={...equipment};
 for(const [slot,value] of Object.entries(normalizeEquipment(regions,false))){
  const preserveLayers=!replay&&Array.isArray(value)&&value.length>0&&isLayered(next[slot]);
  next[slot]=isLayered(value)||preserveLayers?{...layers(slot,next[slot]),...layers(slot,value)}:value;
 }
 return next;
}
function frameEquipment(equipment,baseline={}){
 const known=normalizeEquipment(baseline);
 const changes=Object.fromEntries(Object.entries(normalizeEquipment(equipment,false)).filter(([,value])=>value!==null));
 return mergeRegions(known,changes);
}
function resolveFrame(plan,state,profiles=[]){
 const baseline=normalizeRows(state);
 const audit=[];
 const characters=plan.characters.map(raw=>{
  const actor=normalizeCharacter(raw);
  const identity=canonicalIdentity(actor,baseline,profiles);
  const known=baseline.find(row=>key(row)===key(identity));
  const equipment=frameEquipment(sceneProp.test(plan.scene)?actor.equipment:withoutSceneProps(actor.equipment),known?.equipment);
  const changed=SLOTS.filter(slot=>regionChange(slot,known?.equipment[slot],actor.equipment[slot])!==undefined);
  audit.push({...identity,changed,source:'selected-frame'});
  return {...actor,...identity,equipment};
 });
 return {plan:{...plan,characters},audit};
}
function namedActors(text,actors){
 const input=norm(text);
 return [...new Set(actors.filter(actor=>[actor.name,...(actor.aliases||[])].some(name=>{
  const term=norm(name);
  if(!term)return false;
  if(!/^[a-z0-9 _-]+$/.test(term))return input.includes(term);
  const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('(?:^|[^a-z0-9])'+escaped+'(?=$|[^a-z0-9])','i').test(input);
 })).map(key))];
}
function resolve(plan,state,request={},narrative='',rawUpdates=[],profiles=[],options={}){
 const baseline=normalizeRows(state);
 const updates=validateUpdates(rawUpdates,baseline,{},'',profiles,options);
 const approved=applyUpdates(baseline,updates),audit=[];
 const characters=plan.characters.map(raw=>{
  const c=normalizeCharacter(raw),identity=canonicalIdentity(c,approved,profiles);
  const known=approved.find(row=>key(row)===key(identity));
  const equipment=frameEquipment(c.equipment,known?.equipment);
  const changed=SLOTS.filter(slot=>regionChange(slot,known?.equipment[slot],c.equipment[slot])!==undefined);
  audit.push({...identity,changed,source:known?.source||'equipment-v2'});
  return normalizeCharacter({...c,...identity,equipment});
 });
 return {plan:{...plan,characters},updates,audit};
}
function snapshotPlan(plan){return {...plan,characters:plan.characters.map(normalizeCharacter)};}
// Keep first-established clothing even if the ending delta omits it. Known
// regions still change only through the model's ending update, not a picture edit.
function endingUpdates(plan,state,rawUpdates,profiles=[]){
 const baseline=normalizeRows(state),frame=resolveFrame(plan,baseline,profiles).plan;
 const framePatches=frame.characters.map(actor=>{
  const previous=baseline.find(row=>key(row)===key(actor)),regions={};
  for(const [slot,value] of Object.entries(compactEquipment(withoutSceneProps(actor.equipment)))){
   const old=previous?.equipment[slot];
   if(old==null)regions[slot]=value;
   else if(Object.hasOwn(INNER_ITEMS,slot)){
    const known=layers(slot,old),missing=Object.entries(layers(slot,value)).filter(([layer,items])=>items!==null&&known[layer]==null);
    if(missing.length)regions[slot]=Object.fromEntries(missing);
   }
  }
  return {name:actor.name,form:actor.form,regions,fact:'current'};
 });
 const atFrame=applyUpdates(baseline,framePatches);
 const changes=validateUpdates(rawUpdates,atFrame,{},'',profiles);
 const ending=applyUpdates(atFrame,changes);
 return validateUpdates(ending.map(actor=>({name:actor.name,form:actor.form,regions:compactEquipment(actor.equipment),fact:'current'})),baseline,{},'',profiles);
}
const sleeveDetail=/\b(?:cuffs?|sleeves?|sleeved)\b/i;
const handAccessory=/\b(?:(?:wrist[- ]?)?watch(?:es)?|bracelets?|bangles?|wristbands?|rings?|cufflinks?|hand chains?)\b/i;
const nonHandAccessory=/\b(?:nose|ear|lip|navel|belly|neck|belt|buckles?|keyrings?|key rings?|bags?|straps?)\b/i;
function sleevePhrases(garment){
 return [garment.name,garment.state].flatMap(value=>value.split(',')).map(clean).filter(value=>sleeveDetail.test(value)).map(value=>{
  const tail=value.match(/\b(?:with|featuring)\s+(.+)$/i)?.[1];
  const detail=tail&&sleeveDetail.test(tail)?tail:value;
  return clean(detail.replace(/\bsleeved\b/i,'sleeves').replace(/-(?=sleeves\b)/i,' ')
   .replace(/\b(?:blouses?|shirts?|jackets?|coats?|dresses?|sweaters?|cardigans?|robes?|hoodies?|uniforms?|suits?|tops?)\b/gi,'')
   .replace(/\s+/g,' ').replace(/\b(?:with|and)\s*$/i,''));
 }).filter(Boolean);
}
function handOutfit(character,equipment,audit){
 const visible=[];
 for(const slot of SLOTS){
  for(const garment of (layers(slot,equipment[slot]).outer||[]).filter(item=>item.visible)){
   let phrases=[];
   if(slot==='TOP'||slot==='FULL')phrases=sleevePhrases(garment);
   if(slot==='HAND'||slot==='ACCESSORIES'&&handAccessory.test(garment.name)&&!nonHandAccessory.test(garment.name)){
    phrases=[garment.name,...(garment.state&&!/^worn$/i.test(garment.state)?[garment.state]:[])];
   }
   if(!phrases.length)audit?.removed.push({name:character.name,field:'outfit',slot,text:garment.name,reason:'outside-hand-closeup'});
   else if(phrases[0]!==garment.name)audit?.adjusted?.push({name:character.name,field:'outfit',slot,before:garment.name,after:phrases.join(', '),reason:'visible-sleeve-detail'});
   visible.push(...phrases);
  }
 }
 return [...new Set(visible)].join(', ');
}
function forImage(character,{scene='',crop='unknown',format,audit,multipleActors=false,includeEntries=false}={}){
 const {equipment,identity}=normalizeCharacter(character),visible=[];
 if(crop==='hands')return {outfit:handOutfit(character,equipment,audit)};
 const cross=equipment.FULL||[],covers=slot=>cross.some(garment=>garment.visible&&(garment.covers||['TOP','LOWER']).includes(slot));
 const actorScene=!multipleActors?scene:scene.split(/[,;.!?]/).filter(clause=>namedActors(clause,[character]).length).join(' ');
 const detailCrop=['hands','feet','portrait'].includes(crop);
 const describe=(slot,garment)=>{
  const normalized=specificGarmentName(garment.name);
  const suffix=normalized===garment.name?'':normalized.slice(garment.name.length).replace(/^,\s*/,'');
  const redundant=format==='nai45'&&garment.state.toLowerCase()==='worn';
  if(redundant&&audit)audit.removed.push({name:character.name,field:'outfit',slot,text:garment.state,reason:'redundant-default-worn-state'});
  const state=redundant?'':garment.state;
  const text=[garment.name,state,suffix&&!state.toLowerCase().includes(suffix.toLowerCase())?suffix:''].filter(Boolean).join(', ');
  const visibleLegwear=['LEGWEAR','FOOTWEAR'].includes(slot)&&!['hands','portrait','upper','torso'].includes(crop);
  return {name:garment.name,slot,text,required:visibleLegwear||!!garment.state&&!/^worn$/i.test(garment.state)};
 };
 const cue=text=>visible.push({text,required:true});
 for(const slot of SLOTS){
  const {outer,inner}=layers(slot,equipment[slot]);
  const outerVisible=(outer||[]).filter(garment=>garment.visible);
  visible.push(...outerVisible.map(garment=>describe(slot,garment)));
  if(inner===undefined||detailCrop)continue;
  const covered=outerVisible.length>0||covers(slot);
  const description=[actorScene,...outerVisible.map(garment=>garment.name+' '+garment.state),...cross.filter(garment=>garment.visible).map(garment=>garment.name+' '+garment.state)].join(' ');
  const revealed=slot==='LOWER'
   ?/\b(?:underwear|panties|underpants|under (?:the|her|his|their) (?:skirt|dress)|(?:lift(?:s|ed|ing)?|rais(?:e[sd]?|ing)|hik(?:e[sd]?|ing) up|pull(?:s|ed|ing)? up) (?:the |her |his |their )?(?:skirt|dress|hem)|(?:skirt|dress|hem)(?: is| has been)? (?:lifted|raised|hiked up|pulled up)|(?:pants|trousers|skirt)(?: is| are)? (?:lowered|pulled down|unfastened))\b/i.test(description)
   :/\b(?:bra|braless|brassiere|bare chest|bare shoulders|open shirt|unbuttoned (?:shirt|blouse))\b/i.test(description);
  if(slot==='LOWER'&&crop==='upper'&&!revealed&&!inner.some(garment=>garment.visible===true))continue;
  const visibleInner=inner.filter(garment=>garment.visible===true||(garment.visible===undefined&&(!covered||revealed)));
  visible.push(...visibleInner.map(garment=>describe(slot,garment)));
  if(!inner.length&&revealed&&(covered||outer?.length!==0)){
   const female=/\b(?:woman|female|girl)\b/i.test(identity);
   cue(slot==='TOP'?(female||/\bbra\b/i.test(description)?'no bra':'no undershirt'):format==='nai45'&&female?'no panties':'no underwear');
  }
 }
 const bare=slot=>{
  const {outer,inner}=layers(slot,equipment[slot]);
  return outer?.length===0&&!inner?.length&&!covers(slot);
 };
 if(bare('TOP')){cue('no upper-body garment');cue('bare upper body');}
 if(bare('LOWER')){cue('no lower-body garment');if(!equipment.LEGWEAR?.length)cue('bare legs');}
 if(equipment.FOOTWEAR?.length===0)cue('barefoot');
 if(equipment.LEGWEAR?.length===0&&!['hands','portrait','upper','torso'].includes(crop))cue('no socks, no stockings');
 if(bare('TOP')&&bare('LOWER')&&!equipment.FULL?.length&&!equipment.LEGWEAR?.length)cue('nude');
 return {outfit:[...new Set(visible.map(item=>item.text))].join(', '),...(includeEntries?{entries:visible}:{})};
}
function replay(bundle,events=bundle.events){
 const rows=new Map();
 for(const event of events)for(const patch of event.updates){
  const id=key(patch),old=rows.get(id)||normalizeCharacter({name:patch.name,form:patch.form,equipment:empty()});
  rows.set(id,normalizeCharacter({...old,equipment:mergeRegions(old.equipment,patch.regions,{replay:true}),source:'equipment-v2'}));
 }
 return [...rows.values()];
}
function sortEvents(events){return [...events].sort((a,b)=>a.order-b.order);}
function removeEvent(bundle,messageId){return {...bundle,events:bundle.events.filter(e=>String(e.messageId)!==String(messageId)&&String(e.userMessageId)!==String(messageId))};}
function commitEvent(bundle,event){const events=bundle.events.filter(e=>String(e.messageId)!==String(event.messageId));if(event.updates.length)events.push(event);return {...bundle,events:sortEvents(events)};}
function stateBefore(bundle,messageId,order=null){const event=bundle.events.find(e=>String(e.messageId)===String(messageId)),position=event?.order??order??Number(messageId);return Number.isFinite(position)?replay(bundle,bundle.events.filter(e=>e.order<position)):replay(bundle);}
function strip(text){return ProtocolBoundary.stripJson(String(text||''),'ad-wardrobe','ad-equipment');}
function parseUpdates(text,_legacyRequestId){
 const source=String(text),blocks=ProtocolBoundary.jsonBlocks(source,'ad-wardrobe');
 if(blocks.some(block=>!block.complete))throw Error('装备更新块不完整');
 if(blocks.length>1)throw Error('装备更新块重复');if(!blocks.length)return [];
 let value;try{value=JSON.parse(blocks[0].inner);}catch{throw Error('装备更新数据格式错误');}
 if(!value||!Array.isArray(value.updates))throw Error('装备更新缺少 updates');return value.updates;
}
function payload(value){return '<!--ad-equipment:'+encodeURIComponent(JSON.stringify(value))+'-->';}
function readPayload(text){const m=ProtocolBoundary.ownedComments(text,'ad-equipment').find(m=>m.text.startsWith('<!--ad-equipment:'));if(!m)return null;try{const p=JSON.parse(decodeURIComponent(m.inner));if(!p.id||!p.chatId||!Array.isArray(p.updates))throw Error();return p;}catch{throw Error('装备保存数据损坏');}}
const layerInstruction='上身 TOP 与下身 LOWER 有内层状态时可写 {"LOWER":{"inner":[]}}，表示明确没穿内裤，外层裙裤照旧。内层穿着用同样的衣物列表，未知省略。只更新外层时可写 outer。遮挡不改变穿着，可见的内层用 visible:true。';
const continuityInstruction='背包、手提包、行李、相机、雨伞、手持工具等外部物件属于当前场景道具，即使背着、挂在身上或握在手里，也只在当前情节确实携带且入镜时由 Scene 写明归属与状态。不得登记为固定外貌、写入持续穿着或仅凭过去携带过就再次加入。首饰等佩戴型配饰依据本帧的实际穿着、遮挡和取景按需呈现。首次在当前故事中安排人物穿着时，先服从人物设定和上下文，再一次确定完整八部位及上/下身内外层；袜子、鞋、帽饰、手套和配饰都要明确有或没有，未穿用 []，不能把未提到的部位留给生图模型随机搭配。已经有记录的部位继续沿用，仅补齐尚未确定的部位；进入新段落、换镜头、人物暂时离场再出现，都不是重新搭配的理由。镜头外和被衣物遮住的穿着仍保留，只控制画面可见性，不清空、不重选。首次安排的衣着应与画面及正文一致；已发生的解扣、拉开、掀起、滑落属于衣着状态变化。按定格写所在位置，保留仍在身上的衣物。玩家对本帧的明确衣着要求直接用于画面；剧情结尾的持久状态以正文实际变化为准。补历史图只用当时的已知穿着和该段事实，不从之后的剧情借衣服，也不替历史补造被遮住的未知衣物。单独人物候选或玩家只对当前图片指定的服装只影响该图片，不自动改写剧情穿着。';
function compactEquipment(equipment){
 const compactItems=(items,inner)=>items.filter(item=>clean(item?.name)).map(garment=>({
  name:garment.name,
  ...(garment.state?{state:garment.state}:{}),
  ...(garment.visible===false||inner&&garment.visible===true?{visible:garment.visible}:{}),
  ...(garment.covers&&JSON.stringify(garment.covers)!==JSON.stringify(['TOP','LOWER'])?{covers:garment.covers}:{})
 }));
 const known={};
 for(const slot of SLOTS){
  const value=equipment?.[slot];
  if(Array.isArray(value))known[slot]=compactItems(value,false);
  else if(isLayered(value)&&Object.hasOwn(INNER_ITEMS,slot)){
   const entries=['outer','inner'].filter(layer=>Array.isArray(value[layer])).map(layer=>[layer,compactItems(value[layer],layer==='inner')]);
   if(entries.length)known[slot]=Object.fromEntries(entries);
  }
 }
 return known;
}
function instruction(id,state,profiles=[],options={}){
 const known=normalizeRows(state).map(row=>({name:row.name,form:row.form,equipment:compactEquipment(row.equipment)}));
 const change='正文写完后，根据正文明确发生的事件，记录每个人在本轮结尾的穿着。这是下一轮的起点。玩家的想法、愿望、计划和画面要求只供理解，只有正文已发生或已确认的事实才能更新档案。先脱后穿按结尾实际穿着记录，结尾未变的槽位省略。首次在正文确认的衣着也要记录，即使人物没有入镜。';
 const update='<ad-wardrobe id="protocol">{"updates":[{"name":"角色姓名","fact":"current","regions":{"FOOTWEAR":[{"name":"red boots"}]}}]}</ad-wardrobe>';
 const ending='在正文之后始终输出一个 '+update+'。标准姓名与形态对应每个人；非默认形态要显式填写。只列结尾变化或首次确认的槽位，整部位已脱空用 []，局部仅改对应衣层。没有变化填写 {"updates":[]}。';
 if(options.changesOnly)return [
  ...(known.length?['【本轮开场的衣着】'+JSON.stringify(known)]:[]),
  '正文结尾的实际穿着与开场不同时，在正文后用以下格式只记录变化的部位或衣层。无变化省略。'+update
 ].join('\n');
 if(options.compact)return [
  '【正文结束时的穿着】'+change,
  continuityInstruction,
  ...(known.length?['【本轮开场的衣着】'+JSON.stringify(known)]:[]),
  ending
 ].join('\n');
 return [
  '【剧情装备同步】'+change,
  continuityInstruction,
  '【八部位】HEAD帽饰、TOP上身、LOWER下身、FULL跨部位、LEGWEAR腿袜、FOOTWEAR鞋、HAND手套、ACCESSORIES饰品。只列变化部位。物品可写 name、state、visible。半脱保留物品及其 state，例如 {"name":"white jacket","state":"unzipped and slipped off one shoulder"}。整部位已完全脱空用 []。'+layerInstruction,
  ...(known.length?['【本轮开场的衣着】'+JSON.stringify(known)]:[]),
  ...(profiles.length?['【人物身份参考】'+JSON.stringify(profiles.map(p=>({name:p.name,form:p.form,aliases:p.aliases||[]})))]:[]),
  ending
 ].join('\n');
}
module.exports={SLOTS,sceneProp,LABELS,specificGarmentName,garmentItems,layerInstruction,continuityInstruction,endingUpdates,compactEquipment,mergeRegions,frameEquipment,resolveFrame,key,normalizeEquipment,normalizeCharacter,normalizeRows,canonicalIdentity,validateUpdates,applyUpdates,resolve,forImage,snapshotPlan,replay,commitEvent,removeEvent,stateBefore,strip,parseUpdates,payload,readPayload,instruction};
