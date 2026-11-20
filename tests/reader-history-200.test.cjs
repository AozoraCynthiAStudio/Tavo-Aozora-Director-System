'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

// Run the precise history-reader function from the shipped UI source, with a
// Tavo-compatible read-only message API. No real chat/image files are touched.
const reader=fs.readFileSync(path.join(__dirname,'../src/ui/reader.js'),'utf8');
const from=reader.indexOf(' async function fetchRows(token=epoch){');
const to=reader.indexOf(' async function loadPreviews(items,token){',from);
assert(from>=0&&to>from,'history catalog source must be present');
const implementation=reader.slice(from,to);
function harness({floorCount,withCount,staleChatCount=199,countThrows=false}){
 const calls=[];
 const messages=Array.from({length:floorCount},(_,i)=>({id:1000+i,role:i%2===1?'assistant':'user',content:'楼层 '+(i+1)}));
 const tavo={chat:{current:async()=>({id:42,messageCount:staleChatCount})},message:{find:async(range,filter)=>{
  assert.equal(filter,undefined,'range queries must be unfiltered so physical floor numbers remain reliable');
  calls.push([...range]);
  return messages.slice(range[0],range[1]+1).map(m=>({...m}));
 }}};
 if(withCount)tavo.message.count=async()=>{if(countThrows)throw Error("count unavailable");return floorCount;};
 const scope={tavo,setTimeout,api:{app:()=>({index:async()=>[]})},disposed:false,epoch:1,rowsRevision:0,rowsDirty:true,cachedChat:'',cachedCount:null,cgCounts:new Map(),rows:[],collection:x=>Array.isArray(x)?x:x?.items||[],message:x=>x?.message||x,preview:x=>x};
 const fetchRows=vm.runInNewContext('(()=>{'+implementation+';return fetchRows;})()',scope);
 return {fetchRows,scope,calls};
}
for(const [name,withCount] of [['documented count API',true],['old host with only stale chat.messageCount',false]]){
 test('history after floor 199 remains visible using '+name,async()=>{
  const {fetchRows,calls}=harness({floorCount:462,withCount});
  const rows=await fetchRows();
  assert.equal(rows.length,231);
  const floors=rows.map(x=>x.index+1);
  for(const floor of [198,200,202,298,300,400,462])assert(floors.includes(floor),'missing floor '+floor);
  assert.equal(floors.at(-1),462);
  assert(calls.some(([start])=>start===200),'must read past the old 199/200 boundary');
  assert(calls.some(([start])=>start===400),'must read intermediate late messages, not just latest');
  assert(floors.every((v,i)=>i===0||v>floors[i-1]));
 });
}
test('exact 200-floor boundary does not stop at one page',async()=>{
 const {fetchRows,calls}=harness({floorCount:200,withCount:true});
 const rows=await fetchRows();
 assert.equal(rows.length,100);
 assert.equal(rows.at(-1).index,199);
 assert(calls.some(([start])=>start===200),'probe after a full page prevents truncation on stale totals');
});
test('history scan of a short conversation keeps physical floor numbers and excludes user turns',async()=>{
 const {fetchRows}=harness({floorCount:17,withCount:true});
 const rows=await fetchRows();
 assert.deepEqual(Array.from(rows,x=>x.index),[1,3,5,7,9,11,13,15]);
 assert(rows.every(x=>String(x.id).startsWith('10')));
});
test('cancelled catalog scan does not finish with partial history',async()=>{
 const {fetchRows,scope}=harness({floorCount:500,withCount:true});
 // The async read yields between pages; another navigation epoch cancels it.
 const promise=fetchRows();
 await new Promise(resolve=>setTimeout(resolve,0));
 scope.epoch=2;
 const rows=await promise;
 assert.equal(rows,null);
});

test('host count failure falls back to read-only floor scan',async()=>{
 const {fetchRows}=harness({floorCount:249,withCount:true,countThrows:true});
 const rows=await fetchRows();
 assert.equal(rows.at(-1).index,247);
 assert.equal(rows.length,124);
});
