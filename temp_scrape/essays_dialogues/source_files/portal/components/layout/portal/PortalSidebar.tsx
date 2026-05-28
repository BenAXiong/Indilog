"use client";

import React from 'react';
import { ChevronRight, BookOpen, GraduationCap, FileText, MessageSquare, List, Plus, Minus, Pin, PinOff, CheckCircle2, X } from "lucide-react";
import geometryData from "@/lib/corpus_geometry.json";
import grmptsLabels from "@/lib/grmpts_type_labels.json";
import { UILang, UIStrings } from "@/types";

interface PortalSidebarProps {
  activeSource: "essay" | "twelve" | "grmpts" | "dialogue";
  essayId: string;
  setEssayId: (val: string) => void;
  level: number;
  setLevel: (val: number) => void;
  uiLang: UILang;
  s: UIStrings;
  sidebarWidth: number;
  isSidebarCollapsed: boolean;
  isMobile?: boolean;
  onClose?: () => void;
  glid?: string | null;
  onAddCompare?: (id: string) => void;
  compareIds?: string[];
  primarySelection?: string | null;
  progress?: Record<string, any>;
}

export default function PortalSidebar({
  activeSource,
  essayId,
  setEssayId,
  level,
  setLevel,
  uiLang,
  s,
  sidebarWidth,
  isSidebarCollapsed,
  isMobile,
  onClose,
  glid,
  onAddCompare,
  compareIds = [],
  primarySelection,
  progress = {}
}: PortalSidebarProps) {

  const getParts = (cat: string) => {
    const m = essayId.match(/Level (\d+) Lesson (\d+)/);
    return m ? { level: m[1], lesson: m[2] } : { level: "1", lesson: "1" };
  };

  const currentLevel = getParts("twelve").level;
  const currentLesson = getParts("twelve").lesson;

  const isCompleted = (source: string, id: string) => {
    return progress[`${source}:${id}`] === true;
  };

  return (
    <div
      className={`${isMobile ? 'fixed inset-0 z-[300] bg-[var(--bg-panel)]' : 'h-full bg-[var(--bg-panel)] border-r border-[var(--border-dark)]'} flex flex-col transition-all duration-300 ${!isMobile && isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : ''}`}
      style={{ width: isMobile ? '100%' : `${sidebarWidth}px` }}
    >
      {/* Brand Title Area / Mobile Close Area */}
      <div className="h-16 flex-shrink-0 border-b border-[var(--border-dark)] flex items-center px-6 bg-[var(--bg-panel)] relative z-[110]">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[var(--accent)] to-transparent opacity-50"></div>
        <div className="flex items-center justify-between w-full">
          <h2 className="text-lg font-black uppercase tracking-[0.3em] text-[var(--accent)] drop-shadow-[0_0_10px_rgba(var(--accent-rgb),0.2)]">YCM_Citadel</h2>
          {isMobile && (
            <button onClick={onClose} className="p-2 -mr-2 text-[var(--text-sub)] hover:text-[var(--accent)] transition-colors">
              <X className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto ${isMobile ? 'scrollbar-none' : 'custom-scrollbar-left'} p-4 pb-32`}>
        <div className={`${isMobile ? 'space-y-4' : 'space-y-8'} pt-6`}>

        {/* Unit Selectors for LESSONS */}
        {activeSource === "twelve" && (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[16px] font-black text-[var(--accent)] uppercase tracking-[0.2em] opacity-80 ml-1">{uiLang === 'zh' ? '階數' : 'LEVEL'}</label>
              <div className={`grid ${isMobile ? 'grid-cols-6' : 'grid-cols-4'} gap-1.5`}>
                {(geometryData as any)[activeSource].levels.map((lvl: string) => (
                  <button
                    key={lvl}
                    onClick={() => {
                      setEssayId(`Level ${lvl} Lesson ${currentLesson}`);
                    }}
                    className={`h-9 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center ${currentLevel === lvl
                      ? 'bg-[var(--accent)] text-black shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]'
                      : 'bg-[var(--bg-sub)] border border-[var(--border-dark)] text-[var(--text-sub)] hover:border-[var(--accent)]'
                      }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[16px] font-black text-[var(--accent)] uppercase tracking-[0.2em] opacity-80 ml-1">{uiLang === 'zh' ? '課程' : 'LESSON'}</label>
              <div className="flex flex-col space-y-1">
                {(geometryData as any)[activeSource].classes.map((cla: number) => {
                  const title = (geometryData as any)[activeSource].titles?.[currentLevel]?.[cla];
                  const isSelected = currentLesson === String(cla);
                  const fullId = `Level ${currentLevel} Lesson ${cla}`;
                  const completed = isCompleted(activeSource, fullId);

                  return (
                    <button
                      key={cla}
                      onClick={() => {
                        setEssayId(fullId);
                        if (isMobile && onClose) onClose();
                      }}
                      className={`px-4 py-2.5 rounded-xl font-mono text-[11px] font-bold transition-all flex items-center justify-between group ${isSelected
                        ? 'bg-[var(--accent)] text-black'
                        : 'bg-[var(--bg-sub)] text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-highlight)]'
                        }`}
                    >
                      <div className="flex flex-col items-start text-left overflow-hidden">
                        <span className={`text-sm font-bold truncate w-full flex items-center gap-2 ${isSelected ? 'text-black' : 'text-[var(--text-main)]'}`}>
                          <span className="opacity-50 font-mono text-xs">{cla}.</span>
                          {title || (uiLang === 'zh' ? '課程' : 'Lesson') + cla}
                          {completed && <CheckCircle2 className={`w-3.5 h-3.5 ${isSelected ? 'text-black' : 'text-green-500'}`} />}
                        </span>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'translate-x-1' : 'opacity-0 group-hover:opacity-100'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Patterns Navigation */}
        {activeSource === "grmpts" && (
          <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[16px] font-black text-[var(--accent)] uppercase tracking-[0.2em] opacity-80 ml-1">{uiLang === 'zh' ? '階數' : 'LEVEL'}</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {((geometryData as any).grmpts?.levels || ["1", "2", "3", "4"]).map((lvl: string) => {
                    const levelLabels: Record<string, string> = {
                      "1": uiLang === 'zh' ? '初級' : 'INTRO',
                      "2": uiLang === 'zh' ? '中級' : 'INTER',
                      "3": uiLang === 'zh' ? '中高' : 'UPPER',
                      "4": uiLang === 'zh' ? '高級' : 'ADV'
                    };
                    const label = levelLabels[lvl] || lvl;
                    return (
                      <button
                        key={lvl}
                        onClick={() => setLevel(parseInt(lvl))}
                        className={`h-9 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center ${level === parseInt(lvl)
                          ? 'bg-[var(--accent)] text-black shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]'
                          : 'bg-[var(--bg-sub)] border border-[var(--border-dark)] text-[var(--text-sub)] hover:border-[var(--accent)]'
                          }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

            <div className="space-y-3">
              <label className="text-[16px] font-black text-[var(--accent)] uppercase tracking-[0.2em] opacity-80 ml-1">{s.patterns}</label>
              <div className="flex flex-col space-y-1">
                {(() => {
                  const paddedGlid = (glid || "").padStart(2, '0');
                  const langGrmpts = (geometryData as any).grmpts?.counts?.[glid || ""] || (geometryData as any).grmpts?.counts?.[paddedGlid];
                  const levelData = langGrmpts?.[String(level)] || {};
                  const keys = Object.keys(levelData).sort((a, b) => {
                    const numA = parseInt(a.replace('t', ''));
                    const numB = parseInt(b.replace('t', ''));
                    return numA - numB;
                  });

                  if (keys.length === 0) {
                    return <div className="px-4 py-2 text-[10px] font-mono text-[var(--text-sub)] opacity-50 italic">No patterns for this level</div>;
                  }

                  return keys.map((eid: string) => {
                    const isSelected = essayId === eid;
                    const label = (grmptsLabels as any)[eid] || eid;
                    const cleanLabel = label.replace(/^\d+\s*-\s*/, '');
                    const completed = isCompleted(activeSource, eid);

                    return (
                      <div
                        key={eid}
                        onClick={() => {
                          setEssayId(eid);
                          if (isMobile && onClose) onClose();
                        }}
                        className={`px-4 py-2.5 rounded-xl text-left cursor-pointer transition-all flex items-center justify-between group ${isSelected
                          ? 'bg-[var(--accent)] text-black shadow-lg'
                          : 'bg-[var(--bg-sub)] text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-highlight)]'
                          }`}
                      >
                        <span className={`text-sm font-bold truncate flex items-center gap-2 ${isSelected ? 'text-black' : 'text-[var(--text-main)]'}`}>
                          <span className="opacity-50 font-mono text-xs">{eid.replace('t', '')}.</span>
                          {cleanLabel}
                          {completed && <CheckCircle2 className={`w-3.5 h-3.5 ${isSelected ? 'text-black' : 'text-green-500'}`} />}
                        </span>
                        <div className="flex items-center">
                          {onAddCompare && !compareIds.includes(eid) && !isSelected && !isMobile ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddCompare(eid);
                              }}
                              className="p-1 hover:bg-black/10 rounded transition-colors"
                              title="Compare"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          ) : (
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'translate-x-1' : 'opacity-0 group-hover:opacity-100'}`} />
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Narrative Navigation (Essays/Dialogues) */}
        {(activeSource === "essay" || activeSource === "dialogue") && (
          <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[16px] font-black text-[var(--accent)] uppercase tracking-[0.2em] opacity-80 ml-1">{uiLang === 'zh' ? '階數' : 'LEVEL'}</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { range: [0, 19], label: uiLang === 'zh' ? '初級' : 'INTRO' },
                    { range: [20, 39], label: uiLang === 'zh' ? '中級' : 'INTER' },
                    { range: [40, 59], label: uiLang === 'zh' ? '高級' : 'ADV' }
                  ].map((grp, idx) => {
                    const currentIndex = (geometryData as any)[activeSource].findIndex((item: any) => item.title_zh === essayId);
                    const isActive = currentIndex >= grp.range[0] && currentIndex <= grp.range[1];
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          const firstInGroup = (geometryData as any)[activeSource][grp.range[0]];
                          if (firstInGroup) setEssayId(firstInGroup.title_zh);
                        }}
                        className={`h-9 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center ${isActive
                          ? 'bg-[var(--accent)] text-black shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]'
                          : 'bg-[var(--bg-sub)] border border-[var(--border-dark)] text-[var(--text-sub)] hover:border-[var(--accent)]'
                          }`}
                      >
                        {grp.label}
                      </button>
                    );
                  })}
                </div>
              </div>

            <div className="space-y-3">
              <label className="text-[16px] font-black text-[var(--accent)] uppercase tracking-[0.2em] opacity-80 ml-1">
                {activeSource === "essay" ? s.essays : s.dialogues}
              </label>
              <div className="flex flex-col space-y-1">
                {(() => {
                  const items = (geometryData as any)[activeSource] || [];
                  const currentIndex = items.findIndex((item: any) => item.title_zh === essayId);
                  const ranges = [
                    { range: [0, 19], label: uiLang === 'zh' ? '初級' : 'INTRO' },
                    { range: [20, 39], label: uiLang === 'zh' ? '中級' : 'INTER' },
                    { range: [40, 59], label: uiLang === 'zh' ? '高級' : 'ADV' }
                  ];
                  const activeRange = ranges.find(r => currentIndex >= r.range[0] && currentIndex <= r.range[1])?.range || [0, 19];

                  return items
                    .filter((_: any, i: number) => i >= activeRange[0] && i <= activeRange[1])
                    .map((item: any) => {
                      const eid = item.title_zh;
                      const isSelected = essayId === eid;
                      const completed = isCompleted(activeSource, eid);

                      return (
                        <button
                          key={`${activeSource}-${item.index}`}
                          onClick={() => {
                            setEssayId(eid);
                            if (isMobile && onClose) onClose();
                          }}
                          className={`px-4 py-2.5 rounded-xl text-left transition-all flex items-center justify-between group ${isSelected
                            ? 'bg-[var(--accent)] text-black shadow-lg'
                            : 'bg-[var(--bg-sub)] text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-highlight)]'
                            }`}
                        >
                          <span className={`text-sm font-bold truncate flex items-center gap-2 ${isSelected ? 'text-black' : 'text-[var(--text-main)]'}`}>
                            <span className="opacity-50 font-mono text-xs">{item.index + 1}.</span>
                            {eid}
                            {completed && <CheckCircle2 className={`w-3.5 h-3.5 ${isSelected ? 'text-black' : 'text-green-500'}`} />}
                          </span>
                          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'translate-x-1' : 'opacity-0 group-hover:opacity-100'}`} />
                        </button>
                      );
                    });
                })()}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
