/* Shared rank catalogue, personal next-step guide, and branded A4 PDF.
 * No live player data is exported to any service. PDF libraries are hosted with the academy.
 */
(function(){
  'use strict';
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fa = n => window.Data ? Data.fa(n) : String(n);
  const num = n => window.Data ? Data.faNum(n,Number.isInteger(n) ? 0 : 2) : String(n);
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V4h16v16l-4-2-4 2-4-2-4 2Z"/><path d="m8 13 3-3 2 2 4-5M14 7h3v3"/></svg>';
  const PDF_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6M9 17h6"/></svg>';
  const ownScript = document.currentScript && document.currentScript.src;
  const vendorBase = ownScript ? new URL('../assets/vendor/',ownScript).href : new URL(/\/source\/$/.test(new URL('.',document.baseURI).pathname) ? 'assets/vendor/' : 'source/assets/vendor/',document.baseURI).href;
  let overlay = null, contextProvider = null, lastFocus = null, oldOverflow = '', loading = null, pdfBusy = false;

  function iconButton(label){ return '<button type="button" class="rg-icon" data-rank-guide aria-haspopup="dialog" aria-label="'+esc(label || 'راهنمای رنک‌ها و مسیر ارتقاء')+'" title="'+esc(label || 'راهنمای رنک‌ها و مسیر ارتقاء')+'">'+ICON+'</button>'; }
  function rulesHTML(settings){
    const r = AV.rankRules(settings), national = AV.NATIONAL_FIELDS;
    const rates = national.filter(f => r.nationalTo2[f.place] > 0).map(f => 'هر '+(f.place===1 ? 'قهرمانی کشوری' : f.label.replace('سطح ۱','کشوری'))+' = '+fa(r.nationalTo2[f.place])+' قهرمانی سطح ۲');
    if (r.tier2To3 > 0) rates.push('هر قهرمانی سطح ۲ = '+fa(r.tier2To3)+' قهرمانی سطح ۳');
    if (r.tier2To3 === 0) rates.push('معادل‌سازی سطح ۲ به ۳ غیرفعال است');
    const noRate = national.filter(f => !r.nationalTo2[f.place]).map(f => f.short);
    return '<section class="rg-rules"><h4>ضوابط احراز رنک و معادل‌سازی افتخارات</h4>'
      + '<p class="rg-rate-line">'+(rates.length ? rates.map(esc).join(' · ') : 'معادل‌سازی بین سطوح غیرفعال است.')+'</p>'
      + '<ul><li>امتیاز کل و تمام پیش‌نیازهای تعیین‌شده باید هم‌زمان تأمین شوند. سوابق از اولین روز ثبت فعالیت محاسبه می‌شوند؛ صفر یا خط تیره یعنی آن شرط حداقلی ندارد.</li>'
      + '<li>ابتدا مقام‌های موردنیاز سطح ۱ و سپس قهرمانی‌های موردنیاز سطح ۲ اختصاص می‌یابند. فقط مازادِ اختصاص‌نیافته با ضرایب بالا برای سطح پایین‌تر قابل استفاده است؛ ارزش یک نتیجه دوبار محاسبه نمی‌شود.</li>'
      + '<li>تبدیل تنها از سطح بالاتر به پایین‌تر مجاز است؛ هیچ تعداد برد سطح ۲ یا ۳، مقام کشوری ایجاد نمی‌کند. این محاسبه فقط برای احراز رنک است و تعداد واقعی مدال‌ها یا امتیاز را تغییر نمی‌دهد.</li>'
      + '<li>سطح ۱ مسابقات کشوری است. '+(r.betterNational ? 'مقام بهتر می‌تواند شرط مقام پایین‌تر را پوشش دهد؛ مثلاً پنجم یا بهتر. هر مقامِ اختصاص‌یافته دیگر در شرط دیگری استفاده نمی‌شود.' : 'هر یک از پنج مقام کشوری شرط مستقل و دقیق خود را دارد؛ مقام بهتر جای مقام پایین‌تر قرار نمی‌گیرد.')
      + (noRate.length ? ' مقام‌های '+noRate.map(esc).join('، ')+' فعلاً ضریب تبدیل به سطح ۲ ندارند.' : '')+'</li></ul>'
      + (r.note ? '<p class="rg-admin-note">'+esc(r.note)+'</p>' : '')+'</section>';
  }
  function tableHead(){
    return '<thead><tr><th class="rg-marker" rowspan="2">نشان / رنک</th><th class="rg-name" rowspan="2">عنوان رنک</th><th class="rg-points" rowspan="2">حداقل<br>امتیاز کل</th><th colspan="5" class="rg-national-head">سطح ۱ · مسابقات کشوری</th><th class="rg-tier" rowspan="2">قهرمانی<br>سطح ۲</th><th class="rg-tier" rowspan="2">قهرمانی<br>سطح ۳</th></tr><tr>'+AV.NATIONAL_FIELDS.map(f => '<th>'+esc(f.short)+'</th>').join('')+'</tr></thead>';
  }
  function rowHTML(r, current, next){
    const cell = (key,label,cls) => '<td class="'+(cls || '')+'" data-label="'+esc(label)+'"><span class="rg-value '+(r[key]===0 ? 'rg-zero' : '')+'">'+(r[key]===0 && key!=='pts' ? '—' : num(r[key]))+'</span></td>';
    return '<tr data-guide-lv="'+r.lv+'" class="'+(r.lv===current ? 'rg-current' : r.lv===next ? 'rg-next' : '')+'">'
      + '<td class="rg-marker"><div class="rg-mark">'+AV.badgeSVG(r,34)+'<small>LEVEL '+String(r.lv).padStart(2,'0')+'</small></div></td>'
      + '<td class="rg-name"><bdi class="rg-en" dir="ltr">'+esc(r.en)+'</bdi><span class="rg-fa">'+esc(r.fa)+'</span>'+(r.lv===current ? '<small class="rg-state">رنک فعلی شما</small>' : r.lv===next ? '<small class="rg-state">گام بعدی شما</small>' : '')+'</td>'
      + cell('pts','حداقل امتیاز کل','rg-points')
      + AV.NATIONAL_FIELDS.map(f => cell(f.key,f.short+' کشوری','rg-national')).join('')
      + cell('wins2','قهرمانی سطح ۲','rg-tier')+cell('wins3','قهرمانی سطح ۳','rg-tier')+'</tr>';
  }
  function tableHTML(rs, current, next){ return '<table class="rg-ladder"><caption>حداقلِ موردنیاز برای هر رنک · امتیاز کل و افتخارات همهٔ فصل‌ها · — یعنی بدون حداقل</caption>'+tableHead()+'<tbody>'+rs.map(r => rowHTML(r,current,next)).join('')+'</tbody></table>'; }
  function planText(p){ return AV.PREREQUISITES.filter(f => p[f.key]>0).map(f => num(p[f.key])+' '+f.label.replace(' (کشوری)','').replace('سطح ۱','کشوری')).join(' و '); }
  function nextHTML(ctx){
    if (!ctx) return '';
    const hn = AV.honorOf(ctx.user || '',ctx.stats), next=hn.next;
    if (!next) return '<section class="rg-next-box" data-next-level="max"><div class="rg-next-head">'+AV.badgeSVG(hn.rank,52)+'<div><div class="rg-eyebrow">YOUR NEXT CHAPTER</div><h3>بالاترین رنک را به دست آورده‌اید</h3><p class="rg-next-meta">'+esc(ctx.name || '')+'، تمام پیش‌نیازهای '+esc(hn.rank.en)+' تکمیل است.</p></div></div></section>';
    const checks=hn.checks.filter(f => f.need>0), plans=AV.upgradePlans(next,ctx.stats), missingPoints=Math.max(0,next.pts-hn.pts);
    return '<section class="rg-next-box" data-next-level="'+next.lv+'"><div class="rg-next-head">'+AV.badgeSVG(next,52)+'<div><div class="rg-eyebrow">YOUR NEXT CHAPTER · LEVEL '+String(next.lv).padStart(2,'0')+'</div><bdi class="rg-en" dir="ltr">'+esc(next.en)+'</bdi><h3>'+esc(next.fa)+'</h3><div class="rg-next-meta">'+esc(ctx.name || '')+' · رنک فعلی: '+esc(hn.rank.en)+' · '+fa(hn.complete)+' از '+fa(hn.requiredCount)+' پیش‌نیاز تکمیل شده · امتیاز کل: '+num(hn.pts)+'</div></div><span class="rg-next-percent">'+Math.round(hn.prog)+'%</span></div>'
      + '<div class="rg-goals">'+checks.map(f => '<div class="rg-goal '+(f.met ? 'done' : '')+'" data-guide-check="'+f.key+'" data-met="'+f.met+'"><b>'+esc(f.label)+'</b><strong>'+(f.met ? '✓ تکمیل' : num(f.remaining)+' دیگر نیاز است')+'</strong><small>'+num(Math.min(f.have,f.need))+' از '+num(f.need)+' تأمین شده'+(f.key!=='pts' && f.have!==f.raw ? ' · با احتساب معادل مجاز' : '')+'</small></div>').join('')+'</div>'
      + (plans.length ? '<div class="rg-paths"><b>مسیرهای قابل‌انتخاب برای تکمیل افتخارات رنک بعدی</b>'+plans.map((p,i) => '<p data-upgrade-plan="'+esc(JSON.stringify(p))+'"><span class="rg-or">'+(i ? 'یا' : 'مسیر اول:')+'</span>'+esc(planText(p))+'</p>').join('')+(missingPoints>0 ? '<p><b>در همهٔ مسیرها، '+num(missingPoints)+' امتیاز کلِ دیگر نیز لازم است.</b></p>' : '')+'</div>' : '')
      + '<div class="rg-note">'+(hn.evaluation.met && hn.manual ? 'پیش‌نیازهای رنک بعدی تکمیل است؛ رنک فعلی شما دستی تعیین شده و تغییر آن با مدیریت است.' : plans.length ? 'اعداد بالا پس از رزرو نیازهای سطح بالاتر محاسبه شده‌اند. هر مسیر یک پیشنهاد کامل است؛ گزینه‌های «یا» را با هم جمع نکنید.' : missingPoints>0 ? 'افتخارات لازم را دارید؛ برای ارتقاء فقط '+num(missingPoints)+' امتیاز کلِ دیگر نیاز است.' : 'پیش‌نیازهای این گام تکمیل است.')+'</div></section>';
  }
  function refresh(){
    if (!overlay || overlay.hidden) return;
    let ctx = null;
    try { ctx = typeof contextProvider === 'function' ? contextProvider() : contextProvider; } catch(e){}
    const hn=ctx ? AV.honorOf(ctx.user || '',ctx.stats) : null;
    overlay.querySelector('.rg-scroll').innerHTML=nextHTML(ctx)+'<h3>نردبان رنک‌ها · ۱۵ سطح</h3><p class="rg-subtitle">حداقل‌ها بر اساس تنظیمات فعلی مدیریت است. معادل‌سازی افتخارات مطابق ضوابط پایین فهرست اعمال می‌شود.</p>'+tableHTML(AV.ranks(),hn && hn.lv,hn && hn.next && hn.next.lv)+rulesHTML();
  }
  function close(){
    if (!overlay || overlay.hidden) return;
    overlay.hidden=true; overlay.style.display='none'; document.body.style.overflow=oldOverflow;
    if (lastFocus && lastFocus.isConnected) lastFocus.focus();
  }
  function open(provider,trigger){
    contextProvider=provider || null;
    if (!overlay){
      overlay=document.createElement('div'); overlay.id='modal-rank-guide'; overlay.className='rg-overlay'; overlay.hidden=true;
      overlay.innerHTML='<section class="rg-dialog" role="dialog" aria-modal="true" aria-labelledby="rg-title" tabindex="-1"><header class="rg-toolbar"><div><div class="rg-eyebrow">HONOR RANK · THE ASCENT</div><h2 id="rg-title">راهنمای رنک‌ها و مسیر ارتقاء</h2></div><div class="rg-actions"><button type="button" class="btn sm" id="rg-download">'+PDF_ICON+' دریافت PDF</button><button type="button" class="rg-close" aria-label="بستن راهنمای رنک">×</button></div></header><div class="rg-scroll"></div></section>';
      document.body.appendChild(overlay);
      overlay.querySelector('.rg-close').onclick=close;
      overlay.querySelector('#rg-download').onclick=function(){ exportPDF(this).catch(() => {}); };
      overlay.addEventListener('click',e => { if (e.target===overlay) close(); });
      overlay.addEventListener('keydown',e => {
        if(e.key==='Escape'){e.preventDefault();close();return;}
        if(e.key!=='Tab') return;
        // SVG <image href> badges are not links or keyboard focus targets.
        const targets=Array.from(overlay.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')).filter(el => el.getClientRects().length && getComputedStyle(el).visibility!=='hidden');
        e.preventDefault();e.stopPropagation();if(!targets.length) return;
        const i=targets.indexOf(document.activeElement);
        const next=i<0 ? (e.shiftKey ? targets.length-1 : 0) : (i+(e.shiftKey ? -1 : 1)+targets.length)%targets.length;
        targets[next].focus({preventScroll:true});
      });
    }
    if(overlay.hidden) oldOverflow=document.body.style.overflow;
    lastFocus=trigger || document.activeElement;overlay.hidden=false;overlay.style.display='flex';document.body.style.overflow='hidden';refresh();
    overlay.querySelector('.rg-scroll').scrollTop=0;overlay.querySelector('.rg-close').focus();
  }
  function scriptOnce(file,test){
    if(test()) return Promise.resolve();
    return new Promise((resolve,reject) => {
      const s=document.createElement('script');s.src=vendorBase+file;s.async=true;
      const timer=setTimeout(() => {s.remove();reject(new Error('بارگذاری ابزار PDF طول کشید؛ دوباره تلاش کنید.'));},15000);
      s.onload=() => {clearTimeout(timer);test() ? resolve() : reject(new Error('ابزار PDF بارگذاری نشد.'));};
      s.onerror=() => {clearTimeout(timer);s.remove();reject(new Error('ابزار PDF در دسترس نیست؛ اتصال به خود سایت را بررسی کنید.'));};
      document.head.appendChild(s);
    });
  }
  function libraries(){
    if(!loading) loading=scriptOnce('html2canvas-1.4.1.min.js',() => !!window.html2canvas).then(() => scriptOnce('jspdf-2.5.1.umd.min.js',() => !!(window.jspdf && jspdf.jsPDF))).catch(e => {loading=null;throw e;});
    return loading;
  }
  function loadImage(url){
    return new Promise((resolve,reject) => {
      const im=new Image();im.crossOrigin='anonymous';
      const timer=setTimeout(() => reject(new Error('بارگذاری لوگو یا نشان رنک طول کشید.')),10000);
      im.onload=() => {clearTimeout(timer);resolve(im);};im.onerror=() => {clearTimeout(timer);reject(new Error('لوگو یا نشان بارگذاری نشد؛ فایل تصویر را بررسی کنید.'));};im.src=url;
    });
  }
  async function imageData(url){
    if (!url || /^data:image\//.test(url)) return url;
    const im=await loadImage(url),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
    c.getContext('2d').drawImage(im,0,0);return c.toDataURL('image/png');
  }
  async function buildPages(model){
    const host=document.createElement('div');host.className='rg-print-host';host.setAttribute('aria-hidden','true');document.body.appendChild(host);
    const pages=[],date=Data.fa(Data.isoToShamsi(Data.todayISO())),brand=model.brand;
    const makePage=() => {
      const page=document.createElement('section');page.className='rg-paper';
      page.innerHTML='<header class="rg-paper-header"><img class="rg-paper-logo" src="'+esc(model.logo)+'" alt="لوگوی آکادمی"><div class="rg-paper-brand"><b>'+esc(brand.nameFa)+'</b><span>'+esc(brand.nameEn)+'</span></div><div class="rg-paper-date">راهنمای رسمی رنک‌ها<br>'+date+'<br><bdi dir="ltr">'+esc(model.domain)+'</bdi></div></header><div class="rg-paper-title"><h2>مسیر افتخار؛ از نخستین گام تا قهرمان جاودان</h2><span>HONOR RANK · THE ASCENT</span></div><div class="rg-paper-main"></div><footer class="rg-paper-footer"><span>'+esc(brand.nameShortFa)+' · حداقل‌های رنک و ضوابط ارتقاء</span><b>HONOR · PROGRESS · EXCELLENCE</b><span class="rg-page-no"></span></footer>';
      host.appendChild(page);pages.push(page);return page;
    };
    try{
      let page=makePage(),body=page.querySelector('.rg-paper-main'),table=null,count=0;
      const overflow=() => body.scrollHeight > body.clientHeight+1;
      const startTable=() => {const wrap=document.createElement('div');wrap.innerHTML=tableHTML([]);table=wrap.firstElementChild;body.appendChild(table);count=0;};
      startTable();
      if(document.fonts && document.fonts.ready) await document.fonts.ready;
      for(const r of model.ranks){
        if(count===9){page=makePage();body=page.querySelector('.rg-paper-main');startTable();}
        const staging=document.createElement('tbody');staging.innerHTML=rowHTML(r);const row=staging.firstElementChild;
        table.tBodies[0].appendChild(row);count++;
        if(overflow()){
          row.remove();if(count===1) throw new Error('عنوان یکی از رنک‌ها برای یک صفحه بیش از حد بلند است.');
          page=makePage();body=page.querySelector('.rg-paper-main');startTable();table.tBodies[0].appendChild(row);count=1;
          if(overflow()) throw new Error('عنوان یکی از رنک‌ها برای صفحه PDF بیش از حد بلند است.');
        }
      }
      const wrap=document.createElement('div');wrap.innerHTML=rulesHTML(model.rules);const rules=wrap.firstElementChild;body.appendChild(rules);
      if(overflow()){rules.remove();page=makePage();body=page.querySelector('.rg-paper-main');body.appendChild(rules);}
      if(overflow()) throw new Error('توضیح تکمیلی منطق برای یک صفحه بیش از حد بلند است؛ متن را کوتاه‌تر کنید.');
      pages.forEach((p,i) => p.querySelector('.rg-page-no').textContent='صفحهٔ '+fa(i+1)+' از '+fa(pages.length));
      await Promise.all(Array.from(host.querySelectorAll('img')).map(im => im.complete && im.naturalWidth ? Promise.resolve() : loadImage(im.src)));
      return {host,pages};
    }catch(e){host.remove();throw e;}
  }
  async function exportPDF(btn){
    if(pdfBusy) return null;
    pdfBusy=true;let holder=null;const old=btn && btn.innerHTML;
    if(btn){btn.disabled=true;btn.textContent='در حال آماده‌سازی PDF…';}
    try{
      const model={ranks:AV.ranks().map(r => Object.assign({},r)),rules:AV.rankRules(),brand:GA_BRAND.get(),logo:GA_BRAND.logoUrl(),domain:GA_BRAND.host()};
      await libraries();model.logo=await imageData(model.logo);
      await Promise.all(model.ranks.map(async r => {if (/^https?:/.test(r.badge)) r.badge=await imageData(r.badge); else if (/^data:/.test(r.badge)) await loadImage(r.badge);}));
      holder=await buildPages(model);
      const pdf=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
      pdf.setProperties({title:'Honor Rank — '+model.brand.nameEn,subject:'Rank prerequisites and advancement rules',creator:model.brand.nameEn});
      for(let i=0;i<holder.pages.length;i++){
        if(btn) btn.textContent='ساخت صفحهٔ '+fa(i+1)+' از '+fa(holder.pages.length)+'…';
        const canvas=await window.html2canvas(holder.pages[i],{backgroundColor:'#0b151a',scale:2,useCORS:true,allowTaint:false,logging:false,windowWidth:1280,windowHeight:900,scrollX:0,scrollY:0});
        if(i) pdf.addPage('a4','landscape');
        pdf.addImage(canvas.toDataURL('image/jpeg',.95),'JPEG',0,0,297,210);
      }
      const filename='راهنمای-رنک‌ها-'+Data.todayISO()+'.pdf';
      pdf.save(filename);
      if(window.APP) APP.toast('PDF همهٔ رنک‌ها و ضوابط ارتقاء آماده شد ✓','green');
      return {pages:holder.pages.length,filename};
    }catch(e){if(window.APP) APP.toast(e.message || 'ساخت PDF انجام نشد؛ دوباره تلاش کنید.','red');throw e;}
    finally{if(holder) holder.host.remove();pdfBusy=false;if(btn){btn.disabled=false;btn.innerHTML=old;if(overlay && !overlay.hidden && overlay.contains(btn)) btn.focus({preventScroll:true});}}
  }
  window.addEventListener('ga-cloud-applied',() => {if(overlay && !overlay.hidden) setTimeout(refresh,850);});
  window.RANK_GUIDE={iconButton,rulesHTML,tableHTML,nextHTML,open,close,refresh,exportPDF,buildPages};
})();
