"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, Sparkles } from "lucide-react";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
  isNew?: boolean;
}

const Typewriter = ({
  text,
  delay = 12,
  onComplete,
}: {
  text: string;
  delay?: number;
  onComplete?: () => void;
}) => {
  const [currentText, setCurrentText] = React.useState("");

  React.useEffect(() => {
    setCurrentText("");
    let index = 0;
    const interval = setInterval(() => {
      setCurrentText((prev) => prev + text.charAt(index));
      index++;
      if (index >= text.length) {
        clearInterval(interval);
        onComplete?.();
      }
    }, delay);
    return () => clearInterval(interval);
  }, [text, delay, onComplete]);

  return <span>{currentText}</span>;
};

export function RobotGuide() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "🤖 Beep boop! I'm Aria, your AI guide for SaaS Blog. I can help you navigate this platform. What would you like to know, human?",
      isNew: true,
    },
  ]);
  const [inputVal, setInputVal] = React.useState("");
  const [isTyping, setIsTyping] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Scroll to bottom on new message or during typewriter updates
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleMessageComplete = (id: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, isNew: false } : msg))
    );
  };

  const getBotResponse = (input: string): string => {
    const query = input.toLowerCase().trim();
    if (query.includes("what is") || query.includes("platform") || query.includes("about")) {
      return "🤖 SaaS Blog is a premium minimalist space for high-fidelity writing. You can compose articles with a custom Tiptap editor, create vector Sketch Blocks using Excalidraw, and read trending posts in a clean layout. ⚡";
    }
    if (query.includes("sign up") || query.includes("register") || query.includes("join")) {
      return "⚡ Signing up is easy! Just click 'Join Publication' at the top or hero section, enter your email and password, verify, and start creating right away! 📡";
    }
    if (query.includes("write") || query.includes("post") || query.includes("create") || query.includes("publish") || query.includes("editor")) {
      return "✍️ To write a post: 1. Sign in to your account. 2. Navigate to the Studio (/write) workspace. 3. Use our distraction-free Tiptap editor to construct beautiful prose, insert Excalidraw canvas, and publish!";
    }
    if (query.includes("sketch") || query.includes("excalidraw") || query.includes("drawing") || query.includes("canvas")) {
      return "🎨 Sketch Blocks are editable Excalidraw canvases nested inside your posts! They load on-demand, cache your edits automatically, and render fully responsive SVG previews for your readers. Try clicking one in a post! ⚡";
    }
    if (query.includes("explore") || query.includes("feed") || query.includes("latest") || query.includes("trending")) {
      return "📡 Click the 'Explore Feed' button on the homepage or navigate to /explore to view the latest, trending, and tag-filtered posts from the community.";
    }
    return "Beep boop! 🤖 I did not recognize that query in my databanks. Try using one of the quick options or ask about: 'how to write', 'sign up', 'sketch blocks', or 'explore'.";
  };

  const handleSend = (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      sender: "user",
      text,
      isNew: false,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputVal("");
    setIsTyping(true);

    // Simulate thinking delay
    setTimeout(() => {
      setIsTyping(false);
      const botResponseText = getBotResponse(text);
      const botMessage: Message = {
        id: Math.random().toString(36).substring(7),
        sender: "bot",
        text: botResponseText,
        isNew: true,
      };
      setMessages((prev) => [...prev, botMessage]);
    }, 800);
  };

  const quickActions = [
    "What is this platform?",
    "How do I sign up?",
    "How do I write a post?",
    "What are Sketch Blocks?",
    "How to explore posts?",
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="absolute bottom-20 right-0 w-[calc(100vw-32px)] sm:w-[400px] h-[550px] max-h-[calc(100vh-120px)] rounded-24 border border-border bg-surface/75 dark:bg-surface/70 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-surface/40">
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent border border-accent/20">
                  <Bot className="w-5 h-5 animate-pulse" />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-surface animate-ping" />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-surface" />
                </div>
                <div className="flex flex-col">
                  <span className="text-15 font-semibold text-text flex items-center gap-1.5">
                    Aria
                    <Sparkles className="w-3.5 h-3.5 text-accent animate-pulse" />
                  </span>
                  <span className="text-11 text-muted">Robot Guide Agent</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-border/30 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-20 px-4 py-2.5 text-13 leading-relaxed shadow-sm ${
                      msg.sender === "user"
                        ? "bg-accent text-white"
                        : "bg-raised border border-border text-text"
                    }`}
                  >
                    {msg.sender === "bot" && msg.isNew ? (
                      <Typewriter
                        text={msg.text}
                        onComplete={() => handleMessageComplete(msg.id)}
                      />
                    ) : (
                      <span>{msg.text}</span>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-20 px-4 py-3 bg-raised border border-border text-text flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            <div className="px-4 py-2 flex flex-wrap gap-2 max-h-[120px] overflow-y-auto border-t border-border/40 bg-surface/20">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(action)}
                  className="text-11 px-3 py-1.5 rounded-full border border-border bg-surface/50 text-muted hover:text-text hover:border-accent/40 hover:bg-surface transition-all select-none cursor-pointer"
                >
                  {action}
                </button>
              ))}
            </div>

            {/* Input form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(inputVal);
              }}
              className="p-3 border-t border-border flex items-center gap-2 bg-surface/50"
            >
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Ask me something, human..."
                className="flex-1 h-[38px] px-3 rounded-12 bg-raised border border-border text-13 text-text placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              />
              <button
                type="submit"
                disabled={!inputVal.trim()}
                className="w-[38px] h-[38px] rounded-12 bg-accent text-white flex items-center justify-center hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating launcher button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="relative"
          >
            {/* Pulsing ring */}
            <span className="absolute -inset-1 rounded-full bg-accent/25 animate-ping opacity-75" />
            <span className="absolute -inset-2 rounded-full bg-accent/10 animate-pulse opacity-50" />

            <motion.button
              type="button"
              onClick={() => setIsOpen(true)}
              animate={{ y: [0, -6, 0] }}
              transition={{
                repeat: Infinity,
                duration: 3,
                ease: "easeInOut",
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center shadow-[0_8px_24px_rgba(10,132,255,0.35)] cursor-pointer select-none border border-white/10"
            >
              <Bot className="w-7 h-7" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
