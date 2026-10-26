import {readFileSync} from 'node:fs';
import {richHtmlPrefix} from '../../domain/location-rich-text.ts';

// Disposable local acceptance data only. Never used by app startup or a migration.
export async function seedLocationAreaDemo({base,cookie}) {
  if(base!=='http://127.0.0.1:8794')throw Error('Area preview is local-only.');
  const request=async(path,method='GET',body)=>{
    const response=await fetch(base+path,{method,headers:{Cookie:cookie,Origin:base,...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
    if(!response.ok)throw Error('Local area fixture failed: '+path+' '+response.status+' '+await response.text());
    return response.json();
  };
  const create=(level,title,parentId)=>request('/api/cms/locations','POST',{level,title,...(parentId?{parentId}:{})});
  const release=async(node,payload,heroFileId)=>{
    const saved=await request('/api/cms/drafts','PATCH',{revisionId:node.revisionId,expectedVersion:1,payload,...(heroFileId?{heroFileId}:{})});
    const submitted=await request('/api/cms/transitions','POST',{action:'submit',revisionId:node.revisionId,expectedVersion:saved.version});
    await request('/api/cms/transitions','POST',{action:'approve',revisionId:node.revisionId,expectedVersion:submitted.version});
    await request('/api/cms/releases','POST',{action:'publish',entityId:node.id,scope:'group',revisionId:node.revisionId,expectedReleaseVersion:0,discoveryState:'known',reason:'Synthetische lokale Bereichsprüfung'});
  };
  // This existing fixture asset has a .png name but contains JPEG bytes.
  const image=new FormData();image.set('file',new Blob([readFileSync(new URL('../../public/images/kleve.png',import.meta.url))],{type:'image/jpeg'}),'SYNTHETISCH – Test-Lageplan.jpg');
  const media=await request('/api/cms/media','POST',image);
  const place=await create('location','SYNTHETISCH – Nachtarchiv');
  await release(place,{title:place.title,subtitle:'Ausschließlich lokale Darstellungsprüfung',summary:'Kein echter Kampagnenort. Diese Daten bleiben in der isolierten Vorschau.',atmosphere:'Ein ruhiger Ort für die lokale Prüfung von langen Beschreibungen, Lageplänen und sicheren Freigaben.\n\nDie vorhandene Karte dient nur als Bild-Testfläche.'},media.id);
  const area=await create('area','Eingangshalle und Vorplatz',place.id);
  const description='<h2>Der erste Eindruck</h2><p class="cp-intro">Kühles Licht fällt auf den Vorplatz. Unter dem Vordach sammeln sich Reisende, während die Stadt im Regen liegt.</p><p>Zwischen den Türen, den alten Wegweisern und dem offenen Platz bleibt genug Raum für Gespräche. Das Bild ist eine lokale Testfläche: Seine Ränder dürfen in der Vorschau und der großen Ansicht nicht abgeschnitten werden.</p><h3>Was dir auffällt</h3><ul><li><span class="cp-highlight">Eine beleuchtete Passage</span> führt in die Halle.</li><li>Die Wegweiser sind auch im Dunkeln lesbar.</li></ul><blockquote class="cp-note">Ein einzelner Schritt hallt durch den überdachten Eingang.</blockquote><hr class="cp-divider"><p>Einleitung und Beschreibung bleiben gemeinsam in der Textspalte. Die Fläche unter dem Bild bleibt auf dem Desktop frei.</p>';
  await release(area,{title:area.title,playerHint:richHtmlPrefix+description},media.id);
  const room=await create('room','Wartebereich',area.id);
  await release(room,{title:room.title,short:'Alter Klartext bleibt lesbar.\nAuch ein zweiter Absatz bleibt erhalten.'});
  const other=await create('area','Galerie mit einem sehr langen Bereichsnamen für schmale Bildschirme',place.id);
  await release(other,{title:other.title,playerHint:'Ein zweiter bekannter Bereich ohne Bild.\n\nDer Text bleibt unverändert und dient der Tastatur- und Mobilprüfung.'});
  const longIntro=await create('area','Lange Einleitung mit Bild',place.id);
  await release(longIntro,{title:longIntro.title,playerHint:richHtmlPrefix+'<p class="cp-intro">'+('Die Ankunft im Archiv erfordert Geduld. Der Blick folgt den Türen, während sich das Licht im Regen spiegelt. '.repeat(8))+'</p><h2>Unterhalb der Einleitung</h2><p>Dieser Abschnitt muss unter dem längeren Einleitungstext beginnen.</p>'},media.id);
  const noIntro=await create('area','Bild ohne markierte Einleitung',place.id);
  await release(noIntro,{title:noIntro.title,playerHint:richHtmlPrefix+'<h2>Keine Einleitung erraten</h2><p>Auch ohne markierte Einleitung bleibt dieser Absatz auf dem Desktop neben dem Bild.</p><h3>Weitere Angaben</h3><p>Alle bisherigen Inhalte bleiben erhalten.</p>'},media.id);
  const formatted=await create('area','Lesefluss und bewusste Umbrüche',place.id);
  await release(formatted,{title:formatted.title,playerHint:richHtmlPrefix+`<p class="cp-intro">
  Ein ruhiger Vorplatz zwischen den alten Fassaden
  und dem Licht der Stadt. Die Einleitung nutzt
  die verfügbare Breite ohne künstliche Kurzzeilen.
</p>
<h2>Zwischen den Türen</h2>
<p>
  Reisende ziehen ihre Koffer durch die Passage.
  Dieser eingerückte HTML-Quelltext ist ein normaler Absatz,
  keine Folge fester Kurzzeilen. Ein <strong>bekannter Weg</strong>
  führt in die Halle.
</p>
<h3>Orientierung</h3><ul><li>Zum <span class="cp-highlight">Vorplatz</span> gehen.</li><li>Auf das Licht achten.</li></ul>
<hr class="cp-divider"><p>Bewusster Umbruch:<br>Zweite Zeile.</p>
<p class="cp-note">Eine ergänzende Beobachtung, die ruhig und gut lesbar bleibt.</p>`},media.id);
  const secret=await create('area','AREA_PREVIEW_NEVER_PLAYER',place.id);
  await request('/api/cms/drafts','PATCH',{revisionId:secret.revisionId,expectedVersion:1,payload:{title:secret.title,playerHint:'AREA_PREVIEW_HIDDEN_DESCRIPTION'},heroFileId:media.id});
  await request('/api/cms/drafts','POST',{entityId:area.id,audience:'gm',gmSecret:{text:'AREA_PREVIEW_SL_ONLY – Diese Notiz darf nur die Spielleitung sehen.'}});
  const station=await create('location','Hauptbahnhof Kleve');
  await release(station,{title:station.title,subtitle:'Synthetischer lokaler Anlage-Test',summary:'Kein importierter Produktionsort. Bestehender Hauptort für den Test weiterer gleichrangiger Bereiche.'},media.id);
  const forecourt=await create('area','Bahnhofsvorplatz',station.id);
  await release(forecourt,{title:forecourt.title,playerHint:'Bestehender Testbereich. ID, Bild und Freigabe bleiben bei der Anlage der Empfangshalle unverändert.'},media.id);
  const hall=await create('area','Empfangshalle',station.id);
  await release(hall,{title:hall.title,playerHint:richHtmlPrefix+'<p class="cp-intro">Helles Licht fällt durch die Eingangstüren der synthetischen Testhalle.</p><h2>Ein erster Eindruck</h2><p>Reisende warten an einer Anzeigetafel. Dieser Text ist ausschließlich für die lokale Abnahme angelegt.</p>'},media.id);
  const office=await create('room','Dienstzimmer',hall.id);
  await release(office,{title:office.title,short:'Ein freigegebener Raum der lokalen Testhalle.'});
  await request('/api/cms/drafts','POST',{entityId:station.id,audience:'gm',gmSecret:{text:'Bestehender Klartextvermerk der synthetischen SL-Prüfung.\n\nZwei Absätze und <wörtliche Zeichen> bleiben erhalten.\n'+Array.from({length:140},(_,index)=>'Historische Zeile '+(index+1)).join('\n'),source:'Ausschließlich lokale Testdaten'}});
  await request('/api/cms/drafts','POST',{entityId:hall.id,audience:'gm',gmSecret:{text:richHtmlPrefix+'<h2>Schnellübersicht</h2><ul><li>Zugänge: Vorplatz, Westpassage und Dienstzimmer.</li><li>Personal: Eine Aufsicht am Informationsschalter.</li><li>Öffentlich: Wartezone. Intern: Dienstzimmer.</li></ul><h2>Architektur und räumlicher Aufbau</h2><p>Eine hohe Halle mit einer Galerie verbindet die beiden Eingänge.</p><h2>Zugänge und angrenzende Räume</h2><p>Die Westpassage führt zum Dienstzimmer. Der breite Haupteingang liegt am Vorplatz.</p><h2>Einrichtungen und Ausstattung</h2><p>Informationsschalter, Sitzbänke und eine Anzeigetafel.</p><h2>Personal und gewöhnlicher Betrieb</h2><p>Die Aufsicht beantwortet tagsüber Fragen; nachts ist der Schalter geschlossen.</p><h2>Technik und Sicherheit</h2><h3>Seitentür</h3><p class="cp-note">SL-TESTGEHEIMNIS: Der Schlüssel liegt im Dienstzimmer.</p><table><tr><td>Westtür</td><td>Nachts geschlossen</td></tr></table><h2>Verborgene Ortsinformationen</h2><p>Eine Wartungsnische liegt hinter der Anzeigetafel.</p><h2>Ergänzende SL-Notizen</h2><p>Alle Angaben sind synthetisch und gehören ausschließlich zur lokalen Abnahme.</p>',source:'Ausschließlich lokale Testdaten'}});
  await request('/api/cms/drafts','POST',{entityId:office.id,audience:'gm',gmSecret:{text:'SL-TESTRAUM: Interner Dienstplan und Reserve-Schlüssel.\nDieser Raumtext bleibt separat im bestehenden Ortsbaum.'}});
  return {placeId:place.id,areaId:area.id,url:base+'/spielbereich?bereich=schauplaetze&ort='+place.id,creation:{placeId:station.id,forecourtId:forecourt.id,hallId:hall.id,roomId:office.id,editorUrl:base+'/sl/command-center?bereich=ortscms'}};
}
