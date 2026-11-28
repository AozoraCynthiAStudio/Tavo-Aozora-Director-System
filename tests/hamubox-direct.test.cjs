'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {generate,keyName}=require('../src/hamubox-direct.cjs');

test('Hamubox submits once, polls the documented endpoint and downloads without API credentials', async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const calls=[];
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX4sAAAAASUVORK5CYII=','base64');
  const responses=[
    Response.json({id:'task_1',status:'queued'}),
    Response.json({id:'task_1',status:'completed',outputs:[{url:'https://example.com/result.png'}]}),
    new Response(png)
  ];
  t.mock.method(globalThis,'fetch',async (url,options)=>{
    calls.push({url,options});
    return responses.shift();
  });
  const tavo={variable:{get:async(name,scope)=>{
    assert.equal(name,keyName);
    assert.equal(scope,'global');
    return 'test-key';
  }}};
  const promise=generate(tavo,{prompt:'A quiet studio',options:{aspectRatio:'2:3'}},async()=>{});
  await new Promise(resolve=>setImmediate(resolve));
  t.mock.timers.tick(5000);
  const result=await promise;
  assert.equal(calls.length,3);
  assert.equal(calls[0].options.method,'POST');
  assert.equal(calls[0].options.headers.Authorization,'Bearer test-key');
  assert.deepEqual(JSON.parse(calls[0].options.body),{model:'dola-seedream-5-5-ep',prompt:'A quiet studio',resolution:'1k',output_format:'png',aspect_ratio:'2:3'});
  assert.equal(calls[1].url,calls[0].url+'/task_1');
  assert.equal(calls[2].options.headers,undefined);
  assert.equal(result.directAudit.taskId,'task_1');
  assert.equal(result.data,'data:image/png;base64,'+png.toString('base64'));
});

test('Grok sends the selected Hamubox model and saves JPEG with its actual extension',async t=>{
  const {createProvider}=require('../src/provider.cjs');
  const core=require('../src/core.cjs');
  const calls=[];
  const jpg=Buffer.from([255,216,255,224,255,217]);
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    calls.push({url,options});
    if(calls.length===1)return Response.json({id:'task_grok',status:'completed',outputs:[{url:'https://example.com/grok.jpg'}]});
    return new Response(jpg);
  });
  const tavo={
    variable:{get:async()=> 'test-key'},
    file:{
      save:async(name,data,options)=>{
        assert.equal(name,'ad_image_grok.jpg');
        assert.equal(data,'data:image/jpeg;base64,'+jpg.toString('base64'));
        assert.deepEqual(options,{encoding:'dataUrl',scope:'global'});
        return 'files/global/'+name;
      },
      exists:async()=>true,
      load:async()=>jpg.toString('base64')
    }
  };
  const compiled={hamuboxDirect:true,hamuboxModel:'grok-imagine-image-2.0',prompt:'A quiet studio',options:{}};
  const result=await createProvider(tavo,core).generate(compiled,{id:'grok',filename:'ad_image_grok.png'},async()=>{});
  assert.deepEqual(JSON.parse(calls[0].options.body),{model:'grok-imagine-image-2.0',prompt:'A quiet studio',resolution:'1K'});
  assert.equal(result.pointer,'files/global/ad_image_grok.jpg');
  assert.equal(result.requestAudit.model,'grok-imagine-image-2.0');
});

test('static generation and redraw use the current Hamubox selection instead of the saved frame model',async()=>{
  const {fixture,turn,core}=require('./helpers/equipment-fixture.cjs');
  const f=fixture();
  await f.app.load();
  try{
    await f.app.saveConfig({imageService:'hamubox',format:'generic'});
    const plan={scene:'An adult woman stands by a window in warm light.',description:'她站在窗边。',characters:[{name:'曲曼',identity:'Adult woman with short black hair.',equipment:Object.fromEntries(core.Wardrobe.SLOTS.map(slot=>[slot,null]))}]};
    await turn(f,{mid:2,body:'【静态画面】她站在窗边。',plan});
    const source=(await f.app.readRecord(2)).images[0];
    assert.equal(f.compiled[0].hamuboxModel,'dola-seedream-5-5-ep');
    await f.app.saveConfig({hamuboxModel:'grok-imagine-image'});
    await f.app.generate(2,true,source.id);
    assert.equal(f.compiled[1].hamuboxModel,'grok-imagine-image');
    await f.app.saveConfig({hamuboxModel:'grok-imagine-image-2.0'});
    await turn(f,{mid:4,body:'【静态画面】她站在窗边。',plan});
    assert.equal(f.compiled[2].hamuboxModel,'grok-imagine-image-2.0');
  }finally{f.app.close();}
});

