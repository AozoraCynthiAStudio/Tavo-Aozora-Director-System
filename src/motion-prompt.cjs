'use strict';
const VisualProtocol=typeof require==='function'?require('./visual-protocol.cjs'):DirectorVisualProtocol;
const qualityPattern=/lowres|low resolution|blurr|jpeg|artifact|watermark|signature|logo|\btext\b|bad anatomy|bad proportions|deformed|bad hands|extra fingers|missing fingers|extra limbs|distorted face|asymmetrical eyes|cross-eyed|messy lineart|thick lineart|oversaturated|worst quality|low quality|disfigured|malformed/i;
function qualityNegative(style={}){return style.useNegative?String(style.negative||'').split(',').map(x=>x.trim()).filter(x=>qualityPattern.test(x)).join(', '):'';}
function parse(raw){let data;try{data=JSON.parse(String(raw).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{throw Error('动态修改方案不是有效 JSON，未提交生图');}
 const result={};for(const [key,max]of [['primary',6],['secondary',4],['anchors',0],['opposite',8]]){const values=key==='anchors'?(data?.anchors||[]):data?.[key];if(!Array.isArray(values)||values.length>max||values.some(x=>typeof x!=='string'||!x.trim()||x.length>200||/::|[|{}<>]/.test(x)))throw Error('动态修改方案字段无效：'+key);result[key]=[...new Set(values.map(x=>x.trim()))];}
 if(!result.primary.length)throw Error('动态方案缺少主要修改点，未提交生图');
 const positive=new Set([...result.primary,...result.secondary,...result.anchors].map(x=>x.toLowerCase()));if(result.opposite.some(x=>positive.has(x.toLowerCase())))throw Error('动态正负状态重复，未提交生图');return result;
}
function compile(spec,style,format){const parts=[...spec.primary.map(x=>format==='nai45'?'5::'+x+'::':x),...spec.secondary.map(x=>format==='nai45'?'4::'+x+'::':x)];return {prompt:parts.join(', '),negativePrompt:[qualityNegative(style),...spec.opposite].filter(Boolean).join(', ')};}
module.exports={parse,compile,qualityNegative};

function responseText(raw,depth=0){
 if(depth>8||raw==null)return '';
 if(typeof raw==='string')return raw;
 if(Array.isArray(raw))return raw.map(value=>responseText(value,depth+1)).filter(Boolean).join('\n');
 if(typeof raw!=='object')return '';
 if(typeof raw.scene==='string'||Array.isArray(raw.edits))return JSON.stringify(raw);
 if(raw.type==='thinking'||raw.type==='reasoning')return '';
 for(const key of ['text','content','output_text','message','result','data','output']){
  if(raw[key]!==undefined){const text=responseText(raw[key],depth+1);if(text.trim())return text;}
 }
 if(Array.isArray(raw.choices))return raw.choices.map(value=>responseText(value.message||value.text,depth+1)).filter(Boolean).join('\n');
 return '';
}
function readEditResponse(raw){
 const text=responseText(raw).replace(/^\uFEFF/,'').trim().replace(/<(think|analysis)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
 const candidates=[],seen=new Set();
 function collect(value,depth=0){
  if(depth>8||value==null)return;
  if(typeof value==='string'){try{collect(JSON.parse(value),depth+1);}catch{}return;}
  if(Array.isArray(value)){for(const entry of value)collect(entry,depth+1);return;}
  if(typeof value!=='object')return;
  if(typeof value.scene==='string'||Array.isArray(value.edits)){
   const key=JSON.stringify({scene:value.scene,focuses:value.focuses,poseEdits:value.poseEdits||[],edits:value.edits});
   if(typeof value.scene!=='string'||!seen.has(key)){seen.add(key);candidates.push(value);}return;
  }
  for(const key of ['text','content','output_text','message','result','data','output','choices'])if(value[key]!==undefined)collect(value[key],depth+1);
 }
 try{collect(JSON.parse(text));}catch{
  let start=-1,depth=0,quoted=false,escaped=false;
  for(let i=0;i<text.length;i++){
   const char=text[i];
   if(start<0){if(char==='{'){start=i;depth=1;}continue;}
   if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
   if(char==='"')quoted=true;
   else if(char==='{')depth++;
   else if(char==='}'&&--depth===0){try{collect(JSON.parse(text.slice(start,i+1)));}catch{}start=-1;}
  }
 }
 if(candidates.length)return candidates.find(value=>typeof value.scene==='string'&&value.scene.trim())||candidates[0];
 const refusalText=text.replace(/^(?:i['’]m sorry|sorry|抱歉)[,.!，。]?\s*/i,'');
 const refusal=/^i (?:cannot|can['’]t|am unable to|won['’]t|will not)\s+(?:help|assist|comply|generate|provide|create|fulfill|process)\b/i.test(refusalText)||/^(?:我(?:无法|不能|不会)|无法|不能)\s*(?:帮助|协助|满足|提供|生成|创建|处理|完成)/.test(refusalText);
 if(!candidates.length&&refusal){
  throw Object.assign(Error('文本模型拒绝了本次请求，未返回画面方案；原图已保留，未提交图片生成。'),{code:'TEXT_MODEL_REFUSED'});
 }
 const visual=VisualProtocol.readDraft(text);
 if(visual.scene)return {scene:visual.scene,focuses:[],poseEdits:[]};
 if(text&&!/[{}]/.test(text)&&/\b(?:shot|view|woman|man|standing|sitting|holding|walking|turning)\b/i.test(text)&&!/[\u3400-\u9fff]/.test(text))return {scene:text.replace(/^```[^\n]*\n|\n```$/g,'').trim(),focuses:[],poseEdits:[]};
 const code=!text?'MOTION_RESPONSE_EMPTY':candidates.length>1?'MOTION_RESPONSE_AMBIGUOUS':'MOTION_RESPONSE_INVALID';
 throw Object.assign(Error(!text?'动态导演没有返回可读取的内容':candidates.length>1?'动态导演返回了不同的目标方案':'动态导演返回内容中没有可解析的目标方案'),{code});
}
function isRefusal(raw){
 const text=responseText(raw).trim().replace(/^(?:i['’]m sorry|sorry|抱歉)[,.!，。]?\s*/i,'');
 return /^i (?:cannot|can['’]t|am unable to|won['’]t|will not)\s+(?:help|assist|comply|generate|provide|create|fulfill|process)\b/i.test(text)||/^(?:我(?:无法|不能|不会)|无法|不能)\s*(?:帮助|协助|满足|提供|生成|创建|处理|完成)/.test(text);
}

function promptTextMap(value){
 const source=String(value??''),text=[],offsets=[];
 for(let i=0;i<source.length;){
  const opener=/^[+-]?\d+(?:\.\d+)?::/.exec(source.slice(i));
  if(opener){i+=opener[0].length;continue;}
  if(source.startsWith('::',i)){i+=2;continue;}
  text.push(source[i]);offsets.push(i++);
 }
 return {text:text.join(''),offsets};
}
function scenePromptRange(promptBase,scene){
 const plainScene=promptTextMap(scene).text,promptMap=promptTextMap(promptBase),at=promptMap.text.indexOf(plainScene);
 if(!plainScene||at<0||promptMap.text.indexOf(plainScene,at+plainScene.length)>=0)throw Error('原Scene与来源提示词无法唯一对齐');
 let start=promptMap.offsets[at],end=promptMap.offsets[at+plainScene.length-1]+1;
 while(start>0){const prefix=/[+-]?\d+(?:\.\d+)?::$/.exec(promptBase.slice(0,start));if(!prefix)break;start-=prefix[0].length;}
 while(promptBase.startsWith('::',end))end+=2;
 return {plainScene,start,end};
}
function sourceForEdit(source){
 const original=String(source?.prompt||''),characters=source?.plan?.characters||source?.sections?.characters||[];
 if(!original.trim())throw Error('来源图缺少实际提示词，未重写或提交');
 const actualParts=original.split('|'),aligned=actualParts.length-1;
 const known=Array.isArray(characters)?characters:[];
 const actors=Array.from({length:aligned},(_,index)=>known[index]||{name:'人物'+(index+1),identity:actualParts[index+1].trim(),equipment:{}});
 source={...source,plan:{...source.plan,characters:actors}};
 const candidates=[...new Set([source.renderedScene,source.sections?.scene,source.plan?.scene].filter(value=>typeof value==='string'&&value.trim()))];
 for(const scene of candidates){
  try{scenePromptRange(original.split('|')[0],scene);return {...source,renderedScene:scene,plan:{...source.plan,scene}};}catch{/* Try another saved representation of the same submitted frame. */}
 }
 const base=actualParts[0],style=String(source.style?.positive||'').trim();
 const scene=style&&base.trimStart().startsWith(style)?base.trimStart().slice(style.length).replace(/^\s*,\s*/,''):base.trim();
 return {...source,renderedScene:scene,plan:{...source.plan,scene}};
}
function editOriginal(raw,source){
 source=sourceForEdit(source);
 let data=readEditResponse(raw);const original=String(source.prompt||'');
 if(typeof data.scene==='string'){
  const targetScene=data.scene.replace(/<[^>]*>/g,' ').replace(/\|/g,', ').trim();
  if(!targetScene)throw Error('文本服务没有返回目标画面');
  const focuses=normalizeFocuses({focuses:data.focuses},targetScene),poseEdits=readPoseEdits(data.poseEdits,source);
  const parts=original.split('|'),range=scenePromptRange(parts[0],source.renderedScene);
  parts[0]=parts[0].slice(0,range.start)+emphasizeEdit(targetScene,focuses)+parts[0].slice(range.end);
  for(const pose of poseEdits){
   const index=pose.character+1,part=parts[index],trimmed=part.trimEnd(),tail=part.slice(trimmed.length),suffix=pose.previous?', '+pose.previous:'';
   if(suffix&&!trimmed.endsWith(suffix))continue;
   parts[index]=(suffix?trimmed.slice(0,-suffix.length):trimmed)+(pose.relation?', '+pose.relation:'')+tail;
  }
  return {prompt:parts.join('|'),poseEdits,edits:[],scene:targetScene,focuses,targetScene,sourcePrompt:original};
 }
 if(!original.trim())throw Error('来源图缺少实际提示词，未重写或提交');
 const parts=original.split('|');
 if(parts.length!==source.plan.characters.length+1)throw Error('来源图不是可确认的NAI分栏提示词，未重写或提交');
 if(!Array.isArray(data.edits)||!data.edits.length)throw Error('文本服务没有返回目标画面');
 const allowed=promptTextMap(source.renderedScene||source.plan.scene).text,edits=[];
 for(const edit of data.edits){
  if(edit.character!==-1||typeof edit.from!=='string'||typeof edit.to!=='string'||/::|[|{}<>]/.test(edit.to))throw Error('原提示词修改字段无效');
  const from=promptTextMap(edit.from).text,to=edit.to.trim(),focuses=normalizeFocuses(edit,to);
  if(!edit.from&&!to)throw Error('空修改无效');
  if(!to&&edit.weight!==0)throw Error('删除旧状态时weight必须为0');
  let at=allowed.length,end=at;
  if(from){
   at=allowed.indexOf(from);
   if(at<0){at=allowed.length;end=at;edits.push({at,end,from:'',to,focuses});continue;}
   end=at+from.length;
  }
  if(edits.some(row=>at<row.end&&end>row.at))continue;
  edits.push({at,end,from,to,focuses});
 }
 if(!edits.some(edit=>edit.to))throw Error('缺少本轮目标状态');
 const sourceScene=allowed,ordered=[...edits].sort((a,b)=>a.at-b.at),focusRanges=[];
 let targetScene='',cursor=0;
 for(const edit of ordered){
  targetScene+=sourceScene.slice(cursor,edit.at);
  if(!edit.from)targetScene+=targetScene.trimEnd().endsWith(',')?' ':', ';
  const targetStart=targetScene.length;
  targetScene+=edit.to;
  for(const focus of edit.focuses){
   const localAt=edit.to.indexOf(focus.text);
   focusRanges.push({at:targetStart+localAt,end:targetStart+localAt+focus.text.length,text:focus.text,weight:focus.weight});
  }
  cursor=edit.end;
 }
 targetScene+=sourceScene.slice(cursor);
 const sortedFocuses=[...focusRanges].sort((a,b)=>a.at-b.at);
 for(let i=sortedFocuses.length-1;i>0;i--)if(sortedFocuses[i].at<sortedFocuses[i-1].end)sortedFocuses.splice(i,1);
 let weightedScene=targetScene;
 for(const focus of [...sortedFocuses].reverse())weightedScene=weightedScene.slice(0,focus.at)+focus.weight+'::'+focus.text+'::'+weightedScene.slice(focus.end);
 const sceneRange=scenePromptRange(parts[0],source.renderedScene||source.plan.scene);
 parts[0]=parts[0].slice(0,sceneRange.start)+weightedScene+parts[0].slice(sceneRange.end);
 const poseEdits=readPoseEdits(data.poseEdits,source);
 for(const pose of poseEdits){
  const section=pose.character+1,part=parts[section],trimmed=part.trimEnd(),tail=part.slice(trimmed.length);
  const suffix=pose.previous?', '+pose.previous:'';
  if(suffix&&!trimmed.endsWith(suffix))continue;
  const unchanged=suffix?trimmed.slice(0,-suffix.length):trimmed;
  parts[section]=unchanged+(pose.relation?', '+pose.relation:'')+tail;
 }
  return {prompt:parts.join('|'),poseEdits,edits:edits.map(({from,to,focuses})=>({character:-1,from,to,...(focuses.length?{focuses}:{weight:0})})),targetScene,sourcePrompt:original};
}

function normalizeFocuses(edit,text){
 if(!text)return [];
 const supplied=Array.isArray(edit.focuses)?edit.focuses:typeof edit.focus==='string'?[{text:edit.focus,weight:edit.weight}]:[];
 const ranges=[];
 for(const f of supplied){
  if(!f||typeof f.text!=='string')continue;
  const phrase=f.text.trim();if(!phrase||/::|[|{}<>]/.test(phrase))continue;
  const at=text.toLowerCase().indexOf(phrase.toLowerCase());if(at<0)continue;
  const end=at+phrase.length;if(ranges.some(r=>at<r.end&&end>r.at))continue;
  const value=Number(f.weight),weight=Number.isFinite(value)?Math.max(0.1,Math.min(5,value)):1.5;
  ranges.push({at,end,text:text.slice(at,end),weight});
 }
 return ranges.map(({text,weight})=>({text,weight}));
}
function emphasizeEdit(text,focuses){
 if(!text)return '';
 let result=text;
 const ranges=focuses.map(f=>{const at=text.indexOf(f.text);return {...f,at,end:at+f.text.length};}).sort((a,b)=>b.at-a.at);
 for(const focus of ranges)result=result.slice(0,focus.at)+focus.weight+'::'+focus.text+'::'+result.slice(focus.end);
 return result;
}
function readPoseEdits(value,source){
 const characters=source.plan.characters,result=[],seen=new Set();
 for(const edit of Array.isArray(value)?value:[]){
  const index=Number(edit?.character);if(!Number.isInteger(index)||index<0||index>=characters.length||seen.has(index)||typeof edit.relation!=='string')continue;
  seen.add(index);const relation=VisualProtocol.relation(edit.relation);
  const previous=source.sections?.characters?.[index]?.relation??VisualProtocol.relation(characters[index].relation);
  result.push({character:index,previous,relation});
 }
 return result;
}
module.exports.editOriginal=editOriginal;
module.exports.sourceForEdit=sourceForEdit;
module.exports.responseText=responseText;
module.exports.isRefusal=isRefusal;
