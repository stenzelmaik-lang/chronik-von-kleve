import type {StageObject as StoredObject,Rect} from '@/domain/live-stage';
export type {Rect};
export type Viewer=string;
export type NoteObject=Extract<StoredObject,{kind:'note'}>;
export type StageObject=StoredObject;
export type DiceEvent={id:string;sessionId:string;sequence:number;revision:number;kind:'roll';authorId:string;authorName:string;at:string;status:'settled_open'|'closed_shared';roll:{pool:number;target:number;dice:number[]};result:import('@/domain/w10').V20Report;animationSeed:number[]};
export type DiceJournal={sessionId:string;revision:number;events:DiceEvent[]};
export type Snapshot={principal:{id:string;gm:boolean;role:string};dice:DiceJournal;version:number;catalogIncluded?:boolean;sceneEventId?:string;cursor:string;sessionId:string;runId:string;title:string;scene:string;sharedScene:string;preview:boolean;sceneInfo?:{id:string;title:string;narration:string;imageFileId?:string};media?:import('@/domain/live-game').LiveEvent;objects:StageObject[];board:import('@/domain/live-table').BoardElement[];boardEpoch:number;crew:{id:string;name:string;initials:string;role:string}[];scenes:{id:string;title:string;image:string;version:number}[];catalog:{id:string;title:string;kind:string;sourceKind:'entity'|'file';image?:string}[]};
export type TestDocument={title:string;content?:string;url?:string;mime?:string};
