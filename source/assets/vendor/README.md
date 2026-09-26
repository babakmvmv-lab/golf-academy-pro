# Local PDF dependencies

Pinned, unmodified browser distributions used on demand by `source/js/rank-guide.js`:

- `html2canvas-1.4.1.min.js` — html2canvas 1.4.1, from the npm package `html2canvas/dist/html2canvas.min.js`. MIT license in `LICENSE-html2canvas.txt`.
- `jspdf-2.5.1.umd.min.js` — jsPDF 2.5.1, from the npm package `jspdf/dist/jspdf.umd.min.js`. MIT license in `LICENSE-jspdf.txt`.

These match the versions already used by the academy's earlier report exporters. Hosting them locally avoids dependence on an external CDN for the new rank PDF. They are lazy-loaded; neither sends rank/player data to an external service. Existing report code is unchanged.
