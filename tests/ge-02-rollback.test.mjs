import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneDocumentSchema,emptyScene,sceneWithoutStructuredChecks} from '../domain/story-scene.ts';
// GE-02 release: a rollback to an older build must not leave scenes the old strict schema rejects.
const check={attributeId:'dexterity',abilityId:'larceny',difficulty:7,targetCharacterIds:['char-a'],consequences:{success:'Schlüssel <erbeutet>',failure:'',botch:'Schäfer merkt es.'}};
const element={id:crypto.randomUUID(),kind:'check',title:'Schlüsselbund stehlen',text:'<p>Wenn Schäfer abgelenkt ist.</p>',referenceId:'',fileId:'',check};

test('structured checks become lossless free text without the check field',()=>{
 const doc=sceneDocumentSchema.parse({...emptyScene(),elements:[element]});
 const {document,changed}=sceneWithoutStructuredChecks(doc);
 assert.equal(changed,1);const e=document.elements[0];
 assert.equal('check' in e,false,'old builds reject unknown element fields');
 assert.match(e.text,/Wenn Schäfer abgelenkt ist\./);assert.match(e.text,/Attribut Geschick · Fähigkeit Diebstahl · SG 7 · Figuren char-a/);
 assert.match(e.text,/Erfolg: Schlüssel &lt;erbeutet&gt; · Patzer: Schäfer merkt es\./,'escaped, nothing lost');
 assert.equal(sceneDocumentSchema.safeParse(document).success,true,'still a valid scene');
 assert.equal(sceneWithoutStructuredChecks(document).changed,0,'idempotent');
 const plain=sceneDocumentSchema.parse({...emptyScene(),elements:[{...element,check:undefined}]});
 assert.equal(sceneWithoutStructuredChecks(plain).document,plain,'scenes without structured checks stay untouched');
});
