/* ofiLab Calm V2 — data-bound vector components. Local-only; no telemetry or scoring changes. */
(function(root){
  'use strict';
  const NS='http://www.w3.org/2000/svg',ORDER=['N','E','O','A','C'];
  const TRAITS={
    N:{label:'רגישות רגשית',css:'--trait-emotional'},
    E:{label:'מוחצנות',css:'--trait-extraversion'},
    O:{label:'פתיחות',css:'--trait-openness'},
    A:{label:'נועם הליכות',css:'--trait-agreeableness'},
    C:{label:'מצפוניות',css:'--trait-conscientiousness'}
  };
  const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number.isFinite(Number(n))?Number(n):min));
  const svgEl=(tag,attrs={},content)=>{
    const el=document.createElementNS(NS,tag);
    for(const [key,value] of Object.entries(attrs))if(value!==undefined&&value!==null)el.setAttribute(key,String(value));
    if(content!==undefined)el.textContent=String(content);
    return el;
  };
  const htmlEl=(tag,cls,content)=>{
    const el=document.createElement(tag);if(cls)el.className=cls;
    if(content!==undefined)el.textContent=String(content);
    return el;
  };
  const colorFor=key=>'var('+TRAITS[key].css+')';
  const SHARD_COLORS=['#9873BD','#B393DA','#E5AE75','#8F6EB3','#BFA0D8'];

  // Compact two-dimensional map. The ring never changes size: only the five
  // trait vertices and the thirty facet dots move with the reported metrics.
  // Shared by IPIP-NEO-120 and IPIP-NEO-300; no new scoring or storage.
  function personalityMapModel(domains,mode='percentile'){
    const measure=entry=>{
      const percentile=entry?.percentileExact??entry?.percentile;
      const rank=percentile!==null&&percentile!==undefined&&percentile!==''?Number(percentile):NaN;
      const score=entry?.score!==null&&entry?.score!==undefined&&entry?.score!==''?Number(entry.score):NaN;
      return clamp(mode==='percentile'&&Number.isFinite(rank)?rank:Number.isFinite(score)?score:50);
    };
    return ORDER.map((key,index)=>{
      const entry=domains?.[key]||{},angle=-Math.PI/2+index*Math.PI*2/5;
      const score=measure(entry),facets=Array.isArray(entry.facets)?entry.facets.slice(0,6):[];
      return {key,index,angle,score,rawScore:entry.score,facets:facets.map((facet,j)=>({
        key:key+(j+1),label:facet?.label||TRAITS[key].label+' '+(j+1),
        angle:angle+(j-2.5)*.086,score:measure(facet)
      }))};
    });
  }

  // A deliberately tiny editorial radar: scores live in the inner pentagon;
  // the 30 facet readings become a separate, evenly spaced outer constellation.
  // Personality Strips: five deliberate, readable measurements at 104–138px.
  // Domains are the five filled tracks; six independent facet values appear
  // as a fixed-position micro heat strip below each track (no overlapping dots).
  // This is an alternate view of the existing Big Five profile, not a new score.
  // OfiOrbit — compact profile signature (not a precision-reading graph).
  // Five equal angular sectors show the five domain magnitudes. Thirty tiny
  // inner segments encode the six facets per domain with calm luminance.
  // Exact values remain in the already-existing adjacent result cards.
  // OfiOrbit — polished five-domain signature in the *existing* 104–138px
  // mobile slot. Exact values live in the adjacent cards; this is a glanceable
  // personal mark, with five equal sectors and six facet ticks per sector.
  // Angular half-width of a 6.2-wide round cap on the r=42 score ring (deg).
  const CAP=3.1/42*180/Math.PI;
  function personalityMiniMap(domains,opts={}){
    const segments=personalityMapModel(domains,opts.mode);
    const el=htmlEl('div','ofi-glyph ofi-personality-map');
    el.style.cssText='position:relative;display:block;width:100%;aspect-ratio:1;touch-action:manipulation';
    const svg=svgEl('svg',{
      class:'ofi-personality-map__svg',viewBox:'0 0 120 120',role:'group',
      style:'display:block;width:100%;height:100%;overflow:visible',
      'aria-label':'מפת האישיות שלך: חמש תכונות ושלושים תחומי משנה'
    });
    svg.append(svgEl('title',{},'מפת האישיות שלך'));
    const rad=degrees=>degrees*Math.PI/180;
    const point=(r,degrees)=>[60+Math.cos(rad(degrees))*r,60+Math.sin(rad(degrees))*r];
    const arc=(r,from,to)=>{
      const a=point(r,from),b=point(r,to);
      return 'M '+a.map(x=>x.toFixed(2)).join(' ')+
        ' A '+r+' '+r+' 0 '+(to-from>180?1:0)+' 1 '+b.map(x=>x.toFixed(2)).join(' ');
    };
    // Center. At rest it reads "05 / BIG FIVE"; while a domain is
    // hovered or focused it shows that domain's number and name in its color.
    const centerValue=svgEl('text',{x:60,y:65,'text-anchor':'middle','font-size':'25',
      'font-weight':'700','letter-spacing':'-.9',direction:'ltr',class:'ofi-personality-map__center-value',
      style:'pointer-events:none;font-variant-numeric:tabular-nums',fill:'var(--calm-ink,#30263B)'},'05');
    const centerLabel=svgEl('text',{x:60,y:75.2,'text-anchor':'middle',
      'font-size':'6.7','font-weight':'700','letter-spacing':'.65',
      direction:'ltr',class:'ofi-personality-map__center-label',style:'pointer-events:none',
      fill:'var(--calm-muted,#6F6379)'},'BIG FIVE');
    // Second label line: long facet names wrap onto two short lines.
    const centerLabel2=svgEl('text',{x:60,y:80.6,'text-anchor':'middle','font-size':'5.6',
      'font-weight':'700',direction:'rtl',class:'ofi-personality-map__center-label2',
      style:'pointer-events:none',fill:'var(--calm-muted,#6F6379)'},'');
    const groups=[];
    // What the centre shows. Mouse hover wins, then a pinned tap (touch),
    // then keyboard focus. An item is {key} for a domain, {key,j} for a facet.
    let hovered=null,pinned=null,focusedKey=null,lastPointer='mouse';
    const same=(a,b)=>Boolean(a&&b&&a.key===b.key&&a.j===b.j);
    const setLabel=(text,mode)=>{
      centerLabel.setAttribute('direction',mode==='rest'?'ltr':'rtl');
      centerLabel.setAttribute('letter-spacing',mode==='rest'?'.65':'0');
      centerLabel2.textContent='';
      centerLabel.textContent=text;
      centerLabel.setAttribute('font-size',mode==='facet'?'6':'6.7');
      centerLabel.setAttribute('y','75.2');
      // Wrap only when the name is wider than the centre disc allows.
      let wide=false;try{wide=centerLabel.getComputedTextLength()>41;}catch(_e){}
      if(mode==='facet'&&wide&&text.includes(' ')){
        // Break at the space closest to the middle.
        const mid=text.length/2;let cut=-1;
        for(let i=0;i<text.length;i++)if(text[i]===' '&&(cut<0||Math.abs(i-mid)<Math.abs(cut-mid)))cut=i;
        centerLabel.textContent=text.slice(0,cut);centerLabel2.textContent=text.slice(cut+1);
        centerLabel.setAttribute('font-size','5.6');centerLabel.setAttribute('y','74.4');
      }
    };
    const sync=()=>{
      const item=hovered||pinned||(focusedKey?{key:focusedKey}:null);
      const seg=item?segments.find(s=>s.key===item.key):null;
      const facet=seg&&item.j!==undefined?seg.facets[item.j]:null;
      el.toggleAttribute('data-map-active',!!seg);
      for(const g of groups){
        const mine=!!seg&&g.key===seg.key;
        g.el.toggleAttribute('data-map-dimmed',!!seg&&!mine);
        g.el.toggleAttribute('data-map-facet-mode',mine&&!!facet);
        g.focusPath.setAttribute('stroke-opacity',mine?'1':'0');
        g.ticks.forEach((t,j)=>t.toggleAttribute('data-map-facet-active',mine&&!!facet&&j===item.j));
      }
      const shown=facet||seg;
      centerValue.textContent=shown?String(Math.round(shown.score)):'05';
      centerValue.setAttribute('fill',seg?colorFor(seg.key):'var(--calm-ink,#30263B)');
      setLabel(facet?facet.label:seg?TRAITS[seg.key].label:'BIG FIVE',facet?'facet':seg?'domain':'rest');
    };
    // A tap outside the map releases a pinned (touch) selection.
    const outside=event=>{
      if(!el.isConnected){document.removeEventListener('pointerdown',outside,true);return;}
      if(pinned&&!el.contains(event.target)){pinned=null;sync();}
    };
    document.addEventListener('pointerdown',outside,true);
    for(const seg of segments){
      // Use the same validated five-color palette as the report's domain cards.
      // CSS variables provide the correct light/dark hue without added CSS.
      const color=colorFor(seg.key),mid=-90+seg.index*72;
      const start=mid-28.2,end=mid+28.2;
      const group=svgEl('g',{'data-map-trait':seg.key,tabindex:'0',role:'button',
        style:'cursor:pointer;outline:none;--map-i:'+seg.index,
        'aria-label':TRAITS[seg.key].label+' — '+Math.round(seg.score)+
          (opts.mode==='percentile'?' אחוזון':' ציון')+'. לפתיחת פירוט'
      });
      // Exact lengths: a round cap adds half the band width beyond each end,
      // so the path is inset by that cap angle (CAP) at both ends. The drawn
      // shape then covers exactly [start, start + length], for the track and
      // for every score, with the same rounded ends everywhere.
      group.append(svgEl('path',{d:arc(42,start+CAP,end-CAP),fill:'none',
        stroke:'var(--bg-track,#E4DCEA)','stroke-width':'6.2',
        'stroke-linecap':'round','data-map-track':seg.key}));
      const len=56.4*seg.score/100;
      if(len>=2*CAP){
        // pathLength=100 lets CSS draw the arc in from 0 on first paint.
        group.append(svgEl('path',{d:arc(42,start+CAP,start+len-CAP),
          class:'ofi-personality-map__value',fill:'none',stroke:color,
          'stroke-opacity':'.88','stroke-width':'6.2',pathLength:'100',
          'stroke-linecap':'round','data-map-value':seg.score}));
      }else if(len>0){
        // Shorter than the band is wide: a round dot whose diameter equals
        // the true arc length, placed at the start of the sector.
        const [cx,cy]=point(42,start+len/2);
        group.append(svgEl('circle',{cx,cy,r:(42*len*Math.PI/360).toFixed(3),fill:color,
          'fill-opacity':'.88','data-map-value':seg.score,'aria-hidden':'true'}));
      }
      const ticks=[],facetHits=[];
      for(let j=0;j<seg.facets.length;j++){
        const facet=seg.facets[j];
        // Butt caps + a 1.8° gap keep the six ticks visibly separate; round
        // caps used to overlap neighbours and draw dark "beads" at the joins.
        // --f (0..1) lets CSS raise the opacity floor in dark mode.
        const from=start+j*9.4+.9,to=start+(j+1)*9.4-.9;
        const tick=svgEl('path',{d:arc(32,from,to),fill:'none',
          stroke:color,'stroke-width':'3','stroke-linecap':'butt',
          'stroke-opacity':(.28+.0065*facet.score).toFixed(3),
          style:'--f:'+(facet.score/100).toFixed(3),
          'data-map-facet':facet.key,'data-map-facet-value':facet.score});
        tick.append(svgEl('title',{},facet.label+': '+Math.round(facet.score)));
        group.append(tick);ticks.push(tick);
        // Each facet gets its own target above the domain's, so pointing at a
        // tick shows that facet; anywhere else in the sector shows the domain.
        facetHits.push(svgEl('path',{d:arc(32,from-.9,to+.9),fill:'none',stroke:'transparent',
          'stroke-width':'10','pointer-events':'stroke','data-map-facet-hit':String(j)}));
      }
      const focusPath=svgEl('path',{d:arc(52,start,end),fill:'none',
        stroke:color,'stroke-width':'1.25',
        'stroke-opacity':'0','pointer-events':'none'});
      group.append(focusPath);
      group.append(svgEl('path',{d:arc(42,start-1,end+1),fill:'none',
        stroke:'transparent','stroke-width':'27',
        'data-map-hit':seg.key,'pointer-events':'stroke'}));
      group.append(...facetHits);
      group.append(svgEl('title',{},TRAITS[seg.key].label+' · '+Math.round(seg.score)));
      groups.push({key:seg.key,el:group,focusPath,ticks});
      group.addEventListener('focus',()=>{focusedKey=seg.key;sync();});
      group.addEventListener('blur',()=>{if(focusedKey===seg.key)focusedKey=null;sync();});
      // Mouse/pen hover previews; touch has no hover, so it uses tap-to-pin.
      group.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch'){hovered={key:seg.key};sync();}});
      group.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch'&&hovered?.key===seg.key){hovered=null;sync();}});
      facetHits.forEach((hit,j)=>{
        hit.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch'){hovered={key:seg.key,j};sync();}});
        hit.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch'&&same(hovered,{key:seg.key,j})){hovered={key:seg.key};sync();}});
      });
      group.addEventListener('pointerdown',e=>{lastPointer=e.pointerType||'mouse';});
      group.addEventListener('click',event=>{
        const hit=event.target.closest?.('[data-map-facet-hit]');
        const item=hit?{key:seg.key,j:Number(hit.getAttribute('data-map-facet-hit'))}:{key:seg.key};
        // Touch: the first tap shows the value in the centre, a second tap on
        // the same domain or facet opens its details.
        if(lastPointer==='touch'&&!same(pinned,item)){pinned=item;sync();return;}
        pinned=null;sync();opts.onOpen?.(seg.key);
      });
      group.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){
          event.preventDefault();opts.onOpen?.(seg.key);return;
        }
        // Arrows walk the ring: Right/Down = clockwise, Left/Up = back.
        const step={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[event.key];
        if(step){event.preventDefault();groups[(seg.index+step+5)%5].el.focus();}
      });
      svg.append(group);
    }
    // A quiet hairline ring frames the centre.
    svg.append(svgEl('circle',{cx:60,cy:60,r:23.1,fill:'none',
      stroke:'var(--bg-track,#E4DCEA)','stroke-width':'.8',
      'stroke-opacity':'.65','pointer-events':'none'}));
    // The small dash above "05" marks the user's most prominent domain (the
    // highest score) in that domain's color. With no single highest domain
    // (a tie at the top) it stays the neutral brand amber.
    const topScore=Math.max(...segments.map(seg=>seg.score));
    const leaders=segments.filter(seg=>seg.score===topScore);
    const top=leaders.length===1?leaders[0]:null;
    svg.append(svgEl('rect',{x:56.4,y:40.6,width:7.2,height:2.7,rx:1.35,
      class:'ofi-personality-map__top','data-map-top':top?top.key:'',
      fill:top?colorFor(top.key):'var(--brand-accent,#BD834C)','pointer-events':'none'}));
    if(top)svg.setAttribute('aria-label',svg.getAttribute('aria-label')+
      '. התכונה הבולטת: '+TRAITS[top.key].label);
    svg.append(centerValue,centerLabel,centerLabel2);
    el.append(svg);
    return el;
  }

  let signatureSequence=0;
  const GEM_LIGHTS=[['#FCE6FA','#BD84B8','#59335E'],['#FFF0CE','#D69A6C','#74485B'],['#EFE4FF','#A789D6','#584075'],['#F5E8FF','#B68AC9','#60436F'],['#E6E9FF','#94A1D3','#414F7D']];
  // A single unified ten-vertex mineral silhouette: no five detached petals.
  const GEM_OUTLINE=[
    [160,12],[220,42],[274,108],[283,170],[250,240],
    [160,307],[70,240],[37,170],[46,108],[100,42]
  ];
  const point=(a,r,cx=160,cy=160)=>[cx+Math.cos(a)*r,cy+Math.sin(a)*r];
  const str=n=>Number(n).toFixed(2);
  const coords=p=>p.map(str).join(' ');
  const polygonPath=pts=>'M '+pts.map(coords).join(' L ')+' Z';
  const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
  function gemBoundary(angle,scale){
    const direction=[Math.cos(angle),Math.sin(angle)];
    const origin=[160,160];
    let distance=Infinity;
    for(let i=0;i<GEM_OUTLINE.length;i++){
      const a=GEM_OUTLINE[i],b=GEM_OUTLINE[(i+1)%GEM_OUTLINE.length];
      const segment=[b[0]-a[0],b[1]-a[1]],rel=[a[0]-origin[0],a[1]-origin[1]];
      const den=cross(direction,segment);
      if(Math.abs(den)<1e-8)continue;
      const t=cross(rel,segment)/den,u=cross(rel,direction)/den;
      if(t>0&&u>=-1e-8&&u<=1+1e-8)distance=Math.min(distance,t);
    }
    return point(angle,Number.isFinite(distance)?distance*scale:120);
  }
  // Five domains deform the silhouette; adjacent boundary vertices are shared.
  // Six facet scores per domain modulate the corresponding cut plane.
  function geometry(domains){
    const scores=ORDER.map(k=>clamp(domains?.[k]?.score??50));
    return ORDER.map((key,i)=>{
      const item=domains?.[key]||{};
      const score=scores[i],prior=scores[(i+4)%5],following=scores[(i+1)%5];
      const facets=Array.from({length:6},(_,j)=>clamp(item.facets?.[j]?.score??score));
      const angle=-Math.PI/2+i*Math.PI*2/5,half=Math.PI/5;
      const boundary=Array.from({length:7},(_,j)=>{
        const t=j/6;
        const linked=t<=.5
          ?(prior+score)/2+(score-(prior+score)/2)*t*2
          :score+((score+following)/2-score)*(t-.5)*2;
        return gemBoundary(angle-half+t*2*half,.76+.0024*linked);
      });
      const anchorRadius=35+score*.35;
      return {key,score,facets,angle,anchorRadius,boundary,
        d:polygonPath([[160,160],...boundary]),
        faces:facets.map((f,j)=>({
          d:polygonPath([point(angle+(j-2.5)*.029,anchorRadius+(f-50)*.21),
            boundary[j],boundary[j+1]]),
          opacity:(.35+f*.0045).toFixed(3)
        }))};
    });
  }
  function personalitySignature(domains,opts={}){
    const interactive=opts.interactive===true;
    const svg=svgEl('svg',{viewBox:'0 0 320 320',
      class:'ofi-glyph ofi-crystal'+(interactive?' is-interactive':''),
      'data-crystal':'amber-violet',role:interactive?'group':'img',
      'aria-label':opts.demo?'קריסטל אישיות לדוגמה':'קריסטל אישיות המבוסס על ציוני חמש התכונות ותחומי המשנה'});
    if(opts.animate)svg.classList.add('is-revealing');
    const unique='ofi-crystal-'+(++signatureSequence);
    const glowId=unique+'-heart',glassId=unique+'-glass',haloId=unique+'-halo';
    const defs=svgEl('defs');
    const radiance=svgEl('radialGradient',{id:glowId,cx:'42%',cy:'32%',r:'76%'});
    radiance.append(svgEl('stop',{offset:'0%','stop-color':'#FFF8E5'}));
    radiance.append(svgEl('stop',{offset:'38%','stop-color':'#FBE2A7'}));
    radiance.append(svgEl('stop',{offset:'80%','stop-color':'#E0A172'}));
    radiance.append(svgEl('stop',{offset:'100%','stop-color':'#99647D'}));
    defs.append(radiance);
    const glass=svgEl('linearGradient',{id:glassId,x1:'6%',y1:'0%',x2:'85%',y2:'100%'});
    glass.append(svgEl('stop',{offset:'0%','stop-color':'#F8EBFF'}));
    glass.append(svgEl('stop',{offset:'38%','stop-color':'#CFB4E0'}));
    glass.append(svgEl('stop',{offset:'78%','stop-color':'#8C71AD'}));
    glass.append(svgEl('stop',{offset:'100%','stop-color':'#5A486F'}));
    defs.append(glass);
    const halo=svgEl('radialGradient',{id:haloId,cx:'50%',cy:'50%',r:'50%'});
    halo.append(svgEl('stop',{offset:'0%','stop-color':'#F7C58B','stop-opacity':'.18'}));
    halo.append(svgEl('stop',{offset:'62%','stop-color':'#BD8FDC','stop-opacity':'.09'}));
    halo.append(svgEl('stop',{offset:'100%','stop-color':'#BD8FDC','stop-opacity':'0'}));
    defs.append(halo);
    const traitFills=GEM_LIGHTS.map((stops,i)=>{
      const id=unique+'-facet-'+i;
      const grad=svgEl('linearGradient',{id,x1:'10%',y1:'0%',x2:'85%',y2:'100%'});
      for(const [j,c] of stops.entries())grad.append(svgEl('stop',{offset:(j*50)+'%','stop-color':c}));
      defs.append(grad);return id;
    });
    svg.append(defs);
    svg.append(svgEl('title',{},opts.demo?'קריסטל לדוגמה':'קריסטל האישיות שלך'));
    if(!opts.demo)svg.append(svgEl('desc',{},ORDER.map(k=>TRAITS[k].label+': ציון '+Math.round(clamp(domains?.[k]?.score))).join('; ')+'. היקף הקריסטל מבטא ציוני חמש תכונות, ושלושים הפאות את ציוני תחומי המשנה.'));
    const geos=geometry(domains);
    const silhouette=polygonPath(geos.flatMap(g=>g.boundary.slice(0,6)));
    svg.append(svgEl('circle',{'data-crystal-halo':'true',cx:160,cy:160,r:156,fill:'url(#'+haloId+')'}));
    svg.append(svgEl('path',{'data-crystal-mass':'true',d:silhouette,fill:'url(#'+glassId+')'}));
    for(const [i,geo] of geos.entries()){
      const group=svgEl('g',{'data-glyph-trait':geo.key,'data-crystal-domain-score':geo.score,style:'color:'+SHARD_COLORS[i]});
      group.append(svgEl('path',{d:geo.d,fill:'url(#'+traitFills[i]+')','fill-opacity':'.32',
        stroke:'#FDF1FF','stroke-opacity':'.3','stroke-width':'.7'}));
      geo.faces.forEach((face,j)=>group.append(svgEl('path',{'data-crystal-face':j,
        'data-crystal-facet-score':geo.facets[j],style:'--crystal-seq:'+String(i*6+j),
        d:face.d,fill:'url(#'+traitFills[i]+')','fill-opacity':face.opacity,
        stroke:'#FFF0FF','stroke-opacity':'.34','stroke-width':'.85'})));
      group.append(svgEl('path',{'data-crystal-sheen':'true',d:polygonPath([
        point(geo.angle,geo.anchorRadius+9),geo.boundary[1],geo.boundary[2]
      ])}));
      if(interactive){
        group.setAttribute('role','button');group.setAttribute('tabindex','0');
        group.setAttribute('aria-label',TRAITS[geo.key].label+', ציון '+Math.round(geo.score)+'. מעבר לפירוט התכונה');
        const open=()=>{const card=document.getElementById('trait-'+geo.key);
          if(card){card.open=true;card.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'center'});}
        };
        group.addEventListener('click',open);
        group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
      }
      svg.append(group);
    }
    svg.append(svgEl('path',{'data-crystal-outline':'true',pathLength:1,d:silhouette,fill:'none',
      stroke:'var(--crystal-edge,#D5B5EB)','stroke-opacity':'.95','stroke-width':'1.7'}));
    const table=polygonPath(Array.from({length:10},(_,i)=>point(-Math.PI/2+i*Math.PI/5,43)));
    svg.append(svgEl('path',{'data-crystal-core':'true',d:table,
      fill:'url(#'+glowId+')',stroke:'var(--crystal-edge,#D5B5EB)','stroke-width':'1.75'}));
    svg.append(svgEl('path',{'data-crystal-core-shine':'true',
      d:polygonPath(Array.from({length:5},(_,i)=>point(-Math.PI/2+i*Math.PI*2/5,25))),
      fill:'#FFF4CB','fill-opacity':'.7',stroke:'#F9EACF','stroke-opacity':'.75','stroke-width':'.8'}));
    return svg;
  }
  function spectrumScale({value,ci=null,color='var(--brand-primary)',band='color-mix(in srgb,var(--brand-primary) 18%,transparent)',label='מדד'}){
    const val=clamp(value);const host=htmlEl('div','ofi-spectrum');
    host.setAttribute('role','img');host.setAttribute('aria-label',label+': '+val.toFixed(1)+' מתוך 100'+
      (validCi(ci)?'; רווח סמך '+clamp(ci[0]).toFixed(1)+' עד '+clamp(ci[1]).toFixed(1):''));
    host.style.setProperty('--scale-color',color);host.style.setProperty('--scale-band',band);
    host.append(htmlEl('span','ofi-spectrum__line'));
    if(validCi(ci)){
      const low=clamp(ci[0]),high=clamp(ci[1]);
      const el=htmlEl('span','ofi-spectrum__band');
      el.style.left=low+'%';el.style.width=Math.max(0,high-low)+'%';host.append(el);
    }
    const thumb=htmlEl('span','ofi-spectrum__thumb');thumb.style.left=val+'%';
    host.append(thumb);
    const ends=htmlEl('span','ofi-spectrum__ends');
    ends.append(htmlEl('span',null,'0'),htmlEl('span',null,'100'));host.append(ends);
    return host;
  }
  function validCi(ci){return Array.isArray(ci)&&ci.length===2&&ci.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100)&&ci[0]<=ci[1];}
  function distributionDataset(profile){
    const length=Number(profile?.empiricalReference?.percentileItems||profile?.empiricalReference?.answeredItems);
    return length===300?root.OfiEmpiricalData300:root.OfiEmpiricalData;
  }
  // Relative frequency of every attainable questionnaire score, at the table's
  // own resolution. No re-binning: uneven bins put a comb on the curve, and a
  // percentile axis flattens every sample by definition, leaving only that
  // artefact. The score axis is the only one on which the sample has a shape.
  function scoreDensity(counts){
    if(!counts||!counts.length)return [];
    const total=counts.reduce((s,n)=>s+n,0);
    if(!total)return [];
    return counts.map(n=>n/total);
  }
  // Piecewise monotone cubic interpolation: curves pass through the actual
  // empirical bin heights without Gaussian assumptions or overshoot spikes.
  function smoothDensityPath(points){
    if(!Array.isArray(points)||points.length===0)return '';
    if(points.length===1)return 'M '+coords(points[0]);
    const deltas=points.slice(1).map((p,i)=>(p[1]-points[i][1])/(p[0]-points[i][0]));
    const slopes=points.map((p,i)=>{
      if(i===0)return deltas[0];
      if(i===points.length-1)return deltas[deltas.length-1];
      const a=deltas[i-1],b=deltas[i];
      return a*b<=0?0:(2*a*b/(a+b));
    });
    const segments=['M '+coords(points[0])];
    for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1],dx=b[0]-a[0],one=dx/3;
      segments.push('C '+coords([a[0]+one,a[1]+slopes[i]*one])+
        ' '+coords([b[0]-one,b[1]-slopes[i+1]*one])+' '+coords(b));
    }
    return segments.join(' ');
  }
  function empiricalDistributionCard(profile,key,mode){
    const data=distributionDataset(profile);
    const hist=data?.scales?.[key];
    const entry=profile?.domains?.[key];
    if(!hist||!entry||!Array.isArray(hist.counts))return null;
    const row=(profile.normRows||[]).find(r=>r.key===key);
    const isPercentile=mode==='percentile'&&Boolean(profile.empiricalReference);
    // The headline follows the report's metric switch; the curve and the marker's
    // x never leave the questionnaire-score axis.
    const shown=isPercentile?entry.percentileExact??entry.percentile:entry.score;
    const score=clamp(entry.score);
    const shownCi=isPercentile?row?.percentileCi95:row?.ci95;
    const scoreCi=validCi(row?.ci95)?row.ci95:null;
    const card=htmlEl('article','ofi-dist-card');
    card.dataset.trait=key;card.dataset.metric=isPercentile?'percentile':'score';
    const head=htmlEl('div','ofi-dist-card__head');
    head.append(htmlEl('strong',null,entry.label||TRAITS[key].label),htmlEl('span','ofi-dist-card__value',String(Math.round(clamp(shown)))));
    card.append(head);
    card.append(htmlEl('p','ofi-dist-card__axis',isPercentile
      ?'אחוזון במדגם · השטח המודגש: חלק המדגם שמתחת לציון שלך'
      :'ציון שאלון (0–100)'));
    const dist=scoreDensity(hist.counts);
    if(dist.length<2)return null;
    const W=340,H=125,left=8,right=332,base=104,max=Math.max(...dist,1e-8);
    const xOf=value=>left+clamp(value)/100*(right-left);
    const curve=dist.map((y,i)=>[left+(i/(dist.length-1))*(right-left),base-y/max*78]);
    const path=smoothDensityPath(curve);
    const uid='ofi-dist-'+key+'-'+(isPercentile?'p':'s');
    const svg=svgEl('svg',{viewBox:'0 0 '+W+' '+H,role:'img',
      'aria-label':'התפלגות ציוני השאלון במדגם: '+TRAITS[key].label+'. הציון שלך '+Math.round(score)+' מתוך 100'+
        (isPercentile?', אחוזון '+Math.round(clamp(shown)):'')});
    const markerX=xOf(score);
    const defs=svgEl('defs');
    const gradient=svgEl('linearGradient',{id:uid+'-fill',x1:0,y1:0,x2:0,y2:1});
    gradient.append(svgEl('stop',{offset:'0%',stopColor:colorFor(key),'stop-opacity':'.2'}),svgEl('stop',{offset:'100%',stopColor:colorFor(key),'stop-opacity':'0'}));
    defs.append(gradient);
    if(isPercentile){
      // A percentile is a rank: the share of the sample scoring below you.
      const below=svgEl('clipPath',{id:uid+'-below'});
      below.append(svgEl('rect',{x:left,y:0,width:Math.max(0,markerX-left),height:base}));
      defs.append(below);
    }
    svg.append(defs);
    const fill=path+' L '+right+' '+base+' L '+left+' '+base+' Z';
    svg.append(svgEl('path',{d:fill,fill:'url(#'+uid+'-fill)'}));
    if(isPercentile)svg.append(svgEl('path',{'data-dist-below':'true',d:fill,fill:colorFor(key),'fill-opacity':'.3','clip-path':'url(#'+uid+'-below)'}));
    if(scoreCi){
      // Measurement uncertainty of the score itself, in the axis's own units.
      const x=xOf(scoreCi[0]),width=xOf(scoreCi[1])-x;
      svg.append(svgEl('rect',{'data-dist-ci':'true',x,y:12,width,height:base-12,rx:5,fill:colorFor(key),'fill-opacity':'.12'}));
    }
    svg.append(svgEl('path',{d:path,stroke:colorFor(key),'stroke-width':2.25,'stroke-linecap':'round','stroke-linejoin':'round',fill:'none'}));
    const at=score/100*(dist.length-1),lo=Math.floor(at),hi=Math.min(dist.length-1,lo+1);
    const markerY=curve[lo][1]+(curve[hi][1]-curve[lo][1])*(at-lo);
    svg.append(svgEl('line',{x1:markerX,x2:markerX,y1:markerY,y2:base,stroke:colorFor(key),'stroke-width':1.5,'stroke-dasharray':'3 3'}));
    svg.append(svgEl('circle',{'data-dist-marker':'true',cx:markerX,cy:markerY,r:5,fill:colorFor(key),stroke:'var(--bg-card)','stroke-width':2}));
    svg.append(svgEl('line',{x1:left,x2:right,y1:base,y2:base,stroke:'var(--text-muted)','stroke-opacity':'.35','stroke-width':1}));
    svg.append(svgEl('text',{x:left,y:119,'font-size':10,fill:'var(--text-muted)','text-anchor':'start'},'0'));
    svg.append(svgEl('text',{x:(left+right)/2,y:119,'font-size':10,fill:'var(--text-muted)','text-anchor':'middle'},'ציון שאלון'));
    svg.append(svgEl('text',{x:right,y:119,'font-size':10,fill:'var(--text-muted)','text-anchor':'end'},'100'));
    card.append(svg);
    const footer=htmlEl('div','ofi-dist-card__foot');
    footer.append(htmlEl('span','ofi-stat','N='+Number(profile.empiricalReference.n).toLocaleString('en-US')));
    if(Number.isFinite(row?.t))footer.append(htmlEl('span','ofi-stat','T='+row.t.toFixed(1)));
    if(Number.isFinite(row?.omegaTotal))footer.append(htmlEl('span','ofi-stat','ω='+row.omegaTotal.toFixed(2)));
    if(validCi(shownCi))footer.append(htmlEl('span','ofi-stat',(isPercentile?'אחוזון':'ציון')+' · CI 95% \u2066['+shownCi[0].toFixed(1)+'–'+shownCi[1].toFixed(1)+']\u2069'));
    card.append(footer);
    return card;
  }
  function drawSignatureCanvas(context,domains,cx,cy,size){
    if(!context||!domains)return;
    context.save();context.translate(cx,cy);context.scale(size/320,size/320);context.translate(-160,-160);
    const geos=geometry(domains);
    const crystalPath=new Path2D(polygonPath(geos.flatMap(g=>g.boundary.slice(0,6))));
    const glass=context.createLinearGradient(70,30,260,290);
    glass.addColorStop(0,'#F8EBFF');glass.addColorStop(.55,'#C5A6D9');glass.addColorStop(1,'#655078');
    context.shadowColor='rgba(85,47,106,.23)';context.shadowBlur=12;
    context.globalAlpha=.88;context.fillStyle=glass;context.fill(crystalPath);
    context.shadowBlur=0;
    for(const [i,geo] of geos.entries()){
      const color=SHARD_COLORS[i];
      context.fillStyle=color;context.strokeStyle='#D5B5EB';
      context.globalAlpha=.32;context.fill(new Path2D(geo.d));
      for(const face of geo.faces){
        context.globalAlpha=Number(face.opacity);context.fill(new Path2D(face.d));
        context.globalAlpha=.35;context.lineWidth=.9;context.stroke(new Path2D(face.d));
      }
    }
    context.globalAlpha=.8;context.lineWidth=1.7;context.strokeStyle='#D5B5EB';
    context.stroke(new Path2D(polygonPath(geos.flatMap(g=>g.boundary.slice(0,6)))));
    const inner=context.createRadialGradient(145,142,5,160,160,68);
    inner.addColorStop(0,'#FFF6D8');inner.addColorStop(.52,'#F2BB77');inner.addColorStop(1,'#A27385');
    context.globalAlpha=1;context.fillStyle=inner;
    context.fill(new Path2D(polygonPath(Array.from({length:10},(_,i)=>point(-Math.PI/2+i*Math.PI/5,43)))));
    context.strokeStyle='#D5B5EB';context.stroke(new Path2D(polygonPath(Array.from({length:10},(_,i)=>point(-Math.PI/2+i*Math.PI/5,43)))));
    context.fillStyle='#FFE5AD';context.globalAlpha=.73;
    context.fill(new Path2D(polygonPath(Array.from({length:5},(_,i)=>point(-Math.PI/2+i*Math.PI*2/5,25)))));
    context.restore();
  }
  // OfiOrbit for Canvas (share-card PNG). Same geometry and the same
  // personalityMapModel values as the on-page SVG, so the image always
  // matches the site in the chosen mode ('percentile' or 'score').
  // opts.colors: {N,E,O,A,C} hex; opts.track/ink/muted/accent: hex.
  function drawMiniMapCanvas(context,domains,cx,cy,size,opts={}){
    if(!context||!domains)return;
    const segments=personalityMapModel(domains,opts.mode);
    const colors=opts.colors||{N:'#912061',E:'#BB6802',O:'#9878E5',A:'#11A68B',C:'#0850AB'};
    const track=opts.track||'#E4DCEA',ink=opts.ink||'#30263B',muted=opts.muted||'#6F6379';
    const rad=d=>d*Math.PI/180;
    const arc=(r,from,to)=>{context.beginPath();context.arc(60,60,r,rad(from),rad(to));};
    context.save();
    context.translate(cx,cy);context.scale(size/120,size/120);context.translate(-60,-60);
    for(const seg of segments){
      const color=colors[seg.key],start=-90+seg.index*72-28.2,end=start+56.4;
      context.globalAlpha=1;context.lineCap='round';context.lineWidth=6.2;
      context.strokeStyle=track;arc(42,start+CAP,end-CAP);context.stroke();
      const len=56.4*seg.score/100;
      if(len>=2*CAP){
        context.globalAlpha=.94;context.strokeStyle=color;context.lineCap='round';
        arc(42,start+CAP,start+len-CAP);context.stroke();
      }else if(len>0){
        const a=rad(start+len/2);
        context.globalAlpha=.94;context.fillStyle=color;context.beginPath();
        context.arc(60+Math.cos(a)*42,60+Math.sin(a)*42,42*len*Math.PI/360,0,Math.PI*2);context.fill();
      }
      context.lineCap='butt';context.lineWidth=3;context.strokeStyle=color;
      seg.facets.forEach((facet,j)=>{
        context.globalAlpha=(opts.facetFloor??.28)+(1-(opts.facetFloor??.28))*.93*facet.score/100;
        arc(32,start+j*9.4+.9,start+(j+1)*9.4-.9);context.stroke();
      });
    }
    context.globalAlpha=.65;context.lineWidth=.8;context.strokeStyle=track;
    context.beginPath();context.arc(60,60,23.1,0,Math.PI*2);context.stroke();
    const topScore=Math.max(...segments.map(s=>s.score));
    const leaders=segments.filter(s=>s.score===topScore);
    context.globalAlpha=1;
    context.fillStyle=leaders.length===1?colors[leaders[0].key]:(opts.accent||'#BD834C');
    context.beginPath();
    if(context.roundRect)context.roundRect(56.4,40.6,7.2,2.7,1.35);else context.rect(56.4,40.6,7.2,2.7);
    context.fill();
    const font=opts.font||'"ofiLab Heebo", Arial, sans-serif';
    context.textAlign='center';context.direction='ltr';
    context.fillStyle=ink;context.font='700 25px '+font;context.fillText('05',60,65);
    context.fillStyle=muted;context.font='700 6.7px '+font;
    if('letterSpacing' in context)context.letterSpacing='.65px';
    context.fillText('BIG FIVE',60,75.2);
    if('letterSpacing' in context)context.letterSpacing='0px';
    context.restore();
  }
  let profile=null,metricMode='percentile';

  // Decorate the existing scoring DOM in place. The application's metric switcher
  // still owns its exact values. The 95% interval is not drawn on these small
  // tracks: in percentiles it is widest in the crowded middle of the scale and
  // read as "the test is inaccurate". It stays in the track's accessible label
  // and is written out in the comparison section ("CI 95%"), with that context.
  function attachConfidenceTrack(track,value,ci,key,mode,label){
    if(!track)return;
    track.classList.add('ofi-spectrum-track');
    track.querySelector('.ofi-spectrum__band')?.remove();
    const shown=clamp(value);
    const bounded=validCi(ci);
    track.setAttribute('role','img');
    track.setAttribute('aria-label',label+': '+(mode==='percentile'?'אחוזון ':'ציון שאלון ')+
      shown.toFixed(1)+(bounded?'; רווח סמך של 95 אחוז: '+ci[0].toFixed(1)+' עד '+ci[1].toFixed(1):''));
  }
  function decorateScoreTracks(){
    if(!profile?.domains)return;
    const rel=metricMode==='percentile'&&Boolean(profile.empiricalReference);
    const rows=new Map((profile.normRows||[]).map(row=>[row.key,row]));
    const mode=rel?'percentile':'score';
    for(const key of ORDER){
      const entry=profile.domains[key];
      if(!entry)continue;
      const row=rows.get(key);
      const ci=rel?row?.percentileCi95:row?.ci95;
      const val=rel?(entry.percentileExact??entry.percentile):entry.score;
      const card=document.getElementById('trait-'+key);
      attachConfidenceTrack(card?.querySelector('.domain-summary .track'),val,ci,key,mode,TRAITS[key].label);
      card?.querySelectorAll('.facet-item .track').forEach((track,i)=>{
        const f=entry.facets?.[i];if(!f)return;
        const facetRow=rows.get(key+(i+1));
        attachConfidenceTrack(track,rel?(f.percentileExact??f.percentile):f.score,
          rel?facetRow?.percentileCi95:facetRow?.ci95,key,mode,f.label);
      });
    }
    document.querySelectorAll('#facetExplorerList .facet-explorer-card').forEach(card=>{
      const key=card.dataset.trait;
      if(!TRAITS[key])return;
      const label=card.querySelector('h3')?.textContent?.trim();
      const index=profile.domains[key]?.facets?.findIndex(f=>f.label===label)??-1;
      if(index<0)return;
      const f=profile.domains[key].facets[index],row=rows.get(key+(index+1));
      attachConfidenceTrack(card.querySelector('.facet-explorer-track'),
        rel?(f.percentileExact??f.percentile):f.score,
        rel?row?.percentileCi95:row?.ci95,key,mode,f.label);
    });
  }
  function mountHome(){
    // The cover is typographic and optical, not a large SVG gemstone.
    // The interactive, data-driven crystal is reserved for the personal report and exports.
    document.querySelectorAll('.home-preview-track').forEach(track=>track.classList.add('ofi-spectrum'));
  }
  function mountResults({animate=false}={}){
    if(!profile?.domains)return;
    decorateScoreTracks();
    // Keep the approved results first-fold: signature is integrated into the existing
    // executive summary, never inserted as a new full-width section above the scores.
    document.getElementById('ofiSignatureHero')?.remove();
    const summary=document.getElementById('resultsProfileSummary');
    const shell=summary?.querySelector('.profile-summary-shell');
    if(shell&&!summary.hidden){
      const prominent=ORDER.slice().sort((a,b)=>{
        const value=k=>Number(profile.domains[k].percentileExact??profile.domains[k].score);
        return value(b)-value(a);
      });
      summary.style.setProperty('--aura-primary',colorFor(prominent[0]));
      summary.style.setProperty('--aura-secondary',colorFor(prominent[1]));
      shell.querySelector('.ofi-signature-inset')?.remove();
      summary.querySelector('.ofi-crystal-key')?.remove();
      const figure=htmlEl('figure','ofi-signature-inset');
      figure.setAttribute('aria-label','מפת האישיות שלך');
      const openTrait=trait=>{
        const card=document.getElementById('trait-'+trait);
        if(card){card.open=true;card.scrollIntoView({behavior:reducedMotion()?'instant':'smooth',block:'center'});}
      };
      // A small flat SVG replaces OfiLens only in this report slot.
      // The original crystal canvas/SVG remains unchanged for legacy exports.
      figure.append(personalityMiniMap(profile.domains,{mode:metricMode,onOpen:openTrait}));
      figure.append(htmlEl('figcaption',null,'הקשתות: חמש התכונות · הסימונים הפנימיים: 30 תחומי המשנה.'));
      const header=shell.querySelector('.profile-summary-header');
      if(header)header.after(figure);
      else shell.prepend(figure);
      // Key under the map: same colours as the map and the same values, in the
      // same format, as the trait cards for the selected mode.
      const rel=metricMode==='percentile'&&Boolean(profile.empiricalReference);
      const keyValue=d=>rel?String(d.percentile):(Math.round(Number(d.score)*10)/10).toLocaleString('he-IL',{maximumFractionDigits:1});
      const unit=rel?'אחוזונים':'ציוני שאלון מתוך 100';
      const key=htmlEl('div','ofi-crystal-key');
      key.setAttribute('aria-label','מפתח המפה: חמש תכונות, '+unit);
      key.append(htmlEl('p','ofi-crystal-key__heading','מפתח המפה · '+unit+' · בחרו תכונה לפירוט'));
      ORDER.forEach(trait=>{
        const d=profile.domains[trait];
        const button=htmlEl('button','ofi-crystal-key__trait');
        button.type='button';
        button.style.setProperty('--key-color',colorFor(trait));
        button.setAttribute('aria-label',TRAITS[trait].label+', '+(rel?'אחוזון ':'ציון ')+keyValue(d)+'. מעבר לפירוט התכונה');
        const dot=htmlEl('span','ofi-crystal-key__swatch');dot.setAttribute('aria-hidden','true');
        button.append(dot,htmlEl('span','ofi-crystal-key__name',TRAITS[trait].label),
          htmlEl('strong','ofi-crystal-key__value',keyValue(d)));
        button.addEventListener('click',()=>{
          const card=document.getElementById('trait-'+trait);
          if(card){card.open=true;card.scrollIntoView({behavior:reducedMotion()?'instant':'smooth',block:'center'});}
        });
        key.append(button);
      });
      summary.append(key);
    }
    const norm=document.getElementById('normPanel');
    if(norm){
      norm.querySelector('#ofiEmpiricalDistributions')?.remove();
      const section=htmlEl('section');section.id='ofiEmpiricalDistributions';
      section.append(htmlEl('h3','ofi-dist-title','התפלגויות במדגם'));
      section.append(htmlEl('p',null,'הצורות מחושבות מטבלאות השכיחות האמפיריות של מדגם ההשוואה. הציר האופקי הוא תמיד ציון השאלון (0–100); בתצוגת אחוזונים, השטח המודגש משמאל לסמן הוא חלק המדגם שקיבל ציון נמוך יותר. טווח הסמך (CI 95%) רחב יותר באחוזונים באמצע הסולם, כי שם רוב המשיבים צפופים וכל נקודת ציון מזיזה הרבה אחוזונים; זה לא מעיד על חוסר דיוק של השאלון.'));
      const grid=htmlEl('div','ofi-dist-grid');
      ORDER.forEach(key=>{const card=empiricalDistributionCard(profile,key,metricMode);if(card)grid.append(card);});
      norm.classList.remove('ofi-has-empirical');
      if(grid.childElementCount){section.append(grid);norm.querySelector('.norm-context')?.after(section);norm.classList.add('ofi-has-empirical');}
    }
  }

  // Visual-only layer: no changes to answers, scoring, persistence or navigation.
  const motionState={selecting:false,revealArmed:false,veil:null,timers:[]};
  const reducedMotion=()=>Boolean(root.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  function setupMotion(){
    document.addEventListener('click',event=>{
      const answer=event.target.closest?.('#quizScreen #answerSet .answer-btn');
      if(answer){
        motionState.selecting=true;
        answer.classList.add('is-responding');
        root.setTimeout(()=>answer.classList.remove('is-responding'),185);
        queueMicrotask(()=>{motionState.selecting=false;});
        return;
      }
      if(document.documentElement.dataset.stage!=='quiz')return;
      const action=event.target.closest?.('#resultsBtn,#finishNowBtn,#nextBtn');
      if(action&&(action.id!=='nextBtn'||document.getElementById('nextLabel')?.textContent?.includes('תוצאות'))){
        motionState.revealArmed=true;
      }
    },true);
    root.addEventListener('ofilab:question',event=>{
      const info=event.detail||{};
      if(motionState.selecting&&Number(info.total)>0&&Number(info.answered)===Number(info.total)){
        motionState.revealArmed=true;
      }
    });
  }
  function revealReport(){
    const screen=document.getElementById('resultScreen');
    if(!screen||reducedMotion())return;
    motionState.timers.forEach(id=>root.clearTimeout(id));
    motionState.veil?.remove();
    screen.classList.remove('calm-report-in');
    const veil=htmlEl('div','calm-reveal-veil');
    veil.id='calmReportReveal';
    veil.setAttribute('role','status');
    veil.setAttribute('aria-live','polite');
    veil.setAttribute('aria-atomic','true');
    const content=htmlEl('div','calm-reveal-content');
    const mark=htmlEl('span','calm-reveal-mark');
    mark.setAttribute('aria-hidden','true');
    content.append(mark,htmlEl('p','calm-reveal-message','מעבד את המפה האישית שלך...'));
    veil.append(content);
    document.body.append(veil);
    motionState.veil=veil;
    motionState.timers=[
      root.setTimeout(()=>{
        if(motionState.veil!==veil)return;
        screen.querySelectorAll('#domainResults>.domain-card').forEach((card,index)=>{
          card.style.setProperty('--calm-card-index',String(index));
        });
        screen.classList.add('calm-report-in');
        screen.querySelector('.ofi-signature-inset .ofi-crystal')?.classList.add('is-revealing');
        veil.classList.add('is-leaving');
      },1240),
      root.setTimeout(()=>{
        if(motionState.veil!==veil)return;
        veil.remove();
        motionState.veil=null;
      },1500),
      root.setTimeout(()=>screen.classList.remove('calm-report-in'),1970)
    ];
  }
  function ready(){
    if(document.documentElement.dataset.uiVersion!=='v2')return;
    mountHome();
    setupMotion();
    const saveMenu=document.getElementById('quizSaveMenu');
    if(saveMenu){
      // Reuse the existing save buttons and their handlers; this only groups them.
      saveMenu.addEventListener('click',event=>{
        if(event.target.closest('button'))saveMenu.open=false;
      });
      document.addEventListener('click',event=>{
        if(!saveMenu.contains(event.target))saveMenu.open=false;
      });
      document.addEventListener('keydown',event=>{
        if(event.key==='Escape'&&saveMenu.open){
          saveMenu.open=false;saveMenu.querySelector('summary').focus();event.preventDefault();
        }
      });
    }
    root.addEventListener('ofilab:results',e=>{
      if(!e.detail?.profile?.domains)return;
      profile=e.detail.profile;metricMode=profile.empiricalReference?'percentile':'score';
      const celebrate=motionState.revealArmed&&!reducedMotion();
      motionState.revealArmed=false;
      if(celebrate)revealReport();
      queueMicrotask(()=>mountResults({animate:!celebrate&&!reducedMotion()}));
    });
    root.addEventListener('ofilab:metric',e=>{
      if(!profile)return;
      metricMode=e.detail?.mode==='percentile'&&profile.empiricalReference?'percentile':'score';
      queueMicrotask(mountResults);
    });
  }
  root.OfiCalmV2=Object.freeze({personalitySignature,personalityMapModel,personalityMiniMap,spectrumScale,empiricalDistributionCard,drawSignatureCanvas,drawMiniMapCanvas,geometry,validCi,smoothDensityPath});
  // Loaded just before the consolidated application at the end of <body>: subscribe before synchronous restore/results events.
  ready();
})(window);
