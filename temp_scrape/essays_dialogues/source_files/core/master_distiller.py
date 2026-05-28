import json
import sqlite3
import os
import sys
import hashlib
from collections import defaultdict

# Fix imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from core.network import repair_mojibake
from core.processors import sanitize_dialect_name

def normalize_text(text: str) -> str:
    if not text: return ""
    # Strip spaces and standard punctuation for comparison
    clean = repair_mojibake(text).strip().lower()
    for char in "。，,.！？!? ":
        clean = clean.replace(char, "")
    return clean

def distill_to_sql(base_dir: str):
    # data_dir might be passed as 'data' relative or absolute
    # We need the project root to find 'core/glid_map.json'
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    jsonl_path = os.path.join(root_dir, "data", "distilled", "sentences.jsonl")
    glid_map_path = os.path.join(root_dir, "core", "glid_map.json")
    db_path = os.path.join(root_dir, "export", "ycm_master.db")
    
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    # Load GLID Map
    with open(glid_map_path, "r", encoding="utf-8") as f:
        glid_data = json.load(f)
        variant_to_glid = {}
        for glid, info in glid_data.items():
            for variant in info["variants"]:
                variant_to_glid[variant] = glid

    # Initialize DB
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.executescript("""
        DROP TABLE IF EXISTS occurrences;
        DROP TABLE IF EXISTS sentences;
        DROP TABLE IF EXISTS dialects;
        
        CREATE TABLE dialects (
            glid TEXT PRIMARY KEY,
            group_name TEXT,
            sub_dialects TEXT
        );
        
        CREATE TABLE sentences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            glid TEXT,
            ab TEXT,
            zh TEXT,
            word_data_json TEXT,
            logic_hash TEXT UNIQUE,
            FOREIGN KEY(glid) REFERENCES dialects(glid)
        );
        
        CREATE TABLE occurrences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sentence_id INTEGER,
            dialect_name TEXT,
            source TEXT,
            level TEXT,
            category TEXT,
            audio_url TEXT,
            local_path TEXT,
            original_uuid TEXT,
            FOREIGN KEY(sentence_id) REFERENCES sentences(id)
        );
    """)
    # Note: SQLite 3.37+ supports AUTOINCREMENT via simple PRIMARY KEY, 
    # but for some older versions we just use INTEGER PRIMARY KEY.
    
    # Populate Dialects
    for glid, info in glid_data.items():
        cur.execute("INSERT INTO dialects VALUES (?, ?, ?)", 
                    (glid, info["group"], ", ".join(info["dialects"])))

    # Distillation Logic
    print("--- COMMENCING SOUL MERGE (V2: Granular Dialects) ---")
    line_count = 0
    merged_count = 0
    occurrence_count = 0
    
    # Use logic_hash to detect unique souls
    # Hash = GLID + NormalizedAB + NormalizedZH
    soul_to_id = {}

    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            line_count += 1
            try:
                r = json.loads(line)
                raw_dia = sanitize_dialect_name(r["metadata"].get("dialect", "UNKNOWN"))
                glid = variant_to_glid.get(raw_dia, "UNKNOWN")
                
                ab = repair_mojibake(r["text"]["ab"])
                zh = repair_mojibake(r["text"]["zh"])
                
                # The Secure Hash
                norm_ab = normalize_text(ab)
                norm_zh = normalize_text(zh)
                logic_str = f"{glid}|{norm_ab}|{norm_zh}"
                l_hash = hashlib.md5(logic_str.encode("utf-8")).hexdigest()
                
                # Check for existing soul
                if l_hash in soul_to_id:
                    s_id = soul_to_id[l_hash]
                    merged_count += 1
                else:
                    # New Soul Found
                    cur.execute("INSERT INTO sentences (glid, ab, zh, word_data_json, logic_hash) VALUES (?, ?, ?, ?, ?)",
                                (glid, ab, zh, json.dumps(r["text"].get("words")), l_hash))
                    s_id = cur.lastrowid
                    soul_to_id[l_hash] = s_id

                # Create Occurrence - KEEPING GRANULAR DIALECT NAME
                cur.execute("""
                    INSERT INTO occurrences 
                    (sentence_id, dialect_name, source, level, category, audio_url, local_path, original_uuid) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (s_id, raw_dia, r["metadata"]["source"], str(r["metadata"].get("level", "")), 
                      r["metadata"].get("category", ""), r["audio"]["url"], r["audio"]["local_path"], r["uuid"]))
                occurrence_count += 1
                
                if line_count % 20000 == 0:
                    print(f"  Processed {line_count:,} records | {len(soul_to_id):,} unique souls found.")
            except Exception as e:
                # print(f"Error at line {line_count}: {e}")
                continue

    conn.commit()

    print("  Building Indices & FTS5 Search Tables...")
    # Standard Metadata Indices
    cur.execute("CREATE INDEX IF NOT EXISTS idx_occurrences_source ON occurrences(source);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_occurrences_sentence_id ON occurrences(sentence_id);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_occurrences_dialect_name ON occurrences(dialect_name);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sentences_glid ON sentences(glid);")
    
    # Text Search Indices (B-Tree for exact/prefix matches)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_ilrdf_vocabulary_ab ON ilrdf_vocabulary(word_ab);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_ilrdf_vocabulary_ch ON ilrdf_vocabulary(word_ch);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sentences_ab ON sentences(ab);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sentences_zh ON sentences(zh);")
    
    # FTS5 Virtual Tables (Full-Text Search)
    # 1. Sentences FTS
    cur.execute("DROP TABLE IF EXISTS sentences_fts;")
    cur.execute("CREATE VIRTUAL TABLE sentences_fts USING fts5(ab, zh, content='sentences', content_rowid='id');")
    cur.execute("INSERT INTO sentences_fts(rowid, ab, zh) SELECT id, ab, zh FROM sentences;")
    
    # 2. Vocabulary FTS
    cur.execute("DROP TABLE IF EXISTS ilrdf_vocabulary_fts;")
    cur.execute("CREATE VIRTUAL TABLE ilrdf_vocabulary_fts USING fts5(ab, zh, content='ilrdf_vocabulary', content_rowid='id');")
    cur.execute("INSERT INTO ilrdf_vocabulary_fts(rowid, ab, zh) SELECT id, word_ab, word_ch FROM ilrdf_vocabulary;")
    
    conn.commit()
    conn.close()
    
    # Auto-Deploy to Portal
    portal_db = os.path.join(os.path.dirname(os.path.dirname(__file__)), "portal", "ycm_master.db")
    if os.path.exists(os.path.dirname(portal_db)):
        try:
            import shutil
            shutil.copyfile(db_path, portal_db)
            print(f"  [Auto-Deploy] Copied to {portal_db}")
        except PermissionError:
            print(f"  [⚠️ Auto-Deploy Failed] The portal DB is locked. Stop the Next.js dev server, copy {db_path} to {portal_db} manually, and restart it.")
            
    print("-" * 30)
    print("--- DISTILLATION COMPLETE ---")
    print(f"Total Gross Records:  {line_count:,}")
    print(f"Unique Souls (SQL):   {len(soul_to_id):,}")
    print(f"Redundant Merged:     {merged_count:,}")
    print(f"Total Occurrences:    {occurrence_count:,}")
    print(f"Master Archive:       {db_path}")

if __name__ == "__main__":
    base = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
    if not os.path.exists(os.path.join(base, "distilled")):
        # fallback to project root
        base = "."
    distill_to_sql(base)
