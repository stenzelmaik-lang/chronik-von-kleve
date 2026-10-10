import {z} from 'zod';

// Operator instruction for the closed pre-alpha; explicitly NOT a licence.
export const CODEX_PRE_ALPHA_DECISION='codex-pre-alpha-player-access-2026-10-10';

export const editions = ['V20','V5','HOUSE','UNKNOWN'] as const;
export type Edition = typeof editions[number];
export const editionLabels: Record<Edition,string> = {V20:'V20',V5:'V5',HOUSE:'Chronik- & Hausregeln',UNKNOWN:'Edition offen'};
export const sourceSchema = z.object({tab:z.string(),start:z.number().int(),end:z.number().int(),page:z.number().int().positive().optional(),label:z.string().optional(),ocr:z.boolean().optional()});
const runSchema=z.object({text:z.string(),bold:z.boolean(),italic:z.boolean()});
export const sectionSchema=z.object({
  id:z.string(),kind:z.enum(['paragraph','heading','bullet','table','page']),level:z.number().int(),
  runs:z.array(runSchema),rows:z.array(z.array(z.string())),source:sourceSchema,
  separators:z.array(z.enum(['horizontalRule','pageBreak'])).optional(),
  ocrText:z.string().optional(),
  pageSize:z.object({width:z.number().positive(),height:z.number().positive()}).optional(),
});
const bookmarkSchema=z.object({title:z.string(),level:z.number().int().positive(),sectionId:z.string(),order:z.number().int().nonnegative().optional()});
export const chapterSchema=z.object({id:z.string(),title:z.string(),sections:z.array(sectionSchema),bookmarks:z.array(bookmarkSchema).optional()});
export type Chapter=z.infer<typeof chapterSchema>;
export type Section=z.infer<typeof sectionSchema>;
export type Source=z.infer<typeof sourceSchema>;
export type Book={id:string;title:string;edition:Edition;type:string;format:string;rights:'own'|'licensed'|'pending';readerReady:boolean;modified:string;hash:string;reviewOnly?:boolean;quality?:string;canManage?:boolean;canRelease?:boolean;playerReleased?:boolean;publicationBasis?:'operator_pre_alpha'};
export type Contents={book:Book;chapters:{id:string;title:string;source:Source;bookmarks?:z.infer<typeof bookmarkSchema>[]}[];outline?:{title:string;level:number;sectionId:string;chapterId:string}[]};
export type Hit={bookId:string;title:string;edition:Edition;chapterId:string;chapter:string;sectionId:string;heading:string;snippet:string;source:Source};