test('Seedream 1.5K sends opted-in reference images and records the settlement without image data',async t=>{
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX4sAAAAASUVORK5CYII=';
  const reference='data:image/png;base64,'+png,pointer='files/chat/ad_avatar_one.png';
  const calls=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    calls.push({url,options});
    if(calls.length===1)return Response.json({id:'task_15k',status:'completed',outputs:[{url:'https://example.com/seedream.png'}],usage:{actual_cost_usd:0.025}});
    return new Response(Buffer.from(png,'base64'));
  });
  const tavo={variable:{get:async()=> 'test-key'},file:{load:async(name,options)=>{
    assert.equal(name,pointer);assert.equal(options.encoding,'dataUrl');return reference;
  }}};
  const compiled={prompt:'A portrait by a window',hamuboxResolution:'1.5k',options:{referenceImages:[pointer]}};
  const result=await generate(tavo,compiled,async()=>{});
  const request=JSON.parse(calls[0].options.body);
  assert.equal(request.resolution,'1.5k');
  assert.deepEqual(request.images,[reference]);
  assert.equal(result.directAudit.actualCostUsd,0.025);
  assert.equal(result.directAudit.referenceCount,1);
  assert.ok(!JSON.stringify(result.directAudit).includes(reference));
});

test('Seedream binds existing registered DNA to each named person without requiring an avatar',async()=>{
  const {fixture,turn,core}=require('./helpers/equipment-fixture.cjs');
  const profiles=[
    {name:'曲曼',form:'默认形态',registrationDNA:{slots:{face:'oval face',eyes:'almond-shaped amber eyes',hair:'short black bob',extra3:'mole below her left eye'}}},
    {name:'温乔',form:'默认形态',identity:'long auburn hair, narrow gray eyes'}
  ];
  const f=fixture([],profiles);
  await f.app.load();
  try{
    await f.app.saveConfig({imageService:'hamubox',format:'generic'});
    const equipment=Object.fromEntries(core.Wardrobe.SLOTS.map(slot=>[slot,null]));
    await turn(f,{mid:2,body:'【静态画面】曲曼和温乔站在窗边。',plan:{
      scene:'A medium two-shot of 曲曼 on the viewer’s left and 温乔 on the right by a window.',
      description:'曲曼和温乔站在窗边。',
      characters:[{name:'曲曼',identity:'red hair',equipment,relation:'rests her left hand on the windowsill'},{name:'温乔',identity:'black hair',equipment}]
    }});
    const compiled=f.compiled[0];
    assert.equal(compiled.syntax,'seedream-natural-language');
    assert.match(compiled.prompt,/曲曼 — recognizable identity and physique, presented with flattering, idealized proportions and carriage: short black bob, almond-shaped amber eyes, oval face, mole below her left eye/);
    assert.match(compiled.prompt,/温乔 — recognizable identity and physique, presented with flattering, idealized proportions and carriage: long auburn hair, narrow gray eyes/);
    assert.doesNotMatch(compiled.prompt,/carriage: red hair/);
    assert.equal(compiled.options.referenceImages,undefined);
  }finally{f.app.close();}
});

test('Seedream appends the selected style exclusions to its prompt only when enabled',()=>{
  const core=require('../src/core.cjs');
  const style=require('../src/assets/styles.json').find(row=>row.id==='seedream_soft_portrait');
  const plan={scene:'A medium portrait by a window.',characters:[]};
  const config={format:'generic',imageService:'hamubox'};
  const enabled=core.compose(plan,style,config);
  const disabled=core.compose(plan,{...style,useNegative:false},config);
  assert.ok(enabled.prompt.endsWith('Avoid '+style.negative+'.'));
  assert.ok(disabled.prompt.includes(style.positive));
  assert.doesNotMatch(disabled.prompt,/extra or fused digits/);
});

