/* ofiLab client-side authenticated encryption. All new saves use Argon2id v1.3.
   Legacy headers [survey,1,1,salt(16),nonce(12)] remain readable via PBKDF2.
   New headers [survey,2,2,salt(16),nonce(12)] select Argon2id m=64MiB,t=2,p=1.
   All header bytes are authenticated as AES-256-GCM AAD. No password is sent to server. */
(function(root){
'use strict';
const OLD_KDF=1,OLD_COST=1,NEW_KDF=2,NEW_COST=2,LEGACY_ITERATIONS=600000,HEADER_BYTES=31;
const c=root.crypto,codec=root.OfiLabCompactV2;
let activeKey=null,activeSalt=null,activeKdf=null,activeInventory=null,sessionEpoch=0;
const inventory=()=>root.document?.documentElement?.dataset?.inventory==='ipip-neo-300'?'ipip-neo-300':'ipip-neo-120';
const versionFor=inv=>inv==='ipip-neo-300'?0xe2:0xe3;
const invForCode={226:'ipip-neo-300',227:'ipip-neo-120'};
const LEGACY_DEPRECATED_CODES={228:'ipip-50'};
const expectedLenForInv={'ipip-neo-120':120,'ipip-neo-300':300};
const version=()=>versionFor(inventory());
const storageKey=()=> 'avd-personality:'+inventory()+':encrypted:v1';
function assert(ok,message){if(!ok)throw Error(message);}
function epochErr(){const e=Error('פעולת ההצפנה בוטלה עקב שינוי מצב.');e.code='STALE_EPOCH';return e;}
function beginSession(inv){sessionEpoch++;if(activeInventory&&inv&&activeInventory!==inv){activeKey=null;activeSalt=null;activeKdf=null;activeInventory=null;}return sessionEpoch;}
function to64(bytes){let b64;if(typeof Buffer!=='undefined')b64=Buffer.from(bytes).toString('base64');else{let str='';for(const b of bytes)str+=String.fromCharCode(b);b64=btoa(str);}return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function from64(s){assert(typeof s==='string'&&s.length>0&&s.length<=800&&/^[A-Za-z0-9_-]+$/.test(s),'Invalid protected save');const t=s.replace(/-/g,'+').replace(/_/g,'/');let arr;if(typeof Buffer!=='undefined')arr=Uint8Array.from(Buffer.from(t,'base64'));else arr=Uint8Array.from(atob(t+'='.repeat((4-t.length%4)%4)),v=>v.charCodeAt(0));assert(to64(arr)===s,'Noncanonical protected save');return arr;}
function normalizeSupp(supp){
  if(supp==null)return null;
  if(typeof supp!=='object')throw Error('Invalid supplementary bundle');
  const checkTok=(raw,re,codecObj,label)=>{
    if(raw==null||raw==='')return null;
    if(typeof raw!=='string'||!re.test(raw))throw Error('Invalid '+label+' supplementary token');
    if(codecObj&&typeof codecObj.decode==='function')codecObj.decode(raw);
    return raw;
  };
  const h=checkTok(supp.h,/^[A-Za-z0-9_-]{7}$/,root.OfiHexacoCodec,'HEXACO');
  const v=checkTok(supp.v,/^[A-Za-z0-9_-]{24}$/,root.OfiViaCodec,'VIA');
  const a=checkTok(supp.a,/^[A-Za-z0-9_-]{5}$/,root.OfiEcrrsCodec,'ECR-RS');
  return (h||v||a)?{h,v,a}:null;
}
function packPlain(plain,supp){
  const main=from64(plain),ns=normalizeSupp(supp);
  if(!ns)return main;
  const flags=(ns.h?1:0)|(ns.v?2:0)|(ns.a?4:0);
  const extra=(ns.h?7:0)+(ns.v?24:0)+(ns.a?5:0);
  const out=new Uint8Array(2+extra+main.length);
  out[0]=0x7f;out[1]=flags;
  let pos=2;
  for(const tok of [ns.h,ns.v,ns.a]){if(!tok)continue;for(let i=0;i<tok.length;i++)out[pos++]=tok.charCodeAt(i);}
  out.set(main,pos);
  return out;
}
function unpackPlain(bytes){
  if(bytes[0]!==0x7f)return {plain:to64(bytes),supp:null};
  assert(bytes.length>=10,'Invalid protected bundle');
  const flags=bytes[1];assert(flags>=1&&flags<=7,'Invalid protected bundle flags');
  let pos=2;const supp={h:null,v:null,a:null};
  const readTok=len=>{assert(pos+len<bytes.length,'Truncated protected bundle');let s='';for(let i=0;i<len;i++)s+=String.fromCharCode(bytes[pos++]);assert(/^[A-Za-z0-9_-]+$/.test(s),'Invalid bundled token');return s;};
  if(flags&1)supp.h=readTok(7);
  if(flags&2)supp.v=readTok(24);
  if(flags&4)supp.a=readTok(5);
  return {plain:to64(bytes.subarray(pos)),supp};
}
function requireCrypto(){assert(c&&c.subtle&&typeof c.getRandomValues==='function','נדרש דפדפן עדכני בחיבור HTTPS כדי לבצע הצפנה מאובטחת.');}
function random(size){const a=new Uint8Array(size);c.getRandomValues(a);return a;}
function header(salt,nonce,kdf){const h=new Uint8Array(HEADER_BYTES);h[0]=version();h[1]=kdf;h[2]=kdf===NEW_KDF?NEW_COST:OLD_COST;h.set(salt,3);h.set(nonce,19);return h;}
function parse(token,expectedInv){const raw=from64(token);assert(raw.length>=HEADER_BYTES+16+7&&raw.length<=700,'Invalid protected save length');const code=raw[0],kdf=raw[1],cost=raw[2];if(LEGACY_DEPRECATED_CODES[code]&&((kdf===OLD_KDF&&cost===OLD_COST)||(kdf===NEW_KDF&&cost===NEW_COST))){const err=Error('שמירה מוגנת של גרסת 50 (IPIP-50) יצאה משימוש. ניתן להתחיל שאלון 120 או 300.');err.code='LEGACY_50_DEPRECATED';throw err;}const expVer=expectedInv?versionFor(expectedInv):version();assert(code===expVer&&((kdf===OLD_KDF&&cost===OLD_COST)||(kdf===NEW_KDF&&cost===NEW_COST)),'Unsupported protected save version');return{raw,meta:raw.slice(0,HEADER_BYTES),kdf,salt:raw.slice(3,19),iv:raw.slice(19,31),ciphertext:raw.slice(31)};}
async function legacyKey(password,salt){const input=await c.subtle.importKey('raw',new TextEncoder().encode(password.normalize('NFC')),'PBKDF2',false,['deriveKey']);return c.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',iterations:LEGACY_ITERATIONS,salt},input,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function argonKey(password,salt){
  assert(typeof root.Worker==='function','הדפדפן אינו תומך ב־Web Workers הדרושים ל־Argon2id.');
  const workerUrl=new URL('./assets/argon2-worker.js',root.document.baseURI).href;
  return new Promise((resolve,reject)=>{
    let w,finished=false,timer;
    const end=(error,key)=>{if(finished)return;finished=true;clearTimeout(timer);if(w)w.terminate();if(error)reject(error);else resolve(key);};
    try{w=new root.Worker(workerUrl);timer=setTimeout(()=>end(Error('ההצפנה התעכבה. נסה שוב במכשיר עם יותר זיכרון.')),90000);
      w.onerror=()=>end(Error('לא ניתן להפעיל Argon2id במכשיר זה. בדוק תמיכה ב־WASM ו־Worker.'));
      w.onmessage=async ev=>{
        if(finished)return;
        if(!ev.data||ev.data.ok!==true||!(ev.data.key instanceof ArrayBuffer)){end(Error('Argon2id נכשל: '+(ev.data?.error||'תקלה לא ידועה')));return;}
        const bytes=new Uint8Array(ev.data.key);
        try{assert(bytes.length===32,'Invalid Argon2id key length');const key=await c.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['encrypt','decrypt']);end(null,key);}
        catch(e){end(Error('ייבוא מפתח ההצפנה נכשל.'));}
        finally{bytes.fill(0);}
      };
      w.postMessage({password:password.normalize('NFC'),salt:Array.from(salt)});
    }catch(e){end(Error('לא ניתן לאתחל Argon2id בדפדפן.')); }
  });
}
async function derive(password,salt,kdf){requireCrypto();assert(typeof password==='string'&&password.length>0,'יש להזין סיסמה.');return kdf===OLD_KDF?legacyKey(password,salt):argonKey(password,salt);}
async function seal(plain,key,salt,kdf,supp){requireCrypto();const myEpoch=sessionEpoch;assert(codec&&typeof codec.decode==='function','Compact V2 missing');const state=codec.decode(plain);assert(state.version===2,'Only V2 can be encrypted');const iv=random(12),meta=header(salt,iv,kdf),body=packPlain(plain,supp);const encrypted=new Uint8Array(await c.subtle.encrypt({name:'AES-GCM',iv,additionalData:meta,tagLength:128},key,body));if(myEpoch!==sessionEpoch)throw epochErr();const out=new Uint8Array(meta.length+encrypted.length);out.set(meta);out.set(encrypted,meta.length);return to64(out);}
async function create(password,plain,supp){requireCrypto();const myEpoch=sessionEpoch;assert(typeof password==='string'&&[...password.normalize('NFC')].length>=8,'יש להשתמש בסיסמה באורך 8 תווים לפחות.');const salt=random(16),key=await derive(password,salt,NEW_KDF);if(myEpoch!==sessionEpoch)throw epochErr();const encrypted=await seal(plain,key,salt,NEW_KDF,supp);if(myEpoch!==sessionEpoch)throw epochErr();activeKey=key;activeSalt=salt;activeKdf=NEW_KDF;activeInventory=inventory();return encrypted;}
function active(){assert(activeKey&&activeSalt&&activeInventory===inventory(),'השמירה המוגנת נעולה.');}
async function encrypt(plain,supp){active();return seal(plain,activeKey,activeSalt,activeKdf,supp);}
async function decryptPacket(packet,password,expectedInv){const myEpoch=sessionEpoch;const key=await derive(password,packet.salt,packet.kdf);if(myEpoch!==sessionEpoch)throw epochErr();let bytes;try{bytes=new Uint8Array(await c.subtle.decrypt({name:'AES-GCM',iv:packet.iv,additionalData:packet.meta,tagLength:128},key,packet.ciphertext));}catch(e){throw Error('הסיסמה שגויה או שהקישור נפגם.');}if(myEpoch!==sessionEpoch)throw epochErr();const unpacked=unpackPlain(bytes);bytes.fill(0);const state=codec.decode(unpacked.plain);const expInv=expectedInv||invForCode[packet.meta[0]]||inventory();const expLen=expectedLenForInv[expInv];assert(state?.version===2&&Array.isArray(state.answers)&&state.answers.length===expLen&&Array.from(state.answers).every(v=>Number.isInteger(v)&&v>=0&&v<=5),'Unexpected decrypted codec state');return {key,plain:unpacked.plain,supp:unpacked.supp};}
async function unlockBundle(token,password){requireCrypto();const myEpoch=sessionEpoch,packet=parse(token),res=await decryptPacket(packet,password,inventory());if(myEpoch!==sessionEpoch)throw epochErr();activeKey=res.key;activeSalt=packet.salt;activeKdf=packet.kdf;activeInventory=inventory();return {plain:res.plain,supp:res.supp};}
async function unlock(token,password){const res=await unlockBundle(token,password);return res.plain;}
async function decryptOnly(token,password,expectedInv){requireCrypto();const packet=parse(token,expectedInv),res=await decryptPacket(packet,password,expectedInv);return {plain:res.plain,supp:res.supp};}
function needsUpgrade(){return !!activeKey&&activeInventory===inventory()&&activeKdf===OLD_KDF;}
async function upgrade(password,plain,supp){assert(needsUpgrade(),'Only legacy saves can be upgraded');return create(password,plain,supp);}
function lock(){sessionEpoch++;activeKey=null;activeSalt=null;activeKdf=null;activeInventory=null;}
function getStore(name){try{return root[name]}catch(e){return null;}}
function put(store,token){try{if(store){store.setItem(storageKey(),token);return store.getItem(storageKey())===token;}}catch(e){}return false;}
function saveLocal(token){parse(token);const local=getStore('localStorage'),session=getStore('sessionStorage');const okLocal=put(local,token),okSession=put(session,token);for(const [store,ok] of [[local,okLocal],[session,okSession]])if(!ok){try{store?.removeItem(storageKey())}catch(e){}}return okLocal||okSession;}
function readLocal(){for(const name of ['localStorage','sessionStorage'])try{const store=getStore(name),token=store&&store.getItem(storageKey());if(token){parse(token);return token;}}catch(e){}return null;}
function clearLocal(){for(const name of ['localStorage','sessionStorage'])try{getStore(name)?.removeItem(storageKey())}catch(e){}}
const api={create,encrypt,unlock,unlockBundle,decryptOnly,upgrade,needsUpgrade,lock,beginSession,saveLocal,readLocal,clearLocal,parse,LEGACY_ITERATIONS,ARGON2:{memoryKiB:65536,iterations:2,parallelism:1}};Object.defineProperty(api,'STORAGE_KEY',{get:storageKey});if(typeof module!=='undefined'&&module.exports)module.exports=api;root.OfiLabSecureSave=api;
})(typeof window!=='undefined'?window:globalThis);
