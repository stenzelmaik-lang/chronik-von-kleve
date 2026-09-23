"""Reproduce the Sprint 2 evidence package. Never execute legacy code.

Collect once with --collect <legacy-root> <second-legacy-root> using the reviewed
Drive downloads in work/recovery. Later rebuild solely from recovery/inputs.
Original credential-bearing files remain at source; only hashes are retained.
"""
import base64, collections, datetime, gzip, hashlib, json, pathlib, re, shutil, sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'recovery'; INPUT=OUT/'inputs'; RAW=INPUT/'raw'
def digest(b):return hashlib.sha256(b).hexdigest()
def read(p):return json.loads(pathlib.Path(p).read_text(encoding='utf-8-sig'))
def write(p,d):
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def identity(kind,legacy):return 'legacy-'+digest((kind+':'+str(legacy)).encode())[:24]
def secret_keys(d):
 if isinstance(d,dict):return any(re.search(r'^(password|password_hash|passwd|token|api_key|session_id|secret|credential)$',k,re.I) or secret_keys(v) for k,v in d.items())
 if isinstance(d,list):return any(secret_keys(v) for v in d)
 return False
def collect(roots):
 RAW.mkdir(parents=True,exist_ok=True);sources=[]
 def add(p,ref,category,expected=None):
  b=p.read_bytes();sha=digest(b)
  if expected and expected!=sha:raise ValueError('Hash mismatch '+ref)
  sid='source-'+digest((ref+'@'+sha).encode())[:24]
  try:d=json.loads(b.decode('utf-8-sig'))
  except (ValueError,UnicodeError):d=None
  restricted=('users.json' in p.name or secret_keys(d))
  store=category!='TECHNICAL_ONLY' and not restricted
  package='raw/'+sha+'.txt' if store else None
  if store:(INPUT/package).write_bytes(b)
  sources.append(dict(id=sid,ref=ref,name=p.name,category=category,sha256=sha,bytes=len(b),mtime=datetime.datetime.fromtimestamp(p.stat().st_mtime,datetime.timezone.utc).isoformat(),packagePath=package,confidentiality='GM_ONLY',decision='AUTH_EXCLUDED_HASH_RETAINED' if restricted else 'HASH_ONLY_TECHNICAL_REFERENCE' if not store else 'PRESERVE_ORIGINAL_REVIEW',sourceType='JSON' if d is not None else 'TEXT'))
  return sources[-1]
 registry=read(ROOT/'work/recovery/raw/source-registry-input.json')
 names={'assets/data/archive/index.json':'archive-index.json','database/schema.sql':'database-schema.sql'}
 for s in registry['sources']:
  if not s.get('project_copy_drive_id'):continue
  p=ROOT/'work/recovery/raw'/names.get(s['name'],s['name'])
  if not p.exists():
   rel=s['name'] if s['name'].startswith(('assets/','database/')) else 'assets/data/'+s['name']
   origin=pathlib.Path(roots[0])/rel
   if not origin.exists():raise ValueError('Missing official source '+s['name'])
   if s.get('sha256') and digest(origin.read_bytes())!=s['sha256']:raise ValueError('Unverified source '+s['name'])
   shutil.copyfile(origin,p)
  x=add(p,'https://drive.google.com/file/d/'+s['project_copy_drive_id']+'/view','TECHNICAL_ONLY' if s['type'] in ['sql','json-schema'] else 'LEGACY',s.get('sha256'))
  x.update(registryId=s['source_id'],expectedCount=s['record_count'],sourceVersion='Drive registry 2026-09-14; historical date in registry id',sourceName=s['name'])
 for n in ['auftrag-002','website-master','pnp-master','db-0','db-1','db-2','db-3']:
  p=ROOT/'work/recovery/docs'/(n+'.json');d=read(p)
  x=add(p,'https://docs.google.com/document/d/'+d.get('documentId',d.get('id')),'DOCUMENT');x.update(sourceType='GOOGLE_DOC_TEXT_EXPORT',sourceVersion=d.get('revisionId'),documentRole=n,name=d['title'])
 for n in ['source-registry-input.json','conflicts-input.json']:add(ROOT/'work/recovery/raw'/n,'official-project/'+n,'REGISTRY')
 for root in roots:
  rp=pathlib.Path(root)
  for p in sorted(rp.rglob('*')):
   if not p.is_file() or any(x in ['.git','node_modules','.vscode','cache'] for x in p.relative_to(rp).parts):continue
   rel=p.relative_to(rp).as_posix()
   if p.suffix.lower() not in ['.json','.sql','.php','.html','.md','.js','.py','.css'] and '.json.' not in p.name:continue
   category='LEGACY' if (rel.startswith(('assets/data/','assets/nsc/')) and ('.json' in p.name)) else 'TECHNICAL_ONLY'
   x=add(p,p.as_posix(),category);x.update(sourceName=rel,sourceVersion='Local preserved snapshot; mtime is not proof of play')
 # Current baseline is an input snapshot, never replaced during this sprint.
 add(ROOT/'server/catalog.json','git:d1386ee45b7af000e2fa4898478e4c1ec034dd51/server/catalog.json','BASELINE')
 write(INPUT/'sources.json',sources)