type NativeNode={startIndex?:number;endIndex?:number;paragraph?:{
  paragraphStyle?:{namedStyleType?:string};bullet?:unknown;
  elements?:{textRun?:{content?:string;textStyle?:{bold?:boolean;italic?:boolean}};horizontalRule?:unknown;pageBreak?:unknown;[key:string]:unknown}[];
};table?:{tableRows?:{tableCells?:{content?:NativeNode[]}[]}[]}};
export type NativeDoc={documentId:string;title:string;revisionId?:string;tabs:{tabId:string;title:string;body:{content:NativeNode[]}}[]};
export function sectionText(s:Section){return s.kind==='table'?s.rows.map(r=>r.join('\t')).join('\n'):s.runs.map(r=>r.text).join('');}
export function indexText(s:Section){return sectionText(s).trim()?sectionText(s):s.ocrText??'';}
export function sourceLabel(s:Source){return s.page?`PDF-Seite ${s.page}${s.label&&s.label!==String(s.page)?` · Originalzählung ${s.label}`:''}${s.ocr?' · OCR-Suchfundstelle (ungeprüft)':''}`:`Tab ${s.tab} · Zeichen ${s.start}–${s.end}`;}
// Native Docs have character positions, not stable PDF pages. Retain exact text,
// including unusual table continuation rows. No rule rewriting or edition inference.
export function prepareDocument(doc:NativeDoc):Chapter[]{
  if(!doc.documentId||!doc.tabs?.length)throw Error('Native Dokumentstruktur fehlt.');
  const chapters:Chapter[]=[];
  for(const tab of doc.tabs){
    let chapter:Chapter|undefined;
    const topHeading=Math.min(...tab.body.content.filter(n=>n.paragraph?.paragraphStyle?.namedStyleType?.match(/^HEADING_[2-6]$/)).map(n=>Number(n.paragraph!.paragraphStyle!.namedStyleType!.slice(8))));
    for(const node of tab.body.content){
      if(!node.paragraph&&!node.table)continue;
      const style=node.paragraph?.paragraphStyle?.namedStyleType??'NORMAL_TEXT';
      for(const element of node.paragraph?.elements??[])if(!element.textRun&&!('horizontalRule' in element)&&!('pageBreak' in element))throw Error('Nicht unterstütztes natives Element: '+Object.keys(element).join(', '));
      const level=style.startsWith('HEADING_')?Number(style.slice(8)):0;
      const runs=(node.paragraph?.elements??[]).flatMap(e=>e.textRun?[{text:e.textRun.content??'',bold:!!e.textRun.textStyle?.bold,italic:!!e.textRun.textStyle?.italic}]:[]);
      const text=runs.map(r=>r.text).join('');
      if(!chapter||(text.trim()&&(level===topHeading||(level===1&&chapter.sections.length>0)))){
        chapter={id:`chapter-${tab.tabId}-${node.startIndex??0}`,title:'Einführung',sections:[]};
        if(text.trim()&&(level===topHeading||level===1&&chapters.length>0))chapter.title=text.trim();
        chapters.push(chapter);
      }
      const cellText=(nodes:NativeNode[]):string=>nodes.map(n=>n.paragraph?(n.paragraph.elements??[]).map(e=>e.textRun?.content??'').join(''):n.table?(n.table.tableRows??[]).map(r=>(r.tableCells??[]).map(c=>cellText(c.content??[])).join('\t')).join('\n'):'').join('');
      chapter.sections.push({
        id:`section-${tab.tabId}-${node.startIndex??0}`,
        kind:node.table?'table':level?'heading':node.paragraph?.bullet?'bullet':'paragraph',
        level,runs,rows:(node.table?.tableRows??[]).map(r=>(r.tableCells??[]).map(c=>cellText(c.content??[]))),
        source:{tab:tab.tabId,start:node.startIndex??0,end:node.endIndex??node.startIndex??0},
        ...((node.paragraph?.elements??[]).some(e=>'horizontalRule' in e||'pageBreak' in e)?{separators:(node.paragraph?.elements??[]).flatMap(e=>'horizontalRule' in e?['horizontalRule' as const]:'pageBreak' in e?['pageBreak' as const]:[])}:{}),
      });
    }
  }
  return boundedChapters(chapters);
}
// Split only at source section boundaries; never truncate or rewrite source text.
export function boundedChapters(chapters:Chapter[]):Chapter[]{
  const result:Chapter[]=[];
  for(const chapter of chapters){
    const finish=(part:Chapter)=>chapterSchema.parse({...part,...(chapter.bookmarks?{bookmarks:chapter.bookmarks.filter(b=>part.sections.some(s=>s.id===b.sectionId))}:{})});
    let part:Chapter={...chapter,sections:[]},number=1;
    for(const section of chapter.sections){
      if(JSON.stringify({...part,sections:[...part.sections,section]}).length>60000){
        if(!part.sections.length)throw Error('Ein einzelner Quellabschnitt ist zu groß; keine automatische Kürzung.');
        result.push(finish(part));number++;
        part={id:chapter.id+'-part-'+number,title:chapter.title+' · Teil '+number,sections:[]};
      }
      part.sections.push(section);
      if(JSON.stringify(part).length>60000)throw Error('Ein einzelner Quellabschnitt ist zu groß; keine automatische Kürzung.');
    }
    if(part.sections.length)result.push(finish(part));
  }
  return result;
}
export type PreparedPDF={pageCount:number;outlines:{level:number;title:string;page:number}[];pages:{page:number;label:string;text:string;ocrText?:string;width?:number;height?:number}[]};
export function preparePDF(doc:PreparedPDF):Chapter[]{
  if(!doc.pageCount||doc.pages.length!==doc.pageCount||doc.pages.some((p,i)=>p.page!==i+1))throw Error('PDF-Seitenbestand unvollständig.');
  const chapters:Chapter[]=[];
  for(const page of doc.pages){
    // Embedded bookmarks are retained verbatim; sources without bookmarks get
    // explicitly mechanical page ranges, never guessed chapter headings.
    const outline=doc.outlines.filter(o=>o.page===page.page).sort((a,b)=>a.level-b.level)[0];
    if(!chapters.length||outline||(!doc.outlines.length&&(page.page-1)%8===0))chapters.push({id:'chapter-page-'+page.page,title:outline?.title??(doc.outlines.length?'Vorspann':`Seiten ${page.page}–${Math.min(page.page+7,doc.pageCount)}`),sections:[],bookmarks:[]});
    chapters.at(-1)!.bookmarks!.push(...doc.outlines.flatMap((o,order)=>o.page===page.page?[{title:o.title,level:o.level,sectionId:'section-page-'+page.page,order}]:[]));
    chapters.at(-1)!.sections.push({id:'section-page-'+page.page,kind:'page',level:0,runs:[{text:page.text,bold:false,italic:false}],rows:[],source:{tab:'PDF',start:0,end:page.text.length,page:page.page,label:page.label,...(page.ocrText?.trim()?{ocr:true}:{})},...(page.ocrText!==undefined?{ocrText:page.ocrText}:{}),...(page.width&&page.height?{pageSize:{width:page.width,height:page.height}}:{})});
  }
  return boundedChapters(chapters);
}
export function searchExpression(input:string){
  const terms=input.normalize('NFC').match(/[\p{L}\p{N}]+/gu)?.slice(0,8)??[];
  return terms.map(term=>'"'+term+'"*').join(' AND ');
}
