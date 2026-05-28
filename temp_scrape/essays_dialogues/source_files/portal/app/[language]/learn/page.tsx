"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Settings, ChevronLeft, ChevronRight, ChevronDown, GraduationCap, FileText, MessageSquare, Eye, EyeOff, Bookmark, CheckCircle2, X, ArrowLeftRight, LayoutGrid } from "lucide-react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useProgress } from "@/hooks/useProgress";
import { Theme, UILang } from "@/types";
import { UI_STRINGS } from "@/lib/i18n";
import { GLID_FAMILIES, LANGUAGE_SLUGS, GLID_NAMES, GLID_NAMES_EN, getDialectName } from "@/lib/dialects";
import PortalSidebar from "@/components/layout/portal/PortalSidebar";
import SingleDialectView from "@/components/views/SingleDialectView";
import geometryData from "@/lib/corpus_geometry.json";
import grmptsLabels from "@/lib/grmpts_type_labels.json";

const getLanguageFromSlug = (slug: string) => {
    const entry = Object.entries(LANGUAGE_SLUGS).find(([, s]) => s === slug);
    return entry ? entry[0] : null;
};

export default function LanguageLearn() {
    const params = useParams();
    const router = useRouter();
    const languageSlug = params.language as string;
    const glid = getLanguageFromSlug(languageSlug);
    const isMobile = useIsMobile(1024);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [showDialectPicker, setShowDialectPicker] = useState(false);

    const [uiLang, setUiLang] = usePersistedState<UILang>("yc_ui_lang", "en");

    const {
        savedSentences,
        toggleSaveSentence,
        isSentenceSaved,
        isLessonCompleted,
        toggleLessonCompletion,
        completedLessons
    } = useProgress();

    useEffect(() => {
        if (isMobile && isMobileSidebarOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isMobile, isMobileSidebarOpen]);

    const [theme] = usePersistedState<Theme>("yc_theme", "matrix");
    const [previewTheme] = useState<Theme | null>(null);
    const [customColors] = usePersistedState<Record<string, string>>("yc_custom_theme", {});
    const [previewColors] = useState<Record<string, string> | null>(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = usePersistedState("yc_sidebar_collapsed", false);
    const [filterFontSize] = usePersistedState("yc_filter_font_size", 12);

    const [activeSource, setActiveSource] = usePersistedState<"essay" | "twelve" | "grmpts" | "dialogue" | "saved">("yc_portal_source_" + glid, "twelve");
    const [essayIdEssay, setEssayIdEssay] = usePersistedState<string>("yc_portal_id_essay_" + glid, "Level 1 Lesson 1");
    const [essayIdGrmpts, setEssayIdGrmpts] = usePersistedState<string>("yc_portal_id_grmpts_" + glid, "t1");
    const [essayIdTwelve, setEssayIdTwelve] = usePersistedState<string>("yc_portal_id_twelve_" + glid, "Level 1 Lesson 1");
    const [essayIdDialogue, setEssayIdDialogue] = usePersistedState<string>("yc_portal_id_dialogue_" + glid, "Level 1 Lesson 1");

    const essayId = activeSource === 'grmpts' ? essayIdGrmpts :
        activeSource === 'twelve' ? essayIdTwelve :
        activeSource === 'dialogue' ? essayIdDialogue :
        essayIdEssay;

    const setEssayId = (id: string) => {
        if (activeSource === 'grmpts') setEssayIdGrmpts(id);
        else if (activeSource === 'twelve') setEssayIdTwelve(id);
        else if (activeSource === 'dialogue') setEssayIdDialogue(id);
        else setEssayIdEssay(id);
    };

    const [level, setLevel] = usePersistedState<number>("yc_portal_level_" + glid, 1);
    const [vs3CardsPerRow, setVs3CardsPerRow] = usePersistedState<number | "auto">("yc_cards_per_row", "auto");
    const [sentenceLayout, setSentenceLayout] = usePersistedState<"vertical" | "side">("yc_sentence_layout", "vertical");
    const [savedFilter, setSavedFilter] = useState<string>("all");
    const [compareIds, setCompareIds] = useState<string[]>([]);
    const [compareResults, setCompareResults] = useState<Record<string, any[]>>({});
    const [primarySelection, setPrimarySelection] = usePersistedState<string | null>("yc_portal_primary_" + glid, null);

    const effectiveMainSelection = (activeSource === 'grmpts' && primarySelection) ? primarySelection : essayId;

    const handleClearCompare = () => {
        setCompareIds([]);
        setCompareResults({});
        setPrimarySelection(null);
    };

    const dialectsForLang = glid ? GLID_FAMILIES[glid] || [] : [];
    // Local dialect — initialised from the dashboard's saved default but NOT written back,
    // so changes made in the learn UI are session-only and don't overwrite the default.
    const [selectedDialect, setSelectedDialect] = useState<string>(dialectsForLang[0] || "");
    useEffect(() => {
        if (!glid) return;
        try {
            const stored = window.localStorage.getItem("yc_dialect_" + glid);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (dialectsForLang.includes(parsed)) setSelectedDialect(parsed);
            }
        } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [glid]);

    const [results, setResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [zhHiddenByDefault, setZhHiddenByDefault] = usePersistedState("yc_zh_hidden_default", false);
    const [showZhEntirely, setShowZhEntirely] = usePersistedState("yc_show_zh_entirely", true);
    const [tooltipEnabled, setTooltipEnabled] = usePersistedState("yc_tooltip_enabled", true);
    const [showSettings, setShowSettings] = useState(false);

    const s = UI_STRINGS[uiLang];

    const contentCode = useMemo(() => {
        if (activeSource === 'twelve') {
            const m = essayId.match(/Level (\d+) Lesson (\d+)/);
            if (m) return `${m[1]}_${m[2]}`;
        } else if (activeSource === 'grmpts') {
            return `${level}_${essayId.replace('t', '')}`;
        } else if (activeSource === 'essay' || activeSource === 'dialogue') {
            const items = (geometryData as any)[activeSource] || [];
            const idx = items.findIndex((item: any) => item.title_zh === essayId);
            return idx >= 0 ? String(idx + 1).padStart(2, '0') : null;
        }
        return null;
    }, [activeSource, essayId, level]);

    const adjacentContent = useMemo(() => {
        let prev: string | null = null;
        let next: string | null = null;
        if (activeSource === 'twelve') {
            const m = essayId.match(/Level (\d+) Lesson (\d+)/);
            if (m) {
                const lvl = m[1];
                const lesson = parseInt(m[2]);
                const levels: string[] = (geometryData as any).twelve.levels || [];
                const classes: number[] = (geometryData as any).twelve.classes || [];
                const lvlIdx = levels.indexOf(lvl);
                const lessonIdx = classes.indexOf(lesson);
                if (lessonIdx > 0) prev = `Level ${lvl} Lesson ${classes[lessonIdx - 1]}`;
                else if (lvlIdx > 0) prev = `Level ${levels[lvlIdx - 1]} Lesson ${classes[classes.length - 1]}`;
                if (lessonIdx < classes.length - 1) next = `Level ${lvl} Lesson ${classes[lessonIdx + 1]}`;
                else if (lvlIdx < levels.length - 1) next = `Level ${levels[lvlIdx + 1]} Lesson ${classes[0]}`;
            }
        } else if (activeSource === 'grmpts') {
            const paddedGlid = (glid || '').padStart(2, '0');
            const langGrmpts = (geometryData as any).grmpts?.counts?.[glid || ''] || (geometryData as any).grmpts?.counts?.[paddedGlid];
            const levelData = langGrmpts?.[String(level)] || {};
            const keys = Object.keys(levelData).sort((a, b) => parseInt(a.replace('t', '')) - parseInt(b.replace('t', '')));
            const idx = keys.indexOf(essayId);
            if (idx > 0) prev = keys[idx - 1];
            if (idx < keys.length - 1) next = keys[idx + 1];
        } else if (activeSource === 'essay' || activeSource === 'dialogue') {
            const items = (geometryData as any)[activeSource] || [];
            const idx = items.findIndex((item: any) => item.title_zh === essayId);
            if (idx > 0) prev = items[idx - 1].title_zh;
            if (idx < items.length - 1) next = items[idx + 1].title_zh;
        }
        return { prev, next };
    }, [activeSource, essayId, level, glid]);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const playAudio = (url: string) => {
        if (!url) return;
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = url;
            audioRef.current.play().catch(() => {});
        } else {
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.play().catch(() => {});
        }
    };

    const handleSourceChange = (source: "essay" | "twelve" | "grmpts" | "dialogue" | "saved") => {
        if (isMobile) {
            if (activeSource === source) {
                setIsMobileSidebarOpen(!isMobileSidebarOpen);
            } else {
                setActiveSource(source);
                setIsMobileSidebarOpen(source !== 'saved');
            }
        } else {
            setActiveSource(source);
        }
        if (source === 'twelve') {
            if (!essayIdTwelve) setEssayIdTwelve("Level 1 Lesson 1");
        } else if (source === 'grmpts') {
            if (!essayIdGrmpts) setEssayIdGrmpts("t1");
        } else if (source === 'essay' || source === 'dialogue') {
            const firstItem = (geometryData as any)[source]?.[0];
            if (firstItem && (source === 'essay' ? !essayIdEssay : !essayIdDialogue)) {
                if (source === 'essay') setEssayIdEssay(firstItem.title_zh);
                else setEssayIdDialogue(firstItem.title_zh);
            }
        }
        setCompareIds([]);
        setCompareResults({});
        setPrimarySelection(null);
    };

    const handleAddCompare = (id: string) => {
        if (activeSource !== 'grmpts') return;
        const compositeId = `${level}:${id}`;
        if (id === essayId && !primarySelection) { setPrimarySelection(compositeId); return; }
        if (primarySelection === compositeId) { setPrimarySelection(null); return; }
        setCompareIds(prev => {
            if (prev.includes(compositeId)) return prev.filter(i => i !== compositeId);
            if (prev.length >= 3) return prev;
            return [...prev, compositeId];
        });
    };

    useEffect(() => {
        if (activeSource === 'saved') return;
        if (!selectedDialect || !activeSource || !essayId || !glid) return;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const idsToFetch = [effectiveMainSelection, ...compareIds];
                const newCompareResults: Record<string, any[]> = {};
                const queryDialect = activeSource === 'grmpts'
                    ? (GLID_NAMES as any)[glid]?.replace('族', '語')
                    : selectedDialect;
                await Promise.all(idsToFetch.map(async (composite) => {
                    if (!composite) return;
                    const url = new URL('/api/curriculum', window.location.origin);
                    url.searchParams.set('dialect', queryDialect);
                    url.searchParams.set('source', activeSource);
                    let actualId = composite;
                    let actualLevel = String(level);
                    if (activeSource === 'grmpts' && composite.includes(':')) {
                        const parts = composite.split(':');
                        actualLevel = parts[0];
                        actualId = parts[1];
                    }
                    url.searchParams.set('title_zh', actualId);
                    if (activeSource === 'grmpts') url.searchParams.set('level', actualLevel);
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        if (composite === effectiveMainSelection) setResults(data.results || []);
                        else newCompareResults[composite] = data.results || [];
                    }
                }));
                setCompareResults(newCompareResults);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [selectedDialect, activeSource, essayId, compareIds, level, primarySelection, glid]);

    useEffect(() => {
        if (activeSource !== 'saved') return;
        let filtered = savedSentences.filter(s => dialectsForLang.includes(s.dialect_name));
        if (savedFilter !== "all") filtered = filtered.filter(s => s.source === savedFilter);
        setResults(filtered);
    }, [activeSource, savedSentences, dialectsForLang, savedFilter]);

    const settingsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const handleMouseEnterSettings = () => {
        if (settingsTimeoutRef.current) clearTimeout(settingsTimeoutRef.current);
        setShowSettings(true);
    };
    const handleMouseLeaveSettings = () => {
        settingsTimeoutRef.current = setTimeout(() => setShowSettings(false), 300);
    };

    useEffect(() => {
        if (!glid) router.push('/hub');
    }, [glid, router]);

    if (!glid) return <div className="min-h-screen bg-[var(--bg-main)]"></div>;

    const currentTheme = previewTheme || theme;
    const currentColors = previewColors || customColors;
    const THEMES = ["matrix", "sober", "ycm", "cidal", "rainbow", "custom"] as const;
    const currentLessonCompleted = isLessonCompleted(activeSource, essayId);

    return (
        <div
            className={`theme-${THEMES.includes(currentTheme as any) ? currentTheme : 'custom'} flex h-screen w-full bg-[var(--bg-deep)] text-[var(--text-main)] font-sans overflow-hidden transition-all duration-500 selection:bg-[var(--accent)] selection:text-black`}
            style={(!THEMES.includes(currentTheme as any) || currentTheme === 'custom') ? (currentColors as React.CSSProperties) : undefined}
        >
            {(isMobile ? isMobileSidebarOpen : true) && activeSource !== 'saved' && (
                <PortalSidebar
                    activeSource={activeSource as any}
                    essayId={essayId}
                    setEssayId={setEssayId}
                    level={level}
                    setLevel={setLevel}
                    uiLang={uiLang}
                    s={s}
                    sidebarWidth={280}
                    isSidebarCollapsed={isSidebarCollapsed}
                    isMobile={isMobile}
                    onClose={() => setIsMobileSidebarOpen(false)}
                    glid={glid}
                    onAddCompare={handleAddCompare}
                    compareIds={compareIds}
                    primarySelection={primarySelection}
                    progress={completedLessons}
                />
            )}

            <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
                {!isMobile && activeSource !== 'saved' && (
                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        style={{ left: isSidebarCollapsed ? 0 : 280 }}
                        className="fixed top-1/2 -translate-y-1/2 z-[200] p-1.5 bg-[var(--bg-panel)] border-y border-r border-[var(--border-dark)] rounded-r-md text-[var(--accent)] hover:bg-[var(--bg-sub)] shadow-xl transition-all duration-300"
                    >
                        {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </button>
                )}

                <header className="h-16 border-b border-[var(--border-dark)] flex items-center px-4 md:px-6 justify-between bg-[var(--bg-panel)] z-[105] shadow-md sticky top-0 backdrop-blur-md relative">
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[var(--accent)] via-[var(--accent)]/50 to-transparent"></div>

                    {/* Left: back + dialect title + switch */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => router.push(`/${languageSlug}`)}
                            className="p-1.5 rounded-lg text-[var(--text-sub)] hover:text-[var(--accent)] hover:bg-[var(--bg-highlight)] transition-all"
                            title="Back to dashboard"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>

                        <h1 className={`font-black uppercase tracking-widest text-[var(--text-main)] ${isMobile ? 'text-base' : 'text-lg'}`}>
                            {getDialectName(selectedDialect, uiLang) || (uiLang === 'en' ? GLID_NAMES_EN[glid] : GLID_NAMES[glid])}
                        </h1>

                        {dialectsForLang.length > 1 && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowDialectPicker(!showDialectPicker)}
                                    className="p-1.5 rounded-lg text-[var(--text-sub)] hover:text-[var(--accent)] hover:bg-[var(--bg-highlight)] transition-all"
                                    title="Switch dialect"
                                >
                                    <ArrowLeftRight className="w-4 h-4" />
                                </button>
                                {showDialectPicker && (
                                    <div className="absolute top-full left-0 mt-1 bg-[var(--bg-panel)] border border-[var(--border-dark)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] z-[300] py-1.5 min-w-[200px]">
                                        {dialectsForLang.map(d => (
                                            <button
                                                key={d}
                                                onClick={() => { setSelectedDialect(d); setShowDialectPicker(false); }}
                                                className={`w-full text-left px-4 py-2 text-[11px] font-mono font-bold transition-colors ${selectedDialect === d ? 'text-[var(--accent)] bg-[var(--bg-sub)]' : 'text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-highlight)]'}`}
                                            >
                                                {getDialectName(d, uiLang)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Center: desktop source tabs */}
                    {!isMobile && (
                        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                            {[
                                { id: "twelve",   label: uiLang === 'zh' ? '課程' : 'LESSONS'  },
                                { id: "grmpts",   label: uiLang === 'zh' ? '句法' : 'PATTERNS' },
                                { id: "essay",    label: uiLang === 'zh' ? '課文' : 'ESSAYS'   },
                                { id: "dialogue", label: uiLang === 'zh' ? '對話' : 'DIALOGS'  },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => handleSourceChange(tab.id as any)}
                                    className={`px-3 py-1.5 rounded-lg font-mono text-[10px] font-black tracking-widest uppercase transition-all ${activeSource === tab.id ? 'bg-[var(--accent)] text-black shadow-lg' : 'text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-highlight)]'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Right: action buttons */}
                    <div className="flex items-center space-x-1 ml-auto">
                        <button
                            onClick={() => setZhHiddenByDefault(!zhHiddenByDefault)}
                            className="p-2 rounded-full transition text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-highlight)]"
                        >
                            {zhHiddenByDefault ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>

                        <button
                            onClick={() => handleSourceChange('saved')}
                            className={`p-2 rounded-full transition ${activeSource === 'saved' ? 'bg-[var(--accent)] text-black shadow-lg scale-110' : 'text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-highlight)]'}`}
                        >
                            <Bookmark className="w-5 h-5" />
                        </button>

                        <div className="relative" onMouseEnter={!isMobile ? handleMouseEnterSettings : undefined} onMouseLeave={!isMobile ? handleMouseLeaveSettings : undefined}>
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`p-2 rounded-full transition text-[var(--text-sub)] hover:text-[var(--text-main)] ${showSettings ? 'bg-[var(--bg-highlight)] text-[var(--accent)]' : 'hover:bg-[var(--bg-highlight)]'}`}
                            >
                                <Settings className="w-5 h-5" />
                            </button>

                            {showSettings && (
                                <div
                                    className="absolute top-full right-0 mt-2 p-3 bg-[var(--bg-panel)] border border-[var(--border-dark)] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[200] min-w-[240px] flex flex-col space-y-3 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-md"
                                    onMouseEnter={!isMobile ? handleMouseEnterSettings : undefined}
                                    onMouseLeave={!isMobile ? handleMouseLeaveSettings : undefined}
                                >
                                    <div className="flex items-center justify-between px-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-sub)]">{s.layout}</span>
                                        <button
                                            onClick={() => setVs3CardsPerRow(vs3CardsPerRow === "auto" ? 1 : "auto")}
                                            className={`px-3 py-1 rounded-md border transition-all text-[9px] font-bold uppercase tracking-wider ${vs3CardsPerRow === "auto" ? 'bg-[var(--accent)] text-black border-black shadow-md' : 'border-[var(--border-dark)] text-[var(--text-sub)] hover:border-[var(--accent)]'}`}
                                        >
                                            {vs3CardsPerRow === "auto" ? s.grid : s.single}
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between px-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-sub)]">{uiLang === 'zh' ? '對齊' : 'ALIGN'}</span>
                                        <button
                                            onClick={() => setSentenceLayout(sentenceLayout === "vertical" ? "side" : "vertical")}
                                            className={`px-3 py-1 rounded-md border transition-all text-[9px] font-bold uppercase tracking-wider ${sentenceLayout === "side" ? 'bg-[var(--accent)] text-black border-black shadow-md' : 'border-[var(--border-dark)] text-[var(--text-sub)] hover:border-[var(--accent)]'}`}
                                        >
                                            {sentenceLayout === "side" ? (uiLang === 'zh' ? '並排' : 'SIDE') : (uiLang === 'zh' ? '垂直' : 'VERT')}
                                        </button>
                                    </div>

                                    <div className="h-[1px] bg-[var(--border-dark)] opacity-30 mx-2"></div>

                                    <div className="flex flex-col space-y-2 px-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-sub)]">{s.visibility}</span>
                                            <button
                                                onClick={() => setZhHiddenByDefault(!zhHiddenByDefault)}
                                                className={`px-3 py-1 rounded-md border transition-all text-[9px] font-bold ${!zhHiddenByDefault ? 'bg-[var(--accent)] text-black border-black shadow-md' : 'border-[var(--border-dark)] text-[var(--text-sub)] hover:border-[var(--accent)]'}`}
                                            >
                                                {!zhHiddenByDefault ? s.visible : s.hidden}
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-sub)]">{s.translations}</span>
                                            <button
                                                onClick={() => setShowZhEntirely(!showZhEntirely)}
                                                className={`px-3 py-1 rounded-md border transition-all text-[9px] font-bold ${showZhEntirely ? 'bg-[var(--accent)] text-black border-black shadow-md' : 'border-[var(--border-dark)] text-[var(--text-sub)] hover:border-[var(--accent)]'}`}
                                            >
                                                {showZhEntirely ? s.both : s.onlyLang + " " + (uiLang === 'en' ? GLID_NAMES_EN[glid] : GLID_NAMES[glid])}
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-sub)]">{uiLang === 'zh' ? '查詞' : 'LOOKUP'}</span>
                                            <button
                                                onClick={() => setTooltipEnabled(!tooltipEnabled)}
                                                className={`px-3 py-1 rounded-md border transition-all text-[9px] font-bold ${tooltipEnabled ? 'bg-[var(--accent)] text-black border-black shadow-md' : 'border-[var(--border-dark)] text-[var(--text-sub)] hover:border-[var(--accent)]'}`}
                                            >
                                                {tooltipEnabled ? (uiLang === 'zh' ? '啟用' : 'ON') : (uiLang === 'zh' ? '關閉' : 'OFF')}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between px-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-sub)]">{s.uiLanguage}</span>
                                        <button
                                            onClick={() => setUiLang(uiLang === "en" ? "zh" : "en")}
                                            className="px-2 py-1 rounded-md border border-[var(--border-dark)] text-[var(--text-sub)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all text-[9px] font-bold"
                                        >
                                            {uiLang === "en" ? "ENGLISH" : "繁體中文"}
                                        </button>
                                    </div>

                                    <div className="h-[1px] bg-[var(--border-dark)] opacity-30 mx-2"></div>
                                    <div className="px-2 flex justify-end">
                                        <span className="text-[9px] font-mono text-[var(--text-sub)] opacity-40">0505/0153</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <div className={`flex-1 overflow-y-auto bg-[var(--bg-main)] custom-scrollbar relative ${isMobile ? 'pb-32' : ''}`} onClick={() => { setShowSettings(false); setShowDialectPicker(false); }}>
                    {isLoading && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--bg-main)] opacity-60">
                            <div className="w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}

                    <div className={`${isMobile ? 'p-2' : 'p-8'} max-w-7xl mx-auto`}>
                        {activeSource !== 'saved' && (compareIds.length === 0 && !primarySelection) && (
                            <div className="mb-6 flex flex-col space-y-4">
                                <div className="flex items-center space-x-6 text-[var(--accent)]">
                                    <div className="flex flex-row items-center gap-3 md:gap-4 flex-shrink-0">
                                        {contentCode && (
                                            <div className="font-mono text-xs font-black tracking-widest text-[var(--accent)] bg-[var(--bg-sub)] border border-[var(--accent)] border-opacity-40 px-2 py-1 rounded-lg shrink-0 self-start mt-1">
                                                {contentCode}
                                            </div>
                                        )}
                                        <h2 className="text-2xl md:text-4xl font-black text-[var(--text-main)] uppercase tracking-tight flex flex-wrap items-baseline">
                                            {activeSource === 'twelve' && (() => {
                                                const m = essayId.match(/Level (\d+) Lesson (\d+)/);
                                                if (m) {
                                                    const title = (geometryData as any).twelve.titles?.[m[1]]?.[m[2]];
                                                    return <span>{title || `Lesson ${m[2]}`}</span>;
                                                }
                                                return <span>{essayId}</span>;
                                            })()}
                                            {activeSource !== 'twelve' && (
                                                <>
                                                    <span>{activeSource === 'grmpts' ? (((grmptsLabels as any)[essayId] || essayId).replace(/^\d+\s*-\s*/, '')) : essayId}</span>
                                                    {activeSource === 'grmpts' && (() => {
                                                        const title = (geometryData as any).grmpts.titles?.[essayId];
                                                        return title ? <span className="ml-3 opacity-30 text-lg md:text-xl font-sans font-medium normal-case tracking-normal">{title}</span> : null;
                                                    })()}
                                                </>
                                            )}
                                        </h2>
                                    </div>
                                    <div className="h-[2px] flex-1 bg-gradient-to-r from-current to-transparent opacity-20"></div>
                                </div>
                            </div>
                        )}

                        {activeSource === 'saved' && (
                            <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
                                <div className="flex items-center space-x-6 text-[var(--accent)] mb-8">
                                    <h2 className="text-2xl md:text-4xl font-black text-[var(--text-main)] uppercase tracking-tight flex items-center gap-4">
                                        <Bookmark className="w-8 h-8 md:w-10 md:h-10" />
                                        <span>{s.saved}</span>
                                    </h2>
                                    <div className="h-[2px] flex-1 bg-gradient-to-r from-current to-transparent opacity-20"></div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {['all', 'twelve', 'grmpts', 'essay', 'dialogue'].map((f) => (
                                        <button
                                            key={f}
                                            onClick={() => setSavedFilter(f)}
                                            className={`px-4 py-2 rounded-xl font-mono text-[10px] font-bold tracking-widest uppercase transition-all border ${savedFilter === f ? 'bg-[var(--accent)] text-black border-black shadow-lg scale-105' : 'bg-[var(--bg-panel)] text-[var(--text-sub)] border-[var(--border-dark)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
                                        >
                                            {f === 'all' ? (uiLang === 'zh' ? '全部' : 'ALL') : (s as any)[f] || f.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeSource === 'saved' && results.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-64 opacity-30 space-y-4">
                                <Bookmark className="w-12 h-12" />
                                <div className="font-mono text-sm uppercase tracking-widest">{s.noSavedItems || "No saved sentences in this language."}</div>
                            </div>
                        )}

                        {(compareIds.length > 0 || (activeSource === 'grmpts' && primarySelection)) && (
                            <div className="px-6 py-3 flex items-center justify-end animate-in fade-in slide-in-from-top-2 duration-300 relative z-40">
                                <button
                                    onClick={handleClearCompare}
                                    className="group flex items-center space-x-2 bg-[var(--bg-sub)] border border-[var(--border-dark)] text-[var(--text-sub)] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all shadow-xl"
                                >
                                    <X className="w-3 h-3" />
                                    <span>{s.resetView}</span>
                                </button>
                            </div>
                        )}

                        <SingleDialectView
                            results={results}
                            compareResults={compareResults}
                            compareIds={compareIds}
                            uiLang={uiLang}
                            s={s}
                            playAudio={playAudio}
                            fontSize={filterFontSize + (isMobile ? 2 : 4)}
                            cardPadding={isMobile ? 12 : 16}
                            isLoading={isLoading}
                            zhHiddenByDefault={zhHiddenByDefault}
                            showZhEntirely={showZhEntirely}
                            vs3CardsPerRow={vs3CardsPerRow}
                            isMobile={isMobile}
                            onToggleSave={toggleSaveSentence}
                            dialectName={selectedDialect}
                            glid={glid ?? ''}
                            tooltipEnabled={tooltipEnabled}
                            activeSource={activeSource}
                            essayId={essayId}
                            level={level}
                            primarySelection={primarySelection}
                            savedSentences={savedSentences}
                            isSentenceSaved={isSentenceSaved}
                            sentenceLayout={sentenceLayout}
                        />

                        {activeSource !== 'saved' && results.length > 0 && (
                            <div className="mt-6 pb-36">
                                <div className="flex items-stretch gap-2">
                                    <button
                                        onClick={() => adjacentContent.prev && setEssayId(adjacentContent.prev)}
                                        disabled={!adjacentContent.prev}
                                        className={`flex items-center gap-1.5 px-3 py-3 rounded-xl border transition-all active:scale-95 ${!adjacentContent.prev ? 'opacity-20 cursor-not-allowed border-[var(--border-dark)] text-[var(--text-sub)]' : 'border-[var(--border-dark)] text-[var(--text-sub)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
                                    >
                                        <ChevronLeft className="w-4 h-4 shrink-0" />
                                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider">{uiLang === 'zh' ? '上一個' : 'PREV'}</span>
                                    </button>
                                    <button
                                        onClick={() => toggleLessonCompletion(activeSource, essayId)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all duration-500 ${currentLessonCompleted ? 'bg-[var(--accent)] text-black border-transparent shadow-lg' : 'border-[var(--border-dark)] text-[var(--text-sub)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
                                    >
                                        <CheckCircle2 className={`w-4 h-4 shrink-0 ${currentLessonCompleted ? 'animate-bounce' : ''}`} />
                                        <span className="font-mono text-[10px] font-black uppercase tracking-widest">
                                            {currentLessonCompleted ? (s.lessonCompleted || 'COMPLETED') : (s.markAsCompleted || 'MARK COMPLETE')}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => adjacentContent.next && setEssayId(adjacentContent.next)}
                                        disabled={!adjacentContent.next}
                                        className={`flex items-center gap-1.5 px-3 py-3 rounded-xl border transition-all active:scale-95 ${!adjacentContent.next ? 'opacity-20 cursor-not-allowed border-[var(--border-dark)] text-[var(--text-sub)]' : 'border-[var(--border-dark)] text-[var(--text-sub)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
                                    >
                                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider">{uiLang === 'zh' ? '下一個' : 'NEXT'}</span>
                                        <ChevronRight className="w-4 h-4 shrink-0" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {isMobile && (
                    <nav className="h-20 bg-[var(--bg-panel)] border-t border-[var(--border-dark)] fixed bottom-0 left-0 right-0 z-[400] flex items-center justify-around px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
                        {[
                            { id: "twelve",   label: uiLang === 'zh' ? "課程" : "LESSONS",  icon: <GraduationCap className="w-5 h-5" /> },
                            { id: "grmpts",   label: uiLang === 'zh' ? "句法" : "PATTERNS", icon: <LayoutGrid className="w-5 h-5" /> },
                            { id: "essay",    label: uiLang === 'zh' ? "課文" : "ESSAYS",   icon: <FileText className="w-5 h-5" /> },
                            { id: "dialogue", label: uiLang === 'zh' ? "對話" : "DIALOGS",  icon: <MessageSquare className="w-5 h-5" /> },
                        ].map((nav) => (
                            <button
                                key={nav.id}
                                onClick={() => handleSourceChange(nav.id as any)}
                                className={`flex flex-col items-center space-y-1.5 px-2 transition-all ${activeSource === nav.id ? 'text-[var(--accent)]' : 'text-[var(--text-sub)]'}`}
                            >
                                {nav.icon}
                                <span className="text-[9px] font-black tracking-tighter uppercase">{nav.label}</span>
                            </button>
                        ))}
                    </nav>
                )}
            </main>
        </div>
    );
}
