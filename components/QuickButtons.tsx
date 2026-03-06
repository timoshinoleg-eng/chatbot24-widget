"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

export interface QuickButton {
  label: string;
  action: string;
  category?: string;
}

interface QuickButtonsProps {
  buttons: QuickButton[];
  onButtonClick: (action: string, label: string) => void;
  className?: string;
  variant?: "default" | "compact" | "horizontal";
}

export function QuickButtons({
  buttons,
  onButtonClick,
  className,
  variant = "default",
}: QuickButtonsProps) {
  if (!buttons || buttons.length === 0) {
    return null;
  }

  const handleClick = (button: QuickButton) => {
    // Track analytics
    if (typeof window !== "undefined") {
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "quick_button_click",
          data: {
            action: button.action,
            label: button.label,
            category: button.category,
          },
        }),
      }).catch(() => {});
    }

    onButtonClick(button.action, button.label);
  };

  if (variant === "horizontal") {
    return (
      <div
        className={cn(
          "flex gap-2 overflow-x-auto pb-2 scrollbar-hide",
          className
        )}
      >
        {buttons.map((button, index) => (
          <button
            key={`${button.action}-${index}`}
            onClick={() => handleClick(button)}
            className={cn(
              "flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs",
              "bg-blue-50 text-blue-600 shadow-sm transition-all",
              "hover:bg-blue-100 hover:shadow-md active:scale-95",
              "border border-blue-100"
            )}
          >
            {button.label}
            <ChevronRight className="h-3 w-3 opacity-50" />
          </button>
        ))}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex flex-wrap gap-1.5", className)}>
        {buttons.slice(0, 4).map((button, index) => (
          <button
            key={`${button.action}-${index}`}
            onClick={() => handleClick(button)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs",
              "bg-gray-100 text-gray-700 transition-colors",
              "hover:bg-blue-50 hover:text-blue-600"
            )}
          >
            {button.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {buttons.map((button, index) => (
        <button
          key={`${button.action}-${index}`}
          onClick={() => handleClick(button)}
          className={cn(
            "group flex items-center gap-1 rounded-lg px-3 py-2 text-xs",
            "bg-white text-gray-700 shadow-sm transition-all",
            "hover:bg-blue-50 hover:text-blue-600 hover:shadow-md",
            "border border-gray-200 hover:border-blue-200"
          )}
        >
          <span className="font-medium">{button.label}</span>
          <ChevronRight
            className={cn(
              "h-3 w-3 transition-transform",
              "group-hover:translate-x-0.5"
            )}
          />
        </button>
      ))}
    </div>
  );
}

interface QuickButtonsContainerProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function QuickButtonsContainer({
  children,
  title = "Быстрые вопросы:",
  className,
}: QuickButtonsContainerProps) {
  return (
    <div
      className={cn(
        "border-t border-gray-100 bg-gray-50/50 px-4 py-3",
        className
      )}
    >
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-400">
        {title}
      </p>
      {children}
    </div>
  );
}

export default QuickButtons;
