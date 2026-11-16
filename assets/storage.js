/* Full-progress backups on the device only: localStorage, sessionStorage, IndexedDB and the URL fragment.
   No cookie is written, so answers are never attached to HTTP requests. A cookie left by an
   older version is read once, copied to on-device storage and deleted.
   No account or server storage is required to restore the data locally.
   The 120 and 300 questionnaires keep separate backups (key, IndexedDB row and legacy
   cookie); AVDPersonalityStorage follows the questionnaire shown on the page. */
(function(root){
  'use strict';
  const DB='avd-personality-local', STORE='answers';
  function createStorage(KEY,ROW,COOKIE){
    const TOKEN_RE=/^[A-Za-z0-9_-]{8,260}$/;
    const COOKIE_PATH=root.location&&(root.location.hostname==='ofilab.avrahamd.ovh'?'/':String(root.location.pathname||'').startsWith('/personality')?'/personality/':'/ofilab/')||'/ofilab/';
    // Revisions belong to browser backups only; public links keep their original codec.
    let revision=0;
    function unpack(value){
      if(typeof value!=='string')return null;
      if(TOKEN_RE.test(value))return {token:value,revision:0};
      const match=/^b2\.(\d+)\.([A-Za-z0-9_-]+)$/.exec(value);
      if(!match||!Number.isSafeInteger(Number(match[1]))||!TOKEN_RE.test(match[2]))return null;
      return {token:match[2],revision:Number(match[1])};
    }
    function cookieRead(){
      try{
        const pair=String(root.document.cookie||'').split(';')
          .map(part=>part.trim()).find(part=>part.startsWith(COOKIE+'='));
        if(!pair)return null;
        const token=pair.slice(COOKIE.length+1);
        return unpack(token)?token:null;
      }catch(e){return null}
    }
    function cookieClear(){
      try{
        const secure=root.location && root.location.protocol==='https:'?'; Secure':'';
        root.document.cookie=COOKIE+'=; Path='+COOKIE_PATH+'; Max-Age=0; SameSite=Strict'+secure;
      }catch(e){}
    }
    function store(name){
      try { return root[name]||null; } catch(e){ return null; }
    }
    function put(area,token){
      if(!area)return false;
      try{area.setItem(KEY,token);return area.getItem(KEY)===token}catch(e){return false}
    }
    function take(area){
      try{return area&&area.getItem(KEY)||null}catch(e){return null}
    }
    function openDB(){
      return new Promise(resolve=>{
        let req,done=false;
        const timer=setTimeout(()=>finish(null),1500);
        function finish(value){if(done){if(value)value.close();return;}done=true;clearTimeout(timer);resolve(value);}
        try{if(!root.indexedDB)return finish(null);req=root.indexedDB.open(DB,1)}
        catch(e){return finish(null)}
        req.onupgradeneeded=()=>{try{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)}catch(e){}};
        req.onsuccess=()=>finish(req.result);
        req.onerror=req.onblocked=()=>finish(null);
      });
    }
    let dbPromise=null;
    function db(){return dbPromise||(dbPromise=openDB());}
    function dbValue(value,remove=false){
      return db().then(conn=>new Promise(resolve=>{
        if(!conn)return resolve(null);
        let tx,result=null;
        const timer=setTimeout(()=>{try{if(tx)tx.abort()}catch(e){}finish(null)},1500);
        function finish(value){clearTimeout(timer);resolve(value);}
        try{
          tx=conn.transaction(STORE,value===undefined&&!remove?'readonly':'readwrite');
          const area=tx.objectStore(STORE);
          const request=remove?area.delete(ROW):value===undefined?area.get(ROW):area.put(value,ROW);
          request.onsuccess=()=>{result=value===undefined&&!remove?request.result||null:true;};
          request.onerror=tx.onabort=tx.onerror=()=>finish(null);
          // Request success is not a committed write: quota errors may still abort.
          tx.oncomplete=()=>finish(result);
        }catch(e){finish(null)}
      })).catch(()=>null);
    }
    // Keep IndexedDB writes ordered. Rapid clicks must not overwrite the newest
    // response with an earlier asynchronously opened transaction.
    let writes=Promise.resolve();
    function save(token){
      if(typeof token!=='string'||!TOKEN_RE.test(token))return Promise.resolve(false);
      const previous=[take(store('localStorage')),take(store('sessionStorage')),cookieRead()];
      for(const value of previous){const entry=unpack(value);if(entry)revision=Math.max(revision,entry.revision);}
      revision=Math.max(Date.now(),revision+1);
      const backup='b2.'+revision+'.'+token;
      const local=put(store('localStorage'),backup);
      const session=put(store('sessionStorage'),backup);
      writes=writes.catch(()=>{}).then(()=>dbValue(backup));
      // No cookie is written. One left by an older version is removed once the progress is safe elsewhere.
      return writes.then(ok=>{const kept=local||session||!!ok;if(kept)cookieClear();return kept;},()=>{if(local||session)cookieClear();return local||session;});
    }
    // One-time migration: progress found in a legacy cookie is copied to on-device storage, then the
    // cookie is deleted. It is kept only if nothing else on the device can hold the progress.
    function retireCookie(entry){
      if(!cookieRead())return;
      const backup='b2.'+entry.revision+'.'+entry.token;
      const newest=value=>{const e=unpack(value);return !e||e.revision<=entry.revision;};
      let kept=false;
      for(const name of ['localStorage','sessionStorage']){
        const area=store(name);
        if(newest(take(area)))kept=put(area,backup)||kept;else kept=true;
      }
      if(kept){cookieClear();return;}
      writes=writes.catch(()=>{}).then(()=>dbValue(backup)).then(ok=>{if(ok)cookieClear();});
    }
    async function read(validator){
      await writes.catch(()=>{});
      const fromDb=await dbValue();
      const candidates=[take(store('localStorage')),take(store('sessionStorage')),cookieRead(),fromDb]
        .map(unpack).filter(Boolean).sort((a,b)=>b.revision-a.revision);
      for(const entry of candidates){
        revision=Math.max(revision,entry.revision);
        try{if(!validator||validator(entry.token)){retireCookie(entry);return entry.token;}}catch(e){}
      }
      return null;
    }
    function clear(){
      cookieClear();
      for(const name of ['localStorage','sessionStorage']){
        const area=store(name);
        try{if(area)area.removeItem(KEY)}catch(e){}
      }
      writes=writes.catch(()=>{}).then(()=>dbValue(undefined,true));
      return writes;
    }
    return {save,read,clear,KEY,COOKIE};
  }
  const storage120=createStorage('avd-personality:ipip-neo-120:he:v1','current','avd_personality_progress');
  // IPIP-NEO-300 regular-mode storage; supports canonical V1 and V2 tokens.
  const storage300=createStorage('avd-personality:ipip-neo-300:he:v1','extended-300','avd_personality_300_progress');
  root.AVDPersonalityStorage120=storage120;
  root.AVDPersonalityStorage300=storage300;
  Object.defineProperty(root,'AVDPersonalityStorage',{
    get(){return root.document?.documentElement?.dataset?.inventory==='ipip-neo-300'?storage300:storage120;},
    set(v){root._customStorage=v;},configurable:true
  });
  if(typeof module!=='undefined'&&module.exports)module.exports={storage120,storage300,createStorage};
})(typeof window!=='undefined'?window:globalThis);
