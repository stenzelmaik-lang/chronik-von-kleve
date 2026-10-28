import { randomUUID } from "node:crypto";
import { emptyStory } from "../domain/command-workspace.ts";
import { emptyScene } from "../domain/story-scene.ts";
import { sessionPreparationSchema } from "../domain/story-preparation.ts";
export async function storyPreparationIntegration({
  req,
  check,
  localSql,
  sqlQuote,
  session,
}) {
  const root = "/api/command-center";
  for (const who of [
    undefined,
    "a",
    "b",
    "editor",
    "blockedGm",
    "pendingGm",
    "otherCampaign",
    "platformOnly",
  ]) {
    check(
      [401, 403].includes((await req(root + "/preparation", who)).s),
      "P2A session preparation denies " + (who || "anonymous"),
    );
    check(
      [401, 403].includes(
        (await req(root + "/preparation", who, "POST", {})).s,
      ),
      "P2A preparation write denied " + (who || "anonymous"),
    );
  }
  const document = emptyStory();
  document.title = "P2A SYNTHETIC story";
  document.summary = "P2A searchable summary";
  document.favorite = true;
  document.pinned = true;
  document.references = ["place.electric-taberna"];
  document.sections.background =
    'cvk-html-v1:<h2>PRIVATE_P2A_STORY</h2><p onmouseover="bad()">Safe</p><script>EVIL_SCRIPT</script>';
  const create = await req(root + "/story", "gm", "POST", {
    action: "create",
    clientRequestId: randomUUID(),
    document,
  });
  check(create.s === 201, "P2A story with metadata and HTML created");
  let story = create.d.story;
  check(
    story.favorite && story.pinned && story.summary === document.summary,
    "P2A metadata persisted",
  );
  check(
    !JSON.stringify(story).includes("EVIL_SCRIPT") &&
      !JSON.stringify(story).includes("onmouseover"),
    "P2A server sanitizes untrusted HTML",
  );
  const listing = await req(root + "/story", "gm");
  check(
    listing.d.stories.some(
      (s) => s.id === story.id && s.searchText.includes("PRIVATE_P2A_STORY"),
    ),
    "P2A search includes private story text only for SL",
  );
  const baseCount = (await req(root + "/preparation", "gm")).d.places.length;
  const prep = sessionPreparationSchema.parse({
    title: "P2A SYNTHETIC session",
    notes: "PRIVATE_P2A_PREPARATION",
    storyIds: [story.id],
    placeIds: ["place.electric-taberna"],
    favorite: true,
  });
  const requestId = randomUUID();
  const created = await req(root + "/preparation", "gm", "POST", {
    action: "create",
    clientRequestId: requestId,
    document: prep,
  });
  check(created.s === 201, "P2A session uses existing record storage");
  let prepared = created.d.session;
  check(
    (
      await req(root + "/preparation", "gm", "POST", {
        action: "create",
        clientRequestId: requestId,
        document: prep,
      })
    ).d.session.version === 1,
    "P2A session creation retry is idempotent",
  );
  check(
    (await req(root + "/preparation?id=" + prepared.id, "gm")).d.session
      .document.notes === prep.notes,
    "P2A session persists on fresh read",
  );
  check(
    (
      await req(root + "/preparation", "gm", "POST", {
        action: "save",
        id: prepared.id,
        version: 1,
        document: { ...prep, placeIds: ["missing-place"] },
      })
    ).s === 404,
    "P2A nonexistent place reference denied",
  );
  const pair = await Promise.all(
    ["A", "B"].map((title) =>
      req(root + "/preparation", "gm", "POST", {
        action: "save",
        id: prepared.id,
        version: 1,
        document: { ...prep, title },
      }),
    ),
  );
  check(
    pair
      .map((p) => p.s)
      .sort()
      .join(",") === "200,409",
    "P2A preparation CAS permits exactly one writer",
  );
  const hist = (
    await req(root + "/preparation?id=" + prepared.id + "&history=1", "gm")
  ).d;
  check(hist.history.length === 2, "P2A CAS loser cannot append history");
  const restored = await req(root + "/preparation", "gm", "POST", {
    action: "restore",
    id: prepared.id,
    version: hist.session.version,
    historyId: hist.history.at(-1).id,
  });
  check(
    restored.s === 200 && restored.d.session.document.title === prep.title,
    "P2A preparation history restores as new revision",
  );
  prepared = restored.d.session;
  localSql(
    "CREATE TRIGGER p2a_fail_audit BEFORE INSERT ON world_events WHEN NEW.type='command.preparation.saved' BEGIN SELECT RAISE(ABORT,'P2A isolated audit failure'); END",
  );
  check(
    (
      await req(root + "/preparation", "gm", "POST", {
        action: "save",
        id: prepared.id,
        version: prepared.version,
        document: { ...prepared.document, title: "MUST_ROLL_BACK" },
      })
    ).s === 503,
    "P2A failed audit reports error",
  );
  localSql("DROP TRIGGER p2a_fail_audit");
  const untouched = (await req(root + "/preparation?id=" + prepared.id, "gm")).d
    .session;
  check(
    untouched.version === prepared.version &&
      untouched.document.title === prepared.document.title,
    "P2A audit failure rolls back preparation and revision",
  );

  const existing = (
    await req("/api/records?kind=sitzungen", "gm")
  ).d.records.find((r) => r.id === session.id);
  const adapted = await req(root + "/preparation", "gm", "POST", {
    action: "save",
    id: existing.id,
    version: existing.version,
    document: sessionPreparationSchema.parse({
      title: existing.title,
      notes: "PRIVATE_P2A_EXISTING",
    }),
  });
  check(adapted.s === 200, "P2A existing session gains private preparation");
  const after = (await req("/api/records?kind=sitzungen", "gm")).d.records.find(
    (r) => r.id === existing.id,
  );
  check(
    JSON.stringify({ ...after.body, sl_preparation: undefined }) ===
      JSON.stringify(existing.body),
    "P2A existing live log and other session fields remain unchanged",
  );
  check(
    after.gmBody === existing.gmBody &&
      after.visibility === existing.visibility,
    "P2A GM text and session visibility preserved",
  );
  check(
    !JSON.stringify((await req("/api/records?kind=sitzungen", "a")).d).includes(
      "PRIVATE_P2A",
    ),
    "P2A normal session projection excludes private preparation",
  );
  const sceneDoc = {
    ...emptyScene(story.id),
    title: "P2A SYNTHETIC scene",
    sessionIds: [prepared.id],
    placeId: "place.electric-taberna",
    elements: [
      {
        id: randomUUID(),
        kind: "clue",
        title: "P2A_ELEMENT",
        text: "PRIVATE_P2A_ELEMENT",
        referenceId: "",
        fileId: "",
      },
    ],
  };
  let parent = (
    await req(root + "/scenes", "gm", "POST", {
      action: "create",
      clientRequestId: randomUUID(),
      document: sceneDoc,
    })
  ).d.scene;
  check(
    parent.document.elements.length === 1,
    "P2A element persisted without activation",
  );
  // Removing a session link must update both existing documents atomically,
  // including older scenes that only stored their own sessionIds reference.
  const unlinkSession = (await req(root + "/preparation", "gm", "POST", {
    action: "create", clientRequestId: randomUUID(),
    document: sessionPreparationSchema.parse({ title: "P2A SYNTHETIC unlink session" }),
  })).d.session;
  const unlinkScene = (await req(root + "/scenes", "gm", "POST", {
    action: "create", clientRequestId: randomUUID(),
    document: { ...emptyScene(), title: "P2A SYNTHETIC unlink scene", narration: "PRIVATE_UNLINK_TEXT", sessionIds: [unlinkSession.id] },
  })).d.scene;
  const linked = (await req(root + "/preparation", "gm", "POST", {
    action: "save", id: unlinkSession.id, version: unlinkSession.version,
    document: { ...unlinkSession.document, sceneIds: [unlinkScene.id] },
  })).d.session;
  const removal = { action: "save", id: linked.id, version: linked.version, document: { ...linked.document, sceneIds: [] } };
  check((await req(root + "/preparation", "gm", "POST", { ...removal, version: unlinkSession.version })).s === 409,
    "P2A stale unlink cannot overwrite the session or scene");
  localSql(`CREATE TRIGGER p2a_fail_unlink BEFORE UPDATE OF gm_body ON entities WHEN OLD.id=${sqlQuote(unlinkScene.id)} BEGIN SELECT RAISE(ABORT,'P2A isolated unlink failure'); END`);
  check((await req(root + "/preparation", "gm", "POST", removal)).s === 503,
    "P2A scene update failure rejects the entire unlink");
  localSql("DROP TRIGGER p2a_fail_unlink");
  const afterFailureSession = (await req(root + "/preparation?id=" + linked.id, "gm")).d.session;
  const afterFailureScene = (await req(root + "/scenes?id=" + unlinkScene.id, "gm")).d.scene;
  check(afterFailureSession.version === linked.version && afterFailureSession.document.sceneIds.includes(unlinkScene.id) &&
    afterFailureScene.version === unlinkScene.version && afterFailureScene.document.sessionIds.includes(linked.id),
    "P2A failed unlink preserves both references and revisions");
  const concurrentScene = (await req(root + "/scenes", "gm", "POST", {
    action: "save", id: unlinkScene.id, version: unlinkScene.version,
    document: { ...unlinkScene.document, narration: "PRIVATE_CONCURRENT_EDIT" },
  })).d.scene;
  const unlinked = await req(root + "/preparation", "gm", "POST", removal);
  const afterUnlink = (await req(root + "/scenes?id=" + unlinkScene.id + "&history=1", "gm")).d;
  check(unlinked.s === 200 && !unlinked.d.session.document.sceneIds.includes(unlinkScene.id) &&
    !afterUnlink.scene.document.sessionIds.includes(linked.id), "P2A unlink clears both sides");
  check(afterUnlink.scene.version === concurrentScene.version + 1 && afterUnlink.scene.document.narration === "PRIVATE_CONCURRENT_EDIT" &&
    afterUnlink.scene.state.runs.length === 0 && afterUnlink.scene.state.publications.length === 0 && afterUnlink.history.length >= 3,
    "P2A unlink preserves concurrent scene text and records an audited revision without publication");
  const legacyOnly = (await req(root + "/scenes", "gm", "POST", {
    action: "create", clientRequestId: randomUUID(),
    document: { ...emptyScene(), title: "P2A SYNTHETIC one-sided link", sessionIds: [linked.id] },
  })).d.scene;
  const oneSided = await req(root + "/preparation", "gm", "POST", {
    action: "save", id: linked.id, version: unlinked.d.session.version,
    document: unlinked.d.session.document, unlinkSceneIds: [legacyOnly.id],
  });
  check(oneSided.s === 200 && !(await req(root + "/scenes?id=" + legacyOnly.id, "gm")).d.scene.document.sessionIds.includes(linked.id),
    "P2A a scene-only legacy reference can be removed explicitly");
  check((await req(root + "/preparation", "gm", "POST", {
    action: "save", id: linked.id, version: oneSided.d.session.version,
    document: oneSided.d.session.document, unlinkSceneIds: [legacyOnly.id],
  })).s === 400, "P2A cannot unlink an unrelated scene");
  const childResponse = await req(root + "/scenes", "gm", "POST", {
    action: "create",
    clientRequestId: randomUUID(),
    document: {
      ...emptyScene(story.id),
      title: "P2A child",
      parentId: parent.id,
    },
  });
  check(childResponse.s === 201, "P2A hierarchical child scene created");
  const child = childResponse.d.scene;
  check(
    (
      await req(root + "/scenes", "gm", "POST", {
        action: "save",
        id: parent.id,
        version: parent.version,
        document: { ...parent.document, parentId: child.id },
      })
    ).s === 400,
    "P2A scene hierarchy rejects cycles",
  );
  check(
    (
      await req(root + "/scenes", "gm", "POST", {
        action: "save",
        id: child.id,
        version: child.version,
        document: { ...child.document, parentId: "missing-parent" },
      })
    ).s === 404,
    "P2A missing parent rejected",
  );
  const otherStory=await req(root+'/story','gm','POST',{action:'create',clientRequestId:randomUUID(),document:{...emptyStory(),title:'P2A second story'}});
  check((await req(root+'/scenes','gm','POST',{action:'save',id:parent.id,version:parent.version,document:{...parent.document,storyId:otherStory.d.story.id}})).s===400,'P2A parent story change cannot strand existing children');
  const raceParent=(await req(root+'/scenes','gm','POST',{action:'create',clientRequestId:randomUUID(),document:{...emptyScene(story.id),title:'P2A concurrency parent'}})).d.scene;
  const race=await Promise.all([req(root+'/scenes','gm','POST',{action:'save',id:raceParent.id,version:raceParent.version,document:{...raceParent.document,storyId:otherStory.d.story.id}}),req(root+'/scenes','gm','POST',{action:'create',clientRequestId:randomUUID(),document:{...emptyScene(story.id),title:'P2A concurrency child',parentId:raceParent.id}})]);
  check(!(race[0].s===200&&race[1].s===201)&&race.some(r=>[200,201].includes(r.s)),'P2A concurrent parent move and child creation cannot split the hierarchy');
  const sceneHistory = (
    await req(root + "/scenes?id=" + parent.id + "&history=1", "gm")
  ).d.history;
  const activated = await req(root + "/scenes", "gm", "POST", {
    action: "activate",
    id: parent.id,
    version: parent.version,
    runId: randomUUID(),
    sessionId: prepared.id,
    label: "P2A synthetic run",
    participants: { scope: "group" },
  });
  check(
    activated.s === 200,
    "P2A prepared scene available in existing live workflow",
  );
  parent = activated.d.scene;
  const restoreScene = await req(root + "/scenes", "gm", "POST", {
    action: "restore",
    id: parent.id,
    version: parent.version,
    historyId: sceneHistory[0].id,
  });
  check(
    restoreScene.s === 200 && restoreScene.d.scene.state.runs.length === 1,
    "P2A restoring preparation cannot erase actual scene runs",
  );
  check(
    !JSON.stringify((await req("/api/session-scenes", "a")).d).includes(
      "PRIVATE_P2A_ELEMENT",
    ),
    "P2A elements never leak into player scenes",
  );
  check(
    (
      await req(root + "/story", "gm", "POST", {
        action: "save",
        id: story.id,
        version: story.version,
        document: {
          ...document,
          sections: {
            ...document.sections,
            background: 'cvk-html-v1:<img src="/api/files?id=missing-file">',
          },
        },
      })
    ).s === 404,
    "P2A rich images require an existing authorized file",
  );
  const uploadBody=new FormData();uploadBody.set('visibility','sl');uploadBody.set('file',new File([Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'))],'P2A-PRIVATE.png',{type:'image/png'}));
  const uploaded=await req('/api/files','gm','POST',uploadBody);check(uploaded.s===200,'P2A uploads a protected image through existing R2 API');
  const imageSave=await req(root+'/story','gm','POST',{action:'save',id:story.id,version:story.version,document:{...document,sections:{...document.sections,background:'cvk-html-v1:<img src="/api/files?id='+uploaded.d.id+'" alt="P2A PRIVATE IMAGE">'}}});
  check(imageSave.s===200&&imageSave.d.story.sections.background.includes(uploaded.d.id),'P2A existing protected image linked without copying file');
  check((await req('/api/files','a','DELETE',{id:uploaded.d.id})).s===404,'P2A another owner cannot delete private preparation media');
  check((await req('/api/files','gm','DELETE',{id:uploaded.d.id})).s===409,'P2A referenced preparation media cannot be deleted');
  const imageRemoved=await req(root+'/story','gm','POST',{action:'save',id:story.id,version:imageSave.d.story.version,document:{...document,sections:{...document.sections,background:'No current image'}}});check(imageRemoved.s===200,'P2A current image association can be edited');
  check((await req('/api/files','gm','DELETE',{id:uploaded.d.id})).s===409,'P2A image needed by recoverable history remains protected');
  const foreign = "p2a-foreign-" + randomUUID();
  localSql(
    `INSERT INTO files(id,campaign_id,owner_id,visibility,name,mime,size,key,created_at) VALUES(${sqlQuote(foreign)},'phase-b-other-campaign','nobody','sl','x.png','image/png',8,'never-uploaded','now')`,
  );
  check(
    (
      await req(root + "/scenes", "gm", "POST", {
        action: "save",
        id: child.id,
        version: child.version,
        document: {
          ...child.document,
          elements: [
            {
              id: randomUUID(),
              kind: "image",
              title: "Foreign",
              text: "",
              referenceId: "",
              fileId: foreign,
            },
          ],
        },
      })
    ).s === 404,
    "P2A foreign campaign file rejected",
  );
  check(
    (await req(root + "/preparation", "gm")).d.places.length === baseCount,
    "P2A links never copy or create place nodes",
  );
  const catalog = await req(root + "/preparation", "gm");
  check(
    catalog.d.places.some((p) => p.id === "place.electric-taberna"),
    "P2A central place catalog uses existing stable identity",
  );
  // Archive is a recoverable preparation change, never a destructive delete.
  for (const [kind, id] of [['story',story.id],['preparation',prepared.id],['scenes',child.id]]) {
    const key=kind==='story'?'story':kind==='scenes'?'scene':'session';
    let old=(await req(root+'/'+kind+'?id='+id,'gm')).d[key];
    const doc=kind==='story'?{title:old.title,summary:old.summary,status:old.status,favorite:old.favorite,pinned:old.pinned,sections:old.sections,references:old.references,possibilities:old.possibilities}:old.document;
    const archived=kind==='scenes'?{...doc,archived:true}:{...doc,status:'archived'};
    check((await req(root+'/'+kind,'a','POST',{action:'save',id,version:old.version,document:archived})).s===403,'ARCHIVE player cannot archive SL '+kind);
    const saved=await req(root+'/'+kind,'gm','POST',{action:'save',id,version:old.version,document:archived});
    check(saved.s===200,'ARCHIVE SL archives '+kind);
    check((await req(root+'/'+kind,'gm','POST',{action:'save',id,version:old.version,document:archived})).s===409,'ARCHIVE stale revision rejected '+kind);
    old=(await req(root+'/'+kind+'?id='+id,'gm')).d[key];
    check(kind==='scenes'?old.document.archived===true:kind==='story'?old.status==='archived':old.document.status==='archived','ARCHIVE persists on fresh read '+kind);
    check((await req(root+'/'+kind,'gm','POST',{action:'save',id,version:old.version,document:doc})).s===200,'ARCHIVE can restore original content '+kind);
  }

}
