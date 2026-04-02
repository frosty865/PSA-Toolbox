"use client";

import { useState, useCallback, useRef } from "react";

interface ResponseHistoryEntry {
  questionId: string;
  response: "YES" | "NO" | "N/A";
  timestamp: Date;
}

interface UseResponseHistoryOptions {
  maxHistory?: number;
}

/**
 * Hook to manage response history for undo functionality
 */
export function useResponseHistory(options: UseResponseHistoryOptions = {}) {
  const { maxHistory = 10 } = options;
  const [history, setHistory] = useState<ResponseHistoryEntry[]>([]);
  const historyRef = useRef<ResponseHistoryEntry[]>([]);

  const addToHistory = useCallback((questionId: string, response: "YES" | "NO" | "N/A") => {
    const entry: ResponseHistoryEntry = {
      questionId,
      response,
      timestamp: new Date(),
    };

    setHistory((prev) => {
      // Remove any existing entry for this question
      const filtered = prev.filter((e) => e.questionId !== questionId);
      // Add new entry at the beginning
      const updated = [entry, ...filtered].slice(0, maxHistory);
      historyRef.current = updated;
      return updated;
    });
  }, [maxHistory]);

  const undoLast = useCallback((): ResponseHistoryEntry | null => {
    if (history.length === 0) return null;

    const lastEntry = history[0];
    setHistory((prev) => {
      const updated = prev.slice(1);
      historyRef.current = updated;
      return updated;
    });
    return lastEntry;
  }, [history]);

  const getLastResponse = useCallback((questionId: string): "YES" | "NO" | "N/A" | null => {
    const entry = history.find((e) => e.questionId === questionId);
    return entry ? entry.response : null;
  }, [history]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    historyRef.current = [];
  }, []);

  return {
    history,
    addToHistory,
    undoLast,
    getLastResponse,
    clearHistory,
    canUndo: history.length > 0,
  };
}
