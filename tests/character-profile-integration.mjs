// Charakterprofil (page 2 of the sheet) against an isolated local instance with a running evening (scripts/test-local.mjs --ge-01):
// owner saves, other player and anonymous cannot, the SL sees the full profile, other players only shared blocks.
// Run: CVK_TEST_URL=http://127.0.0.1:<port> node --experimental-strip-types tests/character-profile-integration.mjs
import assert from 'node:assert/strict';

const base=process.env.CVK_TEST_URL||'';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
let checks=0;const check=(ok,msg)=>{assert.ok(ok,msg);checks++;console.log('PASS PROFILE '+msg);};
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
async function req(cookie,path,method='GET',body){const r=await fetch(base+path,{method,headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();let data=null;try{data=JSON.parse(text);}catch{/* not JSON */}return {status:r.status,data,text};}

const gm=await login('command-gm'),a=await login('command-a'),b=await login('command-b');
const selected=(await req(a,'/api/character-selection')).data?.characterId;
const own=(await req(a,'/api/records?kind=charaktere')).data.records.find(r=>r.owner_id==='command-a'&&(!selected||r.id===selected));
assert.ok(own,'Player A owns a synthetic character');
const detail=async who=>(await req(who,'/api/character-detail?id='+encodeURIComponent(own.id)+(who===gm?'&view=sl':''))).data;
const marker='PROFILE_'+Date.now();
const profile={description:{age:'34',apparentAge:'',deathDate:'',gender:'',origin:'',nationality:'',hair:'schwarz',eyes:'',height:'',weight:'',appearance:marker+' sichtbar'},allies:marker+' geheim',visibility:{description:'group',story:'private',drive:'private',allies:'private'}};

let d=await detail(a);
check(d.roleplay.profile&&d.roleplay.profile.visibility.allies==='private','the owner reads an empty, private profile');
const saved=await req(a,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:d.revision.version,profile});
check(saved.status===200,'the owner saves the profile');
d=await detail(a);
check(d.roleplay.profile.description.appearance===marker+' sichtbar'&&d.roleplay.profile.allies===marker+' geheim','the profile is stored and read back');
check((await req(a,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:1,profile})).status===409,'a stale version is refused');
check((await req(a,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:d.revision.version,profile:{...profile,extra:1}})).status===400,'unknown fields are refused');

check((await req(b,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:d.revision.version,profile})).status>=400,'Player B cannot change Player A\'s profile');
check((await req(null,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:d.revision.version,profile})).status===401,'not signed in: save → 401');
const storyShared={...profile,visibility:{...profile.visibility,story:'group'}};
// One save writes the whole page: appearance card, story and play guide together with the profile.
const before=await detail(a),oldCard=(await req(a,'/api/character-companion?id='+encodeURIComponent(own.id))).data.presentation;
const together=await req(a,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:before.revision.version,profile:storyShared,presentation:{published:false,tagline:marker+' Zeile',introduction:'',gallery:[]},backgroundStory:'cvk-html-v1:<p>'+marker+' Geschichte</p>',playGuide:marker+' Spielweise'});
check(together.status===200,'one save stores profile, appearance card, story and play guide');
const after=await detail(a),card=(await req(a,'/api/character-companion?id='+encodeURIComponent(own.id))).data.presentation;
check(String(after.roleplay.backgroundStory).includes(marker+' Geschichte')&&after.roleplay.playGuide===marker+' Spielweise'&&card.tagline===marker+' Zeile','the combined save reads back');
check((await req(a,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:after.revision.version,profile,presentation:{published:false,tagline:'x',introduction:'',gallery:[{fileId:'fremd',caption:''}]}})).status>=400,'a gallery with a foreign file is refused');
check((await req(b,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:after.revision.version,profile,backgroundStory:'b'})).status>=400,'Player B cannot overwrite the story through the profile save');
// The introduction is formatted text now: 1200 visible characters, formatting does not count.
const rich=t=>'cvk-rich-v1:'+JSON.stringify({version:1,blocks:[{type:'paragraph',children:[{text:t,bold:true,color:'#3fa7ff'}]}]});
check((await req(a,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:after.revision.version,profile:storyShared,presentation:{published:false,tagline:'',introduction:rich('x'.repeat(1300)),gallery:[]}})).status===400,'an introduction over 1200 visible characters is refused');
const introSaved=await req(a,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:after.revision.version,profile:storyShared,presentation:{published:false,tagline:marker+' Zeile',introduction:rich(marker+' Vorstellung '+'y'.repeat(1100)),gallery:[]}});
check(introSaved.status===200&&String((await req(a,'/api/character-companion?id='+encodeURIComponent(own.id))).data.presentation.introduction).includes(marker+' Vorstellung'),'a formatted introduction within 1200 visible characters is stored');
// One image list: portrait and references with caption and sharing per image, saved with the profile.
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1cAAAAASUVORK5CYII=','base64');
async function upload(who,name){const form=new FormData();form.set('file',new Blob([png],{type:'image/png'}),name);form.set('visibility','private');const r=await fetch(base+'/api/files',{method:'POST',headers:{Origin:base,Cookie:who},body:form});assert.equal(r.status,200,'upload '+name);return (await r.json()).id;}
const uploads=[await upload(a,'SYNTHETIC_PROFILE_PORTRAIT.png'),await upload(a,'SYNTHETIC_PROFILE_REFERENCE.png')],foreign=await upload(b,'SYNTHETIC_PROFILE_FOREIGN.png');
const oldMedia=(await detail(a)).companion?.media??[];
let v=(await detail(a)).revision.version;
check((await req(a,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:v,profile:storyShared,media:[{fileId:foreign,type:'reference',caption:'',shared:true}]})).status>=400,'an image of another player cannot be linked');
check((await req(a,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:v,profile:storyShared,media:[{fileId:uploads[0],type:'portrait',caption:'',shared:true},{fileId:uploads[1],type:'portrait',caption:'',shared:true}]})).status===400,'only one portrait is accepted');
check((await req(a,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:v,profile:storyShared,media:[{fileId:uploads[0],type:'portrait',caption:marker+' Bild',shared:true},{fileId:uploads[1],type:'reference',caption:'',shared:false}]})).status===200,'portrait and reference are saved with the profile');
const withImages=await detail(a);
check(withImages.companion.media.some(m=>m.id===uploads[0]&&m.type==='portrait'&&m.caption===marker+' Bild'&&m.shared===true)&&withImages.identity.portraitRef==='/api/files?id='+uploads[0],'the image list reads back and the portrait becomes the character image');
// Galerie (4c): the campaign gallery lists only shared images and serves only those.
const gallery=await req(b,'/api/character-gallery');
const mine=gallery.data?.characters?.find(c=>c.id===own.id);
check(gallery.status===200&&!!mine&&mine.images.some(i=>i.url.includes(uploads[0]))&&!gallery.text.includes(uploads[1]),'Player B sees the shared images of Player A in the gallery, not the private one');
check((await req(b,'/api/character-gallery?characterId='+encodeURIComponent(own.id)+'&fileId='+uploads[0])).status===200,'Player B loads a shared gallery image');
check((await req(b,'/api/character-gallery?characterId='+encodeURIComponent(own.id)+'&fileId='+uploads[1])).status===404,'Player B cannot load a private image through the gallery');
check((await req(b,'/api/character-gallery?characterId='+encodeURIComponent(own.id)+'&fileId='+foreign)).status===404,'a file that is not in the character list is refused');
check((await req(null,'/api/character-gallery')).status===401,'not signed in: gallery → 401');
// Second way in from the gallery page: the picture joins the same image list, shared with the group.
const galleryUpload=await upload(a,'SYNTHETIC_PROFILE_GALLERY.png');
let gv=(await detail(a)).revision.version;
check((await req(b,'/api/character-companion','PATCH',{action:'media',id:own.id,version:gv,fileId:galleryUpload,mediaType:'reference',shared:true})).status>=400,'Player B cannot add a picture to Player A\'s character');
check((await req(a,'/api/character-companion','PATCH',{action:'media',id:own.id,version:gv,fileId:galleryUpload,mediaType:'reference',shared:true})).status===200,'the owner adds a picture from the gallery');
const afterAdd=await detail(a);
check(afterAdd.companion.media.some(m=>m.id===galleryUpload&&m.shared===true&&m.type==='reference'),'the gallery picture sits in the image list of the Charakterprofil, shared');
check((await req(b,'/api/character-gallery')).text.includes(galleryUpload),'Player B sees the added picture in the gallery');
uploads.push(galleryUpload);
const sl=await detail(gm);
check(sl.roleplay.profile.allies===marker+' geheim','the SL reads the full profile in its own projection');

