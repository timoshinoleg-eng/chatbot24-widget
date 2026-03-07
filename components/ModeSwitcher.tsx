"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  WidgetMode,
  WidgetModeConfig,
  WIDGET_MODE_CONFIGS,
  setWidgetMode,
  getCurrentMode,
  logModeSwitch,
} from "@/lib/widget-modes";
import { HelpCircle, ShoppingCart, HeadphonesIcon, Settings, ChevronDown } from "lucide-react";

interface ModeSwitcherProps {
  className?: string;
  variant?: "default" | "compact" | "admin";
  onModeChange?: (mode: WidgetMode) => void;
}

const MODE_ICONS: Record<WidgetMode, React.ReactNode> = {
  faq: <HelpCircle className="h-4 w-4" />,
  sales: <ShoppingCart className="h-4 w-4" />,
  support: <HeadphonesIcon className="h-4 w-4" />,
};

const MODE_LABELS: Record<WidgetMode, string> = {
  faq: "FAQ",
  sales: "Продажи",
  support: "Поддержка",
};

const MODE_DESCRIPTIONS: Record<WidgetMode, string> = {
  faq: "Информационная поддержка, без сбора лидов",
  sales: "Максимизация конверсии, проактивные триггеры",
  support: "Тикетирование, эскалация на человека",
};

