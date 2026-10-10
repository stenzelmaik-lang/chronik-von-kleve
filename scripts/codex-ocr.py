"""Optional offline search aid; never changes original PDF text or page images.

Recognized text is separate, explicitly unverified OCR, not a canonical rule.
Requires PyMuPDF and local Tesseract eng/deu traineddata. No network calls.
"""
import argparse
import json
from pathlib import Path
import pymupdf

parser = argparse.ArgumentParser()
parser.add_argument('--root', required=True)
args = parser.parse_args()
root = Path(args.root)
for original in sorted((root / 'sources').glob('*.pdf')):
    target = root / 'prepared' / original.stem / 'document.json'
    data = json.loads(target.read_text(encoding='utf-8'))
    doc = pymupdf.open(original)
    for page in data['pages']:
        if page['text'].strip() or 'ocrText' in page:
            continue
        pdf_page = doc[page['page']-1]
        tp = pdf_page.get_textpage_ocr(language='eng+deu', dpi=180, full=True, tessdata=str(root / 'tessdata'))
        page['ocrText'] = pdf_page.get_text('text', textpage=tp, sort=False)
        page['ocrVerified'] = False
        print(json.dumps(dict(id=original.stem, page=page['page'], recognizedCharacters=len(page['ocrText']))), flush=True)
        target.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    data['quality']['ocrUnverified'] = [p['page'] for p in data['pages'] if p.get('ocrText', '').strip()]
    target.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
