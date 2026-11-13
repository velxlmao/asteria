import '../chat-rules.js';
const rules = globalThis.AsteriaChatRules;
const tokenPattern = /^[a-zA-Z0-9-]{64,128}$/;
const idPattern = /^[a-zA-Z0-9-]{8,128}$/;
export function imageData(value) {
 if(typeof value!=='string'||value.length>540000||!/^[A-Za-z0-9+/]+=*$/.test(value))throw Error('invalid image');
 const bytes=Uint8Array.from(atob(value),character=>character.charCodeAt(0));
 if(bytes.length>400000||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw Error('invalid image');
 let position=2;
 while(position+8<bytes.length){
  if(bytes[position++]!==255)throw Error('invalid image');while(bytes[position]===255)position++;
  const marker=bytes[position++];if(marker===218||marker===217)break;
  const length=(bytes[position]<<8)|bytes[position+1];if(length<2||position+length>bytes.length)throw Error('invalid image');
  if([192,193,194].includes(marker)){const height=(bytes[position+3]<<8)|bytes[position+4],width=(bytes[position+5]<<8)|bytes[position+6];if(!width||!height||width>1280||height>1280)throw Error('image dimensions too large');return {bytes,width,height};}
  position+=length;
 }
 throw Error('invalid image');
}
const hash = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(value=>value.toString(16).padStart(2,'0')).join('');
async function ownerPassword(value, secret) {
 if(typeof value!=='string'||value.length>128||!secret) return false;
 const [a,b]=await Promise.all([hash(value),hash(secret)]);
 let difference=0; for(let i=0;i<a.length;i++) difference|=a.charCodeAt(i)^b.charCodeAt(i);
 return difference===0;
}
async function legacyIdentity(token,name,password) {
 const response=await fetch('https://velocify-public-chat.realdashvr.workers.dev/connect',{headers:{Upgrade:'websocket',Origin:'https://githubraw.com'}});
 const socket=response.webSocket;if(!socket)throw Error('browser registration unavailable');socket.accept();
 return new Promise((resolve,reject)=>{
  let done=false;const finish=(value,error)=>{if(done)return;done=true;clearTimeout(timer);try{socket.close(1000);}catch{}if(error)reject(error);else resolve(value);};
  const timer=setTimeout(()=>finish(null,Error('browser registration timed out')),5000);
  socket.addEventListener('message',event=>{try{const data=JSON.parse(event.data);if(data.type==='ban-state'){if(!name||data.chatBanned||data.siteBanned)finish(data);else socket.send(JSON.stringify({type:'name',token,name,password}));}if(data.type==='named'&&idPattern.test(data.id))finish(data);if(data.type==='error')finish({});}catch{finish(null,Error('invalid registration response'));}});
  socket.addEventListener('error',()=>finish(null,Error('browser registration failed')));socket.addEventListener('close',()=>finish(null,Error('browser registration closed')));
  socket.send(JSON.stringify({type:'hello',token}));
 });
}
export default { async fetch(request,env) {
 if(/^\/images\/[a-f0-9-]{36}$/i.test(new URL(request.url).pathname)&&request.method==='GET')return env.ROOM.get(env.ROOM.idFromName('public')).fetch(request);
 if(new URL(request.url).pathname!=='/connect') return new Response('asteria chat',{headers:{'content-type':'text/plain'}});
 const origin=request.headers.get('origin')||'';
 if(!['https://githubraw.com','https://cdn.jsdelivr.net','https://fastly.jsdelivr.net'].includes(origin)&&!/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin))return new Response('origin not allowed',{status:403});
 if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket') return new Response('websocket required',{status:426});
 if(!(await env.CONNECT_LIMIT.limit({key:request.headers.get('cf-connecting-ip')||'unknown'})).success) return new Response('try again shortly',{status:429});
 return env.ROOM.get(env.ROOM.idFromName('public')).fetch(request);
} };
export class ChatRoom {
 constructor(state,env) { this.state=state;this.env=env;this.storage=state.storage;this.queue=Promise.resolve(); }
 async fetch(request) {
  const image=new URL(request.url).pathname.match(/^\/images\/([a-f0-9-]{36})$/i);
  if(image){const meta=await this.storage.get('image-meta:'+image[1]);if(!meta)return new Response('image not found',{status:404});const chunks=[];for(let i=0;i<meta.count;i++){const bytes=await this.storage.get('image:'+image[1]+':'+i);if(!bytes)return new Response('image not found',{status:404});chunks.push(bytes);}return new Response(new Blob(chunks,{type:'image/jpeg'}),{headers:{'content-type':'image/jpeg','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox",'cache-control':'no-store','cross-origin-resource-policy':'cross-origin'}});}
  const pair=new WebSocketPair();this.state.acceptWebSocket(pair[1]);pair[1].serializeAttachment({ip:request.headers.get('cf-connecting-ip')||'unknown'});
  pair[1].send(JSON.stringify({type:'registration-required'}));
  return new Response(null,{status:101,webSocket:pair[0]});
 }
 send(socket,data) { try{socket.send(JSON.stringify(data));}catch{} }
 broadcast(data) { for(const socket of this.state.getWebSockets()){const user=socket.deserializeAttachment();if(user?.id&&!user.banned)this.send(socket,data);} }
 async room() { return await this.storage.get('settings')||{enabled:true,ttlSeconds:0,pauseId:'',reactions:{},announcement:null}; }
 async visitor(id) { return await this.storage.get('visitor:'+id); }
 async history(settings) {
  const rows=await this.storage.list({prefix:'message:',reverse:true,limit:100});
  return [...rows.values()].reverse().filter(message=>!settings.ttlSeconds||message.time+settings.ttlSeconds*1000>Date.now());
 }
 async snapshot(socket) {
  if(socket.deserializeAttachment()?.banned)return;
  const settings=await this.room();
  this.send(socket,{type:'history',messages:await this.history(settings),ttlSeconds:settings.ttlSeconds,serverTime:Date.now(),announcements:settings.announcement&&settings.announcement.expiresAt>Date.now()?[settings.announcement]:[],chatState:this.publicState(settings)});
 }
 publicState(settings) { return {enabled:settings.enabled,id:settings.pauseId,reactions:settings.reactions}; }
 async presence() {
  const active=new Map();for(const socket of this.state.getWebSockets()){const user=socket.deserializeAttachment();if(user?.ready&&!user.banned)active.set(user.id,user);}
  const visitors=await this.storage.list({prefix:'visitor:',limit:2000});const users=[];
  for(const visitor of visitors.values())if(rules.validName(visitor.name)&&!visitor.chatBanned&&!visitor.siteBanned)users.push({id:visitor.id,name:visitor.name,owner:active.get(visitor.id)?.owner===true,moderator:!!visitor.moderator,imagePerms:!!visitor.imagePerms,online:active.has(visitor.id)});
  this.broadcast({type:'presence',users});
 }
 webSocketMessage(socket,raw) {
  this.queue=this.queue.then(()=>this.handle(socket,raw)).catch(()=>{this.send(socket,{type:'error',error:'could not complete chat update'});if(!socket.deserializeAttachment()?.id)try{socket.close(1013,'registration unavailable');}catch{}});
  return this.queue;
 }
 webSocketClose(socket) { try{socket.serializeAttachment({...socket.deserializeAttachment(),ready:false});socket.close();}catch{} return this.presence(); }
 webSocketError(socket) { this.webSocketClose(socket); }
 async handle(socket,raw) {
  const fail=error=>this.send(socket,{type:'error',error});
  const attached=socket.deserializeAttachment();
  if(typeof raw!=='string'||raw.length>(attached?.owner?1500000:attached?.imagePerms?600000:12000)) return fail('invalid chat request');
  let data;try{data=JSON.parse(raw);}catch{return fail('invalid chat request');}
  if(!data||!tokenPattern.test(data.token||'')) return fail('invalid browser identity');
  const browserHash=await hash(data.token);let id=await this.storage.get('identity:'+browserHash);let user=socket.deserializeAttachment()||{};
  if(!id){if(data.type!=='hello')return this.send(socket,{type:'registration-required'});const identity=await legacyIdentity(data.token);id=browserHash;await this.storage.put('identity:'+browserHash,id);if(!await this.visitor(id))await this.storage.put('visitor:'+id,{id,name:'',names:[],firstSeen:Date.now(),lastSeen:Date.now(),chatBanned:identity.chatBanned===true,siteBanned:identity.siteBanned===true,legacyBlocked:identity.chatBanned||identity.siteBanned,isOwner:false});}
  if(user.id&&user.id!==id) return fail('browser identity changed; reconnect');
  if(data.type==='hello') {
   let visitor=await this.visitor(id)||{id,name:'',names:[],firstSeen:Date.now(),chatBanned:false,siteBanned:false,isOwner:false};
   visitor.lastSeen=Date.now();await this.storage.put('visitor:'+id,visitor);
   socket.serializeAttachment({...user,id,banned:visitor.chatBanned||visitor.siteBanned});this.send(socket,{type:'ban-state',id,chatBanned:visitor.chatBanned,siteBanned:visitor.siteBanned});
   await this.snapshot(socket);await this.presence();return;
  }
  if(!user.id) return this.send(socket,{type:'registration-required'});
  let visitor=await this.visitor(id);if(!visitor) return this.send(socket,{type:'registration-required'});
  if(visitor.siteBanned||visitor.chatBanned) return fail('this browser is banned from chat');
  if(data.type==='name') {
   if(Date.now()-(visitor.nameAttempt||0)<2000) return fail('wait a moment before setting your name again');
   visitor.nameAttempt=Date.now();await this.storage.put('visitor:'+id,visitor);
   const name=typeof data.name==='string'?data.name.trim():'';
   if(!rules.validName(name)) return fail('choose a different name; profanity, slurs and disguised spellings are not allowed');
   const reserved=rules.nameKey(name)==='velx';
   if(reserved&&name.toLowerCase()!=='velx') return fail('that name is reserved');
   if(reserved) {
    if(!(await this.env.AUTH_LIMIT.limit({key:user.ip||'unknown'})).success)return fail('too many owner login attempts; try again in a minute');
    if(Date.now()-(visitor.ownerAttempt||0)<10000) return fail('wait before retrying owner login');
    visitor.ownerAttempt=Date.now();await this.storage.put('visitor:'+id,visitor);
    if(!await ownerPassword(data.password,this.env.OWNER_PASSWORD)) return fail('incorrect owner password');
   }
   if(!visitor.legacyBlocked&&!await this.storage.get('legacy-mapped:'+browserHash)){
    const previous=await legacyIdentity(data.token,name,reserved?data.password:undefined);
    if(previous.chatBanned||previous.siteBanned){visitor.chatBanned=!!previous.chatBanned;visitor.siteBanned=!!previous.siteBanned;await this.storage.put('visitor:'+id,visitor);socket.serializeAttachment({...user,banned:true});return this.send(socket,{type:'ban-state',chatBanned:visitor.chatBanned,siteBanned:visitor.siteBanned});}
    if(previous.id&&idPattern.test(previous.id)&&previous.id!==id){const existing=await this.visitor(previous.id);const oldId=id;id=previous.id;visitor={...visitor,...existing,id,moderator:!!visitor.moderator||!!existing?.moderator,imagePerms:!!visitor.imagePerms||!!existing?.imagePerms};await this.storage.put('identity:'+browserHash,id);await this.storage.delete('visitor:'+oldId);for(const client of this.state.getWebSockets()){const info=client.deserializeAttachment();if(info?.id===oldId)client.serializeAttachment({...info,id});}user={...user,id};}
    await this.storage.put('legacy-mapped:'+browserHash,true);
   }
   if(visitor.chatBanned||visitor.siteBanned)return fail('this browser is banned from chat');
   user={...user,id,ready:true,name,owner:reserved,banned:false,moderator:!!visitor.moderator,imagePerms:!!visitor.imagePerms};socket.serializeAttachment(user);
   visitor.name=name;visitor.names=[...new Set([...visitor.names,name])].slice(-40);visitor.isOwner=visitor.isOwner||reserved;
   await this.storage.put('visitor:'+id,visitor);this.send(socket,{type:'named',id,name,owner:reserved,moderator:user.moderator,imagePerms:user.imagePerms});await this.presence();return;
  }
  if(!user.ready) return fail('set your name first');
  const settings=await this.room();
  if(data.type==='message') {
   if(!settings.enabled) return fail('the owner has temporarily disabled asteria chat');
   const text=typeof data.text==='string'?data.text.trim():'';
   if((!text&&!data.image)||text.length>500||/[\p{Cc}]/u.test(text.replace(/[\n\t\r]/g,''))) return fail('messages must contain text or an image, with at most 500 characters');
   let upload;
   if(data.image){if(!user.owner&&!visitor.imagePerms)return fail('image permission required');try{upload=imageData(data.image);}catch{return fail('image must be a JPEG under 400kb and 1280px');}}
   if(rules.disallowed(text)) return fail('message blocked: profanity, slurs and disguised spellings are not allowed');
   if(Date.now()-(visitor.lastMessage||0)<1500) return fail('wait a moment before sending again');
   let reply=null;
   if(data.replyTo){const key=await this.storage.get('message-id:'+data.replyTo);const target=key&&await this.storage.get(key);if(!target||settings.ttlSeconds&&target.time+settings.ttlSeconds*1000<=Date.now())return fail('that reply target is no longer available');reply={id:target.id};}
   const mentions=[];
   for(const targetId of [...new Set(Array.isArray(data.mentions)?data.mentions:[])].slice(0,10)) {
    if(typeof targetId!=='string'||!idPattern.test(targetId))continue;
    const target=await this.visitor(targetId);if(target?.name&&rules.mentionsName(text,target.name))mentions.push({id:target.id,name:target.name});
   }
   const time=Math.max(Date.now(),Number(await this.storage.get('message-time')||0)+1);
   const message={id:crypto.randomUUID(),authorId:id,name:user.name,owner:user.owner,moderator:!!visitor.moderator,imagePerms:!!visitor.imagePerms,time,text,replyTo:reply,mentions,reactions:{}};
   const key='message:'+String(message.time).padStart(16,'0')+':'+message.id;
   visitor.lastMessage=message.time;
   const records={[key]:message,['message-id:'+message.id]:key,['visitor:'+id]:visitor,'message-time':time};
   if(upload){message.image={id:message.id,width:upload.width,height:upload.height};const count=Math.ceil(upload.bytes.length/64000);records['image-meta:'+message.id]={count};for(let i=0;i<count;i++)records['image:'+message.id+':'+i]=upload.bytes.slice(i*64000,(i+1)*64000);}
   await this.storage.put(records);
   const rows=await this.storage.list({prefix:'message:',reverse:true});for(const [oldKey,old]of [...rows].slice(100)){await this.deleteImage(old.id);await this.storage.delete([oldKey,'message-id:'+old.id]);}
   if(settings.ttlSeconds)await this.storage.setAlarm(Date.now()+1000);
   this.broadcast({type:'message',message});return;
  }
  if(data.type==='reaction') {
   if(!rules.emojis.includes(data.emoji))return fail('choose an available emoji');
   if(Date.now()-(visitor.lastReaction||0)<300)return fail('wait a moment before reacting again');
   visitor.lastReaction=Date.now();await this.storage.put('visitor:'+id,visitor);
   let message,key,reactions;
   if(data.id===settings.pauseId&&!settings.enabled) reactions=settings.reactions;
   else {if(!settings.enabled)return fail('chat is paused');key=await this.storage.get('message-id:'+data.id);message=key&&await this.storage.get(key);if(!message||settings.ttlSeconds&&message.time+settings.ttlSeconds*1000<=Date.now())return fail('message no longer available');reactions=message.reactions||{};}
   const members=new Set(reactions[data.emoji]||[]);if(members.has(id))members.delete(id);else{if(members.size>=100||Object.values(reactions).reduce((count,users)=>count+users.length,0)>=400)return fail('reaction limit reached');members.add(id);}
   if(members.size)reactions[data.emoji]=[...members];else delete reactions[data.emoji];
   if(message){message.reactions=reactions;await this.storage.put(key,message);this.broadcast({type:'message-updated',message});}
   else {settings.reactions=reactions;await this.storage.put('settings',settings);this.broadcast({type:'chat-state',state:this.publicState(settings)});}return;
  }
  if(!user.owner&&!(visitor.moderator&&['delete-message','clear-chat'].includes(data.type)))return fail('owner or moderator access required');
  if(data.type==='seed-room') {
   if(await this.storage.get('seeded'))return fail('migration already completed');
   if((await this.storage.list({prefix:'message:',limit:1})).size)return fail('cannot import over existing messages');
   if(!Array.isArray(data.messages)||data.messages.length>100||!Array.isArray(data.visitors)||data.visitors.length>2000)return fail('invalid migration');
   for(const message of data.messages){if(typeof message.id!=='string'||!idPattern.test(message.id)||!idPattern.test(message.authorId)||typeof message.text!=='string'||message.text.length>500||rules.disallowed(message.text)||!Number.isFinite(message.time))continue;
    const key='message:'+String(message.time).padStart(16,'0')+':'+message.id;await this.storage.put({[key]:{id:message.id,authorId:message.authorId,name:rules.validName(message.name)?message.name:'previous user',text:message.text,time:message.time,owner:message.owner===true,reactions:{},replyTo:null,mentions:[]},['message-id:'+message.id]:key});}
   for(const previous of data.visitors){if(!idPattern.test(previous.id))continue;const current=await this.visitor(previous.id);await this.storage.put('visitor:'+previous.id,{id:previous.id,firstSeen:previous.firstSeen,lastSeen:previous.lastSeen,...current,name:current?.name||previous.name||'',names:[...new Set([...(previous.names||[]),...(current?.names||[])])].filter(name=>typeof name==='string'&&name.length<=24).slice(-40),isOwner:previous.isOwner===true||current?.isOwner===true,chatBanned:previous.chatBanned===true||current?.chatBanned===true,siteBanned:previous.siteBanned===true||current?.siteBanned===true});}
   const announcement=data.announcement;if(announcement&&typeof announcement.id==='string'&&typeof announcement.title==='string'&&announcement.title.length<=100&&typeof announcement.body==='string'&&announcement.body.length<=2000&&Number.isFinite(announcement.expiresAt)&&announcement.expiresAt>Date.now())settings.announcement={id:announcement.id,title:announcement.title,body:announcement.body,expiresAt:announcement.expiresAt};
   if(data.ttlSeconds&&[60,300,900,1800,3600,86400,604800].includes(data.ttlSeconds))settings.ttlSeconds=data.ttlSeconds;
   await this.storage.put({'settings':settings,'seeded':true});if(settings.ttlSeconds)await this.alarm();this.send(socket,{type:'room-seeded'});return;
  }
  if(data.type==='set-chat-enabled') {
   if(typeof data.enabled!=='boolean')return fail('invalid chat state');
   if(settings.enabled!==data.enabled){settings.enabled=data.enabled;if(!data.enabled){settings.pauseId=crypto.randomUUID();settings.reactions={};}await this.storage.put('settings',settings);}
   this.broadcast({type:'chat-state',state:this.publicState(settings)});return;
  }
  if(data.type==='delete-message') {
   const key=typeof data.id==='string'&&await this.storage.get('message-id:'+data.id);if(key){await this.deleteImage(data.id);await this.storage.delete([key,'message-id:'+data.id]);}
   for(const target of this.state.getWebSockets())await this.snapshot(target);return;
  }
  if(data.type==='clear-chat') {
   const messages=await this.storage.list({prefix:'message:'});for(const message of messages.values())await this.deleteImage(message.id);
   for(const prefix of ['message:','message-id:']){const rows=await this.storage.list({prefix});await this.storage.delete([...rows.keys()]);}
   for(const target of this.state.getWebSockets())await this.snapshot(target);return;
  }
  if(data.type==='set-expiry') {
   if(![0,60,300,900,1800,3600,86400,604800].includes(data.seconds))return fail('invalid auto-delete timer');
   settings.ttlSeconds=data.seconds;await this.storage.put('settings',settings);await this.alarm();for(const target of this.state.getWebSockets())await this.snapshot(target);return;
  }
  if(data.type==='announcement'||data.type==='clear-announcement') {
   if(data.type==='announcement'){
    if(typeof data.title!=='string'||!data.title.trim()||data.title.length>100||typeof data.body!=='string'||!data.body.trim()||data.body.length>2000||rules.disallowed(data.title+' '+data.body))return fail('invalid announcement');
    settings.announcement={id:crypto.randomUUID(),title:data.title.trim(),body:data.body.trim(),createdAt:Date.now(),expiresAt:Date.now()+86400000};
   }else settings.announcement=null;
   await this.storage.put('settings',settings);this.broadcast({type:'announcement',announcement:settings.announcement});this.send(socket,{type:data.type==='announcement'?'announcement-sent':'announcement-cleared'});return;
  }
  if(data.type==='visitors'||data.type==='list-visitors') {
   const cursor=data.cursor;
   const query=typeof data.query==='string'?data.query.trim().slice(0,64).normalize('NFKC').toLowerCase():'';
   const found=[];let start=typeof cursor==='string'&&idPattern.test(cursor)?'visitor:'+cursor:null,next=null;
   while(found.length<50){const rows=await this.storage.list({prefix:'visitor:',limit:200,...(start?{startAfter:start}:{})});if(!rows.size)break;for(const [key,value]of rows){start=key;if(!query||[value.name,...value.names,value.id].join(' ').normalize('NFKC').toLowerCase().includes(query))found.push(value);if(found.length===50){next=value.id;break;}}if(found.length===50||rows.size<200)break;}
   this.send(socket,{type:'visitors',query,visitors:found.map(({ownerAttempt,nameAttempt,lastMessage,lastReaction,legacyBlocked,...value})=>value),next});return;
  }
  if(data.type==='set-permission') {
   if(!idPattern.test(data.id)||!['moderator','imagePerms'].includes(data.permission)||typeof data.enabled!=='boolean')return fail('invalid permission');
   const target=await this.visitor(data.id);if(!target)return fail('browser not found');if(target.isOwner)return fail('the owner already has full permissions');target[data.permission]=data.enabled;await this.storage.put('visitor:'+data.id,target);
   for(const client of this.state.getWebSockets()){const info=client.deserializeAttachment();if(info?.id===data.id){client.serializeAttachment({...info,moderator:!!target.moderator,imagePerms:!!target.imagePerms});this.send(client,{type:'permissions',moderator:!!target.moderator,imagePerms:!!target.imagePerms});}}
   const rows=await this.storage.list({prefix:'message:'});for(const [key,message]of rows)if(message.authorId===data.id){message.moderator=!!target.moderator;message.imagePerms=!!target.imagePerms;await this.storage.put(key,message);this.broadcast({type:'message-updated',message});}
   await this.presence();this.send(socket,{type:'ban-updated',visitor:target});return;
  }
  if(data.type==='set-ban') {
   if(typeof data.id!=='string'||!idPattern.test(data.id)||!['site','chat'].includes(data.scope)||typeof data.banned!=='boolean')return fail('invalid ban');
   const target=await this.visitor(data.id);if(!target)return fail('browser not found');if(target.isOwner)return fail('cannot ban the owner');
   target[data.scope+'Banned']=data.banned;await this.storage.put('visitor:'+data.id,target);
   for(const client of this.state.getWebSockets()){const info=client.deserializeAttachment();if(info?.id===data.id){client.serializeAttachment({...info,banned:target.chatBanned||target.siteBanned});this.send(client,{type:'ban-state',id:data.id,chatBanned:target.chatBanned,siteBanned:target.siteBanned});if(!target.chatBanned&&!target.siteBanned)await this.snapshot(client);}}
   await this.presence();this.send(socket,{type:'ban-updated',visitor:target});return;
  }
  return fail('unknown chat action');
 }
 async deleteImage(id) { const meta=await this.storage.get('image-meta:'+id);if(meta)await this.storage.delete(['image-meta:'+id,...Array.from({length:meta.count},(_,index)=>'image:'+id+':'+index)]); }
 async alarm() {
  const settings=await this.room();if(!settings.ttlSeconds)return;
  const rows=await this.storage.list({prefix:'message:'});let next=Infinity,changed=false;
  for(const [key,message]of rows){const expiry=message.time+settings.ttlSeconds*1000;if(expiry<=Date.now()){await this.deleteImage(message.id);await this.storage.delete([key,'message-id:'+message.id]);changed=true;}else next=Math.min(next,expiry);}
  if(Number.isFinite(next))await this.storage.setAlarm(next);
  if(changed)for(const socket of this.state.getWebSockets())await this.snapshot(socket);
 }
}
