'use strict';
const DNA=typeof require==='function'?require('./identity-dna.cjs'):DirectorDNA;
const Equipment=typeof require==='function'?require('./wardrobe.cjs'):DirectorWardrobe;
const FIELDS={姓名:'name',形态:'form',外貌:'identity',画面外形:'portraitAppearance',关系:'relation'};
const SUMMARY_FIELDS={本轮事件:'event',选定瞬间:'moment',镜头安排:'framing'};
function sourceExcerpt(value){
 if(typeof value!=='string'||!value.trim()||value.length>2000||/<[^>]*>/.test(value))return undefined;
 return value;
}
function readSourceExcerpt(value){
 return sourceExcerpt(optionalJson(value)??value);
}
function directorSummary(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
 const result={};
 for(const key of Object.values(SUMMARY_FIELDS)){
  if(typeof value[key]!=='string')continue;
  const text=value[key].replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0,160);
  if(text)result[key]=text;
 }
 return Object.keys(result).length?result:undefined;
}
function frameSelection(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
 const selection={};
 for(const field of ['appearance','outfit']){
  const entries=value[field];
  if(Array.isArray(entries)&&entries.length<=96&&entries.every(entry=>typeof entry==='string'&&entry.trim()&&entry.length<=300&&!/[<>|\r\n]/.test(entry))){
   selection[field]=[...new Set(entries.map(entry=>entry.trim()))];
  }
 }
 return Object.keys(selection).length?selection:undefined;
}
// A person's pose can be a natural description; this is not a word-count gate.
function relation(value){
 return typeof value==='string'?value.replace(/<[^>]*>/g,' ').replace(/\|/g,', ').replace(/\s+/g,' ').trim():'';
}

function readAppearanceOverrides(text){
 const parsed=optionalJson(text);
 if(parsed!==undefined)return DNA.overrides(parsed);
 if(text.length>600||/[<>|{}\[\]\u3040-\u30ff\u3400-\u9fff]/.test(text))throw Error('本轮外貌覆盖JSON无效');
 const hair=[],hairDetail=[];
 for(const part of text.split(',').map(value=>value.trim()).filter(Boolean)){
  if(/\b(?:loose strands?|flyaways?)\b/i.test(part)||DNA.category(part)===4)hairDetail.push(part);
  else if(DNA.category(part)===3)hair.push(part);
 }
 return {...(hair.length?{hair:hair.join(', ')}:{}),...(hairDetail.length?{hairDetail:hairDetail.join(', ')}:{})};
}

