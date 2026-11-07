import test from "node:test";
import assert from "node:assert/strict";
import {
  htmlToRichText,
  richTextToHtml,
  richTextToPlainText,
  richTextFileIds,
  readRichText,
  encodeRichText,
} from "../domain/location-rich-text.ts";
import { sessionPreparationSchema } from "../domain/story-preparation.ts";
import { personalMessageSchema } from '../domain/personal-message.ts';
import { npcSaveSchema } from '../domain/npc-authoring.ts';
import { materialSchema } from '../domain/table-material.ts';
import { authoringTextMax, authoringSourceMax, authoringRequestMax } from '../domain/authoring-limits.ts';
import {
  sceneDocumentSchema,
  emptyScene,
  sceneElementKinds,
} from "../domain/story-scene.ts";
import {
  emptyStory,
  storyDocumentSchema,
} from "../domain/command-workspace.ts";

test('Preparation prose accepts the complete 20000 characters and rejects 20001 without truncation',()=>{
 const full='Ä'.repeat(20000),tooLong=full+'X';
 for(const schema of [sessionPreparationSchema]){
  assert.equal(richTextToPlainText(schema.parse({title:'SYNTHETIC',notes:full}).notes),full);
  assert.equal(schema.safeParse({title:'SYNTHETIC',notes:tooLong}).success,false);
 }
 const story=emptyStory();for(const key of Object.keys(story.sections)){
  assert.equal(richTextToPlainText(storyDocumentSchema.parse({...story,sections:{...story.sections,[key]:full}}).sections[key]),full);
  assert.equal(storyDocumentSchema.safeParse({...story,sections:{...story.sections,[key]:tooLong}}).success,false);
 }
 for(const kind of ['dialogue','person','text']){
  const scene={...emptyScene(),elements:[{id:crypto.randomUUID(),kind,title:'SYNTHETIC',text:full,referenceId:'',fileId:''}]};
  assert.equal(richTextToPlainText(sceneDocumentSchema.parse(scene).elements[0].text),full);
  assert.equal(sceneDocumentSchema.safeParse({...scene,elements:[{...scene.elements[0],text:tooLong}]}).success,false);
 }
});
test('HTML markup does not consume the 20000 visible-character allowance; sanitizing and complexity bounds remain',()=>{
 const escaped='&amp;'.repeat(20000),html='cvk-html-v1:<p>'+escaped+'</p>';
 assert.ok(html.length>65000&&html.length<authoringSourceMax);
 assert.equal(richTextToPlainText(sceneDocumentSchema.parse({...emptyScene(),dialogueNotes:html}).dialogueNotes),'&'.repeat(20000));
 assert.equal(richTextToPlainText(sceneDocumentSchema.parse({...emptyScene(),narration:'cvk-html-v1:<p>safe</p><script>SECRET</script>'}).narration),'safe');
 assert.equal(sceneDocumentSchema.safeParse({...emptyScene(),narration:'cvk-html-v1:'+'<div>'.repeat(45)+'x'+'</div>'.repeat(45)}).success,false);
 assert.equal(sceneDocumentSchema.safeParse({...emptyScene(),narration:' '.repeat(authoringSourceMax+1)}).success,false);
 assert.equal(authoringTextMax,20000);assert.ok(JSON.stringify({...emptyScene(),narration:'x'.repeat(20000),atmosphere:'x'.repeat(20000),gmNotes:'x'.repeat(20000),dialogueNotes:'x'.repeat(20000),interactions:'x'.repeat(20000),secrets:'x'.repeat(20000),visions:'x'.repeat(20000),possibleConsequences:'x'.repeat(20000)}).length<authoringRequestMax);
});
test('Long prepared messages use the same rich-text limit and can be sent without losing their tail',()=>{
 const msg={clientRequestId:crypto.randomUUID(),recipients:['p'],title:'SYNTHETIC',text:'cvk-html-v1:<p>'+'x'.repeat(20000)+'</p>',format:'rich'};
 assert.equal(personalMessageSchema.safeParse(msg).success,true);
 assert.equal(personalMessageSchema.safeParse({...msg,text:'cvk-html-v1:<p>'+'x'.repeat(20001)+'</p>'}).success,false);
 assert.equal(materialSchema.safeParse({title:'SYNTHETIC',kind:'document',text:'cvk-html-v1:<p>'+'&amp;'.repeat(20000)+'</p>',fileId:'',pages:[]}).success,true);
});
test('Existing larger NPC blocks remain valid and short metadata limits do not change',()=>{
 const npc={title:'SYNTHETIC',canonStatus:'draft',playState:null,defaultVisibility:'sl_secret',profile:{},blocks:[{kind:'bio',content:'x'.repeat(90000),visibility:'sl_secret',position:0}],retainedRelationships:[],addedRelationships:[]};
 assert.equal(npcSaveSchema.safeParse(npc).success,true);
 assert.equal(npcSaveSchema.safeParse({...npc,blocks:[{...npc.blocks[0],content:'x'.repeat(90001)}]}).success,false);
 assert.equal(sceneDocumentSchema.safeParse({...emptyScene(),title:'x'.repeat(201)}).success,false);
 assert.equal(sessionPreparationSchema.safeParse({title:'SYNTHETIC',summary:'x'.repeat(2001)}).success,false);
});
test("HTML becomes a safe existing document with table, protected image, quote and divider", () => {
  const safe = htmlToRichText(
    '<h1>Title</h1><blockquote>Quote</blockquote><table><tr><th>A</th><td>B</td></tr></table><img src="/api/files?id=fixture-image" onerror="alert(1)"><hr><script>LEAK</script><iframe src="https://evil.test"></iframe><p onclick="x()"><a href="javascript:alert(1)">Safe text</a></p>',
  );
  assert.deepEqual(
    readRichText(safe).blocks.map((b) => b.type),
    ["heading2", "quote", "table", "image", "divider", "paragraph"],
  );
  assert.deepEqual(richTextFileIds(safe), ["fixture-image"]);
  assert.ok(!safe.includes("LEAK"));
  assert.ok(!safe.includes("onclick"));
  assert.ok(!safe.includes("javascript:"));
  assert.equal(htmlToRichText(richTextToHtml(safe)), safe);
});
test("Editor roundtrip preserves existing marks and palette colors including browser RGB", () => {
  const text = encodeRichText({
    version: 1,
    blocks: [
      {
        type: "paragraph",
        children: [
          {
            text: "Gold",
            color: "#d6b36f",
            bold: true,
            italic: true,
            underline: true,
          },
        ],
      },
    ],
  });
  assert.equal(htmlToRichText(richTextToHtml(text)), text);
  assert.equal(
    readRichText(
      htmlToRichText('<span style="color:rgb(214, 179, 111)">Gold</span>'),
    ).blocks[0].children[0].color,
    "#d6b36f",
  );
});
test("Only authenticated internal images and permitted links can enter documents", () => {
  const s = htmlToRichText(
    '<img src="https://evil.test/track"><img src="data:image/svg+xml,x"><a href="/sl/command-center?story=plot-1">Internal</a><svg onload="x()">bad</svg><form>bad</form>',
  );
  assert.equal(richTextFileIds(s).length, 0);
  assert.ok(richTextToHtml(s).includes("/sl/command-center?story=plot-1"));
  assert.equal(richTextToPlainText(s), "Internal");
});
test("Oversized or deeply nested HTML fails rather than being rendered raw", () => {
  assert.throws(() => htmlToRichText("x".repeat(65001)));
  assert.throws(() =>
    htmlToRichText("<div>".repeat(45) + "deep" + "</div>".repeat(45)),
  );
});
test("Legacy stories and scenes gain metadata defaults without rewriting old values", () => {
  const { summary, status, favorite, pinned, ...legacy } = emptyStory();
  assert.equal(storyDocumentSchema.parse(legacy).summary, "");
  assert.equal(status, "draft");
  assert.equal(summary, "");
  assert.equal(favorite, false);
  assert.equal(pinned, false);
  const old = emptyScene();
  delete old.elements;
  delete old.parentId;
  delete old.sessionIds;
  assert.deepEqual(sceneDocumentSchema.parse(old).elements, []);
});
test("Prepared sessions have no implicit execution state and reject duplicate references", () => {
  const doc = sessionPreparationSchema.parse({
    title: "Private preparation",
    storyIds: ["plot-existing"],
  });
  assert.equal(doc.status, "draft");
  assert.ok(!("log" in doc));
  assert.equal(
    sessionPreparationSchema.safeParse({
      ...doc,
      storyIds: ["plot-existing", "plot-existing"],
    }).success,
    false,
  );
});
test("All requested scene element kinds are supported without implied publication", () => {
  const doc = emptyScene();
  doc.elements = sceneElementKinds.map((kind) => ({
    id: crypto.randomUUID(),
    kind,
    title: kind,
    text: "Prepared",
    referenceId: "",
    fileId: "",
  }));
  assert.equal(sceneDocumentSchema.parse(doc).elements.length, 16);
  assert.equal(
    sceneDocumentSchema.safeParse({
      ...doc,
      elements: [doc.elements[0], doc.elements[0]],
    }).success,
    false,
  );
});

