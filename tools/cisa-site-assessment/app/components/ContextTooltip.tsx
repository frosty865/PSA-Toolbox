"use client";

import React, { useState, useRef, useEffect } from "react";

interface ContextTooltipProps {
  content: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export default function ContextTooltip({
  content,
  children,
  position = "top",
  className = "",
}: ContextTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && tooltipRef.current && triggerRef.current) {
      // Use requestAnimationFrame to ensure DOM is updated before measuring
      requestAnimationFrame(() => {
        if (!tooltipRef.current || !triggerRef.current) return;
        
        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        
        let top = 0;
        let left = 0;

        switch (position) {
          case "top":
            top = triggerRect.top - tooltipRect.height - 8;
            left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
            break;
          case "bottom":
            top = triggerRect.bottom + 8;
            left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
            break;
          case "left":
            top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
            left = triggerRect.left - tooltipRect.width - 8;
            break;
          case "right":
            top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
            left = triggerRect.right + 8;
            break;
        }

        // Keep tooltip within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 8;

        // Constrain horizontally
        if (left < padding) {
          left = padding;
        } else if (left + tooltipRect.width > viewportWidth - padding) {
          left = viewportWidth - tooltipRect.width - padding;
        }

        // Constrain vertically
        if (top < padding) {
          top = padding;
        } else if (top + tooltipRect.height > viewportHeight - padding) {
          top = viewportHeight - tooltipRect.height - padding;
        }

        setTooltipPosition({ top, left });
      });
    } else {
      queueMicrotask(() => setTooltipPosition(null));
    }
  }, [isVisible, position]);

  return (
    <div
      ref={triggerRef}
      className={`context-tooltip-trigger ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      style={{ display: "inline-block", position: "relative" }}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className="context-tooltip"
          role="tooltip"
          style={{
            position: "fixed",
            top: tooltipPosition ? `${tooltipPosition.top}px` : "-9999px",
            left: tooltipPosition ? `${tooltipPosition.left}px` : "-9999px",
            zIndex: 10000,
            backgroundColor: "#1b1b1b",
            color: "#fff",
            padding: "0.75rem 1rem",
            borderRadius: "0.25rem",
            fontSize: "0.875rem",
            lineHeight: "1.5",
            maxWidth: "300px",
            minWidth: "150px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            pointerEvents: "none",
            opacity: tooltipPosition ? 1 : 0,
            transition: "opacity 0.15s ease",
            whiteSpace: "normal",
            wordWrap: "break-word",
          }}
        >
          {content}
          <div
            style={{
              position: "absolute",
              width: 0,
              height: 0,
              borderStyle: "solid",
              ...(position === "top" && {
                bottom: "-6px",
                left: "50%",
                transform: "translateX(-50%)",
                borderWidth: "6px 6px 0 6px",
                borderColor: "#1b1b1b transparent transparent transparent",
              }),
              ...(position === "bottom" && {
                top: "-6px",
                left: "50%",
                transform: "translateX(-50%)",
                borderWidth: "0 6px 6px 6px",
                borderColor: "transparent transparent #1b1b1b transparent",
              }),
              ...(position === "left" && {
                right: "-6px",
                top: "50%",
                transform: "translateY(-50%)",
                borderWidth: "6px 0 6px 6px",
                borderColor: "transparent transparent transparent #1b1b1b",
              }),
              ...(position === "right" && {
                left: "-6px",
                top: "50%",
                transform: "translateY(-50%)",
                borderWidth: "6px 6px 6px 0",
                borderColor: "transparent #1b1b1b transparent transparent",
              }),
            }}
          />
        </div>
      )}
    </div>
  );
}
