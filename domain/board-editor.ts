import type {BoardElement,BoardPoint} from './live-table';
export function boardTextLines(text:string):string[]{return text.split('\n').flatMap(paragraph=>{const lines:string[]=[];let rest=paragraph;while(rest.length>42){const space=rest.lastIndexOf(' ',42),cut=space>0?space:42;lines.push(rest.slice(0,cut));rest=rest.slice(cut).trimStart();}lines.push(rest);return lines;});}
export function moveBoardElement(element:BoardElement,dx:number,dy:number):BoardElement {
 const box=boardBounds(element);
 const x=Math.max(-box.x,Math.min(1000-box.x-box.width,Math.round(dx))),y=Math.max(-box.y,Math.min(600-box.y-box.height,Math.round(dy)));
 return {...element,points:element.points.map(p=>[p[0]+x,p[1]+y] as BoardPoint)};
}
export function boardBounds(element:BoardElement){
 const xs=element.points.map(p=>p[0]),ys=element.points.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys);
 const lines=element.text?boardTextLines(element.text):[];
 return {x,y,width:element.fileId?320:element.text?Math.max(90,lines.reduce((n,s)=>Math.max(n,s.length),0)*11):Math.max(8,Math.max(...xs)-x),height:element.fileId?240:element.text?Math.max(28,lines.length*26):Math.max(8,Math.max(...ys)-y)};
}
