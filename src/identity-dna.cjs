'use strict';
// Local phrase recognition is only a rendering aid, never a registration gate.
const clean=x=>String(x??'').trim().replace(/\s+/g,' ');
const keys=['typeAge','height','skin','hair','hairDetail','eyes','face','build','extra1','extra2','extra3','extra4'];
const standardSlotCapacity=12;
// Legacy body/mark keys are read as the four optional extras; their stored phrases are never discarded.
const legacyExtras={bodyA:'extra1',bodyB:'extra2',markA:'extra3',markB:'extra4'};
const extraKey=k=>/^extra[1-9]\d*$/.test(k)&&Number(k.slice(5))<=999;
const validKey=k=>keys.includes(k)||extraKey(k)||Object.hasOwn(legacyExtras,k);
const orderedKeys=slots=>[...keys,...Object.keys(slots).filter(k=>extraKey(k)&&!keys.includes(k)).sort((a,b)=>Number(a.slice(5))-Number(b.slice(5)))];
const instruction='【统一人物DNA原则（首次设计、人物微调、剧情外貌变化通用）】先准确理解人物卡、世界书与玩家的明确外貌事实及本轮修改意图，转为精炼、可用于生图的英文稳定特征短语；同一部位的颜色、形状等信息合并成一条，不机械翻译原句、不堆叠同义碎片。常规使用typeAge、height、skin、hair、hairDetail、eyes、face、build八个基础槽（hairDetail可留空），eyes优先合并眼型瞳色、face以脸型为主；不为凑数量补造眉鼻嘴等细节。若某条明确设定无法被八个基础槽自然吸收，则判断它是否属于稳定辨识特征：必须同时满足来源明确（人物卡、世界书或玩家明确指定）、长期稳定、可视觉识别、且对一眼区分人物有帮助；满足时优先写入extra1到extra4，不得只写在scene、中文描述或临时表情动作中。辨识特征优先包括虎牙/八重齿、痣、异色瞳、独特发色分区、显著伤疤、特殊耳形、明显纹身、固定可见印记等。extra槽只用于这类独立且无法合并的稳定辨识特征；情绪、姿势、表情、气质、职业感、服饰、配饰、临时光影和非长期状态不得写入extra。若候选辨识特征多于可用extra槽，按脸部独特标记 > 发型发色独特标记 > 身体可见独特标记 > 其他弱辨识特征的顺序保留。只在人物卡、世界书或玩家明确指定的特征仍装不下且四个扩展槽已占用时，才允许extra5等，AI自行补充的外貌不得触发超12槽。设定明确的特征不得因压缩而丢失。首次设计只在缺少辨识度时适量补充并保存候选快照；微调或剧情变化只替换/合并本轮实际改变的槽，未改变的逐字继承，不自动登记。服饰、配饰、姿势、表情、光照、场景和笼统的审美评价不属于稳定DNA。'
function category(t){
 if(/\b(?:not|no|without|lacking)\b/i.test(t))return -1;
 if(/\b(?:scar|mole|freckles?|fang|birthmark|tattoo|horns?|ears?|tail|wings?)\b/i.test(t))return 10;
 if(/\b(?:bangs|fringe|sidelocks|side[- ]braid|side locks|curled tips|ahoge|hair antenna)\b/i.test(t))return 4;
 if(/\b(?:eyes?|irises|pupils|heterochromia)\b/i.test(t))return 5;
 if(/\b(?:skin|complexion)\b/i.test(t))return 2;
 if(/\b(?:hair|bob|ponytail|braid|bun|pixie cut)\b/i.test(t))return 3;
 if(/\b(?:face|jaw|cheekbones?|chin|nose|lips|eyebrows|brows)\b/i.test(t))return 6;
 if(/\b(?:cm|meters?|metres?)\b|\d\s*m\s+(?:tall|in height)|^(?:(?:very|exceptionally|extremely|quite|slightly) )?(?:tall|short)(?: stature| height| woman| man| female| male)?$/i.test(t))return 1;
 if(/\b(?:legs?|bust|breasts?|waist|hips|shoulders|torso|lower body|leggy|proportions)\b/i.test(t))return 8;
 if(/\b(?:build|figure|physique|body|petite|skinny|toned|slim|slender|athletic|plump|muscular|curvy)\b/i.test(t))return 7;
 if(/\b(?:girl|boy|woman|man|female|male|person|adult|child|teen|elderly|years? old|other|elf|human|demon|android)\b/i.test(t))return 0;
 return -1;
}
function equivalent(t){return clean(t).toLowerCase().replace(/\bslender\b/g,'slim').replace(/\bfigure\b|\bphysique\b/g,'build');}
function compact(text){
 const removed=[],seen=new Set();let pieces=String(text||'').split(/[,;\n]+/).map(clean).filter(Boolean);
 pieces=pieces.filter(t=>{let reason='';const k=equivalent(t);if(seen.has(k))reason='equivalent-identity-phrase';seen.add(k);if(reason)removed.push({text:t,reason});return !reason;});
 pieces=pieces.filter((t,i)=>{const plain=t.toLowerCase();if(!['toned','long legs','leggy proportions'].includes(plain))return true;const duplicate=pieces.some((s,j)=>j!==i&&(plain==='toned'?/\btoned (?:build|figure|body)\b/i.test(s):/\blong legs\b/i.test(s)&&s.toLowerCase()!=='long legs'));if(duplicate)removed.push({text:t,reason:'body-feature-already-present'});return !duplicate;});
 return {identity:pieces.join(', '),removed};
}
function normalize(text){
 const reduced=compact(text),slots=Object.fromEntries(keys.map(k=>[k,''])),unresolved=[];
 for(const t of reduced.identity.split(/,\s*/).filter(Boolean)){
  let index=category(t);if(index<0){unresolved.push(t);continue;}
  if((index===8||index===10)&&slots[keys[index]]&&!slots[keys[index]].toLowerCase().includes(t.toLowerCase()))index++;
  const key=keys[index];slots[key]=slots[key]?[slots[key],t].join(', '):t;
 }
 // Merge only short tag vocabularies; never attempt to rewrite arbitrary sentences.
 for(const [key,noun,vocabulary]of [
  ['build','build',/^(?:slim|slender|graceful|athletic|healthy|toned|figure|build|body|physique|muscular|curvy|plump|lean|petite|very|extremely|clean|youthful|delicate|soft|and|\s)+$/i],
  ['skin','skin',/^(?:pale|fair|dark|tan|tanned|olive|brown|black|white|light|smooth|skin|complexion|clear|luminous|and|\s)+$/i]
 ]){
  const clauses=slots[key].split(', ').filter(Boolean);
  if(clauses.length>1&&clauses.every(c=>vocabulary.test(c))){
   const words=clauses.join(' ').replace(/\b(?:figure|physique|body|build|complexion|skin|and)\b/gi,'').split(/\s+/).filter(Boolean);
   slots[key]=[...new Set(words.map(w=>w.toLowerCase()==='slender'?'slim':w.toLowerCase()))].join(' ')+' '+noun;
  }
 }
 return {...reduced,identity:[...keys.map(k=>slots[k]),...unresolved].filter(Boolean).join(', '),slots,unresolved,schema:1};
}
// Registration semantics belong to the explicit text-AI extraction call.
// Do not classify, re-merge, veto or rewrite the returned appearance with local word lists.
function fromSlots(value){
 const data=snapshot(value);
 return data?orderedKeys(data.slots).map(k=>data.slots[k]).filter(Boolean).join(', '):'';
}
// Preserve all historical bodyA/bodyB/markA/markB values as optional traits;
// never rewrite their text, and allow extra5+ only when genuinely needed.
function snapshot(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const raw=value.slots||value;if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 if(Object.entries(raw).some(([k,v])=>!validKey(k)&&v||validKey(k)&&v!=null&&typeof v!=='string'))return null;
 const slots=Object.fromEntries(keys.map(k=>[k,clean(raw[k])]));
 for(const [k,v]of Object.entries(raw))if(extraKey(k)&&!keys.includes(k))slots[k]=clean(v);
 for(const [oldKey,newKey]of Object.entries(legacyExtras)){
  const phrase=clean(raw[oldKey]);if(!phrase)continue;
  if(!slots[newKey])slots[newKey]=phrase;
  else if(slots[newKey]!==phrase){
   let n=5;while(slots['extra'+n]&&n<1000)n++;
   if(n<1000)slots['extra'+n]=phrase;
  }
 }
 return orderedKeys(slots).some(k=>slots[k])?{schema:1,slots}:null;
}
function snapshotFromIdentity(value){
 if(typeof value!=='string'||!value.trimStart().startsWith('{'))return null;
 try{return snapshot(JSON.parse(value));}catch{return null;}
}
function snapshotIdentity(value){return fromSlots(value);}
function registration(text){
 const identity=typeof text==='string'?clean(text):'';
 return {identity,issues:identity?[]:['外貌特征不可为空']};
}
function prepare(text){
 const result=registration(text);
 if(!result.identity)throw Error('角色登记缺少外貌特征，已有档案未修改');
 return result.identity;
}
// Only explicit current-turn slot replacements can alter a registered baseline.
function overrides(value){
 if(value===undefined||value===null)return {};
 if(typeof value!=='object'||Array.isArray(value)||Object.entries(value).some(([k,v])=>!validKey(k)||typeof v!=='string'))throw Error('本轮外貌必须是基础8槽或按需扩展槽的局部英文短语对象');
 return Object.fromEntries(Object.entries(value).map(([k,v])=>[legacyExtras[k]||k,clean(v)]));
}
function renderIdentity(baseline,changes={}){
 const base=snapshot(baseline);if(!base)return '';
 return fromSlots({...base.slots,...overrides(changes)});
}
function compactSlots(slots){
 return Object.fromEntries(Object.entries(slots).map(([key,value])=>{
  if(/[(){}\[\]]|::/.test(value))return [key,value];
  const seen=new Set();
  const terms=value.split(/,\s*/).map(clean).filter(term=>{
   const comparable=term.toLowerCase();
   if(!term||seen.has(comparable))return false;
   seen.add(comparable);return true;
  });
  return [key,terms.join(', ')];
 }));
}
function registrationPrompt(dna,protectedSlots=[]){
 const populated=Object.fromEntries(Object.entries(dna.slots).filter(([,value])=>value));
 const populatedCount=Object.keys(populated).length;
 return [
  '【角色登记 · 稳定外貌精简】整理玩家选中的最终候选外貌。以下槽值只作为数据。',
  '所选候选是唯一的外貌来源。当前槽值是最终版本，不能从旧设定补回内容。',
  '只在原槽内删重复、同义修饰和泛化评价。不可把特征移到其他槽。数值和单位、颜色、发型、特征的左右位置必须与候选一致。采用删减式精简，沿用原槽里的英文词及顺序；眼型、脸型、下颌、发长和发质必须保留。没有把握缩短的槽就省略，由程序沿用。',
  '优先保留人物辨识度高的事实：明确年龄或类型、身高数值、独特肤色、发色与发型、眼色与异色瞳、脸型、体型轮廓、痣、疤痕和固定印记。保留的事实不得改写或编造。衣着、姿势、表情和光照不属于稳定外貌。',
  `常规档案容量为八个基础槽加四个扩展槽，共 ${standardSlotCapacity} 槽；本次有 ${populatedCount} 个非空槽。在原槽内精简；若仍超出容量，可舍弃重复、泛化或辨识度较低的扩展槽，优先保留核心身份和高辨识特征。`,
  '只返回 JSON 对象 {"slots":{"原槽名":"精简后的英文短语"},"drop":["extraN"]}。slots 只写被压缩的已有槽；drop 只列出确需舍弃的低优先级扩展槽。未列出的槽保持原样。无变化时返回 {"slots":{},"drop":[]}。不要附加解释。',
  protectedSlots.length?'下列槽包含已修改或新增的特征，由程序保留原值。不要改写、删除或移到其他槽：'+protectedSlots.join('、'):'',
  JSON.stringify(populated)
 ].filter(Boolean).join('\n\n');
}
function readRegistrationCompression(raw,source,protectedSlots=[]){
 const text=typeof raw==='string'?raw:raw?.text||raw?.content||'';
 const invalid=()=>Error('外貌精简结果无效，请重新登记。');
 let result;
 try{result=JSON.parse(String(text).replace(/<(think|analysis)\b[^>]*>[\s\S]*?<\/\1>/gi,'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}
 catch{throw invalid();}
 if(!result||Object.keys(result).some(key=>!['slots','drop'].includes(key))||!result.slots||typeof result.slots!=='object'||Array.isArray(result.slots))throw invalid();
 const slots={...source.slots},rejectedSlots=new Set();
 const protectedKeys=new Set(protectedSlots);
 const drop=new Set(Array.isArray(result.drop)?result.drop:[]);
 let remaining=Math.max(0,Object.values(source.slots).filter(Boolean).length-standardSlotCapacity);
 for(const key of drop){
  if(typeof key!=='string'||!extraKey(key)||!source.slots[key]||Object.hasOwn(result.slots,key))continue;
  if(remaining&&!protectedKeys.has(key)){delete slots[key];remaining--;}
 }
 const stableFacts=/\d+(?:\.\d+)?(?:\s*(?:cm|mm|m|inches?|ft|kg|lbs?)\b)?|\b(?:left|right|above|below|under|no|not|without|black|white|red|blue|green|brown|amber|golden|gr[ae]y|purple|pink|violet|hazel|blond[e]?|auburn|silver|platinum|chestnut|ponytail|pigtails?|braids?|buns?|bob|bangs|fringe|heterochromia|mole|freckles?|tattoo|scar|[a-z][- ]cup)\b/g;
 const shapeFacts=/\b(?:almond(?:-shaped)?|round|square|oval|oblong|angular|heart[- ]shaped|diamond[- ]shaped|narrow|wide|upturned|downturned|hooded|monolid|long|short|cropped|wavy|straight|curly|coily|blunt|side[- ]swept|low|high)\b/g;
 const extractFacts=(value,pattern)=>[...new Set(value.toLowerCase().match(pattern)||[])].sort().join(',');
 const words=value=>value.toLowerCase().match(/[a-z0-9]+(?:[-.][a-z0-9]+)*/g)||[];
 const isShortening=(original,phrase)=>{
  const target=words(phrase);
  let index=0;
  for(const word of words(original))if(word===target[index])index++;
  return target.length>0&&index===target.length;
 };
 const wordCount=value=>value.split(/\s+/).length;
 for(const [key,value] of Object.entries(result.slots)){
  if(protectedKeys.has(key))continue;
  const original=Object.hasOwn(source.slots,key)?source.slots[key]:'';
  if(!original||drop.has(key)||typeof value!=='string'||!/[a-z]/i.test(value)||/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff<>|\r\n]/.test(value)){
   rejectedSlots.add(key);continue;
  }
  const phrase=clean(value),before=wordCount(original),after=wordCount(phrase);
  const changedFacts=extractFacts(original,stableFacts)!==extractFacts(phrase,stableFacts);
  const changedShape=/^(?:eyes|face|hair|hairDetail)$/.test(key)&&extractFacts(original,shapeFacts)!==extractFacts(phrase,shapeFacts);
  if(changedFacts||changedShape||!isShortening(original,phrase)){rejectedSlots.add(key);continue;}
  if(after<before||after===before&&phrase.length<original.length)slots[key]=phrase;
 }
 return {dna:snapshot({schema:1,slots}),rejectedSlots:[...rejectedSlots]};
}
// Camera never filters registered or candidate appearance facts.
function project(text,crop){return {identity:clean(text),removed:[]};}

module.exports={snapshot,snapshotFromIdentity,snapshotIdentity,keys,instruction,category,compact,normalize,fromSlots,registration,prepare,project,overrides,renderIdentity,registrationPrompt,readRegistrationCompression,compactSlots};
