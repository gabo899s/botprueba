/* Local, dependency-free reflective lettering. Real DOM text remains accessible. */
(() => {
 'use strict';
 const family='"Averia Serif Libre"';
 function mount(element){
  const canvas=document.createElement('canvas');canvas.className='metal-canvas';canvas.setAttribute('aria-hidden','true');
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  element.append(canvas);
  let width=0,height=0,size=0,pad=0,dpr=1,font='',dead=false,lastTime=0;
  const mask=document.createElement('canvas'),maskCtx=mask.getContext('2d');
  const rim=document.createElement('canvas'),rimCtx=rim.getContext('2d');
  function resize(){
   if(dead)return;
   const style=getComputedStyle(element);size=parseFloat(style.fontSize);pad=size*.18;
   width=element.offsetWidth+pad*2;height=element.offsetHeight+pad*2;
   dpr=Math.min(window.devicePixelRatio||1,2);font=`italic 400 ${size}px ${family}`;
   canvas.width=mask.width=Math.ceil(width*dpr);canvas.height=mask.height=Math.ceil(height*dpr);
   canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;canvas.style.left=`${-pad}px`;canvas.style.top=`${-pad}px`;
   maskCtx.setTransform(dpr,0,0,dpr,0,0);maskCtx.clearRect(0,0,width,height);
   maskCtx.font=font;maskCtx.textBaseline='alphabetic';
   const metrics=maskCtx.measureText('Infinitas');
   const baseline=pad+(element.offsetHeight+metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2;
   maskCtx.fillStyle='#fff';maskCtx.fillText('Infinitas',pad,baseline);
   rim.width=mask.width;rim.height=mask.height;rimCtx.drawImage(mask,0,0);rimCtx.globalCompositeOperation='destination-out';rimCtx.drawImage(mask,dpr*.9,dpr*.9);
   element.classList.add('metal-ready');render(lastTime);
  }
  function render(t){
   if(dead||!width)return;lastTime=t;
   ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,width,height);
   // Alternating dark and silver reflection bands, warped into fluid ribbons.
   const base=ctx.createLinearGradient(0,0,width,height);
   [[0,'#042b9b'],[.22,'#174fea'],[.39,'#91d1ff'],[.46,'#092c86'],[.63,'#357fff'],[.72,'#c0e5ff'],[.79,'#1242ae'],[1,'#295fea']].forEach(([p,c])=>base.addColorStop(p,c));
   ctx.fillStyle=base;ctx.fillRect(0,0,width,height);
   for(let i=-2;i<6;i++){
    const x=((t*.11+i*.29)%2-.5)*width;
    const bend=Math.sin(t*.8+i)*size*.65;
    ctx.save();ctx.translate(x,height*.5);ctx.rotate(-.38+Math.sin(t*.36+i)*.12);
    const band=ctx.createLinearGradient(-size*.32,0,size*.32,0);
    [[0,'#071e6e00'],[.3,'#071e6e99'],[.48,'#3b8cffe0'],[.55,'#d8efffff'],[.61,'#8ac9ffff'],[.76,'#2263eccc'],[1,'#071e6e00']].forEach(([p,c])=>band.addColorStop(p,c));
    ctx.fillStyle=band;ctx.beginPath();ctx.moveTo(-size*.4,-height);
    ctx.bezierCurveTo(bend,-height*.2,-bend,height*.3,-size*.4,height);
    ctx.lineTo(size*.4,height);ctx.bezierCurveTo(size*.4-bend,height*.3,size*.4+bend,-height*.2,size*.4,-height);ctx.closePath();ctx.fill();ctx.restore();
   }
   ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0,mask.width,mask.height,0,0,width,height);
   // A fine internal rim catches the light without a surrounding neon halo.
   ctx.globalCompositeOperation='source-atop';ctx.globalAlpha=.6;ctx.drawImage(rim,0,0,rim.width,rim.height,0,0,width,height);ctx.globalAlpha=1;
   ctx.globalCompositeOperation='source-over';
  }
  // Font loading is completed by the caller before mounting.
  const observer=window.ResizeObserver?new ResizeObserver(resize):null;
  observer?.observe(element);window.addEventListener('resize',resize);resize();
  return{render,resize,destroy(){dead=true;observer?.disconnect();window.removeEventListener('resize',resize);canvas.remove();element.classList.remove('metal-ready');}};
 }
 window.MetalText={mount};
})();