test('Seedream sends the director’s designed appearance instead of duplicating the raw profile',async()=>{
  const {fixture,turn,core}=require('./helpers/equipment-fixture.cjs');
  const f=fixture([],[{name:'曲曼',form:'默认形态',identity:'tall, full-figured, short black bob'}]);
  await f.app.load();
  try{
    await f.app.saveConfig({imageService:'hamubox',format:'generic'});
    const portraitAppearance='A statuesque woman with a short black bob, balanced flowing curves, upright carriage and expressive almond-shaped eyes.';
    const equipment=Object.fromEntries(core.Wardrobe.SLOTS.map(slot=>[slot,null]));
    const {prep}=await turn(f,{mid:2,body:'【静态画面】曲曼站在窗边。',plan:{
      scene:'A full-body shot by a softly lit window.',
      description:'曲曼站在窗边。',
      characters:[{name:'曲曼',identity:'tall, full-figured, short black bob',portraitAppearance,equipment}]
    }});
    assert.match(prep.text,/Seedream 画面外形/);
    assert.ok(f.compiled[0].prompt.includes(portraitAppearance));
    assert.doesNotMatch(f.compiled[0].prompt,/tall, full-figured, short black bob/);
    assert.equal(f.app.snapshot().profiles[0].identity,'tall, full-figured, short black bob');
  }finally{f.app.close();}
});

test('Seedream synchronous transport uses the configured endpoint, size and reference payload',async t=>{
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX4sAAAAASUVORK5CYII=';
  const reference='data:image/png;base64,'+png;
  const endpoint='https://example.com/api/v3/images/generations';
  const fetch=t.mock.method(globalThis,'fetch',async()=>Response.json({data:[{b64_json:png}]}));
  const tavo={file:{load:async()=>reference}};
  const compiled={
    seedreamProtocol:'sync',seedreamConnection:{endpoint,model:'doubao-seedream-5-5-261028',key:'test-key'},
    prompt:'A portrait in a railway station',hamuboxResolution:'1.5k',options:{aspectRatio:'2:3',referenceImages:['files/chat/original.png']}
  };
  const result=await generate(tavo,compiled,async()=>{});
  assert.equal(fetch.mock.callCount(),1);
  const [url,request]=fetch.mock.calls[0].arguments;
  assert.equal(url,endpoint);
  assert.deepEqual(JSON.parse(request.body),{model:compiled.seedreamConnection.model,prompt:compiled.prompt,size:'1248x1872',response_format:'url',output_format:'png',image:[reference]});
  assert.equal(result.directAudit.method,'seedream-sync');
  assert.equal(result.data,reference);
});

test('Seedream remembers its style and provider keys independently',async()=>{
  const {fixture}=require('./helpers/equipment-fixture.cjs');
  const f=fixture();
  await f.app.load();
  try{
    await f.app.saveStyles(require('../src/assets/styles.json'));
    await f.tavo.variable.set('aozora_hamubox_key_v1','legacy-test-key','global');
    await f.app.saveConfig({imageService:'seedream',format:'generic'});
    assert.equal(f.app.snapshot().config.styleId,'seedream_soft_portrait');
    assert.equal(f.app.snapshot().config.hamuboxResolution,'1k');
    assert.equal((await f.app.seedreamConnection('async')).configured,true);
    await assert.rejects(f.app.saveSeedreamConnection('async','https://example.com/v1/image/generations','other',''),/API Key/);
    await f.app.saveSeedreamConnection(undefined,'https://example.com/api/v3','seedream-test','sync-test-key');
    assert.equal(f.app.snapshot().config.seedreamProtocol,'sync');
    assert.equal((await f.app.seedreamConnection('sync')).endpoint,'https://example.com/api/v3/images/generations');
    assert.equal((await f.app.seedreamConnection('sync')).key,undefined);
    assert.equal((await f.app.seedreamConnection('async',true)).key,'legacy-test-key');
    await f.app.saveConfig({imageService:'nai45',format:'nai45'});
    assert.equal(f.app.snapshot().config.styleId,'meekohopanes_ru_zhai');
    await f.app.saveConfig({imageService:'seedream',format:'generic'});
    assert.equal(f.app.snapshot().config.styleId,'seedream_soft_portrait');
  }finally{f.app.close();}
});

