/* Isolated local Argon2id derivation; same-origin vendor, no network service. */
'use strict';
importScripts('./argon2.umd.min.js');
self.onmessage=async event=>{
  let output=null;
  try{
    const data=event.data||{};
    if(typeof data.password!=='string'||new TextEncoder().encode(data.password).length>1024||!Array.isArray(data.salt)||data.salt.length!==16)throw Error('Invalid derivation request');
    const salt=Uint8Array.from(data.salt);
    output=await self.hashwasm.argon2id({password:data.password,salt,iterations:2,memorySize:65536,parallelism:1,hashLength:32,outputType:'binary'});
    if(!(output instanceof Uint8Array)||output.byteLength!==32)throw Error('Invalid Argon2id output');
    const copy=new Uint8Array(output);
    self.postMessage({ok:true,key:copy.buffer},[copy.buffer]);
    salt.fill(0);
  }catch(e){self.postMessage({ok:false,error:'לא ניתן לגזור מפתח במכשיר זה. נדרש זיכרון פנוי ותמיכת WebAssembly.'});}
  finally{if(output instanceof Uint8Array)output.fill(0);}
};