const live=(await req(a,'/api/live-table?view=active')).data;
const sessionId=live?.room?.sessionId;
if(sessionId){
  const seen=await req(b,'/api/live-participants?sessionId='+encodeURIComponent(sessionId)+'&memberId=command-a&view=profile&characterId='+encodeURIComponent(own.id));
  if(seen.status===200){
    check(seen.text.includes(marker+' sichtbar'),'Player B sees the block Player A shared with the group');
    check(!seen.text.includes(marker+' geheim'),'Player B does not see the private block');
    check(seen.text.includes(marker+' Geschichte')&&!seen.text.includes(marker+' Spielweise'),'Player B sees the shared story, not the private play guide');
    const fig=id=>req(b,'/api/live-participants?'+new URLSearchParams({view:'figure-image',sessionId,memberId:'command-a',characterId:own.id,fileId:id}));
    check(seen.data.character.portrait?.includes(uploads[0])&&(await fig(uploads[0])).status===200,'Player B sees the shared portrait');
    check((await fig(uploads[1])).status===404&&!seen.text.includes(uploads[1]),'Player B cannot load the private reference image');
  }else console.log('SKIP PROFILE table view not reachable for Player B: '+seen.status);
}else console.log('SKIP PROFILE no running evening on this instance');
check((await req(null,'/api/live-participants?sessionId=x&memberId=command-a&view=profile')).status===401,'not signed in: table profile → 401');

// Restore an empty profile so the instance stays as it was.
const latest=await detail(a);
const empty={description:Object.fromEntries(Object.keys(profile.description).map(k=>[k,''])),allies:'',visibility:{description:'private',story:'private',drive:'private',allies:'private'}};
check((await req(a,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:latest.revision.version,profile:empty,presentation:oldCard??{published:false,tagline:'',introduction:'',gallery:[]},backgroundStory:String(before.roleplay.backgroundStory||''),playGuide:String(before.roleplay.playGuide||''),media:oldMedia.map(m=>({fileId:m.id,type:m.type,caption:m.caption??'',shared:m.shared===true}))})).status===200,'the synthetic profile, card and texts are restored');
const removed=[];for(const [who,fileId] of [[a,uploads[0]],[a,uploads[1]],[a,uploads[2]],[b,foreign]])removed.push((await req(who,'/api/files','DELETE',{id:fileId})).status);
check(removed.every(s=>s===200),'the synthetic images are deleted again');
console.log('PROFILE checks passed: '+checks);
