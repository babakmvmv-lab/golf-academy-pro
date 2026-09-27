const{ShopHarness}=require('./shop_ops_harness.cjs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{const h=new ShopHarness();try{
 await h.setup();const p=await h.call('owner','product_save',{name:'کالای آزمون هم‌زمانی',sku:'QA-LAST-ITEM',category:'گلف',sale_price:300});
 await h.call('owner','document_save',{client_id:crypto.randomUUID(),kind:'opening',post:true,lines:[{product_id:p.id,qty:1,price:100}]});
 const work=()=>h.call('seller','document_save',{client_id:crypto.randomUUID(),kind:'sale',post:true,paid:300,lines:[{product_id:p.id,qty:1,price:300}]});
 const results=await Promise.allSettled([work(),work()]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);
 const b=await h.call('owner','bootstrap');assert.equal(b.products[0].stock,0);assert.equal(b.products[0].inventory_value,0);const docs=await h.call('owner','documents',{section:'sales'});assert.equal(docs.length,1);
 const r=await h.call('owner','report');assert.equal(r.accounts.reduce((n,x)=>n+x.debit-x.credit,0),0);
 console.log('PASS real concurrent transactions: only one sale can consume the last item; losing request leaves no document, stock or ledger residue. Isolated QA schema.');
}finally{await h.cleanup();}})().catch(e=>{console.error(e);process.exitCode=1});
