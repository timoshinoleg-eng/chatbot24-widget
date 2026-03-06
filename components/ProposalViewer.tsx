"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, Download, CheckCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ProposalViewerProps {
  onClose: () => void;
  context?: {
    name?: string;
    company?: string;
    budget?: string;
    timeline?: string;
  };
}

interface Service {
  id: string;
  name: string;
  price: number;
}

export function ProposalViewer({ onClose, context }: ProposalViewerProps) {
  const [step, setStep] = useState<"form" | "generating" | "success">("form");
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: context?.name || "",
    company: context?.company || "",
    email: "",
    phone: "",
    budget: context?.budget || "",
    timeline: context?.timeline || "",
  });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [proposalId, setProposalId] = useState<string>("");

  // Load available services
  useEffect(() => {
    fetch("/api/proposal")
      .then((res) => res.json())
      .then((data) => {
        setServices(data.services || []);
      })
      .catch(console.error);
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<string, string>> = {};

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      newErrors.name = "Имя обязательно";
    }

    if (!formData.company.trim() || formData.company.trim().length < 2) {
      newErrors.company = "Компания обязательна";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email)) {
      newErrors.email = "Корректный email обязателен";
    }

    if (!formData.phone.trim() || formData.phone.trim().length < 5) {
      newErrors.phone = "Телефон обязателен";
    }

    if (selectedServices.length === 0) {
      newErrors.services = "Выберите хотя бы одну услугу";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGenerate = async () => {
    if (!validateForm()) return;

    setStep("generating");

    try {
      const response = await fetch("/api/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          selectedServices: selectedServices.map(
            (id) => services.find((s) => s.id === id)?.name || id
          ),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate proposal");
      }

      setPdfBase64(data.pdfBase64);
      setProposalId(data.proposalId);
      setStep("success");
    } catch (error) {
      console.error("Proposal generation error:", error);
      setErrors({ submit: "Ошибка генерации КП. Попробуйте позже." });
      setStep("form");
    }
  };

  const handleDownload = () => {
    if (!pdfBase64) return;

    const link = document.createElement("a");
    link.href = `data:application/pdf;base64,${pdfBase64}`;
    link.download = `KP_${formData.company}_${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
    if (errors.services) {
      setErrors((prev) => ({ ...prev, services: undefined }));
    }
  };

  const calculateTotal = () => {
    return selectedServices.reduce((total, id) => {
      const service = services.find((s) => s.id === id);
      return total + (service?.price || 0);
    }, 0);
  };

  if (step === "generating") {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-gray-900">
            Генерация КП...
          </h3>
          <p className="text-gray-600">
            Формируем персональное коммерческое предложение
          </p>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-gray-900">
            КП готово!
          </h3>
          <p className="mb-6 text-gray-600">
            Коммерческое предложение #{proposalId} успешно сгенерировано
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={handleDownload}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Download className="mr-2 h-4 w-4" />
              Скачать PDF
            </Button>
            <Button variant="outline" onClick={onClose}>
              Закрыть
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Коммерческое предложение
              </h3>
              <p className="text-sm text-gray-500">
                Сформируйте персональное КП
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {errors.submit && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {errors.submit}
            </div>
          )}

          {/* Client Info */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Информация о клиенте</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prop-name">
                  Имя <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="prop-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Иван Иванов"
                  className={cn(errors.name && "border-red-500")}
                />
                {errors.name && (
                  <p className="text-xs text-red-500">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="prop-company">
                  Компания <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="prop-company"
                  value={formData.company}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, company: e.target.value }))
                  }
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
                <Label htmlFor="prop-email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="prop-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="ivan@example.com"
                  className={cn(errors.email && "border-red-500")}
                />
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="prop-phone">
                  Телефон <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="prop-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="+7 (999) 123-45-67"
                  className={cn(errors.phone && "border-red-500")}
                />
                {errors.phone && (
                  <p className="text-xs text-red-500">{errors.phone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Services */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Выберите услуги</h4>
            <div className="space-y-2">
              {services.map((service) => (
                <div
                  key={service.id}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 transition-colors cursor-pointer",
                    selectedServices.includes(service.id)
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                  onClick={() => toggleService(service.id)}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedServices.includes(service.id)}
                      onCheckedChange={() => toggleService(service.id)}
                    />
                    <span className="font-medium">{service.name}</span>
                  </div>
                  <span className="text-green-600 font-medium">
                    {service.price.toLocaleString("ru-RU")} ₽
                  </span>
                </div>
              ))}
            </div>
            {errors.services && (
              <p className="text-xs text-red-500">{errors.services}</p>
            )}

            {/* Total */}
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
              <span className="font-medium text-gray-700">ИТОГО:</span>
              <span className="text-xl font-bold text-blue-600">
                {calculateTotal().toLocaleString("ru-RU")} ₽
              </span>
            </div>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prop-budget">Бюджет</Label>
              <Select
                value={formData.budget}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, budget: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите бюджет" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="до 50 000₽">до 50 000₽</SelectItem>
                  <SelectItem value="50 000₽ - 100 000₽">50 000₽ - 100 000₽</SelectItem>
                  <SelectItem value="100 000₽ - 250 000₽">100 000₽ - 250 000₽</SelectItem>
                  <SelectItem value="250 000₽+">250 000₽+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prop-timeline">Сроки</Label>
              <Select
                value={formData.timeline}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, timeline: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите сроки" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Срочно">Срочно</SelectItem>
                  <SelectItem value="1 неделя">1 неделя</SelectItem>
                  <SelectItem value="1 месяц">1 месяц</SelectItem>
                  <SelectItem value="Не определено">Не определено</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleGenerate}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Сгенерировать КП
            </Button>
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
