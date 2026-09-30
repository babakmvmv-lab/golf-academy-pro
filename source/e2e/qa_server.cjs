/* Static QA server for browser suites: serves the built repo and remaps the generated
 * bootstrap's cloud URL to /__qa_cloud so tests stay hermetic. No secrets, no live data.
 * Usage: node source/e2e/qa_server.cjs [port]
 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const PORT=Number(process.argv[2]||process.env.PORT||8000);
const cloudJs=fs.readFileSync(path.join(ROOT,'source/js/cloud.js'),'utf8');
const cloudUrl=(cloudJs.match(/url: '(https:\/\/[^']+)'/)||[])[1];
if(!cloudUrl)throw Error('cloud URL not found in source/js/cloud.js');
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'source/public-cloud-manifest.json'),'utf8'));
const remap=s=>String(s).split(cloudUrl).join('http://127.0.0.1:'+PORT+'/__qa_cloud');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.mp4':'video/mp4','.txt':'text/plain; charset=utf-8','.webmanifest':'application/manifest+json'};
http.createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1');
 let file=path.normalize(path.join(ROOT,decodeURIComponent(u.pathname)));
 const alias={'/shop-ops.current.js':manifest.shopOpsAsset,'/site-cloud.current.js':manifest.bootstrap};
 if(alias[u.pathname])file=path.join(ROOT,alias[u.pathname]);   // harness pages never hard-code a hash again
 if(!file.startsWith(ROOT)){res.writeHead(403);return res.end();}
 if(u.pathname==='/'||u.pathname.endsWith('/'))file=path.join(file,'index.html');
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){
  const guess=file.endsWith('.html')?file:file+'.html';
  if(fs.existsSync(guess)&&fs.statSync(guess).isFile())file=guess;
  else{res.writeHead(404,{'Cache-Control':'no-store'});return res.end('not found');}
 }
 const rel=path.relative(ROOT,file);
 let body=fs.readFileSync(file);
 const isBootstrap=rel===manifest.bootstrap||/^site-cloud\.[a-f0-9]+\.js$/.test(path.basename(rel));
 if(isBootstrap||rel===manifest.shopOpsAsset||/^shop-ops\.[a-f0-9]+\.js$/.test(path.basename(rel)))body=Buffer.from(remap(body.toString('utf8')));
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
 res.end(body);
}).listen(PORT,'127.0.0.1',()=>console.log('QA server on http://127.0.0.1:'+PORT+' (cloud '+cloudUrl+' -> /__qa_cloud)'));
