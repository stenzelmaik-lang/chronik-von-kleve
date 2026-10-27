// Render-only pentagonal trapezohedron: dual of a pentagonal antiprism.
// No random generator, physics result, rule evaluation or persisted game state.
export const dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0);
const minus=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normalize=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);};
const mean=points=>[0,1,2].map(i=>points.reduce((s,p)=>s+p[i],0)/points.length);
const ring=(i,z,offset=0)=>[Math.cos(i*Math.PI*2/5+offset),Math.sin(i*Math.PI*2/5+offset),z];
const halfHeight=.85;
const top=Array.from({length:5},(_,i)=>ring(i,halfHeight)),bottom=Array.from({length:5},(_,i)=>ring(i,-halfHeight,Math.PI/5));
function dual(a,b,c){let n=normalize(cross(minus(b,a),minus(c,a))),d=dot(n,a);return n.map(v=>v/d);}
const raw=[[0,0,1/halfHeight],[0,0,-1/halfHeight]];
for(let i=0;i<5;i++)raw.push(dual(top[i],top[(i+1)%5],bottom[i]),dual(bottom[i],bottom[(i+1)%5],top[(i+1)%5]));
const radius=Math.max(...raw.map(p=>Math.hypot(...p)));
const vertices=raw.map(p=>p.map(v=>v/radius));
const A=i=>2+2*((i+5)%5),B=i=>3+2*((i+5)%5);
function face(indices,normal,value){
  const center=mean(indices.map(i=>vertices[i])),n=normalize(normal),up=normalize(minus(vertices[indices[0]],center)),right=normalize(cross(up,n));
  const ordered=[...indices].sort((a,b)=>{const da=minus(vertices[a],center),db=minus(vertices[b],center);return Math.atan2(dot(da,up),dot(da,right))-Math.atan2(dot(db,up),dot(db,right));});
  return {indices:ordered,normal:n,center,up,right,value};
}
const faces=[];
for(let i=0;i<5;i++)faces.push(face([0,A(i),B(i-1),A(i-1)],top[i],i+1),face([1,B(i),A(i),B(i-1)],bottom[i],10-((i+3)%5)));
export const d10={vertices,faces};
export function orient(point,value){const f=faces.find(f=>f.value===value);if(!f)throw Error('W10-Ergebnis muss 1–10 sein.');return [dot(point,f.right),dot(point,f.up),dot(point,f.normal)];}
export function spin(point,progress,index=0){
  const t=Math.max(0,Math.min(1,progress)),remaining=(1-t)**3;
  let [x,y,z]=point;
  for(const [axis,angle] of [[0,(4+index%3)*Math.PI*remaining],[1,(6+index%2)*Math.PI*remaining],[2,(index%2?1:-1)*2*Math.PI*remaining]]){
    const c=Math.cos(angle),s=Math.sin(angle);
    if(axis===0)[y,z]=[y*c-z*s,y*s+z*c];else if(axis===1)[x,z]=[x*c+z*s,-x*s+z*c];else [x,y]=[x*c-y*s,x*s+y*c];
  }
  return [x,y,z];
}
export function makeDicePresentation(dice,target){
  if(!Array.isArray(dice)||dice.length<1||dice.length>30||dice.some(d=>!Number.isInteger(d)||d<1||d>10)||!Number.isInteger(target)||target<2||target>10)throw Error('Ungültiges vorhandenes W10-Ergebnis.');
  return Object.freeze({id:globalThis.crypto.randomUUID(),dice:Object.freeze([...dice]),target,motionSeed:Object.freeze(Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4))))});
}
export function rotateQuaternion(p,q){
  const [x,y,z,w]=q,l=Math.hypot(x,y,z,w),v=[x/l,y/l,z/l],s=w/l,c=cross(v,p),cc=cross(v,c);
  return p.map((n,i)=>n+2*s*c[i]+2*cc[i]);
}
export function applyMatrix(p,m){return [0,1,2].map(i=>m[i]*p[0]+m[i+3]*p[1]+m[i+6]*p[2]);}
/** A symmetry of the whole labelled shell, fixed before the first visible frame. */
export function labelRotation(finalQuaternion,value){
  const top=[...faces].sort((a,b)=>rotateQuaternion(b.normal,finalQuaternion)[1]-rotateQuaternion(a.normal,finalQuaternion)[1])[0],wanted=faces.find(f=>f.value===value);
  if(!wanted)throw Error('Ungültiges W10-Ergebnis.');
  const transform=p=>{const v=[dot(p,wanted.right),dot(p,wanted.up),dot(p,wanted.normal)];return [0,1,2].map(i=>top.right[i]*v[0]+top.up[i]*v[1]+top.normal[i]*v[2]);};
  return [[1,0,0],[0,1,0],[0,0,1]].flatMap(transform);
}
export function upwardValue(quaternion,shellRotation){
  const ranked=faces.map(face=>({value:face.value,up:rotateQuaternion(applyMatrix(face.normal,shellRotation),quaternion)[1]})).sort((a,b)=>b.up-a.up);
  if(ranked[0].up-ranked[1].up<1e-6)throw Error('Keine eindeutige obere Würfelfläche. Das protokollierte Ergebnis bleibt unverändert.');
  return ranked[0].value;
}

/** Small geometric bevels; the convex collider remains the original symmetric solid. */
export function bevelledSurface(amount=.08){
  const positions=[],uvs=[],edges=new Map(),corners=vertices.map(()=>[]);
  function triangle(a,b,c,face){
    if(dot(cross(minus(b,a),minus(c,a)),mean([a,b,c]))<0)[b,c]=[c,b];
    for(const p of [a,b,c]){positions.push(...p);const delta=minus(p,face?.center||[0,0,0]);uvs.push(face?dot(delta,face.right)*.6+.5:p[0]*.5+.5,face?dot(delta,face.up)*.6+.5:p[2]*.5+.5);}
  }
  for(const f of faces){
    const inset=f.indices.map(i=>vertices[i].map((v,k)=>v*(1-amount)+f.center[k]*amount));
    triangle(inset[0],inset[1],inset[2],f);triangle(inset[0],inset[2],inset[3],f);
    f.indices.forEach((index,i)=>{corners[index].push(inset[i]);const next=f.indices[(i+1)%4],key=[index,next].sort((a,b)=>a-b).join(':');const edge=edges.get(key)||[];edge.push({a:index,b:next,pa:inset[i],pb:inset[(i+1)%4]});edges.set(key,edge);});
  }
  for(const pair of edges.values()){const [a,b]=pair,p=b.a===a.a?b.pa:b.pb,q=b.a===a.a?b.pb:b.pa;triangle(a.pa,a.pb,q);triangle(a.pa,q,p);}
  corners.forEach((points,i)=>{const n=normalize(vertices[i]),right=normalize(cross(n,Math.abs(n[1])<.9?[0,1,0]:[1,0,0])),up=cross(n,right),center=mean(points);const ordered=[...points].sort((a,b)=>Math.atan2(dot(minus(a,center),up),dot(minus(a,center),right))-Math.atan2(dot(minus(b,center),up),dot(minus(b,center),right)));for(let j=0;j<ordered.length;j++)triangle(center,ordered[j],ordered[(j+1)%ordered.length]);});
  return {positions:new Float32Array(positions),uvs:new Float32Array(uvs)};
}
