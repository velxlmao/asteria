"use strict";
(() => {
 const $ = id => document.getElementById(id);
 const list = $('chat-messages'), input = $('chat-input'), name = $('chat-name');
 const sidebar = document.createElement('aside'); sidebar.className = 'chat-channel-sidebar';
 const serverTitle = document.createElement('h2'); serverTitle.textContent = 'asteria';
 const profile = document.createElement('div'); profile.className = 'chat-profile-settings';
 profile.append(document.querySelector('.chat-header-controls'), document.querySelector('.chat-header-notes'));
 sidebar.append(serverTitle, profile); $('chat-page').prepend(sidebar);
 document.querySelector('#chat-page .page-title').textContent = 'public chat';
 input.placeholder = 'send a message';
 input.rows = 1;
 const rules = globalThis.AsteriaChatRules;
 const content = document.querySelector('#chat-page .chat-content');
 const composer = $('chat-form');
 let moderator=false,imagePerms=false,pendingImage=null,preparingImage=false;
 let replyTo = null, chatState = { enabled: true, id: '', reactions: {} }, emojiTarget = null;
 const people = new Map();
 const selectedMentions=new Map();
 function element(tag, className, text) { const node=document.createElement(tag);node.className=className;if(text)node.textContent=text;return node; }
 function button(label, action, className='chat-action') { const node=element('button',className,label);node.type='button';node.addEventListener('click',action);return node; }
 const replyBar=element('div','chat-reply-bar');replyBar.hidden=true;
 const replyLabel=element('span','');replyBar.append(replyLabel,button('cancel reply',()=>setReply(null)));
 content.insertBefore(replyBar,composer);
 const emojiButton=button('☺',()=>showEmojis('insert'),'chat-emoji-toggle');emojiButton.setAttribute('aria-label','insert emoji');composer.insertBefore(emojiButton,input);
 const imageFile=element('input','');imageFile.type='file';imageFile.accept='image/png,image/jpeg,image/webp';imageFile.hidden=true;imageFile.setAttribute('aria-label','choose image');composer.append(imageFile);
 const imageButton=button('image',()=>imageFile.click(),'chat-image-toggle');imageButton.setAttribute('aria-label','attach image');imageButton.hidden=true;composer.insertBefore(imageButton,input);
 const imagePreview=element('div','chat-image-preview');imagePreview.hidden=true;const previewPicture=element('img','');previewPicture.alt='image ready to send';imagePreview.append(previewPicture,button('remove image',()=>clearImage()));content.insertBefore(imagePreview,composer);
 function clearImage(){pendingImage=null;imagePreview.hidden=true;previewPicture.removeAttribute('src');controls();}
 async function prepareImage(file){
  if(!ready||banned||(!owner&&!imagePerms)||!chatState.enabled){error('image permission is required');return;}
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20000000){error('choose a PNG, JPEG or WebP image under 20mb');return;}
  preparingImage=true;controls();let bitmap;
  try{bitmap=await createImageBitmap(file);const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);let data;for(const quality of [.8,.6,.4]){data=canvas.toDataURL('image/jpeg',quality).split(',')[1];if(data.length<=530000)break;}if(data.length>530000)throw Error('image is too large; choose a smaller image');if(!ready||banned||(!owner&&!imagePerms))throw Error('image permission is required');pendingImage=data;previewPicture.src='data:image/jpeg;base64,'+data;imagePreview.hidden=false;error();}
  catch(problem){error(problem.message||'could not prepare image');}
  finally{bitmap?.close();preparingImage=false;controls();}
 }
 imageFile.addEventListener('change',()=>{prepareImage(imageFile.files[0]);imageFile.value='';});
 input.addEventListener('paste',event=>{const image=[...(event.clipboardData?.items||[])].find(item=>item.kind==='file'&&item.type.startsWith('image/'));if(image){event.preventDefault();prepareImage(image.getAsFile());}});
 const mentionMenu=element('div','chat-mention-menu');mentionMenu.hidden=true;mentionMenu.setAttribute('role','listbox');mentionMenu.setAttribute('aria-label','mention a person');composer.append(mentionMenu);
 const pauseButton=button('disable chat',()=>moderate({type:'set-chat-enabled',enabled:!chatState.enabled}));$('chat-owner-tools').append(pauseButton);
 const pausePanel=element('div','chat-paused-panel');pausePanel.hidden=true;
 const pauseTitle=element('h2','','the owner has temporarily disabled asteria chat');
 const pauseReactions=element('div','chat-reactions');
 pausePanel.append(pauseTitle,pauseReactions);content.append(pausePanel);
 const picker=element('dialog','chat-emoji-picker');picker.setAttribute('aria-label','choose an emoji');
 const pickerTitle=element('h2','','choose an emoji');
 const emojiSearch=element('input','');emojiSearch.placeholder='search emojis';emojiSearch.setAttribute('aria-label','search emojis');
 const emojiGrid=element('div','chat-emoji-grid');
 picker.append(pickerTitle,emojiSearch,emojiGrid,button('close',()=>picker.close()));document.body.append(picker);
 const membersBar=element('aside','chat-members');membersBar.setAttribute('aria-label','chat members');const membersTitle=element('h2','','members');const membersList=element('div','chat-member-list');membersBar.append(membersTitle,membersList);$('chat-page').append(membersBar);
 const membersToggle=button('members',()=>{const expanded=$('chat-page').classList.toggle('members-expanded');membersToggle.setAttribute('aria-expanded',String(expanded));},'chat-members-toggle');membersToggle.setAttribute('aria-expanded','false');document.querySelector('#chat-page .chat-head').append(membersToggle);
 function tags(target,user){for(const [enabled,label]of [[user.owner,'owner'],[user.moderator,'moderator'],[user.imagePerms,'image perms']])if(enabled)target.append(element('span','chat-owner chat-role',label));}
 function renderMembers(){membersTitle.textContent='members · '+people.size;membersList.replaceChildren();for(const person of [...people.values()].sort((a,b)=>Number(b.online)-Number(a.online)||Number(b.owner)-Number(a.owner)||Number(b.moderator)-Number(a.moderator)||a.name.localeCompare(b.name))){const member=button(person.name,()=>{if(input.value.length+person.name.length+2>input.maxLength){error('message is too long');return;}selectedMentions.set(person.name.toLowerCase(),person.id);input.setRangeText('@'+person.name+' ',input.selectionStart,input.selectionEnd,'end');input.focus();controls();},'chat-member');member.classList.toggle('offline',!person.online);member.title=person.online?'online':'offline';member.disabled=!ready||banned||!chatState.enabled;tags(member,person);membersList.append(member);}if(!people.size)membersList.append(element('p','chat-note','no one has set a name yet'));}
 const emojiNames=['thumbs up','thumbs down','heart love','laugh joy','cry sob','fire','party celebration','eyes','skull','pray thanks','wilted rose','peace','check yes','cross no','thinking','surprised','sad','angry','party face','cool sunglasses','smile','love eyes','handshake','hundred','star','purple heart','salute','stone face','mind blown','sleep','rocket','popcorn'];
 function renderEmojis() {
  emojiGrid.replaceChildren();
  rules.emojis.forEach((emoji,index)=>{
   if(emojiSearch.value&&!emojiNames[index].includes(emojiSearch.value.toLowerCase())&&!emoji.includes(emojiSearch.value))return;
   const choice=button(emoji,()=>{
    if(emojiTarget==='insert'){
     const start=input.selectionStart,end=input.selectionEnd;
     if(input.value.length-(end-start)+emoji.length>input.maxLength){error('message is too long');return;}
     input.setRangeText(emoji,start,end,'end');controls();picker.close();input.focus();
    }else { react(emojiTarget,emoji);picker.close(); }
   },'chat-emoji-choice');choice.setAttribute('aria-label',emojiNames[index]);emojiGrid.append(choice);
  });
  if(!emojiGrid.childElementCount)emojiGrid.append(element('p','chat-emoji-empty','no matching emojis'));
 }
 emojiSearch.addEventListener('input',renderEmojis);
 function showEmojis(target) {
  if(!ready||banned||(!chatState.enabled&&target!==chatState.id))return;
  emojiTarget=target;emojiSearch.value='';pickerTitle.textContent=target==='insert'?'insert emoji':'react with an emoji';renderEmojis();if(!picker.open)picker.showModal();emojiSearch.focus();
 }
 function react(id,emoji) { if(!ready||banned||socket?.readyState!==WebSocket.OPEN)return;try{send({type:'reaction',id,emoji});}catch{error('could not send reaction');} }
 function renderReactions(target,id,reactions) {
  target.replaceChildren();
  for(const [emoji,members]of Object.entries(reactions||{})){
   if(!rules.emojis.includes(emoji)||!Array.isArray(members)||!members.length)continue;
   const chip=button(emoji+' '+members.length,()=>react(id,emoji),'chat-reaction');chip.setAttribute('aria-pressed',String(members.includes(ownId)));chip.setAttribute('aria-label',emoji+' reaction, '+members.length+' people');chip.disabled=!ready||banned;target.append(chip);
  }
  const add=button('+',()=>showEmojis(id),'chat-reaction-add');add.setAttribute('aria-label','add reaction');add.disabled=!ready||banned;target.append(add);
 }
 function setReply(message) { replyTo=message?.id||null;replyBar.hidden=!message;replyLabel.textContent=message?'replying to '+message.name+': '+message.text.slice(0,100):'';if(message)input.focus(); }
 function updateChatState(state) {
  const enteringPause=chatState.enabled&&!state.enabled;
  chatState=state;content.classList.toggle('is-paused',!state.enabled);pausePanel.hidden=state.enabled;pauseButton.textContent=state.enabled?'disable chat':'resume chat';
  if(!state.enabled){mentionMenu.hidden=true;setReply(null);if(enteringPause&&picker.open)picker.close();renderReactions(pauseReactions,state.id,state.reactions);}
  controls();
 }
 function knownPeople() { const known=new Map(people);for(const message of [...messages.values()].reverse())if(message.authorId&&message.name&&!known.has(message.authorId))known.set(message.authorId,{id:message.authorId,name:message.name});return [...known.values()]; }
 function updateMentions() {
  const text=input.value.slice(0,input.selectionStart),match=text.match(/(?:^|\s)@([^@\n]{0,24})$/);
  mentionMenu.replaceChildren();mentionMenu.hidden=true;
  if(!match||!ready||!chatState.enabled)return;
  const matches=knownPeople().filter(person=>person.id!==ownId&&person.name.toLowerCase().startsWith(match[1].toLowerCase())).slice(0,8);
  for(const person of matches){const choice=button('@'+person.name,()=>{const start=input.selectionStart-match[1].length-1,end=input.selectionStart;if(input.value.length-(end-start)+person.name.length+2>input.maxLength){error('message is too long');return;}selectedMentions.set(person.name.toLowerCase(),person.id);input.setRangeText('@'+person.name+' ',start,end,'end');mentionMenu.hidden=true;input.focus();controls();},'chat-mention-choice');choice.setAttribute('role','option');mentionMenu.append(choice);}
  mentionMenu.hidden=!matches.length;
 }
 function messageMentions(text) { const found=new Map();for(const person of knownPeople().filter(person=>rules.mentionsName(text,person.name)).sort((a,b)=>Number(b.owner)-Number(a.owner)||Number(b.online)-Number(a.online))){const key=person.name.toLowerCase(),selected=selectedMentions.get(key);if(!found.has(key)&&(!selected||selected===person.id))found.set(key,person.id);}return [...found.values()].slice(0,10); }
 function renderText(target,message) {
  const mentions=(message.mentions||[]).filter(person=>typeof person.name==='string').sort((a,b)=>b.name.length-a.name.length);
  if(!mentions.length){target.textContent=message.text;return;}
  const pattern=new RegExp('@('+mentions.map(person=>person.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','gi');
  let offset=0;for(const match of message.text.matchAll(pattern)){target.append(document.createTextNode(message.text.slice(offset,match.index)));const mark=element('mark','chat-mention',match[0]);target.append(mark);offset=match.index+match[0].length;}target.append(document.createTextNode(message.text.slice(offset)));
 }
 mentionMenu.addEventListener('keydown',event=>{if(event.key==='Escape'){mentionMenu.hidden=true;input.focus();return;}if(!['ArrowDown','ArrowUp'].includes(event.key))return;event.preventDefault();const choices=[...mentionMenu.querySelectorAll('button')],index=choices.indexOf(document.activeElement);choices[(index+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length]?.focus();});
 let suspended = false, started = false, registered = false, banned = false;
 let browserToken;
 try { browserToken = localStorage.getItem('asteria-browser-token'); } catch {}
 if (!browserToken || !/^[a-zA-Z0-9-]{64,128}$/.test(browserToken)) { browserToken = crypto.randomUUID() + crypto.randomUUID(); try { localStorage.setItem('asteria-browser-token', browserToken); } catch {} }
 let socket, reconnect, retry = 0, ownId = '', visible = false, ready = false, pending = '', sentAt = 0;
 let owner = false, ttlSeconds = 0, clockOffset = 0, moderating = false, moderationTimer;
 const messages = new Map();
 const sentMessageIds = new Set();
 try { for (const id of JSON.parse(localStorage.getItem('asteria-sent-message-ids') || '[]')) if (typeof id === 'string' && id) sentMessageIds.add(id); } catch {}
 function sameBrowser(message) { return typeof ownId === 'string' && ownId.length > 0 && typeof message.authorId === 'string' && message.authorId === ownId; }
 function isMine(message) {
  return sameBrowser(message) || typeof message.id === 'string' && sentMessageIds.has(message.id) || owner && message.owner === true && message.name?.toLowerCase() === 'velx';
 }
 function rememberSent(message) {
  if (typeof message.id !== 'string' || !message.id) return;
  sentMessageIds.add(message.id);
  while (sentMessageIds.size > 500) sentMessageIds.delete(sentMessageIds.values().next().value);
  try { localStorage.setItem('asteria-sent-message-ids', JSON.stringify([...sentMessageIds])); } catch {}
 }
 try { name.value = localStorage.getItem('asteria-chat-name') || ''; } catch {}
 function send(data) { socket.send(JSON.stringify({ ...data, token: browserToken })); }
 function passwordPrompt() {
  const owner = name.value.trim().toLowerCase() === 'velx';
  $('chat-password-wrap').hidden = !owner;
  $('chat-password').required = owner;
  if (!owner) $('chat-password').value = '';
 }
 passwordPrompt();
 name.addEventListener('input', passwordPrompt);
 function error(text = '') { $('chat-error').textContent = text; $('chat-error').hidden = !text; }
 function controls() {
  $('chat-send').disabled = banned || !ready || !chatState.enabled || !!pending || preparingImage || (!input.value.trim()&&!pendingImage);
  input.disabled = banned || !ready || !chatState.enabled;
  emojiButton.disabled=input.disabled;pauseButton.disabled=moderating||!ready||!owner;
  pauseButton.hidden=!owner;imageButton.hidden=!owner&&!imagePerms;imageButton.disabled=input.disabled||preparingImage;
  $('chat-expiry').disabled=moderating||!ready||!owner;
  if(!chatState.enabled)renderReactions(pauseReactions,chatState.id,chatState.reactions);
  $('chat-owner-tools').hidden = !ready || (!owner&&!moderator);
  window.dispatchEvent(new CustomEvent('velx-owner-state', { detail: ready && owner }));
  $('chat-clear').disabled = moderating || !messages.size;
  $('chat-clear').textContent = moderating ? 'updating…' : 'clear chat';
  for (const button of list.querySelectorAll('.chat-delete')) button.disabled = moderating || !ready;
  for(const button of membersList.querySelectorAll('button'))button.disabled=!ready||banned||!chatState.enabled;
  $('chat-status').textContent = ready ? 'connected' : socket?.readyState === WebSocket.OPEN ? 'set your name to chat' : socket?.readyState === WebSocket.CONNECTING ? 'connecting…' : 'disconnected';
 }
 function render() {
  const follow = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  const previousScroll = list.scrollTop;
  list.replaceChildren();
  if (!messages.size) { const empty = document.createElement('p'); empty.className = 'chat-empty'; empty.textContent = 'no messages yet'; list.append(empty); }
  let previous;
  for (const message of messages.values()) {
   const date = new Date(message.time).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
   if (!previous || new Date(previous.time).toDateString() !== new Date(message.time).toDateString()) {
    const divider = document.createElement('div'); divider.className = 'chat-day-divider'; divider.textContent = date; list.append(divider);
   }
   const row = document.createElement('article'); row.className = 'chat-message';
   row.id='chat-message-'+message.id;
   if(message.mentions?.some(person=>person.id===ownId))row.classList.add('mentioned');
   const grouped = previous && previous.authorId === message.authorId && previous.name === message.name && message.time - previous.time < 300000 && new Date(previous.time).toDateString() === new Date(message.time).toDateString();
   if (grouped) row.classList.add('grouped');
   const mine = isMine(message);
   row.classList.toggle('own', mine);
   row.style.alignSelf = mine ? 'flex-end' : 'flex-start';
   row.style.marginLeft = mine ? 'auto' : '0';
   row.style.marginRight = mine ? '0' : 'auto';
   const heading = document.createElement('header'), author = document.createElement('strong'), time = document.createElement('time'), text = document.createElement('p');
   author.textContent = message.name; time.dateTime = new Date(message.time).toISOString(); time.textContent = new Date(message.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
   renderText(text,message); heading.append(author);
   tags(heading,message);
   heading.append(time);
   if ((owner||moderator) && ready) {
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'chat-delete'; remove.textContent = 'delete';
    remove.setAttribute('aria-label', 'delete message from ' + message.name);
    remove.disabled = moderating;
    remove.addEventListener('click', () => moderate({ type: 'delete-message', id: message.id }));
    heading.append(remove);
   }
   row.append(heading);
   if(message.replyTo){const original=messages.get(message.replyTo.id);const quote=button(original?original.name+': '+original.text.slice(0,120):'original message unavailable',()=>document.getElementById('chat-message-'+message.replyTo.id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'}),'chat-reply-quote');row.append(quote);}
   const actions=element('div','chat-message-actions');const reply=button('reply',()=>setReply(message));reply.disabled=!ready||banned||!chatState.enabled;
   const reactions=element('div','chat-reactions');renderReactions(reactions,message.id,message.reactions);actions.append(reply,reactions);
   row.append(text);
   if(message.image&&/^[a-f0-9-]{36}$/i.test(message.image.id)){const image=element('img','chat-sent-image');image.src='https://asteria-chat.realdashvr.workers.dev/images/'+message.image.id;image.alt='image sent by '+message.name;image.loading='lazy';image.width=message.image.width;image.height=message.image.height;row.append(image);}
   row.append(actions);list.append(row);
   previous = message;
  }
  if (follow) list.scrollTop = list.scrollHeight;
  else list.scrollTop = previousScroll;
 }
 function expireMessages() {
  if (!ttlSeconds) return;
  let changed = false;
  for (const [id, message] of messages) if (message.time + ttlSeconds * 1000 <= Date.now() + clockOffset) { messages.delete(id); changed = true; }
  if (changed) { render(); controls(); }
 }
 function retention() {
  const [seconds, unit] = [[86400, 'day'], [3600, 'hour'], [60, 'minute'], [1, 'second']].find(([seconds]) => ttlSeconds % seconds === 0);
  const count = ttlSeconds / seconds, label = count + ' ' + unit + (count === 1 ? '' : 's');
  $('chat-retention').textContent = ttlSeconds ? 'messages auto-delete ' + label + ' after sending' : 'auto-delete is off';
  const select = $('chat-expiry');
  if (![...select.options].some(option => Number(option.value) === ttlSeconds)) {
   const option = document.createElement('option'); option.value = String(ttlSeconds); option.textContent = label; select.append(option);
  }
  select.value = String(ttlSeconds);
 }
 function finishedModeration() { clearTimeout(moderationTimer); moderating = false; controls(); }
 function moderate(data) {
  if (!ready || (!owner&&!(moderator&&['delete-message','clear-chat'].includes(data.type))) || moderating || socket?.readyState !== WebSocket.OPEN) return;
  moderating = true; error(); controls();
  try {
   send(data);
   moderationTimer = setTimeout(() => { finishedModeration(); error('Chat update was not confirmed. Reconnect and check before retrying.'); }, 10000);
  } catch { finishedModeration(); error('Could not update chat. Reconnect and try again.'); }
 }
 function connect() {
  if (!started || suspended || socket && socket.readyState < WebSocket.CLOSING) return;
  clearTimeout(reconnect);
  socket = new WebSocket('wss://asteria-chat.realdashvr.workers.dev/connect');
  const connection = socket;
  controls();
  socket.onopen = () => { retry = 0; registered = false; try { const saved = localStorage.getItem('asteria-browser-token'); if (saved && /^[a-zA-Z0-9-]{64,128}$/.test(saved)) browserToken = saved; } catch {} send({ type: 'hello' }); controls(); };
  socket.onmessage = event => {
   try {
    const data = JSON.parse(event.data);
    if (data.type === 'registration-required') { registered = false; send({ type: 'hello' }); return; }
    if (data.type === 'ban-state') {
     const first = !registered; registered = true; banned = data.chatBanned || data.siteBanned;
     window.dispatchEvent(new CustomEvent('velx-ban-state', { detail: data }));
     if (banned) { pending = ''; messages.clear(); render(); }
     if (first && !banned && name.value.trim() && (name.value.trim().toLowerCase() !== 'velx' || $('chat-password').value)) setName();
     controls();
    }
    if (data.type === 'visitors' || data.type === 'ban-updated') window.dispatchEvent(new CustomEvent('velx-ban-response', { detail: data }));
    if (data.type === 'history') {
     window.dispatchEvent(new CustomEvent('velx-announcements', { detail: data.announcements || [] }));
     messages.clear(); for (const message of data.messages) messages.set(message.id, message);
     if(data.chatState)updateChatState(data.chatState);
     ttlSeconds = data.ttlSeconds || 0;
     if (Number.isFinite(data.serverTime)) clockOffset = data.serverTime - Date.now();
     finishedModeration(); retention(); expireMessages(); render(); controls();
    }
    if (data.type === 'named') { ownId = typeof data.id === 'string' ? data.id : ''; ready = true; owner = data.owner === true;moderator=data.moderator===true;imagePerms=data.imagePerms===true; name.value = data.name; error(); render(); controls(); }
    if(data.type==='permissions'){moderator=data.moderator===true;imagePerms=data.imagePerms===true;if(!owner&&!imagePerms)clearImage();render();controls();}
    if(data.type==='presence'){people.clear();for(const person of data.users||[])people.set(person.id,person);renderMembers();}
    if(data.type==='chat-state'){updateChatState(data.state);finishedModeration();render();}
    if(data.type==='message-updated'){if(messages.has(data.message.id)){messages.set(data.message.id,data.message);render();}}
    if (data.type === 'announcement') window.dispatchEvent(new CustomEvent('velx-announcements', { detail: data.announcement ? [data.announcement] : [] }));
    if (data.type === 'announcement-sent' || data.type === 'announcement-cleared') window.dispatchEvent(new CustomEvent('velx-announcement-sent', { detail: data.type }));
    if (data.type === 'message') {
     if (sameBrowser(data.message)) rememberSent(data.message);
     if (!messages.has(data.message.id) && data.message.authorId !== ownId) window.dispatchEvent(new CustomEvent('velx-chat-notification', { detail: data.message }));
     messages.set(data.message.id, data.message);
     while (messages.size > 100) messages.delete(messages.keys().next().value);
     if (sameBrowser(data.message) && pending) { pending = ''; input.value = '';selectedMentions.clear();setReply(null);clearImage();mentionMenu.hidden=true; error(); }
     render(); controls();
    }
    if (data.type === 'error') {
     window.dispatchEvent(new CustomEvent('velx-ban-error', { detail: data.error }));
     window.dispatchEvent(new CustomEvent('velx-announcement-error', { detail: data.error })); pending = ''; finishedModeration(); retention(); error(data.error); controls(); }
   } catch { error('Could not read a chat update.'); }
  };
  socket.onclose = () => {
   if (socket !== connection) return;
   registered = false; ready = false; owner = false;moderator=false;imagePerms=false;people.clear();renderMembers(); finishedModeration(); render();
   if (pending) { pending = ''; error('Connection lost. Your message is still in the box.'); }
   controls();
   if (!suspended) { reconnect = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++)); }
  };
  socket.onerror = () => error('Could not connect. Retrying…');
 }
 function setName() {
  const value = name.value.trim();
  if (!rules.validName(value)) { error('choose a different name; profanity, slurs and disguised spellings are not allowed'); return; }
  try { localStorage.setItem('asteria-chat-name', value); } catch {}
  if (registered && !banned && socket?.readyState === WebSocket.OPEN) { ready = false; owner = false; render(); send({ type: 'name', name: value, password: value.toLowerCase() === 'velx' ? $('chat-password').value : undefined }); controls(); }
  else connect();
 }
 $('chat-name-form').addEventListener('submit', event => { event.preventDefault(); setName(); });
 $('chat-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!ready || banned || !chatState.enabled || pending || preparingImage || (!input.value.trim()&&!pendingImage)) return;
  if(rules.disallowed(input.value)){error('message blocked: profanity, slurs and disguised spellings are not allowed');return;}
  if (Date.now() - sentAt < 1500) { error('Wait a moment before sending again.'); return; }
  const text=input.value.trim();pending = text||'[image]'; sentAt = Date.now();
  try { send({ type: 'message', text,replyTo,mentions:messageMentions(text),...(pendingImage?{image:pendingImage}:{}) }); controls(); }
  catch { pending = ''; error('Message not sent. Reconnect and try again.'); controls(); }
 });
 input.addEventListener('input', controls);
 input.addEventListener('input',updateMentions);
 input.addEventListener('keydown', event => {
  if(event.key==='Escape'){mentionMenu.hidden=true;return;}
  if(event.key==='ArrowDown'&&!mentionMenu.hidden){event.preventDefault();mentionMenu.querySelector('button')?.focus();return;}
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); $('chat-form').requestSubmit(); }
 });
 $('chat-clear').addEventListener('click', () => { if ((owner||moderator) && ready && confirm('delete all messages in public chat? this cannot be undone.')) moderate({ type: 'clear-chat' }); });
 $('chat-expiry').addEventListener('change', () => moderate({ type: 'set-expiry', seconds: Number($('chat-expiry').value) }));
 setInterval(() => { if (visible) expireMessages(); }, 1000);
 window.addEventListener('velx-chat-open', () => { visible = true; expireMessages(); connect(); });
 window.addEventListener('velx-chat-close', () => { visible = false; });
 window.addEventListener('online', connect);
 window.addEventListener('pageshow', () => { suspended = false; connect(); });
 window.addEventListener('velx-send-announcement', event => {
  if (!ready || !owner || socket?.readyState !== WebSocket.OPEN) { window.dispatchEvent(new CustomEvent('velx-announcement-error', { detail: 'Sign in as owner to send announcements.' })); return; }
  try { send({ type: 'announcement', title: event.detail.title, body: event.detail.body }); }
  catch { window.dispatchEvent(new CustomEvent('velx-announcement-error', { detail: 'Connection lost. Reconnect before sending.' })); }
 });
 window.addEventListener('velx-clear-announcement', () => {
  if (!ready || !owner || !registered || socket?.readyState !== WebSocket.OPEN) { window.dispatchEvent(new CustomEvent('velx-announcement-error', { detail: 'Sign in as owner first.' })); return; }
  try { send({ type: 'clear-announcement' }); }
  catch { window.dispatchEvent(new CustomEvent('velx-announcement-error', { detail: 'Connection lost. Reconnect before clearing.' })); }
 });
 window.addEventListener('velx-ban-command', event => {
  if (!ready || !owner || !registered || socket?.readyState !== WebSocket.OPEN) { window.dispatchEvent(new CustomEvent('velx-ban-error', { detail: 'Sign in as owner first.' })); return; }
  try { send(event.detail); }
  catch { window.dispatchEvent(new CustomEvent('velx-ban-error', { detail: 'Connection lost. Reconnect and refresh.' })); }
 });
 window.addEventListener('pagehide', () => { suspended = true; visible = false; clearTimeout(reconnect); socket?.close(1000); });
 render(); controls();
 Promise.resolve(window.startupReady).then(ok => { if (ok !== false) { started = true; connect(); } });
})();
