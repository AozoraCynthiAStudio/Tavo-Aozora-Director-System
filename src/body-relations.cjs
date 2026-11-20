'use strict';
const Adapters=typeof require==='function'?require('./prompt-adapters.cjs'):DirectorAdapters;
const clean=x=>String(x??'').trim();
function kind(identity){const text=clean(identity);if(/^other\b/i.test(text))return 'other';const male=/\b(?:boy|man|male)\b/i.test(text),female=/\b(?:girl|woman|female)\b/i.test(text);return male===female?'':male?'boy':'girl';}
function actorKind(actor){
 const typeAge=actor.appearanceOverrides?.typeAge||actor.registrationDNA?.slots?.typeAge;
 return kind(typeAge)||kind(Adapters.splitTags(clean(actor.identity))[0])||kind(actor.identity);
}
function anchoredIdentity(identity,actorType){const normalized=clean(identity).replace(/\b1(girl|boy|other)\b/gi,'$1'),type=actorType||kind(normalized);return !type||new RegExp('^'+type+'\\b','i').test(normalized)?normalized:type+', '+normalized;}
const totalTag=/^\d+\s*(?:people|persons?)$/i;
const categoryTag=/^\d+\s*(?:girls?|boys?|others?|women|woman|men|man)$/i;
function naiClearSubjectTagCount(scene){
 const counts={female:0,male:0,other:0,total:0};
 const pattern=/(?:^|[^A-Za-z0-9])(\d+)\s*(girls?|boys?|others?|women|woman|men|man|people|persons?)(?=$|[^A-Za-z0-9])/gi;
 for(const [,number,label] of String(scene||'').matchAll(pattern)){
  const type=/^(?:girl|wom)/i.test(label)?'female':/^(?:boy|m[ae]n)/i.test(label)?'male':/^other/i.test(label)?'other':'total';
  counts[type]=Math.max(counts[type],Number(number));
 }
 // A total and its categories describe the same people. Use the larger
 // claim for validation so conflicting tags cannot conceal extra subjects.
 return Math.max(counts.total,counts.female+counts.male+counts.other)||null;
}
function sceneCastTags(scene,types,audit){
 const tags=Adapters.splitTags(scene);
 const declared=naiClearSubjectTagCount(scene);
 const known=types.length>0&&types.every(Boolean)&&!(declared>types.length);
 const castTags=tags.filter(raw=>totalTag.test(clean(raw))||categoryTag.test(clean(raw)));
 if(!castTags.length)return scene;
 const counts=new Map();
 if(known)for(const type of types)counts.set(type,(counts.get(type)||0)+1);
 const canonical=[...counts].map(([type,n])=>n+type+(n===1?'':'s'));
 const sortedCanonical=[...canonical].sort();
 if(known&&castTags.length===canonical.length&&castTags.map(tag=>clean(tag).toLowerCase()).sort().every((tag,i)=>tag===sortedCanonical[i]))return scene;
 let inserted=false;
 const next=tags.flatMap(raw=>{
  const text=clean(raw),total=totalTag.test(text),category=categoryTag.test(text);
  if(!total&&!(known&&category))return [raw];
  audit.sceneRemoved.push(text);
  if(inserted||!known)return [];
  inserted=true;
  audit.sceneAdded.push(...canonical);
  const spacing=raw.match(/^\s*/)[0];
  return [spacing+canonical.join(', ')];
 });
 return next.join(',').trim();
}
function compile(plan,format){
 const audit={mode:'scene-owned',sceneAdded:[],sceneRemoved:[],identityAdded:[],heights:[],cameraChanged:false};
 if(format!=='nai45')return {plan,audit};
 const types=plan.characters.map(actorKind);
 const characters=plan.characters.map((actor,i)=>{
  const identity=anchoredIdentity(actor.identity,types[i]);
  if(identity!==actor.identity)audit.identityAdded.push({name:actor.name,form:actor.form,value:types[i],reason:'required-nai-actor-type'});
  return {...actor,identity};
 });
 return {plan:{...plan,scene:sceneCastTags(plan.scene,types,audit),characters},audit};
}
function withoutGeneratedScene(scene){return scene;}
module.exports={naiClearSubjectTagCount,kind,anchoredIdentity,compile,withoutGeneratedScene};
