import json
import os
import re
from typing import Dict, Any

def sanitize_dialect_name(name: str) -> str:
    """Removes administrative noise (e.g. 族語短文, 朗讀短文) from dialect labels."""
    if not name: return "UNKNOWN"
    # Suffixes to strip
    noise = [
        r"\s*族語短文",
        r"\s*族語對話",
        r"\s*朗讀短文",
        r"\s*\(試辦\)",
        r"\s*九年一貫",
        r"\s*試辦",
    ]
    clean = name
    for pattern in noise:
        clean = re.sub(pattern, "", clean)
    return clean.strip()

def append_to_jsonl(file_path: str, records: list[Dict[str, Any]]):
    """Appends structured records to a JSON Lines file."""
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "a", encoding="utf-8") as f:
        for record in records:
            json.dump(record, f, ensure_ascii=False)
            f.write("\n")

def create_sentence_record(
    uuid: str, 
    ab: str, 
    zh: str, 
    audio_id: str, 
    audio_url: str, 
    source: str, 
    lang_id: int, 
    category: str = "", 
    dialect: str = "", 
    level: int = 0,
    words: list = None
) -> Dict[str, Any]:
    """Creates a standard sentence record according to the Klokah Data Spec v1.0."""
    record = {
        "uuid": uuid,
        "text": {
            "ab": ab,
            "zh": zh,
            "pinyin": "" 
        },
        "audio": {
            "id": audio_id,
            "url": audio_url,
            "local_path": f"audio/{audio_id[:2]}/{audio_id}.mp3" if audio_id else ""
        },
        "metadata": {
            "source": source,
            "lang_id": lang_id,
            "dialect": dialect,
            "level": level,
            "category": category,
            "tags": []
        }
    }
    if words:
        record["text"]["words"] = words
        record["metadata"]["tags"].append("has_word_breakdown")
    return record

def create_dictionary_record(
    word_id: str,
    ab: str,
    zh: str,
    en: str = "",
    audio_url: str = "",
    lang_id: int = 0,
    dialect: str = "",
    category: str = "",
    level: str = ""
) -> Dict[str, Any]:
    """Creates a structured dictionary record for individual words."""
    return {
        "word_id": word_id,
        "ab": ab,
        "zh": zh,
        "en": en,
        "audio": audio_url,
        "metadata": {
            "lang_id": lang_id,
            "dialect": dialect,
            "category": category,
            "level": level
        }
    }
