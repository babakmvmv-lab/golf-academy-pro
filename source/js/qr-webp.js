/* Render the library's QR bitmap through a canvas and expose WebP data for normal display. */
(function(){
  'use strict';
  function toWebP(qr, cellSize, margin, quality){
    const legacy = qr.createDataURL(cellSize || 4, margin);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, 0, 0);
          const webp = canvas.toDataURL('image/webp', quality == null ? 1 : quality);
          resolve(webp.indexOf('data:image/webp;') === 0 ? webp : legacy);
        } catch (e) {
          resolve(legacy);
        }
      };
      img.onerror = () => resolve(legacy);
      img.src = legacy;
    });
  }
  window.PC_QR = { toWebP };
})();
