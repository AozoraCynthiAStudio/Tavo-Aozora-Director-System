'use strict';
// Conservative monitor only. Nothing truncates the frame, confirmed DNA, clothing or contact.
const risk=text=>{const words=String(text||'').trim().split(/\s+/).filter(Boolean).length;return {words,estimate:Math.round(words*1.8),method:'whitespace-times-1.80-not-exact-t5'};};
function converge(plan,style,parts){
 const prompt=[parts.base,...parts.characters.map(c=>c.prompt)].join(' | ');
 const estimate=risk(prompt);const over=estimate.estimate>512;
 return {prompt,base:parts.base,scene:plan.scene,audit:{before:estimate,after:estimate,soft:512,target:512,warningThreshold:512,removed:[],adjusted:[],exactTokenizer:false,cameraFallback:'none',submittedDespiteOverBudget:over,estimateBefore:estimate.estimate,estimateAfter:estimate.estimate,method:estimate.method,overBudget:over,risk:over,mode:'audited',warning:over?'提示词粗估超过512，已照常提交；不是精确T5计数。':''}};
}
const nai5Limit=1471;
const nai5Estimate=text=>Math.ceil([...String(text||'').trim()].length/4.4);
function nai5Risk(parts){
 const base=nai5Estimate(parts.base),characters=parts.characters.map(actor=>nai5Estimate(actor.prompt));
 return {base,characters,estimate:base+characters.reduce((sum,value)=>sum+value,0),method:'v5-calibrated-character-estimate'};
}
function nai5Audit(parts){
 const estimate=nai5Risk(parts),overBudget=estimate.estimate>nai5Limit;
 return {before:estimate,after:estimate,soft:nai5Limit,target:nai5Limit,warningThreshold:nai5Limit,removed:[],adjusted:[],exactTokenizer:false,estimateBefore:estimate.estimate,estimateAfter:estimate.estimate,method:estimate.method,overBudget,risk:overBudget,mode:'audited',warning:overBudget?'NAI 5 正面提示词估算超过 1471，仍照常出图。此数值为估算。':''};
}
module.exports={risk,converge,nai5Risk,nai5Audit};
