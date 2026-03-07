"use client";

import React, { useState } from "react";
import { X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface LeadFormProps {
  onSubmit: (data: LeadFormData) => void;
  onClose: () => void;
  sessionId?: string;
  initialData?: {
    name?: string;
    company?: string;
    budget?: string;
    timeline?: string;
  };
}

export interface LeadFormData {
  name: string;
  company: string;
  phone: string;
  email: string;
  budget: string;
  timeline: string;
  message: string;
  sessionId?: string;
}

export function LeadForm({ onSubmit, onClose, sessionId, initialData }: LeadFormProps) {
  const [formData, setFormData] = useState<LeadFormData>({
    name: initialData?.name || "",
    company: initialData?.company || "",
    phone: "",
    email: "",
    budget: initialData?.budget || "не указан",
    timeline: initialData?.timeline || "не указаны",
    message: "",
    sessionId: sessionId,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof LeadFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof LeadFormData, string>> = {};

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      newErrors.name = "Имя должно содержать минимум 2 символа";
    }

    if (!formData.company.trim() || formData.company.trim().length < 2) {
      newErrors.company = "Название компании обязательно";
    }

    // Basic Russian phone validation
    const phoneRegex = /^(\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;
    if (!formData.phone.trim() || !phoneRegex.test(formData.phone.replace(/[\s\-\(\)]/g, ""))) {
      newErrors.phone = "Введите корректный номер телефона";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email)) {
      newErrors.email = "Введите корректный email";
    }

    // budget и timeline необязательные поля

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          setErrors(data.errors);
        } else {
          setSubmitError(data.error || "Произошла ошибка при отправке");
        }
        return;
      }

      setIsSuccess(true);
      onSubmit(formData);

      // Close after showing success
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (error) {
      console.error("Lead submission error:", error);
      setSubmitError("Произошла ошибка при отправке. Попробуйте позже.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof LeadFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-gray-900">
            Заявка отправлена!
          </h3>
          <p className="text-gray-600">
            Спасибо, {formData.name}! Наш менеджер свяжется с вами в ближайшее время.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg max-h-[90vh] rounded-2xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4 rounded-t-2xl shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Оставить заявку</h3>
            <p className="text-sm text-gray-500">
              Заполните форму, и мы свяжемся с вами
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {submitError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {submitError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Имя <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Иван"
                className={cn(errors.name && "border-red-500")}
              />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">
                Компания <span className="text-red-500">*</span>
              </Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => handleChange("company", e.target.value)}
                placeholder="ООО Пример"
                className={cn(errors.company && "border-red-500")}
              />
              {errors.company && (
                <p className="text-xs text-red-500">{errors.company}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">
                Телефон <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="+7 (999) 123-45-67"
                className={cn(errors.phone && "border-red-500")}
              />
              {errors.phone && (
                <p className="text-xs text-red-500">{errors.phone}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="ivan@example.com"
                className={cn(errors.email && "border-red-500")}
              />
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget">Бюджет</Label>
              <Select
                value={formData.budget}
                onValueChange={(value) => handleChange("budget", value)}
              >
                <SelectTrigger className={cn(errors.budget && "border-red-500")}>
                  <SelectValue placeholder="Выберите бюджет" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="не указан">Не указан</SelectItem>
                  <SelectItem value="до 50 000₽">до 50 000₽</SelectItem>
                  <SelectItem value="50 000₽ - 100 000₽">50 000₽ - 100 000₽</SelectItem>
                  <SelectItem value="100 000₽ - 250 000₽">100 000₽ - 250 000₽</SelectItem>
                  <SelectItem value="250 000₽+">250 000₽+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeline">Сроки</Label>
              <Select
                value={formData.timeline}
                onValueChange={(value) => handleChange("timeline", value)}
              >
                <SelectTrigger className={cn(errors.timeline && "border-red-500")}>
                  <SelectValue placeholder="Выберите сроки" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="не указаны">Не указаны</SelectItem>
                  <SelectItem value="Срочно">Срочно</SelectItem>
                  <SelectItem value="1 неделя">1 неделя</SelectItem>
                  <SelectItem value="1 месяц">1 месяц</SelectItem>
                  <SelectItem value="Не определено">Не определено</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Сообщение (опционально)</Label>
            <textarea
              id="message"
              value={formData.message}
              onChange={(e) => handleChange("message", e.target.value)}
              placeholder="Расскажите о вашем проекте..."
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Отправка...
              </>
            ) : (
              "Отправить заявку"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
