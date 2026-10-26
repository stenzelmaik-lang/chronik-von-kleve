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
  return {placeId:place.id,areaId:area.id,url:base+'/spielbereich?bereich=schauplaetze&ort='+place.id,creation:{placeId:station.id,forecourtId:forecourt.id,editorUrl:base+'/sl/command-center?bereich=ortscms'}};
}
