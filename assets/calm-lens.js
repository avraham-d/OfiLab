/* ofiLab Calm V2 — personality lens. A brilliant-cut gem drawn on one canvas.
 * Local-only: no network, no storage, no scoring changes. It reads the profile it is given.
 *
 *   girdle + warm core   = the five Big Five domains (the cut widens toward the strong ones)
 *   5 trait kites + rays = one crown facet and one pavilion ray per domain, in its colour;
 *                          together they are its gauge, a spoke filled from the core outwards
 *                          as far as the score reaches
 *   5 labels             = each domain's name and value on an arc outside its kite (when there
 *                          is room for readable letters; the key under the summary otherwise)
 *   30 small crown faces = the facet scores: two stars and four girdle faces per domain,
 *                          each above its own node; stronger scores catch more light
 *   30 inner nodes       = the same facet scores (brighter, larger and nearer the surface when stronger)
 *   fibres between nodes = facet pairs that go together in the reference sample (OfiProfileLinksData)
 *   pulses               = more frequent and brighter between two strong ends, rare between weak ones;
 *                          a pulse that reaches a node makes its crown face glint
 */
(function(root){
  'use strict';
  const ORDER=['N','E','O','A','C'];
  const LABELS={N:'רגישות רגשית',E:'מוחצנות',O:'פתיחות',A:'נועם הליכות',C:'מצפוניות'};
  // Same swatches as the five-trait key under the summary, so the legend keeps matching.
  const TINTS=['#9873BD','#B393DA','#E5AE75','#8F6EB3','#BFA0D8'];
  const TAU=Math.PI*2,CX=160,CY=160,R=122,VIEW=320;
  const RINGS=[.60,.83,.49,.74,.55,.86];
  const clamp01=n=>Math.max(0,Math.min(1,n));
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const angleOf=i=>-Math.PI/2+i*TAU/5;
  const ease=t=>1-Math.pow(1-clamp01(t),3);
  // Stable per-node variation; a visual seed only, never shown as data.
  const hash=text=>{let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return ((h>>>0)%10000)/10000;};

  function percentileOf(entry){
    const p=entry?.percentileExact??entry?.percentile;
    return finite(Number(p))&&p!==null&&p!==''?Number(p):null;
  }
  function strengthOf(entry,mode,fallback){
    const score=Number(entry?.score),pct=percentileOf(entry);
    const value=mode==='percentile'&&pct!==null?pct:score;
    return finite(value)?clamp01(value/100):fallback;
  }
  // Periodic kernel blend of the five domain strengths: smooth everywhere, no corners.
  function blend(strengths,kappa){
    return theta=>{
      let sum=0,weight=0;
      for(let i=0;i<5;i++){
        const k=Math.exp(kappa*(Math.cos(theta-angleOf(i))-1));
        sum+=k*strengths[i];weight+=k;
      }
      return sum/weight;
    };
  }
  function linkPairs(data,total){
    const modes=data&&data.modes;
    if(!modes)return null;
    const mode=modes[String(total)]||modes['300']||modes[Object.keys(modes)[0]];
    return mode&&Array.isArray(mode.pairs)?mode.pairs:null;
  }

  // Pure data model; no DOM. Everything the renderer draws comes from here.
  function model(domains,opts={}){
    const mode=opts.mode==='percentile'?'percentile':'score';
    const traits=ORDER.map((key,index)=>{
      const entry=domains?.[key]||{};
      return {id:key,kind:'trait',key,index,label:entry.label||LABELS[key],tint:TINTS[index],
        score:finite(Number(entry.score))?Number(entry.score):null,percentile:percentileOf(entry),
        strength:strengthOf(entry,mode,.5),angle:angleOf(index),x:Math.cos(angleOf(index))*.3,y:Math.sin(angleOf(index))*.3,z:.14,
        phase:hash(key)*TAU,seq:index};
    });
    const strengths=traits.map(t=>t.strength);
    const mean=strengths.reduce((a,b)=>a+b,0)/5;
    const shape=blend(strengths,3.2),soft=blend(strengths,1.3);
    const outline=theta=>.76+.24*shape(theta);
    const coreShape=theta=>.82+.18*soft(theta);
    const core={id:'core',kind:'core',key:null,label:'',tint:'#F3BE7C',strength:mean,x:0,y:0,z:0,phase:0,seq:0};
    const facets=[];
    for(const trait of traits){
      const list=Array.isArray(domains?.[trait.key]?.facets)?domains[trait.key].facets:[];
      for(let j=0;j<6;j++){
        const entry=list[j]||null,id=trait.key+(j+1),seed=hash(id);
        const strength=strengthOf(entry,mode,trait.strength);
        const theta=trait.angle+(j-2.5)*(TAU/5)*.17,rho=RINGS[j]*outline(theta);
        facets.push({id,kind:'facet',key:trait.key,index:trait.index,facetIndex:j,parent:trait.id,
          label:entry?.label||trait.label+' '+(j+1),tint:trait.tint,
          score:entry&&finite(Number(entry.score))?Number(entry.score):null,percentile:percentileOf(entry),
          strength,x:Math.cos(theta)*rho,y:Math.sin(theta)*rho,
          // Strong facets sit near the surface and read crisp; weak ones sink into the frost.
          z:-.4+.72*strength+(seed-.5)*.16,phase:seed*TAU,seq:5+trait.index*6+j});
      }
    }
    const nodes=[...traits,...facets],byId=new Map([[core.id,core],...nodes.map(n=>[n.id,n])]);
    const links=[],seen=new Set(),neighbors=new Map([...byId.keys()].map(id=>[id,[]]));
    const connect=(a,b,kind,r)=>{
      const tag=a<b?a+'|'+b:b+'|'+a;
      if(seen.has(tag)||!byId.has(a)||!byId.has(b))return;
      seen.add(tag);
      const from=byId.get(a),to=byId.get(b);
      const link={a:from,b:to,kind,r,activity:from.strength*to.strength,bend:(hash(tag)-.5)*.5};
      links.push(link);
      neighbors.get(a).push({node:to,link,r});neighbors.get(b).push({node:from,link,r});
    };
    for(const trait of traits)connect('core',trait.id,'spine',1);
    for(const facet of facets)connect(facet.parent,facet.id,'branch',1);
    const pairs=linkPairs(opts.links,opts.total);
    if(pairs){
      // Each facet keeps its two strongest empirical partners; the union stays readable.
      const best=new Map(facets.map(f=>[f.id,[]]));
      for(const [a,b,r] of pairs){
        if(!best.has(a)||!best.has(b)||!finite(r))continue;
        best.get(a).push([b,r]);best.get(b).push([a,r]);
      }
      for(const [id,list] of best){
        list.sort((p,q)=>Math.abs(q[1])-Math.abs(p[1]));
        for(const [other,r] of list.slice(0,2))connect(id,other,'bond',r);
      }
    }else{
      // No reference table loaded: neighbouring facets only, so nothing is implied about the sample.
      for(let i=0;i<facets.length;i++)connect(facets[i].id,facets[(i+1)%facets.length].id,'bond',null);
    }
    return {mode,traits,facets,nodes,core,links,neighbors,byId,outline,coreShape,mean,empirical:Boolean(pairs)};
  }

  // Pulses per second on a fibre: a product, so one weak end keeps the fibre quiet.
  const pulseRate=link=>.006+.17*Math.pow(link.activity,1.5);

  const PALETTES={
    light:{
      body:[[0,'rgba(255,255,255,.99)'],[.36,'rgba(250,246,255,.96)'],[.7,'rgba(236,227,251,.95)'],[1,'rgba(211,195,238,.96)']],
      shade:'rgba(126,98,176,', frost:'rgba(255,255,255,', rimLight:'rgba(255,255,255,', rimShade:'rgba(140,112,190,',
      edge:'rgba(168,142,206,.5)', edgeLight:'rgba(255,255,255,.95)', shadow:'rgba(116,88,160,', aura:'rgba(196,172,236,',
      coreWarm:'rgba(255,205,150,', coreHot:'rgba(255,252,240,', coreRose:'rgba(250,186,166,',
      fibre:'rgba(128,100,184,', fibreLit:'rgba(216,150,92,', bead:'rgba(255,255,255,', pulse:'#F2B46E', pulseHot:'rgba(255,253,246,',
      glowAlpha:1,
      // Gem facets: [pavilion light, pavilion shade, crown light, crown shade, fire, trait colour].
      gem:[.62,.50,.70,.42,.34,.46], spark:.95, facetEdge:'rgba(132,104,184,', edgeAlpha:.2, ink:'rgba(66,50,98,'
    },
    dark:{
      body:[[0,'rgba(196,178,232,.42)'],[.36,'rgba(150,128,198,.34)'],[.7,'rgba(104,84,150,.36)'],[1,'rgba(74,58,112,.52)']],
      shade:'rgba(20,12,36,', frost:'rgba(214,198,244,', rimLight:'rgba(238,226,255,', rimShade:'rgba(18,10,32,',
      edge:'rgba(212,190,244,.42)', edgeLight:'rgba(244,234,255,.5)', shadow:'rgba(8,4,16,', aura:'rgba(164,132,220,',
      coreWarm:'rgba(255,196,132,', coreHot:'rgba(255,248,232,', coreRose:'rgba(244,160,150,',
      fibre:'rgba(214,196,246,', fibreLit:'rgba(255,208,150,', bead:'rgba(255,255,255,', pulse:'#FFC98A', pulseHot:'rgba(255,252,244,',
      glowAlpha:.9,
      gem:[.48,.62,.64,.36,.46,.56], spark:.95, facetEdge:'rgba(238,226,255,', edgeAlpha:.2, ink:'rgba(236,228,252,', lit:true
    }
  };
  const rgb=hex=>{const n=parseInt(hex.slice(1),16);return [(n>>16)&255,(n>>8)&255,n&255];};
  const sprites=new Map();
  function glowSprite(color){
    let sprite=sprites.get(color);
    if(sprite)return sprite;
    sprite=document.createElement('canvas');sprite.width=sprite.height=96;
    const c=sprite.getContext('2d'),[r,g,b]=rgb(color),grad=c.createRadialGradient(48,48,0,48,48,48);
    grad.addColorStop(0,'rgba('+r+','+g+','+b+',.78)');
    grad.addColorStop(.28,'rgba('+r+','+g+','+b+',.34)');
    grad.addColorStop(.62,'rgba('+r+','+g+','+b+',.09)');
    grad.addColorStop(1,'rgba('+r+','+g+','+b+',0)');
    c.fillStyle=grad;c.fillRect(0,0,96,96);
    sprites.set(color,sprite);
    return sprite;
  }

  // A four-point glint, drawn once and reused for every sparkle.
  let glint=null;
  function glintSprite(){
    if(glint)return glint;
    glint=document.createElement('canvas');glint.width=glint.height=128;
    const c=glint.getContext('2d');
    let g=c.createRadialGradient(64,64,0,64,64,30);
    g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.22,'rgba(255,255,255,.5)');g.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=g;c.fillRect(0,0,128,128);
    for(const [dx,dy,reach] of [[1,0,62],[0,1,62],[.7071,.7071,26],[.7071,-.7071,26]]){
      g=c.createLinearGradient(64-dx*reach,64-dy*reach,64+dx*reach,64+dy*reach);
      g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,.95)');g.addColorStop(1,'rgba(255,255,255,0)');
      c.fillStyle=g;c.beginPath();
      c.moveTo(64-dx*reach,64-dy*reach);c.lineTo(64-dy*1.7,64+dx*1.7);c.lineTo(64+dx*reach,64+dy*reach);c.lineTo(64+dy*1.7,64-dx*1.7);
      c.closePath();c.fill();
    }
    return glint;
  }

  function metricLine(node,mode){
    const parts=[];
    if(mode==='percentile'&&node.percentile!==null)parts.push('אחוזון '+Math.round(node.percentile));
    if(node.score!==null)parts.push('ציון '+Math.round(node.score)+'/100');
    return parts.join(' · ');
  }
  function relationLine(node,m){
    if(node.kind==='trait'){
      const own=m.facets.filter(f=>f.key===node.key&&f.score!==null);
      if(own.length<2)return '';
      const sorted=own.slice().sort((a,b)=>b.strength-a.strength);
      return 'בולט: '+sorted[0].label+' · מתון: '+sorted[sorted.length-1].label;
    }
    if(!m.empirical)return '';
    const bonds=m.neighbors.get(node.id).filter(n=>n.link.kind==='bond')
      .sort((a,b)=>Math.abs(b.r)-Math.abs(a.r)).slice(0,2).map(n=>n.node.label);
    return bonds.length?'קשור במדגם אל: '+bonds.join(', '):'';
  }

  // Render-only solid: a brilliant cut seen through its table. Every vertex sits on one of twenty
  // rays whose reach is the model's five-domain envelope, so the stone widens toward strong traits.
  // The faces are the convex hull of those vertices: closed, convex and planar for every profile.
  const EYE=1/.3,STEP=TAU/20,TURN=.6,NOD=.42,SPREAD=1.25,LABEL_MIN=170;
  // Dispersion at the edge of a flash: warm on one side of it, cool on the other.
  const FIRE=['rgba(255,198,132,','rgba(255,158,196,','rgba(140,208,255,','rgba(158,246,220,'];
  // The stone exaggerates the model's envelope a little, so a weak trait is visibly shorter.
  const spread=outline=>1-(1-outline)*SPREAD;
  function quartzMesh(m){
    const vertices=[],C18=Math.cos(STEP),MAIN=.36/.98;
    const ring=(kind,r,z,parity)=>{
      for(let k=0;k<20;k++){
        if(parity!==undefined&&(k&1)!==parity)continue;
        const a=-Math.PI/2+k*STEP,reach=r*spread(m.outline(a));
        vertices.push({x:Math.cos(a)*reach,y:Math.sin(a)*reach,z,kind,ray:k,px:0,py:0,pz:0});
      }
    };
    ring('T',.58,.76,0);                     // table corners: one toward each trait, one between
    ring('S',.80/C18,.76-.45/.52*.22,1);     // star tips, on the plane of the two kites they join
    ring('G',1.10,.31);ring('B',1.10,.19);   // girdle band
    ring('P',.98,-.56);                      // belly: room for the deepest facet nodes
    ring('Q',.34,MAIN*.34*C18-.92,1);        // where two pavilion mains part
    vertices.push({x:0,y:0,z:-.92,kind:'C',ray:-1,px:0,py:0,pz:0});
    const faces=[],seen=new Set(),n=vertices.length,EPS=1e-7;
    // No facet reaches past its neighbouring rays (the table aside), so only nearby triples are tried.
    const near=(p,q)=>p.ray<0||q.ray<0||(p.ray-q.ray+22)%20<5||(p.kind==='T'&&q.kind==='T');
    for(let i=0;i<n;i++){
      const a=vertices[i],around=[],probe=[];
      for(let j=0;j<n;j++)if(near(a,vertices[j])){probe.push(vertices[j]);if(j>i)around.push(vertices[j]);}
      for(const p of vertices)if(!near(a,p))probe.push(p);
      for(let j=0;j<around.length;j++)for(let k=j+1;k<around.length;k++){
      const b=around[j],c=around[k];
      if(!near(b,c))continue;
      const ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z,vx=c.x-a.x,vy=c.y-a.y,vz=c.z-a.z;
      let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      const len=Math.sqrt(nx*nx+ny*ny+nz*nz);
      if(len<1e-9)continue;
      nx/=len;ny/=len;nz/=len;
      // A hull face has every vertex on one side. Neighbours are probed first: they are the ones
      // that can lie outside a nearby plane, so the many interior planes are rejected at once.
      let above=false,below=false;
      for(let q=0;q<n&&!(above&&below);q++){
        const p=probe[q],d=(p.x-a.x)*nx+(p.y-a.y)*ny+(p.z-a.z)*nz;
        if(d>EPS)above=true;else if(d<-EPS)below=true;
      }
      if(above&&below)continue;
      const on=[];
      for(let q=0;q<n;q++){
        const p=vertices[q];
        if(Math.abs((p.x-a.x)*nx+(p.y-a.y)*ny+(p.z-a.z)*nz)<=EPS)on.push(q);
      }
      const key=on.join();
      if(seen.has(key))continue;
      seen.add(key);
      if(above){nx=-nx;ny=-ny;nz=-nz;}
      const points=on.map(q=>vertices[q]),center={x:0,y:0,z:0},tally={};
      for(const p of points){center.x+=p.x/points.length;center.y+=p.y/points.length;center.z+=p.z/points.length;tally[p.kind]=(tally[p.kind]||0)+1;}
      const e=points[0],ex=e.x-center.x,ey=e.y-center.y,ez=e.z-center.z,wx=ny*ez-nz*ey,wy=nz*ex-nx*ez,wz=nx*ey-ny*ex;
      const turn=p=>Math.atan2((p.x-center.x)*wx+(p.y-center.y)*wy+(p.z-center.z)*wz,(p.x-center.x)*ex+(p.y-center.y)*ey+(p.z-center.z)*ez);
      points.sort((p,q)=>turn(p)-turn(q));
      const has=t=>tally[t]||0,reach=p=>p.x*p.x+p.y*p.y;
      const inner=points.reduce((p,q)=>reach(q)<reach(p)?q:p),outer=points.reduce((p,q)=>reach(q)>reach(p)?q:p);
      const kind=has('C')?'main':has('Q')?'lower':has('P')?'wall':has('B')?'girdle'
        :!has('G')&&!has('S')?'table':!has('G')&&has('T')>1?'star':has('T')||has('S')>1?'kite':'upper';
      // What the face stands for: its trait sector, and the facet node it sits above.
      const azimuth=Math.atan2(center.y,center.x),kf=((azimuth+Math.PI/2)/STEP+20)%20;
      const sector=Math.round(kf/4),trait=sector%5,off=kf-4*sector;
      let node=null;
      if(kind==='star')node=m.facets[trait*6+(off<0?1:4)];
      else if(kind==='upper')node=m.facets[trait*6+(off<-1?0:off<0?2:off<1?3:5)];
      else if((kind==='kite'||kind==='main')&&Math.abs(off)<1)node=m.traits[trait];
      let tint=node&&node.tint;
      if(!tint){
        const lo=Math.floor(kf/4),t=kf/4-lo,p=rgb(TINTS[lo%5]),q=rgb(TINTS[(lo+1)%5]);
        tint='#'+p.map((v,i)=>Math.round(v+(q[i]-v)*t).toString(16).padStart(2,'0')).join('');
      }
      const strength=kind==='table'?m.mean:node?node.strength:clamp01((m.outline(azimuth)-.76)/.24);
      faces.push({points,inner,outer,nx,ny,nz,center,kind,node,strength,tint:'rgba('+rgb(tint).join(',')+',',
        bright:'rgba('+rgb(tint).map(v=>Math.round(v+(255-v)*.42)).join(',')+',',
        crown:kind==='star'||kind==='kite'||kind==='upper',alt:Math.floor(kf)&1,band:Math.round(kf*2)%4,
        front:false,light:0,fresnel:0,spec:0,flash:0,fire:0,hue:0,cx:0,cy:0});
      }
    }
    // Each trait's gauge runs from the culet to the girdle, through its pavilion ray and its kite.
    const culet=vertices[vertices.length-1];
    const gauges=m.traits.map((_,i)=>({from:culet,to:vertices.find(p=>p.kind==='G'&&p.ray===4*i)}));
    return {vertices,faces,gauges,sorted:vertices.slice(),hull:[]};
  }

  function projectQuartz(mesh,yaw,pitch,radius){
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    for(const p of mesh.vertices){
      const x=p.x*cy+p.z*sy,z=-p.x*sy+p.z*cy,y=p.y*cp-z*sp,depth=p.y*sp+z*cp,k=1/(1-depth*.3);
      p.px=CX+x*radius*k;p.py=CY+y*radius*k;p.pz=depth;
    }
    for(const f of mesh.faces){
      const nx=f.nx*cy+f.nz*sy,nz=-f.nx*sy+f.nz*cy,ny=f.ny*cp-nz*sp,nz2=f.ny*sp+nz*cp;
      const c=f.center,x=c.x*cy+c.z*sy,z=-c.x*sy+c.z*cy,y=c.y*cp-z*sp,depth=c.y*sp+z*cp,k=1/(1-depth*.3);
      const distance=Math.hypot(x,y,EYE-depth),view=(-nx*x-ny*y+nz2*(EYE-depth))/distance;
      f.front=view>0;f.cx=CX+x*radius*k;f.cy=CY+y*radius*k;
      f.fresnel=.04+.96*Math.pow(1-Math.abs(view),5);
      // Where this plane mirrors the eye into the studio; turning the stone sweeps it across the lights.
      const rx=2*nz2*nx,ry=2*nz2*ny,rz=2*nz2*nz2-1,key=-rx*.45-ry*.6+rz*.66;
      f.light=clamp01(.5+.5*key);
      f.spec=Math.pow(Math.max(0,key),16)+.3*Math.pow(Math.max(0,rx*.7-ry*.1+rz*.7),24);
      // Narrow window bands: neighbouring facets flash in turn rather than together (scintillation).
      const phase=7.2*(rx*.8+ry*.6)+2.4*rz+1.2,band=.5+.5*Math.cos(phase);
      f.flash=band*band*band*band;
      f.fire=Math.max(0,1-Math.abs(band-.58)/.2);
      f.hue=(Math.sin(phase)>0?0:2)+(band>.58?0:1);
    }
    // Convex projected silhouette also includes side faces at maximum pointer tilt.
    mesh.sorted.sort((a,b)=>a.px-b.px||a.py-b.py);
    const hull=mesh.hull;hull.length=0;
    const cross=(a,b,c)=>(b.px-a.px)*(c.py-a.py)-(b.py-a.py)*(c.px-a.px);
    for(const p of mesh.sorted){while(hull.length>1&&cross(hull[hull.length-2],hull[hull.length-1],p)<=0)hull.pop();hull.push(p);}
    const lower=hull.length;
    for(let i=mesh.sorted.length-2;i>=0;i--){const p=mesh.sorted[i];while(hull.length>lower&&cross(hull[hull.length-2],hull[hull.length-1],p)<=0)hull.pop();hull.push(p);}
    hull.pop();
  }

  function mount(domains,opts={}){
    const m=model(domains,opts);
    const reduced=()=>Boolean(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
    const el=make('div','ofi-glyph ofi-lens');
    el.setAttribute('role','group');
    el.setAttribute('aria-label','עדשת האישיות: חמש התכונות מעצבות את קו המתאר והליבה, ושלושים תחומי המשנה מאירים בתוכה לפי עוצמתם');
    const canvas=make('canvas','ofi-lens__canvas');
    canvas.setAttribute('aria-hidden','true');
    el.append(canvas);
    const ctx=canvas.getContext('2d');
    const open=key=>{if(typeof opts.onOpen==='function')opts.onOpen(key);};

    // Keyboard and screen-reader layer: five reachable traits, thirty listed facets.
    const buttons=new Map();
    for(const trait of m.traits){
      const button=make('button','ofi-lens__trait');
      button.type='button';button.dataset.glyphTrait=trait.key;button.tabIndex=0;
      button.setAttribute('aria-label',trait.label+', '+(metricLine(trait,m.mode)||'ללא ציון')+'. מעבר לפירוט התכונה');
      button.addEventListener('focus',()=>setFocus(trait,'key'));
      button.addEventListener('blur',()=>{if(focus===trait)setFocus(null);});
      button.addEventListener('click',()=>open(trait.key));
      buttons.set(trait.id,button);el.append(button);
    }
    const list=make('ul','ofi-lens__sr');
    for(const facet of m.facets){
      const item=make('li',null,m.byId.get(facet.parent).label+' · '+facet.label+': '+(metricLine(facet,m.mode)||'ללא ציון'));
      item.dataset.lensNode=facet.id;
      if(facet.score!==null)item.dataset.lensFacetScore=String(facet.score);
      list.append(item);
    }
    el.append(list);
    const tip=make('div','ofi-lens__tip');
    tip.setAttribute('aria-hidden','true');tip.dir='rtl';
    const tipKicker=make('span','ofi-lens__tip-kicker'),tipTitle=make('strong','ofi-lens__tip-title');
    const tipMetric=make('span','ofi-lens__tip-metric'),tipMeter=make('span','ofi-lens__tip-meter');
    const tipFill=make('span','ofi-lens__tip-fill'),tipRelation=make('span','ofi-lens__tip-relation');
    tipMeter.append(tipFill);tip.append(tipKicker,tipTitle,tipMetric,tipMeter,tipRelation);
    el.append(tip);

    // Render state.
    const all=[m.core,...m.nodes];
    for(const n of all){n.px=CX;n.py=CY;n.pz=0;n.pk=1;n.lit=0;n.dim=1;n.flare=0;}
    let pulses=[],focus=null,focusSource=null,armed=null,waveAt=0;
    let size=0,dpr=1,raf=0,last=0,clock=0,revealAt=opts.animate&&!reduced()&&!document.hidden?0:2;
    let tiltX=0,tiltY=0,aimX=0,aimY=0,alive=true,inView=true,pointerType='mouse';
    const quartz=quartzMesh(m),sparks=[];
    // Second image of the table inside the stone: a depth cue that slides against the crown on tilt.
    const echo=[.5,.36].map((r,i)=>Array.from({length:10},(_,k)=>{
      const a=-Math.PI/2+(2*k+1-i)*STEP,reach=r*m.outline(a);
      return {x:Math.cos(a)*reach,y:Math.sin(a)*reach,z:-.34-.26*i,phase:0,px:0,py:0,pz:0,pk:1};
    }));
    const table=quartz.faces.find(f=>f.kind==='table');
    // Farthest the silhouette gets from the centre while it sways and follows the pointer.
    let reach=0;
    for(const yaw of [-.37,0,.37])for(const pitch of [-.275,0,.275]){
      projectQuartz(quartz,yaw,pitch,R*1.006);
      for(const p of quartz.vertices)reach=Math.max(reach,Math.hypot(p.px-CX,p.py-CY));
    }
    let sweepFrom=-1,sweepNext=0;
    // Labels: with room for them the stone steps back a little and each trait is named at its kite.
    let zoom=1,labelled=false,fontUnits=0,family='sans-serif',ring=null,ringKey='';
    const placeButtons=()=>{
      for(const trait of m.traits){
        const style=buttons.get(trait.id).style;
        style.left=((CX+trait.x*R*zoom)/VIEW*100)+'%';style.top=((CY+trait.y*R*zoom)/VIEW*100)+'%';
      }
    };
    placeButtons();
    const shown=trait=>m.mode==='percentile'&&trait.percentile!==null?trait.percentile:trait.score;
    // Name and value set on an arc just outside the girdle, centred on the trait's direction.
    // Cached: it is redrawn only when the size, the theme or the selected trait changes.
    function labelRing(pal){
      const lead=focus?focus.key:'',key=canvas.width+'|'+pal.ink+'|'+lead+'|'+family;
      if(ring&&ringKey===key)return ring;
      ring=ring||document.createElement('canvas');ringKey=key;
      ring.width=ring.height=canvas.width;
      const c=ring.getContext('2d'),mid=VIEW/2-2-fontUnits/2,scale=canvas.width/VIEW;
      c.setTransform(scale,0,0,scale,0,0);c.textAlign='center';c.textBaseline='middle';
      const font=bold=>(bold?'760 ':'620 ')+fontUnits.toFixed(2)+'px '+family;
      for(const trait of m.traits){
        const value=shown(trait),digits=value===null?[]:[...String(Math.round(value))].map(ch=>[ch,true]);
        const hebrew=/[\u0590-\u05FF]/.test(trait.label),name=[...trait.label].map(ch=>[ch,false]);
        // Left to right as it is seen: Hebrew reads from the right, so its value sits to its left.
        const gap=digits.length?[[' ',false]]:[],glyphs=hebrew?[...digits,...gap,...name.reverse()]:[...name,...gap,...digits];
        const widths=glyphs.map(([ch,bold])=>{c.font=font(bold);return c.measureText(ch).width+fontUnits*.04;});
        // Above the middle the letters stand outward; below it they turn inward so they stay upright.
        const total=widths.reduce((a,b)=>a+b,0),turn=Math.sin(trait.angle)>.2?-1:1,quiet=lead&&lead!==trait.key;
        let at=trait.angle-turn*total/2/mid;
        glyphs.forEach(([ch,bold],i)=>{
          const a=at+turn*widths[i]/2/mid;at+=turn*widths[i]/mid;
          c.save();c.translate(CX+Math.cos(a)*mid,CY+Math.sin(a)*mid);c.rotate(a+turn*Math.PI/2);
          c.font=font(bold);c.fillStyle=pal.ink+(quiet?.34:bold?.96:.74)+')';c.fillText(ch,0,0);
          c.restore();
        });
      }
      return ring;
    }
    const corePoints=Array.from({length:48},(_,i)=>{const t=i/48*TAU;return [Math.cos(t),Math.sin(t),m.coreShape(t)];});
    const palette=()=>document.documentElement.dataset.theme==='dark'?PALETTES.dark:PALETTES.light;

    function blob(points,radius,ox,oy){
      const n=points.length,at=i=>{const p=points[(i+n)%n];return [CX+ox+p[0]*p[2]*radius,CY+oy+p[1]*p[2]*radius];};
      const a=at(-1),b=at(0);
      ctx.beginPath();ctx.moveTo((a[0]+b[0])/2,(a[1]+b[1])/2);
      for(let i=0;i<n;i++){const p=at(i),q=at(i+1);ctx.quadraticCurveTo(p[0],p[1],(p[0]+q[0])/2,(p[1]+q[1])/2);}
      ctx.closePath();
    }
    function glassPath(points,round){
      const count=points.length;
      ctx.beginPath();
      if(!round){ctx.moveTo(points[0].px,points[0].py);for(let i=1;i<count;i++)ctx.lineTo(points[i].px,points[i].py);}
      else{
        // Subpixel polishing of the already chamfered outline, with long planar edges intact.
        for(let i=0;i<count;i++){
          const p=points[i],a=points[(i+count-1)%count],b=points[(i+1)%count];
          const da=Math.min(round/Math.hypot(a.px-p.px,a.py-p.py),.24),db=Math.min(round/Math.hypot(b.px-p.px,b.py-p.py),.24);
          const x=p.px+(a.px-p.px)*da,y=p.py+(a.py-p.py)*da;
          if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
          ctx.quadraticCurveTo(p.px,p.py,p.px+(b.px-p.px)*db,p.py+(b.py-p.py)*db);
        }
      }
      ctx.closePath();
    }
    // How much a face is 'on': the score it stands for, raised while its node is selected or a
    // pulse has just reached it, lowered while another part of the stone is in focus.
    const lift=f=>{
      const n=f.node;
      const base=.08+.92*Math.pow(f.strength,1.25);
      return n?base*n.dim+.7*n.lit+.9*n.flare:base*(focus?.6:1);
    };
    // One polished plane: its light runs from the corner nearest the axis to the one farthest from
    // it, so two facets that share an edge meet in a clean step of tone.
    function polish(f,colour,alpha,from,to){
      const g=ctx.createLinearGradient(f.inner.px,f.inner.py,f.outer.px,f.outer.py);
      g.addColorStop(0,colour+(alpha*from).toFixed(3)+')');g.addColorStop(1,colour+(alpha*to).toFixed(3)+')');
      ctx.fillStyle=g;ctx.fill();
    }
    // A trait's gauge: its colour runs out from the core along the pavilion ray and on into the
    // kite, as far as the score reaches, and ends in a bright line. One axis for both faces, so
    // the level reads as a single length from the centre, like a spoke of a radar chart.
    function gauge(f,pal,colour){
      const n=f.node,axis=quartz.gauges[n.index],level=.17+.8*clamp01(n.strength);
      const fill=Math.min(.92,(.62+.3*n.lit+.2*n.flare)*n.dim*colour*1.9),rest=fill*.06;
      // On the dark stone the fill is a lighter cut of the trait colour, so it stands off the body.
      const paint=pal.lit?f.bright:f.tint,g=ctx.createLinearGradient(axis.from.px,axis.from.py,axis.to.px,axis.to.py);
      g.addColorStop(0,paint+(fill*.55).toFixed(3)+')');
      g.addColorStop(level-.03,paint+fill.toFixed(3)+')');
      g.addColorStop(level,pal.rimLight+(.92*n.dim).toFixed(3)+')');
      g.addColorStop(level+.025,f.tint+rest.toFixed(3)+')');
      g.addColorStop(1,f.tint+rest.toFixed(3)+')');
      ctx.fillStyle=g;ctx.fill();
    }
    function gemFaces(pal,front,sweep){
      const [backLight,backShade,crownLight,crownShade,fire,colour]=pal.gem;
      ctx.lineWidth=.55;ctx.lineJoin='round';
      for(const f of quartz.faces){
        if(f.front!==front||f.kind==='table')continue;
        const on=lift(f),kind=f.kind;
        glassPath(f.points,0);
        if(!front){
          // Pavilion, girdle and belly seen through the stone: the even light-and-dark cut pattern
          // behind the nodes, shifted a little by where each plane faces the light.
          const base=kind==='main'?(f.node?-.08:-.5):kind==='lower'?(f.alt?.3:-.16):kind==='wall'?(f.alt?-.4:-.28):.6;
          const tone=base+(f.light-.5)*.55+f.flash*.3*(.4+.6*on);
          const deep=kind==='main'||kind==='lower';
          const colourOf=tone>0?pal.frost:pal.shade,alpha=tone>0?Math.min(.8,tone*backLight):Math.min(.55,-tone*backShade);
          if(deep)polish(f,colourOf,alpha,tone>0?.45:1.15,tone>0?1.2:.6);
          else{ctx.fillStyle=colourOf+alpha.toFixed(3)+')';ctx.fill();}
          // The ray under each trait is the inner length of its gauge; the rest only hints at colour.
          if(kind==='main'&&f.node)gauge(f,pal,colour*1.35);
          else if(on>.2){ctx.fillStyle=f.tint+Math.min(.7,.05*on*colour).toFixed(3)+')';ctx.fill();}
          if(kind==='lower'&&f.fire>.05){ctx.fillStyle=FIRE[f.hue]+(f.fire*fire*.4*(.3+.7*on)).toFixed(3)+')';ctx.fill();}
          continue;
        }
        // Crown facets stay clear enough to read the nodes below; they speak in flashes.
        const near=sweep===null?0:Math.exp(-Math.pow((((f.cx-CX)*.8+(f.cy-CY)*.6)/R-sweep)/.2,2));
        const small=kind==='star'||kind==='upper',trait=kind==='kite'&&f.node;
        if(!f.crown){
          ctx.fillStyle=pal.rimLight+Math.min(.88,(.42+f.spec*.4+f.flash*.3+near*.3)*crownLight).toFixed(3)+')';ctx.fill();
          continue;
        }
        // A small face is as present as its facet score: strong ones stand lit, weak ones stay plain glass.
        const base=trait?-.22:kind==='kite'?-.14:(kind==='star'?.3:f.alt?.2:.04)*(.15+.85*on)-.06;
        const tone=base+(f.light-.5)*.5+f.spec*.5+f.fresnel*.25+f.flash*on*(small?.95:trait?.2:.5)+near*(.3+.5*on);
        const inward=kind==='kite'?.4:1.2,outward=kind==='kite'?1.2:.45;
        if(tone>0)polish(f,pal.rimLight,Math.min(.88,tone*crownLight),inward,outward);
        else polish(f,pal.rimShade,Math.min(.36,-tone*crownShade),outward,inward);
        if(trait)gauge(f,pal,colour);
        else{
          // The small faces hold their trait's colour in proportion to their own facet score.
          const tint=(small?.26:.07)*on+(f.flash*.3+near*.3)*on+(f.node?.34*f.node.lit+.3*f.node.flare:0);
          if(tint>.012){ctx.fillStyle=f.tint+Math.min(.78,tint*colour).toFixed(3)+')';ctx.fill();}
        }
        // Dispersion: a touch of spectrum at the edge of a flash, and a faint prism in the light wave.
        const spectrum=small?f.fire*.5*(.2+.8*on)+near*(.16+.26*on):0;
        if(spectrum>.04){ctx.fillStyle=FIRE[near>.3?f.band:f.hue]+Math.min(.5,spectrum*fire).toFixed(3)+')';ctx.fill();}
        // Polished edges: a hairline that brightens with the facet, not a drawn outline.
        ctx.strokeStyle=pal.facetEdge+(pal.edgeAlpha*(.5+.9*f.flash*on+.6*near)).toFixed(3)+')';ctx.stroke();
        // The brightest small facets throw a glint; strong scores do it far more often.
        const glow=(f.flash*on+near*.5*on+(f.node?f.node.flare*.6:0))*(small?1:.6)+f.spec*.3;
        if(glow>.6&&sparks.length<21)sparks.push(f.cx,f.cy,glow);
      }
    }
    function project(n,yaw,pitch,t){
      const fx=n.x+Math.sin(t*.5+n.phase)*.011,fy=n.y+Math.cos(t*.43+n.phase*1.7)*.011;
      const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
      const x1=fx*cy+n.z*sy,z1=-fx*sy+n.z*cy,y1=fy*cp-z1*sp,z2=fy*sp+z1*cp,k=1/(1-z2*.3);
      n.px=CX+x1*R*k;n.py=CY+y1*R*k;n.pz=z2;n.pk=k;
    }
    function control(link){
      const mx=(link.a.px+link.b.px)/2,my=(link.a.py+link.b.py)/2;
      const dx=link.b.px-link.a.px,dy=link.b.py-link.a.py;
      const pull=link.kind==='bond'?.24:.06;
      link.cx=mx+(CX-mx)*pull-dy*link.bend*.3;link.cy=my+(CY-my)*pull+dx*link.bend*.3;
    }
    const along=(link,u,dir)=>{
      const t=dir>0?u:1-u,i=1-t;
      return [i*i*link.a.px+2*i*t*link.cx+t*t*link.b.px,i*i*link.a.py+2*i*t*link.cy+t*t*link.b.py];
    };
    const ignite=n=>n.kind==='core'?ease(revealAt*1.4):ease((revealAt-.18-n.seq*.017)*2.6);

    function emit(link,from,energy,hop,delay){
      if(pulses.length>44)return;
      pulses.push({link,dir:from===link.a?1:-1,u:-(delay||0),speed:.5+.55*energy,energy,hop:hop||0});
    }
    function wave(origin){
      const near=m.neighbors.get(origin.id)||[];
      near.forEach((n,i)=>emit(n.link,origin,.95,1,i*.045));
      origin.flare=1;
    }
    function arrive(pulse){
      const target=pulse.dir>0?pulse.link.b:pulse.link.a,source=pulse.dir>0?pulse.link.a:pulse.link.b;
      target.flare=Math.max(target.flare,pulse.energy);
      if(pulse.hop!==1||!focus)return;
      // Second ring of the chain reaction: the strongest onward fibres only, at half energy.
      (m.neighbors.get(target.id)||[]).filter(n=>n.node!==source&&n.node!==focus)
        .sort((a,b)=>b.link.activity-a.link.activity).slice(0,2)
        .forEach((n,i)=>emit(n.link,target,.5,2,i*.06));
    }

    function draw(){
      if(!size)return;
      const pal=palette(),t=clock,scale=size*dpr/VIEW;
      const appear=ease(revealAt*1.25),breathe=1+Math.sin(t*.8)*.006;
      // Opening tilt: the stone arrives turned, showing its depth, and settles to face the reader.
      const settle=1-ease(revealAt*.72);
      const yaw=Math.max(-TURN,Math.min(TURN,Math.sin(t*.33)*.11+tiltX*.26-settle*.5));
      const pitch=Math.max(-NOD,Math.min(NOD,Math.sin(t*.26+1.1)*.075+tiltY*.2+settle*.32));
      // Light wave: a band of light that crosses the crown, facet by facet.
      const sweepU=sweepFrom<0?2:(t-sweepFrom)/1.5,sweep=sweepU>1?null:-1.5+3*sweepU;
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.setTransform(scale,0,0,scale,0,0);
      ctx.translate(CX,CY);ctx.scale((.955+.045*appear)*zoom,(.955+.045*appear)*zoom);ctx.translate(-CX,-CY);
      ctx.globalAlpha=appear;
      const radius=R*breathe,lightX=-yaw*46,lightY=-pitch*46;
      projectQuartz(quartz,yaw,pitch,radius);

      // Contact shadow and a faint aura: the object rests on the card instead of floating on it.
      const ground=Math.min(R*.96,reach*.8);
      ctx.save();ctx.translate(CX+yaw*10,CY+ground*1.02);ctx.scale(1,.2);
      let g=ctx.createRadialGradient(0,0,0,0,0,ground);
      g.addColorStop(0,pal.shadow+'.26)');g.addColorStop(.55,pal.shadow+'.1)');g.addColorStop(1,pal.shadow+'0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,ground,0,TAU);ctx.fill();ctx.restore();
      g=ctx.createRadialGradient(CX,CY,R*.7,CX,CY,Math.min(R*1.28,(VIEW/2-2)/zoom));
      g.addColorStop(0,pal.aura+'.2)');g.addColorStop(1,pal.aura+'0)');
      ctx.fillStyle=g;ctx.fillRect(0,0,VIEW,VIEW);

      // Glass body.
      glassPath(quartz.hull,1.6);
      g=ctx.createRadialGradient(CX-R*.34+lightX,CY-R*.44+lightY,R*.04,CX,CY,R*1.16);
      for(const [stop,color] of pal.body)g.addColorStop(stop,color);
      ctx.fillStyle=g;ctx.fill();

      ctx.save();
      glassPath(quartz.hull,1.6);ctx.clip();
      // Volume: the side away from the light is a little deeper.
      g=ctx.createRadialGradient(CX+R*.5-lightX,CY+R*.62-lightY,R*.1,CX+R*.2,CY+R*.25,R*1.25);
      g.addColorStop(0,pal.shade+'.2)');g.addColorStop(.6,pal.shade+'.05)');g.addColorStop(1,pal.shade+'0)');
      ctx.fillStyle=g;ctx.fillRect(0,0,VIEW,VIEW);

      // Back surfaces sit behind the untouched neural volume; front surfaces follow it below.
      sparks.length=0;
      gemFaces(pal,false,null);
      // Two echoes of the table between the culet and the nodes: layers that part when the stone turns.
      echo.forEach((loop,i)=>{
        for(const p of loop)project(p,yaw,pitch,0);
        glassPath(loop,0);
        ctx.fillStyle=(i?pal.coreWarm:pal.frost)+((i?.07+.12*m.mean:.13)*pal.glowAlpha).toFixed(3)+')';ctx.fill();
        ctx.lineWidth=.5;ctx.strokeStyle=pal.facetEdge+(pal.edgeAlpha*.55).toFixed(3)+')';ctx.stroke();
      });

      for(const n of all)project(n,yaw,pitch,t);
      for(const link of m.links)control(link);

      // Warm core: its reach follows the mean of the five domains, its form their balance.
      const core=m.core,warm=.5+.5*m.mean,coreR=R*(.17+.07*m.mean)*(1+Math.sin(t*1.05)*.035+core.flare*.08)*ignite(core);
      g=ctx.createRadialGradient(core.px,core.py,0,core.px,core.py,R*(.5+.3*m.mean));
      g.addColorStop(0,pal.coreWarm+(.5*warm+.14*core.flare).toFixed(3)+')');
      g.addColorStop(.42,pal.coreRose+(.17*warm).toFixed(3)+')');g.addColorStop(1,pal.coreRose+'0)');
      ctx.fillStyle=g;ctx.fillRect(0,0,VIEW,VIEW);

      // Fibres.
      ctx.lineCap='round';
      for(const link of m.links){
        const on=Math.min(link.a.lit,link.b.lit),dim=Math.min(link.a.dim,link.b.dim);
        const show=Math.min(ignite(link.a),ignite(link.b));
        const alpha=(.07+.26*link.activity)*dim*(link.kind==='bond'?.85:1)+on*.42;
        if(alpha*show<.01)continue;
        ctx.beginPath();ctx.moveTo(link.a.px,link.a.py);ctx.quadraticCurveTo(link.cx,link.cy,link.b.px,link.b.py);
        ctx.strokeStyle=(on>.05?pal.fibreLit:pal.fibre)+Math.min(.8,alpha*show).toFixed(3)+')';
        ctx.lineWidth=.55+.85*link.activity+on*.5;ctx.stroke();
      }

      // Core body, above its fibres.
      ctx.save();ctx.translate(core.px-CX,core.py-CY);
      blob(corePoints,coreR,0,0);
      g=ctx.createRadialGradient(CX-coreR*.25,CY-coreR*.3,0,CX,CY,coreR*1.05);
      g.addColorStop(0,pal.coreHot+'1)');g.addColorStop(.5,pal.coreWarm+'.95)');g.addColorStop(1,pal.coreRose+'.0)');
      ctx.fillStyle=g;ctx.fill();ctx.restore();

      // Nodes, far to near.
      const order=m.nodes.slice().sort((a,b)=>a.pz-b.pz);
      for(const n of order){
        const show=ignite(n);if(show<=.01)continue;
        const s=n.strength,depth=clamp01(n.pz+.5),hub=n.kind==='trait';
        const live=1+Math.sin(t*(.7+s*.9)+n.phase)*.07*s;
        const rad=(hub?2.9+2.4*s:1.5+3*s)*(.78+.42*depth)*n.pk*(1+.4*n.flare+.18*n.lit)*show;
        const glow=rad*(2.7+2.3*s+1.9*n.flare+.8*n.lit)*live;
        const fade=n.dim*(.5+.5*depth)*show;
        ctx.globalAlpha=appear*Math.min(1,(.2+.62*s+.55*n.flare+.3*n.lit)*fade*pal.glowAlpha);
        ctx.drawImage(glowSprite(n.tint),n.px-glow,n.py-glow,glow*2,glow*2);
        ctx.globalAlpha=appear*Math.min(1,(.42+.58*s+.3*n.lit)*fade);
        ctx.fillStyle=n.tint;ctx.beginPath();ctx.arc(n.px,n.py,rad,0,TAU);ctx.fill();
        ctx.fillStyle=pal.bead+Math.min(1,.5+.5*s+.4*n.flare).toFixed(3)+')';
        ctx.beginPath();ctx.arc(n.px-rad*.12,n.py-rad*.14,rad*(.42+.2*s),0,TAU);ctx.fill();
      }
      ctx.globalAlpha=appear;

      // Pulses of light travelling the fibres.
      const pulseGlow=glowSprite(pal.pulse);
      for(const p of pulses){
        if(p.u<0)continue;
        const dim=Math.min(p.link.a.dim,p.link.b.dim),fadeIn=Math.min(1,p.u*8,(1-p.u)*8),pr=2.6+4.4*p.energy;
        for(let k=3;k>=0;k--){
          const u=p.u-k*.045;if(u<0)continue;
          const [x,y]=along(p.link,u,p.dir),r=pr*(1-k*.2);
          ctx.globalAlpha=appear*clamp01((.3+.7*p.energy)*fadeIn*(1-k*.27)*(p.hop?1:dim));
          ctx.drawImage(pulseGlow,x-r,y-r,r*2,r*2);
          if(!k){ctx.fillStyle=pal.pulseHot+'.95)';ctx.beginPath();ctx.arc(x,y,.55+.75*p.energy,0,TAU);ctx.fill();}
        }
      }
      ctx.globalAlpha=appear;

      // Frost: a milky veil that thickens toward the rim.
      g=ctx.createRadialGradient(CX,CY,R*.32,CX,CY,R*1.04);
      g.addColorStop(0,pal.frost+'0)');g.addColorStop(.68,pal.frost+'.05)');g.addColorStop(1,pal.frost+'.2)');
      ctx.fillStyle=g;ctx.fillRect(0,0,VIEW,VIEW);
      // Crown above the neural volume: clear facets that flash, and a soft reflection across the table.
      gemFaces(pal,true,sweep);
      glassPath(table.points,0);
      const sheen=CX+lightX*1.6+(sweep===null?0:sweep*R*.5),glare=Math.min(.5,.13+.5*table.spec+(sweep===null?0:.16*(1-Math.abs(sweep)/1.5)));
      g=ctx.createLinearGradient(sheen-R*.62,CY-R*.7+lightY*1.6,sheen+R*.5,CY+R*.56+lightY*1.6);
      g.addColorStop(0,pal.rimLight+'0)');g.addColorStop(.3,pal.rimLight+glare.toFixed(3)+')');
      g.addColorStop(.46,pal.rimLight+(glare*.2).toFixed(3)+')');g.addColorStop(1,pal.rimLight+'0)');
      ctx.fillStyle=g;ctx.fill();
      ctx.restore();

      // Glints sit above the stone and may cross its edge.
      const star=glintSprite(),halo=glowSprite(pal.pulse);
      for(let i=0;i<sparks.length;i+=3){
        const power=sparks[i+2],reach=9+17*Math.min(1.4,power),x=sparks[i],y=sparks[i+1];
        ctx.globalAlpha=appear*Math.min(1,(power-.6)*2.6)*pal.spark;
        ctx.drawImage(halo,x-reach*.7,y-reach*.7,reach*1.4,reach*1.4);
        ctx.drawImage(star,x-reach,y-reach,reach*2,reach*2);
      }

      if(labelled){
        ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=ease((revealAt-.4)*1.6);
        ctx.drawImage(labelRing(pal),0,0);
      }
      ctx.globalAlpha=1;
      if(focus)placeTip();
    }

    function step(dt){
      clock+=dt;
      if(revealAt<2)revealAt+=dt/1.5;
      tiltX+=(aimX-tiltX)*Math.min(1,dt*3.2);tiltY+=(aimY-tiltY)*Math.min(1,dt*3.2);
      const lit=focus?new Set([focus.id,...(m.neighbors.get(focus.id)||[]).map(n=>n.node.id)]):null;
      for(const n of all){
        const wantLit=lit&&lit.has(n.id)?1:0,wantDim=lit&&!wantLit?.42:1,rate=Math.min(1,dt*7);
        n.lit+=(wantLit-n.lit)*rate;n.dim+=(wantDim-n.dim)*rate;
        n.flare=Math.max(0,n.flare-dt*1.5);
      }
      if(revealAt>.9){
        for(const link of m.links){
          if(Math.random()<pulseRate(link)*dt){
            const strong=link.a.strength>=link.b.strength?link.a:link.b,other=strong===link.a?link.b:link.a;
            emit(link,Math.random()<.78?strong:other,.3+.7*Math.sqrt(link.activity),0,0);
          }
        }
        if(focus&&clock>=waveAt){wave(focus);waveAt=clock+1.7;}
      }
      if(revealAt>.8&&clock>=sweepNext){sweepFrom=clock;sweepNext=clock+7.2;}
      for(const p of pulses){
        p.u+=p.speed*dt;
        if(p.u>=1&&!p.done){p.done=true;arrive(p);}
      }
      pulses=pulses.filter(p=>!p.done);
    }
    function frame(now){
      raf=0;
      if(!alive)return;
      if(!el.isConnected){destroy();return;}
      const dt=Math.min(.05,last?(now-last)/1000:.016);last=now;
      step(dt);draw();
      schedule();
    }
    function schedule(){
      if(raf||!alive||reduced()||!inView||document.hidden)return;
      raf=root.requestAnimationFrame(frame);
    }
    // Without animation the picture is still complete: one frame, redrawn when the selection changes.
    function still(){
      if(!alive)return;
      if(!reduced()){schedule();return;}
      revealAt=2;tiltX=tiltY=0;pulses=[];sweepFrom=-1;
      const lit=focus?new Set([focus.id,...(m.neighbors.get(focus.id)||[]).map(n=>n.node.id)]):null;
      for(const n of all){n.lit=lit&&lit.has(n.id)?1:0;n.dim=lit&&!n.lit?.42:1;n.flare=0;}
      draw();
    }
    function resize(){
      const next=Math.round(el.clientWidth);
      if(!next)return;
      const ratio=Math.min(2,root.devicePixelRatio||1);
      if(next===size&&ratio===dpr)return;
      size=next;dpr=ratio;
      canvas.width=canvas.height=Math.round(size*dpr);
      // Below this width the letters would be too small to read; the key under the summary names the traits.
      labelled=size>=LABEL_MIN;
      fontUnits=(size<210?9.5:size<250?10.5:11.5)*VIEW/size;
      // The stone is set as large as its frame allows, whatever its own reach.
      zoom=Math.min(1.15,(VIEW/2-(labelled?8+fontUnits:8))/reach);
      family=root.getComputedStyle?root.getComputedStyle(el).fontFamily||family:family;
      placeButtons();
      if(reduced()||!raf)draw();
      schedule();
    }

    function hit(event){
      const box=canvas.getBoundingClientRect();
      if(!box.width)return null;
      const sx=(event.clientX-box.left)/box.width*VIEW,sy=(event.clientY-box.top)/box.height*VIEW;
      const x=CX+(sx-CX)/zoom,y=CY+(sy-CY)/zoom;
      // A label stands for its trait: pointing at it selects that trait.
      if(labelled&&Math.hypot(sx-CX,sy-CY)>VIEW/2-6-fontUnits){
        const a=Math.atan2(sy-CY,sx-CX),off=t=>Math.abs(Math.atan2(Math.sin(a-t.angle),Math.cos(a-t.angle)));
        const trait=m.traits.reduce((p,q)=>off(q)<off(p)?q:p);
        return off(trait)<.48?trait:null;
      }
      const reach=(event.pointerType==='touch'?20:13)*Math.max(1,180/box.width);
      let best=null,bestDistance=reach;
      for(const n of m.nodes){
        const d=Math.hypot(n.px-x,n.py-y)-(n.kind==='trait'?2:0);
        if(d<bestDistance){best=n;bestDistance=d;}
      }
      return best;
    }
    function setFocus(node,source){
      if(node===focus)return;
      focus=node;focusSource=node?source:null;waveAt=clock;
      el.classList.toggle('is-active',Boolean(node));
      if(node){
        const parent=node.kind==='facet'?m.byId.get(node.parent):null;
        tipKicker.textContent=parent?parent.label:'תכונה ראשית · 6 תחומי משנה';
        tipTitle.textContent=node.label;
        tipMetric.textContent=metricLine(node,m.mode)||'ללא ציון';
        tipFill.style.width=Math.round(node.strength*100)+'%';
        tip.style.setProperty('--lens-tint',node.tint);
        const relation=relationLine(node,m);
        tipRelation.textContent=relation;tipRelation.hidden=!relation;
        tip.classList.add('is-open');
        placeTip();
      }else{
        tip.classList.remove('is-open');armed=null;
      }
      still();
    }
    function placeTip(){
      if(!focus||!size)return;
      const box=el.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;
      const card=el.closest('#resultsProfileSummary');
      const bounds=card?card.getBoundingClientRect():{left:0,right:root.innerWidth,top:0,bottom:root.innerHeight};
      const left=Math.max(bounds.left,0)+8,right=Math.min(bounds.right,root.innerWidth)-8,top=Math.max(bounds.top,0)+8;
      const nx=(CX+(focus.px-CX)*zoom)/VIEW*box.width,ny=(CY+(focus.py-CY)*zoom)/VIEW*box.height;
      let x=nx-w/2,y=ny-h-14;
      if(box.top+y<top)y=ny+16;
      x=Math.min(Math.max(x,left-box.left),Math.max(left-box.left,right-box.left-w));
      tip.style.transform='translate('+Math.round(x)+'px,'+Math.round(y)+'px)';
    }

    const onMove=event=>{
      pointerType=event.pointerType||'mouse';
      const box=canvas.getBoundingClientRect();
      if(box.width&&pointerType!=='touch'){
        aimX=Math.max(-1,Math.min(1,(event.clientX-(box.left+box.width/2))/Math.max(box.width,260)));
        aimY=Math.max(-1,Math.min(1,(event.clientY-(box.top+box.height/2))/Math.max(box.height,260)));
      }
      if(pointerType==='touch'||focusSource==='key')return;
      const inside=event.clientX>=box.left&&event.clientX<=box.right&&event.clientY>=box.top&&event.clientY<=box.bottom;
      const node=inside?hit(event):null;
      el.style.cursor=node?'pointer':'';
      setFocus(node,'pointer');
    };
    const onLeave=()=>{aimX=aimY=0;if(focusSource==='pointer'&&pointerType!=='touch')setFocus(null);};
    const onClick=event=>{
      if(event.target.closest&&event.target.closest('.ofi-lens__trait'))return;
      const node=hit(event);
      if(!node){setFocus(null);return;}
      // Touch has no hover: the first tap shows the details, the second opens the trait.
      if(pointerType==='touch'&&armed!==node){armed=node;focus=null;setFocus(node,'pointer');return;}
      open(node.key);
    };
    const onDown=event=>{pointerType=event.pointerType||'mouse';};
    const onOutside=event=>{if(focusSource==='pointer'&&pointerType==='touch'&&!el.contains(event.target))setFocus(null);};
    const stage=opts.stage||el;
    stage.addEventListener('pointermove',onMove,{passive:true});
    stage.addEventListener('pointerleave',onLeave,{passive:true});
    el.addEventListener('pointerdown',onDown,{passive:true});
    el.addEventListener('click',onClick);
    document.addEventListener('pointerdown',onOutside,{passive:true});
    const onVisible=()=>{last=0;schedule();};
    document.addEventListener('visibilitychange',onVisible);
    const observers=[];
    if(root.ResizeObserver){const o=new ResizeObserver(resize);o.observe(el);observers.push(o);}
    else root.addEventListener('resize',resize);
    if(root.IntersectionObserver){
      const o=new IntersectionObserver(entries=>{inView=entries[entries.length-1].isIntersecting;last=0;schedule();});
      o.observe(el);observers.push(o);
    }
    if(root.MutationObserver){
      const o=new MutationObserver(()=>{if(reduced()||!raf)draw();});
      o.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});observers.push(o);
    }
    const motion=root.matchMedia?root.matchMedia('(prefers-reduced-motion: reduce)'):null;
    const onMotion=()=>{last=0;still();};
    motion?.addEventListener?.('change',onMotion);

    function destroy(){
      if(!alive)return;
      alive=false;
      if(raf)root.cancelAnimationFrame(raf);
      observers.forEach(o=>o.disconnect());
      stage.removeEventListener('pointermove',onMove);stage.removeEventListener('pointerleave',onLeave);
      document.removeEventListener('pointerdown',onOutside);document.removeEventListener('visibilitychange',onVisible);
      root.removeEventListener('resize',resize);
      motion?.removeEventListener?.('change',onMotion);
    }
    function reveal(){if(reduced())return;revealAt=0;sweepFrom=-1;sweepNext=0;last=0;schedule();}
    // The caller attaches the element right after this returns; a microtask (unlike an animation
    // frame) also runs in a background tab, so the first frame is there when the tab is shown.
    Promise.resolve().then(()=>{resize();still();});
    // A web font that arrives later changes the letter widths: set the labels again.
    document.fonts?.ready?.then(()=>{if(!alive)return;ringKey='';if(reduced()||!raf)draw();});
    return {el,model:m,destroy,reveal};
  }

  root.OfiLens=Object.freeze({model,mount,pulseRate});
})(typeof window!=='undefined'?window:globalThis);

