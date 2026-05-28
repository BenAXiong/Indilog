import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import geometryData from '@/lib/corpus_geometry.json';

// Deep Repair for Klokah Audio URLs
const repairAudioUrl = (row: any) => {
    if (!row.audio_url || !row.audio_url.includes('klokah.tw')) return row.audio_url;
    
    // Standard migration
    let url = row.audio_url.replace('file.klokah.tw', 'web.klokah.tw').replace('http://', 'https://');
    
    // SPECIAL REPAIR: Dialogue and Essay often have "truncated" URLs in the DB
    if ((row.source === 'essay' || row.source === 'dialogue') && !url.includes('/text/')) {
        const parts = (row.original_uuid || "").split('_');
        const contextId = parts.length >= 3 ? parts[parts.length - 2] : null;

        if (contextId && /^\d+$/.test(contextId)) {
            const sMatch = url.match(/\/sound\/(\d+)\.mp3/);
            if (sMatch && sMatch[1]) {
                return `https://web.klokah.tw/text/sound/${contextId}/${sMatch[1]}.mp3`;
            }
        }
    }
    return url;
};

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dialect = searchParams.get('dialect');
        const source = searchParams.get('source');
        const titleZh = searchParams.get('title_zh');

        if (!dialect || !source || !titleZh) {
            return NextResponse.json({ error: "Missing required parameters: dialect, source, title_zh" }, { status: 400 });
        }

        const db = getDb();
        let results: any[] = [];

        if (['nine_year', 'twelve', 'grmpts'].includes(source)) {
            let sql = `
                SELECT s.ab, s.zh, o.audio_url, o.original_uuid, o.category
                FROM sentences s
                JOIN occurrences o ON s.id = o.sentence_id
                WHERE o.dialect_name = ? AND o.source = ? AND o.category = ?
            `;
            let params: any[] = [dialect, source, titleZh];

            if (source === 'grmpts') {
                const patternLevel = searchParams.get('level') || '1';
                sql += ` AND o.level = ?`;
                params.push(String(patternLevel));
            }

            sql += ` ORDER BY o.original_uuid ASC`;
            
            const stmt = db.prepare(sql);
            const rows = stmt.all(...params) as any[];
            results = rows.map(r => ({ ...r, audio_url: repairAudioUrl(r) }));

        } else if (['essay', 'dialogue'].includes(source)) {
            const sourceKey = source as 'essay' | 'dialogue';
            const entries = (geometryData as any)[sourceKey] || [];
            const entry = entries.find((e: any) => e.title_zh === titleZh);
            
            if (!entry || !entry.alignment || !entry.alignment[dialect]) {
                return NextResponse.json({ results: [] });
            }

            const targetCategory = entry.alignment[dialect];

            const sql = `
                SELECT s.ab, s.zh, o.audio_url, o.original_uuid, o.category
                FROM sentences s
                JOIN occurrences o ON s.id = o.sentence_id
                WHERE o.dialect_name = ? AND o.source = ? AND o.category = ?
                ORDER BY CAST(SUBSTR(o.original_uuid, INSTR(o.original_uuid, '_') + 1) AS INTEGER) ASC
            `;
            
            const stmt = db.prepare(sql);
            const rows = stmt.all(dialect, source, targetCategory) as any[];
            results = rows.map(r => ({ ...r, audio_url: repairAudioUrl(r) }));
        } else {
            return NextResponse.json({ error: "Invalid source" }, { status: 400 });
        }

        return NextResponse.json({ results });

    } catch (err: any) {
        console.error(`[CURRICULUM_API] Query failed: ${err.message}`);
        return NextResponse.json({ error: err.message, results: [] }, { status: 500 });
    }
}
