/* The display theme is kept in localStorage only. No cookie is written; a theme cookie left by an
   older version is read once, copied to localStorage and deleted. */
(function(){
  'use strict';
  const COOKIE_PATH=location.hostname==='ofilab.avrahamd.ovh'?'/':String(location.pathname||'').startsWith('/personality')?'/personality/':'/ofilab/';
  const KEY='avd-personality:theme',COOKIE='avd_personality_theme';
  function cookieTheme(){
    try{
      const part=document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='));
      const value=part?part.slice(COOKIE.length+1):'';
      return value==='dark'?'dark':value==='light'?'light':null;
    }catch(e){return null}
  }
  function remember(mode){
    try{localStorage.setItem(KEY,mode);return true}catch(e){return false}
  }
  function dropCookie(){
    try{
      const secure=location.protocol==='https:'?'; Secure':'';
      document.cookie=COOKIE+'=; Path='+COOKIE_PATH+'; Max-Age=0; SameSite=Strict'+secure;
    }catch(e){}
  }
  function apply(mode){
    const dark=mode==='dark';
    document.documentElement.dataset.theme=dark?'dark':'light';
    const btn=document.getElementById('themeToggle');
    if(btn){
      btn.setAttribute('aria-pressed',String(dark));
      btn.setAttribute('aria-label',dark?'מעבר למצב בהיר':'מעבר למצב כהה');
      btn.setAttribute('title',dark?'מצב בהיר':'מצב כהה');
      const use=btn.querySelector('use');
      if(use)use.setAttribute('href',dark?'#i-sun':'#i-moon');
    }
    const themeColor=document.querySelector('meta[name="theme-color"]');
    if(themeColor){
      themeColor.setAttribute('content',dark?'#19151F':'#F8F5FA');
    }
  }
  document.documentElement.dataset.calmStyle='quiet';
  let theme='light';
  try{
    const value=localStorage.getItem(KEY);
    if(value==='dark'||value==='light')theme=value;
    else theme=cookieTheme()||'light';
  }catch(e){theme=cookieTheme()||'light'}
  if(cookieTheme()&&remember(theme))dropCookie();
  apply(theme);
  const btn=document.getElementById('themeToggle');
  if(btn)btn.addEventListener('click',()=>{
    theme=document.documentElement.dataset.theme==='dark'?'light':'dark';
    apply(theme);remember(theme);
  });
})();