if len(sys.argv)>1 and sys.argv[1]=='--collect':collect(sys.argv[2:])
sources=read(INPUT/'sources.json');catalog=read(ROOT/'server/catalog.json');catalog_ids={r['id']:r for r in catalog}
records=[];blobs={};conflicts=read(ROOT/'work/recovery/raw/conflicts-input.json') if not (INPUT/'conflicts.json').exists() else read(INPUT/'conflicts.json')
write(INPUT/'conflicts.json',conflicts)
place_ids=['archiv-hochschule-rhein-waal','bahnhof-kleve-nord-gleis-der-toten-echos','bibliothek-der-propstei-das-steinerne-herz','electric-taberna-neon-schatten','friedhof-materborn-schiefe-gruefte','galerie-freiraum-elten-dornen-im-beton','kaserne-schwarzholz-ultio','neuer-ort-1764071552175','parkhaus-oberstadt-rueckwaertsblutung','stenten-bestattungen-die-stille-die-luegt','wohnung-hannah-richter-das-redaktionsbuero-des-wahnsinns']
npc_ids=['elara-bosch','grigori-volkov','hannah-richter','jansen-kpp','johanna-de-valombre','justikar-hardenberg','konstantin-von-straeten','mephisto','avi','pit-ghul-rhino','rhino-gruber','silas-vance','sofia','syntax']
kind_type={'schauplaetze':'PLACE','nscs':'NPC','chronik':'CHRONICLE','archiv':'HANDOUT','termine':'SESSION','neuigkeiten':'CHRONICLE','haendler':'MERCHANT','regelwerk':'RULE'}
terms={'ultio-founder':['ultio','hardenberg'],'taberna-elysium':['taberna','elysium'],'bleisack-schwanenburg':['bleisarg','bleisack','schwanenburg'],'volkov-nature':['volkov'],'johanna-cosmology':['johanna','lilith'],'silas-triggers':['silas','vance'],'schaefer-role':['schäfer','schaefer'],'kaserne-residency':['kaserne'],'pc-helena':['helena'],'pc-corvina':['corvina'],'pc-cat':['cat roux','alaric'],'session05':['sitzung 05','sitzung-05','s3:'],'diary-history':['chronik.diary']}
def add_record(s,pointer,v,kind='LEGACY',status='GM_REVIEW',target=None,legacy=None,reason=None):
 title=(v.get('title') or v.get('name') or v.get('label') or v.get('text','')[:160]) if isinstance(v,dict) else str(v)[:160]
 title=str(title or s['name'])[:240]
 legacy=legacy if legacy is not None else v.get('id',v.get('slug')) if isinstance(v,dict) else None
 rid='recovery-'+digest((s['id']+'#'+pointer).encode())[:24]
 # Only recovered identities with explicit IDs share a native recovery entity.
 entity=target or ('recovered-'+digest((kind+':'+str(legacy)).encode())[:24] if kind in ['schauplaetze','nscs'] and legacy is not None else 'recovered-'+rid[9:])
 text=json.dumps(v,ensure_ascii=False).lower()
 links=['conflict.'+k for k,ts in terms.items() if any(t in text for t in ts)]
 if s.get('sourceName','').endswith('chronik.diary.json'):links.append('conflict.diary-history')
 records.append(dict(id=rid,sourceId=s['id'],pointer=pointer,legacyId=None if legacy is None else str(legacy),entityId=entity,entityType=kind_type.get(kind,kind if kind in ['CHARACTER','SCENE','FACTION','NOTE','LEGACY','RULE'] else 'LEGACY'),title=title,recoveryStatus=status,confidentiality='GM_ONLY',decision=reason or ('LINK_EXISTING_ID_NO_OVERWRITE' if target in catalog_ids else 'RETAIN_SOURCE_CLAIM_NO_CANON_PROMOTION'),mappingBasis='accepted catalog original kind:id SHA256 algorithm' if target in catalog_ids else 'source-scoped identity; no fuzzy-name merge',conflictWith=sorted(set(links)),supersedes=[],supersededBy=[],payloadHash=digest(json.dumps(v,ensure_ascii=False,separators=(',',':')).encode())))
 if (status=='TECHNICAL_ONLY' and not target) or (kind=='LEGACY' and not target):records[-1]['entityId']=None
 return records[-1]
