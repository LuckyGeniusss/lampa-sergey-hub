const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','js'),'utf8');
const a=src.indexOf('  function wazoEnsureUnifiedPlaylist() {'),b=src.indexOf('\n  function startPlugin()',a);
assert(a>=0&&b>a,'missing migration');
const root='https://raw.githubusercontent.com/LuckyGeniusss/lampa-sergey-hub/main/iptv/';
let values=[
 {id:'foreign',custom:true,name:'Personal',url:'https://other.example/playlist.m3u'},
 {id:'wazo_tv',custom:true,name:'Wazo TV - old all',url:root+'wazo_tv.m3u'},
 {id:'wazo_cinema',custom:true,name:'Wazo cinema',url:root+'wazo_cinema.m3u'},
 {id:'wazo_ireland',custom:true,name:'Wazo Irish',url:root+'wazo_ireland.m3u'},
 {id:'external2',url:'https://my.example/m3u',name:'My channels'}
],writes=0;
const ctx={console:{log(){},warn(){},error(){}},Lampa:{Storage:{
 get:()=>structuredClone(values),
 set:(key,next)=>{assert.equal(key,'iptv_playlist_custom');values=structuredClone(next);writes++}
}}};
vm.createContext(ctx);
vm.runInContext(src.slice(a,b)+'\nwazoEnsureUnifiedPlaylist();',ctx);
assert.equal(values.length,3);assert.equal(values.filter(v=>v.url===root+'wazo_tv.m3u').length,1);
assert.equal(values.find(v=>v.id==='wazo_tv').name,'Wazo TV — Все каналы');
assert.deepEqual(values.filter(v=>v.id==='foreign'||v.id==='external2').map(v=>v.id),['foreign','external2']);
assert.equal(writes,1);
vm.runInContext('wazoEnsureUnifiedPlaylist();',ctx);
assert.equal(writes,1,'must be idempotent');
values=[{id:'personal',name:'Private',url:'https://private.example/a.m3u'},{id:'wazo_ireland',url:root+'wazo_ireland.m3u'}];writes=0;
vm.runInContext('wazoEnsureUnifiedPlaylist();',ctx);
assert.equal(values.length,2);assert.equal(values[0].id,'personal');assert.equal(values[1].id,'wazo_unified');assert.equal(writes,1);
console.log('PASS: migration keeps user lists, removes obsolete Wazo lists, preserves active main ID, is idempotent');