import { actor, database, failure, HttpError, input, json, sameOrigin } from "@/server/access";
import { assertPlacement, inventoryCreateEnvelopeSchema, inventoryPatchSchema, inventoryProjection, itemBody, ownItem, selectCharacter, validateImage } from "@/server/inventory";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const a = await actor();
    const url = new URL(req.url);
    return json(await inventoryProjection(database(), a, url.searchParams.get("characterId"), url.searchParams.get("includeArchived") === "1"));
  } catch (error) {
    return failure(error, req);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    const parsed = inventoryCreateEnvelopeSchema.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);

    const { action, expectedCarryRevision, ...d } = parsed.data;
    if (action !== "create") throw new HttpError(400, "Unbekannte Inventory-Aktion.");

    const db = database();
    if (!(await selectCharacter(db, a, d.characterId)).selected) throw new HttpError(404, "Eigener aktiver Charakter nicht gefunden.");
    await validateImage(db, a, d.imageFileId, d.visibility);
    const before=await inventoryProjection(db,a,d.characterId,true);
    assertPlacement(before.carry,before.items,{...d,imageFileId:d.imageFileId||undefined,id:"new",location:d.status==="Gelagert"?"STORED":d.location??"BACKPACK",lifecycleStatus:"ACTIVE",revision:1,createdAt:"",updatedAt:"",canEdit:true});

    const id = `item.${crypto.randomUUID()}`;
    const relationshipId = `rel.${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const body = itemBody(d);
    const carryId=`carry.${d.characterId}`,defaultCarry=JSON.stringify({profile:"BODY_ONLY"});
    const results=await db.batch([
      db.prepare("INSERT OR IGNORE INTO records(id,campaign_id,owner_id,kind,visibility,title,body,gm_body,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(carryId,a.campaignId,a.id,"inventory_carry","private",d.characterId,defaultCarry,"",0,now,now),
      db.prepare("UPDATE records SET version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND owner_id=? AND kind='inventory_carry' AND version=?").bind(now,carryId,a.campaignId,a.id,expectedCarryRevision),
      db.prepare("INSERT INTO records(id,campaign_id,owner_id,kind,visibility,title,body,gm_body,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE id=? AND campaign_id=? AND owner_id=? AND version=? AND kind='inventory_carry')").bind(id,a.campaignId,a.id,"inventar",d.visibility,d.name,body,"",now,now,carryId,a.campaignId,a.id,expectedCarryRevision+1),
      db.prepare("UPDATE entities SET type='ITEM',canon_status='WORKING',visibility=?,title=?,content=?,version=1,updated_at=? WHERE id=? AND campaign_id=? AND EXISTS(SELECT 1 FROM records WHERE id=? AND campaign_id=? AND owner_id=? AND kind='inventar')").bind(d.visibility,d.name,body,now,id,a.campaignId,id,a.campaignId,a.id),
      db.prepare("INSERT INTO relationships(id,campaign_id,source_id,target_id,type,visibility,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE id=? AND campaign_id=? AND owner_id=? AND kind='inventar')").bind(relationshipId,a.campaignId,d.characterId,id,"character.owns",d.visibility,now,id,a.campaignId,a.id),
    ]);
    if(!results[1].meta.changes||!results[2].meta.changes)throw new HttpError(409,"Konflikt: Das Trageprofil wurde inzwischen geändert. Bitte neu laden.");
    return json({ id, revision: 1 }, 201);
  } catch (error) {
    return failure(error, req);
  }
}

export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    const parsed = inventoryPatchSchema.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const d = parsed.data;
    const db = database();
    const old = await ownItem(db, a, d.id);
    if(old.version!==d.expectedRevision)throw new HttpError(409,"Konflikt: Der Gegenstand wurde inzwischen geändert. Bitte neu laden.");
    const oldBody = JSON.parse(old.body) as Record<string, unknown>;
    if (oldBody.characterId !== d.characterId) throw new HttpError(400, "Die Character-Zuordnung darf nicht geändert werden.");
    if (!(await selectCharacter(db, a, d.characterId)).selected) throw new HttpError(404, "Eigener aktiver Charakter nicht gefunden.");
    await validateImage(db, a, d.imageFileId, d.visibility);
    const before=await inventoryProjection(db,a,d.characterId,true);
    assertPlacement(before.carry,before.items,{...d,imageFileId:d.imageFileId||undefined,id:d.id,location:d.status==="Gelagert"?"STORED":d.location??"BACKPACK",lifecycleStatus:d.action==="archive"?"ARCHIVED":"ACTIVE",revision:d.expectedRevision,createdAt:"",updatedAt:"",canEdit:true});

    const now = new Date().toISOString();
    const body = itemBody(d, d.action === "archive" ? "ARCHIVED" : "ACTIVE");
    const nextRevision = d.expectedRevision + 1;
    const carryId=`carry.${d.characterId}`,defaultCarry=JSON.stringify({profile:"BODY_ONLY"});
    const results = await db.batch([
      db.prepare("INSERT OR IGNORE INTO records(id,campaign_id,owner_id,kind,visibility,title,body,gm_body,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(carryId,a.campaignId,a.id,"inventory_carry","private",d.characterId,defaultCarry,"",0,now,now),
      db.prepare("UPDATE records SET version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND owner_id=? AND kind='inventory_carry' AND version=?").bind(now,carryId,a.campaignId,a.id,d.expectedCarryRevision),
      db.prepare("UPDATE records SET title=?,visibility=?,body=?,version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND owner_id=? AND version=? AND EXISTS(SELECT 1 FROM records c WHERE c.id=? AND c.version=? AND c.kind='inventory_carry')").bind(d.name,d.visibility,body,now,d.id,a.campaignId,a.id,d.expectedRevision,carryId,d.expectedCarryRevision+1),
      db.prepare("UPDATE entities SET visibility=?,title=?,content=?,version=?,updated_at=? WHERE id=? AND campaign_id=? AND EXISTS(SELECT 1 FROM records WHERE id=? AND version=? AND updated_at=?)").bind(d.visibility,d.name,body,nextRevision,now,d.id,a.campaignId,d.id,nextRevision,now),
      db.prepare("UPDATE relationships SET visibility=? WHERE campaign_id=? AND target_id=? AND type='character.owns' AND EXISTS(SELECT 1 FROM records WHERE id=? AND version=? AND updated_at=?)").bind(d.visibility,a.campaignId,d.id,d.id,nextRevision,now),
    ]);
    if(!results[1].meta.changes)throw new HttpError(409,"Konflikt: Das Trageprofil wurde inzwischen geändert. Bitte neu laden.");
    if(!results[2].meta.changes)throw new HttpError(409,"Konflikt: Der Gegenstand wurde inzwischen geändert. Bitte neu laden.");
    return json({ id: d.id, revision: nextRevision });
  } catch (error) {
    return failure(error, req);
  }
}
