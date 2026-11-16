/* ofiLab protected-link inventory routing.
 * The URL fragment never reaches the server. Inspect only the authenticated
 * envelope's public version/KDF header to choose the correct survey before
 * loading the static questionnaire modules. Never interpret this as decryption.
 */
(function(root){
'use strict';
const VERSION_INVENTORY={226:'ipip-neo-300',227:'ipip-neo-120'};
const LEGACY_DEPRECATED_CODES={228:'ipip-50'};
const LENGTH={'ipip-neo-120':120,'ipip-neo-300':300};
function parseHeader(token){
  if(typeof token!=='string'||token.length<72||token.length>800||!/^[A-Za-z0-9_-]+$/.test(token))return null;
  try{
    const bytes=root.atob(token.slice(0,4).replace(/-/g,'+').replace(/_/g,'/'));
    if(bytes.length!==3)return null;
    const code=bytes.charCodeAt(0),kdf=bytes.charCodeAt(1),cost=bytes.charCodeAt(2);
    if(!((kdf===1&&cost===1)||(kdf===2&&cost===2)))return null;
    return code;
  }catch(e){return null;}
}
function inventoryForToken(token){
  const code=parseHeader(token);
  return code!=null&&VERSION_INVENTORY[code]?VERSION_INVENTORY[code]:null;
}
function deprecatedInventoryForToken(token){
  const code=parseHeader(token);
  return code!=null&&LEGACY_DEPRECATED_CODES[code]?LEGACY_DEPRECATED_CODES[code]:null;
}
function deprecatedInventoryForHash(hash){
  if(typeof hash!=='string')return null;
  if(hash.startsWith('#e='))return deprecatedInventoryForToken(hash.slice(3).split('&')[0]);
  if(hash.startsWith('#p=')){
    const tok=hash.slice(3).split('&')[0];
    if(!/^[A-Za-z0-9_-]{8,260}$/.test(tok))return null;
    try{
      const b0=root.atob(tok.slice(0,4).replace(/-/g,'+').replace(/_/g,'/')).charCodeAt(0);
      if(b0===0x52||(b0===0x32&&tok.length===34))return 'ipip-50';
    }catch(_e){}
  }
  return null;
}
function inventoryForHash(hash){
  if(typeof hash!=='string'||!hash.startsWith('#e='))return null;
  const token=hash.slice(3).split('&')[0];
  return inventoryForToken(token);
}
function canonicalUrl(inv,deprecated50=false){
  const u=new URL(root.location.href);
  u.searchParams.delete('inventory');
  u.searchParams.delete('start');
  u.searchParams.set('len',String(LENGTH[inv]||120));
  if(deprecated50)u.searchParams.set('deprecated','50');
  return u;
}
function replaceQuery(inv,deprecated50=false){
  const u=canonicalUrl(inv,deprecated50);
  const current=new URL(root.location.href);
  if(u.search!==current.search&&root.history?.replaceState)
    root.history.replaceState(null,'',u.pathname+u.search+u.hash);
}
function bootstrap(){
  if(!root.document?.documentElement)return null;
  const hash=root.location?.hash||'';
  const curUrl=(root.location&&typeof root.location.href==='string')?new URL(root.location.href):null;
  const depQuery=Boolean(curUrl&&(curUrl.searchParams.get('len')==='50'||curUrl.searchParams.get('inventory')==='ipip-50'||curUrl.searchParams.get('deprecated')==='50'));
  const depHash=deprecatedInventoryForHash(hash);
  if(depHash||depQuery){
    root.document.documentElement.dataset.deprecatedInventory=depHash||'ipip-50';
    root.document.documentElement.dataset.inventory='ipip-neo-120';
    replaceQuery('ipip-neo-120',true);
    return 'ipip-neo-120';
  }
  const inv=inventoryForHash(hash);
  if(!inv)return null;
  root.document.documentElement.dataset.inventory=inv;
  replaceQuery(inv);
  return inv;
}
function navigateIfNeeded(){
  if(!root.document?.documentElement)return false;
  const hash=root.location?.hash||'';
  const depHash=deprecatedInventoryForHash(hash);
  if(depHash){
    root.document.documentElement.dataset.deprecatedInventory=depHash;
    if(root.document.documentElement.dataset.inventory!=='ipip-neo-120'){
      if(typeof root.switchOfiLabInventory==='function'){
        root.switchOfiLabInventory(120,false,{preserveHash:true});
        return false;
      }
      root.location.assign(canonicalUrl('ipip-neo-120',true).toString());
      return true;
    }
    replaceQuery('ipip-neo-120',true);
    return false;
  }
  const inv=inventoryForHash(hash);
  if(!inv)return false;
  if(root.document.documentElement.dataset.inventory!==inv){
    if(typeof root.switchOfiLabInventory==='function'){
      root.switchOfiLabInventory(LENGTH[inv],false,{preserveHash:true});
      return false;
    }
    root.location.assign(canonicalUrl(inv).toString());
    return true;
  }
  replaceQuery(inv);
  return false;
}
const api={inventoryForToken,inventoryForHash,deprecatedInventoryForToken,deprecatedInventoryForHash,bootstrap,navigateIfNeeded};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.OfiLabProtectedLinkRouting=api;
bootstrap();
})(typeof window!=='undefined'?window:globalThis);
