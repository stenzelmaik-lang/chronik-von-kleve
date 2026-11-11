import { actor, database, sameOrigin, input, json, failure, HttpError, gmOnly } from '@/server/access';
import { GET as recordsGET, POST as recordsPOST } from '../records/route';
import { appointmentOptions, appointmentChoices, validAppointmentDate } from '@/domain/appointments';
import { engagementAwardsEnabled, engagementEnabled } from '@/server/engagement-config';
import { reconcileCampaignEngagement } from '@/server/engagement-awards';
import type { Entry, LegacyRecordRow } from '@/domain/legacy';
export const dynamic = 'force-dynamic';

async function visibleRecords(req: Request): Promise<Entry[]> {
  const url = new URL(req.url); url.search = '?kind=termine';
  const response = await recordsGET(new Request(url, {headers:req.headers}));
  if (!response.ok) throw new HttpError(response.status, 'Termine konnten nicht geladen werden.');
  return (await response.json() as {records:Entry[]}).records;
}
export async function GET(req: Request) {
  try {
    const a = await actor(); const records = await visibleRecords(req); const db = database();
    const votes = await db.prepare("SELECT r.*,m.name AS voter_name FROM records r JOIN members m ON m.id=r.owner_id WHERE r.campaign_id=? AND r.kind='notizen' AND json_valid(r.body) AND json_extract(r.body,'$.context')='appointment-vote'").bind(a.campaignId).all<LegacyRecordRow & {voter_name:string}>();
    return json({records:records.map(record => ({...record, votes:votes.results.flatMap(vote => {
      const body = JSON.parse(vote.body);
      if (body.pollId !== record.id || record.body.scheduleKind !== 'poll') return [];
      try { return [{memberId:vote.owner_id,name:vote.voter_name,choices:appointmentChoices(body.choices,appointmentOptions(record.body.pollOptions)),version:vote.owner_id === a.id ? vote.version : undefined}]; } catch { return []; }
    })}))});
  } catch (error) { return failure(error, req); }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req); const a = await actor(); const d = await input(req);
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new HttpError(400,'Ungültige Terminaktion.');
    if (d.action === 'vote') {
      const record = (await visibleRecords(req)).find(record => record.id === d.id);
      if (!record || record.body.scheduleKind !== 'poll') throw new HttpError(404,'Abstimmung nicht verfügbar.');
      if (record.body.pollClosed === true) throw new HttpError(409,'Die Abstimmung ist abgeschlossen.');
      let choices;
      try { choices = appointmentChoices(d.choices,appointmentOptions(record.body.pollOptions)); } catch (error) { throw new HttpError(400,(error as Error).message); }
      if (!Number.isInteger(d.version) || d.version < 0) throw new HttpError(400,'Abstimmungsversion fehlt.');
      const db = database(); const now = new Date().toISOString(); const id = `appointment-vote:${record.id}:${a.id}`;
      const body = JSON.stringify({context:'appointment-vote',pollId:record.id,choices});
      const result = await db.prepare("INSERT INTO records(id,owner_id,kind,visibility,title,body,gm_body,created_at,updated_at,campaign_id) SELECT ?,?,'notizen','private','Terminabstimmung',?,'',?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE id=? AND campaign_id=? AND kind='termine' AND version=? AND json_extract(body,'$.scheduleKind')='poll' AND COALESCE(json_extract(body,'$.pollClosed'),0)=0) ON CONFLICT(id) DO UPDATE SET body=excluded.body,version=records.version+1,updated_at=excluded.updated_at WHERE records.owner_id=excluded.owner_id AND records.campaign_id=excluded.campaign_id AND records.version=?").bind(id,a.id,body,now,now,a.campaignId,record.id,a.campaignId,record.version,d.version).run();
      if (!result.meta.changes) throw new HttpError(409,'Die Abstimmung wurde inzwischen geändert. Bitte neu laden; deine Auswahl bleibt erhalten.');
      return json({ok:true});
    }
    gmOnly(a);
    if (!['save','finalize','engagement-game-night'].includes(d.action)) throw new HttpError(400,'Unbekannte Terminaktion.');
    const old = d.id ? (await visibleRecords(req)).find(record => record.id === d.id) : undefined;
    if (d.id && !old) throw new HttpError(404,'Termin nicht verfügbar.');
    let body: Record<string,unknown>;
    if (d.action === 'engagement-game-night') {
      if (!engagementEnabled() || !old || old.visibility !== 'group' || !['fixed', 'poll'].includes(String(old.body.scheduleKind)))
        throw new HttpError(404, 'Öffentlicher Spieltermin nicht verfügbar.');
      if (typeof d.marked !== 'boolean') throw new HttpError(400, 'Ungültige Kennzeichnung.');
      body = { ...old.body, engagementGameNight: d.marked };
    } else if (d.action === 'finalize') {
      if (!old || old.body.scheduleKind !== 'poll' || old.body.pollClosed === true) throw new HttpError(409,'Keine offene Abstimmung.');
      const option = appointmentOptions(old.body.pollOptions).find(option => option.id === d.optionId);
      if (!option) throw new HttpError(400,'Terminvorschlag fehlt.');
      body = {...old.body,date:option.date,pollClosed:true};
    } else {
      if (old?.body.scheduleKind === 'poll') throw new HttpError(400,'Bestehende Abstimmung bitte über einen Vorschlag festlegen.');
      if (!['fixed','poll'].includes(d.scheduleKind) || !['sl','group'].includes(d.visibility)) throw new HttpError(400,'Ungültige Terminart oder Sichtbarkeit.');
      body = {...old?.body,summary:typeof d.summary === 'string' ? d.summary.slice(0,2000) : '',scheduleKind:d.scheduleKind};
      if (d.scheduleKind === 'poll') {
        try { body.pollOptions = appointmentOptions(d.options); } catch (error) { throw new HttpError(400,(error as Error).message); }
        body.pollClosed = false; delete body.date;
      } else {
        if (!validAppointmentDate(d.date)) throw new HttpError(400,'Bitte ein gültiges Datum mit Uhrzeit angeben.');
        body.date = d.date;
      }
    }
    const result = await recordsPOST(new Request(req.url, {method:'POST',headers:req.headers,body:JSON.stringify({id:d.id,version:d.version,kind:'termine',title:old && d.action !== 'save' ? old.title : d.title,visibility:old && d.action !== 'save' ? old.visibility : d.visibility,body})}));
    if (result.ok && engagementAwardsEnabled() && (body.engagementGameNight === true || old?.body.engagementGameNight === true)) {
      await reconcileCampaignEngagement(database(), a.campaignId, Date.now());
    }
    return result;
  } catch (error) { return failure(error, req); }
}
