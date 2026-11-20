'use strict';
const crypto=require('crypto');
// Keep the fragment self-contained: each bitmap occurs once, with CSS/HTML/JS sharing it.
module.exports=function deduplicatePanel(panel){
 const catalog={},keys=new Map();
 panel=panel.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g,uri=>{let key=keys.get(uri);if(!key){key='asset-'+crypto.createHash('sha256').update(uri).digest('hex').slice(0,16);keys.set(uri,key);catalog[key]=uri;}return '__AD_SHARED_'+key+'__';});
 panel=panel.replace(/url\((["']?)(__AD_SHARED_(asset-[a-f0-9]+)__)\1\)/g,(_,q,token,key)=>'var(--ad-'+key+')');
 panel=panel.replace(/\bsrc=(["'])__AD_SHARED_(asset-[a-f0-9]+)__\1/g,(_,q,key)=>'data-ad-shared-asset="'+key+'"');
 panel=panel.replace(/(["'])__AD_SHARED_(asset-[a-f0-9]+)__\1/g,(_,q,key)=>'window.ADirectorUiAssets['+JSON.stringify(key)+']');
 if(panel.includes('__AD_SHARED_'))throw Error('Unresolved shared image placeholder');
 const bootstrap='(function(){const assets='+JSON.stringify(catalog)+';const previous=window.ADirectorUiAssetUrls||[],urls=[];for(const [key,uri] of Object.entries(assets)){if(uri.length>1000000){const comma=uri.indexOf(","),binary=atob(uri.slice(comma+1)),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);assets[key]=URL.createObjectURL(new Blob([bytes],{type:uri.slice(5,uri.indexOf(";"))}));urls.push(assets[key]);}}window.ADirectorUiAssets=assets;window.ADirectorUiAssetUrls=urls;for(const url of previous)URL.revokeObjectURL(url);for(const [key,uri] of Object.entries(assets))document.documentElement.style.setProperty("--ad-"+key,\'url("\'+uri+\'")\');for(const img of document.querySelectorAll("[data-ad-shared-asset]"))img.src=assets[img.dataset.adSharedAsset];})();';
 return panel.replace('<script>','<script>'+bootstrap+'</script>\n<script>');
};
