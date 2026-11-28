'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Official=require('../src/official-direct.cjs');
const {fixture,turn,core}=require('./helpers/equipment-fixture.cjs');

test('V5 Full uses separate static credentials and sends a version 4 request with two character captions',async()=>{
  const f=fixture();
  await f.app.load();
  try{
    await f.app.saveStyles(require('../src/assets/styles.json'));
    await f.app.saveConfig({imageService:'nai5',format:'nai45'});
    assert.deepEqual(f.app.availableStyles().map(style=>style.id),['nai5_signature_cg','nai5_soft_gradient_anime']);
    assert.equal(f.app.snapshot().config.styleId,'nai5_signature_cg');
    await f.app.saveConfig({styleId:''});
    await assert.rejects(f.app.saveConfig({styleId:'meekohopanes_ru_zhai'}),/不适用于/);
    const endpoint='https://relay.example/native/ai/generate-image';
    const relay=(await f.app.generationSettings()).relay;
    await f.app.saveGenerationSettings(relay,'test-relay-key',endpoint,'thirdparty');
    const connection=(await f.app.generationSettings()).connection;
    assert.equal(connection.url,endpoint);
    assert.equal((await f.app.generationSettings(undefined,'nai45')).connection.configured,false);
    const equipment=Object.fromEntries(core.Wardrobe.SLOTS.map(slot=>[slot,null]));
    await turn(f,{mid:2,body:'【静态画面】两人站在窗边。',plan:{
      scene:'Two friends stand by the window. The woman on the left waves to the man on the right.',
      description:'两人站在窗边。',
      characters:[{name:'曲曼',identity:'1girl, black hair',equipment},{name:'叶清',identity:'1boy, silver hair',equipment}]
    }});
    const compiled=f.compiled[0];
    assert.equal(compiled.syntax,'nai5-pipe');
    assert.equal(compiled.budgetAudit.target,1471);
    assert.equal(compiled.budgetAudit.overBudget,false);
    assert.equal(compiled.staticDirect,true);
    assert.equal(compiled.directProvider,'thirdparty');
    const body=Official.staticRequestBody(compiled,compiled.directSettings);
    assert.equal(Official.applyNativeNaiCaptions(body,compiled),true);
    assert.equal(body.model,'nai-diffusion-5-full');
    assert.equal(body.action,'generate');
    assert.equal(body.parameters.params_version,4);
    assert.equal(body.parameters.image,undefined);
    assert.equal(body.input,body.parameters.v4_prompt.caption.base_caption);
    assert.match(body.input,/window/i);
    assert.doesNotMatch(body.input,/artist:|game cg/i);
    assert.equal(compiled.options.negativePrompt,undefined);
    assert.equal(body.parameters.v4_prompt.caption.char_captions.length,2);
    assert.equal(body.parameters.v4_negative_prompt.caption.char_captions.length,2);
    assert.equal(core.supportsNaiImageEdit({config:{imageService:'nai5',format:'nai45'}},{imageService:'nai45',format:'nai45'}),false);
  }finally{f.app.close();}
});

test('following Tavo keeps V5 prompt rules and needs no plugin API credentials',async()=>{
  const f=fixture();
  await f.app.load();
  try{
    await f.app.saveStyles(require('../src/assets/styles.json'));
    await f.app.saveConfig({imageService:'nai5',format:'nai45',nai5Transport:'tavo'});
    await turn(f,{mid:2,body:'【静态画面】窗边站着一位旅者。',plan:{
      scene:'A traveler stands beside a window.',
      description:'窗边站着一位旅者。',characters:[]
    }});
    const compiled=f.compiled[0];
    assert.equal(compiled.syntax,'nai5-pipe');
    assert.equal(compiled.officialDirect,undefined);
    assert.equal(compiled.options.model,undefined);
  }finally{f.app.close();}
});

