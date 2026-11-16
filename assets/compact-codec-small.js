/* ofiLab Compact V2 for the 120 item instrument (retires IPIP-50 links deterministically).
 * Backwards-compatible with the legacy scoring.js token formats; no server and no
 * entropy/statistics dependencies.
 * Modes: base-5 complete, base-6 sparse, answered prefix plus base-5.
 */
(function(root){
'use strict';
const N=120,VERSION=0x53,LEGACY=0x31,core=root.AVDPersonalityCore120||root.AVDPersonalityCore;
if(!core||typeof core.decode!=='function')throw Error('Legacy scoring core unavailable');
const MODES={BASE5:0,BASE6:1,PREFIX:2};
function assert(ok,msg){if(!ok)throw Error(msg);}
function deprecated50Error(){const e=Error('גרסת 50 (IPIP-50) יצאה משימוש. ניתן להתחיל שאלון 120 (מומלץ) או 300.');e.code='LEGACY_50_DEPRECATED';return e;}
function validate(answers,cursor){
  assert(Array.isArray(answers)&&answers.length===N,'Invalid answers length');
  assert(answers.every(x=>Number.isInteger(x)&&x>=0&&x<=5),'Invalid answer');
  assert(Number.isInteger(cursor)&&cursor>=0&&cursor<N,'Invalid cursor');
}
function to64(bytes){
  let b64;
  if(typeof Buffer!=='undefined')b64=Buffer.from(bytes).toString('base64');
  else {let str='';for(const b of bytes)str+=String.fromCharCode(b);b64=btoa(str);}
  return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function from64(token){
  assert(typeof token==='string'&&/^[A-Za-z0-9_-]{8,260}$/.test(token),'Invalid save link');
  const b64=token.replace(/-/g,'+').replace(/_/g,'/');
  const bytes=typeof Buffer!=='undefined'?Uint8Array.from(Buffer.from(b64,'base64')):
    Uint8Array.from(atob(b64+'='.repeat((4-b64.length%4)%4)),c=>c.charCodeAt(0));
  assert(to64(bytes)===token,'Noncanonical save link');
  return bytes;
}
function crc32(bytes){
  let crc=0xffffffff;
  for(const b of bytes){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
function bytesFor(max){let n=0;do{n++;max>>=8n;}while(max>0n);return n;}
function toBytes(x,n){const out=new Uint8Array(n);for(let i=n-1;i>=0;i--){out[i]=Number(x&255n);x>>=8n;}assert(x===0n,'Integer overflow');return out;}
function fromBytes(bytes){let x=0n;for(const n of bytes)x=x*256n+BigInt(n);return x;}
function encodeRadix(values,base){
  let x=0n;
  for(const value of values)x=x*BigInt(base)+BigInt(base===5?value-1:value);
  return toBytes(x,bytesFor(BigInt(base)**BigInt(values.length)-1n));
}
function decodeRadix(bytes,len,base){
  const max=BigInt(base)**BigInt(len);
  assert(bytes.length===bytesFor(max-1n),'Incorrect radix length');
  let x=fromBytes(bytes);
  assert(x<max,'Radix out of range');
  const result=new Array(len);
  for(let i=len-1;i>=0;i--){result[i]=Number(x%BigInt(base))+(base===5?1:0);x/=BigInt(base);}
  return result;
}
function prefixLength(answers){let k=0;while(k<N&&answers[k]!==0)k++;return answers.slice(k).every(a=>a===0)?k:-1;}
function payloadPrefix(answers,k){
  const packed=encodeRadix(answers.slice(0,k),5);
  const out=new Uint8Array(1+packed.length);out[0]=k;out.set(packed,1);return out;
}
function envelope(mode,cursor,payload){
  const out=new Uint8Array(3+payload.length+4);
  out[0]=VERSION;out[1]=mode;out[2]=cursor;out.set(payload,3);
  const check=crc32(out.subarray(0,out.length-4)),i=out.length-4;
  out[i]=check>>>24;out[i+1]=(check>>>16)&255;out[i+2]=(check>>>8)&255;out[i+3]=check&255;
  return to64(out);
}
function encode(answers,cursor=0){
  validate(answers,cursor);
  const complete=answers.every(x=>x!==0);
  const candidates=[[complete?MODES.BASE5:MODES.BASE6,encodeRadix(answers,complete?5:6)]];
  const k=prefixLength(answers);
  if(k>=0)candidates.push([MODES.PREFIX,payloadPrefix(answers,k)]);
  candidates.sort((a,b)=>a[1].length-b[1].length||a[0]-b[0]);
  return envelope(candidates[0][0],cursor,candidates[0][1]);
}
function isLegacy50Token(token){
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{8,260}$/.test(token))return false;
  try{
    const bytes=from64(token);
    return bytes[0]===0x52||(bytes[0]===0x32&&token.length===34&&bytes.length===25);
  }catch(_e){return false;}
}
function decode(token){
  const bytes=from64(token);
  if(bytes[0]===0x52||(bytes[0]===0x32&&token.length===34&&bytes.length===25))throw deprecated50Error();
  if(bytes[0]===LEGACY){const state=core.decode(token);validate(state.answers,state.cursor);return {...state,version:1,mode:'V1'};}
  assert(bytes[0]===VERSION&&bytes.length>=8,'Unsupported save version');
  const mode=bytes[1],cursor=bytes[2],offset=bytes.length-4;
  assert(mode>=0&&mode<=2&&cursor<N,'Invalid mode or cursor');
  const received=((bytes[offset]<<24)|(bytes[offset+1]<<16)|(bytes[offset+2]<<8)|bytes[offset+3])>>>0;
  assert(crc32(bytes.subarray(0,offset))===received,'Save CRC32 mismatch');
  const payload=bytes.subarray(3,offset);
  let answers;
  if(mode===MODES.BASE5)answers=decodeRadix(payload,N,5);
  else if(mode===MODES.BASE6)answers=decodeRadix(payload,N,6);
  else {
    assert(payload.length>=2,'Invalid prefix');
    const k=payload[0];assert(k<=N,'Prefix out of range');
    answers=decodeRadix(payload.subarray(1),k,5).concat(Array(N-k).fill(0));
    assert(answers.slice(0,k).every(a=>a>=1),'Invalid prefix');
  }
  validate(answers,cursor);
  assert(encode(answers,cursor)===token,'Noncanonical V2 link');
  return {answers,cursor,version:2,mode:['BASE5','BASE6','PREFIX'][mode]};
}
const api={encode,decode,isLegacy50Token,encodeV1:(a,c=0)=>core.encode(a,c),MODES,TOTAL:N};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.OfiLabCompactV2=api;
})(typeof window!=='undefined'?window:globalThis);
