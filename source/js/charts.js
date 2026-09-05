/* ═══════════════ GolfAcademy PRO — Charts (canvas, glow, animated) ═══════════════ */
const Charts = (() => {
  const DPR = () => (window.devicePixelRatio || 1);

  function prep(canvas){
    if (!canvas || !canvas.getBoundingClientRect) return null;
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(2, Math.round(r.width * DPR()));
    canvas.height = Math.max(2, Math.round(r.height * DPR()));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(DPR(), 0, 0, DPR(), 0, 0);
    return { ctx, w: r.width, h: r.height };
  }
  function roundRect(ctx, x, y, w, h, r){
    r = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
  }
  function hexA(hex, a){
    const n = parseInt(hex.replace('#',''), 16);
    const r = (n>>16)&255, g=(n>>8)&255, b=n&255;
    return `rgba(${r},${g},${b},${a})`;
  }
  function grad(ctx, x0,y0,x1,y1, c1, c2){
    const g = ctx.createLinearGradient(x0,y0,x1,y1);
    g.addColorStop(0,c1); g.addColorStop(1,c2);
    return g;
  }
  function animate(cb, dur=850){
    return new Promise(res => {
      const t0 = performance.now();
      (function step(t){
        const p = Math.min(1, (t-t0)/dur);
        const e = 1 - Math.pow(1-p, 3);
        cb(e);
        if (p < 1) requestAnimationFrame(step); else res();
      })(t0);
    });
  }

  /* ── بار عمودی ── */
  function barsV(canvas, cats, vals, opts={}){
    const P = prep(canvas); if (!P) return; const { ctx, w, h } = P;
    const color = opts.color || '#D4AF37';
    const colArr = Array.isArray(opts.color); /* پشتیبانی از رنگ به‌ازای هر ستون */
    const glow = opts.glow !== undefined ? opts.glow : true;
    const padL = opts.padL || 26, padB = opts.padB || 22, padT = opts.padT || 8, padR = opts.padR || 6;
    const max = opts.max || Math.max(...vals, 1) * 1.12;
    const n = vals.length;
    const bw = (w - padL - padR) / n * (opts.gap !== undefined ? opts.gap : 0.62);
    const x0 = padL + (w - padL - padR) / n / 2;
    ctx.clearRect(0,0,w,h);
    // gridlines
    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#8A93A6'; ctx.font = '10px Tahoma';
    for (let g = 0; g <= 4; g++){
      const y = padT + (h - padT - padB) * g / 4;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w-padR, y); ctx.stroke();
      const v = max * (1 - g/4);
      ctx.textAlign = 'left';
      ctx.fillText(opts.fmt ? opts.fmt(v) : Math.round(v), w-padR-2, y+3);
    }
    animate(p => {
      ctx.clearRect(0,0,w,h);
      ctx.strokeStyle = 'rgba(255,255,255,.06)';
      for (let g = 0; g <= 4; g++){
        const y = padT + (h - padT - padB) * g / 4;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w-padR, y); ctx.stroke();
      }
      const H = h - padT - padB;
      for (let i = 0; i < n; i++){
        const v = vals[i] || 0;
        const bh = (v / max) * H * p;
        const x = x0 + (i - (n-1)/2) * (w - padL - padR) / n;
        const y = h - padB - bh;
        const col = colArr ? (opts.color[i] || '#D4AF37') : color;
        const grd = grad(ctx, x, y, x, h-padB, hexA(col,.95), hexA(col,.25));
        ctx.save();
        if (glow){ ctx.shadowColor = col; ctx.shadowBlur = 14; }
        ctx.fillStyle = grd;
        roundRect(ctx, x-bw/2, y, bw, bh, 4);
        ctx.fill();
        ctx.restore();
        // label
        ctx.fillStyle = '#8A93A6'; ctx.font = '10px Tahoma';
        ctx.textAlign = 'center';
        ctx.fillText(String(cats[i]), x, h - padB + 15);
        // value on top
        if (opts.showVal){
          ctx.fillStyle = '#F8FAFC'; ctx.font = 'bold 9.5px Tahoma';
          ctx.fillText(opts.valFmt ? opts.valFmt(v) : Math.round(v), x, y - 5);
        }
      }
    }, opts.dur);
  }

  /* ── بار افقی (فهرستی) ── */
  function barsH(canvas, cats, vals, opts={}){
    const P = prep(canvas); if (!P) return; const { ctx, w, h } = P;
    const color = opts.color || '#1EBB8A';
    const max = opts.max || Math.max(...vals, 1) * 1.1;
    const n = vals.length;
    const rowH = Math.min((h - 8) / n, 26);
    const padT = 6, padB = 6, padL = opts.padL || 96, padR = 8;
    ctx.clearRect(0,0,w,h);
    animate(p => {
      ctx.clearRect(0,0,w,h);
      for (let i = 0; i < n; i++){
        const v = vals[i] || 0;
        const y = padT + i * rowH + 3;
        const bw = (v / max) * (w - padL - padR) * p;
        ctx.fillStyle = 'rgba(255,255,255,.05)';
        roundRect(ctx, padL, y, w - padL - padR, rowH - 6, 6);
        ctx.fill();
        const grd = grad(ctx, padL, y, padL+bw, y, hexA(color,.95), hexA(color,.3));
        ctx.save();
        ctx.shadowColor = color; ctx.shadowBlur = 10;
        ctx.fillStyle = grd;
        roundRect(ctx, padL, y, bw, rowH - 6, 6);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#8A93A6'; ctx.font = '10.5px Tahoma';
        ctx.textAlign = 'right';
        ctx.fillText(String(cats[i]), padL - 8, y + (rowH-6)/2 + 3.5);
        if (opts.showVal){
          ctx.fillStyle = '#F8FAFC'; ctx.font = 'bold 10px Tahoma'; ctx.textAlign = 'left';
          ctx.fillText(opts.valFmt ? opts.valFmt(v) : Math.round(v), padL + bw - 8, y + (rowH-6)/2 + 3.5);
        }
      }
    }, opts.dur);
  }

  /* ── نمودار خطی ── */
  function line(canvas, series, cats, opts={}){
    const P = prep(canvas); if (!P) return; const { ctx, w, h } = P;
    const colors = opts.colors || ['#E9C766','#2E86DE','#1EBB8A'];
    const padL = opts.padL || 34, padB = opts.padB || 24, padT = opts.padT || 12, padR = 10;
    const allVals = series.flat().filter(v => v !== null && v !== undefined);
    const max = opts.max || Math.max(...allVals, 1) * 1.15;
    const min = opts.min !== undefined ? opts.min : Math.min(0, ...allVals);
    const X = i => padL + (i / Math.max(1, cats.length - 1)) * (w - padL - padR);
    const Y = v => padT + (1 - (v - min) / (max - min || 1)) * (h - padT - padB);
    ctx.clearRect(0,0,w,h);
    animate(p => {
      ctx.clearRect(0,0,w,h);
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
      for (let g = 0; g <= 4; g++){
        const y = padT + (h - padT - padB) * g / 4;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w-padR, y); ctx.stroke();
      }
      cats.forEach((c,i) => {
        ctx.fillStyle = '#8A93A6'; ctx.font = '10px Tahoma'; ctx.textAlign = 'center';
        ctx.fillText(String(c), X(i), h - padB + 15);
      });
      series.forEach((arr, si) => {
        const col = colors[si % colors.length];
        ctx.save();
        ctx.shadowColor = col; ctx.shadowBlur = 12;
        ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.lineJoin = 'round';
        ctx.beginPath();
        let started = false;
        arr.forEach((v, i) => {
          if (v === null || v === undefined) return;
          const x = X(i), y = Y(v);
          if (!started){ ctx.moveTo(x, y); started = true; }
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.restore();
        // fill under first series
        if (si === 0 && opts.fill){
          ctx.beginPath();
          ctx.moveTo(X(0), h - padB);
          let st2 = false;
          arr.forEach((v, i) => {
            if (v === null || v === undefined) return;
            const x = X(i), y = Y(v);
            if (!st2){ ctx.lineTo(x, y); st2 = true; }
            else ctx.lineTo(x, y);
          });
          ctx.lineTo(X(cats.length - 1), h - padB);
          ctx.closePath();
          const g = ctx.createLinearGradient(0, padT, 0, h-padB);
          g.addColorStop(0, hexA(col, .25)); g.addColorStop(1, hexA(col, 0));
          ctx.fillStyle = g; ctx.fill();
        }
        // points
        if (opts.points){
          arr.forEach((v, i) => {
            if (v === null || v === undefined) return;
            ctx.beginPath(); ctx.arc(X(i), Y(v), 3, 0, 7);
            ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.fill();
            ctx.shadowBlur = 0;
          });
        }
      });
    }, opts.dur);
  }

  /* ── رادار ── */
  function radar(canvas, labels, vals, opts={}){
    const PR = prep(canvas); if (!PR) return; const { ctx, w, h } = PR;
    const color = opts.color || '#D4AF37';
    const cx = w/2, cy = h/2 + 6;
    const R = Math.min(w, h) / 2 - 34;
    const n = labels.length;
    const ang = i => -Math.PI/2 + i * 2*Math.PI/n;
    const P = (i, r) => [cx + Math.cos(ang(i))*r, cy + Math.sin(ang(i))*r];
    ctx.clearRect(0,0,w,h);
    animate(p => {
      ctx.clearRect(0,0,w,h);
      // rings
      for (let ring = 1; ring <= 4; ring++){
        ctx.strokeStyle = 'rgba(255,255,255,.07)';
        ctx.beginPath();
        for (let i = 0; i <= n; i++){
          const [x,y] = P(i % n, R*ring/4);
          i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
        }
        ctx.stroke();
      }
      // spokes
      for (let i = 0; i < n; i++){
        const [x,y] = P(i, R);
        ctx.strokeStyle = 'rgba(255,255,255,.05)';
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(x,y); ctx.stroke();
      }
      // shape
      const rr = vals.map(v => Math.max(0, Math.min(100, v)) / 100 * R * p);
      ctx.beginPath();
      rr.forEach((r2, i) => { const [x,y] = P(i, r2); i ? ctx.lineTo(x,y) : ctx.moveTo(x,y); });
      ctx.closePath();
      ctx.save();
      ctx.shadowColor = color; ctx.shadowBlur = 22;
      ctx.fillStyle = hexA(color, .16); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
      rr.forEach((r2, i) => {
        const [x,y] = P(i, r2);
        ctx.beginPath(); ctx.arc(x, y, 3.4, 0, 7);
        ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 10; ctx.fill();
        ctx.shadowBlur = 0;
      });
      // labels
      labels.forEach((lb, i) => {
        const [x,y] = P(i, R + 22);
        ctx.fillStyle = '#8A93A6'; ctx.font = '11px Tahoma'; ctx.textAlign = 'center';
        ctx.fillText(lb, x, y + 4);
      });
    }, opts.dur);
  }

  /* ── دونات ── */
  function donut(canvas, segments, opts={}){
    const P = prep(canvas); if (!P) return; const { ctx, w, h } = P;
    const cx = w/2, cy = h/2;
    const R = (Math.min(w, h) / 2 - 6) * (opts.size || 0.78);
    const inner = R * (opts.inner || 0.62);
    const total = opts.total || segments.reduce((s, x) => s + x.value, 0) || 1;
    ctx.clearRect(0,0,w,h);
    animate(p => {
      ctx.clearRect(0,0,w,h);
      let a0 = -Math.PI/2;
      segments.forEach(seg => {
        const frac = (seg.value / total) * p;
        const a1 = a0 + frac * 2*Math.PI;
        ctx.save();
        ctx.shadowColor = seg.color; ctx.shadowBlur = seg.glow ? 14 : 0;
        ctx.beginPath();
        ctx.arc(cx, cy, R, a0 + .02, a1 - .02);
        ctx.arc(cx, cy, inner, a1 - .02, a0 + .02, true);
        ctx.closePath();
        ctx.fillStyle = seg.color;
        ctx.fill();
        ctx.restore();
        a0 = a1;
      });
      // hole shading
      ctx.beginPath(); ctx.arc(cx, cy, inner, 0, 7);
      ctx.fillStyle = 'rgba(11,15,20,.55)'; ctx.fill();
    }, opts.dur);
  }

  /* ── اسپارک‌لاین ── */
  function spark(canvas, vals, color='#E9C766'){
    const P = prep(canvas); if (!P) return; const { ctx, w, h } = P;
    ctx.clearRect(0,0,w,h);
    if (!vals.length) return;
    const max = Math.max(...vals), min = Math.min(...vals);
    const X = i => i/(vals.length-1) * (w-2) + 1;
    const Y = v => h - 2 - (v - min)/(max - min || 1) * (h - 4);
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 6;
    ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
    ctx.beginPath();
    vals.forEach((v,i) => i ? ctx.lineTo(X(i),Y(v)) : ctx.moveTo(X(i),Y(v)));
    ctx.stroke();
    ctx.restore();
    const lg = ctx.createLinearGradient(0,0,0,h);
    lg.addColorStop(0, ChartsHexA(color,.3)); lg.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.moveTo(X(0), h);
    vals.forEach((v,i) => ctx.lineTo(X(i),Y(v)));
    ctx.lineTo(X(vals.length-1), h);
    ctx.closePath(); ctx.fillStyle = lg; ctx.fill();
  }
  function ChartsHexA(hex, a){
    const n = parseInt(hex.replace('#',''), 16);
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
  }

  /* ── شمارنده متحرک ── */
  function countUp(el, target, opts={}){
    const dur = opts.dur || 1100;
    const fmt = opts.fmt || (v => v.toLocaleString('en-US'));
    const t0 = performance.now();
    (function step(t){
      const p = Math.min(1, (t-t0)/dur);
      const e = 1 - Math.pow(1-p, 3);
      el.textContent = fmt(Math.round(target * e));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  return { barsV, barsH, line, radar, donut, spark, countUp, prep, hexA };
})();