test('V5 resolves documented base addresses and retains character captions in each request format',()=>{
  const transport=require('../src/api-transport.cjs');
  const base=transport.nai5Route('https://ynai.rinko.ai/native');
  assert.deepEqual(base,{kind:'native',url:'https://ynai.rinko.ai/native/ai/generate-image'});
  assert.equal(transport.nai5Route('https://api.hamubox.com/v1/novelai').kind,'native');
  assert.equal(transport.nai5Route('https://ynai.rinko.ai/v1/nai/generate-image').kind,'native-json');
  assert.throws(()=>transport.nai5Route('https://other.example/v1/tasks'),/任务接口/);
  const payload={model:'nai-diffusion-5-full',input:'Two travelers.',action:'generate',parameters:{params_version:4,width:832,height:1216,v4_prompt:{caption:{char_captions:[{char_caption:'black hair'}]}}}};
  const task=transport.nai5Route('https://api.hamubox.com/v1/novelai/tasks');
  assert.deepEqual(transport.body(payload,task.kind,task.url),{model:payload.model,operation:'generation',payload});
  const images=transport.nai5Route('https://api.hamubox.com/v1');
  assert.equal(images.kind,'openai');
  assert.equal(transport.body(payload,images.kind,images.url).nai,payload.parameters);
});

test('V5 task generation queries the task and downloads the image without forwarding the API key',async()=>{
  const url='https://api.hamubox.com/v1/novelai/tasks';
  const imageUrl='https://cdn.example/result.png';
  const bytes=Buffer.from('89504e470d0a1a0a0000000d4948445200000340000004c0','hex');
  const realFetch=global.fetch,realTimer=global.setTimeout;
  const calls=[];
  global.setTimeout=(callback,delay,...args)=>realTimer(callback,delay===5000?0:delay,...args);
  global.fetch=async(address,options)=>{
    calls.push([address,options]);
    if(address===url)return Response.json({id:'task_one',status:'queued'});
    if(address===url+'/task_one')return Response.json({id:'task_one',status:'completed',result:{images:[{url:imageUrl}]}});
    if(address===imageUrl)return new Response(bytes);
    throw Error('Unexpected URL');
  };
  try{
    const tavo={
      variable:{get:async()=>({provider:'thirdparty',thirdParty:{url,apiKey:'example-token'}})},
      file:{save:async()=>({path:'files/chat/result.png'})}
    };
    const result=await Official.generate(tavo,{syntax:'nai5-pipe',format:'nai45',staticDirect:true,prompt:'Two travelers.',options:{}},{id:'job-one'},async()=>{});
    assert.equal(result.directAudit.taskId,'task_one');
    assert.equal(calls.length,3);
    assert.equal(JSON.parse(calls[0][1].body).payload.parameters.params_version,4);
    assert.equal(calls[1][1].headers.Authorization,'Bearer example-token');
    assert.equal(calls[2][1].headers,undefined);
  }finally{global.fetch=realFetch;global.setTimeout=realTimer;}
});

test('Seed favorites follow the source service, and switching services clears the fixed Seed',async()=>{
  const f=fixture();
  await f.app.load();
  try{
    await f.app.saveConfig({imageService:'nai45',format:'nai45',seedFixed:true,seedValue:'42'});
    await f.app.favorite({seed:42},'4.5 note');
    await f.app.saveConfig({imageService:'nai5',format:'nai45'});
    assert.equal(f.app.snapshot().config.seedFixed,false);
    assert.equal(f.app.snapshot().config.seedValue,'');
    await f.app.favorite({seed:42,config:{imageService:'nai5'}},'5 note');
    await f.app.favorite({seed:42,config:{imageService:'nai45'}},'Updated 4.5 note');
    await f.app.load();
    assert.deepEqual(f.app.snapshot().favorites.map(({service,seed,note})=>[service,seed,note]),[
      ['nai45','42','Updated 4.5 note'],['nai5','42','5 note']
    ]);
    assert.equal(core.favoriteSeedService({model:'NAI 4.5 Full'}),'nai45');
    assert.equal(core.favoriteSeedService({model:'nai-diffusion-5-full'}),'nai5');
  }finally{f.app.close();}
});

