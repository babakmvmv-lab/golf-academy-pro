/* Shared image upload for the site/shop admin panels: pick a file → resize → WebP data URL.
   Keeps the URL option; uploads are converted automatically (best web format, no visible quality loss). */
(function(){
 'use strict';
 function pick(maxDim,cb){
  if(typeof cb!=='function')return;
  const inp=document.createElement('input');
  inp.type='file';inp.accept='image/*';
  inp.style.display='none';
  inp.addEventListener('change',()=>{
   const file=inp.files&&inp.files[0];
   inp.remove();
   if(!file)return;
   if(!/^image\//.test(file.type)){alert('فقط فایل تصویر مجاز است.');return;}
   if(file.size>8*1024*1024){alert('حجم فایل بیشتر از ۸ مگابایت است؛ فایل کوچک‌تری انتخاب کنید.');return;}
   const url=URL.createObjectURL(file);
   const img=new Image();
   img.onload=()=>{
    try{
     const max=Math.max(64,Math.min(4096,+maxDim||1400));
     let w=img.naturalWidth||max,h=img.naturalHeight||max;
     const scale=Math.min(1,max/Math.max(w,h));
     w=Math.max(1,Math.round(w*scale));h=Math.max(1,Math.round(h*scale));
     const cv=document.createElement('canvas');cv.width=w;cv.height=h;
     const ctx=cv.getContext('2d');
     ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
     ctx.drawImage(img,0,0,w,h);
     URL.revokeObjectURL(url);
     /* WebP when supported (much smaller, no visible loss); JPEG fallback for old Safari. */
     let out=cv.toDataURL('image/webp',0.88);
     if(out.indexOf('data:image/webp')!==0)out=cv.toDataURL('image/jpeg',0.84);
     if(out.length>1500000){alert('تصویر تبدیل‌شده همچنان بزرگ است (بیش از ~۱.۱ مگابایت)؛ عکس کوچک‌تری انتخاب کنید.');return;}
     cb(out);
    }catch(e){URL.revokeObjectURL(url);alert('تبدیل تصویر انجام نشد.');}
   };
   img.onerror=()=>{URL.revokeObjectURL(url);alert('فایل تصویر خوانده نشد.');};
   img.src=url;
  });
  document.body.appendChild(inp);
  inp.click();
 }
 /* فشرده‌سازی بیشتر یک data-URL تا زیر سقف مشخص (برای ارسال به سرور با محدودیت حجم) */
 function shrink(dataUrl,maxBytes){
  return new Promise(function(resolve){
  try{
   var im=new Image();
   im.onload=function(){
    try{
     var dim=Math.max(im.naturalWidth,im.naturalHeight)||1024;
     var dims=[dim,Math.round(dim*0.78),Math.round(dim*0.6),Math.round(dim*0.45),Math.round(dim*0.34)];
     for(var i=0;i<dims.length;i++){
      var d=Math.max(320,dims[i]);
      var sc=Math.min(1,d/Math.max(im.naturalWidth,im.naturalHeight));
      var w=Math.max(1,Math.round(im.naturalWidth*sc)),h=Math.max(1,Math.round(im.naturalHeight*sc));
      var cv=document.createElement('canvas');cv.width=w;cv.height=h;
      var cx=cv.getContext('2d');cx.imageSmoothingEnabled=true;cx.imageSmoothingQuality='high';cx.drawImage(im,0,0,w,h);
      var qs=[0.8,0.72,0.62];
      for(var j=0;j<qs.length;j++){
       var out=cv.toDataURL('image/webp',qs[j]);
       if(out.indexOf('data:image/webp')!==0)out=cv.toDataURL('image/jpeg',qs[j]-0.06);
       if(out.length<=maxBytes){resolve(out);return;}
      }
     }
     resolve(null); /* حتی با کوچک‌ترین حالت زیر سقف نیامد */
    }catch(e){resolve(null);}
   };
   im.onerror=function(){resolve(null);};
   im.src=dataUrl;
  }catch(e){resolve(null);}
  });
 }
 window.PC_IMG={pick:pick,shrink:shrink};
})();
