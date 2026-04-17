import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiService } from "@/lib/api";
import type { ChatMessage } from "@/types/resume";
import { Spinner } from "./PracticeCards";

const STARTERS: string[] = [
  "Give me a crisp 60-second version of my elevator pitch.",
  "Drill me with 3 behavioral questions, then grade my answers.",
  "What's the most likely tough question I'll get? Walk me through a defence.",
  "Pretend you're the hiring manager — ask me a tough question and let me answer.",
  "Suggest 5 questions I should ask the interviewer.",
  "Where are my biggest gaps vs this JD, and how do I close them verbally?",
];

export default function CoachChat({
  recordId,
  externalPrompt,
  onClearExternal,
}: {
  recordId: string;
  externalPrompt?: string | null;
  onClearExternal?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Load history
  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await apiService.getCoachChat(recordId);
      if (r.data) setMessages(r.data.messages || []);
      setLoading(false);
    })();
  }, [recordId]);

  // If a card injected an external prompt, drop it into the input
  useEffect(() => {
    if (externalPrompt) {
      setInput(externalPrompt);
      onClearExternal?.();
      setTimeout(() => scrollerRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }), 50);
    }
  }, [externalPrompt, onClearExternal]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
  }, [messages, sending]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput("");
    // Optimistic user message
    const optimistic: ChatMessage = { role: "user", content: msg, at: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    setSending(true);
    const r = await apiService.chatWithCoach(recordId, msg);
    setSending(false);
    if (r.error) {
      toast.error("Coach is offline", { description: r.error });
      // Roll back the optimistic message so the user can retry
      setMessages(prev => prev.filter(m => m !== optimistic));
      return;
    }
    if (r.data?.messages) setMessages(r.data.messages);
  };

  const reset = async () => {
    if (!window.confirm("Clear conversation history? This cannot be undone.")) return;
    await apiService.resetCoachChat(recordId);
    setMessages([]);
    toast.success("Chat reset");
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800/60 bg-white/60 dark:bg-gray-900/40 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 text-white flex items-center justify-center text-base shadow-sm">🧑‍🏫</div>
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">AI Interview Coach</p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">Grounded in this JD + your resume · remembers the full conversation</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={reset} className="text-xs px-2.5 py-1 rounded text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-500/10">
            Reset
          </button>
        )}
      </div>

      {/* Scroller */}
      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
        {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading history…</p>}
        {!loading && messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Ask anything grounded in your resume and this JD. Your coach remembers the conversation.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STARTERS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  className="text-left px-3 py-2.5 rounded-lg text-[13px] bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800/60 hover:border-purple-500/40 hover:bg-purple-500/5 text-gray-700 dark:text-gray-300 leading-snug"
                >
                  <span className="text-purple-500 mr-1.5">✨</span>{s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="shrink-0 w-8 h-8 rounded-md bg-gradient-to-br from-purple-500 to-indigo-500 text-white text-xs flex items-center justify-center">🧑‍🏫</div>
            )}
            <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-purple-600 text-white rounded-br-sm"
                : "bg-gray-100 dark:bg-gray-800/70 text-gray-800 dark:text-gray-200 rounded-bl-sm border border-gray-200 dark:border-gray-800/60"
            }`}>
              {m.content}
            </div>
            {m.role === "user" && (
              <div className="shrink-0 w-8 h-8 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[11px] flex items-center justify-center font-semibold">You</div>
            )}
          </div>
        ))}
        {sending && (
          <div className="flex gap-2 items-center">
            <div className="shrink-0 w-8 h-8 rounded-md bg-gradient-to-br from-purple-500 to-indigo-500 text-white text-xs flex items-center justify-center">🧑‍🏫</div>
            <div className="rounded-xl bg-gray-100 dark:bg-gray-800/70 px-3.5 py-2.5 text-[13px] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800/60 inline-flex items-center gap-1.5">
              <Spinner className="w-3.5 h-3.5" /> thinking…
            </div>
          </div>
        )}
      </div>

      {/* Composer — sticky at the bottom of the chat panel */}
      <div className="shrink-0 border-t border-gray-200 dark:border-gray-800/60 px-3 py-3 bg-white dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            rows={Math.min(5, Math.max(2, input.split("\n").length))}
            placeholder="Ask your coach anything… (Enter to send, Shift+Enter for newline)"
            className="flex-1 resize-none text-sm leading-relaxed px-3.5 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/60 focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-gray-800 dark:text-gray-200 placeholder-gray-400"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || sending}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 shadow-sm shadow-purple-500/25"
          >
            {sending ? <Spinner /> : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            )}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
