"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Send, Sparkles, Mic, MicOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// CONFIGURATION:
const BRAND_COLOR = "#005596";
const GRADIENT_STYLE = {
  backgroundImage: `linear-gradient(135deg, ${BRAND_COLOR} 0%, #6366f1 100%)`,
};

const SUGGESTED_QUESTIONS = [
  "What facilities are available?",
  "Can I bring my own equipment?",
  "How do I cancel a booking?",
  "Opening hours?",
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveringChat, setHoveringChat] = useState(false);

  const [inputValue, setInputValue] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isLoading = status !== "ready";
  const isOnline = status !== "error";

  useEffect(() => {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isOpen]);

  useEffect(() => {
    if (isOpen && hoveringChat) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [isOpen, hoveringChat]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const AnyWindow = window as any;
    const RecognitionClass =
      AnyWindow.SpeechRecognition || AnyWindow.webkitSpeechRecognition;

    if (!RecognitionClass) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new RecognitionClass() as any;
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript + " ";
      }
      setInputValue(text.trim());
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    setSpeechSupported(true);

    return () => recognition.stop();
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = inputValue.trim();
    if (!value) return;
    if (!isOnline || isLoading) return;

    sendMessage({ text: value });
    setInputValue("");
  };

  const handleSuggestionClick = (question: string) => {
    if (isLoading || !isOnline) return;
    sendMessage({ text: question });
  };

  const toggleRecording = () => {
    if (!speechSupported || !recognitionRef.current) return;
    if (!isOnline || isLoading) return;

    if (isRecording) {
      recognitionRef.current.stop();
      return;
    }
    setInputValue("");
    setIsRecording(true);
    try {
      recognitionRef.current.start();
    } catch {
      setIsRecording(false);
    }
  };

  // Follow up suggestions logic...
  const lastUserMessage = [...messages]
    .slice()
    .reverse()
    .find((m) => m.role === "user");
  const lastAssistantMessage = [...messages]
    .slice()
    .reverse()
    .find((m) => m.role === "assistant");

  const followUpSuggestions = (() => {
    if (!lastUserMessage && !lastAssistantMessage) return [];

    const extractText = (msg: (typeof messages)[number] | undefined) =>
      msg
        ? msg.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as any).text as string)
            .join(" ")
            .toLowerCase()
        : "";

    const userText = extractText(lastUserMessage);
    const assistantText = extractText(lastAssistantMessage);
    const suggestions = new Set<string>();

    if (
      assistantText.includes("availability") ||
      assistantText.includes("time slots")
    ) {
      suggestions.add("Book one of these times");
      suggestions.add("Check another day");
    }
    if (assistantText.includes("how long")) {
      suggestions.add("1 hour");
      suggestions.add("2 hours");
    }
    if (assistantText.includes("equipment")) {
      suggestions.add("No equipment needed");
      suggestions.add("Borrow both equipment");
    }
    if (assistantText.includes("booking has been created")) {
      suggestions.add("Summarise my booking");
      suggestions.add("Cancel this booking");
    }
    if (userText.includes("book") || userText.includes("reserve")) {
      suggestions.add("Rules?");
      suggestions.add("No-show policy?");
    }
    if (suggestions.size === 0) {
      suggestions.add("What facilities?");
      suggestions.add("Cancellation policy?");
    }
    return Array.from(suggestions);
  })();

  return (
    <>
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          size="icon"
          style={GRADIENT_STYLE}
          className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 h-16 w-16 rounded-full shadow-2xl text-white border-0 transition-all duration-300 hover:scale-110 flex items-center justify-center z-50 hover:brightness-110"
        >
          <Sparkles className="h-8 w-8 text-yellow-300 animate-pulse" />
        </Button>
      )}

      {isOpen && (
        <Card
          className="fixed bottom-2 left-2 right-2 sm:left-auto sm:right-8 sm:bottom-8
                     w-auto sm:w-[400px] max-w-full
                     h-[70vh] sm:h-[600px]
                     flex flex-col min-h-0 shadow-2xl
                     bg-white dark:bg-[#0f1419]
                     border-gray-200 dark:border-gray-800
                     z-50 overflow-hidden"
          onMouseEnter={() => setHoveringChat(true)}
          onMouseLeave={() => setHoveringChat(false)}
        >
          {/* Header */}
          <div
            className="relative flex items-center justify-between p-4 shadow-md z-10"
            style={GRADIENT_STYLE}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg tracking-wide">
                  Assistant
                </h3>
                <p className="text-xs flex items-center gap-1 font-medium text-white">
                  <span
                    className={`inline-block h-2 w-2 rounded-full border border-white/50 ${
                      isOnline ? "bg-green-400 animate-pulse" : "bg-red-500"
                    }`}
                  />
                  {isOnline ? "Active" : "Offline"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMessages([]);
                  setInputValue("");
                }}
                className="h-8 px-3 text-xs text-white hover:bg-white/20 rounded-full transition-colors"
              >
                Reset
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 text-white hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Offline banner */}
          {!isOnline && (
            <div className="px-4 py-2 text-xs text-red-700 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30">
              Assistant is offline right now. Please try again later.
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 min-h-0 bg-gray-50/50 dark:bg-[#0f1419]">
            <div className="p-4 space-y-6">
              {messages.length === 0 && !isLoading && (
                <div className="text-center pt-8 pb-4 px-4">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/10 mb-4 shadow-sm">
                    <Sparkles
                      className="h-8 w-8"
                      style={{ color: BRAND_COLOR }}
                    />
                  </div>
                  <h3 className="text-gray-900 dark:text-gray-100 font-semibold mb-1">
                    How can I help you?
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                    Ask about bookings, times, or rules.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => handleSuggestionClick(q)}
                        disabled={!isOnline || isLoading}
                        className="text-xs px-3 py-2 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-gray-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <div className="flex items-end gap-2 max-w-[85%]">
                    {message.role === "assistant" && (
                      <div
                        className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 mb-1"
                        style={GRADIENT_STYLE}
                      >
                        <Sparkles className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <div
                      style={message.role === "user" ? GRADIENT_STYLE : {}}
                      className={`px-4 py-3 shadow-sm ${
                        message.role === "user"
                          ? "text-white rounded-2xl rounded-br-none"
                          : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-none"
                      }`}
                    >
                      {message.parts.map((part, index) => {
                        if (part.type !== "text") return null;
                        if (message.role === "user") {
                          return (
                            <p
                              key={index}
                              className="text-sm whitespace-pre-wrap font-medium"
                            >
                              {part.text}
                            </p>
                          );
                        }
                        return (
                          <div
                            key={index}
                            className="text-[15px] leading-relaxed"
                          >
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                strong: ({ node, ...props }) => (
                                  <span
                                    className="font-bold"
                                    style={{ color: BRAND_COLOR }}
                                    {...props}
                                  />
                                ),
                                ul: ({ node, ...props }) => (
                                  <ul
                                    className="list-disc pl-5 my-2 space-y-1"
                                    {...props}
                                  />
                                ),
                                ol: ({ node, ...props }) => (
                                  <ol
                                    className="list-decimal pl-5 my-2 space-y-1"
                                    {...props}
                                  />
                                ),
                                li: ({ node, ...props }) => (
                                  <li className="pl-1" {...props} />
                                ),
                                p: ({ node, ...props }) => (
                                  <p className="mb-2 last:mb-0" {...props} />
                                ),
                              }}
                            >
                              {part.text}
                            </ReactMarkdown>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-end gap-2">
                    <div
                      className="h-6 w-6 rounded-full flex items-center justify-center mb-1"
                      style={GRADIENT_STYLE}
                    >
                      <Sparkles className="h-3 w-3 text-white" />
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-bl-none px-4 py-3 border border-gray-100 dark:border-gray-700 shadow-sm">
                      <div className="flex gap-1.5">
                        <div className="h-2 w-2 bg-gray-300 rounded-full animate-bounce" />
                        <div className="h-2 w-2 bg-gray-300 rounded-full animate-bounce delay-75" />
                        <div className="h-2 w-2 bg-gray-300 rounded-full animate-bounce delay-150" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Suggestions */}
          {messages.length > 0 &&
            followUpSuggestions.length > 0 &&
            !isLoading && (
              <div className="px-4 py-2 bg-gray-50 dark:bg-[#0f1419] border-t border-gray-100 dark:border-gray-800 flex overflow-x-auto gap-2 no-scrollbar">
                {followUpSuggestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSuggestionClick(q)}
                    disabled={!isOnline || isLoading}
                    className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 transition font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            autoComplete="off"
            className="p-4 bg-white dark:bg-[#0a0f1e] border-t border-gray-200 dark:border-gray-800"
          >
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Input
                  name="chat-message"
                  placeholder={
                    isOnline ? "Type a message..." : "Assistant is offline"
                  }
                  disabled={isLoading || !isOnline}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="w-full bg-gray-100/50 dark:bg-[#161b22] border-0 focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-white placeholder:text-gray-400 rounded-full px-4 h-11"
                />
              </div>

              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={!speechSupported || isLoading || !isOnline}
                onClick={toggleRecording}
                className={`h-11 w-11 rounded-full transition-all ${
                  isRecording
                    ? "bg-red-50 text-red-500 hover:bg-red-100"
                    : "bg-gray-100/50 text-gray-500 hover:bg-gray-100"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isRecording ? (
                  <MicOff className="h-5 w-5 animate-pulse" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>

              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !isOnline}
                style={GRADIENT_STYLE}
                className="text-white h-11 w-11 rounded-full shadow-lg transition-all hover:scale-105 hover:brightness-110 border-0 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4 rotate-45 mr-1" />
              </Button>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}
