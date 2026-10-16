/* Rounded blue chrome derived from the glyph surface, never from screen-wide stripes. */
(() => {
 'use strict';
 const family='"Averia Serif Libre"';
 function mount(element){
  const canvas=document.createElement('canvas');canvas.className='metal-canvas';canvas.setAttribute('aria-hidden','true');
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  const mask=document.createElement('canvas'),maskCtx=mask.getContext('2d',{willReadFrequently:true});if(!maskCtx)return null;
  element.append(canvas);
  let dead=false,lastTime=0,lastPaint=-Infinity,pixels,surface=[];
  function resize(){
   if(dead)return;
   const size=parseFloat(getComputedStyle(element).fontSize),pad=size*.18,dpr=Math.min(window.devicePixelRatio||1,1.5);
   const width=element.offsetWidth+pad*2,height=element.offsetHeight+pad*2;
   canvas.width=mask.width=Math.ceil(width*dpr);canvas.height=mask.height=Math.ceil(height*dpr);
   canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;canvas.style.left=`${-pad}px`;canvas.style.top=`${-pad}px`;
   maskCtx.setTransform(dpr,0,0,dpr,0,0);maskCtx.font=`italic 400 ${size}px ${family}`;maskCtx.textBaseline='alphabetic';
   const metrics=maskCtx.measureText('Infinitas');
   const baseline=pad+(element.offsetHeight+metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2;
   maskCtx.fillStyle='#fff';maskCtx.fillText('Infinitas',pad,baseline);
   const w=mask.width,h=mask.height;pixels=maskCtx.getImageData(0,0,w,h);
   const distance=new Float32Array(w*h),rounded=new Float32Array(w*h),diagonal=Math.SQRT2;
   for(let i=0;i<distance.length;i++)distance[i]=pixels.data[i*4+3]>24?10000:0;
   // Two-pass Euclidean chamfer distance: every highlight follows the actual letter.
   for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const i=y*w+x;if(distance[i])distance[i]=Math.min(distance[i],distance[i-1]+1,distance[i-w]+1,distance[i-w-1]+diagonal,distance[i-w+1]+diagonal);
   }
   for(let y=h-2;y>0;y--)for(let x=w-2;x>0;x--){
    const i=y*w+x;if(distance[i])distance[i]=Math.min(distance[i],distance[i+1]+1,distance[i+w]+1,distance[i+w+1]+diagonal,distance[i+w-1]+diagonal);
   }
   const bevel=Math.max(1,size*dpr*.043);
   for(let i=0;i<distance.length;i++)rounded[i]=1-Math.exp(-distance[i]/bevel);
   // Smooth the height before deriving normals: pixel-grid steps must never
   // become sparkly facets on the rounded metal surface.
   const horizontal=new Float32Array(w*h),smooth=new Float32Array(w*h),weights=[1,4,6,4,1];
   for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
    const i=y*w+x;for(let k=-2;k<=2;k++)horizontal[i]+=rounded[i+k]*weights[k+2]/16;
   }
   for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
    const i=y*w+x;for(let k=-2;k<=2;k++)smooth[i]+=horizontal[i+k*w]*weights[k+2]/16;
   }
   surface=[];
   for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const i=y*w+x;if(!pixels.data[i*4+3])continue;
    const dx=(smooth[i+1]-smooth[i-1])*bevel*1.65,dy=(smooth[i+w]-smooth[i-w])*bevel*1.65;
    const length=Math.hypot(dx,dy,1);
    surface.push({i:i*4,nx:-dx/length,ny:-dy/length,nz:1/length,d:distance[i]/dpr,x:x/dpr,y:y/dpr});
   }
   element.classList.add('metal-ready');lastPaint=-Infinity;render(lastTime);
  }
  function render(t){
   if(dead||!pixels||Math.abs(t-lastPaint)<1/32)return;lastPaint=lastTime=t;
   const lightX=Math.sin(t*.85)*.65,lightY=Math.cos(t*.67)*.7;
   for(const p of surface){
    // Moving reflected environment bends with the normals, giving independent
    // highlights to stems, counters and serifs without moving or distorting glyphs.
    const environment=p.nx*2.3+p.ny*1.8+p.nz*3.4+Math.sin(p.x*.016+t*.7)*.65-t*1.65;
    const reflection=Math.pow(.5+.5*Math.sin(environment),2);
    const specular=Math.pow(Math.max(0,p.nx*lightX+p.ny*lightY+p.nz*.72),10);
    const contours=Math.pow(.5+.5*Math.cos(p.d*.65+p.ny*.7-t*1.5),8)*.1;
    const rim=Math.pow(1-p.nz,1.4)*.2;
    const shine=Math.min(1,reflection*.7+specular*.32+contours+rim);
    const a=pixels.data,i=p.i;
    a[i]=Math.min(185,10+shine*153);a[i+1]=Math.min(222,49+shine*157);a[i+2]=Math.min(255,235+shine*20);
   }
   ctx.putImageData(pixels,0,0);
  }
  const observer=window.ResizeObserver?new ResizeObserver(resize):null;
  observer?.observe(element);window.addEventListener('resize',resize);resize();
  return{render,resize,destroy(){dead=true;surface=[];pixels=null;observer?.disconnect();window.removeEventListener('resize',resize);canvas.remove();element.classList.remove('metal-ready');}};
 }
 window.MetalText={mount};
})();