function parse(raw){
 const plan={scene:'',characters:[]};let actor=null,seen=new Set(),hasScene=false;
 for(const source of String(raw).split(/\r?\n/)){
  const line=source.trim();if(!line)continue;
  if(line==='【画面】'){if(hasScene||actor)throw Error('画面分组重复或顺序错误');hasScene=true;continue;}
  const heading=line.match(/^【人物\s*(\d+)】$/);if(heading){if(!hasScene||Number(heading[1])!==plan.characters.length+1)throw Error('人物分组编号不连续');actor={};plan.characters.push(actor);seen=new Set();continue;}
  const match=line.match(/^([^：:]+)[：:]\s*(.*)$/);if(!match||!hasScene)throw Error('导演方案格式无效');const label=match[1].trim(),text=match[2].trim();
  if(Object.hasOwn(SUMMARY_FIELDS,label)){plan.directorSummary={...plan.directorSummary,[SUMMARY_FIELDS[label]]:text};continue;}
  if(label==='正文依据'){const excerpt=readSourceExcerpt(text);if(excerpt!==undefined)plan.sourceExcerpt=excerpt;continue;}
  if(!actor){if(!['场景','描述','局部参与者'].includes(label)||seen.has(label))throw Error('画面字段缺失或重复');seen.add(label);if(label==='局部参与者'){try{plan.fragments=JSON.parse(text);}catch{/* Optional reference data. */}}else plan[label==='场景'?'scene':'description']=text;continue;}
  if(seen.has(label))throw Error('人物字段重复');seen.add(label);
  if(label==='登记DNA'){try{const dna=DNA.snapshot(JSON.parse(text));if(dna)actor.registrationDNA=dna;}catch{/* Invalid optional design data does not veto an otherwise valid scene. */}}
  else if(label==='本轮外貌'){try{actor.appearanceOverrides=readAppearanceOverrides(text);}catch{throw Error('本轮外貌覆盖JSON无效');}}
  else if(label==='本帧取用')actor.frameSelection=frameSelection(optionalJson(text));
  else if(label==='装备'){try{actor.equipment=JSON.parse(text);}catch{throw Error('装备快照 JSON 无效');}}
  else if(FIELDS[label])actor[FIELDS[label]]=label==='关系'?relation(text):text;
  else throw Error('未知人物字段（仅使用单场景协议）：'+label);
 }
 if(!hasScene||!plan.scene)throw Error('缺少画面场景');
 for(const c of plan.characters){c.identity||=DNA.snapshotIdentity(c.registrationDNA);if(!c.equipment||!c.name||!c.identity)throw Error('人物方案字段不完整');Equipment.normalizeCharacter(c);}
 const summary=directorSummary(plan.directorSummary);if(summary)plan.directorSummary=summary;else delete plan.directorSummary;
 return plan;
}
function format(plan,requestId){
 const wrapper=requestId?'<ad-visual id="'+requestId+'">':'<ad-visual>';
 const lines=[wrapper,'','【画面】','','场景：'+plan.scene,'','描述：'+(plan.description||'')];
 const summary=directorSummary(plan.directorSummary);
 const excerpt=sourceExcerpt(plan.sourceExcerpt);if(excerpt!==undefined)lines.push('','正文依据：'+JSON.stringify(excerpt));
 if(summary)for(const [label,key]of Object.entries(SUMMARY_FIELDS))if(summary[key])lines.push('',label+'：'+summary[key]);
 if(Array.isArray(plan.fragments)&&plan.fragments.length)lines.push('','局部参与者：'+JSON.stringify(plan.fragments));
 plan.characters.forEach((c,i)=>{Equipment.normalizeCharacter(c);lines.push('','【人物 '+(i+1)+'】','','姓名：'+c.name,'','形态：'+(c.form||'默认形态'),'','外貌：'+c.identity,...(c.portraitAppearance?['','画面外形：'+c.portraitAppearance]:[]),...(DNA.snapshot(c.registrationDNA)?['','登记DNA：'+JSON.stringify(DNA.snapshot(c.registrationDNA))]:[]),...(Object.keys(c.appearanceOverrides||{}).length?['','本轮外貌：'+JSON.stringify(c.appearanceOverrides)]:[]),'','装备：'+JSON.stringify(c.equipment),...(frameSelection(c.frameSelection)?['','本帧取用：'+JSON.stringify(frameSelection(c.frameSelection))]:[]),...(c.relation?['','关系：'+relation(c.relation)]:[]));});
 lines.push('','</ad-visual>');return lines.join('\n');
}
const actorHeading=/^(?:【人物\s*\d+】|人物\s*[：:]\s*(.+))$/;
const visualLine=/^(?:【画面】|【人物\s*\d+】|<ad-visual(?=[\s/>])[^>]*>|(?:场景|scene|描述|description|正文依据|本轮事件|选定瞬间|镜头安排|局部参与者|人物|姓名|形态|外貌|画面外形|登记DNA|本轮外貌|本帧取用|装备|关系)\s*[：:])/i;
function readDraft(raw){
 const plan={scene:'',characters:[]};
 let actor=null;
 for(const source of String(raw).split(/\r?\n/)){
  const line=source.trim();
  const heading=line.match(actorHeading);
  if(heading){actor=heading[1]?{name:heading[1].trim()}:{};plan.characters.push(actor);continue;}
  if(line==='【画面】'){actor=null;continue;}
  const match=line.match(/^([^：:]+)[：:]\s*(.*)$/);
  if(!match||!match[2].trim())continue;
  const label=match[1].trim(),value=match[2].trim();
  if(Object.hasOwn(SUMMARY_FIELDS,label)){plan.directorSummary={...plan.directorSummary,[SUMMARY_FIELDS[label]]:value};continue;}
  if(label==='正文依据'){const excerpt=readSourceExcerpt(value);if(excerpt!==undefined)plan.sourceExcerpt??=excerpt;continue;}
  if(/^(?:场景|scene)$/i.test(label)){plan.scene||=value;continue;}
  if(/^(?:描述|description)$/i.test(label)){plan.description??=value;continue;}
  if(label==='局部参与者'){plan.fragments??=optionalJson(value);continue;}
  if(!actor)continue;
  const key=Object.hasOwn(FIELDS,label)?FIELDS[label]:null;
  if(key){actor[key]??=value;continue;}
  if(label==='本轮外貌'){
   try{actor.appearanceOverrides??=readAppearanceOverrides(value);}catch{/* Unreadable optional appearance. */}
   continue;
  }
  const jsonFields={装备:'equipment',登记DNA:'registrationDNA',本帧取用:'frameSelection'};
  if(Object.hasOwn(jsonFields,label))actor[jsonFields[label]]??=optionalJson(value);
 }
 return plan;
}
function optionalJson(value){
 try{return JSON.parse(value);}catch{return undefined;}
}
module.exports={parse,format,relation,readDraft,visualLine,frameSelection,directorSummary,sourceExcerpt};