test('fresh chat defaults to NAI 4.5 and an explicitly saved Seedream choice persists',async()=>{
  const {fixture}=require('./helpers/equipment-fixture.cjs');
  const f=fixture();
  f.vars.delete('chat:1:aozora_director_v1.config');
  await f.app.load();
  try{
    const {config}=f.app.snapshot();
    assert.equal(config.imageService,'nai45');
    assert.equal(config.format,'nai45');
    assert.equal(config.seedreamRatio,'16:9');
    assert.equal(config.hamuboxResolution,'1k');
    assert.deepEqual(await f.app.seedreamConnection('async'),{endpoint:'',model:'',configured:false});
    assert.equal((await f.app.seedreamConnection('sync')).endpoint,'');
    assert.equal((await f.app.officialApiStatus()).url,'');
    for(const service of ['nai45','nai5'])for(const provider of ['official','thirdparty']){
      const {connection,relay}=await f.app.generationSettings(provider,service);
      assert.equal(connection.url,'');
      assert.equal(relay.sampler,'k_dpmpp_2m');
    }
    assert.equal((await f.app.gptImageConnection()).endpoint,'');
    assert.equal((await f.app.motionConnectionStatus()).url,'');
    await f.app.saveConfig({imageService:'seedream',format:'generic'});
    await f.app.load();
    assert.equal(f.app.snapshot().config.imageService,'seedream');
  }finally{f.app.close();}
});

test('Seedream keeps the internal portrait plan and removes an echoed appearance appendix from saved prose',async()=>{
  const {fixture,turn,core}=require('./helpers/equipment-fixture.cjs');
  const f=fixture();
  await f.app.load();
  try{
    await f.app.saveConfig({imageService:'seedream',format:'generic'});
    const portraitAppearance='A poised adult woman with an oval face and expressive eyes.';
    const entry='曲曼：A poised adult woman with an oval face and expressive eyes.';
    const body='【静态画面】曲曼站在窗边。\n\n【Seedream 画面外形】\n\n'+entry+'\n\n<qr><opt>继续</opt></qr>';
    const equipment=Object.fromEntries(core.Wardrobe.SLOTS.map(slot=>[slot,null]));
    await turn(f,{mid:2,body,plan:{scene:'A portrait by a window.',description:'曲曼站在窗边。',characters:[{name:'曲曼',identity:'adult woman, oval face',portraitAppearance,equipment}]}});
    const saved=core.storyText(f.messages.get(2).content);
    assert.doesNotMatch(saved,/Seedream 画面外形|poised adult woman/);
    assert.match(saved,/曲曼站在窗边。/);
    assert.match(saved,/<qr><opt>继续<\/opt><\/qr>/);
    assert.ok(f.compiled[0].prompt.includes(portraitAppearance));
    const quoted='~~~\n【Seedream 画面外形】\n'+entry+'\n~~~';
    const fenced=quoted.replaceAll('~~~',String.fromCharCode(96).repeat(3));
    assert.equal(core.stripSeedreamAppearanceLeak(fenced),fenced);
  }finally{f.app.close();}
});

