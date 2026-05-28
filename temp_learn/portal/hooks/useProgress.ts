import { useState, useEffect } from 'react';
import { usePersistedState } from './usePersistedState';

export interface SavedSentence {
    original_uuid: string;
    ab: string;
    zh: string;
    audio_url?: string;
    dialect_name: string;
    source: string;
    category: string;
    saved_at: number;
}

export function useProgress() {
    // Saved Sentences
    const [savedSentences, setSavedSentences] = usePersistedState<SavedSentence[]>("yc_saved_sentences", []);

    // Completed Lessons (Source:Category -> Boolean)
    const [completedLessons, setCompletedLessons] = usePersistedState<Record<string, boolean>>("yc_completed_lessons", {});

    const toggleSaveSentence = (sentence: Omit<SavedSentence, 'saved_at'>) => {
        setSavedSentences(prev => {
            const exists = prev.find(s => s.original_uuid === sentence.original_uuid);
            if (exists) {
                return prev.filter(s => s.original_uuid !== sentence.original_uuid);
            } else {
                return [...prev, { ...sentence, saved_at: Date.now() }];
            }
        });
    };

    const isSentenceSaved = (uuid: string) => {
        return savedSentences.some(s => s.original_uuid === uuid);
    };

    const toggleLessonCompletion = (source: string, category: string) => {
        const key = `${source}:${category}`;
        setCompletedLessons(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const isLessonCompleted = (source: string, category: string) => {
        return !!completedLessons[`${source}:${category}`];
    };

    return {
        savedSentences,
        toggleSaveSentence,
        isSentenceSaved,
        completedLessons,
        toggleLessonCompletion,
        isLessonCompleted
    };
}