test('NAI 5 designs registered faces once, even when suggestions overlap, and keeps them out of NAI 4.5',async()=>{
  const profiles=[
    {name:'Alice',form:'默认形态',identity:'adult woman, brown eyes, black hair'},
    {name:'Bea',form:'默认形态',identity:'adult woman, brown eyes, brown hair'},
    {name:'Cara',form:'默认形态',identity:'adult woman, blue eyes, blond hair'}
  ];
  const f=fixture([],profiles);
  await f.app.load();
  try{
    await f.app.saveConfig({imageService:'nai5',format:'nai45',nai5Transport:'tavo'});
    let designs=0;
    f.tavo.generate=async prompt=>{
      assert.match(prompt,/参考所有已登记人物/);
      assert.match(prompt,/"name":"Cara"/);
      designs++;
      return '```json\n{"faceJaw":"a soft square jawline"}\n```';
    };
    const plan={scene:'Two women stand side by side at a window.',description:'两人并排站在窗边。',characters:profiles.slice(0,2).map(p=>({...p,equipment:Object.fromEntries(core.Wardrobe.SLOTS.map(slot=>[slot,null]))}))};
    await turn(f,{mid:2,body:'【静态画面】两人站在窗边。',plan});
    assert.equal(f.calls,1);
    assert.equal(designs,2);
    assert.deepEqual(f.compiled[0].sections.characters.map(c=>c.identity.includes('a soft square jawline')),[true,true]);
    const image=(await f.app.readRecord(2)).images[0];
    assert.equal(image.plan.characters[0].nai5Face.faceJaw,'a soft square jawline');
    await f.app.load();
    assert.equal(f.app.snapshot().profiles[0].nai5Face.faceJaw,'a soft square jawline');
    await turn(f,{mid:4,body:'【静态画面】两人仍然站在窗边。',plan});
    assert.equal(designs,2);
    const v45=core.compose(image.plan,{}, {imageService:'nai45',format:'nai45'});
    assert.doesNotMatch(v45.prompt,/soft square jawline/);
    const hidden=core.compose({...image.plan,scene:'hands only, two hands rest on the table'},{},{imageService:'nai5',format:'nai45'});
    assert.doesNotMatch(hidden.prompt,/soft square jawline/);
  }finally{f.app.close();}
});

test('cross-service redraw adapts scene wording in all directions and retains the original plan',async()=>{
  const services=[['nai45','nai45'],['nai5','nai45'],['generic','generic'],['gpt-image','generic'],['seedream','generic']];
  const configure=(f,imageService,format)=>f.app.saveConfig({imageService,format,naiTransport:'tavo',nai5Transport:'tavo',gptImageTransport:'tavo',seedreamTransport:'tavo'});
  for(const [sourceService,sourceFormat] of services){
    const f=fixture();await f.app.load();
    try{
      await configure(f,sourceService,sourceFormat);
      await turn(f,{mid:2,body:'窗边的两个人接过杯子。',plan:{scene:'medium close-up, two people pass a cup by the window',characters:[]}});
      const original=(await f.app.readRecord(2)).images[0],message=structuredClone(f.messages.get(2));
      let calls=0,targetService;
      f.tavo.generate=async prompt=>{
        calls++;
        assert.ok(prompt.includes('"sourceService":"'+sourceService+'"'));
        assert.ok(prompt.includes('"targetService":"'+targetService+'"'));
        assert.doesNotMatch(prompt,/窗边的两个人接过杯子/);
        return JSON.stringify({scene:'medium close-up, one person hands a cup to the other by the window'});
      };
      for(const [target,format] of services){
        if(target===sourceService)continue;
        targetService=target;
        await configure(f,target,format);
        const converted=(await f.app.generate(2,true,original.id)).images.at(-1);
        assert.equal(converted.languageAudit.redrawAdaptation.status,'converted');
        assert.equal(converted.config.imageService,target);
        assert.deepEqual(converted.plan,original.plan);
        assert.match(converted.prompt,/hands a cup/);
        const repeated=(await f.app.generate(2,true,converted.id,null,'replace')).images.at(-1);
        assert.equal(repeated.languageAudit.redrawAdaptation.status,'reused');
        assert.match(repeated.prompt,/hands a cup/);
      }
      assert.equal(calls,4);
      await configure(f,sourceService,sourceFormat);
      await f.app.generate(2,true,original.id);
      assert.equal(calls,4);
      assert.deepEqual(f.messages.get(2),message);
    }finally{f.app.close();}
  }
});

test('an adaptation that changes the framing falls back without stopping cross-service redraw',async()=>{
  const f=fixture();await f.app.load();
  try{
    await f.app.saveConfig({imageService:'nai45',format:'nai45',naiTransport:'tavo'});
    await turn(f,{mid:2,body:'她在窗边。',plan:{scene:'medium close-up, a woman by the window',characters:[]}});
    const original=(await f.app.readRecord(2)).images[0];
    await f.app.saveConfig({imageService:'nai5',format:'nai45',nai5Transport:'tavo'});
    f.tavo.generate=async()=>JSON.stringify({scene:'wide shot, a woman by the window'});
    const result=(await f.app.generate(2,true,original.id,null,'replace')).images.at(-1);
    assert.equal(result.languageAudit.redrawAdaptation.status,'fallback');
    assert.match(result.prompt,/medium close-up/);
    assert.equal(result.syntax,'nai5-pipe');
  }finally{f.app.close();}
});