test('GPT Image sends explicit pixel sizes and no reference images with the shared portrait prompt',async t=>{
  const core=require('../src/core.cjs');
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX4sAAAAASUVORK5CYII=';
  const fetch=t.mock.method(globalThis,'fetch',async()=>Response.json({data:[{b64_json:png}]}));
  const style=require('../src/assets/styles.json').find(s=>s.id==='seedream_soft_portrait');
  const plan={scene:'A portrait by a window.',characters:[]};
  const cfg={format:'generic',imageService:'gpt-image',gptImageRatio:'16:9'};
  const compiled=core.compose(plan,style,cfg);
  const seedream=core.compose(plan,style,{...cfg,imageService:'seedream'});
  assert.ok(compiled.prompt.includes(style.positive));
  assert.ok(seedream.prompt.includes(style.positive));
  assert.match(compiled.prompt,/skin satin-matte/);
  for(const prompt of [compiled.prompt,seedream.prompt]){
    assert.match(prompt,/Fine skin texture with light retouching and soft highlights/);
  }
  assert.doesNotMatch(seedream.prompt,/skin satin-matte/);
  const connection={endpoint:'https://example.com/v1/images/generations',model:'custom-gpt-image',key:'test-key'};
  const tavo={file:{load:async()=>{throw Error('GPT text generation must not read references');}}};
  for(const [tier,ratio,size] of [['1k','16:9','1536x864'],['1k','1:1','1024x1024'],['1k','2:3','1024x1536'],['2k','16:9','2048x1152'],['4k','16:9','3840x2160']]){
    const result=await generate(tavo,{...compiled,gptImageConnection:connection,gptImageSize:core.GPT_IMAGE_SIZES[tier][ratio],options:{referenceImages:['files/chat/original.png']}},async()=>{});
    const [endpoint,request]=fetch.mock.calls.at(-1).arguments;
    assert.equal(endpoint,connection.endpoint);
    assert.deepEqual(JSON.parse(request.body),{model:connection.model,prompt:compiled.prompt,size,n:1});
    assert.equal(result.directAudit.method,'gpt-image-direct');
  }
});

test('GPT Image and Seedream share a selected style while retaining independent connection settings',async()=>{
  const {fixture}=require('./helpers/equipment-fixture.cjs');
  const f=fixture();
  await f.app.load();
  try{
    await f.app.saveStyles(require('../src/assets/styles.json'));
    await f.app.saveConfig({imageService:'seedream',format:'generic',seedreamRatio:'1:1',hamuboxResolution:'1.5k'});
    await f.app.saveSeedreamConnection('async','https://example.com/v1/image/generations','seedream-test','seedream-key');
    await f.app.saveConfig({imageService:'gpt-image',format:'generic',gptImageRatio:'2:3',gptImageResolution:'4k'});
    assert.equal(f.app.snapshot().config.styleId,'seedream_soft_portrait');
    await f.app.saveGptImageConnection('https://example.net/v1','gpt-test','gpt-key');
    assert.deepEqual(await f.app.gptImageConnection(),{endpoint:'https://example.net/v1/images/generations',model:'gpt-test',configured:true});
    assert.equal((await f.app.seedreamConnection('async',true)).key,'seedream-key');
    await f.app.saveConfig({imageService:'seedream',format:'generic'});
    const {config}=f.app.snapshot();
    assert.equal(config.seedreamRatio,'1:1');
    assert.equal(config.hamuboxResolution,'1.5k');
    assert.equal(config.gptImageRatio,'2:3');
    assert.equal(config.gptImageResolution,'4k');
  }finally{f.app.close();}
});

test('official GPT Image addresses resolve to the canonical Images API and model-specific sizes',async()=>{
  const {fixture,core}=require('./helpers/equipment-fixture.cjs');
  const f=fixture();await f.app.load();
  try{
    await f.app.saveGptImageConnection('https://api.openai.com','gpt-image-2.6-flare','test-key');
    assert.deepEqual(await f.app.gptImageConnection(),{endpoint:core.GPT_IMAGE_OFFICIAL_ENDPOINT,model:'gpt-image-2.6-flare',configured:true});
    await f.app.saveGptImageConnection('https://api.openai.com/v1/','gpt-image-1.5','');
    assert.equal(core.gptImageSize('gpt-image-1.5','4k','16:9'),'1536x1024');
    assert.equal(core.gptImageSize('gpt-image-1-mini','2k','2:3'),'1024x1536');
    assert.equal(core.gptImageSize('gpt-image-2.6-flare','4k','2:3'),'2160x3840');
    await assert.rejects(f.app.saveGptImageConnection('https://api.openai.com/v1/chat/completions','gpt-image-2','test-key'),/官方/);
    await assert.rejects(f.app.saveGptImageConnection('https://example.com/v1','gpt-image-2',''),/API Key/);
  }finally{f.app.close();}
});

