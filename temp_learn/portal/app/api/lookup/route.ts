import { NextResponse } from 'next/server';
import { getDb, getMoeDb } from '@/lib/db';

// Strip punctuation that may be attached to a token
const clean = (w: string) => w.replace(/^[^a-zA-ZÀ-ſ']+|[^a-zA-ZÀ-ſ']+$/g, '').toLowerCase();

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get('word') || '';
    const dialect = searchParams.get('dialect') || '';
    const glid = searchParams.get('glid') || '';

    const word = clean(raw);
    if (!word) return NextResponse.json({ results: [] });

    const db = getDb();

    // ILRDF: match across all dialects — dialect filter was unreliable because
    // grmpts content is fetched at language level while selectedDialect is sub-dialect.
    const ilrdfRows = db.prepare(`
        SELECT word_ab, word_ch, dialect_name, source
        FROM ilrdf_vocabulary
        WHERE LOWER(word_ab) = ?
        LIMIT 6
    `).all(word) as any[];

    const ilrdf = ilrdfRows.map(r => ({
        source: 'ILRDF',
        word_ab: r.word_ab,
        word_ch: r.word_ch,
        dialect_name: r.dialect_name,
        vocab_source: r.source,
    }));

    // MoE: Amis only, exact match, include stem info for future use
    let moe: any[] = [];
    if (glid === '01') {
        try {
            const moeDb = getMoeDb();
            const moeRows = moeDb.prepare(`
                SELECT word_ab, definition, stem, dialect_name
                FROM moe_entries
                WHERE LOWER(word_ab) = ?
                LIMIT 4
            `).all(word) as any[];

            moe = moeRows.map(r => ({
                source: 'MOE',
                word_ab: r.word_ab,
                word_ch: r.definition,
                dialect_name: r.dialect_name,
                stem: r.stem,
            }));
        } catch (_) {
            // MoE DB not available in this environment
        }
    }

    return NextResponse.json({ results: [...ilrdf, ...moe] });
}
