import sqlite3
import json
import os
import re
from collections import defaultdict
from html.parser import HTMLParser

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "export", "ycm_master.db")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "portal", "lib", "corpus_geometry.json")

class TitleHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        if tag == "title":
            self.in_title = True

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title = data.strip()

def get_html_title(filepath):
    if not os.path.exists(filepath):
        return None
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            parser = TitleHTMLParser()
            parser.feed(content)
            return parser.title
    except:
        return None

def generate_geometry():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    geometry = {
        "nine_year": {},
        "twelve": {},
        "essay": {},
        "dialogue": {},
        "grmpts": {}
    }
    
    # 1. Structural Corpora: twelve
    cursor.execute("SELECT DISTINCT level FROM occurrences WHERE source='twelve' ORDER BY CAST(level AS INTEGER)")
    twelve_levels = [row[0] for row in cursor.fetchall() if row[0]]
    
    twelve_titles = defaultdict(dict)
    twelve_raw_path = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "twelve")
    if os.path.exists(twelve_raw_path):
        for fname in os.listdir(twelve_raw_path):
            if not fname.endswith(".json"): continue
            parts = fname.replace(".json", "").split("_")
            if len(parts) < 3: continue
            lvl = parts[1].replace("l", "")
            cls = parts[2].replace("c", "")
            if cls not in twelve_titles[lvl]:
                try:
                    with open(os.path.join(twelve_raw_path, fname), "r", encoding="utf-8") as f:
                        data = json.load(f)
                        twelve_titles[lvl][cls] = data.get("titleCh", f"Lesson {cls}")
                except: pass
    
    geometry["twelve"] = {
        "levels": twelve_levels,
        "classes": list(range(1, 11)),
        "titles": twelve_titles
    }

    # 2. Pattern Corpora: grmpts
    cursor.execute("SELECT DISTINCT level FROM occurrences WHERE source='grmpts' ORDER BY CAST(level AS INTEGER)")
    grm_levels = [row[0] for row in cursor.fetchall() if row[0]]
    
    # Get counts per (glid, level, category) to allow dynamic filtering
    cursor.execute("""
        SELECT s.glid, o.level, o.category, COUNT(*) 
        FROM occurrences o 
        JOIN sentences s ON o.sentence_id = s.id 
        WHERE o.source='grmpts' 
        GROUP BY s.glid, o.level, o.category
    """)
    grm_counts = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for glid, lvl, cat, count in cursor.fetchall():
        grm_counts[glid][lvl][cat] = count

    cursor.execute("SELECT DISTINCT category FROM occurrences WHERE source='grmpts' ORDER BY CAST(SUBSTR(category, 2) AS INTEGER)")
    grm_types = [row[0] for row in cursor.fetchall() if row[0]]
    
    # Grmpts Titles from HTML
    grm_titles = {}
    grm_raw_path = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "grmpts")
    if os.path.exists(grm_raw_path):
        for fname in os.listdir(grm_raw_path):
            if fname.endswith(".html") and fname[0].isdigit():
                # Extract the base numeric ID for the HTML file
                tid = fname.replace(".html", "")
                title = get_html_title(os.path.join(grm_raw_path, fname))
                if title:
                    grm_titles[tid] = title

    geometry["grmpts"] = {
        "levels": grm_levels,
        "types": grm_types,
        "titles": grm_titles,
        "counts": grm_counts
    }

    # 3. Narrative Corpora: essay & dialogue
    for source in ["essay", "dialogue"]:
        cursor.execute(f"SELECT DISTINCT dialect_name, category FROM occurrences WHERE source='{source}' ORDER BY dialect_name, category")
        rows = cursor.fetchall()
        
        dialect_map = defaultdict(list)
        for d, tid in rows:
            if tid and tid not in dialect_map[d]:
                dialect_map[d].append(tid)
        
        max_len = max([len(tids) for tids in dialect_map.values()]) if dialect_map else 0
        topics = []
        source_raw_path = os.path.join(os.path.dirname(__file__), "..", "data", "raw", source)
        
        for i in range(max_len):
            alignment = {}
            sample_zh = f"Topic {i+1}"
            found_title = False
            
            for d, tids in dialect_map.items():
                if i < len(tids):
                    tid = tids[i]
                    alignment[d] = tid
                    
                    if not found_title:
                        # Try to extract title from JSON file
                        try:
                            # Try tid_*.json for dialogue or *.json for essay
                            json_fname = f"tid_{tid}.json" if source == "dialogue" else f"{tid}.json"
                            json_path = os.path.join(source_raw_path, json_fname)
                            if os.path.exists(json_path):
                                with open(json_path, "r", encoding="utf-8") as f:
                                    data = json.load(f)
                                    if isinstance(data, list) and len(data) > 0:
                                        # Use the Chinese text of the first sentence as a proxy for title if short
                                        first_ch = data[0].get("ch", "")
                                        if first_ch and len(first_ch) < 20:
                                            sample_zh = first_ch
                                            found_title = True
                        except: pass

            topics.append({
                "index": i,
                "title_zh": sample_zh,
                "alignment": alignment
            })
        
        geometry[source] = topics

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(geometry, f, ensure_ascii=False, indent=2)
        
    print(f"Geometry crystallized to {OUTPUT_PATH}")

if __name__ == "__main__":
    generate_geometry()
