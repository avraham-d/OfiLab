/* AVD Personality Lab: deterministic, standalone, no backend or user accounts.
 * The Hebrew item adaptation is experimental. 0-100 values are possible-range scores,
 * NOT population percentiles. No AI or remote service is used here.
 */
(function(root){
  'use strict';
  const ORDER=['N','E','O','A','C'];
  const DOMAINS={
    N:{name:'רגישות רגשית',english:'Neuroticism',low:'בדרך כלל חווה פחות דאגה, מתח או הצפה רגשית, בהתאם לתשובותיך.',mid:'מתאר שילוב של יציבות רגשית ורגישות למצבי לחץ.',high:'מדווח על חוויות רגשיות עוצמתיות יותר, דאגה או רגישות ללחץ. זה אינו אבחון של בעיה נפשית.'},
    E:{name:'מוחצנות',english:'Extraversion',low:'נוטה להעדיף פרטיות, אינטראקציות מצומצמות או סביבה שקטה. מופנמות אינה זהה לביישנות.',mid:'נוח לך לשלב בין מפגש חברתי לזמן אישי.',high:'נוטה לחפש קשר חברתי, פעילות וביטוי חיצוני.'},
    O:{name:'פתיחות לחוויה',english:'Openness',low:'נוטה להעדיף מוכרות, פרקטיות ושיטות מוכחות, לפחות בהקשרים שנבדקו.',mid:'משלב סקרנות וגמישות עם העדפה מסוימת למוכר.',high:'נוטה ליהנות מרעיונות, דמיון, אומנות או חוויות חדשות. תחום העמדות מבוסס על פריטים פוליטיים ותרבותיים מהמקור, ללא נורמות ישראליות.'},
    A:{name:'נועם הליכות',english:'Agreeableness',low:'נוטה לגישה ישירה, ביקורתית או חשדנית יותר ביחסים עם אחרים.',mid:'מתאר איזון בין התחשבות באחרים לעמידה על דעתך.',high:'נוטה לאמון, התחשבות, שיתוף פעולה וחמלה. אין פירוש הדבר שעליך תמיד לוותר.'},
    C:{name:'מצפוניות',english:'Conscientiousness',low:'נוטה לגמישות וספונטניות יותר, ולעיתים לקושי עם שגרה והשלמת משימות.',mid:'משלב תכנון ועקביות עם גמישות לפי הנסיבות.',high:'נוטה להתמדה, תכנון, סדר ומחויבות למשימות.'}
  };
  const FACETS={
    N:[
      ['דאגנות','בדרך כלל נוטה פחות לחששות ולציפייה לקשיים.','דאגות מופיעות לפעמים, בהתאם לנסיבות.','נוטה לחוות דאגה ולצפות מראש לקשיים.'],
      ['כעס ותסכול','נוטה להתרגז לעיתים רחוקות.','מגיב בתסכול במצבים מסוימים.','נוטה להתרגז או לחוות כעס בתדירות גבוהה יותר.'],
      ['מצב רוח ירוד','מדווח פחות על עצבות או תחושות שליליות.','מדווח על תחושות שליליות במידה משתנה.','מדווח על מצבי רוח ירודים בתדירות גבוהה יותר; זו אינה אבחנה קלינית.'],
      ['מודעות עצמית במצבים חברתיים','נוטה להרגיש יותר בנוח כשאחרים מבחינים בו.','נוחות חברתית משתנה לפי הקשר.','נוטה לחוש מבוכה או חשש מתשומת לב במצבים חברתיים.'],
      ['קושי בוויסות דחפים','מתאר שליטה יחסית בדחפים ובהנאות.','השליטה בדחפים משתנה לפי הקשר.','נוטה להתקשות לעצור פעילויות מהנות או פיתויים.'],
      ['רגישות למצבי לחץ','נוטה להישאר בשליטה מול עומס.','מסתדר עם חלק ממצבי הלחץ אך לא עם כולם.','מדווח על הצפה וקושי להתמודד כשמופעל לחץ.']
    ],
    E:[
      ['חברותיות קרובה','נוטה לשמור על מעגל מצומצם וליזום פחות קשרים חדשים.','יוצר קשרים לפי הסיטואציה.','נוטה ליצור קשרים חברתיים ולהרגיש נוח עם אנשים.'],
      ['העדפת חברה מרובה','מעדיף פחות אירועים הומי אדם.','נהנה ממפגשים מסוימים ומוותר על אחרים.','נוטה ליהנות מקבוצות גדולות ומאירועים חברתיים.'],
      ['אסרטיביות','נוטה לתת לאחרים להוביל.','משלב הובלה והקשבה לאחרים.','נוטה ליזום, להוביל ולבטא עמדה בביטחון.'],
      ['קצב פעילות','נוטה לקצב חיים רגוע יחסית.','פעיל לפי הצורך.','נוטה להיות בתנועה ובעשייה חלק ניכר מהזמן.'],
      ['חיפוש ריגושים','נוטה להעדיף מצבים צפויים ופחות סיכונים.','מחפש גיוון מסוים אך לא בכל מחיר.','נוטה לחפש התרגשות, הרפתקאות וחוויות עוצמתיות.'],
      ['עליזות','מדווח פחות על הבעה חיצונית של שמחה.','השמחה וההתלהבות משתנות לפי המצב.','מדווח על התלהבות ושמחת חיים בתדירות גבוהה.']
    ],
    O:[
      ['דמיון','נוטה להעדיף מציאות מעשית על פני דמיון.','משלב דמיון עם מחשבה מעשית.','נוטה ליהנות מדמיון, חלימה בהקיץ ועולמות פנימיים.'],
      ['עניין באמנות ויופי','מתעניין פחות ביצירה ובחוויות אסתטיות.','עניין משתנה לפי סוג האמנות.','נוטה להעריך אומנות, יופי וחוויות אסתטיות.'],
      ['קשב לחוויה רגשית','נוטה לתת פחות מקום לעיסוק בחוויות רגשיות.','לעיתים קשוב לעוצמת רגשותיו.','נוטה לשים לב לרגשות ולחוות אותם בעוצמה.'],
      ['גיוון והתחדשות','מעדיף מסגרות, הרגלים ושיטות מוכרות.','משלב הרגלים עם גיוון מדי פעם.','נוטה לחפש גיוון ולהסתגל לשינוי.'],
      ['סקרנות אינטלקטואלית','נוטה להעדיף נושאים מוחשיים על פני דיון מופשט.','נהנה מדיונים רעיוניים בחלק מהנושאים.','נוטה ליהנות מדיונים תיאורטיים ומרעיונות מופשטים.'],
      ['פתיחות לבחינה מחדש של מוסכמות','נוטה להעדיף מוסכמות מקובלות ושימור כללים מוכרים.','משלב הערכת מסורת עם נכונות לשינויים.','נוטה לבחון מחדש מוסכמות ורעיונות חברתיים. זהו היבט שעבר התאמה מהותית, ולכן אינו שקול לסולם המקורי.']
    ],
    A:[
      ['אמון','נוטה לבחון כוונות של אחרים בזהירות רבה.','מאמין לאנשים בהתאם לניסיון ולהקשר.','נוטה לייחס לאחרים כוונות טובות ולתת אמון.'],
      ['יושרה והוגנות','מדווח על מוכנות רבה יותר להתנהגות תועלתנית מול אחרים.','מייחס חשיבות להוגנות אך מתאר גם מורכבויות.','נוטה להימנע מניצול והטעיה ולהעדיף הוגנות.'],
      ['עזרה לזולת','נוטה להתמקד בענייניו יותר מאשר בסיוע לאחרים.','נוטה לעזור בהתאם לנסיבות.','נוטה לגלות דאגה ולסייע לאחרים.'],
      ['שיתוף פעולה','נוטה לעמוד על שלו גם בזמן עימות.','משלב פשרה עם הבעת עמדה.','נוטה לחפש הסכמות ולהימנע מעימותים.'],
      ['צניעות','נוטה להערכה עצמית גבוהה ולהצגה ברורה של הישגים.','משלב ביטחון עצמי וצניעות.','נוטה להמעיט בהבלטת יתרונותיו. הציון אינו מדד לערך אישי.'],
      ['חמלה','נוטה פחות להיות מושפע ממצוקתם של אחרים.','מגיב במידה משתנה למצוקה של אחרים.','נוטה להזדהות עם מי שמתקשה ולהרגיש חמלה.']
    ],
    C:[
      ['תחושת מסוגלות','נוטה להטיל ספק ביכולתו להשלים משימות בהצלחה.','המסוגלות העצמית תלויה בסוג המשימה.','נוטה להאמין ביכולתו לבצע משימות היטב.'],
      ['סדר וארגון','נוטה לסביבה חופשית יותר ופחות מסודרת.','מתאר ארגון במידה משתנה.','נוטה לשמור על סדר ולהחזיר דברים למקומם.'],
      ['מחויבות לכללים ולהבטחות','נוטה להיות גמיש יותר ביחס לכללים ולהתחייבויות.','שומר על כללים והתחייבויות לפי הקשר.','נוטה לעמוד בהבטחות ולפעול לפי כללים.'],
      ['שאיפה להישגים','נוטה להשקיע פחות מאמץ מעבר לנדרש.','מתאמץ במיוחד במשימות מסוימות.','נוטה להשקיע מאמץ ולעשות מעבר למינימום.'],
      ['התמדה ומשמעת עצמית','נוטה להתקשות להתחיל משימות ולהתמיד בהן.','מתמיד במשימות בהתאם למוטיבציה ולנסיבות.','נוטה להתחיל משימות ולהוציא תוכניות לפועל.'],
      ['שיקול דעת לפני פעולה','נוטה לפעול במהירות ולעיתים ללא תכנון.','משלב פעולה מהירה עם חשיבה מקדימה.','נוטה לשקול השלכות ולהימנע מפזיזות.']
    ]
  };
  FACETS.O[5]=['עמדות חברתיות וערכיות','התשובות נוטות לצד השמרני של פריטי המקור. זהו מדד תלוי תרבות, לא מדד לאיכות או לחוכמה.','התשובות משלבות עמדות שונות בפריטי המקור. המשמעות תלויה בהקשר תרבותי ופוליטי.','התשובות נוטות לצד הליברלי של פריטי המקור. זהו מדד תלוי תרבות, לא מדד לאיכות או לחוכמה.'];
  const TOTAL=300, VERSION=0x33, PAYLOAD_BYTES=3+113, TOKEN_BYTES=PAYLOAD_BYTES+4;
  function score100(mean){return Math.round((mean-1)*25);}
  function tier(value){return value<37.5?0:value>62.5?2:1;}
  function validateBank(bank){
    if(!bank||bank.instrument!=='IPIP-NEO-300'||bank.version!=='he-avd-ipip300-1.0.0'||!Array.isArray(bank.scale)||bank.scale.length!==5||!Array.isArray(bank.items)||bank.items.length!==TOTAL)throw Error('קובץ השאלון אינו תקין.');
    const ids=new Set(), group=new Map();
    for(let i=0;i<bank.items.length;i++){
      const x=bank.items[i];
      if(!x||!x.id||ids.has(x.id)||!ORDER.includes(x.domain)||!Number.isInteger(x.facet)||x.facet<1||x.facet>6||!['plus','minus'].includes(x.keyed)||typeof x.he!=='string'||!x.he.trim()||(x.number!==undefined&&x.number!==i+1))throw Error('שאלה לא תקינה במאגר.');
      ids.add(x.id); const k=x.domain+x.facet;group.set(k,(group.get(k)||0)+1);
    }
    if(group.size!==30||Array.from(group.values()).some(n=>n!==10))throw Error('שיוך שאלות לא תקין.');
    return true;
  }
  function calculate(bank,answers){
    validateBank(bank);
    if(!Array.isArray(answers)||answers.length!==TOTAL||Array.from(answers).some(n=>!Number.isInteger(n)||n<1||n>5))throw Error('יש לענות על כל 300 ההיגדים.');
    const domain={};for(const d of ORDER)domain[d]={domain:d,label:DOMAINS[d].name,english:DOMAINS[d].english,values:[],facets:[]};
    bank.items.forEach((x,i)=>{const v=x.keyed==='minus'?6-answers[i]:answers[i];domain[x.domain].values.push(v);const f=domain[x.domain].facets[x.facet-1]||(domain[x.domain].facets[x.facet-1]={number:x.facet,values:[]});f.values.push(v);});
    const summary={};
    for(const d of ORDER){
      const entry=domain[d], avg=entry.values.reduce((a,b)=>a+b,0)/entry.values.length;
      entry.raw=entry.values.reduce((a,b)=>a+b,0);entry.mean=Math.round(avg*1000)/1000;entry.rangeScore=100*(entry.raw-60)/240;entry.score=Math.round(entry.rangeScore);
      entry.text=DOMAINS[d][['low','mid','high'][tier(entry.rangeScore)]];
      for(let i=0;i<6;i++){const f=entry.facets[i];const fdef=FACETS[d][i];f.raw=f.values.reduce((a,b)=>a+b,0);f.rangeScore=100*(f.raw-10)/40;f.score=Math.round(f.rangeScore);f.label=fdef[0];f.text=fdef[tier(f.rangeScore)+1];delete f.values;}
      delete entry.values;summary[d]=entry;
    }
    return {instrument:bank.instrument,version:bank.version,metric:'possible-range-percent-not-percentile',domains:summary,insights:insights(summary)};
  }
  function insights(s){
    const o=[];
    if(s.N.score>=65 && s.E.score<=35)o.push('השילוב בין רגישות רגשית גבוהה להעדפת שקט ומרחב אישי עשוי להוביל לעיבוד פנימי ממושך של חוויות. זה אינו בהכרח חיסרון, וייתכנו הבדלים גדולים בין מצבים.');
    if(s.A.score>=65 && s.C.score<=35)o.push('ייתכן פער בין רצון להתחשב באחרים לבין הקושי לשמור על שגרה או לסיים מטלות. שיתוף פעולה והשלמת משימות הן יכולות נפרדות.');
    if(s.O.score>=65 && s.C.score<=35)o.push('סקרנות ורעיונות חדשים עשויים למשוך אותך יותר מאשר ביצוע לפי תוכנית קבועה. כדאי לבחון אם יש נושאים שבהם הדפוס הזה מתהפך.');
    if(s.N.score>=65 && s.C.score>=65)o.push('שילוב של רגישות ללחץ עם מצפוניות גבוהה עשוי להיתרגם לביקורת עצמית ולדרישה גבוהה מעצמך, לצד היערכות יסודית.');
    if(s.E.score<=35 && s.E.facets[2].score>=65)o.push('אף שציון המוחצנות הכללי נמוך יחסית, ציון אסרטיביות גבוה עשוי לרמז שאתה יודע להוביל כשיש לכך מטרה, גם בלי לחפש חברה מרובה.');
    if(s.O.facets[4].score>=65 && s.O.score<=60)o.push('ייתכן שהסקרנות האינטלקטואלית שלך גבוהה יותר מהנטייה הכללית לשינוי, לאמנות או להרפתקאות. לא כל סוגי הפתיחות חייבים להיות דומים.');
    if(s.N.facets[3].score>=65 && s.E.facets[0].score<=35)o.push('ייתכן שחלק מההימנעות החברתית קשורה לחשש מתשומת לב, אך אין להסיק על סיבה מתוך שאלון לבדו.');
    if(s.A.facets[4].score>=65 && s.C.facets[0].score<=35)o.push('צניעות ותחושת מסוגלות נמוכה הן תכונות נפרדות; אם שתיהן בולטות, כדאי להימנע מלפרש את שתיהן כחוסר ביטחון.');
    return o.slice(0,5);
  }
  function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
  function base64Url(bytes){
    let s='';for(const n of bytes)s+=String.fromCharCode(n);
    if(typeof btoa==='function')return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    if(typeof Buffer!=='undefined')return Buffer.from(bytes).toString('base64url');
    throw Error('לא ניתן לקודד בדפדפן הזה.');
  }
  function readBase64Url(value){
    if(typeof value!=='string'||!new RegExp('^[A-Za-z0-9_-]{160}$').test(value))throw Error('קישור השמירה אינו תקין.');
    const s=value.replace(/-/g,'+').replace(/_/g,'/');
    if(typeof atob==='function'){const decoded=atob(s);return Uint8Array.from(decoded,c=>c.charCodeAt(0));}
    if(typeof Buffer!=='undefined')return Uint8Array.from(Buffer.from(s,'base64'));
    throw Error('לא ניתן לפענח בדפדפן הזה.');
  }
  function encode(answers,cursor=0){
    if(!Array.isArray(answers)||answers.length!==TOTAL||Array.from(answers).some(n=>!Number.isInteger(n)||n<0||n>5)||!Number.isInteger(cursor)||cursor<0||cursor>=TOTAL)throw Error('נתוני שמירה לא תקינים.');
    const out=new Uint8Array(TOKEN_BYTES);out[0]=VERSION;out[1]=cursor>>>8;out[2]=cursor&255;
    answers.forEach((value,i)=>{let bit=i*3;for(let j=0;j<3;j++){if(value&(1<<j)){out[3+Math.floor((bit+j)/8)]|=1<<((bit+j)%8);}}});
    const sum=crc32(out.subarray(0,PAYLOAD_BYTES));
    out[PAYLOAD_BYTES]=(sum>>>24)&255;out[PAYLOAD_BYTES+1]=(sum>>>16)&255;out[PAYLOAD_BYTES+2]=(sum>>>8)&255;out[PAYLOAD_BYTES+3]=sum&255;
    return base64Url(out);
  }
  function decode(token){
    const data=readBase64Url(token);
    if(data.length!==TOKEN_BYTES||data[0]!==VERSION||((data[1]<<8)|data[2])>=TOTAL)throw Error('גרסת קישור השמירה אינה נתמכת.');
    const sum=crc32(data.subarray(0,PAYLOAD_BYTES));
    const found=(((data[PAYLOAD_BYTES]<<24)|(data[PAYLOAD_BYTES+1]<<16)|(data[PAYLOAD_BYTES+2]<<8)|data[PAYLOAD_BYTES+3])>>>0);
    if(sum!==found)throw Error('קישור השמירה נפגם.');
    const answers=[];for(let i=0;i<TOTAL;i++){const bit=i*3;let n=0;for(let j=0;j<3;j++)n|=((data[3+Math.floor((bit+j)/8)]>>((bit+j)%8))&1)<<j;if(n>5)throw Error('הקישור מכיל תשובות לא חוקיות.');answers.push(n);}
    const cursor=(data[1]<<8)|data[2];if(encode(answers,cursor)!==token)throw Error('קישור השמירה אינו תקין.');return {answers,cursor};
  }
  const api={ORDER,DOMAINS,FACETS,validateBank,calculate,encode,decode,tier};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.AVDPersonalityCore=api;
})(typeof window!=='undefined'?window:globalThis);

