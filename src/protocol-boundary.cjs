'use strict';
// Treat foreign markup, literal examples and comments as opaque. Only normal
// prose wrappers may contain our transport blocks.
const proseTags=new Set(['html','body','main','article','section','div','span','p','bubble']);
const voidTags=new Set(['br','hr','img','input','meta','link','source','wbr']);
const ownTags=new Set(['ad-visual','ad-wardrobe','ad-physical-state']);
function jsonRanges(text){
 const ranges=[];
 for(const match of text.matchAll(/<ad-(?:wardrobe|physical-state)(?=[\s/>])[^>]*>/gi)){
  if(isProtected(match.index,ranges))continue;
  const start=match.index+match[0].length,end=jsonEnd(text,start,text.length);
  if(end<=start)continue;
  try{JSON.parse(text.slice(start,end));ranges.push({start,end});}catch{/* Incomplete data remains conservatively bounded. */}
 }
 return ranges;
}
function protectedRanges(text){
 const original=String(text),json=jsonRanges(original);
 const source=json.reduce((text,span)=>text.slice(0,span.start)+' '.repeat(span.end-span.start)+text.slice(span.end),original),ranges=[],stack=[];
 const tokens=/<!--[\s\S]*?-->|^[ \t]*```[^\r\n]*[\s\S]*?^[ \t]*```[^\r\n]*(?:\r?\n|$)|<\/?([a-z][a-z0-9:-]*)\b[^>]*>/gmi;
 for(const match of source.matchAll(tokens)){
  const token=match[0],name=match[1]?.toLowerCase();
  if(!name){if(!stack.length)ranges.push({start:match.index,end:match.index+token.length});continue;}
  if(proseTags.has(name)||ownTags.has(name))continue;
  if(/^<\//.test(token)){
   const at=stack.map(item=>item.name).lastIndexOf(name);
   if(at<0)continue;
   const first=stack[0];stack.splice(at);
   if(!stack.length)ranges.push({start:first.start,end:match.index+token.length});
  }else if(!voidTags.has(name)&&! /\/\s*>$/.test(token))stack.push({name,start:match.index});
 }
 if(stack.length)ranges.push({start:stack[0].start,end:source.length});
 return ranges.sort((a,b)=>a.start-b.start);
}
function isProtected(index,ranges){return ranges.some(span=>index>=span.start&&index<span.end);}
function ownedTags(text,tag){
 const source=String(text),ranges=[...protectedRanges(source),...jsonRanges(source)],pattern=new RegExp('<(\\/?)'+tag+'(?=[\\s/>])[^>]*>','gi');
 return [...source.matchAll(pattern)].filter(match=>!isProtected(match.index,ranges)).map(match=>({start:match.index,end:match.index+match[0].length,closing:!!match[1]}));
}
function removeRanges(text,ranges){
 let result=String(text);
 const merged=[];
 for(const span of ranges.filter(s=>s.end>s.start).sort((a,b)=>a.start-b.start)){
  const last=merged.at(-1);if(last&&span.start<=last.end)last.end=Math.max(last.end,span.end);else merged.push({...span});
 }
 for(const span of merged.reverse())result=result.slice(0,span.start)+result.slice(span.end);
 return result;
}
function jsonEnd(source,start,limit){
 let at=start;while(at<limit&&/\s/.test(source[at]))at++;
 if(source[at]!=='{'&&source[at]!=='[')return start;
 const stack=[];let quoted=false,escaped=false;
 for(let i=at;i<limit;i++){
  const c=source[i];
  if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
  if(c==='<')return i;
  if(c==='"'){quoted=true;continue;}
  if(c==='{'||c==='[')stack.push(c);
  else if(c==='}'||c===']'){
   if(stack.at(-1)!==(c==='}'?'{':'['))return i;
   stack.pop();if(!stack.length)return i+1;
  }else if(c==='\n'){
   const following=source.slice(i+1,limit).match(/^[ \t]*([^\r\n]*)/)[1];
   if(following&&!/^(?:["}\]\[{,]|-?\d|true\b|false\b|null\b)/.test(following))return i;
  }else if(!/[\s,:0-9.eE+\-]/.test(c)){
   const literal=source.slice(i,limit).match(/^(?:true|false|null)\b/);
   if(literal)i+=literal[0].length-1;else return i;
  }
 }
 return limit;
}
function jsonBlocks(text,tag){
 const source=String(text),tokens=ownedTags(source,tag),ranges=protectedRanges(source),blocks=[];
 for(let i=0;i<tokens.length;i++){
  const open=tokens[i];if(open.closing)continue;
  const next=tokens[i+1],barrier=ranges.find(range=>range.start>=open.end);
  const other=[...ownTags].filter(name=>name!==tag).flatMap(name=>ownedTags(source,name)).filter(item=>item.start>=open.end).sort((a,b)=>a.start-b.start)[0];
  const limit=Math.min(next?.start??source.length,barrier?.start??source.length,other?.start??source.length);
  const end=jsonEnd(source,open.end,limit),close=next?.closing&&limit===next.start?next:null;
  blocks.push({start:open.start,end:close?close.end:end,inner:source.slice(open.end,end).trim(),complete:!!close});
 }
 return blocks;
}
function stripJson(text,tag,commentTag){
 const source=String(text),tokens=ownedTags(source,tag),blocks=jsonBlocks(source,tag);
 let result=removeRanges(source,[...tokens,...blocks]);
 if(commentTag){
  result=removeRanges(result,ownedComments(result,commentTag));
 }
 return result;
}
function ownedComments(text,prefix){
 const source=String(text),foreign=protectedRanges(source.replace(/<!--[\s\S]*?-->/g,m=>' '.repeat(m.length)));
 const pattern=new RegExp('<!--'+prefix+'(?:-ref|-error)?:([\\s\\S]*?)-->','g');
 return [...source.matchAll(pattern)].filter(m=>!isProtected(m.index,foreign)).map(m=>({start:m.index,end:m.index+m[0].length,inner:m[1],text:m[0]}));
}
module.exports={protectedRanges,isProtected,ownedTags,removeRanges,jsonBlocks,stripJson,ownedComments};