for s in sources:
 start=len(records)
 if not s['packagePath']:s.update(recordCount=None,coverageStatus='REFERENCED_ONLY');continue
 b=(INPUT/s['packagePath']).read_bytes()
 if digest(b)!=s['sha256']:raise ValueError('Original changed '+s['id'])
 blobs[s['sha256']]=base64.b64encode(gzip.compress(b,mtime=0)).decode()
 d=json.loads(b.decode('utf-8-sig'));name=s.get('sourceName',s['name']);role=s.get('documentRole')
 if role:
  place_n=npc_n=0;prep=False
  for i,p in enumerate(d['paragraphs']):
   t=p['text'];kind='LEGACY';target=None;status='WORKING';legacy=None
   if role=='db-2' and re.match(r'^\d+\. ',t):
    legacy=place_ids[place_n];place_n+=1;kind='schauplaetze';target=identity(kind,legacy);status='GM_REVIEW'
   if role=='db-1' and ' — ' in t:
    legacy=npc_ids[npc_n];npc_n+=1;kind='nscs';target=identity(kind,legacy);status='GM_REVIEW'
   if role=='db-0':
    if t.startswith('TEIL B:'):prep=True
    kind='SCENE';status='UNPLAYED_PREP' if prep else 'GM_REVIEW';target='recovered-'+digest(('sl_plots:4' if prep else 'sl_plots:1').encode())[:24]
   if role=='db-3':status='CONTRADICTION' if any(x in t for x in ['HELENA','CORVINA','CAT /']) else 'GM_REVIEW'
   if role=='auftrag-002':status='TECHNICAL_ONLY'
   add_record(s,'/paragraphs/'+str(i),p,kind,status,target,legacy,reason='DERIVED_DOCUMENT_TEXT_NOT_RAW_DATABASE_ROW')
  if role=='db-1':assert npc_n==14
  if role=='db-2':assert place_n==11
 elif s['category']=='BASELINE':
  for i,v in enumerate(d):add_record(s,'/'+str(i),v,kind_type.get(v['kind'],'LEGACY'),'GM_REVIEW',v['id'],v['id'],'BASELINE_RETAINED_UNCHANGED')
 elif s['category']=='REGISTRY':add_record(s,'',d,'LEGACY','TECHNICAL_ONLY')
 elif 'merchants.json' in name:
  for k,v in d.items():
   add_record(s,'/'+k,v,'haendler','RECOVERY_MECHANICS',identity('haendler',k),k)
   for i,item in enumerate(v['items']):add_record(s,'/'+k+'/items/'+str(i),item,'LEGACY','RECOVERY_MECHANICS',identity('haendler',k),item.get('id'),reason='ITEM_RETAINED_AS_MERCHANT_FUNDUS_NO_REBALANCE')
 elif 'encounters.json' in name:
  for key,kind in [('begegnungen','SCENE'),('orte','LEGACY')]:
   seq=d[key]
   for k,v in (enumerate(seq) if isinstance(seq,list) else seq.items()):add_record(s,'/'+key+'/'+str(k),v,kind,'RECOVERY_FUNDUS')
 else:
  kind='LEGACY';status='GM_REVIEW';seq=None;prefix=''
  if name.startswith('assets/nsc/') or 'nscs-detailliert' in name:kind='nscs'
  elif 'places' in name:kind='schauplaetze'
  elif 'chronik.diary' in name:kind='chronik';seq=d['entries'];prefix='/entries'
  elif 'archive/index' in name:kind='archiv';seq=d['records'];prefix='/records'
  elif 'archive.json' in name:kind='archiv';seq=d['entries'];prefix='/entries'
  elif 'archive/records/' in name:kind='archiv'
  elif 'news.json' in name:kind='neuigkeiten';seq=d['news'];prefix='/news'
  elif 'events.json' in name:kind='termine';seq=d['events'];prefix='/events';status='HISTORICAL_TECHNICAL'
  elif '/rules/' in name:kind='regelwerk';status='RECOVERY_MECHANICS'
  elif name.endswith('profiles.json'):kind='CHARACTER';status='WORKING'
  elif '/pages/' in name or name.endswith(('nav.json','vtm-labels-de.json')):status='TECHNICAL_ONLY'
  if seq is None:seq=d if isinstance(d,list) else [d];prefix='' if isinstance(d,list) else None
  duplicates=collections.Counter(str(v.get('id')) for v in seq if isinstance(v,dict) and v.get('id') is not None)
  for i,v in enumerate(seq):
   legacy=v.get('id',v.get('slug',i)) if isinstance(v,dict) else i
   target=identity(kind,legacy)
   if '/rules/' in name:target=identity('regelwerk',pathlib.PurePosixPath(name).name)
   if name=='assets/data/pages/gefallen.json':kind='archiv';target=identity('archiv',0)
   if target not in catalog_ids:target=None
   if name.endswith('profiles.json') and isinstance(v,dict) and v.get('id')=='wachmann':status='TEST_DATA'
   r=add_record(s,('' if prefix is None else prefix+'/'+str(i)),v,kind,status,target,legacy)
   if duplicates[str(legacy)]>1:
    r['entityId']='recovered-'+r['id'][9:];r['decision']='DUPLICATE_ID_RETAIN_BOTH_NO_MERGE';r['conflictWith'].append('conflict.duplicate-news-id')
  if not seq:s['decision']='CHECKED_EMPTY_NO_RECORDS'
 s.update(recordCount=len(records)-start,coverageStatus='ALL_SOURCE_RECORDS_INDEXED_GM_ONLY')

