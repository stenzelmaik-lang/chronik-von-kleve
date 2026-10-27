import RAPIER from '@dimforge/rapier3d-compat';
import {d10} from './dice-geometry.mjs';

let ready;
export const DIE_RADIUS=.43;
/** Shared physical/render geometry: an eight-sided tray at the stage origin. */
export function trayLayout(count){
  if(!Number.isInteger(count)||count<1||count>30)throw Error('Ungültige Anzahl physischer Würfel.');
  const columns=Math.ceil(Math.sqrt(count*1.4)),rows=Math.ceil(count/columns),radius=Math.max(2.35,Math.hypot(columns*.47,rows*.47)+.85),apothem=radius*Math.cos(Math.PI/8);
  const walls=Array.from({length:8},(_,i)=>{const angle=i*Math.PI/4;return {angle,x:apothem*Math.cos(angle),z:apothem*Math.sin(angle),length:2*radius*Math.sin(Math.PI/8)+.2};});
  return {columns,rows,radius,apothem,wallHeight:1.1,walls};
}
export function motionRandom(seed){
  if(!Array.isArray(seed)||seed.length!==4||seed.some(n=>!Number.isInteger(n)||n<0||n>0xffffffff))throw Error('Ungültiger Bewegungsseed.');
  let [a,b,c,d]=seed.map(v=>v>>>0);if(!(a|b|c|d))d=1;
  const rot=(x,k)=>(x<<k)|(x>>>(32-k));
  return ()=>{const r=(rot((a+d)>>>0,7)+a)>>>0,t=b<<9;c^=a;d^=b;b^=c;a^=d;c^=t;d=rot(d,11);return r/4294967296;};
}
function rotation(random){const u=random(),a=random()*Math.PI*2,b=random()*Math.PI*2;return {x:Math.sqrt(1-u)*Math.sin(a),y:Math.sqrt(1-u)*Math.cos(a),z:Math.sqrt(u)*Math.sin(b),w:Math.sqrt(u)*Math.cos(b)};}
function aborted(signal){if(signal?.aborted)throw new DOMException('Wurfdarstellung abgebrochen.','AbortError');}

/** One outcome-independent physics pass. This function never receives dice values or a target. */
export async function prepareThrow(count,seed,{signal,yieldControl=async()=>{}}={}){
  if(!Number.isInteger(count)||count<1||count>30)throw Error('Ungültige Anzahl physischer Würfel.');
  const random=motionRandom(seed);aborted(signal);await (ready??=RAPIER.init());aborted(signal);
  const started=performance.now(),world=new RAPIER.World({x:0,y:-9.81,z:0}),events=new RAPIER.EventQueue(true);
  world.timestep=1/120;world.numSolverIterations=8;
  const tray=trayLayout(count),{columns,rows,radius}=tray,width=radius*2+columns*1.7+6,depth=radius*2+6,side=random()<.5?-1:1;
  const bodies=[],launches=[],releaseTimes=[],ids=new Map(),frames=[],pairs=new Set();let contacts=0,floorContacts=0,steps=0,asleep=false;
  const capture=()=>{const frame=new Float32Array(count*7);bodies.forEach((body,i)=>{const p=body.translation(),q=body.rotation();frame.set([p.x,p.y,p.z,q.x,q.y,q.z,q.w],i*7);});frames.push(frame);};
  try{
    world.createCollider(RAPIER.ColliderDesc.cuboid(width/2+.3,.12,depth/2+.3).setTranslation(0,-.12,0).setFriction(.8).setRestitution(.18));
    for(const wall of tray.walls)world.createCollider(RAPIER.ColliderDesc.cuboid(.12,tray.wallHeight/2,wall.length/2).setTranslation(wall.x,tray.wallHeight/2,wall.z).setRotation({x:0,y:Math.sin(-wall.angle/2),z:0,w:Math.cos(-wall.angle/2)}).setFriction(.7).setRestitution(.2));
    const hull=new Float32Array(d10.vertices.flatMap(p=>p.map(v=>v*DIE_RADIUS)));
    for(let i=0;i<count;i++){
      const col=i%columns,row=Math.floor(i/columns),x=side*(radius+1.3+random()*.2),z=(row-(rows-1)/2)*1.03+(random()-.5)*.15,y=2.1+random()*.35;
      const targetX=side*radius*.3+(random()-.5)*.55,targetZ=(row-(rows-1)/2)*.95+(random()-.5)*.4,flight=Math.sqrt(2*y/9.81),release=col*.18+row*.025;
      const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,y,z).setRotation(rotation(random)).setLinearDamping(.2).setAngularDamping(.35).setCanSleep(true).setCcdEnabled(true).setEnabled(false));
      const desc=RAPIER.ColliderDesc.convexHull(hull);if(!desc)throw Error('W10-Kollisionskörper konnte nicht erstellt werden.');
      const collider=world.createCollider(desc.setMass(.08).setFriction(.78).setRestitution(.22).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body);ids.set(collider.handle,i);
      launches.push({release,velocity:{x:(targetX-x)/flight,y:random()*.15,z:(targetZ-z)/flight},spin:{x:(random()-.5)*17,y:(random()-.5)*17,z:(random()-.5)*17}});releaseTimes.push(release);bodies.push(body);
    }
    capture();
    for(steps=1;steps<=1200;steps++){
      for(let i=0;i<count;i++)if(!bodies[i].isEnabled()&&steps/120>=launches[i].release){bodies[i].setEnabled(true);bodies[i].setLinvel(launches[i].velocity,true);bodies[i].setAngvel(launches[i].spin,true);}
      world.step(events);
      events.drainCollisionEvents((a,b,start)=>{if(!start)return;const ai=ids.get(a),bi=ids.get(b);if(ai!==undefined&&bi!==undefined){contacts++;pairs.add([ai,bi].sort((x,y)=>x-y).join(':'));}else if(ai!==undefined||bi!==undefined)floorContacts++;});
      if(steps%2===0)capture();
      if(steps>120&&bodies.every(b=>b.isEnabled()&&b.isSleeping())){asleep=true;if(steps%2)capture();break;}
      if(steps%48===0){aborted(signal);await yieldControl();}
    }
    aborted(signal);
    return {count,seed:[...seed],width,depth,tray,releaseTimes,frames,duration:(frames.length-1)/60,asleep,contacts,diePairs:pairs.size,floorContacts,computeMs:performance.now()-started};
  }finally{events.free();world.free();}
}
