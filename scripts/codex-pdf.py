"""Offline only: immutable PDF -> exact page facsimiles and uncorrected search text.

Requires PyMuPDF 1.28.2. Never edits PDFs, contacts production, or rewrites rules.
Raster pages are authoritative for tables/layout; extracted text is an index aid.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
import pymupdf


def printed_contents(doc):
    """Conservative fallback: only explicit printed TOCs and proven page stamps.

    No font-size guessing or generated chapter titles. An ambiguous destination
    is rejected rather than silently mapped to the wrong page.
    """
    entries = []
    for index in range(min(15, len(doc))):
        lines = doc[index].get_text('text', sort=False).splitlines()
        markers = [i for i, line in enumerate(lines) if line.strip() == 'TABLE OF CONTENTS']
        if not markers:
            continue
        previous = ''
        for line in lines[markers[0]+1:]:
            value = line.strip()
            if not value:
                continue
            if value.isdigit() and previous:
                printed = int(value)
                candidates = []
                for page_index in range(index+1, len(doc)):
                    first = doc[page_index].get_text('text', sort=False).splitlines()[:3]
                    if any(re.fullmatch(r'\d(?:\s*\d)*', x.strip()) and re.sub(r'\s', '', x) == str(printed) for x in first):
                        candidates.append(page_index+1)
                if len(candidates) == 1:
                    entries.append(dict(level=1, title=previous, page=candidates[0], printedPage=str(printed), tocPage=index+1))
                previous = ''
            else:
                previous = value
        if entries:
            return entries
    return []


def prepare(path, target):
    raw_hash = hashlib.file_digest(path.open('rb'), 'sha256').hexdigest()
    target.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(path)
    fallback = printed_contents(doc) if not doc.get_toc() else []
    if (target / 'document.json').exists():
        previous = json.loads((target / 'document.json').read_text(encoding='utf-8'))
        if previous['sourceHash'] != raw_hash:
            raise ValueError('Changed original: existing preparation is preserved, use a new target directory.')
        if all((target / p['image']).exists() for p in previous['pages']):
            if fallback:
                previous['outlines'] = fallback
                previous['quality']['navigation'] = 'verified-printed-table-of-contents'
                offsets = {e['page']-int(e['printedPage']) for e in fallback}
                if len(offsets) == 1:
                    offset = offsets.pop()
                    for page in previous['pages']:
                        if page['page'] > offset:
                            page['label'] = str(page['page']-offset)
                (target / 'document.json').write_text(json.dumps(previous, ensure_ascii=False), encoding='utf-8')
            print(json.dumps(dict(id=path.stem, reused=True, pages=previous['pageCount'])), flush=True)
            return
    if doc.needs_pass:
        raise ValueError('Encrypted source needs authorized password: ' + path.name)
    outlines = [dict(level=x[0], title=x[1], page=x[2]) for x in doc.get_toc() if 1 <= x[2] <= len(doc)] or fallback
    pages = []
    for number, page in enumerate(doc, 1):
        # Preserve the PDF text layer's sequence, whitespace and Unicode. No OCR
        # guesses, dehyphenation, translation, normalization or table flattening.
        text = page.get_text('text', sort=False)
        image = target / f'page-{number}.jpg'
        if not image.exists():
            pix = page.get_pixmap(matrix=pymupdf.Matrix(1200 / page.rect.width, 1200 / page.rect.width), alpha=False)
            pix.save(image, jpg_quality=88)
        pages.append(dict(page=number, label=page.get_label() or str(number), text=text,
                          width=page.rect.width, height=page.rect.height, image=image.name,
                          imageBytes=image.stat().st_size, imageHash=hashlib.file_digest(image.open('rb'), 'sha256').hexdigest(),
                          textHash=hashlib.sha256(text.encode('utf-8')).hexdigest(),
                          widgets=sum(1 for _ in (page.widgets() or []))))
    result = dict(format='PDF', sourceHash=raw_hash, bytes=path.stat().st_size,
                  pageCount=len(doc), outlines=outlines, pages=pages,
                  quality=dict(authoritative='original-page-facsimile', index='original-pdf-text-layer',
                               pagesWithoutText=[p['page'] for p in pages if not p['text'].strip()],
                               replacementCharacters=[p['page'] for p in pages if '\ufffd' in p['text']]))
    (target / 'document.json').write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    print(json.dumps(dict(id=path.stem, pages=len(pages), outlines=len(outlines), noText=len(result['quality']['pagesWithoutText']), imageBytes=sum(p['imageBytes'] for p in pages))), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--sources', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    for source in sorted(Path(args.sources).glob('*.pdf')):
        prepare(source, Path(args.output) / source.stem)
