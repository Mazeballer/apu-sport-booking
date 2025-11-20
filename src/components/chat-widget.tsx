"use client";

import type React from "react";
import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Send, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const SUGGESTED_QUESTIONS = [
  "What facilities are available today?",
  "Can I bring my own equipment?",
  "How do I cancel a booking?",
  "What are the opening hours?",
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isLoading = status !== "ready";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.elements.namedItem("chat-message") as HTMLInputElement;
    const value = input.value.trim();

    if (!value) return;

    sendMessage({ text: value });
    input.value = "";
  };

  const handleSuggestionClick = (question: string) => {
    if (isLoading) return;
    sendMessage({ text: question });
  };

  return (
    <>
      {/* Floating chat button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          size="icon"
          className="fixed bottom-8 right-8 h-16 w-16 rounded-full shadow-xl bg-blue-600 hover:bg-blue-700 text-white border-0 transition-all duration-300 hover:scale-110 flex items-center justify-center"
        >
          <Sparkles className="h-10 w-10 text-yellow-300 animate-pulse" />
        </Button>
      )}

      {/* Chat window */}
      {isOpen && (
        <Card className="fixed bottom-8 right-8 w-[400px] h-[600px] flex flex-col min-h-0 shadow-2xl bg-white dark:bg-[#0f1419] border-gray-200 dark:border-gray-800">
          {/* Header */}
          <div className="relative flex items-center justify-between p-4 bg-blue-600">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-6 w-6 text-white"
                >
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                  <path d="M12 2v4" />
                  <circle cx="12" cy="2" r="1" />
                  <circle cx="9" cy="10" r="1" fill="currentColor" />
                  <circle cx="15" cy="10" r="1" fill="currentColor" />
                  <path d="M9 14h6" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg">
                  AI Assistant
                </h3>
                <p className="text-xs text-white/80 flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                  Online
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Messages + suggestions */}
          <ScrollArea className="flex-1 min-h-0 bg-gray-50 dark:bg-[#0f1419]">
            <div className="p-6 space-y-4">
              {messages.length === 0 && !isLoading && (
                <div className="text-center pb-4">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
                    <Sparkles className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                    Welcome to AI Assistant
                  </p>
                  <p className="text-gray-500 dark:text-gray-500 text-xs mt-1">
                    Ask me about facilities, bookings, or rules.
                  </p>

                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => handleSuggestionClick(q)}
                        className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div className="flex items-start gap-2 max-w-[85%]">
                    {message.role === "assistant" && (
                      <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="h-5 w-5 text-white"
                        >
                          <rect x="6" y="6" width="12" height="12" rx="2" />
                          <circle cx="9" cy="10" r="1" fill="currentColor" />
                          <circle cx="15" cy="10" r="1" fill="currentColor" />
                          <path d="M9 14h6" />
                        </svg>
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-3 shadow-sm ${
                        message.role === "user"
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-sm"
                      }`}
                    >
                      {message.parts.map((part, index) => {
                        if (part.type === "text") {
                          return (
                            <p
                              key={index}
                              className="text-sm leading-relaxed whitespace-pre-wrap"
                            >
                              {part.text}
                            </p>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-start gap-2">
                    <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="h-5 w-5 text-white"
                      >
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                        <circle cx="9" cy="10" r="1" fill="currentColor" />
                        <circle cx="15" cy="10" r="1" fill="currentColor" />
                        <path d="M9 14h6" />
                      </svg>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 border border-gray-200 dark:border-gray-700">
                      <div className="flex gap-1">
                        <div
                          className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <div
                          className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <div
                          className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            autoComplete="off"
            className="p-4 bg-white dark:bg-[#0a0f1e] border-t border-gray-200 dark:border-gray-800"
          >
            <div className="flex gap-2">
              <Input
                name="chat-message"
                placeholder="Ask about facilities, bookings..."
                disabled={isLoading}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                className="flex-1 bg-gray-50 dark:bg-[#0f1419] border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-blue-600 rounded-full px-4 h-11"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white h-11 w-11 rounded-full shadow-lg transition-all hover:scale-105"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}
