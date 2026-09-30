const { getJson, logSection } = require('./lib');
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function discover(c) {
  const params = {
    id:String(c.id||0), tmdb_id:String(c.tmdb_id||''),
    title:c.title, original_title:c.original_title||c.title,
    serial:c.serial?'1':'0', year:String(c.year||''),
    source:c.source||'tmdb', rchtype:'apk',
    clarification:'0', similar:'false',
    original_language:c.lang||''
  };
  const qs = new URLSearchParams(params).toString();
  const start = await getJson('/lite/events?life=true&'+qs);
  if (!start.ok || !start.body || !start.body.memkey) throw new Error('events start failed');
  let out=null;
  for(let i=0;i<30;i++){
    await sleep(400);
    const r=await getJson('/lifeevents?memkey='+encodeURIComponent(start.body.memkey)+'&'+qs);
    if(r.body && r.body.ready){ out=r.body; break; }
  }
  if(!out) throw new Error('lifeevents timeout');
  const online=out.online||[];
  const active=online.filter(x=>x.show);
  return {online,active};
}

(async()=>{
  logSection('Provider discovery');
  const cases=[
    {label:'movie',id:603,tmdb_id:603,title:'The Matrix',year:1999,lang:'en'},
    {label:'series',id:1396,tmdb_id:1396,title:'Breaking Bad',year:2008,lang:'en',serial:true},
    {label:'series-ru',id:0,title:'Любовная магия',year:2021,lang:'ru',serial:true,source:'kp'}
  ];
  let fail=0;
  for(const c of cases){
    try{
      const r=await discover(c);
      const names=r.active.map(x=>(x.balanser||(x.name||'').split(' ')[0]||'').toLowerCase()).filter(Boolean);
      console.log(c.label+': '+c.title+' discovered='+r.online.length+' active='+r.active.length);
      console.log('  active:',names.join(', '));
      if(r.online.length<50 || r.active.length<5) fail++;
      if(c.title==='Любовная магия' && !names.some(n=>n.includes('filmix')||n.includes('collaps')||n.includes('rezka'))) fail++;
    }catch(e){ console.log('FAIL',c.label,c.title,e.message); fail++; }
  }
  if(fail) process.exit(1);
  console.log('\nDISCOVERY PASS');
})().catch(e=>{console.error(e);process.exit(1)});