test('GPT Image content rejection keeps provider detail and offers manual routing without retry',async t=>{
  const core=require('../src/core.cjs');
  const fetch=t.mock.method(globalThis,'fetch',async()=>Response.json({error:{code:'content_policy_violation',message:'The image was rejected by the safety system.'}},{status:400}));
  const rendered=await generate({},{
    gptImageConnection:{endpoint:core.GPT_IMAGE_OFFICIAL_ENDPOINT,model:'gpt-image-2.6-flare',key:'test-key'},
    gptImageSize:'1536x864',prompt:'A railway station.'
  },async()=>{}).catch(error=>error);
  assert.equal(rendered.code,'GPT_IMAGE_CONTENT_REJECTED');
  assert.match(rendered.message,/content_policy_violation/);
  assert.match(core.Status.imageFailure(rendered).hint,/按其内容要求调整画面描述/);
  assert.equal(fetch.mock.callCount(),1);
  assert.doesNotMatch(core.Status.imageFailure({code:'invalid_api_key',statusCode:401}).hint,/Seedream/);
});

test('known Seedream provider domains select their documented endpoint and model without guessing',async()=>{
  const {fixture,core}=require('./helpers/equipment-fixture.cjs');
  const f=fixture();await f.app.load();
  try{
    for(const preset of core.IMAGE_CONNECTION_PRESETS.seedream){
      const saved=await f.app.saveSeedreamConnection(undefined,new URL(preset.url).origin,'','test-key');
      assert.equal(saved.endpoint,preset.url);
      assert.equal(saved.model,preset.model);
      assert.equal(f.app.snapshot().config.seedreamProtocol,preset.url.includes('/image/generations')?'async':'sync');
    }
    const custom=await f.app.saveSeedreamConnection(undefined,'example.com','seedream-custom','test-key');
    assert.equal(custom.endpoint,'https://example.com/v1/images/generations');
    assert.equal(f.app.snapshot().config.seedreamProtocol,'sync');
  }finally{f.app.close();}
});

test('GPT using Tavo keeps the photoreal director prompt and overrides the requested size without forwarding a model or key',async()=>{
  const {fixture,turn,core}=require('./helpers/equipment-fixture.cjs');
  const f=fixture();await f.app.load();
  try{
    await f.app.saveStyles(require('../src/assets/styles.json'));
    await f.app.saveConfig({imageService:'gpt-image',format:'generic',gptImageTransport:'tavo',gptImageResolution:'2k',gptImageRatio:'16:9'});
    const equipment=Object.fromEntries(core.Wardrobe.SLOTS.map(slot=>[slot,null]));
    await turn(f,{mid:2,body:'【静态画面】曲曼站在窗边。',plan:{scene:'Medium shot by a window.',description:'曲曼站在窗边。',characters:[{name:'曲曼',identity:'adult woman, oval face',equipment}]}});
    const compiled=f.compiled[0];
    assert.equal(compiled.gptImageViaTavo,true);
    assert.equal(compiled.gptImageConnection,undefined);
    assert.equal(compiled.hamuboxDirect,undefined);
    assert.equal(compiled.syntax,'seedream-natural-language');
    assert.equal(compiled.options.size,'2048x1152');
    assert.deepEqual(compiled.options.extraBody,{size:'2048x1152'});
    assert.equal(compiled.options.aspectRatio,undefined);
    assert.match(compiled.prompt,/Idealized photorealism/);
  }finally{f.app.close();}
});

test('Seedream using Tavo keeps the photoreal director prompt and overrides the requested size without forwarding a model or key',async()=>{
  const {fixture,turn,core}=require('./helpers/equipment-fixture.cjs');
  const f=fixture();await f.app.load();
  try{
    await f.app.saveStyles(require('../src/assets/styles.json'));
    await f.app.saveConfig({imageService:'seedream',format:'generic',seedreamTransport:'tavo',hamuboxResolution:'2k',seedreamRatio:'16:9'});
    const equipment=Object.fromEntries(core.Wardrobe.SLOTS.map(slot=>[slot,null]));
    await turn(f,{mid:2,body:'【静态画面】曲曼站在窗边。',plan:{scene:'Medium shot by a window.',description:'曲曼站在窗边。',characters:[{name:'曲曼',identity:'adult woman, oval face',equipment}]}});
    const compiled=f.compiled[0];
    assert.equal(compiled.seedreamViaTavo,true);
    assert.equal(compiled.seedreamConnection,undefined);
    assert.equal(compiled.hamuboxDirect,undefined);
    assert.equal(compiled.syntax,'seedream-natural-language');
    assert.equal(compiled.options.size,'2816x1584');
    assert.deepEqual(compiled.options.extraBody,{size:'2816x1584'});
    assert.equal(compiled.options.aspectRatio,undefined);
    assert.match(compiled.prompt,/Idealized photorealism/);
  }finally{f.app.close();}
});

