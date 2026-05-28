import time
import requests
from typing import Optional, Any

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
      "AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/120.0.0.0 Safari/537.36")

def repair_mojibake(s: str) -> str:
    if not s or not isinstance(s, str):
        return s
    
    # Check for typical mojibake characters created by double-encoding
    bad = ("Ã","Â","â","æ","é","è","ï","ð","€", "å", "ç", "æ")
    if not any(x in s for x in bad):
        return s
        
    try:
        # Many Klokah characters get parsed as UTF-8 but were actually Big5 or Latin1
        # The most common issue on this site is Latin-1 double encoding.
        return s.encode("latin1", errors="strict").decode("utf-8", errors="strict")
    except Exception:
        return s

def http_get(url: str, *, params: Optional[dict] = None, timeout: int = 30,
             retries: int = 3, backoff: float = 0.25, headers: Optional[dict] = None, 
             log_cb=None) -> requests.Response:
    
    req_headers = {"User-Agent": UA}
    if headers:
        req_headers.update(headers)
        
    last_exception = None
    for i in range(retries):
        try:
            r = requests.get(url, params=params, headers=req_headers, timeout=timeout)
            r.raise_for_status()
            r.encoding = "utf-8"
            return r
        except Exception as e:
            last_exception = e
            if log_cb:
                log_cb(f"[retry {i+1}/{retries}] {url} -> {e}")
            time.sleep(backoff * (i + 1))
            
    raise last_exception  # type: ignore

def http_get_json(url: str, *, params: Optional[dict] = None, retries: int = 3, 
                  backoff: float = 0.25, headers: Optional[dict] = None, 
                  log_cb=None) -> Any:
    r = http_get(url, params=params, timeout=30, retries=retries, 
                 backoff=backoff, headers=headers, log_cb=log_cb)
    return r.json()

def http_get_text(url: str, *, params: Optional[dict] = None, retries: int = 3, 
                  backoff: float = 0.25, headers: Optional[dict] = None, 
                  log_cb=None) -> str:
    r = http_get(url, params=params, timeout=30, retries=retries, 
                 backoff=backoff, headers=headers, log_cb=log_cb)
    return r.text
