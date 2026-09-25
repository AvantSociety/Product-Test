"""
Independent expectations for the stress-test matter.

This re-implements, in Python and from the rules as documented, what the
tool is supposed to do at screening and chronology. It deliberately does not
import or call the app's JavaScript, so a disagreement between this and the
app is a real finding rather than the code agreeing with itself.
"""

import re
import datetime as dt

MONTHS = {m: i + 1 for i, m in enumerate(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'])}

# The formats the tool documents that it reads: M/D/YYYY, M-D-YY, YYYY-MM-DD, "March 15, 2024".
DATE_RE = re.compile(
    r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|'
    r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b', re.I)


def parse_date(raw):
    raw = raw.strip()
    m = re.fullmatch(r'(\d{4})-(\d{1,2})-(\d{1,2})', raw)
    try:
        if m:
            return dt.date(int(m[1]), int(m[2]), int(m[3]))
        m = re.fullmatch(r'(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})', raw)
        if m:
            y = int(m[3])
            if len(m[3]) <= 2:
                y = 2000 + y if y <= 68 else 1900 + y
            return dt.date(y, int(m[1]), int(m[2]))
        m = re.fullmatch(r'([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})', raw)
        if m and m[1][:3].lower() in MONTHS:
            return dt.date(int(m[3]), MONTHS[m[1][:3].lower()], int(m[2]))
    except ValueError:
        return None      # 02/30/2025 and friends
    return None


def dates_in(text):
    out = []
    for m in DATE_RE.finditer(text):
        d = parse_date(m.group(0))
        if d:
            out.append((m.group(0), d))
    return out


def mentions(text, needle):
    return re.search(r'(?<!\w)' + re.escape(needle) + r'(?!\w)', text, re.I) is not None


def screen(text, criteria):
    parties = [p.strip() for p in criteria['parties'].split(',') if p.strip()]
    terms = [t.strip() for t in criteria['terms'].split(',') if t.strip()]
    lo = dt.date.fromisoformat(criteria['from'])
    hi = dt.date.fromisoformat(criteria['to'])
    p_hits = [p for p in parties if mentions(text, p)]
    t_hits = [t for t in terms if mentions(text, t)]
    ds = [d for _, d in dates_in(text)]
    if not p_hits and not t_hits:
        return 'none', p_hits, t_hits
    if ds and not any(lo <= d <= hi for d in ds):
        return 'out_of_period', p_hits, t_hits
    if p_hits and t_hits:
        return 'strong', p_hits, t_hits
    return 'possible', p_hits, t_hits


def eml_view(raw):
    """What the app keeps of an .eml: From/To/Cc/Date/Subject, then the body."""
    parts = re.split(r'\r?\n\r?\n', raw, maxsplit=1)
    if len(parts) == 1:
        return raw
    keep = [ln for ln in parts[0].split('\n') if ln.split(':')[0].strip().lower() in ('from', 'to', 'cc', 'date', 'subject')]
    return '\n'.join(keep + ['', parts[1].strip()])


LABEL = {'strong': 'LIKELY', 'possible': 'POSSIBLE', 'out_of_period': 'OUT OF PERIOD', 'none': 'NO MATCH'}
