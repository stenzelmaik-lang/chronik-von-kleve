export type Viewer='gm'|'a'|'b';
export type Rect={x:number;y:number;w:number;h:number};
export type NoteObject={id:string;kind:'note';title:string;visibility:'private'|'group';rect:Rect;ownerId:Viewer;content:string;revision:number};
export type StageObject={id:string;kind:'npc'|'document';title:string;visibility:'sl'|'group';rect:Rect}|NoteObject;
export type Snapshot={dice:DiceJournal;version:number;scene:string;sharedScene:string;preview:boolean;objects:StageObject[];board:import('../../domain/live-table').BoardElement[];boardEpoch:number;crew:{id:string;name:string;initials:string;role:string}[];scenes:{id:string;title:string;image:string}[];catalog:{id:string;title:string;kind:string}[];privateNote?:string};
export type TestDocument={title:string;subtitle:string;paragraphs:string[];footer:string};

export type DiceEvent={id:string;sessionId:string;sequence:number;revision:number;kind:'roll';authorId:Viewer;authorName:string;at:string;status:'settled_open'|'closed_shared';roll:{pool:number;target:number;dice:number[]};result:import('../../domain/w10').V20Report;animationSeed:number[]};
export type DiceJournal={sessionId:string;revision:number;events:DiceEvent[]};
