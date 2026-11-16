/* ofiLab Compact V2 - experimental, lossless, browser + Node compatible.
 * Compatible decoder for legacy #p= URLs (v0x33); V2 encodes with
 * candidate formats and chooses the shortest. Never requires a server.
 * The context model is pinned to IPIP-NEO-300 he-avd-ipip300-1.0.0.
 * Not encryption; anyone with the URL can reconstruct answers.
 * SPDX-License-Identifier: MIT (prototype authored here)
 */
(function(root){
'use strict';
const N=300;
const KEY_MASK=[
'00000000000000000000000000000000000000000000000000',
'00000000000000000010000000000000000000000000000010',
'00000000100000000101000000001000000001100001000111',
'11000111110111101110101111011111111111110111111110',
'10111101111111111111111111111110111101111111111111',
'11111111111111111111111111111111111111111111111111'
].join('');
if(KEY_MASK.length!==N)throw Error('Invalid fixed question model');
const MODEL_VERSION='he-avd-ipip300-1.0.0';
const MODES={RADIX5:0x40,ENUM5:0x41,CONTEXT:0x42,RADIX6:0x43,ENUM6:0x44,PREFIX:0x45};
const FACT=[1n];for(let i=1;i<=N+5;i++)FACT.push(FACT[i-1]*BigInt(i));
const LENGTH5=byteLen(5n**300n-1n),LENGTH6=byteLen(6n**300n-1n);
function assert(ok,msg){if(!ok)throw Error(msg);}
function byteLen(x){let n=0;while(x>0n){n++;x>>=8n;}return n;}
function intBytes(x,n){assert(x>=0n,'negative number');const a=new Uint8Array(n);for(let i=n-1;i>=0;i--){a[i]=Number(x&255n);x>>=8n;}assert(x===0n,'number too large');return a;}
function bytesInt(b){let x=0n;for(const v of b)x=(x<<8n)|BigInt(v);return x;}
function crc32(b){let c=0xffffffff;for(const value of b){c=(c^value)>>>0;for(let i=0;i<8;i++)c=((c>>>1)^((c&1)?0xedb88320:0))>>>0;}return (c^0xffffffff)>>>0;}
function toBase64(b){let v;if(typeof Buffer!=='undefined')v=Buffer.from(b).toString('base64');else {let s='';for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);v=btoa(s);}return v.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');}
function fromBase64(s){assert(typeof s==='string'&&s.length>0&&s.length<=600&&/^[A-Za-z0-9_-]+$/.test(s),'Invalid base64url');let b;if(typeof Buffer!=='undefined')b=Uint8Array.from(Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'),'base64'));else {let x=s.replace(/-/g,'+').replace(/_/g,'/');x+='='.repeat((4-x.length%4)%4);b=Uint8Array.from(atob(x),c=>c.charCodeAt(0));}assert(toBase64(b)===s,'Noncanonical base64url');return b;}
function encodeV1(answers,cursor){validate(answers,cursor);const b=new Uint8Array(120);b[0]=0x33;b[1]=cursor>>8;b[2]=cursor&255;answers.forEach((a,i)=>{for(let j=0;j<3;j++)if(a&(1<<j)){const bit=i*3+j;b[3+(bit>>3)]|=1<<(bit&7)}});const c=crc32(b.subarray(0,116));b[116]=c>>>24;b[117]=(c>>>16)&255;b[118]=(c>>>8)&255;b[119]=c&255;return toBase64(b);}
function decodeV1(b){assert(b.length===120&&b[0]===0x33,'Invalid legacy format');const p=b.subarray(0,116);const found=((((b[116]<<24)|(b[117]<<16)|(b[118]<<8)|b[119]))>>>0);assert(crc32(p)===found,'CRC32 mismatch');const cursor=(b[1]<<8)|b[2];assert(cursor<N,'Invalid cursor');const answers=Array.from({length:N},(_,i)=>{let x=0;for(let j=0;j<3;j++){const bit=i*3+j;x|=((b[3+(bit>>3)]>>(bit&7))&1)<<j}return x;});validate(answers,cursor);return{answers,cursor,mode:'V1-legacy',version:1};}
function validate(answers,cursor){assert(Array.isArray(answers)&&answers.length===N&&answers.every(x=>Number.isInteger(x)&&x>=0&&x<=5),'Answers must be 0..5 and length 300');assert(Number.isInteger(cursor)&&cursor>=0&&cursor<N,'Cursor must be 0..299');}
function choose(n,k){if(k<0||k>n)return 0n;return FACT[n]/(FACT[k]*FACT[n-k]);}
function rankComposition(counts){const k=counts.length;let rest=N,index=0n;for(let i=0;i<k-1;i++){for(let j=0;j<counts[i];j++)index+=choose(rest-j+k-i-2,k-i-2);rest-=counts[i];}return index;}
function unrankComposition(index,k){const total=choose(N+k-1,k-1);assert(index<total,'Invalid count histogram');const out=[];let rest=N;for(let i=0;i<k-1;i++){let n=0;while(n<=rest){const ways=choose(rest-n+k-i-2,k-i-2);if(index<ways)break;index-=ways;n++;}assert(n<=rest,'Invalid histogram');out.push(n);rest-=n;}out.push(rest);return out;}
function multiset(counts){let m=FACT[N];for(let i=0;i<counts.length;i++)m/=FACT[counts[i]];return m;}
function rankSequence(digits,counts){let remaining=N,total=multiset(counts),rank=0n;const c=counts.slice();for(const d of digits){for(let s=0;s<d;s++)if(c[s])rank+=total*BigInt(c[s])/BigInt(remaining);assert(c[d]>0,'Invalid sequence');total=total*BigInt(c[d])/BigInt(remaining);c[d]--;remaining--;}return rank;}
function unrankSequence(rank,counts){let remaining=N,total=multiset(counts);assert(rank<total,'Invalid rank');const c=counts.slice(),out=[];for(let i=0;i<N;i++){let found=false;for(let s=0;s<c.length;s++){if(!c[s])continue;const block=total*BigInt(c[s])/BigInt(remaining);if(rank<block){out.push(s);total=block;c[s]--;found=true;break;}rank-=block;}assert(found,'Invalid multiset data');remaining--;}assert(rank===0n,'Invalid trailing rank');return out;}
function encodeRadix(answers,k){let x=0n;for(const a of answers)x=x*BigInt(k)+BigInt(k===5?a-1:a);return intBytes(x,k===5?LENGTH5:LENGTH6);}
function decodeRadix(payload,k){const len=k===5?LENGTH5:LENGTH6;assert(payload.length===len,'Invalid radix payload size');let x=bytesInt(payload);assert(x<BigInt(k)**BigInt(N),'Out-of-range radix number');const out=new Array(N);for(let i=N-1;i>=0;i--){out[i]=Number(x%BigInt(k))+(k===5?1:0);x/=BigInt(k);}return out;}
function encodeEnum(answers,k){const digits=answers.map(a=>k===5?a-1:a);const counts=Array(k).fill(0);digits.forEach(d=>counts[d]++);const hist=rankComposition(counts);const m=multiset(counts);const rank=rankSequence(digits,counts);const hlen=k===5?4:5;const rlen=byteLen(m-1n);const b=new Uint8Array(hlen+rlen);b.set(intBytes(hist,hlen),0);b.set(intBytes(rank,rlen),hlen);return b;}
function decodeEnum(payload,k){const hlen=k===5?4:5;assert(payload.length>=hlen,'Missing histogram');const counts=unrankComposition(bytesInt(payload.subarray(0,hlen)),k);const m=multiset(counts);const rlen=byteLen(m-1n);assert(payload.length===hlen+rlen,'Invalid enumerative payload length');const digits=unrankSequence(bytesInt(payload.subarray(hlen)),counts);return digits.map(x=>k===5?x+1:x);}
// 32-bit integer adaptive arithmetic coding, separate probability table for each
// (Big Five domain, reverse-key polarity) context. Contexts are fixed by schema.
const HALF=2147483648,QUARTER=1073741824,FULL=4294967296;
function contextIndex(i){return (i%5)+(KEY_MASK[i]==='1'?5:0);}
function newTables(){return Array.from({length:10},()=>[1,1,1,1,1]);}
function encodeContext(answers){let low=0,high=FULL-1,pending=0;const bits=[],tab=newTables();const emit=(bit)=>{bits.push(bit);while(pending-->0)bits.push(1-bit);pending=0;};for(let i=0;i<N;i++){const d=answers[i]-1,c=tab[contextIndex(i)];const total=c.reduce((a,b)=>a+b,0),start=c.slice(0,d).reduce((a,b)=>a+b,0),end=start+c[d];const range=high-low+1;const old=low;low=old+Math.floor(range*start/total);high=old+Math.floor(range*end/total)-1;assert(low<=high,'Arithmetic precision overflow');for(;;){if(high<HALF){emit(0);}else if(low>=HALF){emit(1);low-=HALF;high-=HALF;}else if(low>=QUARTER&&high<3*QUARTER){pending++;low-=QUARTER;high-=QUARTER;}else break;low=low*2;high=high*2+1;}c[d]++;}pending++;emit(low<QUARTER?0:1);while(bits.length%8)bits.push(0);const out=new Uint8Array(bits.length/8);for(let i=0;i<bits.length;i++)out[i>>3]|=bits[i]<<(7-(i&7));return out;}
function decodeContext(payload){let bitpos=0;const bit=()=>{const n=bitpos++;return n<payload.length*8?(payload[n>>3]>>(7-(n&7)))&1:0;};let low=0,high=FULL-1,code=0;for(let i=0;i<32;i++)code=code*2+bit();const answers=[],tab=newTables();for(let i=0;i<N;i++){const c=tab[contextIndex(i)];const total=c.reduce((a,b)=>a+b,0);const range=high-low+1;const scaled=Math.floor(((code-low+1)*total-1)/range);assert(scaled>=0&&scaled<total,'Corrupted arithmetic stream');let start=0,d=-1;for(let j=0;j<5;j++){if(scaled<start+c[j]){d=j;break;}start+=c[j];}assert(d!==-1,'Invalid arithmetic digit');const old=low;low=old+Math.floor(range*start/total);high=old+Math.floor(range*(start+c[d])/total)-1;assert(low<=code&&code<=high,'Arithmetic decode range violation');for(;;){if(high<HALF){}else if(low>=HALF){low-=HALF;high-=HALF;code-=HALF;}else if(low>=QUARTER&&high<3*QUARTER){low-=QUARTER;high-=QUARTER;code-=QUARTER;}else break;low=low*2;high=high*2+1;code=code*2+bit();}answers.push(d+1);c[d]++;}return answers;}
function prefixCount(answers){let k=0;while(k<N&&answers[k]!==0)k++;return answers.slice(k).every(a=>a===0)?k:-1;}
function encodePrefix(answers,k){let x=0n;for(let i=0;i<k;i++)x=x*5n+BigInt(answers[i]-1);const n=byteLen(5n**BigInt(k)-1n);const b=new Uint8Array(2+n);b[0]=k>>8;b[1]=k&255;b.set(intBytes(x,n),2);return b;}
function decodePrefix(payload){assert(payload.length>=2,'Truncated prefix');const k=(payload[0]<<8)|payload[1];assert(k<=N,'Invalid prefix length');const n=byteLen(5n**BigInt(k)-1n);assert(payload.length===n+2,'Invalid prefix payload');let x=bytesInt(payload.subarray(2));assert(x<5n**BigInt(k),'Invalid base5 value');const a=Array(N).fill(0);for(let i=k-1;i>=0;i--){a[i]=Number(x%5n)+1;x/=5n;}return a;}
function envelope(mode,cursor,payload){const b=new Uint8Array(3+payload.length+4);b[0]=mode;b[1]=cursor>>8;b[2]=cursor&255;b.set(payload,3);const c=crc32(b.subarray(0,b.length-4));b[b.length-4]=(c>>>24)&255;b[b.length-3]=(c>>>16)&255;b[b.length-2]=(c>>>8)&255;b[b.length-1]=c&255;return toBase64(b);}
function encode(answers,cursor=0){validate(answers,cursor);const full=answers.every(a=>a!==0);const candidates=[];if(full){candidates.push([MODES.RADIX5,encodeRadix(answers,5)]);candidates.push([MODES.ENUM5,encodeEnum(answers,5)]);candidates.push([MODES.CONTEXT,encodeContext(answers)]);}else{candidates.push([MODES.RADIX6,encodeRadix(answers,6)]);candidates.push([MODES.ENUM6,encodeEnum(answers,6)]);}const k=prefixCount(answers);if(k>=0)candidates.push([MODES.PREFIX,encodePrefix(answers,k)]);candidates.sort((x,y)=>x[1].length-y[1].length||x[0]-y[0]);return envelope(candidates[0][0],cursor,candidates[0][1]);}
function decode(token){const b=fromBase64(token);assert(b.length>=7,'Token too short');if(b[0]===0x33){const s=decodeV1(b);assert(encodeV1(s.answers,s.cursor)===token,'Invalid legacy canonical token');return s;}const mode=b[0];assert(Object.values(MODES).includes(mode),'Unsupported codec version');const found=((((b[b.length-4]<<24)|(b[b.length-3]<<16)|(b[b.length-2]<<8)|b[b.length-1]))>>>0);assert(crc32(b.subarray(0,b.length-4))===found,'CRC32 mismatch');const cursor=(b[1]<<8)|b[2];assert(cursor<N,'Invalid cursor');const p=b.subarray(3,b.length-4);let answers;
 if(mode===MODES.RADIX5)answers=decodeRadix(p,5);
 else if(mode===MODES.ENUM5)answers=decodeEnum(p,5);
 else if(mode===MODES.CONTEXT)answers=decodeContext(p);
 else if(mode===MODES.RADIX6)answers=decodeRadix(p,6);
 else if(mode===MODES.ENUM6)answers=decodeEnum(p,6);
 else answers=decodePrefix(p);
 validate(answers,cursor);if(mode===MODES.CONTEXT){const canonical=encodeContext(answers);assert(p.length===canonical.length&&p.every((n,i)=>n===canonical[i]),'Noncanonical arithmetic payload');}return{answers,cursor,mode:Object.keys(MODES).find(k=>MODES[k]===mode),version:2};}
function compare(answers,cursor=0){validate(answers,cursor);const modes=[];const full=answers.every(a=>a!==0);if(full){modes.push([MODES.RADIX5,encodeRadix(answers,5)],[MODES.ENUM5,encodeEnum(answers,5)],[MODES.CONTEXT,encodeContext(answers)]);}else{modes.push([MODES.RADIX6,encodeRadix(answers,6)],[MODES.ENUM6,encodeEnum(answers,6)]);}const k=prefixCount(answers);if(k>=0)modes.push([MODES.PREFIX,encodePrefix(answers,k)]);return modes.map(([mode,payload])=>({mode:Object.keys(MODES).find(k=>MODES[k]===mode),payloadBytes:payload.length,totalBytes:payload.length+7,characters:envelope(mode,cursor,payload).length})).sort((a,b)=>a.characters-b.characters||a.totalBytes-b.totalBytes);}
const api={N,MODEL_VERSION,MODES,encode,decode,encodeV1,compare};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.OfiLabCompactV2=api;
})(typeof window!=='undefined'?window:globalThis);