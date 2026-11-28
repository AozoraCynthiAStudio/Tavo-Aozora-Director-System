'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');

const source=fs.readFileSync(path.join(__dirname,'../src/ui/controller.js'),'utf8');
const parser=source.slice(source.indexOf('  function parseImageApiExample('),source.indexOf('  function bindImageApiPaste('));
const parse=vm.runInNewContext(parser+'\nparseImageApiExample',{URL});

test('extracts the POST address and model from a multiline NovelAI cURL example',()=>{
  const example=[
    "curl --fail-with-body 'https://proxy.example/native/ai/generate-image' " + String.fromCharCode(92),
    "  -H 'Authorization: Bearer example-key' " + String.fromCharCode(92),
    "  --data-binary '{\"model\":\"nai-diffusion-5-full\",\"parameters\":{}}'"
  ].join('\n');
  assert.equal(JSON.stringify(parse(example)),JSON.stringify({
    address:'https://proxy.example/native/ai/generate-image',model:'nai-diffusion-5-full'
  }));
});

test('accepts --url and escaped JSON from curl.exe',()=>{
  const example=String.raw`curl.exe --url="https://proxy.example/v1/images/generations" -X POST -d "{\"model\":\"gpt-image-1\"}"`;
  assert.equal(parse(example).model,'gpt-image-1');
});

test('preserves manual address paste and rejects GET or URLs with credentials',()=>{
  assert.equal(parse('https://proxy.example/v1'),null);
  assert.equal(parse('curl https://proxy.example/v1/models').address,undefined);
  assert.equal(parse('curl -X POST https://key@proxy.example/v1').address,undefined);
});
