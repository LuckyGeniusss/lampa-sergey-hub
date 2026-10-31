const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const src=fs.readFileSync(require('path').join(__dirname,'../js'),'utf8');
const a=src.indexOf('  var wazoPendingPlayback = null;');
const b=src.indexOf('  // WAZO_PLAYBACK_WATCHER_END',a);
assert(a>=0&&b>a);
const handlers={};
const ctx={
 window:{},
 Lampa:{PlayerVideo:{listener:{follow:(type,fn)=>{handlers[type]=fn;}}}},
 console:{warn(){},log(){}},
 Date
};
vm.runInNewContext(src.slice(a,b),ctx);
vm.runInNewContext('wazoInstallPlaybackWatcher()',ctx);
assert.deepStrictEqual(Object.keys(handlers).sort(),['destroy','error','timeupdate']);
let failed=0, success=0;
function pending(at=Date.now()) {
 ctx.__set=undefined;
 vm.runInNewContext('wazoPendingPlayback = globalPending',Object.assign(ctx,{globalPending:{at,fail(){failed++},ok(){success++}}}));
}
pending();
handlers.error({error:'details [manifestLoadError] fatal [true]',fatal:false});
assert.equal(failed,0,'nonfatal should not fallback');
handlers.error({error:'details [manifestLoadError] fatal [true]',fatal:true});
handlers.error({error:'details [manifestLoadError] fatal [true]',fatal:true});
assert.equal(failed,1,'fatal must fallback exactly once');
pending();
handlers.timeupdate({current:2.5});
handlers.error({fatal:true});
assert.equal(success,1,'confirmed playback success should complete');
assert.equal(failed,1,'successful stream must ignore old errors');
pending(Date.now()-92000);
handlers.error({fatal:true});
assert.equal(failed,1,'stale stream should not fallback');
pending();
handlers.destroy();
handlers.error({fatal:true});
assert.equal(failed,1,'closed player should not fallback');
assert(src.includes('failedToStart(\x27provider did not return a playable URL\x27'), 'missing link detection');
assert(src.includes('failedSourcesForMovie()[balanser]) && !object.lampac_custom_select'),'failed provider selection must be avoided');
assert(!src.includes('item.mark();\n                _this5.updateBalanser(balanser);'),'do not mark chosen before playable');
console.log('PASS WAZO fatal-HLS retry guard, nonfatal, no-link, success, stale, destroy');
