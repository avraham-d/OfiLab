/* Brute-force entropy evaluation (search space, combinatorial complexity, rule-pruning).
   No crack-time guessing or network calls. */
(function(root){
'use strict';
const common=/password|passw0rd|qwerty|letmein|welcome|admin|123456|654321|111111|000000|abcdef|abc123|iloveyou|סיסמה|מנהל|שלום/u;
const sequential=/^(?:0123456789|1234567890|123456789|9876543210|987654321|abcdefghij|qwertyuiop)/i;
const repeated=/^(.)\1{3,}$/u;
const yearDate=/^(?:19|20)\d{2}(?:[01]\d[0-3]\d)?$|^(?:0?[1-9]|[12]\d|3[01])[\/-]?(?:0?[1-9]|1[012])[\/-]?(?:19|20)?\d{2}$/;

// Effective length after collapsing runs of 3+ identical characters and ascending/descending runs of
// 4+ consecutive characters (aaaa, 1234, dcba) anywhere in the password, not only when it is the whole
// password. Brute-force dictionaries try such runs first, so they add almost no search space.
function effectiveLength(chars){
  let m=0,i=0;
  while(i<chars.length){
    let j=i+1;
    while(j<chars.length&&chars[j]===chars[i])j++;
    if(j-i>=3){m++;i=j;continue;}
    const step=chars.length>i+1?chars[i+1].codePointAt(0)-chars[i].codePointAt(0):0;
    if(step===1||step===-1){
      j=i+1;
      while(j<chars.length&&chars[j].codePointAt(0)-chars[j-1].codePointAt(0)===step)j++;
      if(j-i>=4){m++;i=j;continue;}
    }
    m++;i++;
  }
  return m;
}

function evaluate(raw){
 const s=typeof raw==='string'?raw.normalize('NFC'):'';
 const chars=[...s],n=chars.length;
 if(!n){
   return {
     score: 0,
     level: 0,
     bits: 0,
     label: 'ממתין לסיסמה',
     tip: 'הזן סיסמה ייחודית בעלת 8 תווים לפחות עם מגוון אותיות וספרות.',
     length: 0,
     segments: [0, 0, 0, 0]
   };
 }

 // Accurate character space calculation (N)
 let alphabet=0;
 const hasLower=/[a-z]/.test(s);
 const hasUpper=/[A-Z]/.test(s);
 const hasDigit=/[0-9]/.test(s);
 const hasHebrew=/[\u0590-\u05ff]/u.test(s);
 const hasSpecial=/[^\p{L}\p{N}]/u.test(s);
 const hasOtherUnicode=/[\p{L}]/u.test(s)&&!hasLower&&!hasUpper&&!hasHebrew;

 if(hasDigit)alphabet+=10;
 if(hasLower)alphabet+=26;
 if(hasUpper)alphabet+=26;
 if(hasHebrew)alphabet+=27;
 if(hasSpecial)alphabet+=32;
 if(hasOtherUnicode)alphabet+=30;
 alphabet=Math.max(alphabet,10);

 // Information entropy bits: H = L * log2(N)
 let bits=n*Math.log2(alphabet);
 let tip='עמידות מעולה בפני כוח גס. מרחב צירופים קריפטוגרפי.';

 const lower=s.toLowerCase();
 const digitsOnly=/^\d+$/.test(s);

 // Pattern penalties that prune real-world brute force dictionaries
 if(common.test(lower)){
   bits=Math.min(bits,14+Math.max(0,n-8)*1.5);
   tip='תבנית מילונית נפוצה: תוכנות כוח גס ינסו אותה בדקות הראשונות.';
 }else if(repeated.test(s)||sequential.test(s)||/^(\d{2,4})\1{2,}$/u.test(s)){
   bits=Math.min(bits,10+Math.log2(Math.max(n,1)));
   tip='רצפים ותווים חוזרים מקטינים דרסטית את מרחב הצירופים.';
 }else if(yearDate.test(s)){
   bits=Math.min(bits,18);
   tip='תאריכים ושנים נמצאים בראש מילוני התקיפה של כוח גס.';
 }else if(digitsOnly){
   bits=Math.min(bits,n*Math.log2(10));
   tip='ספרות בלבד פגיעות למתקפת כוח גס; שלב אותיות וסימנים.';
 }else if(n<8){
   bits=Math.min(bits,18);
   tip='נדרשים לפחות 8 תווים לשמירה מאובטחת במכשיר.';
 }else if(effectiveLength(chars)<n){
   const m=effectiveLength(chars);
   bits=Math.min(bits,m*Math.log2(alphabet)+Math.log2(n));
   tip='רצפים ותווים חוזרים מקטינים דרסטית את מרחב הצירופים.';
 }else if(n<12){
   // The tip follows the bit count, so a weak password never reads as "good".
   tip=bits>=54?'עמידות טובה. הגדלה ל־12–16 תווים תמנע לחלוטין כל ניסיון כוח גס.'
     :'עמידות בינונית. הגדלה ל־12–16 תווים עם מגוון סוגי תווים תחזק אותה משמעותית.';
 }

 // Brute force graduated capsule fills (0 to 1 per capsule):
 // Capsule 1: 0 - 32 bits (Trivial brute-force: < 4.3×10^9 combinations)
 // Capsule 2: 32 - 54 bits (Standard brute-force: 10^10 to 1.8×10^16 combinations)
 // Capsule 3: 54 - 76 bits (High resistance: 10^16 to 7.5×10^22 combinations)
 // Capsule 4: 76 - 96+ bits (Cryptographic fortress: > 7.5×10^22 combinations)
 const seg1=Math.min(1,Math.max(0,bits/32));
 const seg2=bits<=32?0:Math.min(1,Math.max(0,(bits-32)/22));
 const seg3=bits<=54?0:Math.min(1,Math.max(0,(bits-54)/22));
 const seg4=bits<=76?0:Math.min(1,Math.max(0,(bits-76)/20));

 const score=Math.min(100,Math.max(0,Math.round((seg1+seg2+seg3+seg4)*25)));

 let level=0;
 if(bits<32||n<8)level=0;
 else if(bits<54)level=1;
 else if(bits<76)level=2;
 else if(bits<96)level=3;
 else level=4;

 const labels=[
   'פגיעה מיידית (כוח גס)',
   'עמידות נמוכה לכוח גס',
   'עמידות בינונית לכוח גס',
   'עמידות גבוהה לכוח גס',
   'חסינות מלאה לכוח גס'
 ];

 return {
   score,
   level,
   bits: Math.round(bits),
   label: labels[level],
   tip,
   length: n,
   segments: [seg1, seg2, seg3, seg4]
 };
}

const api={evaluate};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.OfiLabPasswordStrength=api;
})(typeof window!=='undefined'?window:globalThis);
