window.ADirectorMotionExport={
  async encode(sources,duration){
    const images=await Promise.all(sources.map(async src=>{
      const image=new Image();
      image.src=src;
      await image.decode();
      return image;
    }));
    const canvas=document.createElement('canvas');
    canvas.width=images[1].naturalWidth;
    canvas.height=images[1].naturalHeight;
    const context=canvas.getContext('2d',{alpha:false,willReadFrequently:true});
    const {GIFEncoder,quantize,applyPalette}=window.ADirectorGif;
    const gif=GIFEncoder();
    async function frame(opacity,delay){
      context.globalAlpha=1;
      context.drawImage(images[0],0,0,canvas.width,canvas.height);
      context.globalAlpha=opacity;
      context.drawImage(images[1],0,0,canvas.width,canvas.height);
      const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
      const palette=quantize(pixels,256);
      gif.writeFrame(applyPalette(pixels,palette),canvas.width,canvas.height,{palette,delay,repeat:0});
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    function ease(x){
      let low=0,high=1;
      for(let i=0;i<14;i++){
        const t=(low+high)/2;
        const px=3*(1-t)**2*t*.42+3*(1-t)*t*t*.58+t**3;
        if(px<x)low=t;else high=t;
      }
      const t=(low+high)/2;
      return t*t*(3-2*t);
    }
    const hold=Math.round(duration*.175/10)*10,transition=(duration-2*hold)/2;
    const steps=Math.max(4,Math.round(transition/50));
    for(const reverse of [false,true]){
      await frame(reverse?1:0,hold);
      for(let i=0;i<steps;i++){
        const opacity=ease((i+.5)/steps);
        const delay=10*(Math.round((i+1)*transition/steps/10)-Math.round(i*transition/steps/10));
        await frame(reverse?1-opacity:opacity,delay);
      }
    }
    gif.finish();
    const animation=new Blob([gif.bytesView()],{type:'image/gif'});
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(reader.error);
      reader.readAsDataURL(animation);
    });
  }
};
