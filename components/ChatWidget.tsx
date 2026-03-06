"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  MessageCircle, 
  X, 
  Send, 
  User, 
  Bot, 
  FileText, 
  Sparkles,
  AlertCircle,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeadForm } from "./LeadForm";
import { ProposalViewer } from "./ProposalViewer";
import { cn } from "@/lib/utils";

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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Привет! 👋 Я AI-ассистент ВебСтудии Про. Чем могу помочь?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showProposal, setShowProposal] = useState(false);
  const [context, setContext] = useState<ChatContext>({});
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([
    "Какие услуги вы предлагаете?",
    "Сколько стоит разработка сайта?",
    "Какие сроки разработки?",
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(`session_${Date.now()}`);

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
          data: { sessionId: sessionId.current },
        }),
      }).catch(console.error);
    }
  }, [isOpen]);

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
          context,
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
          },
        }),
      }).catch(console.error);

      // Update suggested questions
      if (data.suggestedQuestions) {
        setSuggestedQuestions(data.suggestedQuestions);
      }

      // Check for escalation
      if (data.sentiment?.shouldEscalate) {
        setShowLeadForm(true);
      }

      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        content: data.response || "Извините, произошла ошибка. Попробуйте позже.",
        timestamp: new Date(),
        sentiment: data.sentiment,
      };

      setMessages((prev) => [...prev, assistantMessage]);
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
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickQuestion = (question: string) => {
    sendMessage(question);
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
                <p className="text-xs text-blue-100">AI-ассистент</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                  {message.sentiment?.label === "NEGATIVE" && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-red-400">
                      <AlertCircle className="h-3 w-3" />
                      Обнаружен негатив
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="flex items-center gap-1 rounded-2xl bg-gray-100 px-4 py-3">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          {suggestedQuestions.length > 0 && !isLoading && (
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-2">
              <p className="mb-2 text-xs text-gray-500">Быстрые вопросы:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.slice(0, 3).map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickQuestion(question)}
                    className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs text-blue-600 shadow-sm transition-colors hover:bg-blue-50"
                  >
                    {question}
                    <ChevronRight className="h-3 w-3" />
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
                className="flex-1"
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
            </div>
          </form>
        </div>
      )}

      {/* Lead Form Modal */}
      {showLeadForm && (
        <LeadForm
          onSubmit={handleLeadSubmit}
          onClose={() => setShowLeadForm(false)}
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
