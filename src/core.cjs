'use strict';
const ProtocolBoundary=typeof require==='function'?require('./protocol-boundary.cjs'):DirectorProtocolBoundary;
const VisualProtocol=typeof require==='function'?require('./visual-protocol.cjs'):DirectorVisualProtocol;
const PromptAdapters=typeof require==='function'?require('./prompt-adapters.cjs'):DirectorAdapters;
const Status=typeof require==='function'?require('./status.cjs'):DirectorStatus;
const Wardrobe=typeof require==='function'?require('./wardrobe.cjs'):DirectorWardrobe;
const PhysicalState=typeof require==='function'?require('./physical-state.cjs'):DirectorPhysicalState;
const Height=typeof require==='function'?require('./height-anchor.cjs'):DirectorHeight;
const BodyRelations=typeof require==='function'?require('./body-relations.cjs'):DirectorBodyRelations;
const Projection=typeof require==='function'?require('./render-projection.cjs'):DirectorProjection;
const PromptValidation=typeof require==='function'?require('./prompt-validation.cjs'):DirectorPromptValidation;
const RuleCompiler=typeof require==='function'?require('./director-rules.cjs'):DirectorRules;
// Pure protocol / composition. No host, DOM, storage or provider requests.
const Budget=typeof require==='function'?require('./prompt-budget.cjs'):DirectorBudget;
const DNA=typeof require==='function'?require('./identity-dna.cjs'):DirectorDNA;
const VERSION = '1.1.8';
const NAI_CAST_LIMIT = 2;
const DEFAULTS = {format:'nai45',shot:'near',ratio:'api',styleId:'',seedFixed:false,seedValue:'',autoGenerate:true,autoExpand:false};
const clean = x => String(x ?? '').trim();
function id(prefix='run'){return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);}
function fingerprint(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
function settings(value={}){const current={...value};delete current.maxActors;delete current.adultComicInset;return {...DEFAULTS,...current,autoGenerate:value.autoGenerate!==false,autoExpand:value.autoExpand===true,format:value.format===undefined?DEFAULTS.format:value.format==='nai45'?'nai45':'generic',shot:value.shot==='full'?'full':'near',ratio:['api','16:9','1:1','2:3'].includes(value.ratio)?value.ratio:'api'};}
function imageServiceMode(value={}){
 const format=clean(value?.format).toLowerCase(),service=clean(value?.imageService).toLowerCase();
 if(format==='generic'||service==='generic')return 'generic';
 if(format==='nai45'||['nai45','official','relay'].includes(service))return 'nai45';
 return 'unknown';
}
function supportsNaiImageEdit(image,currentConfig={}){
 if(imageServiceMode(currentConfig)!=='nai45')return false;
 const source=image?.config&&typeof image.config==='object'?image.config:image||{};
 const mode=imageServiceMode(source);
 const naiSyntax=/^nai45(?:-|$)/i.test(clean(image?.syntax)),existingMotion=!!image?.motion?.sourcePointer;
 return mode==='nai45'||(mode==='unknown'&&(naiSyntax||existingMotion));
}
function styleFormat(style={}){if(clean(style.format))return clean(style.format);return /^(?:nai\s*4[. ]?5)(?:\b|$)/i.test(clean(style.basis))||['mignon_allenes','meekohopanes_ru_zhai','kittew','meekohopanes'].includes(style.id)?'nai45':'generic';}
function styleMatches(style,format){return styleFormat(style)===format;}
function seedValue(value,format){if(!/^\d+$/.test(clean(value)))throw Error('Seed 必须是非负整数');const n=Number(value);if(!Number.isSafeInteger(n)||(format==='nai45'&&n>4294967295))throw Error('Seed 超出当前格式支持的数值范围');return n;}
function normalizedPlan(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('视觉数据必须是对象');
  const scene=clean(value.scene);if(!scene)throw Error('视觉数据缺少场景提示词');
  if(!Array.isArray(value.characters))throw Error('人物列表必须存在');
  const seen=new Set(),characters=value.characters.map(p=>{
    if(!p||typeof p!=='object')throw Error('人物数据不完整');
    if(Object.hasOwn(p,'action'))throw Error('新单Scene协议不接受旧人物动作字段');
    const registrationDNA=DNA.snapshot(p.registrationDNA),appearanceOverrides=DNA.overrides(p.appearanceOverrides),frameSelection=VisualProtocol.frameSelection(p.frameSelection);
    const name=clean(p.name),form=clean(p.form)||'默认形态',identity=DNA.renderIdentity(registrationDNA,appearanceOverrides)||clean(p.identity);
    if(!name||!identity)throw Error('人物姓名与外貌提示词不可为空');
    const key=name.normalize('NFKC').toLowerCase()+'|'+form.normalize('NFKC').toLowerCase();
    if(seen.has(key))throw Error('重复的人物身份');seen.add(key);
    return Wardrobe.normalizeCharacter({name,form,identity,...(registrationDNA?{registrationDNA}:{}),...(Object.keys(appearanceOverrides).length?{appearanceOverrides}:{}),...(frameSelection?{frameSelection}:{}),equipment:p.equipment,...(p.relation!==undefined?{relation:VisualProtocol.relation(p.relation)}:{})});
  });
  const directorSummary=VisualProtocol.directorSummary(value.directorSummary),sourceExcerpt=VisualProtocol.sourceExcerpt(value.sourceExcerpt);
  return {scene,characters,...(directorSummary?{directorSummary}:{}),...(sourceExcerpt!==undefined?{sourceExcerpt}:{}),...(Array.isArray(value.fragments)?{fragments:value.fragments.slice(0,6)}:{}),...(clean(value.description)?{description:clean(value.description).replace(/\s*\n\s*/g,' ').slice(0,600)}:{})};
}
function withoutScenePropsIdentity(value){return clean(value).split(/[,，;；]/).map(clean).filter(part=>part&&!Wardrobe.sceneProp.test(part)).join(', ');}
function withoutScenePropsDNA(value){
 const snapshot=DNA.snapshot(value);
 return snapshot&&DNA.snapshot({...snapshot,slots:Object.fromEntries(Object.entries(snapshot.slots).map(([slot,text])=>[slot,Wardrobe.sceneProp.test(text)?withoutScenePropsIdentity(text):text]))});
}
function reuseRegisteredIdentity(plan,request={},profiles=[]){
 const audit=[];
 if(request.kind==='character_intro')return {plan,audit};
 const characters=plan.characters.map(actor=>{
  const profile=Height.profileFor(actor,profiles);if(!profile)return actor;
  const registrationDNA=withoutScenePropsDNA(profile.registrationDNA);
  // Legacy flat profiles are reused verbatim, never classified by local word lists.
  if(!registrationDNA){const ignoredSlots=Object.keys(DNA.overrides(actor.appearanceOverrides));const identity=Wardrobe.sceneProp.test(profile.identity)?withoutScenePropsIdentity(profile.identity):clean(profile.identity);if(!identity)return actor;audit.push({name:actor.name,form:actor.form,field:'identity',source:'registered-verbatim',...(ignoredSlots.length?{ignoredSlots}:{})});const {registrationDNA:ignored,appearanceOverrides:ignoredChanges,...rest}=actor;return {...rest,identity};}
  const appearanceOverrides=DNA.overrides(actor.appearanceOverrides),identity=DNA.renderIdentity(registrationDNA,appearanceOverrides);
  audit.push({name:actor.name,form:actor.form,field:'identity',source:'registered-snapshot',overriddenSlots:Object.keys(appearanceOverrides)});
  return {...actor,registrationDNA,identity,...(Object.keys(appearanceOverrides).length?{appearanceOverrides}:{})};
 });
 return {plan:{...plan,characters},audit};
}
const fragmentRegions={
  hands:/\b(?:hands?|fingers?|knuckles?|palms?)\b/i,
  forearms:/\b(?:forearms?|wrists?)\b/i,
  'hands-and-forearms':/\b(?:hands?|fingers?|knuckles?|palms?|forearms?|wrists?)\b/i,
  shoulder:/\bshoulders?\b/i,
  legs:/\b(?:legs?|thighs?|calves|knees?)\b/i,
  feet:/\b(?:feet|foot|toes?|ankles?)\b/i
};
function resolveFragments(plan,profiles=[],wardrobe=[]){
  const {fragments=[],...visual}=plan;
  const scene=visual.scene.replace(/\s*@limb([1-6])@/gi,(_,index,offset)=>{
    const fragment=fragments[Number(index)-1];
    if(!fragment||!Object.hasOwn(fragmentRegions,fragment.region)||typeof fragment.name!=='string')return '';
    const profile=Height.profileFor({name:fragment.name,form:clean(fragment.form)||'默认形态'},profiles);
    if(!profile||visual.characters.some(actor=>Height.profileFor(actor,[profile])))return '';
    const region=fragmentRegions[fragment.region];
    const limb=visual.scene.slice(0,offset).trimEnd().match(/[a-z]+$/i)?.[0]||'';
    if(!region.test(limb))return '';
    const side=['left','right','both'].includes(fragment.side)?fragment.side:'';
    const safe=value=>/^[a-z][a-z0-9 -]{1,79}$/i.test(clean(value));
    const onVisibleSide=value=>{
      const sides=value.match(/\b(?:left|right)\b/gi)||[];
      return !sides.length||side==='both'||sides.every(word=>word.toLowerCase()===side);
    };
    const slots=DNA.snapshot(profile.registrationDNA)?.slots;
    const terms=slots?Object.entries(slots).filter(([key])=>/^extra\d+$/.test(key)).map(([,value])=>value):clean(profile.identity).split(',').map(clean);
    const knownEquipment=wardrobe.find(row=>Wardrobe.key(row)===Wardrobe.key(profile))?.equipment;
    let equipment=knownEquipment;
    if(fragment.equipment)try{equipment=Wardrobe.frameEquipment(fragment.equipment,knownEquipment);}catch{/* Invalid optional frame data is ignored. */}
    const gloves=/^hands/.test(fragment.region)?(equipment?.HAND||[]).filter(item=>item.visible&&safe(item.name)&&/\b(?:gloves?|mittens?)\b/i.test(item.name)&&onVisibleSide(item.name)):[];
    const covered=fragment.region==='hands'&&gloves.some(item=>/\b(?:gloves?|mittens?)\b/i.test(item.name)&&!/fingerless|\b(?:left|right)\b/i.test(item.name));
    const skin=slots?.skin||terms.find(term=>/\b(?:skin|complexion)\b/i.test(term));
    const traits=!covered&&safe(skin)?[skin]:[];
    if(!covered)traits.push(...terms.filter(term=>safe(term)&&region.test(term)&&onVisibleSide(term)&&!/(?:hair|eyes?|face|height|torso|chest)/i.test(term)).slice(0,2));
    traits.push(...gloves.map(item=>item.name));
    if(fragment.region==='forearms'||fragment.region==='hands-and-forearms'){
      const cuff=[...Wardrobe.garmentItems('TOP',equipment?.TOP),...(equipment?.FULL||[])].find(item=>item.visible&&safe(item.name)&&/\b(?:long[- ]sleeved?|cuffs?)\b/i.test(item.name));
      if(cuff)traits.push('cuffs of the '+cuff.name);
    }
    for(const item of equipment?.ACCESSORIES||[]){
      if(!item.visible||!safe(item.name)||!onVisibleSide(item.name))continue;
      const accessoryRegion=/\b(?:watch|bracelet|wristband)\b/i.test(item.name)?'wrists':/\bring\b/i.test(item.name)?'fingers':'';
      if(accessoryRegion&&region.test(accessoryRegion)&&/\b(?:left|right)\b/i.test(item.name))traits.push(item.name);
    }
    const visible=[...new Set(traits)].slice(0,4);
    return visible.length?' with '+visible.join(' and '):'';
  });
  return {...visual,scene};
}
function cleanDirectorInput(text){return String(text||'').replace(/^【Aozora导演系统】将为您(?:导演下一幕场景|设计[^\r\n]*?的人物形象) \| [^\r\n]*$/gm,'').replace(/【Aozora导演系统】\r?\n将为您(?:导演下一幕场景|设计[^\r\n]*?的外观)。(?:(?:\r?\n)—— [^\r\n]*)?(?!\r?\n（删除此条文字仍会执行）)/g,'').replace(/^Aozora导演系统，将为您(?:导演下一幕场景|设计[^\r\n]*?的外观)。(?:[ \t]*｜[^\r\n]*)?$/gm,'').replace(/【Aozora导演系统】\r?\n将为您(?:导演下一幕场景|设计[^\r\n]*的外观)。\r?\n（删除此条文字仍会执行）/g,'').replace(/\[青空导演｜编号：[a-zA-Z0-9_-]+｜[^\]\r\n]*\]/g,'').replace(/【Aozora导演系统】[^\r\n]*?<!--ad-request:[a-zA-Z0-9_-]+-->/g,'').trim();}
function readInputMarker(text){const raw=String(text||'');return raw.match(/<!--ad-request:([a-zA-Z0-9_-]+)-->/)?.[1]||raw.match(/\[青空导演｜编号：([a-zA-Z0-9_-]+)｜/)?.[1]||'';}
function inputMarker(request){const label=value=>clean(value).replace(/[\r\n]+/g,' ').trim(),name=label(request.targetName).slice(0,80),form=label(request.targetForm)||'默认形态',detail=label(request.request);return '【Aozora导演系统】'+(request.kind==='character_intro'?'将为您设计'+name+'的人物形象 | '+form+' | '+(detail||'自动生成'):'将为您导演下一幕场景 | '+(detail||'自动镜头'));}

// Some text providers output the complete grouped protocol but omit its
// surrounding ad-visual tag. Recover only one structurally valid group from
// this turn; never borrow a differently owned or ambiguous visual block.
function visualGroupSpan(text){
 const source=String(text||''),starts=[...source.matchAll(/^[ \t]*【画面】[ \t]*$/gm)];
 const opaque=ProtocolBoundary.protectedRanges(source),eligible=starts.filter(m=>!ProtocolBoundary.isProtected(m.index,opaque));
 if(eligible.length!==1)return null;
 const head=eligible[0],lines=source.slice(head.index).match(/[^\r\n]*(?:\r?\n|$)/g)||[],valid=VisualProtocol.visualLine;
 let size=0,hasActor=false,hasEquipment=false;
 for(const line of lines){const trimmed=line.trim();
  if(trimmed&&!valid.test(trimmed)){if(!hasActor||!hasEquipment)return null;break;}
  if(/^【人物\s*\d+】$/.test(trimmed))hasActor=true;
  if(/^装备[：:]/.test(trimmed))hasEquipment=true;
  size+=line.length;
 }
 if(!hasActor||!hasEquipment)return null;
 let start=head.index,end=Math.min(source.length,start+size);
 // Accept missing closing tags and untagged plans, but never consume prose.
 const prior=source.slice(0,start).match(/<ad-visual\b[^>]*>[ \t\r\n]*$/i);
 if(prior)start-=prior[0].length;
 const close=source.slice(end).match(/^[ \t\r\n]*<\/ad-visual\s*>/i);
 if(close)end+=close[0].length;
 const inner=source.slice(head.index,Math.min(source.length,head.index+size)).trim();
 if(!bareVisualSignature(inner))return null;
 return {start,end,block:source.slice(start,end),inner};
}
function bareVisualSignature(inner){
 const draft=VisualProtocol.readDraft(inner);
 return !!draft.scene&&draft.characters.some(actor=>actor.name&&(actor.equipment&&typeof actor.equipment==='object'&&!Array.isArray(actor.equipment)||DNA.snapshot(actor.registrationDNA)));
}
function ownedVisualSpans(text){
 const source=String(text),tags=ProtocolBoundary.ownedTags(source,'ad-visual'),opaque=ProtocolBoundary.protectedRanges(source),spans=[];
 for(let i=0;i<tags.length;i++){
  const open=tags[i];if(open.closing)continue;
  const next=tags[i+1],barrier=opaque.find(range=>range.start>=open.end);
  const other=['ad-wardrobe','ad-physical-state'].flatMap(name=>ProtocolBoundary.ownedTags(source,name)).filter(item=>item.start>=open.end).sort((a,b)=>a.start-b.start)[0];
  const limit=Math.min(next?.start??source.length,barrier?.start??source.length,other?.start??source.length);
  if(next?.closing&&limit===next.start){spans.push({start:open.start,end:next.end,inner:source.slice(open.end,next.start),complete:true});continue;}
  const lines=source.slice(open.end,limit).match(/[^\r\n]*(?:\r?\n|$)/g)||[];let end=open.end;
  for(const line of lines){if(line.trim()&&!VisualProtocol.visualLine.test(line.trim()))break;end+=line.length;}
  spans.push({start:open.start,end,inner:source.slice(open.end,end),complete:false});
 }
 return spans;
}
const naiClearSubjectTagCount=BodyRelations.naiClearSubjectTagCount;
const castNumerals={一:1,二:2,两:2,双:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12};
const castNumber='(?:\\d+|[一二三四五六七八九]?十[一二三四五六七八九]?|[一二两双三四五六七八九]|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
const castPerson='(?:\\s*(?:个|名|位)?\\s*(人(?:物)?|角色|男生|女生|女性|男性|女士|男士|[男女](?=[一二两三四五六七八九十\\d\\s，,、和与或]|同框|入镜|出镜|$))|\\s+(people|persons?|characters?|women|men|woman|man|girls?|boys?)\\b)';
const frameWords=/(?:同框|入镜|出镜|露脸|(?:同一|一起|同时).{0,8}(?:画面|镜头|出现)|画面(?:中|里)|镜头(?:中|里)|合影|合照|in (?:the same |one |the )?(?:frame|shot)|on screen|visible together|group shot)/i;
const shotWords=/(?:拍|画|展示|呈现|我要|只要|都要|show\b|draw\b|depict\b|include\b)/i;
function castAmount(word){
 const text=word.toLowerCase();
 if(/^\d+$/.test(text))return Number(text);
 if(text==='十')return 10;
 if(text.includes('十')){
  const [tens,ones]=text.split('十');
  return (castNumerals[tens]||1)*10+(castNumerals[ones]||0);
 }
 return castNumerals[text]||0;
}
function requestedCastIn(value){
 const text=clean(value).normalize('NFKC');
 const pattern=new RegExp('('+castNumber+')'+castPerson,'gi');
 let target=null;
 for(const clause of text.split(/[，,。；;！？!?\n]/)){
  let total=null,categories=0,categoryLimit=false;
  for(const match of clause.matchAll(pattern)){
   const start=match.index;
   if(/[a-z0-9第]/i.test(clause[start-1]||''))continue;
   const before=clause.slice(0,start),after=clause.slice(start+match[0].length);
   const beforeTail=before.slice(-20);
   if(/(?:不要|不必|不用|不画|不想|不是|不要求|不需要|不希望|别|取消|(?:do not|don't|without|not)\b).{0,12}$/i.test(beforeTail))continue;
   if(/^\s*(?:(?:不|不必|不需要|不要|别)(?:入镜|出镜|同框|露脸)|留在画外|在画外|off[- ]screen)/i.test(after))continue;
   const limitOnly=/(?:最多|至多|不超过|上限(?:为|是)?|\bup to|\bat most)\s*$/i.test(beforeTail)||/^\s*(?:以内|以下)/.test(after);
   const shorthand=/^[\d一二两双三四五六七八九十个名位男女\s、和]+$/.test(clause.trim());
   if(!frameWords.test(clause)&&!(limitOnly||shotWords.test(clause)||shorthand||(!before.trim()&&!after.trim())))continue;
   const count=castAmount(match[1]);
   if(!Number.isSafeInteger(count)||count<1)continue;
   const label=match[2]||match[3];
   if(/^(?:人(?:物)?|角色|people|persons?|characters?)$/i.test(label))total={count,limitOnly};
   else{categories+=count;categoryLimit||=limitOnly;}
  }
  if(total)target=total;
  else if(categories&&Number.isSafeInteger(categories))target={count:categories,limitOnly:categoryLimit};
 }
 return target;
}
function castConstraint(request){
 const explicit=requestedCastIn(request.request);
 if(!explicit)return {limit:NAI_CAST_LIMIT,target:null};
 return explicit.limitOnly?{limit:Math.min(explicit.count,NAI_CAST_LIMIT),target:null}:{limit:explicit.count,target:explicit.count};
}
function validateCastLimit(plan,request={},sourcePlan){
 if(settings(request.config).format!=='nai45')return {applied:false};
 const {limit,target}=castConstraint(request);
 const inherited=sourcePlan?Math.max(sourcePlan.characters.length,naiClearSubjectTagCount(sourcePlan.scene)||0):0;
 const allowedLimit=Math.max(limit,inherited);
 const count=plan.characters.length,tagCount=naiClearSubjectTagCount(plan.scene),visible=Math.max(count,tagCount||0);
 return {applied:true,allowedLimit,characterCount:count,sceneTagCount:tagCount,overPreference:visible>allowedLimit,requestedCountUnconfirmed:!sourcePlan&&target>1&&visible<target};
}
function parseVisual(text,_legacyRequestId){
 const source=String(text||'');
 const blocks=ownedVisualSpans(source).filter(span=>span.complete);
 if(blocks.length>1)throw Error('本轮视觉数据重复，请重新生成本轮回复');
 let raw,block,at;
 if(blocks.length===1){
  const owned=blocks[0];raw=owned.inner;block=source.slice(owned.start,owned.end);at=owned.start;
 }else{
  // Protocol tags are structural only. A model-generated id is never used
  // as an ownership credential; the host generation lifecycle owns binding.
  const span=_legacyRequestId?visualGroupSpan(source):null;
  if(!span)throw Error((/<ad-visual\b/i.test(source)?'本轮视觉数据不完整':'本轮视觉数据缺失或重复')+'，请重新生成本轮回复');
  raw=span.inner;block=span.block;at=span.start;
 }
 raw=raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 let parsed;try{parsed=VisualProtocol.parse(raw);}catch{throw Error('视觉数据格式不完整，请重新生成本轮回复');}
 return {plan:normalizedPlan(parsed),block,at};
}
function directorDraft(text){
 const source=String(text||'');
 const blocks=ownedVisualSpans(source);
 const unique=[...new Set(blocks.filter(s=>s.complete).map(span=>span.inner.trim()))];
 const remainder=ProtocolBoundary.removeRanges(source,blocks.filter(s=>s.complete));
 const starts=[...remainder.matchAll(/^[ \t]*(?:<ad-visual(?=[\s/>])[^>]*>|【画面】)[ \t]*\r?$/gmi)];
 const standAlone=remainder.trimStart();
 const bare=/^(?:场景|scene)\s*[：:]/i.test(standAlone);
 const opaque=ProtocolBoundary.protectedRanges(remainder);
 const eligible=starts.filter(m=>!ProtocolBoundary.isProtected(m.index,opaque));
 const start=eligible[0]?.index??(bare&&!ProtocolBoundary.isProtected(remainder.length-standAlone.length,opaque)?remainder.length-standAlone.length:undefined);
 const lines=start===undefined?[]:remainder.slice(start).split(/\r?\n/);
 const loose=[];
 for(const line of lines){
  const trimmed=line.trim();
  if(trimmed&&!VisualProtocol.visualLine.test(trimmed))break;
  loose.push(line);
 }
 const candidate=loose.join('\n'),ownedOpening=eligible[0]?.[0].trim().startsWith('<ad-visual');
 return {
  draft:VisualProtocol.readDraft(unique[0]||(ownedOpening||bareVisualSignature(candidate)?candidate:'')),
  ambiguous:unique.length>1||(unique.length>0&&ownedOpening)||eligible.filter(m=>m[0].trim()==='【画面】'&&bareVisualSignature(remainder.slice(m.index))).length>1
 };
}
function repairEquipment(value){
 return Object.fromEntries(Wardrobe.SLOTS.map(slot=>{
  try{return [slot,Wardrobe.normalizeEquipment({[slot]:value?.[slot]??null},false)[slot]];}
  catch{return [slot,null];}
 }));
}
function repairOverrides(value){
 try{return DNA.compactSlots(DNA.overrides(value));}catch{return {};}
}
function visualValue(value){
 return clean(value).replace(/\s*\|\s*/g,', ').replace(/<\/?[^>]+>/g,'').trim();
}
function candidateDNA(identity){
 const {slots,unresolved}=DNA.normalize(identity);
 let extra=1;
 for(const phrase of unresolved){
  while(slots['extra'+extra])extra++;
  if(extra>999)break;
  slots['extra'+extra]=phrase;
 }
 return DNA.snapshot({schema:1,slots});
}
function completeDraft(draft,request,profiles){
 const characters=[],seen=new Set();
 const entries=draft.characters.length||request.kind!=='character_intro'?draft.characters:[{name:request.targetName,form:request.targetForm}];
 for(const actor of entries){
  const name=visualValue(actor.name)||(draft.characters.length===1&&request.kind==='character_intro'?clean(request.targetName):'');
  if(!name)continue;
  const target=request.kind==='character_intro'&&name===clean(request.targetName);
  const form=clean(actor.form)||(target?clean(request.targetForm):'')||'默认形态';
  const profile=request.kind==='character_intro'?null:Height.profileFor({name,form},profiles);
  const canonicalName=profile?.name||name,key=Wardrobe.key({name:canonicalName,form});
  if(seen.has(key))continue;
  seen.add(key);
  let registrationDNA=DNA.snapshot(actor.registrationDNA);
  if(request.kind==='character_intro')registrationDNA=registrationDNA
   ?DNA.snapshot({schema:1,slots:DNA.compactSlots(registrationDNA.slots)})
   :candidateDNA(visualValue(actor.identity));
  const identity=visualValue(actor.identity).replace(/\bregistered appearance\b\s*,?\s*/gi,'').trim()
    ||clean(profile?.identity)||DNA.snapshotIdentity(profile?.registrationDNA)||DNA.snapshotIdentity(registrationDNA)||'person';
  characters.push({name:canonicalName,form,identity,registrationDNA,appearanceOverrides:repairOverrides(actor.appearanceOverrides),frameSelection:VisualProtocol.frameSelection(actor.frameSelection),equipment:repairEquipment(actor.equipment),relation:VisualProtocol.relation(actor.relation)||undefined});
 }
 return {...draft,scene:visualValue(draft.scene),characters};
}

const countTag=/^(?:\d+\s*(?:girls?|boys?|others?|women|woman|men|man|people|persons?)|solo)$/i;
function castTags(actors){
 const kinds=actors.map(c=>BodyRelations.kind(c.appearanceOverrides?.typeAge||c.registrationDNA?.slots?.typeAge)||BodyRelations.kind(c.identity));
 if(kinds.some(kind=>!kind))return actors.length===1?['solo']:[];
 const counts=new Map();
 for(const kind of kinds)counts.set(kind,(counts.get(kind)||0)+1);
 return [...counts].map(([kind,count])=>count+kind+(count>1?'s':''));
}
function correctCountTags(plan,request){
 const count=plan.characters.length,tags=naiClearSubjectTagCount(plan.scene);
 if(settings(request.config).format!=='nai45'||tags===null||tags>=count)return plan;
 const remaining=PromptAdapters.splitTags(plan.scene).map(clean).filter(tag=>!countTag.test(tag));
 if(naiClearSubjectTagCount(remaining.join(','))!==null)return plan;
 return {...plan,scene:[...castTags(plan.characters),...remaining].filter(Boolean).join(', ')};
}

const untranslated=/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/;
function validateDirectorPlan(plan,request,sourcePlan){
 const cast=validateCastLimit(plan,request,sourcePlan);
 if(cast.overPreference)throw Error('画面中的清晰主体超过 '+cast.allowedLimit+' 位。');
 const withoutNames=value=>plan.characters.reduce((text,c)=>text.split(c.name).join(' '),String(value||''));
 const fields=[plan.scene,...plan.characters.flatMap(c=>[c.identity,...Wardrobe.SLOTS.flatMap(slot=>Wardrobe.garmentItems(slot,c.equipment[slot])).filter(item=>item.visible!==false).map(item=>item.name+' '+item.state)])];
 return {untranslated:fields.some(value=>untranslated.test(withoutNames(value))),separatorAdjusted:fields.some(value=>value.includes('|'))};
}

function readDirectorOutput(output,request,profiles=[]){
 const {draft,ambiguous}=directorDraft(output);
 try{
  const plan=normalizedPlan(correctCountTags(completeDraft(draft,request,profiles),request));
  if(!/[a-z\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/iu.test(plan.scene))throw Error('导演未返回可用的场景内容');
  return {plan,draft};
 }catch(error){return {draft,error:error.message};}
}

// A rejected protocol must never leak DNA JSON and equipment snapshots into
// visible prose. Only strip unmistakable protocol spans; preserve the story.
function hideBrokenVisual(text,{allowBare=false}={}){
 let source=String(text||'');
 const ranges=[...ownedVisualSpans(source),...ProtocolBoundary.ownedTags(source,'ad-visual')];
 if(allowBare){
  const withoutOwned=ProtocolBoundary.removeRanges(source,ranges),span=visualGroupSpan(withoutOwned);
  source=withoutOwned;
  if(span)source=ProtocolBoundary.removeRanges(source,[span]);
 }else source=ProtocolBoundary.removeRanges(source,ranges);
 return source.trim();
}
function escapeHtml(x){return String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderVisual(text,parsed,request,plan){
  const replacement=readableBlock(request,plan);
  // Only replace the owned protocol block; preset markup and prose are opaque.
  // Wardrobe metadata is hidden by success() after this step. It must not
  // masquerade as visible prose and suppress a standalone CG caption.
  const outside=storyText(parsed.block?String(text).replace(parsed.block,''):text);
  const prose=ProtocolBoundary.removeRanges(outside,ProtocolBoundary.protectedRanges(outside));
  const caption=!clean(request.storyInput)&&!visibleProse(prose)?'\n\n'+staticCaption(request,plan):'';
  const rendered=replacement+caption;
  return parsed.block?String(text).replace(parsed.block,()=>rendered):[rendered,String(text)].filter(Boolean).join('\n\n');
}
function visibleProse(text){return String(text).replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]*>/g,'').replace(/(?:&nbsp;|&#160;|&#x[aA]0;)/g,' ').trim();}
function readableBlock(request,plan){return '<!--ad-director:'+encodeURIComponent(JSON.stringify({requestId:request.id,generationId:String(request.generationId||''),chatId:String(request.chatId||''),taskId:String(request.taskId||request.id),plan}))+'-->';}
function referenceBlock(requestId,generationId='',chatId='',taskId=''){return '<!--ad-director-ref:'+encodeURIComponent(JSON.stringify({requestId:String(requestId||''),generationId:String(generationId||''),chatId:String(chatId||''),taskId:String(taskId||'')}))+'-->';}
function readSaved(text){const input=String(text),source=ProtocolBoundary.ownedComments(input,'ad-director').map(m=>m.text).join('\n')+'\n'+input.replace(/<!--[\s\S]*?-->/g,''),ref=source.match(/<!--ad-director-ref:([^]*?)-->/);if(ref){try{const data=JSON.parse(decodeURIComponent(ref[1]));if(!/^[a-zA-Z0-9_-]+$/.test(data.requestId))return null;return {...data,plan:null,referenceOnly:true};}catch{const legacy=ref[1].match(/^([a-zA-Z0-9_-]+)$/);if(legacy)return {requestId:legacy[1],plan:null,referenceOnly:true};return null;}}const hidden=source.match(/<!--ad-director:([\s\S]*?)-->/);if(hidden){try{const data=JSON.parse(decodeURIComponent(hidden[1]));if(!/^[a-zA-Z0-9_-]+$/.test(data.requestId))return null;return {...data,plan:normalizedPlan(data.plan)};}catch{return null;}}const m=source.match(/<details\s+data-ad-request="([a-zA-Z0-9_-]+)"[^>]*>[\s\S]*?<pre>([\s\S]*?)<\/pre>[\s\S]*?<\/details>/i);if(!m)return null;try{const unescape=x=>x.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');return {requestId:m[1],plan:normalizedPlan(JSON.parse(unescape(m[2])))}}catch{return null;}}
function stripDirectorComments(text){return ProtocolBoundary.removeRanges(text,ProtocolBoundary.ownedComments(text,'ad-director'));}
function storyText(text){return hideBrokenVisual(stripDirectorComments(PhysicalState.strip(Wardrobe.strip(String(text)))).replace(/<details\s+data-ad-request="[^"]+"[^>]*>[\s\S]*?<\/details>/gi,''));}
function inspectStoryGrounding(plan,prose){
 const excerpt=VisualProtocol.sourceExcerpt(plan?.sourceExcerpt),body=storyText(prose).replace(/<!--[\s\S]*?-->/g,'').replace(/<(think|analysis|script|style|qr|apt-drawer)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/\r\n/g,'\n');
 const source=excerpt?.replace(/\r\n/g,'\n'),at=source===undefined?-1:body.indexOf(source);
 const bodyHash=fingerprint(body);
 if(source===undefined)return {status:'unavailable',bodyHash};
 if(at<0)return {status:'unmatched',bodyHash};
 if(body.indexOf(source,at+1)>=0)return {status:'ambiguous',bodyHash};
 return {status:'matched',sourceExcerpt:source,bodyHash,at};
}
const builtinStyleIds=new Set(['meekohopanes_ru_zhai','mignon_allenes','kittew','meekohopanes']);
function neutralBuiltinStyle(style={}){
 if(!builtinStyleIds.has(style.id))return {...style};
 const positive=clean(style.positive).split(',').map(clean).filter(tag=>{
  const plain=tag.replace(/[{}\[\]]/g,'').replace(/^\d+(?:\.\d+)?::|::$/g,'').trim();
  return !/^(?:(?:very|extremely)\s+)?(?:pale|fair|light|white|dark|black|brown|tan|tanned|olive)\s+skin$/i.test(plain);
 }).join(', ');
 return {...style,positive};
}
function groupAppearance(actor,scene,audit){
  const snapshot=DNA.snapshot(actor.registrationDNA);
  if(!snapshot)return actor.identity;
  const {slots}=snapshot,changes=actor.appearanceOverrides||{};
  const distinctive=Object.keys(slots).filter(key=>/^(?:hair|hairDetail|eyes|skin|extra\d+)$/.test(key)&&slots[key]);
  if(distinctive.length<2)return actor.identity;
  const parts=PromptAdapters.splitTags(actor.identity).map(clean).filter(Boolean);
   const optional=['height','face'].filter(key=>!Object.hasOwn(changes,key)&&!(key==='height'&&actor.frameSelection?.appearance?.includes('height'))).flatMap(key=>PromptAdapters.splitTags(slots[key]||'').map(clean)
   .filter(part=>key==='height'||/^(?:oval|round|square|oblong) face$/i.test(part)));
  const namedFacts=scene.toLowerCase();
  const kept=parts.filter(part=>{
    if(!optional.includes(part)||namedFacts.includes(part.toLowerCase()))return true;
    audit.removed.push({name:actor.name,field:'identity',text:part,reason:'group-framing-appearance'});
    return false;
  });
  return kept.join(', ');
}
function frameAppearance(actor,identity,audit){
 // Projection already removes facts that are explicitly outside the frame.
 // An omitted selection is not evidence that a visible identity fact may vanish.
 return identity;
}
function frameOutfit(actor,outfit,audit){
 const selection=actor.frameSelection?.outfit;
 if(!selection||!outfit.entries)return outfit.outfit;
 const key=value=>String(value||'').normalize('NFKC').toLowerCase();
 const available=new Set(outfit.entries.filter(item=>item.name).map(item=>key(item.name)));
 const selected=new Set(selection.map(key));
 if([...selected].some(name=>!available.has(name)))return outfit.outfit;
 const outsideSlots={portrait:new Set(['LOWER','LEGWEAR','FOOTWEAR']),upper:new Set(['FOOTWEAR']),torso:new Set(['HEAD','FOOTWEAR']),lower:new Set(['HEAD']),feet:new Set(['HEAD','TOP'])}[audit.crop]||new Set();
 const kept=outfit.entries.filter(item=>!outsideSlots.has(item.slot)||item.required||selected.has(key(item.name))||PromptAdapters.referenceFacts(item.text,'outfit').length||/[\[\]{}]|::/.test(item.text));
 if(!kept.length&&outfit.entries.length&&!audit.faceOffFrame)return outfit.outfit;
 const accepted=new Set(kept);
 for(const item of outfit.entries)if(!accepted.has(item))audit.removed.push({name:actor.name,field:'outfit',slot:item.slot,text:item.text,reason:'frame-selection'});
 return [...new Set(kept.map(item=>item.text))].join(', ');
}
function positiveCue(text,pattern){
 const source=clean(text);
 for(const match of source.matchAll(pattern)){
  const before=source.slice(Math.max(0,match.index-14),match.index);
  if(/(?:不要|别|不想(?:要)?|不必|不需要|无需|避免|禁止|not|no|don't(?:\s+(?:want|use|show))?|do not(?:\s+(?:want|use|show))?|avoid|without)\s*(?:a\s+|the\s+)?$/i.test(before))continue;
  return true;
 }
 return false;
}
function applyShotPreference(plan,request={}){
 const cfg=settings(request.config||{}),pictureRequest=typeof request==='string'?request:clean(request.request);
 const fullCue=/(?:全身|头到脚|full[- ]body|head[- ]to[- ]toe)/gi;
 const cropCue=/(?:特写|近景|半身|腰部以上|胸口以上|上半身|局部裁切|只拍(?:脸|头|手|脚|腿|腰|胸|肩|背|局部)|只显示(?:脸|头|手|脚|腿|局部)|close[- ]up|medium shot|mid shot|waist[- ]up|upper[- ]body(?: shot| framing)?|bust shot|headshot|cowboy shot|three[- ]quarter shot|knee[- ]up|thigh[- ]up|torso[- ]only|hands?[- ]only|feet?[- ]only)/gi;
 const negativeFull=/(?:不要|别|不想(?:要)?|不必|不需要|无需|避免|禁止|not|no|don't(?:\s+(?:want|use|show))?|do not(?:\s+(?:want|use|show))?|avoid|without)\s*(?:a\s+|the\s+)?(?:全身|头到脚|full[- ]body|head[- ]to[- ]toe)/gi;
 if(!(cfg.shot==='full'||positiveCue(pictureRequest,fullCue))||positiveCue(pictureRequest,negativeFull)||positiveCue(pictureRequest,cropCue))return plan;
 const framePrefix=/^(?:(?:a|the)\s+)?(?:(?:extreme|tight|medium)\s+)?(?:close[- ]up(?: shot)?|waist[- ]up(?: framing| shot)?|upper[- ]body(?: shot| framing| view)?|bust shot|headshot|knee[- ]up|thigh[- ]up|three[- ]quarter shot|cowboy shot|medium(?: group)? shot|mid shot)(?:\s+(?:of|on)\s+)?/i;
 const tags=PromptAdapters.splitTags(clean(plan.scene)).map(tag=>clean(tag.replace(framePrefix,''))).filter(Boolean),existing=tags.join(', '),cue=[];
 if(!/\b(?:full[- ]body|full figure)\b/i.test(existing))cue.push('full-body shot');
 if(!/\bhead[- ]to[- ]toe\b/i.test(existing))cue.push('head-to-toe framing');
 if(!/\b(?:feet|foot) (?:visible|in frame)\b/i.test(existing))cue.push('entire figure including feet visible');
 return {...plan,scene:[...cue,...tags].join(', ')};
}
function compose(plan,style={},config={}){
  style=neutralBuiltinStyle(style);
  const cfg=settings(config),resolved=resolveFragments(normalizedPlan(plan));
  const relativeHeightCue=Projection.sceneCrop(resolved.scene)==='hands'?'':Height.relativeCue(resolved,cfg.format);
  if(relativeHeightCue)resolved.scene=[resolved.scene,relativeHeightCue].filter(Boolean).join(', ');
  const projection=Projection.project(resolved,cfg.format),body=BodyRelations.compile(projection.plan,cfg.format,projection.audit.crop),p=body.plan,positive=clean(style.positive);
  if(relativeHeightCue)projection.audit.relativeHeightCue=relativeHeightCue;
  const outfitContext={scene:p.scene,crop:projection.audit.crop,format:cfg.format,multipleActors:p.characters.length>1};
  const group=cfg.format==='nai45'&&Math.max(p.characters.length,naiClearSubjectTagCount(p.scene)||0)>NAI_CAST_LIMIT;
  p.characters=p.characters.map(actor=>{
    const visible=Wardrobe.forImage(actor,{...outfitContext,audit:projection.audit,includeEntries:!!actor.frameSelection?.outfit});
    const outfit=frameOutfit(actor,visible,projection.audit);
    const identity=frameAppearance(actor,group?groupAppearance(actor,p.scene,projection.audit):actor.identity,projection.audit);
    return {...actor,identity,outfit};
  });
  const protectedAppearance=p.characters.map(actor=>[...new Set([...Object.values(actor.appearanceOverrides||{}).flatMap(value=>PromptAdapters.splitTags(clean(value)))].map(clean).filter(Boolean))]);
  const options={};if(cfg.ratio!=='api')options.aspectRatio=cfg.ratio;if(cfg.imageService==='official'){for(const k of ['width','height'])if(!Number.isInteger(cfg[k])||cfg[k]<64||cfg[k]>2048||cfg[k]%64)throw Error('宽高须为64–2048之间的64倍数');if(cfg.width*cfg.height>3145728)throw Error('尺寸总像素超出限制');delete options.aspectRatio;options.extraBody={width:cfg.width,height:cfg.height};}
  if(style.useNegative&&clean(style.negative))options.negativePrompt=clean(style.negative);
  const languageAudit=PromptValidation.validate(p,style);
  const composed=PromptAdapters.compile(p,{...style,positive},cfg.format),prompt=composed.prompt;
  if(composed.budgetAudit){
    const full=resolveFragments(normalizedPlan(plan));full.characters=full.characters.map(c=>({...c,...Wardrobe.forImage(c,{...outfitContext,crop:'unknown'})}));
    const original=PromptAdapters.sections(full,{...style,positive},cfg.format);
    const audit=composed.budgetAudit;audit.compilerBefore=audit.before;
    audit.before=Budget.risk([original.base,...original.characters.map(c=>c.prompt)].join(' | '));
    audit.estimateBefore=audit.before.estimate;
    audit.removed.unshift(...projection.audit.removed);
    audit.adjusted.unshift(...(projection.audit.adjusted||[]));
    if(audit.after.estimate<audit.before.estimate&&audit.removed.length)audit.mode='safely-converged';
    audit.prompt=prompt;audit.sections=structuredClone(composed.sections);
  }
  let requestedSeed=null;
  if(cfg.seedFixed){requestedSeed=seedValue(cfg.seedValue,cfg.format);options.extraBody={...(options.extraBody||{}),seed:requestedSeed};}
  else if(cfg.format==='nai45'){requestedSeed=Math.floor(Math.random()*4294967296);options.extraBody={...(options.extraBody||{}),seed:requestedSeed};}
  return {prompt,options,renderedScene:composed.renderedScene??p.scene,scaleAudit:body.audit,renderAudit:projection.audit,languageAudit,budgetAudit:composed.budgetAudit||null,protectedAppearance,requestedSeed,fixedSeed:!!cfg.seedFixed,characters:composed.sections.characters.map(c=>({name:c.name,form:c.form,identity:c.identity,outfit:c.outfit,...(c.relation?{relation:c.relation}:{})})),sections:composed.sections,syntax:composed.syntax,format:cfg.format};
}
function applyFrameCompression(compiled,style,raw,inputFingerprint){
 const result=PromptAdapters.applyFrameCompression(compiled,style,raw);
 const before=Budget.risk(compiled.prompt),after=Budget.risk(result.prompt);
 const applied=after.words<before.words;
 const frameCompression={status:applied?'applied':'retained',inputFingerprint,wordsBefore:before.words,wordsAfter:after.words,adjusted:result.edits,retained:result.retained};
 const oldBudget=compiled.budgetAudit;
 const budgetAudit=oldBudget?{...oldBudget,after,estimateAfter:after.estimate,overBudget:after.estimate>oldBudget.target,risk:after.estimate>oldBudget.target,
  mode:applied?'frame-compressed':oldBudget.mode,warning:after.estimate>oldBudget.target?oldBudget.warning:'',adjusted:[...oldBudget.adjusted,...result.edits],
  frameCompression,prompt:result.prompt,sections:structuredClone(result.sections)}:null;
 const characters=compiled.characters.map((c,index)=>({...c,identity:result.sections.characters[index].identity,outfit:result.sections.characters[index].outfit}));
 return {...compiled,prompt:result.prompt,sections:result.sections,characters,budgetAudit,renderAudit:{...compiled.renderAudit,frameCompression}};
}
function hasMotionOrigin(image,images=[]){
 const byId=new Map((images||[]).map(item=>[String(item?.id||''),item])),seen=new Set();
 let current=image;
 while(current){
  if(current.motion||current.motionDerived)return true;
  const sourceId=String(current.directorContext?.sourceImageId||'');
  if(!sourceId||seen.has(sourceId))return false;
  seen.add(sourceId);
  current=byId.get(sourceId)||null;
 }
 return false;
}
function confirmedSeed(result){
  // Deliberately never inspect requested options, parameters echoes or our own generated seed.
  if(!result||typeof result!=='object')return null;
  for(const value of [result.seed,result.runtimeParams?.seed,result.metadata?.seed]){
    if(value!==null&&value!==undefined&&/^\d+$/.test(String(value))&&Number.isSafeInteger(Number(value)))return Number(value);
  }return null;
}
const frameSelectionInstruction='按本帧标记需要强调的外貌和衣着。只标记实际入镜、能区分人物、影响当前状态或玩家明确要求的细节。近景、全身和局部镜头遵循同一原则。场景只引用定位人物或讲清动作所需的外貌和衣着，其余细节放在各自人物栏。appearance 填已有登记DNA或本轮外貌的槽名，只有「外貌」文本时可逐字引用其中的逗号分隔短语。outfit 逐字引用当前可见装备的 name，衣着状态仍由完整装备快照继承。该选择只作辅助，不替代登记DNA或装备状态；未选中或空数组不代表删除可见人物特征、不穿衣物或清空主衣物。无法确认时省略该字段。';
function buildInstruction(request,ruleCatalog,profiles,{visualOnly=false}={}){
  const cfg=settings(request.config),registered=(profiles||[]).map(({avatar,...profile})=>({...profile,identity:Wardrobe.sceneProp.test(profile.identity)?withoutScenePropsIdentity(profile.identity):profile.identity,registrationDNA:withoutScenePropsDNA(profile.registrationDNA)||undefined})),character=request.kind==='character_intro',story=!!clean(request.storyInput);
  const nextTurn=request.kind==='story_cg'&&story&&!visualOnly,savedReply=request.kind==='story_cg'&&story&&visualOnly&&request.sceneSelection==='saved-reply';
  const name=clean(request.targetName),form=clean(request.targetForm)||'默认形态';
  const cast=cfg.format==='nai45'?castConstraint(request):null;
  const staticFrame=!story&&!visualOnly;
  const staticStory=request.kind==='story_cg'&&staticFrame;
  const automaticStill='从当前上下文已发生的事件或当前状态选择一个可成图的瞬间。';
  const selectedCatalog=nextTurn?RuleCompiler.nextTurnCatalog(ruleCatalog,request)
    :savedReply?RuleCompiler.savedReplyCatalog(ruleCatalog)
    :staticStory?{...ruleCatalog,requestBoundary:clean(request.request)?'按玩家画面要求设计一张独立静帧，已知人物资料可用于保持一致。':automaticStill}
    :ruleCatalog;
  const ruleLayers=RuleCompiler.compileRuleLayers({...request,config:cfg},selectedCatalog||{});
  const isAdultLayer=layer=>RuleCompiler.ADULT_KEYS.some(key=>layer.name.endsWith('-'+key));
  const earlyRuleText=ruleLayers.filter(layer=>!isAdultLayer(layer)).map(layer=>layer.text).join('\n\n');
  const adultGateText=ruleLayers.find(layer=>layer.name.endsWith('-'+RuleCompiler.ADULT_GATE_KEY))?.text||'';
  const adultDetailText=ruleLayers.filter(layer=>RuleCompiler.ADULT_DETAIL_KEYS.some(key=>layer.name.endsWith('-'+key))).map(layer=>layer.text).join('\n\n');
  const framingInstruction=cast?.target>NAI_CAST_LIMIT
    ? cfg.shot==='full'
      ? '本轮明确要求 '+cast.target+' 位清晰主体全身同框。采用能容纳全员的画幅；每位主要人物都要从头到脚完整入画并露出双脚，Scene写 full-body group shot、head-to-toe framing。只有玩家明确指定局部裁切时才允许裁掉身体部位。'
      : '本轮明确要求 '+cast.target+' 位清晰主体同框。采用能容纳全员和读清主要动作的最小景别，保留明确指定的机位。'
    : cfg.shot==='full'
    ? '本轮镜头范围：全身。没有玩家明确指定局部或近景裁切时，Scene必须以 full-body shot、head-to-toe framing 明确取景，主要人物从头到脚完整入画，头顶和双脚都在画面内。不得用 medium shot、portrait、waist-up 或近景代替。人物仍占据主要画面。'
     : '本轮镜头范围：近景优先。按动作焦点选择最小可读区域，优先选择腰部以上或关键局部，只有姿势、支撑、多人空间关系或玩家明确要求需要时才扩大到全身或远景。脸只在动作或情绪需要时入画。室外、广场、旷野、大厅等开阔地点只说明所在空间；除非玩家明确要展示全景，或主要动作确实需要交代远近位置，否则保持主体占据画面主要面积。人物半身近景在 Scene 开头同时写 medium close-up 和 waist-up framing，局部镜头则写明确的部位与裁切。选定一个景别，后面不再加 wide shot、establishing shot、panoramic view 或 distant subject 等互相冲突的构图词。不要用含糊的 medium distance 代替人物裁切；如有远景物体，写明它在背景中的位置，不改变人物的取景。已有地点时在当前画幅内用一处具体可见环境线索及实际光线交代地点，可放在虚化背景中，不要改成空白背景。先调整相机机位和朝向；主动作仍看不清时，只扩大到读懂主要动作所需的最小范围。';
  const texts=[
    '【Aozora导演 · 本轮任务】',
    savedReply?'为已保存回复新增画面：先按要求确定采用正文选景或独立画面，再安排镜头，只输出视觉块。':visualOnly?'从已完成的本轮内容选一个画面，只输出视觉块。':nextTurn?'先结合上下文和玩家要求定下一帧，先输出画面块，再写正文。':staticFrame?'先确定静帧，输出视觉块，再在块外写同一画面的中文正文。':(story&&!character?'先结合上文和玩家要求确定要画的定格，再围绕同一幕写正文。':'按本轮要求输出画面方案。'),
    character?'任务：人物形象候选图。目标：'+name+'（'+form+'）。优先画目标人物；玩家指定陪衬时按当前格式的取景规则安排。人物设计的本轮改动不自动登记。':savedReply?'任务：为已保存回复补图或选择新场景。正文用于提供既有事实，不构思新的剧情进展；画面要求以「玩家本轮画面要求」为准。明确要求只画某个人时，不把其他参与者加入镜头。':'任务：剧情CG。玩家明确要求只画某个人时，不把其他剧情参与者加入镜头。玩家剧情输入用于推进并约束本轮实际事件，不等于额外的画面指令；专门的取景要求以「玩家本轮画面要求」为准。'+(staticStory?'':nextTurn?'未指定画面时，从本轮剧情构思中选择将自然发生的关键瞬间。':'未指定画面时，从本轮回复实际发生的剧情中选镜头。'),
    '玩家本轮画面要求：'+(clean(request.request)||(character?'未指定；根据目标人物设定设计':staticStory?'未指定，由导演选景':'未指定；从本轮实际剧情中选最值得画的一个瞬间')),
    savedReply?'正文选景只使用本次要求与已保存回复中的实际事件；玩家指定的具体画面未在正文出现时允许独立画面，但不得写回正文或剧情状态。':visualOnly?'只使用本轮画面要求与下方已保存回复中的剧情事实。':story?(character?'本轮有剧情：人物图遵守剧情事实，不因正文有其他角色就让其入镜；正文自然衔接。':nextTurn?'正文让定格中的动作和当时状态自然发生，之后可以继续剧情。':'本轮有剧情：确定的画面应真实出现在正文中。正文允许继续叙事，但图片只取一个瞬间。'):'本轮无剧情行动：只设计静态画面，不推进事件、关系或时间，不增加对白或变量变更。',
    '【画面、身份与服装原则】',
    earlyRuleText,
    PhysicalState.scaleInstruction(request.physicalState),
    '两位参与者有已知体型差且当前镜头可见时，在 Scene 中写清谁更宽厚或更纤细，并用一处同框的肩、躯干或肢体对比表现；沿用玩家指定的取景。',
    DNA.instruction,
    '【本轮有效的已登记人物】',
    JSON.stringify(registered),
    '【本轮摄影机取景设置】',
    framingInstruction,
    ...(cast?['本轮最多 '+cast.limit+' 位清晰主体。先让主要角色清楚入镜，互动角色仅在完整入镜更能讲清动作时占第二个位置；否则只让发生互动所需的局部出现。全身设置约束选定的清晰主体，正文参与人数不改变画面人数。']:[]),
    '玩家明确指定的机位、景别、只拍的身体部位、不露脸要求和入镜人物优先。脸不是默认必须入画。明确要求身体局部时，Scene开头写清局部裁切边界，只描述实际可见部位；不为身份辨认、脸部DNA或近景偏好向上扩大到头脸。',
    cfg.directorFrame
      ? '本轮实际出图尺寸：'+cfg.directorFrame.width+' × '+cfg.directorFrame.height+' 像素（'+(cfg.directorFrame.width===cfg.directorFrame.height?'方图':cfg.directorFrame.width>cfg.directorFrame.height?'横图':'竖图')+'）。按此画幅安排构图，保留玩家指定的画面内容。'
      : cfg.ratio==='api'||['nai45','official','relay'].includes(cfg.imageService)?'画幅按图片接口决定，不预设比例。':'构图参考画幅 '+cfg.ratio+'；不可因此删除玩家指定的画面内容。',
  ];
  if(adultDetailText)texts.push(adultGateText,PhysicalState.adultInstruction(request.physicalState),adultDetailText);
  if(adultDetailText&&cfg.format==='nai45'&&['nai45','official','relay'].includes(cfg.imageService))texts.push(
    '【仅限 NAI 4.5·动作与体位候选标签】符合上述成人画面适用范围，并且玩家本轮明确指定的动作、体位或摩擦方式和标签含义完全吻合时，才可以在 Scene 使用对应英文标签。选最具体的词，每类最多一个，避免同义词堆叠；同帧确有明确体位时可再加一个体位标签。标签只辅助识别动作，短句仍写清执行者、双方姿势、支撑、接触点和玩家指定的动作阶段。只说顶、碰、贴、蹭、摸或提及身体部位时，按字面写实际接触，不据此套入专有动作标签；泛称后入也不推断为特定跪姿。标签与玩家指定细节冲突或含义不确定时，省略标签。',
    '动作候选：footjob、thigh sex、paizuri、handjob、fellatio、cunnilingus。口交泛称未明确具体方式时，不强行选择子类。',
    '体位候选：missionary、doggystyle、prone bone、cowgirl position、reverse cowgirl position、spooning、standing sex。名称和体位须同时符合所选定格。',
    '摩擦候选：frottage（明确的非插入式摩擦）、legjob（明确用腿进行的动作）、pussyjob（明确的对应外部摩擦）、buttjob（明确的臀部摩擦）。已有更具体的动作标签时，省略覆盖它的泛称。'
  );
  if(character){
    texts.push('【人物候选的来源】');
    texts.push(request.freshFromDeletion?
      '玩家已删除该角色原登记。旧候选图及历史AI自行补充的外貌不是永久原设定；只保留目前人物卡、世界书、玩家明确要求及已确立的剧情事实，缺失部分重新设计。不要从旧图片自动恢复已删除的DNA。':
      '首次设计以当前人物卡、世界书、玩家要求及明确剧情事实为依据。未登记的旧图片不会自动成为人物原设定；本次要生成可供玩家选择的新候选。');
    texts.push('人物候选用「登记DNA」直接返回分槽 JSON。手提包、背包、相机、雨伞、行李及手持工具等外部物件只描述在当前 Scene，不写入登记DNA或持续装备。每个已知槽值用简短英文表达，合并同义描述，保留玩家设定的颜色、位置和识别特征。没有事实的槽省略。候选在玩家主动登记后才写进档案。');
  }
  const shotExample=cfg.shot==='full'?'full-body shot, head-to-toe framing':'medium close-up, waist-up framing';
  const exampleScene=shotExample+(cfg.format==='nai45'?', 1girl':'')+', soft window light, a woman turns toward the window';
  const example=['<ad-visual id="protocol">','场景：'+exampleScene,...(staticFrame?['描述：她在窗边回过头。']:[]),'人物：'+(character?'目标人物姓名':'角色姓名'),...(character?['登记DNA：{"schema":1,"slots":{"typeAge":"adult woman","hair":"short black hair","eyes":"brown eyes"}}']:[]),'</ad-visual>',...(staticFrame?['','【静态画面】她在柔和的窗光里回过头。']:[])].join('\n');
  texts.push('【画面输出】'+(!visualOnly?'先写一个 ':'写一个 ')+'<ad-visual> 块，只必填一行英文场景。'+'每位需要独立画出外貌或服装的清晰主体另写一行「人物：姓名」，紧接该人物的可选字段。画外参与者只在场景写真实可见的局部。以下示例只展示格式，请按本轮实际构图填写。');
  texts.push(example);
  texts.push('【容错与预算目的】用简洁英文保留玩家要求、关键动作和本帧状态。省略重复词和无关背景。');
  texts.push('【Aozora数据格式边界】程序数据只写在各自完整闭合的专用标签中：画面使用 <ad-visual>...</ad-visual>，衣着更新使用 <ad-wardrobe>...</ad-wardrobe>，身体设定更新使用 <ad-physical-state>...</ad-physical-state>。按本任务要求输出适用的数据块，不额外增加块。每块独立且只出现一次，不互相嵌套，不放入Markdown代码围栏或其他插件标签内；JSON必须完整且可解析。关闭标签后才能继续正文或其他附加结构。不要只输出裸的“【画面】”“场景：”或人物字段代替完整画面块，不把正文或其他附加结构包进Aozora数据块。');
  if(savedReply)texts.push('【导演记录与正文边界】判定与构思在内部完成，不向正文输出成人判定、规则核对、思考过程、剧情提纲或选景说明。只将已确定的方案结果记在同一个 <ad-visual> 内、场景行之后及人物行之前：本轮事件：正文选景时一句话概括对应事件，独立画面时注明“独立画面，非正文事件”；选定瞬间：一句话说明本图所取的具体一瞬；镜头安排：一句话说明最终机位、景别及裁切。每项只写简短结果，不写分析步骤、比较过程或 Gate 的 PASS/FAIL。三项仅供生成记录中的导演方案查看，不是正文，不进入生图提示词；不新增协议块。关闭视觉块后结束，不输出或修改正文。');
  if(story)texts.push('【Scene 分工】一行只写这张图需要的镜头与裁切、主体动作和彼此位置、必要道具或环境线索。正文已明确地点且当前画幅看得见环境时，保留至少一个具体场所线索和已知主光；近景可把线索放在虚化背景中，用简短背景从句写出场所，重点仍是当前主体与裁切。明确纯色背景、极限特写及不可见环境按原要求。该线索与关键动作一起保留在精简后的 Scene。同一个可见事实只写一次。已登记外貌由人物栏继承；本帧发型等外貌变化交给「本轮外貌」，静态衣着及其变化交给「装备」。衣物、头发或道具本身参与动作时，Scene 只写动作及其必要对象，把颜色、款式等归回对应人物栏。「关系」只补 Scene 未交代且需要指定归属的姿态。省略审美修饰、次要环境和相邻时刻。');
  if(cfg.format==='nai45')texts.push('【NAI 软预算】整份正面提示词建议约512以内（英文词数 ×1.80 粗估），包含画风词和全部人物外貌、装备。'+(story?'给人物栏留空间，普通 Scene 写约55至75个英文词；复杂定格可写长一些，优先保留玩家指定的取景、动作和可见关系。':'用简短英文保留关键可见事实。')+'超出预算仍可出图。');
  if(nextTurn)texts.push('人物栏按需填写：非默认形态写「形态」；未登记人物写英文「外貌」，已登记人物的临时发型等变化必须写在「本轮外貌」一行，使用 JSON 对象，例如 本轮外貌：{"hair":"dark brown hair in a high ponytail"}。保留未变的发色；旧刘海或碎发本帧已不适用时写 "hairDetail":""。汗水、红晕等反应写进 Scene。「装备」只列定格当下相对开场变化或首次确定的部位；省略则沿用，明确脱空用 []。多人动作需要绑定时，用「关系」写英文短语。');
  else texts.push('「形态」仅在非默认形态时填写。已登记人物按姓名/别名及形态继承外貌。剧情中的未登记人物用「外貌」写已知英文特征。对话中临时改变的发型、发色等，只要在本轮所选画面里已经实际生效，就必须用「本轮外貌」覆盖对应槽位，例如 {"hair":"short black bob"}；该覆盖只影响当前画面，不改正式人物档案。不要把愿望、计划或未来变化当成已生效外貌。稳定特征确实改变时也用「本轮外貌」JSON表达当前值。 在「装备」写这幅画面描写结束时的穿着，列出该时点相对本轮开场已变化或首次确认的部位，例如 装备：{"TOP":[{"name":"white blouse"}],"FULL":[]}。整部位脱空必须写 []，省略表示沿用开场。外层脱下后，原本遮住而现在可见的衣物也要更新为可见。需要独立说明某人的姿态时，可用「关系」填英文短语。');
  if(!character)texts.push('已登记人物以档案为外貌基准。本轮剧情已发生或玩家明确指定在本图生效的发型优先，必须覆盖对应槽。历史正文里的过时外貌不写进 Scene 或「本轮外貌」。临时外貌变化只影响本轮；玩家明确设为长期基准的身高、体型或双人固定尺度关系，通过持久身体设定同步保存。');
  if(!nextTurn)texts.push('【本帧取用】'+frameSelectionInstruction+' 放在对应人物栏，例如 本帧取用：{"appearance":["hair","eyes"],"outfit":["white blouse"]}。这一行只影响当前画面。');
  texts.push(Wardrobe.layerInstruction);
  if(!nextTurn)texts.push('【首次穿着与延续】'+Wardrobe.continuityInstruction);
  if(!character)texts.push('【可选局部参与者】如需继承已登记画外角色的手部等局部特征，可在视觉块写一行 局部参与者：[{"name":"角色名","region":"hands"}]，并在 Scene 的对应局部后写 @limb1@。若这个镜头里该角色的手套、袖口或饰品与开场不同，在该参与者内加 equipment，例如 {"HAND":[]}。仅在有明确身份和可见细节时使用。');
  if(!visualOnly)texts.push(nextTurn?'关闭唯一画面块后再写正文及原有附加结构。':story?'关闭视觉块后写正文，正文要写出这个定格及其实际穿着。写完这幅画面后，剧情可以继续。其他世界书的附加结构按原规则保留。':'只拍摄静态画面。视觉块内先写英文「场景」，再在第一位人物之前写一句同一画面的中文「描述」，供系统补全正文。关闭 </ad-visual> 后，必须另起一段，以【静态画面】开头，用自然中文描写同一个定格中实际可见的人物、姿态、衣着或环境。只填写角色名、画面要求留空或聊天输入留空时，也必须同时输出视觉块和这段正文。');
  if(story&&!visualOnly)texts.push(Wardrobe.instruction(request.id,request.wardrobe||[],registered,{compact:true,changesOnly:nextTurn}));
  else if(request.wardrobe?.length)texts.push('【本轮开场的衣着】'+JSON.stringify(request.wardrobe.map(({name,form,equipment})=>({name,form,equipment:Wardrobe.compactEquipment(equipment)}))));
  if(!visualOnly&&!staticFrame)texts.push(PhysicalState.updateInstruction({allowScale:!character,allowAdult:!!adultDetailText&&!character}));
  return texts.filter(Boolean).join('\n\n');
}
function redactRecord(value){
 const sensitive=/^(?:authorization|proxyauthorization|bearer|xapikey|apikey|accesskey|clientsecret|clientkey|privatekey|token|authtoken|accesstoken|refreshtoken|password|secret|credential|credentials|cookie|setcookie|headers)$/i;
 return JSON.parse(JSON.stringify(value,(key,entry)=>{
  if(sensitive.test(key.replace(/[^a-z0-9]/gi,'')))return '[已隐藏]';
  if(typeof entry!=='string')return entry;
  if(/^data:[^,]+,/i.test(entry)||(entry.length>1024&&/^[a-z0-9+/_=-]+$/i.test(entry)))return '[图片数据已省略]';
  return entry.replace(/\bBearer\s+[a-z0-9._~+/=-]{8,}/gi,'Bearer [已隐藏]')
   .replace(/\b(?:api[ _-]?key|access[ _-]?token|password|client[ _-]?secret)\s*[:=]\s*["']?[^\s"',;]+/gi,part=>part.replace(/([:=])\s*.+$/,'$1 [已隐藏]'))
   .replace(/\b(?:pst-[a-z0-9._-]{12,}|sk-[a-z0-9._-]{16,})\b/gi,'[已隐藏]')
   .replace(/\bhttps?:\/\/[^\s<>"']+/gi,url=>{
    try{const address=new URL(url);if(!address.username&&!address.password&&!address.search&&!address.hash)return url;address.username='';address.password='';address.search='';address.hash='';return address.toString();}catch{return url;}
   });
 }));
}
function generationRecord(record,image,detail=false,events=[]){
 const transport=image.requestAudit?.promptTransportAudit;
 const wire=image.requestAudit?.wireAudit;
 const body=wire?.body;
 const nativeCaptions=image.requestAudit?.captionTransport==='nai45-native-captions';
 const positive=body?.input??body?.prompt??(wire?.input||transport?.prompt||image.prompt||'');
 const negative=body?.parameters?.negative_prompt??body?.negative_prompt??body?.nai?.negative_prompt??wire?.v4NegativePrompt?.caption?.base_caption??transport?.negativePrompt??image.options?.negativePrompt??'';
 const captions=nativeCaptions?(body?.parameters?.v4_prompt?.caption?.char_captions||wire?.v4Prompt?.caption?.char_captions||[]):[];
 const plan=image.plan||record.plan;
 const directorPlan=plan?{
  scene:plan.scene,description:plan.description||'',
  ...(VisualProtocol.sourceExcerpt(plan.sourceExcerpt)!==undefined?{sourceExcerpt:plan.sourceExcerpt}:{}),
  ...(VisualProtocol.directorSummary(plan.directorSummary)?{directorSummary:VisualProtocol.directorSummary(plan.directorSummary)}:{}),
  characters:(plan.characters||[]).map(({name,form,identity,relation,equipment})=>({name,form,identity,relation,equipment:Wardrobe.compactEquipment(equipment||{})}))
 }:null;
 const simplified={directorPlan,finalPrompt:{positive,negative,...(captions.length?{characters:captions.map(({char_caption})=>char_caption)}:{})}};
 if(!detail)return simplified;
 // Fields tied to this image stay valid when a later reroll updates the parent record.
 const context=image.directorContext;
 const matchingEvents=events.filter(row=>String(row.chatId||'')===String(record.chatId||'')&&
  (row.jobId===image.id||row.imageId===image.id||(context?.requestId&&row.requestId===context.requestId&&!row.jobId&&!row.imageId)));
 return redactRecord({
  product:'Aozora导演系统',version:VERSION,exportedAt:new Date().toISOString(),
  messageId:record.messageId,imageId:image.id,requestId:context?.requestId||record.requestId||null,
  taskId:context?.taskId||record.taskId||null,generationId:context?.generationId||record.generationId||null,
  createdAt:image.createdAt,kind:image.kind,...simplified,
  directorContext:context||{instruction:record.directorInstruction||null,request:record.request||record.renderIntent?.sources?.pictureRequest||'',storyInput:record.storyInput||'',scope:'message'},
  directorOutput:image.executionAudit?.directorOutput||record.directorOutputAudit||null,
  style:image.style||null,
  request:image.requestAudit||null,
  configuration:image.config,
  response:{...image.requestAudit?.response,providerFields:image.providerFields,metadata:image.metadata,seed:image.seed,requestedSeed:image.requestedSeed,seedVerification:image.seedVerification,parameters:image.parameterVerification},
  diagnostics:{identity:context?.identityAudit||record.identityAudit,wardrobe:context?.wardrobeAudit||record.wardrobeAudit,execution:image.executionAudit,language:image.languageAudit,render:image.renderAudit,scale:image.scaleAudit,budget:image.budgetAudit,verification:image.verification,timings:image.timings,events:matchingEvents},
  ...(image.motion?{motion:image.motion}:{})
 });
}
function staticCaption(request,plan={}){const label=clean(plan.description)||clean(request.request)||(request.kind==='character_intro'?clean(request.targetName)+' · '+(clean(request.targetForm)||'默认形态'):'由导演选择当前画面');return '【静态画面】'+escapeHtml(label);}
const Core={reuseRegisteredIdentity,withoutScenePropsDNA,resolveFragments,VERSION,DEFAULTS,styleFormat,styleMatches,clean,id,fingerprint,settings,imageServiceMode,supportsNaiImageEdit,hasMotionOrigin,seedValue,normalizedPlan,naiClearSubjectTagCount,validateCastLimit,cleanDirectorInput,inputMarker,parseVisual,readSaved,readableBlock,referenceBlock,storyText,escapeHtml,compose,confirmedSeed,buildInstruction,applyShotPreference,staticCaption,generationRecord,redactRecord};
Core.hasUntranslatedPromptText=PromptValidation.hasUntranslatedText;
Core.frameCompressionPrompt=PromptAdapters.frameCompressionPrompt;
Core.inspectStoryGrounding=inspectStoryGrounding;
Core.stripDirectorComments=stripDirectorComments;
Core.applyFrameCompression=applyFrameCompression;
Core.frameSelectionInstruction=frameSelectionInstruction;
Core.Wardrobe=Wardrobe;
Core.PhysicalState=PhysicalState;
Core.Height=Height;
Core.DNA=DNA;
Core.sourceScene=(image,styleCatalog=[])=>Projection.cleanSceneStyles(BodyRelations.withoutGeneratedScene(Projection.sourceScene(image),image.scaleAudit),styleCatalog);
Core.cleanSceneStyles=Projection.cleanSceneStyles;
Core.neutralBuiltinStyle=neutralBuiltinStyle;
Core.VisualProtocol=VisualProtocol;
Core.Status=Status;
Core.RuleCompiler=RuleCompiler;
Core.renderVisual=renderVisual;
Core.hideBrokenVisual=hideBrokenVisual;
Core.readDirectorOutput=readDirectorOutput;
Core.validateDirectorPlan=validateDirectorPlan;
Core.readFailure=text=>{const source=ProtocolBoundary.ownedComments(String(text),'ad-director').filter(m=>m.text.startsWith('<!--ad-director-error:')).map(m=>m.text).join('\n'),matches=[...source.matchAll(/<!--ad-director-error:([^]*?)-->/g)],m=matches.at(-1);if(!m)return null;try{const data=JSON.parse(decodeURIComponent(m[1]));if(!/^[a-zA-Z0-9_-]+$/.test(data.requestId))return null;return {...data,error:true};}catch{return /^[a-zA-Z0-9_-]+$/.test(m[1])?{requestId:m[1],error:true}:null;}};
Core.readInputMarker=readInputMarker;
Core.thumbnailName=pointer=>{const name=String(pointer||'').match(/^files\/(?:chat|global)\/([A-Za-z0-9_.-]+)$/)?.[1];if(!name)throw Error('缩略图来源路径无效');return 'ad_thumb192_v1_'+name+'.webp';};
if(typeof module!=='undefined')module.exports=Core;

