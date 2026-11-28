const fs=require('fs'),path=require('path');
exports.read=(root,p)=>{
 let s=fs.readFileSync(path.join(root,p),'utf8');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'src/assets/ui-assets.json'),'utf8'));
 function asset(logical){const actual=manifest[logical]||logical,ext=path.extname(actual).toLowerCase();const type=ext==='.svg'?'svg+xml':ext==='.jpg'||ext==='.jpeg'?'jpeg':ext==='.webp'?'webp':'png';return 'data:image/'+type+';base64,'+fs.readFileSync(path.join(root,actual)).toString('base64');}
 if(p==='src/ui/controller.js'){
  const ids={meekohopanes_ru_zhai:'east',mignon_allenes:'acg',kittew:'westtoon',meekohopanes:'westreal'},covers={};
  for(const[id,key]of Object.entries(ids))covers[id]=asset('src/assets/style-cover-'+key+'.jpg');
  covers.generic_quality=asset('src/assets/style-cover-generic.svg');
  covers.seedream_soft_portrait=asset('src/assets/style-cover-seedream.jpg');
  covers.nai5_signature_cg=asset('src/assets/style-cover-nai5-clear-cg-v183.jpg');
  covers.nai5_soft_gradient_anime=asset('src/assets/style-cover-nai5-soft-gradient-anime.jpg');
  s=s.replace('__AD_STUDIO_DEFAULTS__',fs.readFileSync(path.join(root,'src/assets/styles.json'),'utf8')).replace('__AD_STUDIO_COVERS__',JSON.stringify(covers));
 }
 if(p.startsWith('src/ui/')&&p.endsWith('.css'))for(const [prefix,folder]of [['PHANTOM','phantom'],['WORKBENCH','workbench']]){
  s=s.replace(new RegExp('__'+prefix+'_([a-zA-Z0-9.-]+)__','g'),(_,name)=>asset('src/assets/'+folder+'/'+name));
 }
 return s;
};
