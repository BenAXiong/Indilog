---
status: accepted
---

# i18n strings not threaded through `t()` in Phase 1

All Phase 1 pages use inline English strings rather than routing through the `t()` i18n helper. Threading is a mechanical Phase 9 task. The full English key catalog (`lib/i18n/en.ts`) contains all keys.

**Date:** 2026-05-26

Doing it in Phase 1 would add noise with zero user-visible benefit since the only supported locale is English.
