/* ofiLab Chat Markdown v1. Untrusted text -> DOM nodes, NEVER innerHTML.
   Supports emphasis, headings, lists, quotes, tables, links and code blocks.
   Scriptable URLs, embedded HTML and external images are intentionally inert. */
(function(root){
'use strict';
const TICK=String.fromCharCode(96), MAX=14000,DEPTH=5,document=root.document;
const el=(tag,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;return n;};
const txt=value=>document.createTextNode(value);
function href(s){
 if(typeof s!=='string'||s.length>1400||/[\s\u0000-\u001f\u007f]/.test(s)||!/^https?:\/\//i.test(s))return null;
 try{const url=new URL(s);return ['https:','http:'].includes(url.protocol)?url.href:null;}catch(e){return null;}
}
function endMark(s,mark,at){
 let i=at;
 while(i<s.length){
  const p=s.indexOf(mark,i);if(p<0)return -1;
  let count=0;for(let j=p-1;j>=0&&s[j]==='\\';j--)count++;
  if(!(count%2))return p;
  i=p+mark.length;
 }
 return -1;
}
function inline(parent,value,depth=0){
 const s=String(value);if(depth>=DEPTH){parent.append(txt(s));return;}
 let at=0,plain='';
 function flush(){if(plain){parent.append(txt(plain));plain='';}}
 while(at<s.length){
  const ch=s[at];
  if(ch==='\\'&&at+1<s.length&&(/[\\*_[\]~!]/.test(s[at+1])||s[at+1]===TICK)){plain+=s[at+1];at+=2;continue;}
  if(ch===TICK){
   let width=1;while(s[at+width]===TICK&&width<8)width++;
   const mark=TICK.repeat(width),end=endMark(s,mark,at+width);
   if(end>at+width){flush();const code=el('code','ai-md-inline-code');code.textContent=s.slice(at+width,end).replace(/\n/g,' ');parent.append(code);at=end+width;continue;}
  }
  if(ch==='['&&s[at-1]!=='!'){
   const closing=endMark(s,'](',at+1);
   if(closing>at+1){
    const last=endMark(s,')',closing+2);
    if(last>closing+2){
     const url=href(s.slice(closing+2,last).trim());
     if(url){flush();const a=el('a');a.href=url;a.rel='noopener noreferrer nofollow';a.target='_blank';inline(a,s.slice(at+1,closing),depth+1);parent.append(a);at=last+1;continue;}
    }
   }
  }
  let used=false;
  for(const [mark,tag] of [['**','strong'],['__','strong'],['~~','del'],['*','em'],['_','em']]){
   if(!s.startsWith(mark,at))continue;
   if(mark.length===1&&s[at+1]===mark)continue;
   const end=endMark(s,mark,at+mark.length);
   if(end<=at+mark.length)continue;
   const body=s.slice(at+mark.length,end);
   if(!body.trim()||/^\s|\s$/.test(body))continue;
   flush();const span=el(tag);inline(span,body,depth+1);parent.append(span);at=end+mark.length;used=true;break;
  }
  if(!used){plain+=ch;at++;}
 }
 flush();
}
const heading=s=>/^\s{0,3}(#{1,5})\s+(.+?)\s*#*\s*$/.exec(s);
const list=s=>/^\s{0,3}([-*+]|\d{1,3}[.)])\s+(.+)/.exec(s);
const quote=s=>/^\s{0,3}>\s?/.test(s);
const hr=s=>/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(s);
function fence(s){
 const re=new RegExp('^\\s{0,3}('+TICK+'{3,}|~{3,})([^\\r\\n]*)$');
 return re.exec(s);
}
function cells(s){
 let t=s.trim();if(t.startsWith('|'))t=t.slice(1);if(t.endsWith('|'))t=t.slice(0,-1);
 return t.split(/(?<!\\)\|/).map(x=>x.trim().replace(/\\\|/g,'|'));
}
function separator(s){const cols=cells(s);return cols.length>=2&&cols.every(t=>/^:?-{3,}:?$/.test(t));}
function begins(lines,i){
 return Boolean(fence(lines[i])||heading(lines[i])||list(lines[i])||quote(lines[i])||hr(lines[i])||
  (i+1<lines.length&&lines[i].includes('|')&&separator(lines[i+1])));
}
function blocks(out,lines){
 let i=0;
 while(i<lines.length){
  const row=lines[i];if(!row.trim()){i++;continue;}
  const f=fence(row);
  if(f){
   const mark=f[1],lang=f[2].trim().split(/\s+/)[0].slice(0,22).replace(/[^a-zA-Z0-9+_.#-]/g,'');
   const collected=[];i++;
   const re=new RegExp('^\\s{0,3}'+(mark[0]===TICK?TICK:'~')+'{'+mark.length+',}\\s*$');
   while(i<lines.length&&!re.test(lines[i]))collected.push(lines[i++]);
   if(i<lines.length)i++;
   const wrap=el('div','ai-md-codeblock');
   if(lang){const caption=el('span','ai-md-code-language');caption.textContent=lang;wrap.append(caption);}
   const pre=el('pre'),code=el('code');code.textContent=collected.join('\n');pre.append(code);wrap.append(pre);out.append(wrap);continue;
  }
  if(hr(row)){out.append(el('hr'));i++;continue;}
  const title=heading(row);
  if(title){const h=el('h'+Math.min(6,Math.max(3,title[1].length)));inline(h,title[2]);out.append(h);i++;continue;}
  if(i+1<lines.length&&row.includes('|')&&separator(lines[i+1])){
   const labels=cells(row).slice(0,12),body=[];i+=2;
   while(i<lines.length&&lines[i].includes('|')&&lines[i].trim()&&body.length<40)body.push(cells(lines[i++]));
   const scroll=el('div','ai-md-table-scroll'),table=el('table'),thead=el('thead'),tr=el('tr');
   labels.forEach(label=>{const th=el('th');inline(th,label);tr.append(th);});thead.append(tr);table.append(thead);
   const tbody=el('tbody');
   body.forEach(record=>{const line=el('tr');labels.forEach((_,k)=>{const td=el('td');inline(td,record[k]||'');line.append(td);});tbody.append(line);});
   table.append(tbody);scroll.append(table);out.append(scroll);continue;
  }
  if(quote(row)){
   const entries=[];while(i<lines.length&&quote(lines[i]))entries.push(lines[i++].replace(/^\s{0,3}>\s?/,''));
   const block=el('blockquote'),p=el('p');
   entries.forEach((str,j)=>{if(j)p.append(el('br'));inline(p,str);});
   block.append(p);out.append(block);continue;
  }
  const item=list(row);
  if(item){
   const ordered=/^\d/.test(item[1]),group=el(ordered?'ol':'ul');
   if(ordered){const n=Number(item[1].match(/^\d+/)[0]);if(n>1)group.start=n;}
   while(i<lines.length){
    const match=list(lines[i]);if(!match||/^\d/.test(match[1])!==ordered)break;
    const li=el('li');inline(li,match[2]);group.append(li);i++;
    while(i<lines.length&&/^\s{4,}\S/.test(lines[i])){li.append(el('br'));inline(li,lines[i++].trim());}
   }
   out.append(group);continue;
  }
  const para=[];while(i<lines.length&&lines[i].trim()&&(para.length===0||!begins(lines,i))&&para.length<50)para.push(lines[i++]);
  const p=el('p');para.forEach((str,j)=>{if(j)p.append(el('br'));inline(p,str.trim());});out.append(p);
 }
}
function render(value){
 const fragment=document.createDocumentFragment();
 const s=String(value??'').replace(/\r\n?/g,'\n').slice(0,MAX);
 blocks(fragment,s.split('\n'));return fragment;
}
root.OfiLabMarkdown=Object.freeze({render});
if(typeof module!=='undefined'&&module.exports)module.exports=root.OfiLabMarkdown;
})(typeof window!=='undefined'?window:globalThis);
