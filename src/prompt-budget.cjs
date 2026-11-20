'use strict';
// Conservative monitor only. Nothing truncates the frame, confirmed DNA, clothing or contact.
const risk=text=>{const words=String(text||'').trim().split(/\s+/).filter(Boolean).length;return {words,estimate:Math.round(words*1.8),method:'whitespace-times-1.80-not-exact-t5'};};
function converge(plan,style,parts){
 const prompt=[parts.base,...parts.characters.map(c=>c.prompt)].join(' | ');
 const estimate=risk(prompt);const over=estimate.estimate>512;
 return {prompt,base:parts.base,scene:plan.scene,audit:{before:estimate,after:estimate,soft:512,target:512,warningThreshold:512,removed:[],adjusted:[],exactTokenizer:false,cameraFallback:'none',submittedDespiteOverBudget:over,estimateBefore:estimate.estimate,estimateAfter:estimate.estimate,method:estimate.method,overBudget:over,risk:over,mode:'audited',warning:over?'提示词粗估超过512，已照常提交；不是精确T5计数。':''}};
}
module.exports={risk,converge};
