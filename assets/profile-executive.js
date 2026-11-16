/* ofiLab Calm V2 / experimental executive summary. Pure, offline interpretation.
   Never changes psychometric scoring, norms, saved data or the four-letter engine. */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.OfiExecutive=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const ORDER=['N','E','O','A','C'];
  const FACETS={
    E:[
      ['חיבור בין־אישי','יכולת ליצור קשר חם ופתוח'],
      ['נוחות בקבוצות','אנרגיה ממפגשים עם אנשים'],
      ['אסרטיביות','נכונות להביע עמדה ולהוביל'],
      ['קצב עשייה','נטייה להיות פעיל וליזום'],
      null,['התלהבות','יכולת להביא אנרגיה חיובית למפגשים']
    ],
    O:[
      ['דמיון יוצר','נטייה לחשוב מעבר למוכר'],
      ['רגישות לאסתטיקה','קשב ליופי, יצירה וניואנסים'],
      ['קשב לרגשות','מודעות לחוויות רגשיות'],
      ['פתיחות להתנסות','סקרנות כלפי אפשרויות חדשות'],
      ['סקרנות רעיונית','עניין ברעיונות ובחיבורים חדשים'],
      null
    ],
    A:[
      ['אמון באנשים','נכונות לתת לאחרים הזדמנות'],
      ['הוגנות','חשיבות ליושרה ולעמידה בהתחייבויות'],
      ['נכונות לסייע','קשב לצרכים של אחרים'],
      ['שיתוף פעולה','יכולת לחפש הסכמות ופתרונות משותפים'],
      null,
      ['חמלה','רגישות לנקודת המבט של אחרים']
    ],
    C:[
      ['תחושת מסוגלות','ביטחון יחסי ביכולת לבצע משימות'],
      ['סדר וארגון','העדפה לארגון ותכנון'],
      ['מחויבות','נטייה לעמוד בהתחייבויות'],
      ['שאיפה להתקדם','מוטיבציה להשקיע במטרות'],
      ['התמדה','יכולת להמשיך גם כשהמשימה דורשת מאמץ'],
      ['שיקול דעת','נטייה לבחון השלכות לפני פעולה']
    ]
  };
  const DOMAIN_FALLBACK={
    E:['יוזמה חברתית','נכונות לפעול וליצור קשרים'],
    O:['סקרנות ופתיחות','עניין ברעיונות או בחוויות חדשות'],
    A:['שיתוף פעולה','חשיבות ליחסים ולהתחשבות'],
    C:['מחויבות והתמדה','העדפה לאחריות ולמיקוד במשימות']
  };
  const safe=n=>typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.min(100,n)):null;
  const metric=(row,hasNorm)=>{
    const norm=safe(row?.percentileExact??row?.percentile);
    return hasNorm&&norm!==null?norm:safe(row?.score);
  };
  // The reference dataset may exist even when this particular row lacks a percentile.
  // Never present a raw 0–100 score as if it were an empirical percentile.
  const evidence=(row,hasNorm,rank)=>
    hasNorm&&safe(row?.percentileExact??row?.percentile)!==null
      ?'אחוזון '+Math.round(rank)
      :'ציון '+Math.round(safe(row?.score))+'/100';
  const domainScore=(profile,key)=>safe(profile?.domains?.[key]?.score);
  const isLowQuality=profile=>{
    const v=profile?.validityFeatures;
    return !!(v&&(v.validityLevel==='low'||v.isSevereStraightline||v.isSuspectedRandomResponding));
  };
  function create(profile){
    if(!profile?.domains||isLowQuality(profile))return {available:false,reason:'quality'};
    const norm=Boolean(profile.empiricalReference);
    const candidates=[];
    for(const key of ['E','O','A','C']){
      const domain=profile.domains[key],list=Array.isArray(domain?.facets)?domain.facets:[];
      if(list.length===6){
        list.forEach((facet,index)=>{
          const description=FACETS[key][index],v=safe(facet?.score),rank=metric(facet,norm);
          if(!description||v===null||rank===null||v<55||rank<55)return;
          candidates.push({key,facet:key+(index+1),title:description[0],description:description[1],rank,score:v,
            evidence:evidence(facet,norm,rank)});
        });
      }else{
        const v=domainScore(profile,key),rank=metric(domain,norm);
        if(v!==null&&rank!==null&&v>=55&&rank>=55){
          candidates.push({key,facet:key,title:DOMAIN_FALLBACK[key][0],description:DOMAIN_FALLBACK[key][1],rank,score:v,
            evidence:evidence(domain,norm,rank)});
        }
      }
    }
    candidates.sort((a,b)=>b.rank-a.rank||b.score-a.score||a.facet.localeCompare(b.facet));
    const strengths=[],used=new Set();
    for(const candidate of candidates){
      if(used.has(candidate.key))continue;
      strengths.push(candidate);used.add(candidate.key);
      if(strengths.length===3)break;
    }
    if(strengths.length<3){
      for(const candidate of candidates){
        if(strengths.some(x=>x.facet===candidate.facet))continue;
        strengths.push(candidate);
        if(strengths.length===3)break;
      }
    }
    const risks=[
      {key:'A',test:x=>x>=80,deviation:x=>x-80,title:'גבולות לצד התחשבות',
        description:'כששיתוף הפעולה חשוב מאוד, כדאי לבדוק שנשאר מקום גם לצרכים ולהעדפות שלך.'},
      {key:'A',test:x=>x<=28,deviation:x=>28-x,title:'ישירות לצד קשב',
        description:'בדיון טעון, אפשר לנסות לוודא שגם נקודת המבט השנייה מקבלת מקום.'},
      {key:'C',test:x=>x>=85,deviation:x=>x-85,title:'דיוק לצד גמישות',
        description:'רף אישי גבוה עשוי להועיל, אך לפעמים כדאי להגדיר מראש מה נחשב מספיק טוב.'},
      {key:'C',test:x=>x<=28,deviation:x=>28-x,title:'מרחב לצד מסגרת',
        description:'משימה גדולה עשויה להיות נוחה יותר כשמחלקים אותה לצעדים קצרים וברורים.'},
      {key:'N',test:x=>x>=75,deviation:x=>x-75,title:'מרחב בעומס',
        description:'אם עומס מורגש בעוצמה, אפשר לנסות ליצור זמן מעבר קצר בין משימות.'},
      {key:'E',test:x=>x<=25,deviation:x=>25-x,title:'זמן אישי לצד תקשורת',
        description:'אם נוח לך זמן שקט, כדאי גם לקבוע מתי חשוב לשתף אחרים במידע או בצורך.'}
    ];
    const challenges=risks.flatMap(rule=>{
      const v=domainScore(profile,rule.key);
      return v!==null&&rule.test(v)?[{key:rule.key,title:rule.title,
        description:rule.description,priority:rule.deviation(v)}]:[];
    }).sort((a,b)=>b.priority-a.priority||a.key.localeCompare(b.key)).slice(0,2);
    const top=ORDER.filter(k=>domainScore(profile,k)!==null)
      .map(key=>({key,rank:metric(profile.domains[key],norm)}))
      .filter(x=>x.rank!==null)
      .sort((a,b)=>b.rank-a.rank).slice(0,2).map(x=>x.key);
    const pair=(a,b)=>top.includes(a)&&top.includes(b);
    let tip='בחר תחום אחד שחשוב לך השבוע, ונסה צעד קטן ומדיד לפני שמרחיבים את התוכנית.';
    if(pair('O','C'))tip='בחר רעיון אחד שמסקרן אותך, והקדש לו זמן מוגדר כדי להפוך אותו לצעד מעשי.';
    else if(pair('N','O'))tip='נסה לרשום רעיון או מחשבה שחוזרים אליך, ולבחור פעולה קטנה שאפשר לבצע לגביהם.';
    else if(pair('E','A'))tip='קבע השבוע מפגש או שיחה משמעותית, והשאר גם מקום לזמן האישי שלך.';
    else if(domainScore(profile,'C')!==null&&domainScore(profile,'E')!==null
      &&domainScore(profile,'C')>=70&&domainScore(profile,'E')<=40)
      tip='נסה לקבוע חלון עבודה שקט ולצדו זמן קצר לעדכון או לשיתוף אחרים.';
    else if(domainScore(profile,'C')!==null&&domainScore(profile,'C')<=35)
      tip='נסה לפרק משימה אחת לשלושה צעדים קצרים, והתחל בראשון בלבד.';
    return {available:true,strengths,challenges,tip,hasFacetData:strengths.some(x=>x.facet.length===2)};
  }
  return Object.freeze({create});
});
