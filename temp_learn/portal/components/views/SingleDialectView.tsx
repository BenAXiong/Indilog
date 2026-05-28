"use client";

import React from 'react';
import { Volume2, Copy, Check, BookmarkPlus, ChevronRight } from "lucide-react";
import { UILang, UIStrings } from "@/types";
import geometryData from "@/lib/corpus_geometry.json";
import grmptsLabels from "@/lib/grmpts_type_labels.json";
import WordTooltip from "@/components/views/WordTooltip";

interface SingleDialectViewProps {
  results: any[];
  uiLang: UILang;
  s: UIStrings;
  playAudio: (url: string) => void;
  fontSize: number;
  cardPadding: number;
  isLoading?: boolean;
  zhHiddenByDefault?: boolean;
  showZhEntirely?: boolean;
  vs3CardsPerRow?: number | "auto";
  isMobile?: boolean;
  onToggleSave?: (sentence: any) => void;
  dialectName?: string;
  glid?: string;
  tooltipEnabled?: boolean;
  activeSource?: string;
  compareIds?: string[];
  compareResults?: Record<string, any[]>;
  essayId?: string;
  level?: number;
  primarySelection?: string | null;
  savedSentences?: any[];
  isSentenceSaved?: (uuid: string) => boolean;
  sentenceLayout?: "vertical" | "side";
}

/**
 * ComparisonView: Extracted sub-component to handle the side-by-side comparison mode
 */
