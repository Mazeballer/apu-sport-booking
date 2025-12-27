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
  "What facilities are available to book?",
  "How to install PWA on my device?",
  "How do I cancel a booking?",
  "List Facilities",
];

type Suggestion = { label: string; text: string };

function extractTextFromMessage(msg: any): string {
  if (!msg) return "";
  return (msg.parts ?? [])
    .filter((p: any) => p.type === "text")
    .map((p: any) => String(p.text ?? ""))
    .join("\n");
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

// Finds times like 18:00, 7pm, 7 pm, 10:30am (we will normalize to what your backend accepts best)
function extractTimeLabels(text: string): string[] {
  const t = text.toLowerCase();

  // Prefer 24h times already shown by your system (HH:mm)
  const hhmm = t.match(/\b([01]\d|2[0-3]):[0-5]\d\b/g) ?? [];
  if (hhmm.length > 0) return uniq(hhmm.map((x) => x.toUpperCase()));

  // Fallback: am/pm, normalize to user-friendly, backend can parse "7pm" fine
  const ampm = t.match(/\b([1-9]|1[0-2])(?::[0-5]\d)?\s?(am|pm)\b/g) ?? [];
  return uniq(ampm.map((x) => x.replace(/\s+/g, "")));
}

function extractCourts(text: string): string[] {
  const matches = text.match(/\bCourt\s*\d+\b/gi) ?? [];
  return uniq(matches.map((m) => m.replace(/\s+/g, " ").trim()));
}

function extractEquipmentFromLine(text: string): string[] {
  // Only trust explicit "Equipment:" lines
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /^Equipment:\s*/i.test(l));

  if (!line) return [];
  const after = line.replace(/^Equipment:\s*/i, "").trim();
  if (!after || after.toLowerCase() === "none") return [];

  return uniq(
    after
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
  );
}

function extractFacilitiesList(text: string): string[] {
  // Your facility list is usually lines under "Active facilities..." or similar
  // This grabs standalone lines that look like names (not bullet prompts).
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Heuristic: take lines that are not instructions and not containing ":" and not too long
  const candidates = lines.filter((l) => {
    const lower = l.toLowerCase();
    if (lower.startsWith("active facilities")) return false;
    if (lower.startsWith("please")) return false;
    if (lower.startsWith("example")) return false;
    if (lower.startsWith('- "')) return false;
    if (lower.startsWith("- ")) return false;
    if (l.includes(":")) return false;
    if (l.length > 40) return false;
    return true;
  });

  // Also remove duplicates like Tennis vs tennis
  const normalized = new Map<string, string>();
  for (const c of candidates) {
    normalized.set(c.toLowerCase(), c);
  }
  return Array.from(normalized.values());
}

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

  const followUpSuggestions: Suggestion[] = (() => {
    const userTextRaw = extractTextFromMessage(lastUserMessage);
    const assistantTextRaw = extractTextFromMessage(lastAssistantMessage);
    const userText = userTextRaw.toLowerCase();
    const assistantText = assistantTextRaw.toLowerCase();

    const suggestions: Suggestion[] = [];

    const push = (label: string, text: string) => {
      // avoid duplicates by label+text
      const key = `${label}|||${text}`.toLowerCase();
      const exists = suggestions.some(
        (s) => `${s.label}|||${s.text}`.toLowerCase() === key
      );
      if (!exists) suggestions.push({ label, text });
    };

    // If assistant is asking for date only
    if (
      assistantText.includes("provide the booking date") ||
      assistantText.includes("ask for the date only") ||
      assistantText.includes("booking date (today, tomorrow") ||
      assistantText.includes("date only")
    ) {
      push("Today", "today");
      push("Tomorrow", "tomorrow");
    }

    // If assistant printed facilities list, let user tap a facility name
    if (assistantText.includes("active facilities")) {
      const facilityNames = extractFacilitiesList(assistantTextRaw);
      for (const name of facilityNames.slice(0, 6)) {
        push(name, name);
      }
      push("Check availability", "check availability");
    }

    // If assistant showed availability, extract times and courts
    if (
      assistantText.includes("availability") ||
      assistantText.includes("available start times")
    ) {
      const times = extractTimeLabels(assistantTextRaw);
      const courts = extractCourts(assistantTextRaw);

      // If multiple courts exist, let user pick court first
      if (courts.length > 1) {
        for (const c of courts.slice(0, 4)) push(c, c);
      }

      // Always show a few time chips
      for (const t of times.slice(0, 6)) {
        push(t, t); // sending "19:00" works great with your flow
      }

      push("Today", "today");
      push("Tomorrow", "tomorrow");
    }

    // If assistant asks about duration
    if (
      assistantText.includes("duration") ||
      assistantText.includes("how long")
    ) {
      push("1 hour", "1 hour");
      push("2 hours", "2 hours");
    }

    // If assistant mentions equipment, create meaningful options
    if (assistantText.includes("equipment")) {
      const eq = extractEquipmentFromLine(assistantTextRaw);

      push("No equipment", "no equipment");

      // Only show equipment chips if system listed them explicitly
      for (const name of eq.slice(0, 4)) {
        push(name, name);
      }
    }

    // If assistant is at confirmation step
    if (
      assistantText.includes("type **confirm**") ||
      assistantText.includes("type confirm") ||
      assistantText.includes("next action") ||
      assistantText.includes("confirm to create")
    ) {
      push("Confirm booking", "confirm");
      push("Cancel", "cancel");
    }

    // If nothing matched, show useful defaults
    if (suggestions.length === 0) {
      push("List facilities", "list facilities");
      push("Check availability", "check availability");
      push("Rules", "rules");
    }

    return suggestions.slice(0, 8);
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
                {followUpSuggestions.map((s) => (
                  <button
                    key={`${s.label}|||${s.text}`}
                    onClick={() => handleSuggestionClick(s.text)}
                    disabled={!isOnline || isLoading}
                    className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 transition font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    title={s.text}
                  >
                    {s.label}
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
                    ? "bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                    : "bg-gray-100/50 text-gray-500 hover:bg-gray-100 dark:bg-[#161b22] dark:text-gray-400 dark:hover:bg-gray-800"
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
