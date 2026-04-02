"use client";

import { useEffect, useRef, useCallback } from "react";

interface UseKeyboardNavigationOptions {
  onNext?: () => void;
  onPrevious?: () => void;
  onSelect?: (value: "YES" | "NO" | "N/A") => void;
  enabled?: boolean;
  currentIndex?: number;
  totalItems?: number;
}

/**
 * Custom hook for keyboard navigation in assessment questions
 * Supports:
 * - Arrow keys to navigate between questions
 * - Enter/Space to select options
 * - Tab for normal form navigation
 */
export function useKeyboardNavigation({
  onNext,
  onPrevious,
  onSelect,
  enabled = true,
  currentIndex = 0,
  totalItems = 0,
}: UseKeyboardNavigationOptions) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't interfere with form inputs, textareas, or when user is typing
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Allow Tab and Shift+Tab for normal form navigation
        if (event.key === "Tab") return;
        // Allow Enter in text inputs
        if (event.key === "Enter" && target.tagName === "INPUT" && (target as HTMLInputElement).type === "text") {
          return;
        }
      }

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          if (onNext && currentIndex < totalItems - 1) {
            onNext();
          }
          break;

        case "ArrowUp":
          event.preventDefault();
          if (onPrevious && currentIndex > 0) {
            onPrevious();
          }
          break;

        case "Enter":
        case " ":
          // Only handle if not in an input field
          if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
            event.preventDefault();
            // Focus the first radio button in current question
            const currentQuestion = containerRef.current?.querySelector(
              `[data-question-index="${currentIndex}"]`
            );
            if (currentQuestion) {
              const firstRadio = currentQuestion.querySelector(
                'input[type="radio"]'
              ) as HTMLInputElement;
              if (firstRadio) {
                firstRadio.focus();
              }
            }
          }
          break;

        case "1":
        case "2":
        case "3":
          // Quick select: 1=YES, 2=NO, 3=N/A
          if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
          event.preventDefault();
          const valueMap: Record<string, "YES" | "NO" | "N/A"> = {
            "1": "YES",
            "2": "NO",
            "3": "N/A",
          };
          if (onSelect && valueMap[event.key]) {
            onSelect(valueMap[event.key]);
          }
          break;
      }
    },
    [enabled, onNext, onPrevious, onSelect, currentIndex, totalItems]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  return { containerRef };
}
