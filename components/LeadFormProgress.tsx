"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Check, Circle } from "lucide-react";

export type FormStep = {
  id: string;
  label: string;
  description?: string;
};

interface LeadFormProgressProps {
  steps: FormStep[];
  currentStep: number;
  className?: string;
  variant?: "default" | "compact" | "ascii";
}

export function LeadFormProgress({
  steps,
  currentStep,
  className,
  variant = "default",
}: LeadFormProgressProps) {
  if (variant === "ascii") {
    // ASCII-style progress bar
    const totalBlocks = 10;
    const filledBlocks = Math.round((currentStep / steps.length) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;
    
    const progressBar = "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);
    
    return (
      <div className={cn("font-mono text-xs text-gray-600", className)}>
        <div className="mb-1">
          Шаг {currentStep}/{steps.length} [{progressBar}]
        </div>
        <div className="text-gray-400">
          {steps[currentStep - 1]?.label || "Завершение..."}
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep - 1;
          const isCurrent = index === currentStep - 1;
          
          return (
            <React.Fragment key={step.id}>
              <div
                className={cn(
                  "h-1.5 w-6 rounded-full transition-all",
                  isCompleted && "bg-green-500",
                  isCurrent && "bg-blue-500",
                  !isCompleted && !isCurrent && "bg-gray-200"
                )}
                title={step.label}
              />
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Progress header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">
          Шаг {currentStep} из {steps.length}
        </span>
        <span className="text-xs text-gray-400">
          {Math.round((currentStep / steps.length) * 100)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-2 w-full rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
          style={{ width: `${(currentStep / steps.length) * 100}%` }}
        />
      </div>

      {/* Steps */}
      <div className="flex justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep - 1;
          const isCurrent = index === currentStep - 1;
          const isPending = index > currentStep - 1;

          return (
            <div
              key={step.id}
              className={cn(
                "flex flex-col items-center gap-1",
                isPending && "opacity-50"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                  isCompleted && "border-green-500 bg-green-500 text-white",
                  isCurrent && "border-blue-500 bg-blue-50 text-blue-600",
                  isPending && "border-gray-200 bg-white text-gray-400"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-semibold">{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "max-w-[80px] text-center text-[10px] leading-tight",
                  isCompleted && "text-green-600",
                  isCurrent && "font-medium text-blue-600",
                  isPending && "text-gray-400"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface StepContentProps {
  step: FormStep;
  children: React.ReactNode;
  className?: string;
}

export function StepContent({ step, children, className }: StepContentProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-gray-900">{step.label}</h3>
        {step.description && (
          <p className="text-sm text-gray-500">{step.description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// Predefined steps for lead form
export const DEFAULT_LEAD_FORM_STEPS: FormStep[] = [
  {
    id: "contacts",
    label: "Контакты",
    description: "Как с вами связаться?",
  },
  {
    id: "project",
    label: "Проект",
    description: "Что нужно разработать?",
  },
  {
    id: "details",
    label: "Детали",
    description: "Бюджет и сроки",
  },
  {
    id: "confirm",
    label: "Проверка",
    description: "Проверьте данные",
  },
];

export default LeadFormProgress;
