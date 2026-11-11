#!/usr/bin/env python3
"""Check local documentation links and static HTML IDs without network access."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_PAGES = {'CAHIER_DES_CHARGES.md', 'DEMARRAGE.md', 'RELEASE_1_0.md'}

class Page(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.links, self.ids, self.duplicates = [], set(), []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            if attrs['id'] in self.ids:
                self.duplicates.append(attrs['id'])
            self.ids.add(attrs['id'])
        for key in ('href', 'src', 'poster'):
            if attrs.get(key):
                self.links.append(attrs[key])


def check():
    errors = []
    files = sorted(set(ROOT.glob('*.md')) | set((ROOT / 'docs').rglob('*.md')) | set((ROOT / 'docs').glob('*.html')))
    count = 0
    for path in files:
        source = path.read_text()
        parsed = Page(source)
        errors.extend(f'{path.relative_to(ROOT)}: duplicate id {id_}' for id_ in parsed.duplicates)
        links = parsed.links
        if path.suffix == '.md':
            source = re.sub(r'```.*?```', '', source, flags=re.S)
            source = re.sub(r'`[^`\n]+`', '', source)
            links += re.findall(r'\]\(([^\s)]+)(?:\s+"[^"]*")?\)', source)
        for link in links:
            if '{{' in link or '{%' in link:
                continue
            url = urlsplit(link)
            if url.scheme or url.netloc or link.startswith('/'):
                continue
            target = (path.parent / unquote(url.path)).resolve() if url.path else path
            if ROOT not in target.parents and target != ROOT:
                errors.append(f'{path.relative_to(ROOT)}: link outside repository: {link}')
                continue
            if not target.exists() and target.suffix == '.html' and target.with_suffix('.md').is_file():
                target = target.with_suffix('.md')
                if target.name in EXCLUDED_PAGES:
                    errors.append(f'{path.relative_to(ROOT)}: excluded Pages target: {link}')
            if not target.exists():
                errors.append(f'{path.relative_to(ROOT)}: missing target: {link}')
            elif url.fragment and target.suffix == '.html':
                ids = Page(target.read_text()).ids
                if unquote(url.fragment) not in ids:
                    errors.append(f'{path.relative_to(ROOT)}: missing HTML anchor: {link}')
            count += 1
    for error in errors:
        print(error, file=sys.stderr)
    print(f'{len(files)} documentation files, {count} local links, {len(errors)} errors.')
    return bool(errors)

if __name__ == '__main__':
    sys.exit(check())
