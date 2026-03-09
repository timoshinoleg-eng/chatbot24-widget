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
    sendMessage(label);
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
          {quickButtons.length > 0 && !isLoading && (
            <QuickButtonsContainer>
              <QuickButtons 
                buttons={quickButtons} 
                onButtonClick={handleQuickButtonClick}
                variant="compact"
              />
            </QuickButtonsContainer>
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
