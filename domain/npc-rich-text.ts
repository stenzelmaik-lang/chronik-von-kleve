import {htmlToRichText,richTextToHtml} from './location-rich-text.ts';

// Older blocks may exceed the existing rich editor's structural limits.
// Keep those editable as plain text rather than truncating or rewriting them.
export function canFormatNPCText(value:string):boolean {
  try { htmlToRichText(richTextToHtml(value)); return true; }
  catch { return false; }
}