function ComparisonView({
  allIds,
  results,
  compareResults,
  level,
  activeSource,
  essayId,
  primarySelection,
  playAudio,
  fontSize,
  showZhEntirely,
  hiddenZh,
  handleCopy,
  copiedId,
  savedSentences,
  dialectName,
  handleSave,
  isSentenceSaved,
  s,
  sentenceLayout
}: any) {
  return (
    <div className={`mx-auto pb-12 flex flex-row space-x-4 px-4 overflow-x-auto min-h-full scrollbar-none`}>
      {allIds.map((cid: string | null, colIdx: number) => {
        const currentResults = cid === null ? results : compareResults[cid] || [];
        
        let currentId = cid;
        let currentLevel = level;
        
        if (cid === null) {
          if (activeSource === 'grmpts' && primarySelection) {
              const parts = primarySelection.split(':');
              currentLevel = parseInt(parts[0]);
              currentId = parts[1];
          } else {
              currentId = activeSource === 'grmpts' ? essayId || null : null;
              currentLevel = level || 1;
          }
        } else if (cid && cid.includes(':')) {
          const parts = cid.split(':');
          currentLevel = parseInt(parts[0]);
          currentId = parts[1];
        }

        const patternTitle = currentId ? ((grmptsLabels as any)[currentId] || (geometryData as any).grmpts.titles?.[currentId] || currentId.toUpperCase()) : "Results";
        const levelLabel = activeSource === 'grmpts' ? `LVL ${currentLevel}: ` : "";
        const currentTitle = levelLabel + patternTitle;

        return (
          <div key={cid || 'main'} className="flex-1 min-w-[320px] max-w-[420px] flex flex-col space-y-6">
            <div className="sticky top-0 bg-[var(--bg-deep)]/80 backdrop-blur-md py-4 z-30 border-b border-[var(--border-dark)] flex items-center justify-between group/header">
              <div className="flex flex-col">
                <span className="text-[12px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">
                  {currentTitle}
                </span>
              </div>
            </div>

            <div className="space-y-6">
              {currentResults.map((r: any, idx: number) => {
                const cardId = `copy-${colIdx}-${idx}`;
                const isSaved = r.original_uuid && isSentenceSaved 
                    ? isSentenceSaved(r.original_uuid)
                    : (savedSentences || []).some((s: any) => s.ab === r.ab && s.dialect_name === dialectName);

                return (
                  <div key={idx} className="group relative flex items-center">
                    <div className="absolute -left-3 w-6 h-6 rounded-full bg-[var(--bg-sub)] border border-[var(--border-dark)] text-[var(--text-sub)] font-mono text-[9px] flex items-center justify-center shadow-sm z-10 transition-colors group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]">
                      {idx + 1}
                    </div>

                    <div 
                      onClick={() => r.audio_url && playAudio(r.audio_url)}
                      className={`flex-1 bg-[var(--bg-panel)] rounded-xl border border-[var(--border-dark)] p-4 relative flex ${sentenceLayout === 'side' ? 'flex-row items-center gap-4' : 'flex-col space-y-2'} group/card hover:border-[var(--accent)] cursor-pointer transition-all active:scale-[0.99] shadow-sm hover:shadow-md`}
                    >
                      <div className="flex-1 flex flex-col">
                         <div className="flex items-start justify-between">
                            <div 
                              className="font-sans font-bold text-[var(--text-main)] leading-tight flex-1 pr-2"
                              style={{ fontSize: `${fontSize * 0.85}px` }}
                            >
                              {r.ab}
                            </div>
                            <button 
                              onClick={(e) => handleCopy(e, r.ab, `ab-${cardId}`)}
                              className="w-6 h-6 flex items-center justify-center rounded-lg bg-[var(--bg-sub)] border border-[var(--border-dark)] hover:border-[var(--accent)] text-[var(--text-sub)] hover:text-[var(--accent)] transition-all shadow-sm opacity-0 group-hover/card:opacity-100 shrink-0"
                            >
                              {copiedId === `ab-${cardId}` ? <Check className="w-3 h-3 text-[var(--accent)]" /> : <Copy className="w-3 h-3" />}
                            </button>
                         </div>
                      </div>

                      {showZhEntirely && (
                        <>
                          {sentenceLayout === 'side' && <div className="w-[1px] h-8 bg-[var(--border-dark)] opacity-10 shrink-0"></div>}
                          <div className="flex-1 flex flex-col">
                            {sentenceLayout !== 'side' && <div className="h-[1px] w-full bg-gradient-to-r from-[var(--accent)] to-transparent opacity-5 mb-2"></div>}
                            <div className="flex items-center justify-between group/zh">
                              <div 
                                className={`font-medium transition-all duration-300 flex-1 leading-tight ${hiddenZh[idx] ? 'blur-md opacity-20 select-none' : 'text-[var(--text-sub)] group-hover/card:text-[var(--text-main)]'}`}
                                style={{ fontSize: `${fontSize * 0.75}px` }}
                              >
                                {r.zh}
                              </div>
                              {!hiddenZh[idx] && (
                                <button 
                                  onClick={(e) => handleCopy(e, r.zh, `zh-${cardId}`)}
                                  className="w-6 h-6 flex items-center justify-center rounded-lg bg-[var(--bg-sub)] border border-[var(--border-dark)] hover:border-[var(--accent)] text-[var(--text-sub)] hover:text-[var(--accent)] transition-all shadow-sm opacity-0 group-hover/zh:opacity-100 ml-2 shrink-0"
                                >
                                  {copiedId === `zh-${cardId}` ? <Check className="w-3 h-3 text-[var(--accent)]" /> : <Copy className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Small bookmark toggle for comparison mode */}
                      <button 
                        onClick={(e) => handleSave(e, r)}
                        className={`absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-[var(--bg-panel)] border transition-all shadow-lg flex items-center justify-center z-20 ${isSaved ? 'border-[var(--accent)] text-[var(--accent)] scale-110' : 'border-[var(--border-dark)] text-[var(--text-sub)] hover:border-[var(--accent)] opacity-0 group-hover/card:opacity-100'}`}
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" fill={isSaved ? "currentColor" : "none"} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SingleDialectView({
  results,
  uiLang,
  s,
  playAudio,
  fontSize,
  cardPadding,
  isLoading = false,
  zhHiddenByDefault = false,
  showZhEntirely = true,
  vs3CardsPerRow = "auto",
  isMobile = false,
  onToggleSave,
  dialectName,
  glid = '',
  tooltipEnabled = true,
  activeSource,
  compareIds = [],
  compareResults = {},
  essayId,
  level,
  primarySelection,
  savedSentences = [],
  isSentenceSaved,
  sentenceLayout = "vertical"
}: SingleDialectViewProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [hiddenZh, setHiddenZh] = React.useState<Record<number, boolean>>({});

  React.useEffect(() => {
    if (zhHiddenByDefault) {
        const all: Record<number, boolean> = {};
        results.forEach((_, i) => all[i] = true);
        setHiddenZh(all);
    } else {
        setHiddenZh({});
    }
  }, [zhHiddenByDefault, results.length]);

  const handleCopy = (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSave = (e: React.MouseEvent, r: any) => {
    e.stopPropagation();
    if (onToggleSave) {
        onToggleSave({
            original_uuid: r.original_uuid || `${dialectName}:${r.ab}`,
            ab: r.ab,
            zh: r.zh,
            audio_url: r.audio_url,
            dialect_name: dialectName || "",
            source: activeSource || "",
            category: r.category || ""
        });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 opacity-50 space-y-4">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">Hydrating Precise Content...</div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 opacity-30">
        <div className="font-mono text-xs uppercase tracking-widest">No content found for this selection.</div>
      </div>
    );
  }

  const isGrid = vs3CardsPerRow === "auto";
  const isComparing = !isMobile && compareIds.length > 0;

  if (isComparing) {
    return (
      <ComparisonView 
        allIds={[null, ...compareIds]}
        results={results}
        compareResults={compareResults}
        level={level}
        activeSource={activeSource}
        essayId={essayId}
        primarySelection={primarySelection}
        playAudio={playAudio}
        fontSize={fontSize}
        showZhEntirely={showZhEntirely}
        hiddenZh={hiddenZh}
        handleCopy={handleCopy}
        copiedId={copiedId}
        savedSentences={savedSentences}
        dialectName={dialectName}
        handleSave={handleSave}
        isSentenceSaved={isSentenceSaved}
        s={s}
        sentenceLayout={sentenceLayout}
      />
    );
  }

  return (
    <div className={`mx-auto pb-12 ${isGrid ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'max-w-4xl space-y-6'}`}>
      {results.map((r: any, idx: number) => {
        const isSaved = r.original_uuid && isSentenceSaved 
            ? isSentenceSaved(r.original_uuid)
            : (savedSentences || []).some((s: any) => s.ab === r.ab && s.dialect_name === dialectName);

        return (
          <div key={idx} className="group relative flex items-center">
            <div className={`${
              activeSource === 'saved'
              ? (isMobile 
                ? 'mt-3 flex flex-col items-center justify-center bg-[var(--bg-highlight)] rounded-lg p-1.5 shrink-0 min-w-[70px] border border-[var(--border-dark)]'
                : `absolute flex flex-col items-center justify-center rounded-xl bg-[var(--bg-panel)] border border-[var(--border-dark)] text-[var(--text-sub)] font-mono shadow-xl shrink-0 transition-all group-hover:border-[var(--accent)] z-10 ${
                    isGrid ? '-left-2 -top-2 px-2 py-1 min-w-[60px]' : '-left-28 w-24 py-2'
                  }`
                )
              : (isMobile 
                ? 'mt-3 w-6 h-6 rounded-full bg-[var(--accent)] text-black font-mono font-bold text-[10px] flex items-center justify-center shadow-lg shrink-0'
                : `absolute flex items-center justify-center rounded-full bg-[var(--accent)] text-black font-mono font-black shadow-[0_0_20px_rgba(var(--accent-rgb),0.3)] shrink-0 transition-transform group-hover:scale-110 z-10 ${
                    isGrid ? '-left-2 -top-2 w-8 h-8 text-sm' : '-left-20 w-12 h-12 text-xl'
                  }`
                )
            }`}>
              {activeSource === 'saved' ? (
                <>
                  <span className="text-[7px] font-black uppercase tracking-widest opacity-50 mb-0.5">{(s as any)[r.source] || r.source}</span>
                  <span className="text-[9px] font-black tracking-tighter leading-none text-[var(--accent)] text-center break-all">{r.category?.replace('Lesson', 'L.').replace('Topic', 'T.') || '---'}</span>
                </>
              ) : (
                idx + 1
              )}
            </div>

            <div 
              onClick={() => r.audio_url && playAudio(r.audio_url)}
              style={{ padding: isMobile ? 0 : `${cardPadding}px` }}
              className={`flex-1 bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-dark)] shadow-sm hover:shadow-xl transition-all duration-500 relative flex flex-col ${isMobile ? 'space-y-0' : 'space-y-3'} group/card border-t border-t-transparent hover:border-t-[var(--accent)] cursor-pointer active:scale-[0.99]`}
            >
              {isMobile && <div className="h-4 w-full shrink-0"></div>}
              
              <div className={`flex ${sentenceLayout === 'side' && !isMobile ? 'flex-row items-center divide-x divide-[var(--border-dark)] divide-opacity-10' : `flex-col ${isMobile ? 'space-y-0' : 'space-y-3'}`}`}>
                <div className={`flex-1 flex items-start justify-between ${isMobile ? 'px-4' : ''}`}>
                  <div
                    className={`font-sans font-bold text-[var(--text-main)] leading-relaxed tracking-wide ${isMobile ? 'pr-4' : 'pr-4'}`}
                    style={{ fontSize: `${fontSize}px` }}
                    onClick={isMobile ? (e) => e.stopPropagation() : undefined}
                  >
                    <WordTooltip
                      text={r.ab}
                      dialectName={dialectName ?? ''}
                      glid={glid}
                      isMobile={isMobile}
                      enabled={tooltipEnabled}
                    />
                  </div>
                  {!isMobile && (
                    <button 
                      onClick={(e) => handleCopy(e, r.ab, `ab-${idx}`)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--bg-sub)] border border-[var(--border-dark)] hover:border-[var(--accent)] text-[var(--text-sub)] hover:text-[var(--accent)] transition-all shadow-sm hover:shadow-md opacity-0 group-hover/card:opacity-100 shrink-0"
                      title="Copy Indigenous Text"
                    >
                      {copiedId === `ab-${idx}` ? <Check className="w-3.5 h-3.5 text-[var(--accent)]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {showZhEntirely && (
                  <div className={`flex flex-col ${isMobile ? 'space-y-0 px-4' : (sentenceLayout === 'side' ? 'flex-1 pl-6 py-1' : 'space-y-1.5')}`}>
                      {sentenceLayout !== 'side' && (
                        <div className={`${isMobile ? 'h-4' : ''} w-full flex items-center`}>
                          <div className="h-[1px] w-full bg-gradient-to-r from-[var(--accent)] to-transparent opacity-10"></div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between group/zh">
                          <div 
                              className={`font-medium transition-all duration-300 flex-1 ${hiddenZh[idx] ? 'blur-md opacity-20 select-none' : 'text-[var(--text-sub)] group-hover/card:text-[var(--text-main)]'}`}
                              style={{ fontSize: `${fontSize * 0.9}px` }}
                          >
                              {r.zh}
                          </div>
                          {!hiddenZh[idx] && !isMobile && (
                            <button 
                                onClick={(e) => handleCopy(e, r.zh, `zh-${idx}`)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--bg-sub)] border border-[var(--border-dark)] hover:border-[var(--accent)] text-[var(--text-sub)] hover:text-[var(--accent)] transition-all shadow-sm hover:shadow-md opacity-0 group-hover/zh:opacity-100 ml-4 shrink-0"
                                title="Copy Chinese Translation"
                            >
                                {copiedId === `zh-${idx}` ? <Check className="w-3.5 h-3.5 text-[var(--accent)]" /> : <Copy className="w-3.5 h-3.5 opacity-70" />}
                            </button>
                          )}
                      </div>
                      {isMobile && <div className="h-4 w-full shrink-0"></div>}
                  </div>
                )}
              </div>
            </div>

            {/* Action Row for Mobile: Audio & Save - Straddling Border */}
            {isMobile && (
              <div className="absolute -bottom-4 right-4 flex items-center space-x-2 z-20">
                  <button 
                      onClick={(e) => handleSave(e, r)} 
                      className={`flex items-center justify-center w-10 h-10 rounded-full bg-[var(--bg-panel)] border transition-all cursor-pointer shadow-xl active:scale-90 ${isSaved ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border-dark)] text-[var(--text-sub)]'}`}
                  >
                      <BookmarkPlus className="w-5 h-5" fill={isSaved ? "currentColor" : "none"} />
                  </button>
                  {r.audio_url && (
                      <div 
                          onClick={() => playAudio(r.audio_url)}
                          className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--bg-panel)] border border-[var(--border-dark)] text-[var(--accent)] hover:text-black hover:bg-[var(--accent)] hover:border-[var(--accent)] transition-all cursor-pointer shadow-xl active:scale-90 group/audio"
                      >
                          <Volume2 className="w-5 h-5" />
                      </div>
                  )}
              </div>
            )}

            {/* Desktop-only Audio Indicator & Save Button */}
            {!isMobile && (
              <div className="flex items-center space-x-3 ml-6 shrink-0">
                {r.audio_url && (
                  <div 
                    onClick={() => playAudio(r.audio_url)}
                    className="flex items-center justify-center w-12 h-12 rounded-full bg-[var(--bg-panel)] border border-[var(--border-dark)] text-[var(--accent)] hover:text-black hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:scale-110 transition-all cursor-pointer shadow-xl group/audio"
                  >
                    <Volume2 className="w-6 h-6 transition-transform group-hover/audio:scale-110" />
                  </div>
                )}
                
                <button 
                  onClick={(e) => handleSave(e, r)}
                  className={`flex items-center justify-center w-12 h-12 rounded-full bg-[var(--bg-panel)] border transition-all cursor-pointer shadow-xl hover:scale-110 active:scale-90 ${isSaved ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border-dark)] text-[var(--text-sub)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
                  title="Save Sentence"
                >
                  <BookmarkPlus className="w-6 h-6" fill={isSaved ? "currentColor" : "none"} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
