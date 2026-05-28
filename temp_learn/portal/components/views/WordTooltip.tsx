"use client";
import React, { useState, useRef, useCallback, useEffect } from 'react';

const cache = new Map<string, any[]>();

const cleanToken = (t: string) =>
    t.replace(/^[^a-zA-ZÀ-ſ''']+|[^a-zA-ZÀ-ſ''']+$/g, '').toLowerCase();

interface WordTooltipProps {
    text: string;
    dialectName: string;
    glid: string;
    isMobile: boolean;
    enabled?: boolean;
}

export default function WordTooltip({ text, dialectName, glid, isMobile, enabled = true }: WordTooltipProps) {
    const [activeWord, setActiveWord] = useState<string | null>(null);
    // isTouchMode drives which panel renders — updated in the same React 18 batch
    // as activeWord so there is never an intermediate render with mismatched state.
    const [isTouchMode, setIsTouchMode] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Ref mirrors isTouchMode for synchronous event-handler guards;
    // prevents synthesised mouseenter (fired after touchstart) from overriding touch mode.
    const isTouchRef = useRef(false);

    const tokens = text.split(/(\s+)/);

    // Keep ref and state in sync; always call together.
    const enterTouchMode = useCallback(() => {
        isTouchRef.current = true;
        setIsTouchMode(true);
    }, []);

    const enterDesktopMode = useCallback(() => {
        isTouchRef.current = false;
        setIsTouchMode(false);
    }, []);

    const dismiss = useCallback(() => {
        isTouchRef.current = false; // reset so the next hover works normally
        setActiveWord(null);
        // isTouchMode state doesn't matter when nothing is active; reset lazily
    }, []);

    const fetchData = useCallback(async (word: string, el: HTMLElement | null) => {
        if (el) {
            const rect = el.getBoundingClientRect();
            setPos({ x: rect.left + rect.width / 2, y: rect.top + window.scrollY });
        }

        const key = `${word}:${dialectName}`;
        if (cache.has(key)) {
            setResults(cache.get(key)!);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(
                `/api/lookup?word=${encodeURIComponent(word)}&dialect=${encodeURIComponent(dialectName)}&glid=${glid}`
            );
            const data = await res.json();
            cache.set(key, data.results ?? []);
            setResults(data.results ?? []);
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [dialectName, glid]);

    // Desktop hover — skip if isMobile or if last activation was a touch
    const onMouseEnter = (token: string, e: React.MouseEvent<HTMLSpanElement>) => {
        if (!enabled || isMobile || isTouchRef.current) return;
        const w = cleanToken(token);
        if (!w) return;
        const el = e.currentTarget;
        hoverTimer.current = setTimeout(() => {
            enterDesktopMode(); // batched with setActiveWord below in React 18
            setActiveWord(w);
            fetchData(w, el);
        }, 220);
    };

    const onMouseLeave = () => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        hoverTimer.current = setTimeout(dismiss, 120);
    };

    // Mobile tap — enterTouchMode + setActiveWord in same sync call = single batched render
    const onTap = (token: string, e: React.TouchEvent<HTMLSpanElement>) => {
        if (!enabled) return;
        e.stopPropagation();
        const w = cleanToken(token);
        if (!w) return;
        if (activeWord === w) { dismiss(); return; }
        enterTouchMode(); // ref + state, synchronous
        setActiveWord(w); // batched with enterTouchMode's setIsTouchMode
        fetchData(w, null);
    };

    // Dismiss sticky panel on outside tap
    useEffect(() => {
        if (!activeWord || !isTouchMode) return;
        const handler = () => dismiss();
        document.addEventListener('touchstart', handler, { passive: true });
        return () => document.removeEventListener('touchstart', handler);
    }, [activeWord, isTouchMode, dismiss]);

    if (!enabled) return <>{text}</>;

    const tooltipContent = (
        <>
            <div className="font-mono text-[9px] font-black text-[var(--accent)] tracking-widest mb-1.5 uppercase opacity-60">
                {activeWord}
            </div>
            {loading ? (
                <div className="text-[11px] text-[var(--text-sub)] font-mono animate-pulse">···</div>
            ) : results.length === 0 ? (
                <div className="text-[11px] text-[var(--text-sub)] opacity-40">—</div>
            ) : (
                <div className="space-y-1">
                    {results.map((r, i) => (
                        <div key={i} className="flex flex-col gap-0.5">
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-[8px] font-mono font-black text-[var(--accent)] opacity-40 shrink-0">{r.source}</span>
                                {r.dialect_name && <span className="text-[7px] font-mono text-[var(--text-sub)] opacity-30 shrink-0 truncate max-w-[100px]">{r.dialect_name}</span>}
                            </div>
                            <span className="text-[12px] text-[var(--text-main)] leading-snug">{r.word_ch}</span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );

    return (
        <>
            {tokens.map((token, i) => {
                if (/^\s+$/.test(token)) return <span key={i}>{token}</span>;
                const w = cleanToken(token);
                const isActive = !!w && activeWord === w;
                return (
                    <span
                        key={i}
                        className={`transition-colors rounded-sm ${w
                            ? isActive
                                ? 'bg-[var(--accent)] text-black px-0.5'
                                : 'hover:bg-[var(--accent)]/20 cursor-pointer'
                            : ''
                        }`}
                        onMouseEnter={w ? (e) => onMouseEnter(token, e) : undefined}
                        onMouseLeave={w ? onMouseLeave : undefined}
                        onTouchStart={w ? (e) => onTap(token, e) : undefined}
                    >
                        {token}
                    </span>
                );
            })}

            {/* Desktop: floating above the hovered word */}
            {activeWord && !isTouchMode && (
                <div
                    className="fixed z-[600] pointer-events-none"
                    style={{
                        left: pos.x,
                        top: pos.y,
                        transform: 'translate(-50%, calc(-100% - 10px))',
                    }}
                >
                    <div
                        className="pointer-events-auto bg-[var(--bg-panel)] border border-[var(--accent)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] p-3 min-w-[120px] max-w-[220px]"
                        onMouseEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }}
                        onMouseLeave={dismiss}
                    >
                        {tooltipContent}
                    </div>
                </div>
            )}

            {/* Mobile: sticky panel pinned above the bottom navbar */}
            {activeWord && isTouchMode && (
                <div
                    className="fixed bottom-16 left-0 right-0 z-[600] px-4 pb-1 pointer-events-none"
                    onTouchStart={(e) => e.stopPropagation()}
                >
                    <div className="pointer-events-auto bg-[var(--bg-panel)] border border-[var(--accent)] rounded-xl shadow-[0_-8px_32px_rgba(0,0,0,0.5)] p-3">
                        {tooltipContent}
                    </div>
                </div>
            )}
        </>
    );
}
