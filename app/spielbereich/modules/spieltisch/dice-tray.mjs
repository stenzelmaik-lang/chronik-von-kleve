import * as THREE from 'three';

// Etappe 4a (ChroniPlay-Way, table level): a dark wooden rim around green felt, like an object on the table.
function fabricTexture(wood=false){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const c=canvas.getContext('2d'),data=c.createImageData(256,256);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const grain=wood?Math.sin(x*.06+Math.sin(y*.03)*2.4)*.6+Math.sin(x*.7+y*.05)*.15:Math.sin(x*17.13+y*29.71)*Math.sin(x*7.37-y*13.51),weave=wood?0:((x+y)%2)*3;
    const base=wood?[56,38,26]:[31,59,52];
    data.data.set([...base.map(v=>Math.max(0,v+grain*(wood?5:4)+weave*.4)),255],(y*256+x)*4);
  }
  c.putImageData(data,0,0);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(wood?1:4,wood?1:4);return texture;
}

/** The rendered walls use the exact same eight segments as the physical tray. */
export function addDiceTray(scene,tray,resources){
  const felt=fabricTexture(),wood=fabricTexture(true),inside=new THREE.MeshStandardMaterial({color:0xc9d6cd,map:felt,roughness:.96,envMapIntensity:.08}),outside=new THREE.MeshStandardMaterial({color:0x9c8c7c,map:wood,roughness:.72,envMapIntensity:.12}),stitches=[];
  resources.push(felt,wood,inside,outside);
  const floorGeometry=new THREE.CylinderGeometry(tray.radius,tray.radius,.14,8),floor=new THREE.Mesh(floorGeometry,inside);floor.rotation.y=Math.PI/8;floor.position.y=-.07;floor.receiveShadow=true;scene.add(floor);resources.push(floorGeometry);
  for(const wall of tray.walls){
    const bodyGeometry=new THREE.BoxGeometry(.24,tray.wallHeight,wall.length),body=new THREE.Mesh(bodyGeometry,outside);body.position.set(wall.x,tray.wallHeight/2,wall.z);body.rotation.y=-wall.angle;body.castShadow=true;body.receiveShadow=true;scene.add(body);resources.push(bodyGeometry);
    const panelGeometry=new THREE.BoxGeometry(.012,tray.wallHeight-.07,wall.length-.06),panel=new THREE.Mesh(panelGeometry,inside);panel.position.set(wall.x-Math.cos(wall.angle)*.126,tray.wallHeight/2-.01,wall.z-Math.sin(wall.angle)*.126);panel.rotation.y=-wall.angle;panel.receiveShadow=true;scene.add(panel);resources.push(panelGeometry);
    const lipGeometry=new THREE.BoxGeometry(.26,.055,wall.length+.02),lip=new THREE.Mesh(lipGeometry,inside);lip.position.set(wall.x,tray.wallHeight,wall.z);lip.rotation.y=-wall.angle;lip.castShadow=true;scene.add(lip);resources.push(lipGeometry);
    for(let t=-wall.length/2+.1;t<wall.length/2-.12;t+=.16)for(const d of [t,t+.075])stitches.push(wall.x-Math.cos(wall.angle)*.137-Math.sin(wall.angle)*d,tray.wallHeight-.07,wall.z-Math.sin(wall.angle)*.137+Math.cos(wall.angle)*d);
  }
  const seamGeometry=new THREE.BufferGeometry();seamGeometry.setAttribute('position',new THREE.Float32BufferAttribute(stitches,3));const seamMaterial=new THREE.LineBasicMaterial({color:0xbca271,transparent:true,opacity:.35});scene.add(new THREE.LineSegments(seamGeometry,seamMaterial));resources.push(seamGeometry,seamMaterial);
}
