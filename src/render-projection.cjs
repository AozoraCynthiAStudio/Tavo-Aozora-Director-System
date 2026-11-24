'use strict';
// The text director owns the frame. This module reads its selected English frame
// and projects stored facts; it never interprets raw player requests or UI preferences.
const Height=typeof require==='function'?require('./height-anchor.cjs'):DirectorHeight;
const clean=x=>String(x??'').trim();
const boundary='(?=\\s*(?:[,;.!?\\n]|$)|\\s+(?:of|in|with|from)\\b)';
const handArea='(?:(?:the|her|his|their|a|both|two|bare|gloved|interlocked)\\s+)*(?:hands?|fingers?|thumbs?|palms?|knuckles?|wrists?)';
const handCloseup=new RegExp('^(?:(?:extreme |tight )?(?:close[- ]up|detail shot) (?:of|on) '+handArea+'|'+handArea+'[- ]only|only '+handArea+')\\b','i');
const handAndOtherArea=/^\s*(?:,\s*)?(?:and|with|alongside|together with)\s+(?:(?:the|her|his|their|a|both)\s+)*(?:faces?|heads?|eyes?|torsos?|upper[- ]bod(?:y|ies)|shoulders?|chests?|full[- ]bod(?:y|ies))\b/i;
const faceInFrame=/\b(?:faces?|heads?)\s+(?:(?:is|are|also|still|clearly|partly|both)\s+)*(?:visible|in (?:the )?(?:frame|shot|background|foreground))\b|(?<!\bwithout )(?<!\bnot )\b(?:showing|including)\s+(?:(?:the|her|his|their|both)\s+)*(?:faces?|heads?)\b/i;
 const bodyOnlyCrops=new Set(['feet','hands','lower','torso']);