# Each input is retained whole, including unknown fields and container metadata.
# Parsed records are an index over immutable sources, not rewritten source data.
missing=[dict(table=k,documentedCount=v,materializedRawCount=0,status='RAW_DUMP_NOT_FOUND',decision='DERIVED_EVIDENCE_ONLY_NO_SYNTHETIC_ROWS') for k,v in {'places':11,'nscs':14,'characters':7,'character_profiles':4,'sl_plots':4,'sl_notes':2,'inventory_items':41,'rule_documents':14,'rule_entries':31,'messages':25,'login_history':192}.items()]
extra=[dict(id='conflict.duplicate-news-id',topic='Doppelte news-001',status='CONTRADICTION',legacy_claim='Zwei Beiträge teilen dieselbe ID im offiziellen Snapshot.',current_ruling='Keine automatische Zusammenführung.',action='Beide anhand Quelle und JSON-Pointer erhalten.'),dict(id='conflict.places-10-11',topic='Ortsversionen',status='OPEN',legacy_claim='10 statische Orte, 11 spätere DB-Orte; lokale Backups haben weitere/testverdächtige Einträge.',current_ruling='Versionsunterschied ist kein neuer Kanon.',action='Alle Quellstände erhalten; kein automatischer Zeitablauf.')]
for c in conflicts['conflicts']+extra:c['recordIds']=[r['id'] for r in records if c['id'] in r['conflictWith']]
manifest=dict(format='cvk-recovery-package',version=1,campaignId='chronik-von-kleve',baselineCommit='d1386ee45b7af000e2fa4898478e4c1ec034dd51',sources=sources,records=records,conflicts=conflicts['conflicts']+extra,missingRawTables=missing)
write(OUT/'manifest.json',manifest);write(OUT/'coverage.json',dict(sources=sources,records=records,missingRawTables=missing));write(OUT/'legacy-id-mapping.json',[{k:r[k] for k in ['id','sourceId','pointer','legacyId','entityId','mappingBasis','decision']} for r in records]);write(OUT/'place-version-matrix.json',[r for r in records if r['entityType']=='PLACE']);write(OUT/'conflicts.json',manifest['conflicts'])
write(ROOT/'server/recovery-package.json',dict(manifest=manifest,blobs=blobs))
print(json.dumps(dict(sources=len(sources),materializedSources=sum(bool(s['packagePath']) for s in sources),uniqueOriginals=len(blobs),records=len(records),packageBytes=(ROOT/'server/recovery-package.json').stat().st_size)))
