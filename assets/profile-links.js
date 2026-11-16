/* ofiLab profile links: finds where a person's facets split from the way they usually go together,
 * and ties each finding to the person's own answers. No network, no storage, no user identifiers.
 *
 * Method (data/profile-links.json, tools/build-profile-links.py, N = 145,388):
 *   z_k    = probit of the person's midrank percentile for facet k
 *   u      = (z_i - sign(r) * z_j) / sqrt(2 * (1 - |r|))   for every facet pair that usually goes together (|r| >= .30)
 *   a pair is a "link" when |u| >= 2 and at least one facet is clearly high or low (percentile <= 20 or >= 80).
 *   rarity = the observed share of the cohort at least this unusual in this direction (tail curve in the data file).
 * Pairs are ranked by |u| (cross-domain pairs get a small bonus); each facet is used once; at most three are shown.
 */
(function(root){
  'use strict';
  const MAX_LINKS=3, MIN_U=2.0, CLEAR_Z=0.8416; // percentile 80 / 20
  const MAX_EVIDENCE=2;

  function loadData(){
    if(root&&root.OfiProfileLinksData)return root.OfiProfileLinksData;
    if(typeof module!=='undefined'&&module.exports&&typeof require==='function'){
      try{return require('./profile-links-data.js');}catch(_e){}
    }
    return null;
  }
  // Inverse normal CDF (Acklam), good to ~1e-9.
  function probit(p){
    const a=[-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00];
    const b=[-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,6.680131188771972e+01,-1.328068155288572e+01];
    const c=[-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,-2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00];
    const d=[7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,3.754408661907416e+00];
    const lo=0.02425,hi=1-lo;let q,r;
    if(p<lo){q=Math.sqrt(-2*Math.log(p));return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
    if(p>hi){q=Math.sqrt(-2*Math.log(1-p));return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
    q=p-0.5;r=q*q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  }
  function tailShare(tail,u){
    if(u<=tail[0][0])return tail[0][1];
    for(let i=1;i<tail.length;i++){
      if(u<=tail[i][0]){const t0=tail[i-1],t1=tail[i];return t0[1]+(t1[1]-t0[1])*(u-t0[0])/(t1[0]-t0[0]);}
    }
    return tail[tail.length-1][1];
  }
  const levelOf=z=>z>=CLEAR_Z?'high':z<=-CLEAR_Z?'low':'mid';
  const LEVEL_HE={high:'ברמה גבוהה',low:'ברמה נמוכה',mid:'ברמה בינונית'};

  // The person's own answers that most clearly show this facet's direction.
  function evidenceFor(key,level,bank,answers){
    if(!bank||!Array.isArray(bank.items)||!Array.isArray(answers)||level==='mid')return [];
    const picks=[];
    bank.items.forEach((item,i)=>{
      if(item.domain+item.facet!==key)return;
      const raw=answers[i];if(!Number.isInteger(raw)||raw<1||raw>5)return;
      const keyed=item.keyed==='minus'?6-raw:raw;           // 5 = most toward the high pole of the facet
      const strength=level==='high'?keyed:6-keyed;
      if(strength>=4)picks.push({strength,raw,order:i,text:item.he,scale:Array.isArray(bank.scale)?bank.scale[raw-1]:null});
    });
    picks.sort((a,b)=>b.strength-a.strength||a.order-b.order);
    return picks.slice(0,MAX_EVIDENCE).map(p=>({text:p.text,answer:p.scale,answerValue:p.raw}));
  }
  const pctText=p=>p<0.1?'פחות מ־0.1%':(p<10?Math.round(p*10)/10:Math.round(p))+'%';

  /* rows: profile.normRows (facet rows have key like "N1" and percentileExact); bank/answers optional (evidence).
   * mode: 120 or 300 (50 has no facets and returns []). */
  function find(rows,bank,answers,mode){
    const data=loadData();
    const m=data&&data.modes&&data.modes[String(mode)];
    if(!m||!Array.isArray(rows))return [];
    const byKey={};
    for(const r of rows){
      if(r&&typeof r.key==='string'&&r.key.length===2&&typeof r.percentileExact==='number'&&Number.isFinite(r.percentileExact)){
        byKey[r.key]={row:r,z:probit(Math.min(0.995,Math.max(0.005,r.percentileExact/100)))};
      }
    }
    if(Object.keys(byKey).length<30)return [];
    const found=[];
    for(const [ka,kb,r] of m.pairs){
      const a=byKey[ka],b=byKey[kb];if(!a||!b)continue;
      const u=(a.z-Math.sign(r)*b.z)/Math.sqrt(2*(1-Math.abs(r)));
      if(Math.abs(u)<MIN_U)continue;
      if(Math.max(Math.abs(a.z),Math.abs(b.z))<CLEAR_Z)continue;
      const cross=ka[0]!==kb[0];
      found.push({ka,kb,r,u,score:Math.abs(u)+(cross?0.25:0),cross});
    }
    found.sort((x,y)=>y.score-x.score||x.ka.localeCompare(y.ka));
    const used=new Set(),out=[];
    for(const f of found){
      if(used.has(f.ka)||used.has(f.kb))continue;
      used.add(f.ka);used.add(f.kb);
      const A=byKey[f.ka],B=byKey[f.kb];
      const la=levelOf(A.z),lb=levelOf(B.z);
      const share=tailShare(m.tail,Math.abs(f.u))*100;            // observed share at least this unusual, one direction
      const together=f.r>0;
      const labelA=A.row.label||f.ka,labelB=B.row.label||f.kb;
      const pa=Math.round(A.row.percentileExact),pb=Math.round(B.row.percentileExact);
      const title=labelA+' '+LEVEL_HE[la]+' · '+labelB+' '+LEVEL_HE[lb];
      const usual=together
        ?'בדרך כלל מי שגבוה באחד גבוה גם בשני, ומי שנמוך באחד נמוך גם בשני'
        :'בדרך כלל מי שגבוה באחד נמוך בשני';
      const rText=(f.r<0?'−':'')+(Math.round(Math.abs(f.r)*100)/100).toFixed(2);
      const text=usual+' (קשר r = '+rText+' בין 145 אלף משיבים). '
        +'אצלך: '+labelA+' באחוזון '+pa+' ו'+labelB+' באחוזון '+pb+'. פער כזה, או גדול ממנו באותו כיוון, מופיע אצל '+(share<0.1?'':'כ־')+pctText(share)+' מהאנשים לזוג זה (נבדקים '+m.pairs.length+' צמדים, כך שאצל רוב האנשים מופיע לפחות קישור אחד).';
      out.push({
        type:'link',badge:'קישור בין תכונות',tone:'neutral',title,text,
        keys:[f.ka,f.kb],r:f.r,u:Math.round(Math.abs(f.u)*100)/100,prevalencePct:Math.round(share*100)/100,
        evidence:[
          {key:f.ka,label:labelA,level:la,items:evidenceFor(f.ka,la,bank,answers)},
          {key:f.kb,label:labelB,level:lb,items:evidenceFor(f.kb,lb,bank,answers)}
        ].filter(e=>e.items.length)
      });
      if(out.length>=MAX_LINKS)break;
    }
    return out;
  }

  // "In your own answers": the items that most clearly show each facet's direction. Plain text only (no HTML).
  function evidenceNode(doc,insight){
    if(!doc||!insight||!Array.isArray(insight.evidence)||!insight.evidence.length)return null;
    const box=doc.createElement('div');box.className='link-evidence';
    const head=doc.createElement('strong');head.textContent='מה בתשובות שלך יוצר את זה';box.append(head);
    const list=doc.createElement('ul');
    for(const group of insight.evidence){
      for(const item of group.items){
        const li=doc.createElement('li');
        const tag=doc.createElement('span');tag.className='link-evidence-facet';
        tag.textContent=group.label+' · '+LEVEL_HE[group.level];
        li.append(tag,doc.createTextNode(' ענית "'+(item.answer||item.answerValue)+'": '+item.text));
        list.append(li);
      }
    }
    box.append(list);return box;
  }

  const api={find,probit,tailShare,evidenceNode,MAX_LINKS,MIN_U,CLEAR_Z};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.OfiProfileLinks=api;
})(typeof window!=='undefined'?window:globalThis);