const frames=[
 ['feet',/^(?:(?:close[- ]up|detail shot) (?:of|on) (?:the )?(?:feet|foot|shoes?|boots?|ankles?)|(?:feet|foot|shoes?|boots?|ankles?)[- ]only)\b/i],
 ['hands',handCloseup],
 ['lower',/^(?:(?:lower[- ]body|waist[- ]down)(?: shot| framing)?|(?:legs?|thighs?|knees?|hips|waist)[- ]only|(?:close[- ]up|detail shot) (?:of|on) (?:the )?(?:legs?|thighs?|knees?|hips|waist|calves?))\b/i],
 ['torso',/^(?:(?:torso|chest|back|shoulders?|arms?)[- ]only|(?:close[- ]up|detail shot) (?:of|on) (?:the )?(?:torso|chest|back|abdomen|stomach|shoulders?|arms?))\b/i],
 ['portrait',new RegExp('^(?:portrait|headshot|head shot|face close[- ]up)'+boundary,'i')],
 ['upper',new RegExp('^(?:upper[-_ ]body(?: shot| view| framing)?|waist[- ]up(?: framing| shot)?|medium close[- ]up(?: shot)?|bust shot)'+boundary,'i')],
 ['cowboy',new RegExp('^(?:medium shot|mid shot|cowboy shot|thigh up|knee up|three[- ]quarter shot)'+boundary,'i')],
 ['full',new RegExp('^(?:full[-_ ]body(?: shot| view| framing| composition| portrait)?|full figure|head to toe)'+boundary,'i')],
 ['wide',/^(?:wide shot|long shot|establishing shot|panoramic view)\b/i]
];
const Adapters=typeof require==='function'?require('./prompt-adapters.cjs'):DirectorAdapters;
const handOrWrist=/\b(?:hands?|fingers?|fingernails?|nails?|knuckles?|palms?|wrists?|forearms?|thumbs?)\b/i;
const nonHandAnatomy=/\b(?:face|head|eyes?|irises?|pupils?|eyelashes|eyelids|eyebrows?|brows?|nose|lips?|mouth|teeth|fangs?|jaw|chin|cheeks?|hair|bangs|ponytail|neck|legs?|feet|torso|shoulders?)\b/i;
function handIdentity(part){
 const value=part.replace(/[{}\[\]]/g,'').replace(/^\d+(?:\.\d+)?::|::$/g,'').trim();
 if(nonHandAnatomy.test(value))return false;
 return handOrWrist.test(value)||/\b(?:skin|complexion)\b/i.test(value)||/^(?:(?:adult|young|older|elderly) )?(?:woman|man|girl|boy|female|male|person|other)$/i.test(value);
}
function readFrame(scene){
 const value=clean(scene),explicitFaceOffFrame=/\b(?:face|head)\s+(?:(?:is|are)\s+)?out of frame\b|\b(?:no face|face not visible|without (?:a )?face)\b|\b(?:cropped|crop)\s+(?:below the neck|from the neck down)\b|不露脸|不显示脸|脸部?画外|头部?画外|脖子以下裁切/i.test(value);
 const bodyOnlyCue=/\b(?:only|just)\s+(?:(?:the|her|his)\s+)?(?:hands?|feet?|lower body|legs?|thighs?|knees?|hips|waist|torso|chest|back|arms?|shoulders?|body parts?)\b|\b(?:hands?|feet?|lower body|legs?|thighs?|knees?|hips|waist|torso|chest|back|arms?|shoulders?)[- ]only\b|只拍(?:手|脚|腿|腰|胸|肩|背|躯干|身体部位)|仅(?:手部|脚部|腿部|腰部|胸部|肩部|背部|躯干)入镜/i.test(value);
 const selected=[];
 let mixedHandFrame=false;
 for(const clause of value.split(/[,;\n]/)){
  const text=clause.trim(),match=frames.find(([,pattern])=>pattern.test(text));
  if(match)selected.push(match[0]);
  if(match?.[0]==='hands'&&handAndOtherArea.test(text.replace(handCloseup,'')))mixedHandFrame=true;
 }
 const crops=[...new Set(selected)];
 if(crops.includes('hands')&&(mixedHandFrame||faceInFrame.test(value))){
  return {crop:'unknown',owner:'director-mixed-detail',faceOffFrame:false};
 }
 if(crops.length>1){
  // Camera vocabulary can occur in a prop description (e.g. a portrait
  // on a wall). An ambiguous crop is a non-fatal quality warning, not a veto.
  const selfCorrection=/\b(?:actually|correction|i mean|instead|wait|no)\b|不对|改为|改成/i.test(scene);
   return {crop:'unknown',owner:selfCorrection?'editorial-camera-uncertain':'director-camera-ambiguous',faceOffFrame:explicitFaceOffFrame||bodyOnlyCue,warning:selfCorrection?'场景含多种景别及自我修订，已保留原提示词继续生成。':'场景可能包含多个景别词，已保留玩家场景继续生图。'};
 }

 const crop=crops[0]||'unknown';
 return {crop,owner:crops.length?'director-plan':'unclassified-plan',faceOffFrame:explicitFaceOffFrame||bodyOnlyCue||bodyOnlyCrops.has(crop)};
}
// Render-time projection only. The stored identity and outfit remain available for other shots.
function project(plan){
 const frame=readFrame(plan.scene),removed=[];
 const narrow=['feet','hands','lower','torso','portrait','upper'].includes(frame.crop);
 const feetVisible=/\b(?:barefoot|bare feet|feet|foot|toes?|ankles?|shoes?|boots?|socks?|sandals?|heels?)\b/i.test(plan.scene);
 if(!narrow&&!frame.faceOffFrame)return {plan,audit:{...frame,removed,adjusted:[],factsUnchanged:true}};
 const characters=plan.characters.map(character=>{
  const {name}=character;
  const parts=Adapters.splitTags(character.identity).map(clean);
  const hasStatureCue=/\b(?:taller|shorter|tall|short) (?:woman|man|girl|boy|person|stature)|\b(?:taller|shorter)\b|\b(?:height|size) difference\b/i.test(plan.scene+' '+character.identity);
  const omitHeight=frame.crop!=='upper'||hasStatureCue;
  const identity=parts.map(part=>{
    if(frame.crop==='hands'){
     if(handIdentity(part))return part;
     removed.push({name,field:'identity',text:part,reason:'outside-hand-closeup'});
     return '';
    }
    const normalized=part.replace(/[{}\[\]]/g,'').replace(/^\d+(?:\.\d+)?::|::$/g,'').trim();
    if(frame.faceOffFrame&&/\b(?:face|head|eyes?|irises?|pupils?|eyelashes|eyelids|eyebrows?|brows?|nose|lips?|mouth|teeth|fangs?|jaw|chin|cheeks?)\b/i.test(normalized)){
     removed.push({name,field:'identity',text:part,reason:'off-frame-face'});
     return '';
    }
   if(/[{}\[\]]|::/.test(part))return part;
   const height=Height.extract(part);
   const visible=part.replace(/\(([^()]*)\)/g,(whole,value)=>/\b(?:tall|short|height|stature)\b/i.test(part)&&Height.extract(value)?'':whole);
   const value=!omitHeight?part:height
    ? [...height.spans].reverse().reduce((text,span)=>text.slice(0,span.start)+text.slice(span.start+span.raw.length),part).replace(/\(\s*\)/g,'').trim()
    : visible.trim();
   if(value!==part)removed.push({name,field:'identity',text:part,reason:'off-frame-exact-height'});
   if(!feetVisible&&/^(?:barefoot|bare feet|bare toes)$/i.test(value)){
    removed.push({name,field:'identity',text:value,reason:'off-frame-feet'});
    return '';
   }
   return value;
  }).filter(Boolean).join(', ');
  const footwear=character.equipment.FOOTWEAR;
  const equipment=feetVisible||footwear===null?character.equipment:{...character.equipment,FOOTWEAR:null};
  if(equipment!==character.equipment){
   const text=footwear.length?footwear.map(garment=>garment.visible?garment.name:'').filter(Boolean).join(', '):'barefoot';
   if(text)removed.push({name,field:'outfit',slot:'FOOTWEAR',text,reason:'off-frame-feet'});
  }
  return {...character,identity,equipment};
 });
 return {plan:{...plan,characters},audit:{...frame,removed,adjusted:[],factsUnchanged:true}};
}
// The Scene is narrative content, never a permanently concatenated style.
// Historical candidates can contain an exact, trailing preset that the text
// model echoed into a Scene (the 33.zip production record demonstrates this).
// Strip only COMPLETE known style clauses at the tail, never keyword fragments:
// arbitrary words such as "soft lighting", "portrait" or "game" may be facts.
function cleanSceneStyles(scene, styleCandidates=[]){
 let value=clean(scene);
 const positives=[...new Set(styleCandidates.map(style=>clean(typeof style==='string'?style:style?.positive)).filter(Boolean))]
  .sort((a,b)=>b.length-a.length);
 for(let count=0;count<positives.length+1;count++){
  const prior=value;
  for(const positive of positives){
   const suffix=', '+positive;
   if(value.length>suffix.length&&value.endsWith(suffix)){
    value=value.slice(0,-suffix.length).trim();break;
   }
  }
  if(prior===value)break;
 }
 return value;
}
function sourceScene(image){
 if(clean(image.renderedScene))return image.renderedScene;
 let base=clean(image.sections?.base);
 if(!base&&/nai45/.test(image.syntax||''))base=clean(image.prompt?.split(' | ')[0]);
 if(base&&image.config?.format!=='generic'){
  const positive=clean(image.style?.positive),tail=', '+positive;
  if(positive&&base.endsWith(tail))base=base.slice(0,-tail.length);else if(positive&&base===positive)base='';
 }
 return base||image.plan?.scene||'';
}
module.exports={readFrame,sceneCrop:scene=>readFrame(scene).crop,project,sourceScene,cleanSceneStyles};
