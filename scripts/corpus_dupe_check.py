#!/usr/bin/env python3
"""
corpus_dupe_check.py
Cross-check every sentence for a given dialect against the full corpus.
Finds sentences whose text (matched via logic_hash) also appears under a different dialect.

Usage:
    python scripts/corpus_dupe_check.py                  # defaults to 馬蘭阿美語
    python scripts/corpus_dupe_check.py 知本卑南語
    python scripts/corpus_dupe_check.py > report.md      # save to file

Requires: Supabase CLI linked to the project (npx supabase db query --linked)
"""

import sys
import io
import json
import subprocess
import datetime
from collections import defaultdict

# Force UTF-8 output on Windows (default terminal may be cp1252)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


def run_query(sql: str) -> list:
    result = subprocess.run(
        'npx supabase db query --linked',
        input=sql,
        capture_output=True,
        text=True,
        encoding='utf-8',
        shell=True,
    )
    if result.returncode != 0:
        print(f"DB error:\n{result.stderr}", file=sys.stderr)
        sys.exit(1)
    # stdout may contain a preamble line before the JSON blob
    out = result.stdout.strip()
    start = out.find('{')
    if start < 0:
        print("Unexpected output:\n" + out, file=sys.stderr)
        sys.exit(1)
    return json.loads(out[start:]).get('rows', [])


def main():
    dialect = sys.argv[1] if len(sys.argv) > 1 else '馬蘭阿美語'
    dialect_sql = dialect.replace("'", "''")

    sql = f"""
SELECT
  o1.source,
  o1.category,
  o1.position,
  s1.ab               AS ab,
  o2.dialect_name     AS dup_dialect,
  o2.source           AS dup_source,
  o2.category         AS dup_category
FROM corpus_occurrences o1
JOIN corpus_sentences s1 ON o1.sentence_id = s1.id
JOIN corpus_sentences s2 ON s2.ab = s1.ab AND s2.id != s1.id
JOIN corpus_occurrences o2
  ON o2.sentence_id = s2.id
  AND o2.dialect_name != o1.dialect_name
WHERE o1.dialect_name = '{dialect_sql}'
ORDER BY o1.source, o1.category, o1.position, o2.dialect_name
"""

    print(f"Querying: {dialect}", file=sys.stderr)
    rows = run_query(sql)
    print(f"{len(rows)} dupe occurrence rows returned", file=sys.stderr)

    if not rows:
        print(f"# Corpus dupe check: {dialect}\n\nNo cross-dialect duplicates found.")
        return

    # Collapse per sentence: key = (source, category, position)
    sentences: dict[tuple, dict] = {}
    for row in rows:
        key = (row['source'], row['category'], row['position'])
        if key not in sentences:
            sentences[key] = {
                'source':   row['source'],
                'category': row['category'],
                'position': row['position'],
                'ab':       row['ab'],
                'dups':     [],
            }
        sentences[key]['dups'].append({
            'dialect':  row['dup_dialect'],
            'source':   row['dup_source'],
            'category': row['dup_category'],
        })

    # Group by source
    by_source: dict[str, list] = defaultdict(list)
    for s in sentences.values():
        by_source[s['source']].append(s)

    # ── Report ────────────────────────────────────────────────────────────────
    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    total_sentences = len(sentences)
    unique_dups = {d['dialect'] for s in sentences.values() for d in s['dups']}

    print(f"# Corpus dupe check: {dialect}")
    print(f"Generated: {now}")
    print(f"Sentences with cross-dialect matches: **{total_sentences}**  ")
    print(f"Other dialects involved: {len(unique_dups)} ({', '.join(sorted(unique_dups))})\n")

    source_order = ['twelve', 'grmpts', 'essay', 'dialogue', 'con_practice']
    for src in source_order:
        if src not in by_source:
            continue
        entries = sorted(by_source[src], key=lambda e: (e['category'], e['position']))
        print(f"## {src} — {len(entries)} sentences\n")
        print(f"| Category | Pos | Also in | Text preview |")
        print(f"|---|---|---|---|")
        for e in entries:
            dup_parts = []
            for d in e['dups']:
                if d['source'] == src and d['category'] == e['category']:
                    # same lesson, same source — most suspicious
                    dup_parts.append(f"**{d['dialect']}** (same lesson)")
                else:
                    dup_parts.append(f"{d['dialect']} ({d['source']} · {d['category']})")
            dup_str = '; '.join(dup_parts)
            ab = e['ab'] or ''
            preview = ab[:90].replace('|', '\\|').replace('\n', ' ').replace('\r', '')
            if len(ab) > 90:
                preview += '…'
            print(f"| {e['category']} | {e['position']} | {dup_str} | {preview} |")
        print()

    # ── Suspicion summary ─────────────────────────────────────────────────────
    # Flag cases where same source+category appears in a completely unrelated family
    # (rough heuristic: different GLID group based on name suffix)
    def family(name: str) -> str:
        for suffix in ['阿美語', '泰雅語', '排灣語', '布農語', '卑南語', '魯凱語',
                       '賽德克語', '太魯閣語']:
            if name.endswith(suffix):
                return suffix
        return name  # single-dialect families: use full name

    target_family = family(dialect)
    suspects = []
    for s in sentences.values():
        for d in s['dups']:
            if family(d['dialect']) != target_family and d['source'] == s['source']:
                suspects.append((s['source'], s['category'], s['position'], d['dialect'], s['ab']))

    if suspects:
        print(f"## Suspicious cross-family matches\n")
        print("Same source, different language family — highest priority for manual review.\n")
        print(f"| Source | Category | Pos | Other dialect | Text preview |")
        print(f"|---|---|---|---|---|")
        for src, cat, pos, dial, ab in sorted(suspects):
            preview = (ab or '')[:90].replace('|', '\\|').replace('\n', ' ').replace('\r', '')
            if len(ab or '') > 90:
                preview += '…'
            print(f"| {src} | {cat} | {pos} | {dial} | {preview} |")
        print()


if __name__ == '__main__':
    main()
