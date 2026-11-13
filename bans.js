"use strict";
(() => {
 const $ = id => document.getElementById(id), panel = $('ban-panel'), list = $('ban-visitors');
 let owner = false, busy = false, next = null, timer, appInert = false;
 const visitors = new Map();
 const search=document.createElement('input');search.type='search';search.id='ban-search';search.placeholder='search names, previous names or browser id';search.maxLength=64;search.setAttribute('aria-label','search all members and browsers');list.before(search);
 let searchTimer;
 function query(){return search.value.trim().normalize('NFKC').toLowerCase();}
 function runSearch(){clearTimeout(searchTimer);if(!owner||panel.hidden)return;if(busy){searchTimer=setTimeout(runSearch,150);return;}visitors.clear();next=null;render();command({type:'list-visitors',query:query()});}
 search.addEventListener('input',()=>{next=null;render();clearTimeout(searchTimer);searchTimer=setTimeout(runSearch,250);});
 function error(text = '') { $('ban-error').textContent = text; $('ban-error').hidden = !text; }
 function controls() {
  $('ban-refresh').disabled = busy || !owner;
  $('ban-refresh').textContent = busy ? 'loading…' : 'refresh';
  $('ban-more').disabled = busy || !owner; $('ban-more').hidden = !next;
  for (const button of list.querySelectorAll('button')) button.disabled = busy || !owner || button.dataset.protected === 'true';
 }
 function finish() { clearTimeout(timer); busy = false; controls(); }
 function command(data) {
  if (!owner || busy) return;
  busy = true; error(); controls();
  timer = setTimeout(() => { finish(); error('Update not confirmed. Refresh before retrying.'); }, 10000);
  window.dispatchEvent(new CustomEvent('velx-ban-command', { detail: data }));
 }
 function render() {
  list.replaceChildren();
  if (!visitors.size) { const empty = document.createElement('p'); empty.className = 'chat-note'; empty.textContent = 'no browsers recorded'; list.append(empty); }
  for (const visitor of visitors.values()) {
   if(query()&&![visitor.name,...visitor.names,visitor.id].join(' ').normalize('NFKC').toLowerCase().includes(query()))continue;
   const row = document.createElement('article'), title = document.createElement('strong'), id = document.createElement('p'), history = document.createElement('details'), summary = document.createElement('summary'), names = document.createElement('p'), actions = document.createElement('div');
   row.className = 'ban-visitor'; title.textContent = visitor.name || 'no chat name set';
   id.className = 'chat-note'; id.textContent = 'browser ' + visitor.id.slice(0, 12) + ' · ' + (visitor.isOwner ? 'owner' : visitor.siteBanned ? 'site banned' : visitor.chatBanned ? 'chat banned' : 'not banned');
   summary.textContent = 'previous chat names'; names.textContent = visitor.names.filter(name => name !== visitor.name).join(', ') || 'none';
   history.append(summary, names); actions.className = 'ban-actions';
   for (const scope of ['chat', 'site']) {
    const banned = scope === 'chat' ? visitor.chatBanned : visitor.siteBanned;
    const button = document.createElement('button'); button.type = 'button'; button.textContent = (banned ? 'unban ' : 'ban from ') + scope;
    button.dataset.protected = String(!!visitor.isOwner);
    button.setAttribute('aria-label', button.textContent + ' for ' + (visitor.name || 'browser ' + visitor.id.slice(0,12)));
    button.addEventListener('click', () => {
     if (!owner || busy || visitor.isOwner) return;
     if (banned || confirm('Ban this browser from ' + scope + '? This affects every open tab for this browser.')) command({ type: 'set-ban', id: visitor.id, scope, banned: !banned });
    });
    actions.append(button);
   }
   for(const [permission,label]of [['moderator','moderator'],['imagePerms','image perms']]){
    const button=document.createElement('button');button.type='button';button.textContent=(visitor[permission]?'remove ':'grant ')+label;button.dataset.protected=String(!!visitor.isOwner);button.setAttribute('aria-label',button.textContent+' for '+(visitor.name||'browser '+visitor.id.slice(0,12)));
    button.addEventListener('click',()=>{if(owner&&!busy&&!visitor.isOwner)command({type:'set-permission',id:visitor.id,permission,enabled:!visitor[permission]});});actions.append(button);
   }
   row.append(title, id, history, actions); list.append(row);
  }
  controls();
 }
 $('ban-action').addEventListener('click', () => {
  if (!owner) return;
  $('announcement-form').hidden = true; panel.hidden = false;
  visitors.clear(); next = null; render(); command({ type: 'list-visitors',query:query() });
 });
 $('announcement-action').addEventListener('click', () => { panel.hidden = true; });
 $('ban-refresh').addEventListener('click', runSearch);
 $('ban-more').addEventListener('click', () => { if (next) command({ type: 'list-visitors', cursor: next,query:query() }); });
 window.addEventListener('velx-owner-state', event => {
  owner = event.detail === true;
  if (!owner) { finish(); panel.hidden = true; visitors.clear(); list.replaceChildren(); }
  controls();
 });
 window.addEventListener('velx-ban-response', event => {
  const data = event.detail;
  if (!owner) return;
  finish(); error();
  if (data.type === 'visitors') {if(data.query!==query()){runSearch();return;} for (const visitor of data.visitors) visitors.set(visitor.id, visitor); next = data.next; }
  else visitors.set(data.visitor.id, data.visitor);
  render();
 });
 window.addEventListener('velx-ban-error', event => { if (busy) { finish(); error(event.detail); } });
 window.addEventListener('velx-ban-state', event => {
  const { chatBanned, siteBanned } = event.detail;
  const wasBanned = document.body.classList.contains('site-banned');
  document.body.classList.toggle('site-banned', siteBanned);
  $('chat-page').classList.toggle('chat-banned', chatBanned);
  $('site-ban').hidden = !siteBanned; $('chat-ban').hidden = !chatBanned;
  if (siteBanned && !wasBanned) { appInert = $('app').inert; if (!$('view').hidden) $('home-btn').click(); $('app').inert = true; for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close(); $('site-ban').focus(); }
  if (!siteBanned && wasBanned) { $('app').inert = appInert; $('nav-home').focus(); }
  for (const section of $('chat-page').children) if (section.id !== 'chat-ban') section.inert = !!chatBanned;
  if (chatBanned && !$('chat-page').hidden && !siteBanned) $('chat-ban').focus();
 });
 controls();
})();
