/* Surplus-only downward equivalence and five national placements. No live network. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const plain=x=>JSON.parse(JSON.stringify(x));
function boot(seed={}){
 const memory=new Map(Object.entries({ga_seed_v2:'1405',ga_cleanup_practice_v1:'1',...seed})),writes=[];
 const ctx=vm.createContext({console,location:{protocol:'file:'},setTimeout:()=>0,setInterval:()=>0,clearTimeout:()=>{},localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>{memory.set(k,String(v));writes.push(k)},removeItem:k=>memory.delete(k)}});ctx.window=ctx;
 for(const f of ['data','avatar'])vm.runInContext(fs.readFileSync(path.join(ROOT,'js/'+f+'.js'),'utf8'),ctx);
 return {A:ctx.AV,D:ctx.Data,memory,writes};
}
const {A}=boot(),R=A.rankRules();
const req=o=>({...A.rankOf(1),pts:100,...o});
const stats=o=>({pts:100,...o});
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name)}
test('Published defaults: 1 national champion = 10 tier-2; 1 tier-2 = 3 tier-3',()=>{
 assert.deepEqual(plain(R.nationalTo2),{1:10,2:0,3:0,4:0,5:0});assert.equal(R.tier2To3,3);assert.equal(R.betterNational,true);
});
test('User example: 1 tier-2 substitutes for 3 tier-3 when tier-2 itself is not required',()=>{
 assert.equal(A.requirementsMet(req({wins3:3}),stats({wins2:1})),true);
});
test('User example: reserving that tier-2 victory leaves no credit for the required three tier-3',()=>{
 const goal=req({wins2:1,wins3:3}),original=stats({wins2:1});
 assert.equal(A.requirementsMet(goal,original),false);
 assert.equal(A.requirementsMet(goal,stats({wins2:2})),true);
 assert.equal(A.requirementsMet(goal,stats({wins2:1,wins3:3})),true);
 assert.equal(A.rankEvaluation(goal,original).tier3Credit,0);
 const plans=plain(A.upgradePlans(goal,original));
 assert.ok(plans.some(x=>x.wins2===1 && Object.keys(x).length===1));
 assert.ok(plans.some(x=>x.wins3===3 && Object.keys(x).length===1));
});
test('A national title needed at tier-1 cannot also become ten tier-2 titles',()=>{
 const goal=req({wins1:1,wins2:10});
 assert.equal(A.requirementsMet(goal,stats({wins1:1})),false);
 assert.equal(A.requirementsMet(goal,stats({wins1:2})),true);
});
test('A national surplus can be split between lower needs without double-counting value',()=>{
 assert.equal(A.requirementsMet(req({wins2:7,wins3:9}),stats({wins1:1})),true);
 assert.equal(A.requirementsMet(req({wins2:7,wins3:10}),stats({wins1:1})),false);
 assert.equal(A.requirementsMet(req({wins1:1,wins2:10,wins3:3}),stats({wins1:2})),false);
 assert.equal(A.requirementsMet(req({wins1:1,wins2:10,wins3:3}),stats({wins1:2,wins2:1})),true);
});
test('No upward conversion, irrespective of the number of lower-level victories',()=>{
 assert.equal(A.requirementsMet(req({wins1:1}),stats({wins2:100000,wins3:100000})),false);
 assert.equal(A.requirementsMet(req({national5:1}),stats({wins2:100000,wins3:100000})),false);
 assert.equal(A.requirementsMet(req({wins2:1}),stats({wins3:100000})),false);
});
test('Plenty of medals never replaces missing lifetime points',()=>{
 assert.equal(A.requirementsMet(req({pts:101,wins3:3}),stats({wins1:100})),false);
});
test('Fifth place is a genuine independent national achievement',()=>{
 assert.equal(A.requirementsMet(req({national5:1}),stats({national5:1})),true);
 assert.equal(A.requirementsMet(req({wins1:1}),stats({national5:100})),false);
 assert.equal(A.requirementsMet(req({wins2:1}),stats({national5:1})),false,'No invented fifth-place rate');
});
test('A better national result may satisfy fifth-or-better, with a configurable exact-place mode',()=>{
 assert.equal(A.requirementsMet(req({national5:1}),stats({wins1:1})),true);
 assert.equal(A.requirementsMet(req({national5:1}),stats({national3:1})),true);
 assert.equal(A.requirementsMet(req({national5:1}),stats({wins1:1}),{...R,betterNational:false}),false);
 assert.equal(A.requirementsMet(req({national5:1}),stats({national5:1}),{...R,betterNational:false}),true);
});
test('One national result is not counted once for champion and again for fifth place',()=>{
 assert.equal(A.requirementsMet(req({wins1:1,national5:1}),stats({wins1:1})),false);
 assert.equal(A.requirementsMet(req({wins1:1,national5:1}),stats({wins1:2})),true);
 assert.equal(A.requirementsMet(req({national5:1,wins2:1}),stats({wins1:1})),false);
 assert.equal(A.requirementsMet(req({national5:1,wins2:10}),stats({wins1:1,national5:1})),true);
});
test('National allocation conserves convertible value even with edited, non-monotonic rates',()=>{
 const r={...R,nationalTo2:{1:1,2:10,3:0,4:0,5:0}};
 assert.equal(A.requirementsMet(req({national2:1,wins2:10}),stats({wins1:1,national2:1}),r),true);
 assert.equal(A.requirementsMet(req({wins1:1,national2:1,wins2:10}),stats({wins1:1,national2:1}),r),false);
});
test('Other national places convert only after admin explicitly assigns their rates',()=>{
 const r={...R,nationalTo2:{...R.nationalTo2,5:2}};
 assert.equal(A.requirementsMet(req({wins3:6}),stats({national5:1}),r),true);
 assert.equal(A.requirementsMet(req({wins3:7}),stats({national5:1}),r),false);
 assert.equal(A.requirementsMet(req({national5:1,wins3:1}),stats({national5:1}),r),false);
});
test('Disabling conversion leaves direct achievements intact',()=>{
 const r={...R,tier2To3:0,nationalTo2:{1:0,2:0,3:0,4:0,5:0}};
 assert.equal(A.requirementsMet(req({wins3:1}),stats({wins1:100,wins2:100}),r),false);
 assert.equal(A.requirementsMet(req({wins3:1}),stats({wins3:1}),r),true);
});
test('Manual rank assignments use the same reservation and equivalence rules',()=>{
 const b=boot();b.A.saveRank(15,{pts:100,wins2:1,wins3:3});b.A.setHonorOverride('member',15);
 assert.equal(b.A.honorOf('member',stats({wins2:1})).manualBlocked,true);
 assert.equal(b.A.honorOf('member',stats({wins2:2})).lv,15);
});
test('Saving rules never rewrites any existing rank threshold, appearance or real achievements',()=>{
 const skin=JSON.stringify({7:{pts:35000,wins1:2,badge:'kept'}}),records=JSON.stringify({1:{participants:[1],top:{1:1}}});
 const b=boot({ga_rank_skin:skin,ga_results:records});
 const r={...b.A.rankRules(),tier2To3:4,note:'قواعد نمونه'};
 assert.equal(b.A.saveRankRules(r),true);assert.equal(b.memory.get('ga_rank_skin'),skin);assert.equal(b.memory.get('ga_results'),records);
 assert.deepEqual(b.writes,['ga_rank_rules']);assert.equal(boot(Object.fromEntries(b.memory)).A.rankRules().tier2To3,4);
 for(const bad of [-1,1.5,Infinity,'',10001]){const before=b.memory.get('ga_rank_rules');assert.equal(b.A.saveRankRules({...r,tier2To3:bad}),false);assert.equal(b.memory.get('ga_rank_rules'),before);}
});
test('Evaluation and suggestions are pure, repeatable and never spend stored achievements',()=>{
 const r=req({wins1:1,national3:1,wins2:3,wins3:10}),s=stats({wins1:2,national3:1,wins2:2});
 const before=JSON.stringify(s),got=plain(A.rankEvaluation(r,s));
 for(let i=0;i<10;i++)assert.deepEqual(plain(A.rankEvaluation(r,s)),got);
 A.upgradePlans(r,s);assert.equal(JSON.stringify(s),before);
});
test('All displayed upgrade alternatives really fulfill every achievement prerequisite jointly',()=>{
 const goals=[{wins2:1,wins3:3},{wins1:1,wins2:10,wins3:3},{national5:1,wins2:3,wins3:10},{wins1:1,national2:2,national5:3,wins3:7}];
 for(const g of goals)for(const actual of [{},{wins2:1},{wins1:1,national5:1},{national2:1,wins3:5}]){
  const goal=req(g),s=stats(actual),plans=plain(A.upgradePlans(goal,s));
  if(A.requirementsMet(goal,s))continue;
  assert.ok(plans.length>0);
  for(const plan of plans){const next={...s};for(const [k,v]of Object.entries(plan))next[k]=(next[k]||0)+v;assert.equal(A.requirementsMet(goal,next),true,JSON.stringify({g,actual,plan}));}
 }
});
test('Exhaustive small-stock comparison to a conserved three-level budget',()=>{
 for(let a=0;a<=3;a++)for(let b=0;b<=3;b++)for(let c=0;c<=3;c++)for(let x=0;x<=2;x++)for(let y=0;y<=4;y++)for(let z=0;z<=5;z++){
  const expected=a>=x && b+(a-x)*10>=y && c+(b+(a-x)*10-y)*3>=z;
  assert.equal(A.requirementsMet(req({wins1:x,wins2:y,wins3:z}),stats({wins1:a,wins2:b,wins3:c})),expected,JSON.stringify({a,b,c,x,y,z}));
 }
});

const tour=[1000,'Synthetic national event',1,1,3,'2024-01-01'];
const result=()=>({participants:[1,2,3,4,5,6],top:{1:1,2:2,3:3}});
const cards=()=>Array.from({length:6},(_,i)=>({tour:1000,pid:i+1,strokes:{1:3+i,2:4,3:3}}));
function nationalEnv(){return boot({ga_tournaments:JSON.stringify([{name:'Synthetic national event',lvl:1,course:1,holes:3,date:'2024-01-01',holeIds:[1,2,3]}])});}
test('Explicit national first through fifth places are each recorded exactly once',()=>{
 const b=nationalEnv(),res=result();res.top[4]=4;res.top[5]=5;
 const places=plain(b.D.nationalPlaces(tour,res,[]));assert.deepEqual(places,{'1':1,'2':2,'3':3,'4':4,'5':5});
 const state={players:[1,2,3,4,5,6].map(id=>[id,'Synthetic '+id,'مرد',1,'2020-01-01',1]),tournaments:[tour],scorecards:[],activities:[]};
 const s=b.D.careerStats(state,{results:{1000:res},programs:[],recordedCards:[],battleBonus:{}});
 assert.equal(s[1].wins1,1);assert.equal(s[2].national2,1);assert.equal(s[3].national3,1);assert.equal(s[4].national4,1);assert.equal(s[5].national5,1);assert.equal(s[6].national5,0);
 assert.equal(s[4].pts,5);assert.equal(s[5].pts,5,'No invented fourth/fifth prize points');
});
test('Complete recorded historical cards can recover unambiguous fourth and fifth places',()=>{
 const b=nationalEnv();assert.deepEqual(plain(b.D.nationalPlaces(tour,result(),cards())),{'1':1,'2':2,'3':3,'4':4,'5':5});
});
test('No fourth/fifth place is guessed from participant order, incomplete or missing cards',()=>{
 const b=nationalEnv();assert.deepEqual(plain(b.D.nationalPlaces(tour,result(),[])),{'1':1,'2':2,'3':3});
 let c=cards();c.pop();assert.equal(b.D.nationalPlaces(tour,result(),c)['4'],undefined);
 c=cards();delete c[5].strokes[3];assert.equal(b.D.nationalPlaces(tour,result(),c)['4'],undefined);
});
test('Ties, conflicting official podiums and explicitly cleared places do not get invented',()=>{
 const b=nationalEnv();let c=cards();c[4].strokes={...c[3].strokes};
 assert.equal(b.D.nationalPlaces(tour,result(),c)['4'],undefined);assert.equal(b.D.nationalPlaces(tour,result(),c)['5'],undefined);
 const res=result();res.top[1]=2;res.top[2]=1;assert.equal(b.D.nationalPlaces(tour,res,cards())['4'],undefined);
 const cleared=result();cleared.top[4]=null;cleared.top[5]=null;assert.equal(b.D.nationalPlaces(tour,cleared,cards())['4'],undefined);
});
test('A duplicate corrupt podium cannot award the same player two national places',()=>{
 const b=nationalEnv(),r=result();r.top[4]=2;r.top[5]=2;
 assert.deepEqual(plain(b.D.nationalPlaces(tour,r,[])),{'1':1,'2':2,'3':3});
});
test('Tier-2/3 podium places are not national medals',()=>{
 const b=nationalEnv();assert.deepEqual(plain(b.D.nationalPlaces([...tour.slice(0,2),2,...tour.slice(3)],result(),cards())),{});
});
console.log(`PASS — ${passed} equivalence/national scenarios, including 5760 conserved-budget combinations; no live requests.`);
