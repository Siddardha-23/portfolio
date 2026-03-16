import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Trash2, Sparkles, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatbot, type ChatMessage } from '@/hooks/useChatbot';

const QUICK_QUESTIONS = [
  { label: "Skills & Tech", query: "What are Harshith's skills?" },
  { label: "Experience", query: "Tell me about his experience" },
  { label: "Projects", query: "What projects has he built?" },
  { label: "Education", query: "Tell me about his education" },
];

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5 mb-4">
      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="bg-muted/60 rounded-2xl rounded-tl-md px-4 py-3">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TypewriterText({ text, onComplete }: { text: string; onComplete?: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed('');

    const timer = setInterval(() => {
      indexRef.current += 1;
      if (indexRef.current >= text.length) {
        setDisplayed(text);
        clearInterval(timer);
        onComplete?.();
      } else {
        setDisplayed(text.slice(0, indexRef.current));
      }
    }, 12);

    return () => clearInterval(timer);
  }, [text, onComplete]);

  return <span>{displayed}</span>;
}

function formatMarkdown(text: string) {
  // Simple markdown: **bold**, *italic*, `code`, - lists
  return text.split('\n').map((line, i) => {
    const formatted = line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-primary/10 text-primary text-xs">$1</code>');

    const isBullet = /^[\s]*[-•]/.test(line);
    return (
      <span key={i} className={isBullet ? 'block pl-2' : undefined}>
        <span dangerouslySetInnerHTML={{ __html: formatted }} />
        {i < text.split('\n').length - 1 && <br />}
      </span>
    );
  });
}

function MessageBubble({
  message,
  isLatestModel,
}: {
  message: ChatMessage;
  isLatestModel: boolean;
}) {
  const [typewriterDone, setTypewriterDone] = useState(!isLatestModel);
  const isUser = message.role === 'user';
  const handleComplete = useCallback(() => setTypewriterDone(true), []);

  if (isUser) {
    return (
      <div className="flex items-start gap-2.5 mb-4 justify-end">
        <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm">
          {message.content}
        </div>
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <User className="h-3.5 w-3.5 text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 mb-4">
      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="h-3.5 w-3.5 text-primary" />
      </div>
      <div
        className={`max-w-[80%] rounded-2xl rounded-tl-md px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
          message.isError
            ? 'bg-destructive/10 text-destructive border border-destructive/20'
            : 'bg-muted/60 text-foreground'
        }`}
      >
        {typewriterDone ? (
          <>{formatMarkdown(message.content)}</>
        ) : (
          <TypewriterText text={message.content} onComplete={handleComplete} />
        )}
      </div>
    </div>
  );
}

export default function Chatbot() {
  const { messages, isLoading, isOpen, setIsOpen, sendMessage, clearMessages } =
    useChatbot();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const showSuggestions = messages.length === 1 && messages[0].id === 'welcome';
  const latestModelId = [...messages].reverse().find((m) => m.role === 'model')?.id;

  // Offset trigger button when FloatingFormPrompt may be visible
  const formSubmitted =
    typeof window !== 'undefined' && localStorage.getItem('portfolio_form_submitted');
  const formDismissed =
    typeof window !== 'undefined' && sessionStorage.getItem('form_prompt_dismissed');
  const formPromptMayBeVisible = !formSubmitted && !formDismissed;

  return (
    <>
      {/* Floating trigger button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`fixed right-6 z-50 ${formPromptMayBeVisible ? 'bottom-24' : 'bottom-6'}`}
          >
            <div className="relative group">
              {/* Glow */}
              <div className="absolute -inset-1.5 bg-gradient-to-r from-primary via-primary/60 to-accent rounded-full blur-md opacity-40 group-hover:opacity-70 transition-opacity" />
              {/* Pulse ring */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary/40"
                animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              />
              <Button
                onClick={() => setIsOpen(true)}
                className="relative h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-2xl hover:shadow-primary/25 hover:scale-105 transition-transform"
                aria-label="Open chat"
              >
                <MessageCircle className="h-6 w-6" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed z-50 inset-3 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[400px] sm:h-[560px] flex flex-col bg-background/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl shadow-black/10 overflow-hidden"
          >
            {/* Header */}
            <div className="relative px-4 py-3.5 border-b border-border/60 bg-gradient-to-r from-primary/5 via-transparent to-accent/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md">
                      <Sparkles className="h-4.5 w-4.5 text-primary-foreground" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground leading-tight">
                      Portfolio Assistant
                    </h3>
                    <p className="text-[11px] text-muted-foreground">Ask anything about Harshith</p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearMessages}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    aria-label="Clear chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    aria-label="Close chat"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages - native scrollable div */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isLatestModel={msg.id === latestModelId}
                />
              ))}
              {isLoading && <TypingIndicator />}

              {/* Quick-question suggestions */}
              {showSuggestions && !isLoading && (
                <div className="mt-2 space-y-2">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider pl-10">
                    Quick questions
                  </p>
                  <div className="flex flex-wrap gap-2 pl-10">
                    {QUICK_QUESTIONS.map((q) => (
                      <button
                        key={q.label}
                        onClick={() => sendMessage(q.query)}
                        className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/40 text-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-colors"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-border/60 p-3 bg-muted/20">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about skills, projects, experience..."
                  maxLength={500}
                  disabled={isLoading}
                  className="flex-1 bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 disabled:opacity-50 transition-shadow"
                />
                <Button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  size="icon"
                  className="h-10 w-10 rounded-xl shrink-0 bg-primary hover:bg-primary/90 shadow-sm"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