test('V5 director selects natural-language action rules and only compresses when its own budget is exceeded',()=>{
  const rules=require('../src/assets/director-rules.json');
  const v5={imageService:'nai5',format:'nai45'};
  const instruction=core.buildInstruction({kind:'story_cg',config:v5},rules);
  assert.match(instruction,/逐人写清姿势、朝向、动作、对象/);
  assert.doesNotMatch(instruction,/【NAI 4.5格式】/);
  const equipment=Object.fromEntries(core.Wardrobe.SLOTS.map(slot=>[slot,null]));
  const actor={name:'Alice',identity:'girl, adult woman, black hair',equipment,nai5Face:{faceJaw:'rounded chin'}};
  const plan={scene:'medium close-up, a woman sits beside the window',characters:[actor]};
  const style={format:'nai5',positive:'5::game cg::'};
  const normal=core.compose(plan,style,v5);
  assert.equal(core.frameCompressionPrompt(normal,style),'');
  assert.equal(normal.budgetAudit.target,1471);
  const long=core.compose({...plan,characters:[{...actor,identity:actor.identity+', '+('highly refined presentation '.repeat(260))}]},style,v5);
  assert.equal(long.budgetAudit.overBudget,true);
  assert.ok(core.frameCompressionPrompt(long,style));
  const compact=core.applyFrameCompression(long,style,JSON.stringify({characters:[{index:0,identity:'adult woman, black hair, rounded chin',outfit:''}]}),'test');
  assert.equal(compact.budgetAudit.overBudget,false);
  assert.equal(compact.sections.base,long.sections.base);
  assert.match(compact.prompt,/rounded chin/);
  assert.equal(compact.renderAudit.frameCompression.status,'applied');
});

test('V5 still submits and records a warning when its protected base exceeds the estimate',async()=>{
  const f=fixture();await f.app.load();
  try{
    await f.app.saveConfig({imageService:'nai5',format:'nai45',nai5Transport:'tavo'});
    const longStyle={id:'long-v5',name:'Long',format:'nai5',positive:'game cg, '+'refined visual presentation '.repeat(300)};
    await f.app.saveStyles([longStyle]);
    await f.app.saveConfig({styleId:longStyle.id});
    await turn(f,{mid:2,body:'灯下空无一人。',plan:{scene:'An empty shop under a warm lamp.',characters:[]}});
    const record=await f.app.readRecord(2);
    assert.equal(record.status,'done');
    assert.equal(record.images[0].budgetAudit.submittedDespiteOverBudget,true);
    assert.match(record.warning,/估算超过 1471/);
  }finally{f.app.close();}
});

test('Seedream dynamic uses its independent API and replays with the original reference and prompt',async()=>{
  const f=fixture();await f.app.load();
  try{
    await f.app.saveConfig({imageService:'seedream',format:'generic',seedreamTransport:'tavo'});
    await turn(f,{mid:2,body:'她站在窗边。',plan:{scene:'A woman stands by the window.',characters:[]}});
    const source=(await f.app.readRecord(2)).images[0];
    await f.app.saveReferenceEditConnection('seedream','https://api.hamubox.com/v1/image/generations','dola-seedream-5-5-ep','fixture-edit-key');
    let calls=0;
    f.tavo.generate=async()=>{calls++;return JSON.stringify({scene:'A woman raises a cup by the window.'});};
    await f.app.animate(2,source.id,'举起杯子');
    const frame=(await f.app.readRecord(2)).images.at(-1);
    assert.equal(frame.motion.sourcePointer,source.pointer);
    assert.equal(f.compiled.at(-1).seedreamProtocol,'async');
    assert.equal(f.compiled.at(-1).hamuboxDirect,true);
    assert.deepEqual(f.compiled.at(-1).options.referenceImages,[source.pointer]);
    await f.app.repeatMotion(2,frame.id,'replace');
    assert.equal(calls,1);
    assert.equal(f.compiled.at(-1).prompt,frame.prompt);
    assert.deepEqual(f.compiled.at(-1).options.referenceImages,[source.pointer]);
    assert.equal(f.app.snapshot().config.seedreamTransport,'tavo');
  }finally{f.app.close();}
});

