const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(require('node:path').join(__dirname,'..','js'),'utf8');
const start=src.indexOf('  function wazoConfigureIptvRefresh() {');
const end=src.indexOf('  // Cub may also render legacy Wazo entries',start);
assert(start>=0&&end>start);
const data={update:'none',update_time:12345,loading:'cub',keep:'user'};
const kv={};
const edits=[];
class MockDB {
  openDatabase(){return Promise.resolve()}
  getDataAnyCase(store,id){assert.equal(store,'params');assert.equal(id,'wazo_unified');return Promise.resolve(data)}
  rewriteData(store,id,value){edits.push({store,id,value});return Promise.resolve()}
}
const ctx={Lampa:{DB:MockDB,Storage:{get:(key,def)=>key in kv?kv[key]:def,set:(key,v)=>{kv[key]=v}}},console:{log(){},warn(){}}};
vm.createContext(ctx);
vm.runInContext(src.slice(start,end)+'\nwazoConfigureIptvRefresh()',ctx);
setImmediate(()=>{
 assert.equal(edits.length,1);
 assert.equal(edits[0].store,'params');
 assert.equal(edits[0].id,'wazo_unified');
 assert.equal(edits[0].value.update,'day');
 assert.equal(edits[0].value.update_time,0);
 assert.equal(edits[0].value.loading,'lampa');
 assert.equal(edits[0].value.keep,'user');
 assert.equal(kv.wazo_iptv_refresh_revision,'20261031-world-2732');
 vm.runInContext('wazoConfigureIptvRefresh()',ctx);
 assert.equal(edits.length,1,'already migrated revision must not rewrite params');
 console.log('PASS IPTV update policy, one-time refresh, preserved unrelated parameters');
});