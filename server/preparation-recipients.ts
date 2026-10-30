import type {Actor} from '@/domain/types';
import {gmOnly,canRead} from './access';
import {activeCharacterBody} from '@/domain/character-selection';

import type {PreparationRecipient} from '@/domain/personal-message';
/** Read the saved campaign selection. Never guess a character or change a preference. */
export async function preparationRecipients(db:D1Database,a:Actor):Promise<PreparationRecipient[]> {
  gmOnly(a);
  const rows=await db.prepare(`SELECT m.id,m.name,c.role,r.id AS character_id,r.title AS character_name,r.body,e.canon_status
    FROM members m JOIN campaign_memberships c ON c.user_id=m.id
    LEFT JOIN auth_member_links l ON l.member_id=m.id
    LEFT JOIN auth_users u ON u.id=l.auth_user_id AND u.status='active'
    LEFT JOIN auth_profiles p ON p.user_id=u.id
    LEFT JOIN records r ON r.id=json_extract(CASE WHEN json_valid(p.preferences) THEN p.preferences ELSE '{}' END,?)
      AND r.campaign_id=c.campaign_id AND r.owner_id=m.id AND r.kind='charaktere'
    LEFT JOIN entities e ON e.id=r.id AND e.campaign_id=r.campaign_id AND e.type='CHARACTER'
    WHERE c.campaign_id=? AND c.status='active' AND c.role='player' AND m.status='active'
    ORDER BY m.name,m.id`).bind('$.activeCharacters.'+JSON.stringify(a.campaignId),a.campaignId)
    .all<{id:string;name:string;role:string;character_id:string|null;character_name:string|null;body:string|null;canon_status:string|null}>();
  return Promise.all(rows.results.map(async row=>{
    const base={id:row.id,name:row.name,role:row.role,character:null};
    if(!row.character_id||!row.body||!row.canon_status||row.canon_status==='GM_SECRET')return base;
    let body;try{body=JSON.parse(row.body);}catch{return base;}
    if(!body||typeof body!=='object'||Array.isArray(body)||!activeCharacterBody(body))return base;
    let portrait:string|null=null;const image=body.image;
    if(typeof image==='string'&&/^\/images\/[a-zA-Z0-9_.-]+$/.test(image))portrait=image;
    if(typeof image==='string'&&/^\/api\/files\?id=[a-zA-Z0-9_-]+$/.test(image)) {
      const file=await db.prepare('SELECT owner_id,visibility,mime FROM files WHERE id=? AND campaign_id=?').bind(image.split('=')[1],a.campaignId).first<{owner_id:string;visibility:string;mime:string}>();
      if(file&&file.mime.startsWith('image/')&&canRead(a,file))portrait=image;
    }
    return {...base,character:{id:row.character_id,name:row.character_name||'Unbenannter Charakter',portrait}};
  }));
}