test('HamuBox V5 edit sends img2img with input and character captions, and redacts the source from the audit',async()=>{
  const url='https://api.hamubox.com/v1/novelai/tasks',cdn='https://cdn.example/result.png';
  const bytes=Buffer.from('89504e470d0a1a0a0000000d4948445200000340000004c0','hex');
  const input=bytes.toString('base64'),realFetch=global.fetch;
  let sent;
  global.fetch=async(address,options)=>{
    if(address===url){sent=JSON.parse(options.body);return Response.json({id:'task_one',status:'completed',result:{images:[{url:cdn}]}});}
    assert.equal(address,cdn);
    assert.equal(options.headers,undefined);
    return new Response(bytes);
  };
  try{
    const tavo={file:{load:async()=>input,save:async()=>({path:'files/chat/result.png'})}};
    const spec={syntax:'nai5-pipe',format:'nai45',staticDirect:true,nai5EditConnection:{endpoint:url,key:'fixture-edit-key'},prompt:'Scene | girl',sections:{base:'Scene',characters:[{prompt:'girl'}]},options:{referenceImages:['files/chat/source.png']}};
    const result=await Official.generate(tavo,spec,{id:'job-edit'},async()=>{});
    assert.equal(sent.payload.action,'img2img');
    assert.equal(sent.payload.model,'nai-diffusion-5-full');
    assert.equal(sent.payload.parameters.params_version,4);
    assert.equal(sent.payload.parameters.image,input);
    assert.equal(sent.payload.parameters.v4_prompt.caption.char_captions[0].char_caption,'girl');
    assert.equal(result.directAudit.wireAudit.imagePayloadIncluded,true);
    assert.equal(result.directAudit.wireAudit.body.payload.parameters.image,undefined);
  }finally{global.fetch=realFetch;}
});

test('V5 preserves established facial features in wide shots without a fixed global face cue',()=>{
  const gear=Object.fromEntries(core.Wardrobe.SLOTS.map(slot=>[slot,null]));
  const characters=['Alice','Bea','Cara'].map(name=>({name,identity:'adult woman, brown eyes',equipment:gear,nai5Face:{faceJaw:'rounded chin'}}));
  const v5={imageService:'nai5',format:'nai45'},v45={imageService:'nai45',format:'nai45'};
  const cue=/Keep visible faces clearly drawn at this framing/;
  for(const scene of ['wide shot, three women at a window','full-body shot, three women standing by a sofa','medium close-up, three women beside a sofa']){
    const result=core.compose({scene,characters},{},v5);
    assert.doesNotMatch(result.sections.base,cue);
    assert.match(result.sections.characters[0].identity,/rounded chin/);
    assert.doesNotMatch(result.renderedScene,cue);
    assert.equal(result.sections.characters.length,3);
  }
  for(const scene of ['full-body shot, three women seen from behind','hands only, three people at a table']){
    assert.doesNotMatch(core.compose({scene,characters},{},v5).prompt,cue);
  }
  assert.doesNotMatch(core.compose({scene:'medium close-up, two women',characters:characters.slice(0,2)},{},v5).prompt,cue);
  assert.doesNotMatch(core.compose({scene:'wide shot, three women',characters},{},v45).prompt,cue);
});

test('V5 tuning recovers legacy JSON appearance, edits each face and leaves the source and profiles intact',async()=>{
  const f=fixture();await f.app.load();
  try{
    await f.app.saveConfig({imageService:'nai5',format:'nai45',nai5Transport:'tavo'});
    const gear=Object.fromEntries(core.Wardrobe.SLOTS.map(slot=>[slot,null]));
    const slots=[
      {typeAge:'adult woman',hair:'black hair',eyes:'narrow eyes with smoky eyeshadow',face:'oval face with deep red lips'},
      {typeAge:'adult woman',hair:'wavy brown hair',eyes:'peach-blossom eyes',face:'round face with bright lipstick'}
    ];
    const plan={scene:'full-body shot, two women sit on a sofa, the woman on the left wears smoky eyeshadow',characters:slots.map((s,i)=>({name:['Alice','Bea'][i],identity:JSON.stringify(s),equipment:gear}))};
    await turn(f,{mid:2,body:'两人并排坐在沙发上。',plan});
    const original=(await f.app.readRecord(2)).images[0];
    assert.doesNotMatch(original.prompt,/"typeAge"/);
    await f.store.mutateRecord(2,r=>({...r,images:r.images.map(image=>({...image,plan:{...image.plan,characters:image.plan.characters.map(({registrationDNA,...actor},i)=>({...actor,identity:JSON.stringify(slots[i])}))}}))}));
    f.tavo.generate=async prompt=>{
      assert.match(prompt,/必须提交更新后的 Scene/);
      return JSON.stringify({scene:'full-body shot, two women sit side by side on a sofa',dnaChanges:[
        {index:0,slots:{eyes:'narrow eyes with soft brown eyeshadow',face:'oval face with soft rose lips'}},
        {index:1,slots:{face:'round face with natural pink lips'}}
      ]});
    };
    await f.app.tune(2,original.id,'两人改为日常淡妆');
    const record=await f.app.readRecord(2),edited=record.images.at(-1);
    assert.equal(record.images.length,2);
    assert.match(record.images[0].plan.characters[0].identity,/smoky eyeshadow/);
    assert.match(edited.sections.characters[0].prompt,/black hair.*soft brown eyeshadow.*soft rose lips/);
    assert.match(edited.sections.characters[1].prompt,/wavy brown hair.*peach-blossom eyes.*natural pink lips/);
    assert.doesNotMatch(edited.prompt,/"typeAge"|smoky eyeshadow|bright lipstick/);
    assert.deepEqual(f.app.snapshot().profiles,[]);
  }finally{f.app.close();}
});