export function ModeSwitcher({
  className,
  variant = "default",
  onModeChange,
}: ModeSwitcherProps) {
  const [currentMode, setCurrentMode] = React.useState<WidgetMode>(getCurrentMode());
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Listen for mode changes from other components
  React.useEffect(() => {
    const handleModeChange = (e: CustomEvent<{ mode: WidgetMode }>) => {
      setCurrentMode(e.detail.mode);
    };

    window.addEventListener("chatbot24:modeChanged", handleModeChange as EventListener);
    return () => {
      window.removeEventListener("chatbot24:modeChanged", handleModeChange as EventListener);
    };
  }, []);

  const handleModeSelect = (mode: WidgetMode) => {
    if (mode === currentMode) {
      setIsOpen(false);
      return;
    }

    const previousMode = currentMode;
    setWidgetMode(mode);
    setCurrentMode(mode);
    setIsOpen(false);

    // Log mode switch
    logModeSwitch(previousMode, mode);

    // Notify parent
    onModeChange?.(mode);

    // Track analytics
    if (typeof window !== "undefined") {
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "mode_switch",
          data: { from: previousMode, to: mode },
        }),
      }).catch(() => {});
    }
  };

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-1 rounded-lg bg-gray-100 p-1", className)}>
        {(Object.keys(WIDGET_MODE_CONFIGS) as WidgetMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => handleModeSelect(mode)}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all",
              currentMode === mode
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
            title={MODE_DESCRIPTIONS[mode]}
          >
            {MODE_ICONS[mode]}
            {MODE_LABELS[mode]}
          </button>
        ))}
      </div>
    );
  }

  if (variant === "admin") {
    return (
      <div ref={dropdownRef} className={cn("relative", className)}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2",
            "text-sm font-medium text-gray-700 shadow-sm transition-all",
            "hover:border-gray-300 hover:bg-gray-50",
            isOpen && "border-blue-300 ring-2 ring-blue-100"
          )}
        >
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full",
              currentMode === "faq" && "bg-green-100 text-green-600",
              currentMode === "sales" && "bg-blue-100 text-blue-600",
              currentMode === "support" && "bg-purple-100 text-purple-600"
            )}
          >
            {MODE_ICONS[currentMode]}
          </span>
          <span className="flex-1 text-left">{MODE_LABELS[currentMode]}</span>
          <ChevronDown
            className={cn("h-4 w-4 text-gray-400 transition-transform", isOpen && "rotate-180")}
          />
        </button>

        {isOpen && (
          <div className="absolute right-0 z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="border-b border-gray-100 px-3 py-2">
              <p className="text-xs font-medium text-gray-500">Режим работы виджета</p>
            </div>
            <div className="p-1">
              {(Object.keys(WIDGET_MODE_CONFIGS) as WidgetMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleModeSelect(mode)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors",
                    currentMode === mode
                      ? "bg-blue-50 text-blue-900"
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                      mode === "faq" && "bg-green-100 text-green-600",
                      mode === "sales" && "bg-blue-100 text-blue-600",
                      mode === "support" && "bg-purple-100 text-purple-600"
                    )}
                  >
                    {MODE_ICONS[mode]}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{MODE_LABELS[mode]}</span>
                      {currentMode === mode && (
                        <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                          Активно
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{MODE_DESCRIPTIONS[mode]}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Режим работы</p>
      <div className="flex gap-2">
        {(Object.keys(WIDGET_MODE_CONFIGS) as WidgetMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => handleModeSelect(mode)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-lg border-2 p-3 transition-all",
              currentMode === mode
                ? mode === "faq"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : mode === "sales"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-purple-500 bg-purple-50 text-purple-700"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
              {MODE_ICONS[mode]}
            </span>
            <span className="text-xs font-medium">{MODE_LABELS[mode]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Admin mode switcher panel with additional controls
interface AdminModePanelProps {
  className?: string;
}

export function AdminModePanel({ className }: AdminModePanelProps) {
  const [stats, setStats] = React.useState<Record<WidgetMode, number>>({
    faq: 0,
    sales: 0,
    support: 0,
  });

  React.useEffect(() => {
    // Load mode statistics from localStorage
    if (typeof window !== "undefined") {
      const history = localStorage.getItem("chatbot24_mode_history");
      if (history) {
        const events = JSON.parse(history);
        const counts: Record<WidgetMode, number> = { faq: 0, sales: 0, support: 0 };
        events.forEach((e: { to: WidgetMode }) => {
          counts[e.to] = (counts[e.to] || 0) + 1;
        });
        setStats(counts);
      }
    }
  }, []);

  const config = WIDGET_MODE_CONFIGS[getCurrentMode()];

  return (
    <div className={cn("rounded-lg border border-gray-200 bg-white p-4", className)}>
      <div className="mb-4 flex items-center gap-2">
        <Settings className="h-4 w-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-900">Управление режимом</h3>
      </div>

      <ModeSwitcher variant="admin" className="mb-4" />

      <div className="space-y-3 border-t border-gray-100 pt-4">
        <h4 className="text-xs font-medium text-gray-500">Текущая конфигурация</h4>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded bg-gray-50 px-2 py-1.5">
            <span className="text-gray-500">Сбор лидов:</span>
            <span className={cn("ml-1 font-medium", config.enableLeadCapture ? "text-green-600" : "text-red-600")}>
              {config.enableLeadCapture ? "Включён" : "Выключен"}
            </span>
          </div>
          <div className="rounded bg-gray-50 px-2 py-1.5">
            <span className="text-gray-500">Эскалация:</span>
            <span className={cn("ml-1 font-medium", config.fallbackToHuman ? "text-green-600" : "text-red-600")}>
              {config.fallbackToHuman ? "Включена" : "Выключена"}
            </span>
          </div>
          <div className="rounded bg-gray-50 px-2 py-1.5">
            <span className="text-gray-500">Тикеты:</span>
            <span className={cn("ml-1 font-medium", config.ticketCreation ? "text-green-600" : "text-red-600")}>
              {config.ticketCreation ? "Включены" : "Выключены"}
            </span>
          </div>
          <div className="rounded bg-gray-50 px-2 py-1.5">
            <span className="text-gray-500">Проактивность:</span>
            <span className="ml-1 font-medium text-gray-700">
              {config.proactiveTriggers?.length || 0} триггеров
            </span>
          </div>
        </div>

        <div className="rounded bg-gray-50 px-2 py-1.5">
          <span className="text-xs text-gray-500">Быстрые кнопки:</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {config.quickButtons.map((btn, i) => (
              <span
                key={i}
                className="rounded bg-white px-1.5 py-0.5 text-[10px] text-gray-600 shadow-sm"
              >
                {btn.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <h4 className="mb-2 text-xs font-medium text-gray-500">История переключений</h4>
        <div className="flex gap-2">
          {(Object.keys(stats) as WidgetMode[]).map((mode) => (
            <div key={mode} className="flex-1 rounded bg-gray-50 px-2 py-1 text-center">
              <div className="text-lg font-semibold text-gray-700">{stats[mode]}</div>
              <div className="text-[10px] text-gray-500">{MODE_LABELS[mode]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ModeSwitcher;
