#!/usr/bin/env python3
"""
Parse data/bread-layout.txt (pdftotext -layout output from Bridgetown BREAD 2026)
into data/bread-2026.json keyed by ISO date.

Run from the daily-devotional repo root:
    python3 scripts/parse-bread.py

Re-generate bread-layout.txt if needed:
    pdftotext -layout data/2026-Bread-Scripture.pdf data/bread-layout.txt
"""

import re, json, sys
from datetime import date, timedelta
from pathlib import Path

MONTHS = dict(
    Jan=1, Feb=2, Mar=3, Apr=4, May=5, Jun=6,
    Jul=7, Aug=8, Sep=9, Oct=10, Nov=11, Dec=12,
)

# Python isoweekday(): Mon=1 .. Sat=6, Sun=7
ISO_DOW = dict(
    Sunday=7, Monday=1, Tuesday=2, Wednesday=3,
    Thursday=4, Friday=5, Saturday=6,
)

# Matches both same-month ("Jan 1 – 3") and cross-month ("Mar 29 – Apr 4") ranges.
# Does NOT match long season headers like "May 25 – November 28" (full month name).
DATE_RANGE_RE = re.compile(
    r'(?:^|\s)'
    r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)'
    r'\s+[–-]\s+'
    r'(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+)?(\d+)'
    r'(?:\s|$)'
)

DAY_NAMES = ('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')
DAY_START_RE = re.compile(r'^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b')
ALL_DAYS_RE = re.compile(r'(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s*([+\-]?)')
MULTI_SPACE_RE = re.compile(r' {2,}')


def parse_date_range(page_text):
    """Return (start_date, end_date) for the first valid weekly range on this page, or None."""
    for line in page_text.split('\n'):
        m = DATE_RANGE_RE.search(line)
        if not m:
            continue
        try:
            s_mon = MONTHS[m.group(1)]
            s_day = int(m.group(2))
            e_mon = MONTHS[m.group(3)] if m.group(3) else s_mon
            e_day = int(m.group(4))
            s = date(2026, s_mon, s_day)
            e = date(2026, e_mon, e_day)
        except (KeyError, ValueError):
            continue
        if 0 <= (e - s).days <= 6:
            return s, e
    return None


def find_date_for_day(start, end, day_name):
    """Return the date in [start, end] whose weekday matches day_name."""
    target = ISO_DOW[day_name]
    d = start
    while d <= end:
        if d.isoweekday() == target:
            return d
        d += timedelta(days=1)
    return None


def normalize_ref(ref):
    """Normalize verse separator (v -> :) and en-dash (– -> -)."""
    ref = ref.replace('\xad', '')          # remove soft hyphens
    ref = ref.replace('–', '-')       # en dash
    ref = ref.replace('—', '-')       # em dash
    ref = re.sub(r'v(\d)', r':\1', ref)   # "62v1" -> "62:1"
    return ref.strip()


def extract_col(line, col_start, col_end):
    """Slice [col_start, col_end) from line, stripping."""
    if col_start >= len(line):
        return ''
    segment = line[col_start:col_end] if col_end else line[col_start:]
    return segment.strip()


def parse_page(page_text, result):
    """Parse one PDF page into result dict {iso_date: {...}}."""
    dr = parse_date_range(page_text)
    if not dr:
        return
    start_date, end_date = dr

    lines = page_text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i]

        # Is this a day-header row? (contains at least one day name at the start of a column)
        # We check that a day name appears without being mid-word.
        if not DAY_START_RE.search(line.lstrip()):
            # Might still be a multi-col row where col 2+ starts with a day name
            # but only match if the FIRST non-space content is a day name.
            stripped = line.strip()
            if not stripped or not DAY_START_RE.match(stripped):
                i += 1
                continue

        # Collect day entries and their column start positions.
        # A day name is a column header if it appears at the start of the line
        # or after 2+ spaces (column separator). Bible references never contain
        # day names, so no false-positive risk from scanning the full line.
        day_entries = []
        for m in ALL_DAYS_RE.finditer(line):
            start = m.start()
            if start > 0 and not line[start - 2:start].isspace():
                # Not preceded by at least 2 spaces → not a column boundary
                continue
            day_entries.append({
                'name': m.group(1),
                'marker': m.group(2).strip(),
                'pos': start,
            })

        if not day_entries:
            i += 1
            continue

        # Column boundaries
        positions = [e['pos'] for e in day_entries]

        # Collect up to 6 content rows (readings). Stop at double-blank or next day header.
        j = i + 1
        content_rows = []
        blank_streak = 0
        while j < len(lines) and len(content_rows) < 6:
            l = lines[j]
            stripped = l.strip()
            if not stripped:
                blank_streak += 1
                if blank_streak >= 2:
                    break
                j += 1
                continue
            blank_streak = 0
            # Stop if we hit another day-header row
            if DAY_START_RE.match(stripped):
                break
            content_rows.append(l)
            j += 1

        # Extract readings per column
        for col_idx, entry in enumerate(day_entries):
            col_start = positions[col_idx]
            col_end = positions[col_idx + 1] if col_idx + 1 < len(positions) else None

            readings = []
            for row in content_rows:
                chunk = extract_col(row, col_start, col_end)
                if chunk:
                    readings.append(normalize_ref(chunk))

            if not readings:
                continue

            day_date = find_date_for_day(start_date, end_date, entry['name'])
            if not day_date:
                print(f'  WARN: could not place {entry["name"]} in {start_date}–{end_date}',
                      file=sys.stderr)
                continue

            iso = day_date.isoformat()
            if iso not in result:  # First occurrence wins (avoids overwriting with annotation pages)
                result[iso] = {
                    'readings': readings,
                    'feast': entry['marker'] == '+',
                    'fast': entry['marker'] == '-',
                }

        i = j


def validate(result):
    missing = []
    d = date(2026, 1, 1)
    while d <= date(2026, 12, 31):
        if d.isoformat() not in result:
            missing.append(d.isoformat())
        d += timedelta(days=1)
    return missing


def main():
    repo_root = Path(__file__).parent.parent
    layout_path = repo_root / 'data' / 'bread-layout.txt'
    output_path = repo_root / 'data' / 'bread-2026.json'

    if not layout_path.exists():
        print(f'ERROR: {layout_path} not found.', file=sys.stderr)
        print('Run: pdftotext -layout data/2026-Bread-Scripture.pdf data/bread-layout.txt',
              file=sys.stderr)
        sys.exit(1)

    text = layout_path.read_text(encoding='utf-8')
    pages = text.split('\x0c')

    result = {}
    for page in pages:
        parse_page(page, result)

    missing = validate(result)
    print(f'Parsed {len(result)} days.', file=sys.stderr)
    if missing:
        print(f'Missing {len(missing)} days: {missing}', file=sys.stderr)
    else:
        print('All 365 days present.', file=sys.stderr)

    output_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    print(f'Written: {output_path}', file=sys.stderr)

    # Print a few sample entries for manual verification
    samples = ['2026-01-01', '2026-03-29', '2026-04-05', '2026-12-25', '2026-12-31']
    for s in samples:
        if s in result:
            print(f'\n{s}: {json.dumps(result[s], ensure_ascii=False)}', file=sys.stderr)


if __name__ == '__main__':
    main()
