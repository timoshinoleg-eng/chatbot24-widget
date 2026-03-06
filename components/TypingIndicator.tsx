"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Bot } from "lucide-react";

interface TypingIndicatorProps {
  className?: string;
  variant?: "default" | "compact" | "minimal";
  delay?: number; // delay before showing in ms
}

export function TypingIndicator({
  className,
  variant = "default",
  delay = 400,
}: TypingIndicatorProps) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) {
    return null;
  }

  if (variant === "minimal") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2",
          className
        )}
      >
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3", className)}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div
        className={cn(
          "flex items-center gap-1 rounded-2xl bg-gray-100 px-4 py-3",
          "min-w-[60px]"
        )}
      >
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
          style={{ animationDelay: "0ms", animationDuration: "1.2s" }}
        />
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
          style={{ animationDelay: "150ms", animationDuration: "1.2s" }}
        />
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
          style={{ animationDelay: "300ms", animationDuration: "1.2s" }}
        />
      </div>
    </div>
  );
}

interface ThinkingIndicatorProps {
  text?: string;
  className?: string;
}

export function ThinkingIndicator({
  text = "Думаю...",
  className,
}: ThinkingIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs text-gray-400",
        className
      )}
    >
      <svg
        className="h-4 w-4 animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span>{text}</span>
    </div>
  );
}

export default TypingIndicator;
