"use client";
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Settings, ChevronRight, GraduationCap, FileText, MessageSquare,
    LayoutGrid, Bookmark, CreditCard, PenLine, BookOpen, ArrowLeftRight
} from "lucide-react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useProgress } from "@/hooks/useProgress";
import { Theme, UILang } from "@/types";
import { GLID_FAMILIES, LANGUAGE_SLUGS, GLID_NAMES, GLID_NAMES_EN, getDialectName } from "@/lib/dialects";
import geometryData from "@/lib/corpus_geometry.json";
import grmptsLabels from "@/lib/grmpts_type_labels.json";

type Source = "essay" | "twelve" | "grmpts" | "dialogue" | "saved";
type LearningSource = Exclude<Source, "saved">;
type ThemeName = "matrix" | "sober" | "ycm" | "cidal" | "rainbow" | "custom";

interface GeometryTopic {
    title_zh: string;
}

interface CorpusGeometry {
    twelve: {
        levels: string[];
        classes: number[];
        titles?: Record<string, Record<string, string>>;
    };
    essay: GeometryTopic[];
    dialogue: GeometryTopic[];
    grmpts: {
        counts?: Record<string, Record<string, Record<string, number>>>;
    };
}

const corpusGeometry = geometryData as CorpusGeometry;
const grmptsLabelMap = grmptsLabels as Record<string, string>;

const getLanguageFromSlug = (slug: string) => {
    const entry = Object.entries(LANGUAGE_SLUGS).find(([, s]) => s === slug);
    return entry ? entry[0] : null;
};

