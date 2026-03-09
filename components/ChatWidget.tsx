"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  MessageCircle, 
  X, 
  Send, 
  User, 
  Bot, 
  FileText, 
  Sparkles,
  AlertCircle,
  Menu,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeadForm } from "./LeadForm";
import { ProposalViewer } from "./ProposalViewer";
import { QuickButtons, QuickButtonsContainer } from "./QuickButtons";
import { TypingIndicator } from "./TypingIndicator";
import { ModeSwitcher } from "./ModeSwitcher";
import { cn } from "@/lib/utils";
import { 
  getTimeBasedGreeting, 
  getQuickButtonsForPage, 
  PageContext,
  extractPageContext,
} from "@/lib/context";
import { 
  getCurrentMode, 
  getModeConfig, 
  WidgetMode,
  shouldEscalate,
  initTriggerState,
  checkTimeTrigger,
  checkScrollTrigger,
} from "@/lib/widget-modes";
import {
  getUserId,
  restoreUserContext,
  saveUserContext,
  saveConversationHistory,
  getConversationHistory,
  detectTone,
  updateUserProfile,
  generateAdaptiveGreeting,
} from "@/lib/personalization";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sentiment?: {
    label: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
    score: number;
  };
}

interface ChatContext {
  name?: string;
  company?: string;
  budget?: string;
  timeline?: string;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [currentMode, setCurrentMode] = useState<WidgetMode>("sales");
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showProposal, setShowProposal] = useState(false);
  const [context, setContext] = useState<ChatContext>({});
  const [quickButtons, setQuickButtons] = useState<Array<{ label: string; action: string }>>([]);
  const [sessionStartTime] = useState(Date.now());
  const [typingIndicator, setTypingIndicator] = useState(false);
  
  // Brief collection state
  const [briefStep, setBriefStep] = useState<number | null>(null);
  const [briefData, setBriefData] = useState<{
    businessType?: string;
    channels?: string[];
    dailyRequests?: string;
    botTasks?: string[];
    referenceBots?: string;
    budget?: string;
    contacts?: { name?: string; phone?: string; email?: string };
  }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const userId = useRef<string>("");
  const sessionId = useRef(`session_${Date.now()}`);
  const modeConfig = getModeConfig(currentMode);

  // Initialize on mount
  useEffect(() => {
    // Get or create user ID
    userId.current = getUserId();
    
    // Get current mode
    const mode = getCurrentMode();
    setCurrentMode(mode);

    // Extract page context
    const pContext = extractPageContext();
    setPageContext(pContext);

    // Set default quick buttons for chatbot consultation
    setQuickButtons([
      { label: "Сколько стоит чат-бот?", action: "price" },
      { label: "Сроки разработки", action: "timeline" },
      { label: "Примеры проектов", action: "portfolio" },
      { label: "Бесплатная консультация", action: "consultation" },
    ]);

    // Initialize trigger state
    initTriggerState(sessionId.current);

    // Restore context and history
    const initContext = async () => {
      try {
        const storedContext = await restoreUserContext(userId.current);
        const storedHistory = getConversationHistory();
        
        // Generate adaptive greeting
        const greeting = generateAdaptiveGreeting(pContext, storedContext?.userProfile);
        
        // Set welcome message based on time of day
        const timeGreeting = getTimeBasedGreeting();
        let welcomeContent = greeting.message;
        
        // If we have history, add context about previous conversation
        if (storedHistory.length > 0 && storedContext?.userProfile) {
          const lastVisit = new Date(storedContext.userProfile.lastSeen);
          const daysSince = Math.floor((Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSince < 7) {
            welcomeContent = `С возвращением${storedContext.userProfile.contacts?.name ? `, ${storedContext.userProfile.contacts.name}` : ''}! ${timeGreeting.greeting}`;
          }
        }

        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: welcomeContent,
            timestamp: new Date(),
          },
        ]);

        // Update user profile with new visit
        await updateUserProfile(userId.current, {
          lastSeen: new Date().toISOString(),
        });
      } catch (error) {
        console.error("[ChatWidget] Error initializing context:", error);
        // Fallback greeting
        const timeGreeting = getTimeBasedGreeting();
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: timeGreeting.greeting,
            timestamp: new Date(),
          },
        ]);
      }
    };

    initContext();

    // Listen for mode changes
    const handleModeChange = (e: CustomEvent<{ mode: WidgetMode }>) => {
      setCurrentMode(e.detail.mode);
    };
    window.addEventListener("chatbot24:modeChanged", handleModeChange as EventListener);

    return () => {
      window.removeEventListener("chatbot24:modeChanged", handleModeChange as EventListener);
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Track chat start
  useEffect(() => {
    if (isOpen) {
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "chat_start",
          data: { 
            sessionId: sessionId.current,
            mode: currentMode,
            page: pageContext?.path,
          },
        }),
      }).catch(console.error);
    }
  }, [isOpen, currentMode, pageContext?.path]);

  // Proactive triggers (time-based)
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
      const triggerMessage = checkTimeTrigger(sessionId.current, elapsedSeconds);
      
      if (triggerMessage && messages.length <= 1) {
        setMessages((prev) => [
          ...prev,
          {
            id: `proactive_${Date.now()}`,
            role: "assistant",
            content: triggerMessage,
            timestamp: new Date(),
          },
        ]);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isOpen, sessionStartTime, messages.length]);

  // Scroll depth tracking
  useEffect(() => {
    if (!isOpen || !chatContainerRef.current) return;

    const handleScroll = () => {
      const container = chatContainerRef.current;
      if (!container) return;

      const scrollDepth = (container.scrollTop / (container.scrollHeight - container.clientHeight)) * 100;
      const triggerMessage = checkScrollTrigger(sessionId.current, scrollDepth);
      
      if (triggerMessage) {
        setMessages((prev) => [
          ...prev,
          {
            id: `scroll_${Date.now()}`,
            role: "assistant",
            content: triggerMessage,
            timestamp: new Date(),
          },
        ]);
      }
    };

    const container = chatContainerRef.current;
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [isOpen]);

  // Save conversation history
  useEffect(() => {
    if (messages.length > 0) {
      saveConversationHistory(
        messages.map((m) => ({ role: m.role, content: m.content }))
      );
    }
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Handle brief step 7 (phone input)
    if (briefStep === 7) {
      const phone = content.trim();
      const updatedBriefData = { ...briefData, contacts: { ...briefData.contacts, phone } };
      
      const userMessage: Message = {
        id: `user_${Date.now()}`,
        role: "user",
        content: phone,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");

      // Complete brief and send to Bitrix24
      setTimeout(async () => {
        const botMessage: Message = {
          id: `bot_${Date.now()}`,
          role: "assistant",
          content: `Спасибо! Бриф заполнен ✅\n\nМенеджер получит заявку и подготовит индивидуальное предложение. Ожидайте звонка в течение рабочего дня.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
        setQuickButtons([
          { label: "Новый вопрос", action: "chat" },
          { label: "Завершить", action: "close" },
        ]);
        
        // Reset brief state
        setBriefStep(null);
        
        // Here you would call the API to send to Bitrix24
        // await sendLeadToBitrix24(updatedBriefData);
      }, 300);
      return;
    }

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setTypingIndicator(modeConfig.features.showTypingIndicator);

    // Detect tone from messages
    const tone = detectTone([...messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    })));

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          userId: sessionId.current,
          context: {
            ...context,
            tone,
            mode: currentMode,
            pageContext,
          },
        }),
      });

      const data = await response.json();

      // Track message
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "chat_message",
          data: {
            sessionId: sessionId.current,
            sentiment: data.sentiment?.label,
            tone,
            mode: currentMode,
          },
        }),
      }).catch(console.error);

      // Check for escalation based on mode config
      const shouldEscalateToHuman = shouldEscalate(
        messages.length,
        data.sentiment?.score || 0,
        content
      );

      if (shouldEscalateToHuman && modeConfig.fallbackToHuman) {
        setShowLeadForm(true);
      }

      // Update quick buttons based on context
      if (data.suggestedActions) {
        setQuickButtons(data.suggestedActions);
      }

      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        content: data.response || "Извините, произошла ошибка. Попробуйте позже.",
        timestamp: new Date(),
        sentiment: data.sentiment,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Save user context
      await saveUserContext(userId.current, {
        lastMessages: messages.slice(-5).map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
        })),
      });

    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          role: "assistant",
          content: "Извините, произошла ошибка. Попробуйте позже.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setTypingIndicator(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickButtonClick = (action: string, label: string) => {
    // Add user message
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: label,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // If we're in brief mode, handle brief step
    if (briefStep !== null) {
      handleBriefStep(action, label);
      return;
    }

    // Handle specific quick actions with predefined responses
    let botResponse = "";
    let newButtons: Array<{ label: string; action: string }> = [];

    switch (action) {
      case "price":
        botResponse = "Стоимость чат-бота зависит от количества каналов, сложности сценариев и интеграций:\n\n• MVP-бот (1 канал): от 49 000 ₽\n• Бизнес-бот (2-3 канала + CRM): от 89 000 ₽\n• Корпоративный (все каналы + AI): от 149 000 ₽\n\nТочный расчёт возможен только после заполнения брифа — менеджер проанализирует задачу и подготовит индивидуальное предложение.";
        newButtons = [
          { label: "Заполнить бриф", action: "brief" },
          { label: "Примеры проектов", action: "portfolio" },
          { label: "Сроки разработки", action: "timeline" },
        ];
        break;

      case "timeline":
        botResponse = "Сроки разработки чат-бота:\n\n• MVP-бот: 1-2 недели\n• Бизнес-бот: 2-3 недели\n• Корпоративный: 3-4 недели\n\nТочные сроки зависят от:\n• Количества каналов связи\n• Сложности сценариев диалога\n• Необходимых интеграций (CRM, платёжные системы)\n• Согласования макетов и тестирования";
        newButtons = [
          { label: "Сколько стоит?", action: "price" },
          { label: "Примеры проектов", action: "portfolio" },
          { label: "Заполнить бриф", action: "brief" },
        ];
        break;

      case "portfolio":
        botResponse = "У нас есть опыт в разных сферах:\n\n🏪 Ритейл: магазины одежды, цветочные, мебель\n💇 Услуги: салоны красоты, автосервисы, клининг\n📚 Образование: онлайн-школы, детские центры\n🏥 Медицина: стоматологии, медицинские центры\n🏠 Недвижимость: агентства, застройщики\n\nКаждый проект индивидуален — расскажите о вашей задаче, и я подберу релевантные кейсы.";
        newButtons = [
          { label: "Рассказать о задаче", action: "brief" },
          { label: "Сколько стоит?", action: "price" },
          { label: "Сроки", action: "timeline" },
        ];
        break;

      case "consultation":
        botResponse = "Конечно! Проведу бесплатную консультацию. Чтобы подготовить полезную информацию, расскажите:\n\n1. Какая у вас сфера бизнеса?\n2. Какие каналы связи используете (Telegram, WhatsApp, Instagram, MAx)?\n3. Сколько заявок/сообщений получаете в день?\n\nИли сразу заполните бриф — это займёт 2 минуты.";
        newButtons = [
          { label: "Заполнить бриф", action: "brief" },
          { label: "Сначала расскажу о задаче", action: "chat" },
        ];
        break;

      case "brief":
        // Start brief collection process
        setBriefStep(1);
        botResponse = "Отлично! Давайте соберём информацию для точного расчёта.\n\nШаг 1 из 6: Какая у вас сфера бизнеса?";
        newButtons = [
          { label: "Магазин", action: "business_retail" },
          { label: "Услуги", action: "business_services" },
          { label: "Образование", action: "business_education" },
          { label: "Медицина", action: "business_medical" },
          { label: "Недвижимость", action: "business_realestate" },
          { label: "Другое", action: "business_other" },
        ];
        break;

      case "close":
        setIsOpen(false);
        return;

      case "chat":
        botResponse = "Чем могу помочь? Задавайте вопрос — расскажу о чат-ботах, интеграциях, сроках и стоимости.";
        newButtons = [
          { label: "Сколько стоит чат-бот?", action: "price" },
          { label: "Сроки разработки", action: "timeline" },
          { label: "Примеры проектов", action: "portfolio" },
          { label: "Бесплатная консультация", action: "consultation" },
        ];
        break;

      default:
        // For unknown actions, send to API
        sendMessage(label);
        return;
    }

    // Add bot response
    setTimeout(() => {
      const botMessage: Message = {
        id: `bot_${Date.now()}`,
        role: "assistant",
        content: botResponse,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
      setQuickButtons(newButtons);
    }, 300);
  };

  // Handle brief step-by-step collection
  const handleBriefStep = (action: string, label: string) => {
    let botResponse = "";
    let newButtons: Array<{ label: string; action: string }> = [];
    let nextStep = briefStep;

    switch (briefStep) {
      case 1: // Business type
        setBriefData((prev) => ({ ...prev, businessType: label }));
        nextStep = 2;
        botResponse = "Отлично! Шаг 2 из 6: Какие каналы связи используете? (можно выбрать несколько, нажимая по очереди)";
        newButtons = [
          { label: "Telegram", action: "channel_tg" },
          { label: "WhatsApp", action: "channel_wa" },
          { label: "Instagram", action: "channel_ig" },
          { label: "MAx", action: "channel_max" },
          { label: "Сайт", action: "channel_site" },
          { label: "Готово", action: "channels_done" },
        ];
        break;

      case 2: // Channels
        if (action === "channels_done") {
          nextStep = 3;
          botResponse = "Понял! Шаг 3 из 6: Сколько заявок/сообщений получаете в день?";
          newButtons = [
            { label: "До 10", action: "requests_10" },
            { label: "10-50", action: "requests_50" },
            { label: "50-100", action: "requests_100" },
            { label: "100+", action: "requests_more" },
          ];
        } else {
          // Add channel to list
          const channel = label;
          setBriefData((prev) => ({
            ...prev,
            channels: [...(prev.channels || []), channel],
          }));
          return; // Don't send message yet, wait for more selections
        }
        break;

      case 3: // Daily requests
        setBriefData((prev) => ({ ...prev, dailyRequests: label }));
        nextStep = 4;
        botResponse = "Шаг 4 из 6: Какие задачи должен решать бот? (выберите все подходящие)";
        newButtons = [
          { label: "FAQ", action: "task_faq" },
          { label: "Запись клиентов", action: "task_booking" },
          { label: "Квалификация", action: "task_qualify" },
          { label: "Прайсы", action: "task_pricing" },
          { label: "CRM", action: "task_crm" },
          { label: "Готово", action: "tasks_done" },
        ];
        break;

      case 4: // Tasks
        if (action === "tasks_done") {
          nextStep = 5;
          botResponse = "Шаг 5 из 6: Есть примеры ботов, которые вам нравятся?";
          newButtons = [
            { label: "Да, пришлю ссылку", action: "ref_yes" },
            { label: "Нет", action: "ref_no" },
            { label: "Есть свои идеи", action: "ref_ideas" },
          ];
        } else {
          const task = label;
          setBriefData((prev) => ({
            ...prev,
            botTasks: [...(prev.botTasks || []), task],
          }));
          return;
        }
        break;

      case 5: // Reference bots
        setBriefData((prev) => ({ ...prev, referenceBots: label }));
        nextStep = 6;
        botResponse = "Шаг 6 из 6: Какой примерный бюджет?";
        newButtons = [
          { label: "До 50 000 ₽", action: "budget_50k" },
          { label: "50-100к", action: "budget_100k" },
          { label: "100-200к", action: "budget_200k" },
          { label: "200к+", action: "budget_more" },
          { label: "Обсудить с менеджером", action: "budget_discuss" },
        ];
        break;

      case 6: // Budget
        setBriefData((prev) => ({ ...prev, budget: label }));
        nextStep = 7;
        botResponse = "Последний шаг: Оставьте телефон для связи. Менеджер свяжется с вами и подготовит индивидуальное предложение.";
        // Clear buttons, use text input
        newButtons = [];
        break;
    }

    setBriefStep(nextStep);

    // Add bot response
    if (botResponse) {
      setTimeout(() => {
        const botMessage: Message = {
          id: `bot_${Date.now()}`,
          role: "assistant",
          content: botResponse,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
        setQuickButtons(newButtons);
      }, 300);
    }
  };

  const handleLeadSubmit = (leadData: any) => {
    setContext((prev) => ({
      ...prev,
      name: leadData.name,
      company: leadData.company,
      budget: leadData.budget,
      timeline: leadData.timeline,
    }));
    setShowLeadForm(false);
    
    // Update user profile with contact info
    updateUserProfile(userId.current, {
      contacts: {
        name: leadData.name,
        phone: leadData.phone,
        email: leadData.email,
        company: leadData.company,
      },
    });
    
    // Add confirmation message
    setMessages((prev) => [
      ...prev,
      {
        id: `confirmation_${Date.now()}`,
        role: "assistant",
        content: `Спасибо, ${leadData.name}! Ваша заявка принята. Наш менеджер свяжется с вами в ближайшее время. Хотите получить коммерческое предложение?`,
        timestamp: new Date(),
      },
    ]);
  };

  const handleProposalRequest = () => {
    setShowProposal(true);
  };

  const handleModeChange = (mode: WidgetMode) => {
    setCurrentMode(mode);
    setShowModeMenu(false);
    
    // Add mode change notification
    setMessages((prev) => [
      ...prev,
      {
        id: `mode_${Date.now()}`,
        role: "assistant",
        content: `Режим изменён на "${mode === 'faq' ? 'FAQ' : mode === 'sales' ? 'Продажи' : 'Поддержка'}". ${getModeConfig(mode).greeting}`,
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-110",
          isOpen
            ? "bg-red-500 hover:bg-red-600"
            : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        )}
      >
        {isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <MessageCircle className="h-6 w-6 text-white" />
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[600px] w-[400px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Kimi Agent 2.5</h3>
                <div className="flex items-center gap-1">
                  {modeConfig.features.showOnlineStatus && (
                    <>
                      <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
                      <span className="text-xs text-blue-100">Онлайн</span>
                    </>
                  )}
                  <span className="text-xs text-blue-100/70">• {currentMode === 'faq' ? 'FAQ' : currentMode === 'sales' ? 'Продажи' : 'Поддержка'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowModeMenu(!showModeMenu)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
                title="Сменить режим"
              >
                <Menu className="h-4 w-4 text-white" />
              </button>
              {modeConfig.enableLeadCapture && (
                <>
                  <button
                    onClick={handleProposalRequest}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
                    title="Получить КП"
                  >
                    <FileText className="h-4 w-4 text-white" />
                  </button>
                  <button
                    onClick={() => setShowLeadForm(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
                    title="Оставить заявку"
                  >
                    <Sparkles className="h-4 w-4 text-white" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Mode Switcher Dropdown */}
          {showModeMenu && (
            <div className="border-b border-gray-100 bg-gray-50 p-3">
              <ModeSwitcher 
                variant="compact" 
                onModeChange={handleModeChange}
              />
            </div>
          )}

          {/* Messages */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    message.role === "user"
                      ? "bg-blue-100"
                      : "bg-gradient-to-br from-blue-500 to-indigo-600"
                  )}
                >
                  {message.role === "user" ? (
                    <User className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Bot className="h-4 w-4 text-white" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-800"
                  )}
                >
                  {message.content}
                  {message.sentiment?.label === "NEGATIVE" && modeConfig.urgencyIndicators && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-red-400">
                      <AlertCircle className="h-3 w-3" />
                      Обнаружен негатив
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {(isLoading || typingIndicator) && modeConfig.features.showTypingIndicator && (
              <TypingIndicator variant="default" />
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Buttons */}
          {quickButtons.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
              <p className="mb-2 text-xs text-gray-500">Быстрые вопросы:</p>
              <div className="flex flex-wrap gap-2">
                {quickButtons.map((button, index) => (
                  <button
                    key={`${button.action}-${index}`}
                    onClick={() => handleQuickButtonClick(button.action, button.label)}
                    className="rounded-lg px-3 py-2 text-xs font-medium bg-white text-gray-700 border border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all"
                  >
                    {button.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-gray-100 bg-white p-4"
          >
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Введите сообщение..."
                className="flex-1 text-gray-900 bg-white border-gray-300"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>          </form>
        </div>
      )}

      {/* Lead Form Modal */}
      {showLeadForm && modeConfig.enableLeadCapture && (
        <LeadForm
          onSubmit={handleLeadSubmit}
          onClose={() => setShowLeadForm(false)}
          sessionId={sessionId.current}
          initialData={context}
        />
      )}

      {/* Proposal Modal */}
      {showProposal && (
        <ProposalViewer
          onClose={() => setShowProposal(false)}
          context={context}
        />
      )}
    </>
  );
}

export default ChatWidget;
