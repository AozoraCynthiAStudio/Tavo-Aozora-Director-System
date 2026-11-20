'use strict';
// Names may remain Chinese. Other visual values must already be usable English.
const hasUntranslatedText=value=>/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value);
function validate(plan,style={}){
 const names=plan.characters.map(c=>c.name).filter(Boolean).sort((a,b)=>b.length-a.length);
 const withoutNames=value=>names.reduce((s,name)=>s.split(name).join(' '),String(value||''));
 const fields=[['场景',plan.scene],['画风正面词',style.positive],...(style.useNegative?[['画风负面词',style.negative]]:[])];
 for(const c of plan.characters)fields.push([c.name+' · 外貌',c.identity],...(c.relation?[[c.name+' · 关系',c.relation]]:[]),[c.name+' · 衣着',c.outfit]);
 const unresolved=plan.characters.filter(c=>/\bregistered appearance\b/i.test(c.identity));
 const invalid=fields.filter(([,value])=>hasUntranslatedText(withoutNames(value))).map(([label])=>label);
 // Overt editing markers only: ordinary negation, alternatives in labels and
 // clothing absence are not themselves evidence of a leaked editing process.
 const residue=fields.filter(([,value])=>/\?\s*(?:no|wait|actually)\b|\b(?:correction|i mean)\s*[:,]|(?:^|[,;]\s*)(?:wait|actually|alternatively|maybe|perhaps)\s*[:,]/i.test(withoutNames(value))).map(([label])=>label);
 // A stray editing phrase is a quality warning, not a reason to refuse a paid image.
 // Keep its original text rather than guessing which alternative was intended.
 return {checked:true,editorialChecked:true,fields:fields.length,editorialResidue:residue,untranslatedFields:invalid,unresolvedNames:unresolved.map(c=>c.name),warning:''};
}
module.exports={validate,hasUntranslatedText};
