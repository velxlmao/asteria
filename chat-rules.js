globalThis.AsteriaChatRules = (() => {
 const emojis = ['👍','👎','❤️','😂','😭','🔥','🎉','👀','💀','🙏','🥀','✌️','✅','❌','🤔','😮','😢','😡','🥳','😎','😊','😍','🤝','💯','⭐','💜','🫡','🗿','🤯','😴','🚀','🍿'];
 const substitutions = { '0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','8':'b','9':'g','@':'a','$':'s','!':'i','|':'i','а':'a','ɑ':'a','α':'a','е':'e','ε':'e','і':'i','ι':'i','ı':'i','о':'o','ο':'o','р':'p','ρ':'p','с':'c','ϲ':'c','ѕ':'s','т':'t','τ':'t','х':'x','χ':'x','у':'y','ν':'v','к':'k','κ':'k','м':'m','η':'n' };
 function normalized(value) { return String(value).normalize('NFKD').toLowerCase().replace(/[\p{M}\p{Cf}]/gu,'').replace(/[01345789@$!|аɑαеεіιıоοрρсϲѕтτхχуνкκмη]/gu, value => substitutions[value]); }
 function collapsed(value) { return value.replace(/(.)\1+/g,'$1'); }
 const blocked = new Set(('fuck fucks fucking fucked fucker fuckers fck fuk shit shits shitty bullshit sht bitch bitches bastard bastards asshole assholes ass cunt cunts dick dicks pussy pussies whore whores slut sluts damn wtf stfu nigger nigga niggers niggas nigguh niger faggot faggots fag fags faget kike kikes chink chinks spic spics tranny trannies retard retarded').split(' ').map(collapsed));
 const allowed=new Set(['scunthorpe','niger','nigeria','nigerian','nigerians','shiitake','dickens','dickinson','dickson','pussycat']);
 const severe=['fuck','shit','bitch','cunt','asshole','nigger','nigga','faggot','tranny'].map(collapsed);
 function disallowed(value) {
  const text = normalized(value);
  const chunks = text.split(/\s+/).map(value => value.replace(/[^a-z]/g,'')).filter(Boolean);
  if (chunks.some(value => !allowed.has(value)&&(blocked.has(collapsed(value))||severe.some(word=>collapsed(value).includes(word))))) return true;
  for (let i=0;i<chunks.length;i++) {
   let joined='';
   for (let j=i;j<Math.min(i+8,chunks.length)&&chunks[j].length<=3;j++) { joined+=chunks[j]; if(j>i&&blocked.has(collapsed(joined))) return true; }
  }
  return /\b(?:f[\W_]*[u*][\W_]*[c*][\W_]*k|sh[\W_]*[i*][\W_]*t|n[\W_]*[i*][\W_]*g[\W_]*g[\W_]*[ae*][\W_]*[r*]?)\b/i.test(text);
 }
 function nameKey(value) { return normalized(value).replace(/[^a-z]/g,''); }
 function validName(value) { return typeof value==='string'&&value.trim().length>0&&value.trim().length<=24&&!/[\p{Cc}\p{Cf}]/u.test(value)&&!disallowed(value)&&nameKey(value)!=='lukedixon'; }
 return { emojis, normalized, disallowed, nameKey, validName };
})();
