import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {prepareThrow,DIE_RADIUS} from './dice-physics.mjs';
import {d10,bevelledSurface,labelRotation,upwardValue} from './dice-geometry.mjs';
import {addDiceTray} from './dice-tray.mjs';

function smokeTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d'),data=c.createImageData(256,256);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const v=Math.sin(x*.037+Math.sin(y*.025)*3)+Math.sin(y*.065+Math.sin(x*.019)*4)+Math.sin((x+y)*.13)*.3;
    const n=15+Math.max(0,v)*16,i=(y*256+x)*4;data.data.set([n*.94,n,n*1.07,255],i);
  }
  c.putImageData(data,0,0);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function numeralTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const c=canvas.getContext('2d');
  c.font='600 180px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#f2d7aa';c.strokeStyle='#f2d7aa';c.lineWidth=5;
  for(let value=1;value<=10;value++){const x=((value-1)%4)*256+128,y=Math.floor((value-1)/4)*256+128;c.fillText(String(value),x,y,210);if(value===6||value===9){c.beginPath();c.moveTo(x-35,y+66);c.lineTo(x+35,y+66);c.stroke();}}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function numeralGeometry(){
  const positions=[],uv=[];
  for(const face of d10.faces){
    const col=(face.value-1)%4,row=Math.floor((face.value-1)/4),size=face.value===10?.7:.66;
    const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>face.center.map((v,i)=>v+face.right[i]*x*size/2+face.up[i]*y*size/2+face.normal[i]*.005));
    const coords=[[0,1],[1,1],[1,0],[0,0]];
    for(const i of [0,1,2,0,2,3]){positions.push(...corners[i]);uv.push((col+coords[i][0])/4,1-(row+coords[i][1])/4);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();return geometry;
}

/** Renderer/physics adapter only. Neither values nor evaluation can be altered here. */
/** @param {HTMLElement} host @param {any} result @param {{signal?:AbortSignal,onSettled?:()=>void,onMetrics?:(value:any)=>void,onFailure?:(error:Error)=>void,staticStart?:boolean}} options */
export function createDiceView(host,result,{signal,onSettled,onMetrics,onFailure,staticStart=false}={}){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  host.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-8,8,5,-5,.1,80),resources=[],groups=[];
  let plan=null,raf=0,disposed=false,settled=false,frameCount=0,started=0,observer,bounds=null,finishRequested=staticStart;
  const canvas=renderer.domElement;canvas.setAttribute('aria-hidden','true');
  const ambient=new THREE.HemisphereLight(0xe4edf5,0x36323a,1.25);scene.add(ambient);
  const key=new THREE.DirectionalLight(0xffedda,1.7);key.position.set(-5,12,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.00035;key.shadow.normalBias=.015;scene.add(key);
  const rim=new THREE.DirectionalLight(0x9baec4,.85);rim.position.set(5,5,-6);scene.add(rim);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;pmrem.dispose();room.dispose();resources.push(environment);
  function render(){if(disposed)return;renderer.render(scene,camera);frameCount++;canvas.dataset.frameCount=String(frameCount);}
  function resize(){if(disposed)return;const b=host.getBoundingClientRect(),w=Math.max(1,b.width),h=Math.max(1,b.height),aspect=w/h;renderer.setSize(w,h,false);if(bounds){const vertical=Math.max(bounds.h+1.4,(bounds.w+1.4)/aspect);camera.left=-vertical*aspect/2;camera.right=vertical*aspect/2;camera.top=vertical/2;camera.bottom=-vertical/2;camera.position.set(0,14,7);camera.lookAt(0,0,0);camera.updateProjectionMatrix();}render();}
  function poseAt(time){
    if(!plan)return;const f=Math.min(plan.frames.length-1,Math.max(0,time*60)),a=Math.floor(f),b=Math.min(plan.frames.length-1,a+1),t=f-a;
    const qa=new THREE.Quaternion(),qb=new THREE.Quaternion();groups.forEach((group,i)=>{group.visible=time>=plan.releaseTimes[i];const index=i*7,pa=plan.frames[a],pb=plan.frames[b];group.position.set(THREE.MathUtils.lerp(pa[index],pb[index],t),THREE.MathUtils.lerp(pa[index+1],pb[index+1],t),THREE.MathUtils.lerp(pa[index+2],pb[index+2],t));qa.fromArray(pa,index+3).normalize();qb.fromArray(pb,index+3).normalize();group.quaternion.copy(qa).slerp(qb,t);});
  }
  function finish(){finishRequested=true;if(disposed||settled||!plan)return;settled=true;cancelAnimationFrame(raf);poseAt(plan.duration);canvas.dataset.animationState='settled';render();onSettled?.();}
  function tick(now){if(disposed||settled||!plan)return;const elapsed=(now-started)/1000;if(elapsed>=plan.duration){finish();return;}poseAt(elapsed);render();raf=requestAnimationFrame(tick);}
  function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);observer?.disconnect();document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('webglcontextlost',lost);for(const resource of new Set(resources))resource.dispose?.();renderer.renderLists.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();scene.clear();}
  function lost(event){event.preventDefault();if(!disposed)onFailure?.(Error('3D-Kontext nicht verfügbar.'));dispose();}
  const visibility=()=>{if(document.visibilityState!=='visible'){cancelAnimationFrame(raf);}else if(plan&&!settled)finish();};document.addEventListener('visibilitychange',visibility);
  canvas.addEventListener('webglcontextlost',lost);signal?.addEventListener('abort',dispose,{once:true});
  const ready=(async()=>{
    try{
      plan=await prepareThrow(result.dice.length,[...result.motionSeed],{signal,yieldControl:()=>new Promise(resolve=>setTimeout(resolve,0))});
      if(disposed||signal?.aborted)return;
      if(!plan.asleep)throw Error('Keine stabile Würfelruhe erreicht. Das Ergebnis bleibt unverändert.');
      const finalPositions=plan.frames.at(-1);
      for(let i=0;i<plan.count;i++)if(plan.tray.walls.some(w=>finalPositions[i*7]*Math.cos(w.angle)+finalPositions[i*7+2]*Math.sin(w.angle)>plan.tray.apothem-.08))throw Error('Würfel außerhalb der Schale. Das Ergebnis bleibt unverändert.');
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for(const frame of plan.frames)for(let i=0;i<plan.count;i++){const x=frame[i*7],y=frame[i*7+1]*.4472136-frame[i*7+2]*.89442719;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
      bounds={w:Math.max(Math.abs(minX),Math.abs(maxX),plan.tray.radius+.3)*2,h:Math.max(Math.abs(minY),Math.abs(maxY),(plan.tray.radius+.3)*.89442719)*2};
      const floorGeometry=new THREE.PlaneGeometry(plan.width+4,plan.depth+4),floorMaterial=new THREE.ShadowMaterial({opacity:.28});resources.push(floorGeometry,floorMaterial);
      const floor=new THREE.Mesh(floorGeometry,floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.y=-.15;floor.receiveShadow=true;scene.add(floor);
      addDiceTray(scene,plan.tray,resources);
      key.shadow.camera.left=-plan.width/2-1;key.shadow.camera.right=plan.width/2+1;key.shadow.camera.top=plan.depth/2+2;key.shadow.camera.bottom=-plan.depth/2-2;key.shadow.camera.far=40;key.shadow.camera.updateProjectionMatrix();
      const surface=bevelledSurface(),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(surface.positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(surface.uvs,2));geometry.computeVertexNormals();
      const smoke=smokeTexture(),numerals=numeralTexture(),labels=numeralGeometry();
      const material=new THREE.MeshPhysicalMaterial({color:0x707680,map:smoke,roughness:.48,metalness:.035,clearcoat:.12,clearcoatRoughness:.5,envMapIntensity:.12});
      const labelMaterial=new THREE.MeshBasicMaterial({map:numerals,transparent:true,alphaTest:.1,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1});resources.push(geometry,labels,smoke,numerals,material,labelMaterial);
      const final=plan.frames.at(-1),endValues=[],shells=[];
      result.dice.forEach((value,i)=>{
        const q=Array.from(final.slice(i*7+3,i*7+7)),shell=labelRotation(q,value);shells.push(shell);endValues.push(upwardValue(q,shell));
        const group=new THREE.Group(),skin=new THREE.Group();skin.scale.setScalar(DIE_RADIUS);
        const matrix=new THREE.Matrix4().makeBasis(new THREE.Vector3(...shell.slice(0,3)),new THREE.Vector3(...shell.slice(3,6)),new THREE.Vector3(...shell.slice(6,9)));skin.quaternion.setFromRotationMatrix(matrix);
        const body=new THREE.Mesh(geometry,material);body.castShadow=true;body.receiveShadow=true;skin.add(body,new THREE.Mesh(labels,labelMaterial));group.add(skin);scene.add(group);groups.push(group);
      });
      if(endValues.some((value,i)=>value!==result.dice[i]))throw Error('Die sichtbaren Würfelwerte stimmen nicht überein. Das Ergebnis bleibt unverändert.');
      const metrics={duration:plan.duration,asleep:plan.asleep,contacts:plan.contacts,diePairs:plan.diePairs,computeMs:Math.round(plan.computeMs),endValues,seed:[...result.motionSeed],traySides:plan.tray.walls.length};
      canvas.dataset.endValues=endValues.join(',');canvas.dataset.contacts=String(plan.contacts);canvas.dataset.duration=String(plan.duration);canvas.dataset.animationState='rolling';onMetrics?.(metrics);
      resize();observer=new ResizeObserver(resize);observer.observe(host);poseAt(0);render();started=performance.now();if(finishRequested||document.visibilityState!=='visible')finish();else raf=requestAnimationFrame(tick);
    }catch(error){if(!disposed&&error.name!=='AbortError')onFailure?.(error);dispose();throw error;}
  })();
  return {ready,dispose,finish};
}
