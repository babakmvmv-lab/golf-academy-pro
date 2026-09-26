/* Real admin login UI against a fake Auth + fake independent web_store. No live secrets. */
const{chromium}=require('playwright'),assert=require('node:assert/strict');
const{MockPublicCloud,BASE}=require('./site_cloud_mock.cjs');
(async()=>{
 const b=await chromium.launch({headless:true}),c=await b.newContext({serviceWorkers:'block'}),cloud=new MockPublicCloud(),errors=[];await cloud.attach(c);
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto(BASE+'/admin/login/',{waitUntil:'domcontentloaded'});
  await p.locator('input[type="password"]').waitFor();
  const user=p.locator('input:not([type="password"])').first();
  await user.fill('admin');await p.locator('input[type="password"]').fill('wrong');await p.getByRole('button',{name:'ورود به داشبورد',exact:true}).click();
  await p.getByText(/ورود ابری انجام نشد/).waitFor();
  assert.equal(await p.evaluate(()=>localStorage.getItem('puttclub_web_auth_v1')),null);
  await p.locator('input[type="password"]').fill('Synthetic-Password-123');await p.getByRole('button',{name:'ورود به داشبورد',exact:true}).click();
  await p.waitForURL(/\/admin\/?$/);await p.waitForFunction(()=>window.PC_SITE_CLOUD?.authSession());
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('puttclub_admin')).cloud),true);
  await p.locator('#pc-site-cloud summary').click();await p.locator('[data-pc="auth"]').click();
  await p.locator('#pc-web-auth-dialog input[name="password"]').fill('Synthetic-New-Password-456');await p.locator('#pc-web-auth-dialog input[name="repeat"]').fill('Synthetic-New-Password-456');
  await p.locator('#pc-web-auth-dialog button[type="submit"]').click();await p.getByText(/رمز جدید ثبت شد/).waitFor();
  assert.equal(cloud.writes.length,0,'Auth/password must never enter public content rows');
  assert.ok(cloud.authCalls.some(x=>x.path.endsWith('/user')&&x.method==='PUT'));
  await p.locator('#pc-web-auth-dialog [data-close]').click();
  await p.getByRole('button',{name:'خروج',exact:true}).click();
  await p.waitForFunction(()=>!JSON.parse(localStorage.getItem('puttclub_web_auth_v1')||'null'));
  assert.deepEqual(errors,[]);assert.equal(cloud.blocked.filter(x=>x.endsWith('.supabase.co')).length,0);
  console.log('PASS web admin authentication: actual login UI, wrong-password rejection, protected session, password-change dialog, logout, no credentials in content storage; zero live requests.');
 }finally{await c.close();await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
