import os
import re
import json
import time
import argparse
from typing import Dict, List, Any, Set, Optional

from core.network import http_get_json, repair_mojibake
from core.processors import create_sentence_record, append_to_jsonl
from core.constants import TWELVE_DIALECTS

# Example SN11201.json, SN11202.json
BASE_INDEX_URL = "https://web.klokah.tw/dialogue/json/SN112{d_id:02d}.json"
CONTENT_URL = "https://web.klokah.tw/dialogue/php/getDiaData.php"
REFERER = "https://web.klokah.tw/dialogue/index.php"

def get_dialogue_index(d_id: int, raw_dir: str) -> Optional[Dict[str, Any]]:
    path = os.path.join(raw_dir, f"index_d{d_id}.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
            
    url = BASE_INDEX_URL.format(d_id=d_id)
    print(f"[D-{d_id}] Fetching index {url}...")
    try:
        data = http_get_json(url, headers={"Referer": REFERER})
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return data
    except:
        return None

def extract_dialogue_tids(index_data: Dict[str, Any]) -> Set[int]:
    tids = set()
    # Scans S1 (list), S2 (dict of lists), S3 (dict of lists)
    for s_key in ["S1", "S2", "S3"]:
        val = index_data.get(s_key)
        if isinstance(val, list):
            for t in val:
                if isinstance(t, int): tids.add(t)
        elif isinstance(val, dict):
            for lesson_list in val.values():
                if isinstance(lesson_list, list):
                    for t in lesson_list:
                        if isinstance(t, int): tids.add(t)
    return tids

def scrape_dialogues(data_dir: str, dialects: List[int] = None):
    raw_dia_dir = os.path.join(data_dir, "raw", "dialogue")
    distilled_file = os.path.join(data_dir, "distilled", "sentences.jsonl")
    os.makedirs(raw_dia_dir, exist_ok=True)
    
    dialect_ids = dialects or list(TWELVE_DIALECTS.keys())
    
    for d_id in dialect_ids:
        dialect_name = TWELVE_DIALECTS.get(d_id, f"dialect_{d_id}")
        index = get_dialogue_index(d_id, raw_dia_dir)
        if not index: continue
        
        tids = extract_dialogue_tids(index)
        print(f"[D-{d_id}] Found {len(tids)} unique TIDs for {dialect_name}")
        
        distilled_records = []
        for tid in tids:
            # We check if we already have the raw file
            raw_tid_path = os.path.join(raw_dia_dir, f"tid_{tid}.json")
            if os.path.exists(raw_tid_path):
                with open(raw_tid_path, "r", encoding="utf-8") as f:
                    content = json.load(f)
            else:
                print(f"  Fetching TID {tid}...")
                content = http_get_json(CONTENT_URL, params={"tid": tid}, headers={"Referer": REFERER})
                with open(raw_tid_path, "w", encoding="utf-8") as f:
                    json.dump(content, f, ensure_ascii=False, indent=2)
                time.sleep(0.12)
            
            # Content is usually a list of dialogue items
            # Actual: [{"ab": "...", "ch": "...", "en": "...", "sn": "...", "snd": true}, ...]
            if isinstance(content, list):
                for idx, item in enumerate(content):
                    ab_text = repair_mojibake(item.get("ab", ""))
                    zh_text = repair_mojibake(item.get("ch", ""))
                    
                    if not ab_text and not zh_text: continue
                    
                    sn = item.get("sn", "")
                    # Dialogue audio uses format: https://file.klokah.tw/sound/{sn}.mp3
                    # But the sn field usually contains slashes (e.g., "26928/440458").
                    # Audio ID is usually the last part, but Klokah serves it using the full path 
                    # from the 'sound' directory for dialogue? Actually usually it's just `https://web.klokah.tw/dialogue/audio/{tid}/{sn.split("/")[-1]}.mp3`
                    # wait, let me check klokah atlas or other scrapers.
                    # Usually `dialogue` audio format is: https://file.klokah.tw/sound/{sn}.mp3 where sn has slashes.
                    audio_url = f"https://file.klokah.tw/sound/{sn}.mp3" if sn else ""
                    audio_id = sn.replace("/", "_") if sn else ""
                    
                    record = create_sentence_record(
                        uuid=f"dialogue_{d_id}_{tid}_{idx}",
                        ab=ab_text,
                        zh=zh_text,
                        audio_id=audio_id,
                        audio_url=audio_url,
                        source="dialogue",
                        lang_id=d_id,
                        dialect=dialect_name,
                        category=f"Dialogue TID {tid}"
                    )
                    distilled_records.append(record)
                    
        if distilled_records:
            append_to_jsonl(distilled_file, distilled_records)
            print(f"[D-{d_id}] Appended {len(distilled_records)} records.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser("Dialogue Scraper")
    parser.add_argument("--dialects", nargs="+", type=int)
    args = parser.parse_args()
    
    base_data = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
    scrape_dialogues(base_data, args.dialects)
