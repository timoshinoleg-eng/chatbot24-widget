"use client";

import React from "react";
import { ChatWidget } from "@/components/ChatWidget";
import { 
  Bot, 
  TrendingUp, 
  FileText, 
  Shield, 
  Zap, 
  BarChart3,
  MessageSquare,
  Sparkles
} from "lucide-react";

export default function Home() {
  const features = [
    {
      icon: Bot,
      title: "AI-Ассистент",
      description: "Умный чат-бот на базе Claude 3.5 Sonnet с пониманием контекста",
    },
    {
      icon: TrendingUp,
      title: "Скоринг Лидов",
      description: "Автоматическая классификация HOT/WARM/COLD на основе бюджета и сроков",
    },
    {
      icon: MessageSquare,
      title: "Анализ Тональности",
      description: "Обнаружение негативных сообщений и автоматическая эскалация",
    },
    {
      icon: FileText,
      title: "Генерация PDF КП",
      description: "Мгновенное создание коммерческих предложений с выбранными услугами",
    },
    {
      icon: Shield,
      title: "Guardrails",
      description: "Защита от злоупотреблений, спама и нежелательного контента",
    },
    {
      icon: BarChart3,
      title: "Аналитика",
      description: "Детальная статистика в админ-панели /admin с графиками и метриками",
    },
  ];

  const stats = [
    { value: "500+", label: "Проектов" },
    { value: "98%", label: "Довольных клиентов" },
    { value: "24/7", label: "Поддержка" },
    { value: "<2ч", label: "Ответ" },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700">
              <Sparkles className="h-4 w-4" />
              Kimi Agent 2.5 — AI Chat Widget
            </div>

            {/* Title */}
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Умный чат-виджет
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                для вашего бизнеса
              </span>
            </h1>

            {/* Description */}
            <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-600">
              AI-ассистент со скорингом лидов, анализом тональности, 
              генерацией PDF коммерческих предложений и интеграцией с Bitrix24
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-lg"
              >
                <Zap className="h-5 w-5" />
                Узнать больше
              </a>
              <a
                href="/admin"
                className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md"
              >
                <BarChart3 className="h-5 w-5" />
                Дашборд
              </a>
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-indigo-200/30 blur-3xl" />
      </section>

      {/* Stats Section */}
      <section className="border-y border-gray-100 bg-white/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold text-gray-900 sm:text-4xl">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">
              Возможности
            </h2>
            <p className="mx-auto max-w-2xl text-gray-600">
              Полный набор инструментов для автоматизации коммуникации с клиентами
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group rounded-2xl bg-white p-8 shadow-sm transition-all hover:shadow-lg"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 transition-colors group-hover:bg-blue-600">
                  <feature.icon className="h-6 w-6 text-blue-600 transition-colors group-hover:text-white" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-gray-900">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">
              Как это работает
            </h2>
            <p className="mx-auto max-w-2xl text-gray-600">
              Всего несколько шагов от первого сообщения до готового лида
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-4">
            {[
              {
                step: "01",
                title: "Клиент пишет",
                description: "Пользователь задаёт вопрос через чат-виджет",
              },
              {
                step: "02",
                title: "AI отвечает",
                description: "Ассистент отвечает, используя базу знаний",
              },
              {
                step: "03",
                title: "Сбор данных",
                description: "Собираем информацию о бюджете и сроках",
              },
              {
                step: "04",
                title: "В Bitrix24",
                description: "Лид создаётся в CRM с оценкой HOT/WARM/COLD",
              },
            ].map((item, index) => (
              <div key={index} className="relative text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-xl font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">
                  {item.title}
                </h3>
                <p className="text-gray-600">{item.description}</p>
                {index < 3 && (
                  <div className="absolute top-8 left-[60%] hidden h-0.5 w-[80%] bg-gradient-to-r from-blue-200 to-transparent md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 px-8 py-16 text-center sm:px-16">
            <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
              Готовы автоматизировать коммуникацию?
            </h2>
            <p className="mb-8 text-lg text-blue-100">
              Установите чат-виджет на свой сайт и начните получать 
              квалифицированных лидов уже сегодня
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-semibold text-blue-600 transition-all hover:bg-blue-50"
              >
                <MessageSquare className="h-5 w-5" />
                Открыть чат
              </button>
              <a
                href="/admin"
                className="inline-flex items-center gap-2 rounded-full border-2 border-white px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-white/10"
              >
                <BarChart3 className="h-5 w-5" />
                Посмотреть дашборд
              </a>
            </div>

            {/* Background decoration */}
            <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Kimi Agent 2.5</p>
                <p className="text-sm text-gray-500">AI Chat Widget</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              © 2026 ВебСтудия Про. Все права защищены.
            </p>
          </div>
        </div>
      </footer>

      {/* Chat Widget */}
      <ChatWidget />
    </main>
  );
}
