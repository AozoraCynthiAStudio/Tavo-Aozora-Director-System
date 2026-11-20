'use strict';
function readable(value){return String(value||'').trim()
 .replace(/\b(\d+)girls?\b/gi,(_,n)=>n==='1'?'one female character':n+' female characters')
 .replace(/\b(\d+)boys?\b/gi,(_,n)=>n==='1'?'one male character':n+' male characters')
 .replace(/\bpov\b/gi,'first-person view')
 .replace(/\bjitome\b/gi,'eyes with flat upper eyelids')
 .replace(/\btsurime\b/gi,'eyes with upward-tilted outer corners')
 .replace(/\btareme\b/gi,'eyes with downward-tilted outer corners')
 .replace(/\bthighhighs\b/gi,'thigh-high stockings')
 .replace(/\bover-kneehighs\b/gi,'over-the-knee stockings')
 .replace(/\bkneehighs\b/gi,'knee-high stockings')
 .replace(/\b([a-z]+(?:_[a-z]+)+)\b/gi,word=>word.replaceAll('_',' '));}
function sentence(value){const text=String(value||'').trim();return text?text+(/[.!?。！？]$/.test(text)?'':'.'):'';}
function characterText(c){
 const name=String(c.name||'').trim(),identity=readable(c.identity),outfit=readable(c.outfit);
 const appearance=identity?name+' has these visible features: '+identity:'';
 const parts=outfit.split(/,\s*/).filter(Boolean),absence=parts.filter(p=>p==='barefoot'||p.startsWith('no '));
 const worn=parts.filter(p=>!absence.includes(p)).join(', ');
 const pose=readable(c.relation);
 return [appearance,pose?name+"'s pose: "+pose:'',worn?name+' is wearing '+worn:'',...absence.map(p=>p==='barefoot'?name+' is barefoot':name+' is wearing '+p)].filter(Boolean).map(sentence).join(' ');
}
function compile(plan,style,parts){return [sentence(readable(plan.scene)),...parts.characters.map(characterText),sentence(style.positive)].filter(Boolean).join('\n\n');}
if(typeof module!=='undefined')module.exports={readable,sentence,characterText,compile};