test('Seedream preserves named body anchors in a torso shot without adding them to GPT or hands-only shots',()=>{
  const core=require('../src/core.cjs');
  const style=require('../src/assets/styles.json').find(s=>s.id==='seedream_soft_portrait');
  const equipment=Object.fromEntries(core.Wardrobe.SLOTS.map(slot=>[slot,null]));
  const person={name:'曲曼',identity:'adult woman, softly curvy build, full bust',portraitAppearance:'An elegant woman with a poised silhouette.',equipment};
  const seedream={format:'generic',imageService:'seedream'};
  const plan={scene:'Medium close-up, waist-up framing. 曲曼 stands by a window.',characters:[person]};
  const prompt=core.compose(plan,style,seedream).prompt;
  assert.match(prompt,/曲曼’s visible proportions faithful to these established traits: softly curvy build, full bust/);
  assert.doesNotMatch(core.compose(plan,style,{...seedream,imageService:'gpt-image'}).prompt,/visible proportions faithful/);
  assert.doesNotMatch(core.compose({...plan,scene:'Extreme close-up of her hands only.'},style,seedream).prompt,/visible proportions faithful/);
});

test('switching from NAI to GPT redraws from the existing plan with the current model and style',async()=>{
  const {fixture,turn,core}=require('./helpers/equipment-fixture.cjs');
  const f=fixture();
  await f.app.load();
  try{
    await f.app.saveStyles(require('../src/assets/styles.json'));
    await f.app.saveConfig({imageService:'generic',format:'nai45'});
    const equipment=Object.fromEntries(core.Wardrobe.SLOTS.map(slot=>[slot,null]));
    await turn(f,{mid:2,body:'她站在窗边。',plan:{
      scene:'Medium close-up, waist-up framing, 1girl by a window',
      description:'她站在窗边。',
      characters:[{name:'曲曼',identity:'adult woman, short black bob, amber eyes',equipment}]
    }});
    const original=(await f.app.readRecord(2)).images[0];
    await f.app.saveConfig({imageService:'gpt-image',format:'generic',gptImageTransport:'tavo'});
    await f.app.generate(2,true,original.id);
    const compiled=f.compiled.at(-1);
    assert.equal(compiled.gptImageViaTavo,true);
    assert.equal(compiled.syntax,'seedream-natural-language');
    assert.match(compiled.prompt,/short black bob, amber eyes/);
    assert.match(compiled.prompt,/Idealized photorealism/);
    assert.doesNotMatch(compiled.prompt,/artist:|\b1girl\b/);
  }finally{f.app.close();}
});

test('GPT Image edit uploads the selected original to the explicit JSON edit endpoint',async t=>{
  const endpoint='https://relay.example/v1/images/edits';
  const input='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX4sAAAAASUVORK5CYII=';
  let sent;
  t.mock.method(global,'fetch',async(url,options)=>{
    assert.equal(url,endpoint);
    sent=JSON.parse(options.body);
    return Response.json({data:[{b64_json:input.split(',')[1]}]});
  });
  const tavo={file:{load:async(pointer,options)=>{assert.equal(pointer,'files/chat/original.png');assert.equal(options.encoding,'dataUrl');return input;}}};
  const spec={gptImageConnection:{endpoint,key:'fixture-edit-key',model:'gpt-image-2.5-sunburst'},gptImageEdit:true,gptImageSize:'1024x1024',prompt:'Make the mug blue.',options:{referenceImages:['files/chat/original.png']}};
  const result=await generate(tavo,spec,async()=>{});
  assert.deepEqual(sent.images,[{image_url:input}]);
  assert.equal(sent.model,spec.gptImageConnection.model);
  assert.equal(result.directAudit.referenceCount,1);
});