test("Empty contenteditable paragraphs normalize without inventing text",()=>{assert.equal(htmlToRichText("<p><br></p>"),htmlToRichText("<p></p>"));assert.equal(richTextToPlainText(htmlToRichText("<p>"+"a".repeat(9000)+"</p>")).length,9000);});

test("A scene can reference one Spielabend and one existing place without starting live play", () => {
  const scene = emptyScene();
  scene.sessionIds = ["session-kaserne"];
  scene.placeId = "ort-kaserne";
  const validated = sceneDocumentSchema.parse(scene);
  assert.deepEqual(validated.sessionIds, ["session-kaserne"]);
  assert.equal(validated.placeId, "ort-kaserne");
  assert.equal(Object.hasOwn(validated, "runs"), false);
  assert.equal(Object.hasOwn(validated, "publications"), false);
});
test("A free scene stays unassigned and session link defaults are compatible", () => {
  const freeScene = sceneDocumentSchema.parse(emptyScene());
  const evening = sessionPreparationSchema.parse({title:"Der Hunger bleibt",sceneIds:[]});
  assert.deepEqual(freeScene.sessionIds, []);
  assert.deepEqual(evening.sceneIds, []);
  assert.equal(evening.status, "draft");
});


test('Central scene selector contains only root places without rewriting legacy references', async () => {
  const {preparationPlaces,isCentralPreparationPlace}=await import('../app/spielbereich/modules/preparation-catalog.ts');
  const places=preparationPlaces([{id:'station',title:'Bahnhof',level:'location',parent_id:null},{id:'hall',title:'Empfangshalle',level:'area',parent_id:'station'},{id:'room',title:'Zimmer',level:'room',parent_id:'hall'}]);
  assert.deepEqual(places.filter(isCentralPreparationPlace).map(place=>place.id),['station']);
  assert.equal(isCentralPreparationPlace({type:'NPC'}),false);
  assert.equal(sceneDocumentSchema.parse({...emptyScene(),placeId:'hall'}).placeId,'hall');
});