export default function LanguageDashboard() {
    const params = useParams();
    const router = useRouter();
    const languageSlug = params.language as string;
    const glid = getLanguageFromSlug(languageSlug);
    const isMobile = useIsMobile(1024);
    const settingsRef = useRef<NodeJS.Timeout | null>(null);

    const [uiLang, setUiLang] = usePersistedState<UILang>("yc_ui_lang", "en");
    const [theme] = usePersistedState<Theme>("yc_theme", "matrix");
    const [customColors] = usePersistedState<Record<string, string>>("yc_custom_theme", {});
    const [showDialectPicker, setShowDialectPicker] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const dialectsForLang = glid ? GLID_FAMILIES[glid] || [] : [];

    // Persisted default dialect — written only when "save as default" is checked
    const [savedDialect, setSavedDialect] = usePersistedState<string>(
        "yc_dialect_" + glid, dialectsForLang[0] || ""
    );
    // Session-only override; null means fall back to savedDialect
    const [tempDialect, setTempDialect] = useState<string | null>(null);
    const [saveAsDefault, setSaveAsDefault] = useState(true);

    const selectedDialect = tempDialect ?? savedDialect;

    const handleDialectChange = (d: string) => {
        if (saveAsDefault) {
            setSavedDialect(d);
            setTempDialect(null);
        } else {
            setTempDialect(d);
        }
        setShowDialectPicker(false);
    };

    // Cursor positions — same keys as learn page
    const [essayIdTwelve, setEssayIdTwelve] = usePersistedState<string>("yc_portal_id_twelve_" + glid, "Level 1 Lesson 1");
    const [essayIdGrmpts, setEssayIdGrmpts] = usePersistedState<string>("yc_portal_id_grmpts_" + glid, "t1");
    const firstEssay = corpusGeometry.essay[0]?.title_zh || "";
    const firstDialogue = corpusGeometry.dialogue[0]?.title_zh || "";
    const [essayIdEssay, setEssayIdEssay] = usePersistedState<string>("yc_portal_id_essay_" + glid, firstEssay);
    const [essayIdDialogue, setEssayIdDialogue] = usePersistedState<string>("yc_portal_id_dialogue_" + glid, firstDialogue);
    const [level] = usePersistedState<number>("yc_portal_level_" + glid, 1);
    const [, setActiveSource] = usePersistedState<Source>(
        "yc_portal_source_" + glid, "twelve"
    );

    const { completedLessons, savedSentences } = useProgress();

    useEffect(() => {
        if (!glid) router.push('/hub');
    }, [glid, router]);

    // Pattern count for this language across all levels
    const grmptsTotal = useMemo(() => {
        if (!glid) return 0;
        const counts = corpusGeometry.grmpts.counts?.[glid] || {};
        return Object.values(counts).reduce((sum, levelCounts) => sum + Object.keys(levelCounts).length, 0);
    }, [glid]);

    if (!glid) return <div className="min-h-screen bg-[var(--bg-main)]" />;

    const THEMES: readonly ThemeName[] = ["matrix", "sober", "ycm", "cidal", "rainbow", "custom"];
    const currentTheme: ThemeName = THEMES.includes(theme as ThemeName) ? theme as ThemeName : 'custom';

    // --- Totals ---
    const twelveTotal: number = corpusGeometry.twelve.levels.length * corpusGeometry.twelve.classes.length;
    const essayTotal: number = corpusGeometry.essay.length;
    const dialogueTotal: number = corpusGeometry.dialogue.length;

    // --- Completion counts ---
    const countCompleted = (source: string) =>
        Object.entries(completedLessons).filter(([k, v]) => k.startsWith(source + ':') && v).length;

    // --- Saved sentences for this language family ---
    const savedCount = savedSentences.filter(s => dialectsForLang.includes(s.dialect_name)).length;

    // --- "Next" labels: item after current cursor ---
    // Returns { id, label } for navigation + display, or null if at end.

    const getNextTwelve = (): { id: string; label: string } | null => {
        const m = essayIdTwelve.match(/Level (\d+) Lesson (\d+)/);
        if (!m) return null;
        const lvl = m[1];
        const lesson = parseInt(m[2]);
        const levels = corpusGeometry.twelve.levels;
        const classes = corpusGeometry.twelve.classes;
        const lvlIdx = levels.indexOf(lvl);
        const lessonIdx = classes.indexOf(lesson);
        let nextLvl = lvl;
        let nextLesson: number | null = null;
        if (lessonIdx < classes.length - 1) nextLesson = classes[lessonIdx + 1];
        else if (lvlIdx < levels.length - 1) { nextLvl = levels[lvlIdx + 1]; nextLesson = classes[0]; }
        if (nextLesson === null) return null;
        const nextId = `Level ${nextLvl} Lesson ${nextLesson}`;
        const label = corpusGeometry.twelve.titles?.[nextLvl]?.[String(nextLesson)] || `L${nextLvl}.${nextLesson}`;
        return { id: nextId, label };
    };

    const getNextItem = (source: 'essay' | 'dialogue', currentId: string): { id: string; label: string } | null => {
        const items = corpusGeometry[source];
        const idx = items.findIndex(item => item.title_zh === currentId);
        if (idx < 0 || idx >= items.length - 1) return null;
        const nextId = items[idx + 1].title_zh;
        return { id: nextId, label: nextId };
    };

    const getNextGrmpts = (): { id: string; label: string } | null => {
        const counts = corpusGeometry.grmpts.counts?.[glid] || {};
        const levelData = counts[String(level)] || {};
        const keys = Object.keys(levelData).sort((a, b) => parseInt(a.replace('t', '')) - parseInt(b.replace('t', '')));
        const idx = keys.indexOf(essayIdGrmpts);
        if (idx < 0 || idx >= keys.length - 1) return null;
        const nextKey = keys[idx + 1];
        const fullLabel = grmptsLabelMap[nextKey] || nextKey;
        return { id: nextKey, label: fullLabel.replace(/^\d+\s*-\s*/, '') };
    };

    // Navigate to learn at the current cursor for a source
    const goToLearn = (source: Source) => {
        setActiveSource(source);
        router.push(`/${languageSlug}/learn`);
    };

    // Advance the cursor to the next item, then navigate to learn
    const goToLearnAtNext = (
        source: LearningSource,
        nextId: string
    ) => {
        if (source === 'twelve') setEssayIdTwelve(nextId);
        else if (source === 'grmpts') setEssayIdGrmpts(nextId);
        else if (source === 'essay') setEssayIdEssay(nextId);
        else if (source === 'dialogue') setEssayIdDialogue(nextId);
        setActiveSource(source);
        router.push(`/${languageSlug}/learn`);
    };

    const langName = uiLang === 'en' ? GLID_NAMES_EN[glid] : GLID_NAMES[glid];
    const dialectDisplay = getDialectName(selectedDialect, uiLang) || langName;

    const handleMouseEnterSettings = () => {
        if (settingsRef.current) clearTimeout(settingsRef.current);
        setShowSettings(true);
    };
    const handleMouseLeaveSettings = () => {
        settingsRef.current = setTimeout(() => setShowSettings(false), 300);
    };

    const sourceCards = [
        {
            source: 'twelve' as const,
            Icon: GraduationCap,
            label: uiLang === 'zh' ? '課程' : 'LESSONS',
            completed: countCompleted('twelve'),
            total: twelveTotal,
            next: getNextTwelve(),
        },
        {
            source: 'grmpts' as const,
            Icon: LayoutGrid,
            label: uiLang === 'zh' ? '句法' : 'PATTERNS',
            completed: countCompleted('grmpts'),
            total: grmptsTotal,
            next: getNextGrmpts(),
        },
        {
            source: 'essay' as const,
            Icon: FileText,
            label: uiLang === 'zh' ? '課文' : 'ESSAYS',
            completed: countCompleted('essay'),
            total: essayTotal,
            next: getNextItem('essay', essayIdEssay),
        },
        {
            source: 'dialogue' as const,
            Icon: MessageSquare,
            label: uiLang === 'zh' ? '對話' : 'DIALOGS',
            completed: countCompleted('dialogue'),
            total: dialogueTotal,
            next: getNextItem('dialogue', essayIdDialogue),
        },
    ];

    return (
        <div
            className={`theme-${currentTheme} min-h-screen bg-[var(--bg-deep)] text-[var(--text-main)] font-sans selection:bg-[var(--accent)] selection:text-black`}
            style={theme === 'custom' ? (customColors as React.CSSProperties) : undefined}
            onClick={() => { setShowSettings(false); setShowDialectPicker(false); }}
        >
            {/* Header */}
            <header className="h-16 border-b border-[var(--border-dark)] flex items-center px-4 md:px-6 bg-[var(--bg-panel)] shadow-md sticky top-0 backdrop-blur-md z-[105]">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[var(--accent)] via-[var(--accent)]/50 to-transparent" />

                <h1 className="text-xl md:text-2xl font-black uppercase tracking-widest text-[var(--text-main)] shrink-0">
                    {langName}
                </h1>

                {/* Dialect selector — centered */}
                <div className="absolute left-1/2 -translate-x-1/2" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={() => setShowDialectPicker(!showDialectPicker)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[var(--bg-highlight)] transition-all"
                    >
                        <span className="text-[11px] font-mono font-bold text-[var(--text-sub)] whitespace-nowrap">
                            {dialectDisplay}
                        </span>
                        {dialectsForLang.length > 1 && (
                            <ArrowLeftRight className="w-3.5 h-3.5 text-[var(--text-sub)] opacity-50" />
                        )}
                    </button>

                    {showDialectPicker && dialectsForLang.length > 1 && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-[var(--bg-panel)] border border-[var(--border-dark)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] z-[300] py-1.5 min-w-[220px]">
                            {dialectsForLang.map(d => (
                                <button
                                    key={d}
                                    onClick={() => handleDialectChange(d)}
                                    className={`w-full text-left px-4 py-2 text-[11px] font-mono font-bold transition-colors ${
                                        selectedDialect === d
                                            ? 'text-[var(--accent)] bg-[var(--bg-sub)]'
                                            : 'text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-highlight)]'
                                    }`}
                                >
                                    {getDialectName(d, uiLang)}
                                </button>
                            ))}
                            <div className="border-t border-[var(--border-dark)] mt-1 px-4 py-2.5">
                                <label className="flex items-start gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={saveAsDefault}
                                        onChange={e => setSaveAsDefault(e.target.checked)}
                                        className="mt-0.5 accent-[var(--accent)] shrink-0"
                                    />
                                    <span className="text-[10px] font-mono text-[var(--text-sub)] leading-tight">
                                        {uiLang === 'zh' ? '設為預設方言' : 'Make this my default dialect'}
                                        <span className="opacity-50 ml-1">
                                            {uiLang === 'zh' ? '（可隨時更改）' : '(can be changed anytime)'}
                                        </span>
                                    </span>
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                {/* Settings */}
                <div
                    className="ml-auto relative"
                    onMouseEnter={!isMobile ? handleMouseEnterSettings : undefined}
                    onMouseLeave={!isMobile ? handleMouseLeaveSettings : undefined}
                    onClick={e => e.stopPropagation()}
                >
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2 rounded-full transition text-[var(--text-sub)] hover:text-[var(--text-main)] ${showSettings ? 'bg-[var(--bg-highlight)] text-[var(--accent)]' : 'hover:bg-[var(--bg-highlight)]'}`}
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                    {showSettings && (
                        <div
                            className="absolute top-full right-0 mt-2 p-3 bg-[var(--bg-panel)] border border-[var(--border-dark)] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[200] min-w-[200px] flex flex-col space-y-3 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-md"
                            onMouseEnter={!isMobile ? handleMouseEnterSettings : undefined}
                            onMouseLeave={!isMobile ? handleMouseLeaveSettings : undefined}
                        >
                            <div className="flex items-center justify-between px-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-sub)]">
                                    {uiLang === 'zh' ? '介面語言' : 'UI LANG'}
                                </span>
                                <button
                                    onClick={() => setUiLang(uiLang === "en" ? "zh" : "en")}
                                    className="px-2 py-1 rounded-md border border-[var(--border-dark)] text-[var(--text-sub)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all text-[9px] font-bold"
                                >
                                    {uiLang === "en" ? "ENGLISH" : "繁體中文"}
                                </button>
                            </div>
                            <div className="px-2 flex justify-end">
                                <span className="text-[9px] font-mono text-[var(--text-sub)] opacity-40">0505/0153</span>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Page body */}
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-8 pb-16">

                {/* PRACTICE — greyed-out tool cards: Dict | SeMi | Cards */}
                <section>
                    <div className="text-[30px] font-black uppercase tracking-widest text-[var(--text-sub)] opacity-50 mb-3 px-1">
                        {uiLang === 'zh' ? '練習工具' : 'PRACTICE'}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { icon: <BookOpen className="w-5 h-5" />, label: uiLang === 'zh' ? '字典' : 'DICT' },
                            { icon: <PenLine className="w-5 h-5" />, label: uiLang === 'zh' ? '造句' : 'SeMi' },
                            { icon: <CreditCard className="w-5 h-5" />, label: uiLang === 'zh' ? '字卡' : 'CARDS' },
                        ].map(tool => (
                            <div
                                key={tool.label}
                                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-dark)] opacity-35 select-none"
                            >
                                <div className="text-[var(--text-sub)]">{tool.icon}</div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-sub)]">
                                    {tool.label}
                                </span>
                                <span className="text-[8px] font-mono text-[var(--text-sub)] opacity-70">
                                    {uiLang === 'zh' ? '即將推出' : 'coming soon'}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* LEARN — source cards with progress */}
                <section>
                    <div className="text-[30px] font-black uppercase tracking-widest text-[var(--text-sub)] opacity-50 mb-3 px-1">
                        {uiLang === 'zh' ? '學習內容' : 'LEARN'}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {sourceCards.map(card => {
                            const pct = card.total > 0 ? (card.completed / card.total) * 100 : 0;
                            return (
                                <div
                                    key={card.source}
                                    className="aspect-square flex flex-col rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-dark)] hover:border-[var(--accent)]/50 transition-all group overflow-hidden shadow-sm"
                                >
                                    {/* Icon area — fills upper portion, main tap target */}
                                    <button
                                        onClick={() => goToLearn(card.source)}
                                        className="relative flex-1 flex items-center justify-center bg-[var(--accent)]/[0.06] group-hover:bg-[var(--accent)]/[0.12] transition-colors min-h-0 overflow-hidden"
                                    >
                                        {/* large faint watermark */}
                                        <card.Icon className="absolute w-32 h-32 text-[var(--accent)] opacity-[0.07] -bottom-4 -right-4 rotate-[-12deg]" />
                                        {/* main icon */}
                                        <card.Icon className="w-14 h-14 text-[var(--accent)] opacity-60 group-hover:opacity-90 group-hover:scale-110 transition-all duration-300 relative z-10" />
                                    </button>

                                    {/* Info strip — label + progress */}
                                    <button
                                        onClick={() => goToLearn(card.source)}
                                        className="shrink-0 px-3.5 pt-3 pb-2.5 text-left border-t border-[var(--border-dark)]/30"
                                    >
                                        <div className="flex items-baseline justify-between mb-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-sub)] group-hover:text-[var(--text-main)] transition-colors">
                                                {card.label}
                                            </span>
                                            <span className="text-[9px] font-mono text-[var(--text-sub)] opacity-50 ml-1 shrink-0">
                                                {card.completed}/{card.total}
                                            </span>
                                        </div>
                                        <div className="h-[3px] w-full bg-[var(--bg-deep)] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </button>

                                    {/* Next strip — separate tap target */}
                                    {card.next ? (
                                        <button
                                            onClick={() => goToLearnAtNext(card.source, card.next!.id)}
                                            className="shrink-0 flex items-center gap-1 px-3.5 py-2 border-t border-[var(--border-dark)]/20 text-left text-[var(--text-sub)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/[0.05] transition-colors"
                                        >
                                            <ChevronRight className="w-3 h-3 shrink-0 opacity-40" />
                                            <span className="text-[9px] font-mono truncate opacity-50 group-hover:opacity-80">
                                                {card.next.label}
                                            </span>
                                        </button>
                                    ) : (
                                        <div className="shrink-0 py-2 border-t border-[var(--border-dark)]/20" />
                                    )}
                                </div>
                            );
                        })}

                        {/* Saved sentences — full width */}
                        <button
                            onClick={() => goToLearn('saved')}
                            className="col-span-2 flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-dark)] hover:border-[var(--accent)]/60 hover:bg-[var(--bg-sub)] transition-all group active:scale-[0.98]"
                        >
                            <div className="text-[var(--accent)] opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                                <Bookmark className="w-5 h-5" />
                            </div>
                            <div className="flex-1 text-left">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-sub)] group-hover:text-[var(--text-main)] transition-colors">
                                        {uiLang === 'zh' ? '已儲存' : 'SAVED'}
                                    </span>
                                    <span className="text-[10px] font-mono text-[var(--text-sub)] opacity-60 ml-3">
                                        {savedCount} {uiLang === 'zh' ? '句' : 'sentences'}
                                    </span>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[var(--text-sub)] opacity-40 group-hover:text-[var(--accent)] group-hover:opacity-100 transition-all shrink-0" />
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}
