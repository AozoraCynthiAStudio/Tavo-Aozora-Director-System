'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../src/core.cjs');
const Adapters=require('../src/prompt-adapters.cjs');
const provider=require('../src/provider.cjs').createProvider({},core);

function compiled(actors){
  const result=Adapters.compile({scene:'two adults standing in a park',characters:actors},{},'nai45');
  return {...result,format:'nai45',characters:actors,options:{}};
}
const actorA={name:'Alice',identity:'adult woman, black hair',outfit:'red jacket, knee-length, blue skirt, knee-length'};
const actorB={name:'Bob',identity:'adult man, brown hair',outfit:'green shirt, gray trousers'};
function metadata(prompt,characterPrompts=[]){return {hasPrompt:true,prompt,characterPrompts};}

test('compiled duplicate tags do not look like missing outfit fields in returned pipe metadata',()=>{
  const sent=compiled([actorA,actorB]);
  assert.equal(sent.sections.characters[0].prompt.match(/knee-length/g).length,1);
  assert.equal(sent.prompt.includes(actorA.outfit),false);
  const result=provider.verify(sent,metadata(sent.prompt),null);
  assert.equal(result.status,'prompt-fields-confirmed');
  assert.deepEqual(result.missing,[]);
  assert.equal(result.warning,'');
  assert.equal(result.isolationUnconfirmed,true);
  assert.equal(result.visualConsistency,'not-evaluated');
  assert.equal(result.notes.length,1,'pipe metadata does not confirm independent character columns');
});

test('a genuinely missing outfit phrase still produces a missing-field warning',()=>{
  const sent=compiled([actorA,actorB]);
  const returned=sent.prompt.replace('blue skirt','');
  const result=provider.verify(sent,metadata(returned),null);
  assert.equal(result.status,'mismatch');
  assert.deepEqual(result.missing,[{character:1,field:'outfit'}]);
  assert.match(result.warning,/缺少部分人物提示词/);
});

test('the returned second character section cannot confirm the missing first character',()=>{
  const sent=compiled([actorA,actorB]);
  const result=provider.verify(sent,metadata(sent.sections.base,[sent.sections.characters[1].prompt]),null);
  assert.deepEqual(result.missing,[{character:1,field:'identity'},{character:1,field:'outfit'}]);
  assert.equal(result.status,'mismatch');
});

test('native character metadata can confirm each complete submitted section',()=>{
  const sent=compiled([actorA,actorB]);
  const result=provider.verify(sent,metadata(sent.sections.base,sent.sections.characters.map(c=>c.prompt)),null);
  assert.equal(result.status,'prompt-fields-confirmed');
  assert.deepEqual(result.missing,[]);
  assert.equal(result.isolationUnconfirmed,false);
  assert.equal(result.warning,'');
});

test('weights and repeated natural sentences remain part of the exact submitted section',()=>{
  for(const outfit of ['1.2::red jacket::, 1.2::red jacket::','She wears a red coat., She wears a red coat.']){
    const sent=compiled([{name:'Alice',identity:'adult woman, black hair',outfit}]);
    assert.ok(sent.sections.characters[0].prompt.includes(outfit));
    const returned=sent.prompt.replace(outfit,outfit.slice(0,outfit.indexOf(', ')));
    const result=provider.verify(sent,metadata(returned),null);
    assert.deepEqual(result.missing,[{character:1,field:'outfit'}]);
    assert.equal(result.status,'mismatch');
  }
});

test('missing metadata remains unknown and submitted matching normalizes case and whitespace only',()=>{
  const sent=compiled([actorA,actorB]);
  assert.equal(provider.verify(sent,null,null).status,'unknown');
  const normalized=sent.prompt.toUpperCase().replace(/, /g,',   ');
  const result=provider.verify(sent,metadata(normalized),null);
  assert.equal(result.status,'prompt-fields-confirmed');
  assert.deepEqual(result.missing,[]);
});