test('V5 has independent edit parameters and an empty unsaved endpoint',async()=>{
  const f=fixture();await f.app.load();
  try{
    await f.app.saveConfig({imageService:'nai5',format:'nai45',nai5Transport:'tavo'});
    const before=await f.app.referenceEditConnection('nai5');
    assert.equal(before.endpoint,'');
    assert.deepEqual(before.parameters,{strength:0.85,noise:0,noiseSchedule:'karras'});
    const endpoint='https://api.hamubox.com/v1/novelai/tasks';
    await f.app.saveReferenceEditConnection('nai5',endpoint,'','fixture-edit-key',{strength:0.6,noise:0.12,noiseSchedule:'exponential'});
    await f.app.saveReferenceEditConnection('nai5',endpoint,'','');
    assert.deepEqual((await f.app.referenceEditConnection('nai5')).parameters,{strength:0.6,noise:0.12,noiseSchedule:'exponential'});
    await turn(f,{mid:2,body:'她站在窗边。',plan:{scene:'A woman stands by the window.',characters:[]}});
    const source=(await f.app.readRecord(2)).images[0];
    f.tavo.generate=async()=>JSON.stringify({scene:'A woman raises a cup by the window.'});
    await f.app.tune(2,source.id,'举起杯子',{method:'img2img'});
    const compiled=f.compiled.at(-1);
    assert.equal(compiled.nai5EditConnection.endpoint,endpoint);
    assert.equal(compiled.directSettings.strength,0.6);
    assert.equal(compiled.directSettings.noise,0.12);
    assert.equal(compiled.directSettings.noiseSchedule,'exponential');
    assert.equal((await f.app.generationSettings(undefined,'nai5')).relay.noiseSchedule,'karras');
  }finally{f.app.close();}
});

test('Reset restores built-in styles across services and preserves custom styles',async()=>{
  const shipped=require('../src/assets/styles.json');
  const defaults=shipped.filter(style=>style.format==='nai5');
  const [clear,anime]=defaults;
  const custom={...anime,id:'copied-anime',name:'我的复制画风'};
  const f=fixture([],[],shipped);
  await f.app.load();
  try{
    await f.app.saveConfig({imageService:'nai5',format:'nai45'});
    assert.equal(f.app.snapshot().config.styleId,clear.id);
    await f.app.saveStyles([...f.app.snapshot().styles.map(style=>
      style.id===clear.id?{...style,positive:'edited',useNegative:false}:style
    ),custom]);
    await f.app.deleteStyle(anime.id);
    await f.app.deleteStyle('seedream_soft_portrait');
    await f.app.deleteStyle('generic_quality');
    await f.app.load();
    assert.equal(f.app.availableStyles().some(style=>style.id===anime.id),false);
    await f.app.restoreDefaultStyles();
    assert.deepEqual(f.app.availableStyles(),[clear,anime,custom]);
    assert.deepEqual(f.app.snapshot().styles,[...shipped,custom]);
    assert.equal(f.app.snapshot().config.styleId,clear.id);
    for(const imageService of ['seedream','gpt-image']){
      await f.app.saveConfig({imageService,format:'generic'});
      assert.equal(f.app.snapshot().config.styleId,'seedream_soft_portrait');
      assert.ok(f.app.availableStyles().some(style=>style.id==='seedream_soft_portrait'));
    }
  }finally{f.app.close();}
});
