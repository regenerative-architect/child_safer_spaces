"""Render handbook.html to handbook.pdf, and the three officials' briefs to PDF, with Chromium's print engine (optional).

Requires Python with Playwright and a Chromium build available to it.
Usage: python3 source/make-pdf.py
The PDF uses the handbook's own print styles (Letter paper; page numbers and
footer come from @page rules, which Chromium supports).
"""
import pathlib
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto((root / 'handbook.html').as_uri())
    page.emulate_media(media='print')
    page.pdf(path=str(root / 'handbook.pdf'), format='Letter', print_background=False)
    # The officials' briefs (English, and the draft French and Spanish translations), on A4 for international use.
    for lang in ('en', 'fr', 'es'):
        page.goto((root / 'briefs' / f'brief-{lang}.html').as_uri())
        page.emulate_media(media='print')
        page.pdf(path=str(root / 'briefs' / f'brief-{lang}.pdf'), format='A4', print_background=False)
    browser.close()
print('Wrote', root / 'handbook.pdf', 'and briefs/brief-en.pdf, brief-fr.pdf, brief-es.pdf')
