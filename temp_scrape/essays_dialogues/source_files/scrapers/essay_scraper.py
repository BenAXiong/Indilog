import os, re, json, time, argparse
from typing import Dict, List, Any, Set, Optional

from core.network import http_get_json, repair_mojibake
from core.processors import create_sentence_record, append_to_jsonl, sanitize_dialect_name

BASE_JSON_URL = "https://web.klokah.tw/essay/json/"
LESSON_URL = "https://web.klokah.tw/essay/php/getEssay.php"
REFERER = "https://web.klokah.tw/essay/index.php"

# Used for metadata to know which dialect map (ES11201 -> Amis)
# We can dynamically map this later or leave it as the code format for now.
DEFAULT_AUDIO_URL_TEMPLATE = "https://file.klokah.tw/sound/{audio_id}.mp3"

def split_code(code: str):
    m = re.match(r"^([A-Za-z]+)(\d+)$", code.strip())
    if not m:
        raise ValueError(f"Invalid code format: {code}")
    return m.group(1), m.group(2)

def expand_codes(tokens: List[str]) -> List[str]:
    """Expands ranges like ES11201-ES11205 into arrays."""
    out: List[str] = []
    seen = set()
    for tok in tokens:
        tok = tok.strip()
        if not tok: continue
        if "-" in tok:
            start, end = tok.split("-", 1)
            p1, n1 = split_code(start)
            p2, n2 = split_code(end)
            if p1 != p2: raise ValueError(f"Range prefixes differ: {start} vs {end}")
            if len(n1) != len(n2): raise ValueError(f"Range numeric widths differ: {start} vs {end}")
            
            a, b = int(n1), int(n2)
            step = 1 if b >= a else -1
            width = len(n1)
            for i in range(a, b + step, step):
                code = f"{p1}{i:0{width}d}"
                if code not in seen:
                    seen.add(code)
                    out.append(code)
        else:
            split_code(tok)
            if tok not in seen:
                seen.add(tok)
                out.append(tok)
    return out

def get_essay_master(code: str, raw_dir: str) -> Optional[Dict[str, Any]]:
    filename = os.path.join(raw_dir, f"{code}.json")
    if os.path.exists(filename):
        with open(filename, "r", encoding="utf-8") as f:
            return json.load(f)
            
    print(f"[{code}] Fetching master JSON...")
    try:
        data = http_get_json(BASE_JSON_URL + f"{code}.json", headers={"Referer": REFERER})
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return data
    except Exception as e:
        print(f"[{code}] Skip: Could not fetch master JSON: {e}")
        return None

def extract_tids(dialect_json: Dict[str, Any]) -> List[str]:
    """Builds a flat list of TIDs to scrape from the season/lesson structure."""
    tids: List[str] = []
    for season_key in ["S1", "S2"]:
        season = dialect_json.get(season_key, {})
        for lesson_key in sorted(season.keys(), key=lambda x: int(x[1:])):  # L1..L12
            tid_list = season[lesson_key]
            for tid in tid_list:
                tid_s = str(tid)
                if tid_s not in tids:
                    tids.append(tid_s)
    return tids

def scrape_essays(codes_str: str, data_dir: str):
    tokens = codes_str.split()
    codes = expand_codes(tokens)
    
    raw_essay_dir = os.path.join(data_dir, "raw", "essay")
    distilled_file = os.path.join(data_dir, "distilled", "sentences.jsonl")
    os.makedirs(raw_essay_dir, exist_ok=True)
    
    seen_tids: Set[str] = set()

    for code in codes:
        print(f"\n--- Processing ES-Code {code} ---")
        
        master = get_essay_master(code, raw_essay_dir)
        if not master:
            continue
            
        dialect_name = master.get("title", code)
        tids = extract_tids(master)
        
        distilled_records = []
        
        for tid in tids:
            if tid in seen_tids:
                continue
            seen_tids.add(tid)
            
            print(f"  [{code}] Fetching TID {tid}...")
            tid_data = http_get_json(LESSON_URL, params={"tid": tid}, headers={"Referer": REFERER})
            
            # Save Raw Json Backup
            with open(os.path.join(raw_essay_dir, f"{tid}.json"), "w", encoding="utf-8") as f:
                json.dump(tid_data, f, ensure_ascii=False, indent=2)
                
            # Parse Sentences Format is usually a list of dicts:
            # [{"sn":"17621\/229816","ab":"nanu ku haniy?","ch":"\u9019\u662f\u4ec0\u9ebc?", "snd":true}]
            if isinstance(tid_data, list):
                for idx, item in enumerate(tid_data):
                    ab_text = repair_mojibake(item.get("ab", ""))
                    ch_text = repair_mojibake(item.get("ch", ""))
                    
                    if not ab_text and not ch_text:
                        continue
                        
                    # Extract audio ID from 'sn' if present, e.g., "17621/229816" -> "229816"
                    sn = item.get("sn", "")
                    audio_id = sn.split("/")[-1] if "/" in sn else ""
                    audio_url = DEFAULT_AUDIO_URL_TEMPLATE.format(audio_id=audio_id) if item.get("snd") else ""
                    
                    record = create_sentence_record(
                        uuid=f"essay_{code}_{tid}_{idx}",
                        ab=ab_text,
                        zh=ch_text,
                        audio_id=audio_id,
                        audio_url=audio_url,
                        source="essay",
                        lang_id=0, # We will tag this properly later by mapping codes to IDs
                        dialect=sanitize_dialect_name(dialect_name),
                        category=tid,
                        level=0
                    )
                    distilled_records.append(record)
                    
            time.sleep(0.10)
            
        if distilled_records:
            append_to_jsonl(distilled_file, distilled_records)
            print(f"[{code}] Appended {len(distilled_records)} sentences to distilled model.")
        else:
            print(f"[{code}] No new sentences found/processed.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser("Essay Scraper")
    parser.add_argument("--codes", type=str, required=True, help="E.g., ES11201-ES11205 ES11213")
    args = parser.parse_args()
    
    base_data = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
    scrape_essays(args.codes, base_data)
