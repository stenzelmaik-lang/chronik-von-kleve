import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

/** A whole machined cylinder, rendered only on rotation/resize. No animation loop or external textures. */
/** @param {HTMLCanvasElement} canvas */
export function createAudioKnob(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
 renderer.setClearColor(0x000000,0);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1.05,1.05,.66,-.66,.1,50);
 const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.04,.1,100,{size:64});room.dispose();pmrem.dispose();scene.environment=environment.texture;scene.environmentIntensity=1.5;
 camera.position.set(0,3.2,8);camera.lookAt(0,0,0);
 scene.add(new THREE.HemisphereLight(0xe8d4b6,0x161311,3));
 const key=new THREE.DirectionalLight(0xffdfb6,4);key.position.set(-3,5,4);scene.add(key);
 const fill=new THREE.DirectionalLight(0xa4adb4,.9);fill.position.set(3,2,-4);scene.add(fill);
 const textureCanvas=document.createElement('canvas');textureCanvas.width=textureCanvas.height=256;
 const ctx=textureCanvas.getContext('2d');ctx.fillStyle='#a59d91';ctx.fillRect(0,0,256,256);
 let seed=7291;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<1200;i++){const x=random()*256,y=random()*256;ctx.strokeStyle=i%3?'#16120d18':'#e6d3ac38';ctx.lineWidth=.4+random()*.8;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*18-9,y+random()*8-4);ctx.stroke();}
 const texture=new THREE.CanvasTexture(textureCanvas);texture.colorSpace=THREE.SRGBColorSpace;
 // Reuse the original worn cap as the top's UV texture; perspective is restored by the real cylinder.
 const photo=new THREE.TextureLoader().load('/spieltisch/ultio-audio-device-crest.webp',()=>{canvas.dataset.texture='ready';draw();});photo.colorSpace=THREE.SRGBColorSpace;photo.offset.set(1220/1671,1-91/941);photo.repeat.set(202/1671,78/941);
 const side=new THREE.MeshStandardMaterial({color:0x3b342d,metalness:.72,roughness:.44});
 const top=new THREE.MeshStandardMaterial({color:0xaaa39a,map:photo,bumpMap:texture,bumpScale:.018,metalness:.3,roughness:.6});
 const dark=new THREE.MeshStandardMaterial({color:0x17130f,metalness:.5,roughness:.65});
 const ribMaterial=new THREE.MeshStandardMaterial({color:0x5a5047,metalness:.72,roughness:.42});
 const rotor=new THREE.Group();scene.add(rotor);
 const body=new THREE.Mesh(new THREE.CylinderGeometry(.98,.98,.48,64),[side,top,dark]);rotor.add(body);
 const bevel=new THREE.Mesh(new THREE.CylinderGeometry(.92,.99,.07,64),[side,top,dark]);bevel.position.y=.255;rotor.add(bevel);
 const face=new THREE.Mesh(new THREE.CylinderGeometry(.92,.92,.018,64),[side,top,dark]);face.position.y=.298;rotor.add(face);
 const ribGeometry=new THREE.BoxGeometry(.045,.42,.08);
 for(let i=0;i<32;i++){const angle=i/32*Math.PI*2,rib=new THREE.Mesh(ribGeometry,ribMaterial);rib.position.set(Math.sin(angle)*.99,-.015,Math.cos(angle)*.99);rib.rotation.y=angle;rotor.add(rib);}
 const marker=new THREE.Mesh(new THREE.BoxGeometry(.042,.012,.22),new THREE.MeshStandardMaterial({color:0xead8ad,metalness:.4,roughness:.55}));marker.position.set(0,.319,-.64);rotor.add(marker);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.73,.008,6,64),dark);ring.rotation.x=Math.PI/2;ring.position.y=.313;rotor.add(ring);
 let volume=.8,disposed=false,lastWidth=0,lastHeight=0;
 function draw(){if(disposed)return;const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);if(w!==lastWidth||h!==lastHeight){renderer.setSize(w,h,false);camera.left=-.66*w/h;camera.right=.66*w/h;camera.updateProjectionMatrix();lastWidth=w;lastHeight=h;}rotor.rotation.y=-(-135+volume*270)*Math.PI/180;canvas.dataset.angle=String(-135+volume*270);renderer.render(scene,camera);}
 const observer=new ResizeObserver(draw);observer.observe(canvas);draw();
 return {/** @param {number} value */ update(value){volume=Math.max(0,Math.min(1,value));draw();},dispose(){disposed=true;observer.disconnect();const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();texture.dispose();photo.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
