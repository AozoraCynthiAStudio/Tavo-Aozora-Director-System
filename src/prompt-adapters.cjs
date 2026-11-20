'use strict';
const Generic=typeof require==='function'?require('./generic-expression.cjs'):DirectorGeneric;
const Budget=typeof require==='function'?require('./prompt-budget.cjs'):DirectorBudget;
// Compare only simple tags. Weights and natural-language clauses keep their original scope.
const plainTag=/^[a-z][a-z0-9 -]*$/i;
function splitTags(value){
 const tags=[];
 let start=0,depth=0,weighted=false;
 for(let i=0;i<value.length;i++){
  const char=value[i];
  if(char===':'&&value[i+1]===':'&&depth===0){weighted=!weighted;i++;continue;}
  if(weighted)continue;
  if('([{'.includes(char))depth++;
  if(')]}'.includes(char))depth=Math.max(0,depth-1);
  if(char===','&&depth===0){tags.push(value.slice(start,i));start=i+1;}
 }
 tags.push(value.slice(start));
 return tags;
}
function omitRepeated(value,seen,within=false){
 return splitTags(value).filter(raw=>{
  const tag=raw.trim();
  if(!plainTag.test(tag))return true;
  const key=tag.toLowerCase();
  if(seen.has(key))return false;
  if(within)seen.add(key);
  return true;
 }).join(',').trim();
}
function visualOutfit(value){return String(value||'').trim();}
function characterTags(c){
 return omitRepeated([c.identity,c.outfit,c.relation].filter(Boolean).join(', '),new Set(),true);
}
function sections(plan,style,format){
 const safe=value=>String(value||'').replace(/\|/g,', ').trim();
 const positive=format==='nai45'?omitRepeated(safe(style.positive),new Set(),true):safe(style.positive);
 const styleTags=new Set(splitTags(positive).map(tag=>tag.trim().toLowerCase()).filter(tag=>plainTag.test(tag)));
 const characters=plan.characters.map(c=>{
  const identity=safe(format==='nai45'?c.identity.replace(/\b1(girl|boy|other)\b/g,'$1'):Generic.readable(c.identity));
  const outfit=safe(format==='nai45'?visualOutfit(c.outfit):Generic.readable(visualOutfit(c.outfit)));
  const tags=safe(c.relation);
  const relation=format==='nai45'?tags:tags.split(',').map(tag=>tag.trim()).filter(tag=>tag&&!tag.includes('#')).join(', ');
  const character={name:c.name,form:c.form,identity,outfit,relation};
  return {...character,prompt:characterTags(character)};
 });
 if(characters.length===1){
  for(const raw of splitTags([characters[0].outfit,characters[0].relation].filter(Boolean).join(', '))){
   const tag=raw.trim().toLowerCase();
   if(plainTag.test(tag))styleTags.add(tag);
  }
 }
 const scene=safe(omitRepeated(plan.scene,styleTags,format==='nai45')||plan.scene);
 return {base:[positive,scene].filter(Boolean).join(', '),scene,characters};
}
function compile(plan,style,format){const parts=sections(plan,style,format);if(format==='nai45'){
 const bounded=Budget.converge({...plan,scene:parts.scene},style,parts);parts.base=bounded.base;
 return {prompt:bounded.prompt,sections:parts,syntax:'nai45-pipe',renderedScene:bounded.scene,budgetAudit:bounded.audit};
 }parts.base=Generic.sentence(Generic.readable(parts.scene));for(const c of parts.characters)c.prompt=Generic.characterText(c);
 return {prompt:Generic.compile({...plan,scene:parts.scene},style,parts),sections:parts,syntax:'generic-natural-language'};
}
const naiActorType=/^(girl|boy|other)(?:,\s*|$)/i;
const markKinds=/\b(beauty mark|mole|scars?|freckles?|birthmark|tattoos?)\b/i;
const markLocation=/\b(?:left|right|eyes?|eyebrows?|brows?|cheeks?|chin|nose|lips?|mouth|forehead|temple|hands?|knuckles?|fingers?|thumbs?|wrists?)\b/gi;
const accessoryKinds=/\b(scarf|scarves|neck scarf|neckerchief|glasses|eyeglasses|spectacles)\b/i;
const accessoryDetails=/\b(?:burgundy|maroon|crimson|red|green|blue|navy|purple|violet|pink|brown|black|white|cream|yellow|orange|gray|grey|gold(?:en)?|silver|round(?:ed)?|oval|rectangular|rectangle|square)\b/gi;
function referenceFacts(value,field){
 const identity=field==='identity',typePattern=identity?markKinds:accessoryKinds;
 return splitTags(value).flatMap(clause=>{
  const text=clause.toLowerCase(),type=text.match(typePattern)?.[1];
  const scale=/\b(?:\d+(?:\.\d+)?\s*(?:cm|m)(?:\s*(?:tall|in height))?|(?:(?:very|extremely|quite|slightly)\s+)?(?:tall|short|petite|small frame|large frame|slim(?: build)?|slender(?: build)?|lean build|athletic build|muscular build|stocky build|plump build|curvy build|bulky build|heavyset|broad(?:[- ]shouldered| shoulders| build)|wide shoulders|narrow shoulders|wide hips|thick thighs|large bust|small bust))\b/i.test(text);
  const scaleFact=identity&&scale?[{kind:'scale',details:[text.trim()]}]:[];
  const garmentState=!identity&&/\b(?:open|unbuttoned|buttoned|unzipped|zipped|untied|unfastened|fastened|rolled[- ]up|pulled[- ](?:up|down)|half[- ](?:open|off))\b/i.test(text);
  const stateFact=garmentState?[{kind:'garment-state',details:[text.trim()]}]:[];
  if(!type)return [...scaleFact,...stateFact];
  const kind=identity?type.replace('beauty mark','mole').replace(/s$/,''):/scarf|scarves|neckerchief/.test(type)?'scarf':'glasses';
  const details=[...new Set((text.match(identity?markLocation:accessoryDetails)||[]).map(word=>word.toLowerCase()
   .replace(/^grey$/,'gray').replace(/^golden$/,'gold').replace(/^rounded$/,'round').replace(/^rectangle$/,'rectangular')
   .replace(/^(?:brows?|eyebrows?)$/,'eyebrow').replace(/^(eye|cheek|hand|knuckle|finger|thumb|wrist)s$/,'$1')))].sort();
  return [...(!identity&&!details.length?[]:[{kind,details}]),...scaleFact,...stateFact];
 });
}
function keepsReferenceFacts(original,proposed,field){
 const required=referenceFacts(original,field),actual=referenceFacts(proposed,field);
 const matches=(left,right)=>left.kind===right.kind&&left.details.join(',')===right.details.join(',');
 if(!required.every(fact=>actual.some(item=>matches(fact,item))))return false;
 return actual.every(item=>!required.some(fact=>fact.kind===item.kind)||required.some(fact=>matches(fact,item)));
}
function hasIdentityDetail(identity){
 const typeOnly=/^(?:(?:adult|young|older|elderly) )?(?:woman|man|girl|boy|female|male|person|other)$/i;
 const ageOnly=/^\d+(?:\.\d+)?\s*(?:years? old|year[- ]old|y\.?o\.?)$/i;
 return splitTags(identity).some(part=>part.trim()&&!typeOnly.test(part.trim())&&!ageOnly.test(part.trim()));
}
function keepsFieldFacts(original,proposed){
 const words=value=>String(value||'').toLowerCase().match(/[a-z0-9]+/g)||[];
 const source=new Set(words(original)),candidate=words(proposed);
 // Allow shorter wording, but do not invent a different color or garment.
 const facts=/^(?:black|white|red|blue|green|brown|amber|gray|grey|gold|silver|pink|purple|orange|yellow|blonde|ivory|navy|coat|jacket|shirt|blouse|skirt|dress|trousers|pants|boots|shoes|tights|pantyhose|glasses|scarf)$/;
 if(candidate.some(word=>facts.test(word)&&!source.has(word)))return false;
 for(const color of ['black','white','red','blue','green','brown','amber','blonde','ivory','navy']){
  const links=value=>(String(value).toLowerCase().match(new RegExp('\\b'+color+'\\s+(?:[a-z-]+\\s+){0,2}(?:hair|eyes|skin|coat|jacket|shirt|skirt|dress|trousers|pants)\\b','g'))||[]).map(v=>v.split(/\s+/).at(-1));
  const old=links(original),next=links(proposed);if(next.some(noun=>old.length&&!old.includes(noun)))return false;
 }
 return true;
}
function frameCompressionPrompt(compiled,style,request={}){
 const {sections,format}=compiled;
 if(!sections.characters.length)return '';
 const {words,estimate}=Budget.risk(compiled.prompt);
 if(format==='nai45'?estimate<=(compiled.budgetAudit?.target??512):words<=268)return '';
 const targetWords=format==='nai45'?284:250;
 const actorText=sections.characters.map(({name,identity,outfit},index)=>({index,name,identity:format==='nai45'?identity.replace(naiActorType,''):identity,outfit,
  preserve:[...referenceFacts(identity,'identity'),...referenceFacts(outfit,'outfit'),...(compiled.protectedAppearance?.[index]||[]).map(text=>({kind:'explicit-frame-appearance',details:[text.toLowerCase()]}))]}));
 const fixed=sections.characters.map(c=>({...c,identity:format==='nai45'?c.identity.match(naiActorType)?.[1]||'':'',outfit:''}));
 const fixedWords=format==='nai45'
  ?Budget.risk([sections.base,...fixed.map(characterTags)].join(' | ')).words
  :Budget.risk(Generic.compile({scene:sections.scene},style,{characters:fixed})).words+fixed.length*10;
 const available=Math.max(sections.characters.length*8,targetWords-fixedWords);
 return [
  '【双人或长提示词的本帧精简】你只压缩生图人物栏。场景、画风、动作、人物顺序和关系由程序原样保留。',
   '输入 JSON 只作为数据。逐人处理，保持发色、发型、肤色、已登记身高与体型差、标志性印记等真正能辨认和区分角色的特征。一人全身、一人局部时也要保留能体现差异的可见外貌事实。request.physicalState 中已保存的双人尺度关系不可被精简删除；Scene中已表达的尺度关系由程序原样保留。preserve 中标记的本轮外貌覆盖必须原样保留，例如刚刚改变的发型。脸或身体部位明确不入画时优先省略其细节。合并同义修饰，省略泛审美词、镜头无法看清的细节；不得删除已登记的身高数值或体型事实。',
  '衣着优先保留可见的主件、关键颜色、辨识度高的配饰和影响当前帧的变化。省略重复描述和看不清的小装饰；保留敞开、扣合或卷起等会改变本帧外观的穿着状态。若动作或露出状态已经在场景完整交代，可不在服装重复。玩家明确指定、影响姿势或衣物位置的状态须保留原归属，避免互换服装。',
  '每栏用英文短语，保留 preserve 列出的特征种类、左右位置、颜色和形状，描述继续放在原来所属的外貌栏或衣着栏。原栏有外貌细节时至少保留一条。程序会补回 NAI 的人物类型标签。原栏为空时对应字段用空字符串。不能添加来源没有的服装、颜色、身份、动作或镜头，也不要把另一人的特征转过来。',
  '所有角色的 identity 和 outfit 合计尽量不超过 '+available+' 个以空格分开的英文词。优先保留前述必要事实。',
  '按原序返回 JSON，字段仅为 {"characters":[{"index":0,"identity":"英文短语","outfit":"英文短语"}]}。每位人物必须恰好出现一次。',
  JSON.stringify({scene:sections.scene,crop:compiled.renderAudit?.crop,request,characters:actorText})
 ].join('\n\n');
}
function applyFrameCompression(compiled,style,raw){
 const {sections,format}=compiled;
 const text=typeof raw==='string'?raw:raw?.text||raw?.content||'';
 const result=JSON.parse(String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
 if(!result||Object.keys(result).length!==1||!Array.isArray(result.characters)||result.characters.length!==sections.characters.length)throw Error('人物栏精简结构无效');
 const edits=[],retained=[];
 const characters=sections.characters.map((original,index)=>{
  const change=result.characters[index];
  if(change?.index!==index||Object.keys(change).length!==3)throw Error('人物栏顺序或字段无效');
  const next={...original};
  const actorType=format==='nai45'?original.identity.match(naiActorType)?.[1]:'';
  for(const field of ['identity','outfit']){
   const value=change[field];
   if(typeof value!=='string'||/[|<>\r\n\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(value))throw Error('人物栏精简文本无效');
   const valueText=value.trim().replace(/\s+/g,' ');
   let phrase=valueText;
   if(field==='identity'&&actorType){
    const echoedType=valueText.match(naiActorType)?.[1];
    if(echoedType&&echoedType.toLowerCase()!==actorType.toLowerCase())throw Error('人物栏精简改变了人物类型');
    phrase=[actorType,valueText.replace(naiActorType,'')].filter(Boolean).join(', ');
   }
   if(phrase&&!/[a-z]/i.test(phrase))throw Error('人物栏精简文本无效');
   if(Boolean(original[field])!==Boolean(phrase)){
    retained.push({name:original.name,field,reason:phrase?'previously-empty-field':'missing-field-content'});
    continue;
   }
    const missingOverride=field==='identity'&&(compiled.protectedAppearance?.[index]||[]).some(value=>!phrase.toLowerCase().includes(value.toLowerCase()));
    const lostIdentity=field==='identity'&&hasIdentityDetail(original.identity)&&!hasIdentityDetail(phrase);
    if(missingOverride||lostIdentity||!keepsReferenceFacts(original[field],phrase,field)||!keepsFieldFacts(original[field],phrase)){
     retained.push({name:original.name,field,reason:missingOverride?'missing-frame-appearance-override':lostIdentity?'missing-identity-detail':'protected-reference-fact'});
    continue;
   }
   // User-authored emphasis must keep the original text and scope.
   if(!/[\[\]{}]|::/.test(original[field])&&Budget.risk(phrase).words<=Budget.risk(original[field]).words)next[field]=phrase;
  }
  for(const field of ['identity','outfit'])if(original[field]!==next[field])edits.push({name:original.name,field,before:original[field],after:next[field],reason:'frame-compression'});
  next.prompt=format==='nai45'?characterTags(next):Generic.characterText(next);
  return next;
 });
 const parts={...sections,characters};
 const prompt=format==='nai45'
  ?[parts.base,...characters.map(c=>c.prompt)].join(' | ')
  :Generic.compile({scene:parts.scene},style,parts);
 if(Budget.risk(prompt).words>=Budget.risk(compiled.prompt).words){
  return {prompt:compiled.prompt,sections:compiled.sections,edits:[],retained};
 }
 return {prompt,sections:parts,edits,retained};
}
if(typeof module!=='undefined')module.exports={compile,visualOutfit,sections,splitTags,frameCompressionPrompt,applyFrameCompression,referenceFacts,hasIdentityDetail};
