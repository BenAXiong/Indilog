---
status: accepted
---

# ILRDF AI Labs MT + TTS endpoints

Switch translate tab from FormosanBank/Modal.run to ILRDF AI Labs. Modal.run remains as MT fallback for non-Amis languages.

**Date:** 2026-06-03 (M6 complete)

**MT endpoint:** `https://ai-labs.ilrdf.org.tw/kari-seejiq-tnpusu-ai-hmjil` (Gradio 5 SSE)
**TTS endpoint:** `https://ai-labs.ilrdf.org.tw/hnang-kari-ai-asi-sluhay` (Gradio 5 SSE)

- ILRDF is primary for Amis; Modal.run fallback for all other languages
- Dialect selector in translate UI; Amis dialect → ILRDF dialect code mapping
- TTS calls `/api/tts` → ILRDF `/default_speaker_tts`; dialect → speaker mapping
- Both endpoints use Gradio 5 SSE streaming protocol
