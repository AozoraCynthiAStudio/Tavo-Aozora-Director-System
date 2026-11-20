'use strict';
// Numeric source facts only. This module never estimates height from an image or body type.
const clean=x=>String(x??'').trim();
const norm=x=>clean(x).normalize('NFKC').toLowerCase();
const escape=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const token='((?:约|大约|approximately|about|around|[~≈])?\\s*\\d+(?:\\.\\d+)?(?:\\s*[-–至到]\\s*\\d+(?:\\.\\d+)?)?)\\s*(厘米|公分|cm|米|meters?|metres?|m)(?![a-z])';
function extract(value){
 const source=clean(value).normalize('NFKC'),found=[];
 const re=new RegExp('(?:身高(?:为|是)?|height\\s*(?:(?:is|of)\\s*)?[:：=]?)\\s*'+token+'|(?:^|[,;，；\\n])\\s*'+token+'(?:\\s+(?:tall|in height))?(?=\\s*(?:$|[,;，；\\n]))|'+token+'\\s+(?:tall|in height)\\b','gi');
 for(const match of source.matchAll(re)){
  const amount=clean(match[1]||match[3]||match[5]),unit=/^(?:厘米|公分|cm)$/i.test(match[2]||match[4]||match[6])?'cm':'m';
  const numbers=amount.match(/\d+(?:\.\d+)?/g)||[];if(!numbers.length||numbers.some(n=>!Number.isFinite(Number(n))||Number(n)<=0))continue;
  const approximate=/约|approximately|about|around|[~≈]/i.test(amount),range=numbers.length>1;
  const text=(approximate?'approximately ':'')+numbers.join('-')+' '+unit+' tall';
  const cm=range?null:Number(numbers[0])*(unit==='m'?100:1),key=(range?numbers.map(n=>Number(n)*(unit==='m'?100:1)).join('-'):cm)+'|'+approximate;
  const existing=found.find(x=>x.key===key);
  const span={start:match.index,raw:match[0]};
  if(existing)existing.spans.push(span);else found.push({text,cm,approximate,range,key,spans:[span]});
 }
 return found.length===1?found[0]:null;
}
function pin(identity,height){
 if(!height)return clean(identity);
 const parts=clean(identity).split(/[,;，；]+/).map(clean).filter(Boolean);
 const kept=parts.map(part=>{
  const existing=extract(part);if(!existing)return part;
  let value=part;for(const span of [...existing.spans].sort((a,b)=>b.start-a.start))value=value.slice(0,span.start)+value.slice(span.start+span.raw.length);
  return value.replace(/\s+/g,' ').replace(/^[,;\s]+|[,;\s]+$/g,'');
 }).filter(Boolean);
 // Keep other body facts, but do not retain a conflicting standalone stature label.
 return [...kept.filter(p=>!/^(?:(?:very|extremely|quite|slightly)\s+)?(?:tall|short)(?:\s+(?:height|stature))?$/i.test(p)).map(p=>p.replace(/\b(?:(?:very|extremely|quite|slightly)\s+)?(?:tall|short)\s+(?=(?:woman|man|person|girl|boy)\b)/gi,'')),height.text].join(', ');
}
function profileFor(actor,profiles=[]){
 const matches=profiles.filter(p=>p.enabled!==false&&norm(p.form||'默认形态')===norm(actor.form||'默认形态')&&[p.name,...(p.aliases||[])].some(n=>norm(n)===norm(actor.name)));
 return matches.length===1?matches[0]:null;
}
function requestedHeight(actor,request={},profile){
 const names=[actor.name,profile?.name,...(profile?.aliases||[])].filter(Boolean);
 const text=[request.request,request.storyInput].filter(Boolean).join('\n').normalize('NFKC');
 const values=[];
 for(const name of names){
  const re=new RegExp(escape(name)+'(?:的)?\\s*(?:身高(?:改为|改成|为|是)?|height\\s*(?:is|of)?[:：=]?|is)\\s*'+token+'(?:\\s+tall)?','gi');
  for(const match of text.matchAll(re)){
   if(/(?:不要|别|假如|如果|希望|想要|打算|计划|不是|并非|not|wish)\s*[^，。；;\n]{0,12}$/i.test(text.slice(Math.max(0,match.index-24),match.index)))continue;
   const height=extract('height '+match[1]+' '+match[2]);if(height)values.push(height);
  }
 }
 if(!values.length&&request.kind==='character_intro'&&norm(request.targetName)===norm(actor.name)){
  const explicit=extract(request.request);if(explicit)values.push(explicit);
 }
 const unique=[...new Map(values.map(v=>[v.key,v])).values()];return unique.length===1?unique[0]:null;
}
function anchorPlan(plan,request={},profiles=[]){
 const audit=[];
 const characters=plan.characters.map(actor=>{
  const profile=profileFor(actor,profiles),explicit=requestedHeight(actor,request,profile),registered=Object.hasOwn(actor.appearanceOverrides||{},'height')?null:extract(profile?.identity),current=extract(actor.identity),chosen=explicit||registered||current;
  if(actor.registrationDNA?.slots&&!explicit)return {...actor};
  if(!chosen)return {...actor};
  const identity=pin(actor.identity,chosen);
  if(identity!==actor.identity)audit.push({name:actor.name,form:actor.form,field:'height',source:explicit?'request':registered?'profile':'visual',value:chosen.text});
  return {...actor,identity,...(actor.registrationDNA?.slots?{appearanceOverrides:{...actor.appearanceOverrides,height:chosen.text}}:{})};
 });
 return {plan:{...plan,characters},audit};
}
function registrationIdentity(identity,sourceIdentity,previousIdentity){return pin(identity,extract(sourceIdentity)||extract(previousIdentity));}
function relativeCue(plan,format){
 if(plan.characters.length!==2||/height difference|size difference|taller than|same eye level|equal eye level|same apparent height/i.test(plan.scene))return '';
 const rows=plan.characters.map(c=>({name:c.name,height:extract(c.identity)}));
 if(rows.some(r=>!r.height||r.height.cm===null)||Math.abs(rows[0].height.cm-rows[1].height.cm)<5)return '';
 rows.sort((a,b)=>b.height.cm-a.height.cm);
 return format==='nai45'?'height difference':rows[0].name+' is taller than '+rows[1].name+'.';
}
module.exports={extract,pin,profileFor,requestedHeight,anchorPlan,registrationIdentity,relativeCue};
