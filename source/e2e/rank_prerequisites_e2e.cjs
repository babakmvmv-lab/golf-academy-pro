/* Rank prerequisites + lifetime history, using the actual data/avatar modules.
 * node source/e2e/rank_prerequisites_e2e.cjs
 * Isolated in-memory localStorage; no browser, live network, or live records.
 */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const plain = o => JSON.parse(JSON.stringify(o));
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function boot(seed = {}) {
  const memory = new Map(Object.entries({ ga_seed_v2:'1405', ga_cleanup_practice_v1:'1', ...seed }));
  const writes = [], network = [];
  const ctx = vm.createContext({
    console, location:{ protocol:'file:' },
    localStorage:{
      getItem:k => memory.get(k) ?? null,
      setItem:(k,v) => { writes.push(k); memory.set(k,String(v)); },
      removeItem:k => { writes.push(k); memory.delete(k); },
    },
    setTimeout:() => 0, clearTimeout:() => {}, setInterval:() => 0,
    fetch:() => { network.push('unexpected request'); throw new Error('No network in rank test'); },
  });
  ctx.window = ctx;
  vm.runInContext(fs.readFileSync(process.env.DATA_SOURCE || path.join(ROOT, 'js/data.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(process.env.AVATAR_SOURCE || path.join(ROOT, 'js/avatar.js'), 'utf8'), ctx);
  return { AV:ctx.AV, D:ctx.Data, ctx, memory, writes, network };
}
const { AV } = boot();
const all = (pts = 100000) => ({ pts, wins1:100, wins2:100, wins3:100 });

test('Points, five national places and two lower tiers are editable', () => {
  assert.deepEqual(plain(AV.PREREQUISITES.map(f => f.key)), ['pts','wins1','national2','national3','national4','national5','wins2','wins3']);
});
test('Levels 1–4 require no championships', () => {
  for (let lv=1; lv<=4; lv++) {
    const r = AV.rankOf(lv);
    assert.deepEqual([r.wins1,r.wins2,r.wins3], [0,0,0]);
    assert.equal(AV.honorOf('u', { pts:r.pts }).lv, lv);
  }
});
test('Level 5 requires one Tier-3 championship', () => {
  const r = AV.rankOf(5);
  assert.deepEqual([r.wins1,r.wins2,r.wins3], [0,0,1]);
  assert.equal(AV.honorOf('u', { pts:r.pts, wins3:0 }).lv, 4);
  assert.equal(AV.honorOf('u', { pts:r.pts, wins3:1 }).lv, 5);
});
test('Level 6 requires Tier-2 = 1 AND Tier-3 = 3', () => {
  const pts = AV.rankOf(6).pts;
  assert.deepEqual([AV.rankOf(6).wins1,AV.rankOf(6).wins2,AV.rankOf(6).wins3], [0,1,3]);
  assert.equal(AV.honorOf('u', { pts, wins2:0, wins3:99 }).lv, 5);
  assert.equal(AV.honorOf('u', { pts, wins2:1, wins3:2 }).lv, 5);
  assert.equal(AV.honorOf('u', { pts, wins2:1, wins3:3 }).lv, 6);
});
test('Level 7 and initial levels 8–15 use Tier-1 = 0, Tier-2 = 3, Tier-3 = 10', () => {
  for (let lv=7; lv<=15; lv++) {
    const r = AV.rankOf(lv);
    assert.deepEqual([r.wins1,r.wins2,r.wins3], [0,3,10]);
    assert.equal(AV.honorOf('u', { pts:r.pts, wins2:3, wins3:10 }).lv, lv);
  }
});
test('Points alone cannot unlock level 5, including legacy numeric callers', () => {
  assert.equal(AV.levelOfPts(999999999), 4);
  assert.equal(AV.honorOf('u', 999999999).lv, 4);
  assert.equal(AV.honorOf('u', { pts:999999999, wins1:0, wins2:0 }).lv, 4);
});
test('Each of the four missing conditions independently prevents the target rank', () => {
  const x = boot().AV;
  for (let lv=7; lv<=15; lv++) assert.equal(x.saveRank(lv, { wins1:2 }), true);
  const threshold = { pts:x.rankOf(7).pts, wins1:2, wins2:3, wins3:10 };
  for (const key of ['pts','wins1','wins2','wins3']) {
    const missing = { ...threshold, [key]:threshold[key]-1 };
    assert.equal(x.requirementsMet(x.rankOf(7), missing), false, key);
    assert.ok(x.honorOf('u', missing).lv < 7, key);
  }
  assert.equal(x.honorOf('u', threshold).lv, 7);
  assert.equal(x.honorOf('u', { ...threshold, pts:100000 }).lv, 15);
});
test('An unmet custom level-1 requirement does not grant a free rank', () => {
  const x = boot().AV;
  x.saveRank(1, { pts:1 });
  const h = x.honorOf('u', { pts:0 });
  assert.equal(h.lv, 0); assert.equal(h.rank.en, 'Unranked'); assert.equal(h.next.lv, 1);
  assert.equal(x.honorOf('u', { pts:1 }).lv, 1);
});
test('All previously entered points and skins survive without migration writes', () => {
  const overrides = {};
  for (let lv=1; lv<=15; lv++) overrides[lv] = { pts:lv*3000, bg1:'#123456', badge:'data:image/png;base64,UNCHANGED', en:'Custom '+lv };
  const raw = JSON.stringify(overrides);
  const b = boot({ ga_rank_skin:raw });
  const rs = b.AV.ranks();
  for (let lv=1; lv<=15; lv++) {
    const r = rs[lv-1];
    assert.equal(r.pts, overrides[lv].pts); assert.equal(r.bg1, '#123456');
    assert.equal(r.badge, overrides[lv].badge); assert.equal(r.en, 'Custom '+lv);
  }
  assert.equal(b.memory.get('ga_rank_skin'), raw);
  assert.deepEqual(b.writes, []);
});
test('Editing one rank preserves its points, badge, and the other fourteen ranks', () => {
  const b = boot({ ga_rank_skin:JSON.stringify({ 7:{ pts:9000, badge:'custom-badge' }, 8:{ pts:12000 } }) });
  b.AV.saveRank(7, { wins1:4, wins2:8, wins3:12 });
  assert.deepEqual(plain(b.AV.rankOf(7)).pts, 9000);
  assert.equal(b.AV.rankOf(7).badge, 'custom-badge');
  assert.deepEqual([b.AV.rankOf(8).pts,b.AV.rankOf(8).wins1,b.AV.rankOf(8).wins2,b.AV.rankOf(8).wins3], [12000,0,3,10]);
  const reloaded = boot({ ga_rank_skin:b.memory.get('ga_rank_skin') }).AV;
  assert.deepEqual([reloaded.rankOf(7).wins1,reloaded.rankOf(7).wins2,reloaded.rankOf(7).wins3], [4,8,12]);
  b.AV.saveRank(7, { wins1:0 }); assert.equal(b.AV.rankOf(7).wins1, 0);
});
test('Invalid/blank/negative/fractional championship values never overwrite settings', () => {
  const b = boot({ ga_rank_skin:JSON.stringify({ 7:{ pts:1000, wins3:13 } }) });
  const before = b.memory.get('ga_rank_skin');
  for (const bad of ['', -1, 1.5, NaN, Infinity, null, true, [], {}, '۱', Number.MAX_SAFE_INTEGER+1]) {
    assert.equal(b.AV.saveRank(7, { wins3:bad }), false, String(bad));
    assert.equal(b.memory.get('ga_rank_skin'), before);
  }
  assert.equal(b.AV.saveRank(7, { pts:3.5 }), true);
  assert.equal(b.AV.saveRank(7, { wins3:'2' }), true);
});
test('Malformed stored thresholds fall back to safe defaults, without modifying storage', () => {
  const b = boot({ ga_rank_skin:JSON.stringify({ 7:{ pts:null, wins1:-1, wins2:'oops', wins3:1.2 } }) });
  const r = b.AV.rankOf(7);
  assert.deepEqual([r.pts,r.wins1,r.wins2,r.wins3], [80,0,3,10]);
  assert.deepEqual(b.writes, []);
});
test('Even existing manual awards cannot bypass the four requirements; stored choice is preserved', () => {
  const raw = JSON.stringify({ alice:{ lv:15 } });
  const b = boot({ ga_honor:raw });
  let h = b.AV.honorOf('ALICE', { pts:100000 });
  assert.equal(h.lv, 4); assert.equal(h.manual, false); assert.equal(h.manualBlocked, true);
  assert.equal(b.memory.get('ga_honor'), raw);
  h = b.AV.honorOf('Alice', { pts:100000, wins2:3, wins3:10 });
  assert.equal(h.lv, 15); assert.equal(h.manual, true); assert.equal(h.manualBlocked, false);
  assert.equal(b.AV.setHonorOverride('alice', null), true);
  assert.equal(b.AV.honorOf('ALICE', all()).manual, false);
});
test('Incomplete championships cannot display a misleading 100% progress bar', () => {
  const h = AV.honorOf('u', { pts:100000 });
  assert.equal(h.next.lv, 5); assert.equal(h.complete, 1); assert.ok(h.prog < 100);
  assert.deepEqual(plain(h.checks.filter(f => !f.met).map(f => f.key)), ['wins3']);
  const x = boot().AV; x.saveRank(5, { wins3:1000000 });
  const nearly = x.honorOf('u', { pts:45, wins3:999999 });
  assert.ok(Math.round(nearly.prog) < 100);
});
test('Rank does not consult coins, spent money, usernames or avatar item purchases', () => {
  const b = boot({ ga_coins:JSON.stringify({ u:{ total:9999999 } }), ga_avatars:JSON.stringify({ u:{ lvl:15, owned:['expensive-item'] } }) });
  assert.equal(b.AV.honorOf('u', { pts:0 }).lv, 1);
  assert.equal(b.AV.honorOf('other', { pts:0 }).lv, 1);
  assert.equal(b.network.length, 0);
});

function history() {
  const results = {
    101:{ participants:[101,'101',102,103], top:{ 1:'101',2:102,3:103 } },
    102:{ participants:[101,102,103], top:{ 1:101,2:102,3:103 } },
    103:{ participants:[101,102,103], top:{ 1:101,2:102,3:103 } },
    104:{ participants:['101','102','103'], top:{ 1:'101',2:'103',3:'102' } },
    105:{ active:false, participants:[101], top:{ 1:101 } },
    107:{ participants:[103,102], top:{ 1:103 } },
    108:{ participants:[102], top:{ 1:'free:Guest',2:102 } },
    9999:{ participants:[101], top:{ 1:101 } },
  };
  const programs = [
    { start:'2021-01-01', participants:[101,101,102,103], top:{ 1:101,2:102 }, p1:12,p2:6,p3:3,entry:2 },
    { start:'2026-01-01', participants:['101',9000], top:{ 1:9000 }, p1:4,entry:1 },
    { active:false, start:'2024-01-01', participants:[101], top:{ 1:101 }, p1:999 },
  ];
  const b = boot({ ga_results:JSON.stringify(results), ga_programs:JSON.stringify(programs),
    ga_tour_override:JSON.stringify({ 101:{ p1:33,p2:22,p3:11,entry:4 } }) });
  const state = {
    players:[[101,'Player A','مرد',1,'2020-01-01',1],[102,'Player B','زن',2,'2020-01-01',1],
      [103,'Inactive player','مرد',3,'2020-01-01',0],[9000,'Custom player','زن',4,'2020-01-01',1]],
    tournaments:[[101,'Old Tier 1',1,1,18,'2024-01-01'],[102,'Old Tier 2',2,1,18,'2025-01-01'],
      [103,'New Tier 3',3,1,18,'2026-01-01'],[104,'Other year Tier 3',3,1,18,'2027-01-01'],
      [105,'Disabled result',2,1,18,'2025-01-01'],[106,'Cards only',3,1,18,'2025-02-01'],
      [107,'Inactive champion',1,1,18,'2025-03-01'],[108,'Guest champion',1,1,18,'2025-04-01']],
    scorecards:[{ tour:101,pid:101,total:60,strokes:{} },{ tour:106,pid:101,total:70,strokes:{} },
      { tour:106,pid:101,total:71,strokes:{} },{ tour:106,pid:102,total:72,strokes:{} }],
    activities:[{ pid:101,points:2,type:'تمرین',date:'2020-01-01' },{ pid:102,points:1.5,type:'آموزش',date:'2026-01-01' },
      { active:false,pid:101,points:100,type:'تمرین',date:'2021-01-01' },{ pid:'free:Guest',points:100,type:'تمرین',date:'2021-01-01' }],
  };
  b.ctx.Battle = { computeSeasonBonus:() => ({ 101:3,102:1 }) };
  return { ...b, state, results, programs };
}

test('Lifetime points include all registered years, programs, activities and enabled battle points', () => {
  const b = history(), s = b.D.careerStats(b.state);
  assert.deepEqual(plain(s[101]), { pts:96,wins1:1,national2:0,national3:0,national4:0,national5:0,wins2:1,wins3:2 });
  assert.equal(s[102].pts, 79.5); assert.equal(s[9000].pts, 4);
});
test('Tier-1/2/3 championships are independent first-place counts, not podium places', () => {
  const b = history(), s = b.D.careerStats(b.state);
  assert.deepEqual([s[102].wins1,s[102].wins2,s[102].wins3], [0,0,0]);
  assert.deepEqual([s[101].wins1,s[101].wins2,s[101].wins3], [1,1,2]);
});
test('Current player inactivity does not erase past achievements', () => {
  const b = history(), s = b.D.careerStats(b.state);
  assert.deepEqual(plain(s[103]), { pts:52,wins1:1,national2:0,national3:1,national4:0,national5:0,wins2:0,wins3:0 });
});
test('Results and scorecards do not double-count a championship or its points', () => {
  const b = history();
  const before = plain(b.D.careerStats(b.state));
  b.state.scorecards.push({ tour:101,pid:101,total:59,strokes:{} });
  assert.deepEqual(plain(b.D.careerStats(b.state)), before);
});
test('Cards without an official result give no championship', () => {
  const b = boot();
  const state = { players:[[1,'A','مرد',0,'2020-01-01',1]], tournaments:[[201,'Unfinalized',3,1,18,'2020-01-01']],
    scorecards:[{ tour:201,pid:1,total:50 }], activities:[] };
  const s = b.D.careerStats(state);
  assert.deepEqual(plain(s[1]), { pts:10,wins1:0,national2:0,national3:0,national4:0,national5:0,wins2:0,wins3:0 });
});
test('Editing, removing or disabling results rebuilds counts; no permanent extra award', () => {
  const b = history();
  b.results[101].top = { 1:102,2:101,3:103 }; b.D.saveResults(b.results);
  let s = b.D.careerStats(b.state);
  assert.equal(s[101].wins1, 0); assert.equal(s[102].wins1, 1);
  b.results[101].active = false; b.D.saveResults(b.results);
  s = b.D.careerStats(b.state); assert.equal(s[102].wins1, 0);
  delete b.results[103]; b.D.saveResults(b.results);
  s = b.D.careerStats(b.state); assert.equal(s[101].wins3, 1);
  b.state.tournaments = b.state.tournaments.filter(t => t[0] !== 104);
  assert.equal(b.D.careerStats(b.state)[101].wins3, 0);
});
test('Changing a competition tier moves its win to the correct independent total', () => {
  const b = history(); b.state.tournaments.find(t => t[0] === 101)[2] = 3;
  const s = b.D.careerStats(b.state)[101];
  assert.deepEqual([s.wins1,s.wins2,s.wins3], [0,1,3]);
});
test('The main analytics returns the same lifetime ledger, not a season-LB alias', () => {
  const b = history(), a = b.D.compute(b.state);
  assert.deepEqual(plain(a.CAREER), plain(b.D.careerStats(b.state)));
  assert.equal(a.LB.find(x => x.pid === 103), undefined);
  assert.equal(a.CAREER[103].wins1, 1);
  const expected = plain(a.CAREER); a.LB.forEach(x => { x.pts = 0; });
  assert.deepEqual(plain(a.CAREER), expected);
});
test('Recompute, reload and year changes never increment or reset a lifetime counter', () => {
  const b = history(); const expected = plain(b.D.careerStats(b.state));
  for (let i=0;i<5;i++) assert.deepEqual(plain(b.D.careerStats(b.state)), expected);
  b.state.tournaments.forEach((t,i) => { t[5] = (2000+i)+'-01-01'; });
  assert.deepEqual(plain(b.D.careerStats(b.state)), expected);
  const reloaded = boot(Object.fromEntries(b.memory));
  reloaded.ctx.Battle = b.ctx.Battle;
  assert.deepEqual(plain(reloaded.D.careerStats(b.state)), expected);
  assert.deepEqual(b.writes, []); assert.deepEqual(b.network, []);
});
console.log(`PASS — ${passed} rank/lifetime scenarios; no live network or database.`);
