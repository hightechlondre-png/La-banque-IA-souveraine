import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import {
  Send, Loader2, Brain, Trash2, Copy, User,
  Zap, Shield, Coins, BarChart2, Lock
} from "lucide-react";

const SUGGESTIONS = [
  { icon: Coins,   text: "Explique la tokenomics AQ et la politique monétaire AEGIS-Q" },
  { icon: Lock,    text: "Comment fonctionne le staking Gold avec multiplicateur ×2 ?" },
  { icon: Shield,  text: "Quelles sont les principales vulnérabilités des smart contracts ?" },
  { icon: BarChart2, text: "Analyse les risques du bridge cross-chain Ethereum/Solana" },
  { icon: Zap,     text: "Explique le mécanisme de propagation fractale N-MEM-B" },
];

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3 group", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
          <Brain className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className={cn("max-w-[80%]", isUser && "flex flex-col items-end")}>
        <div className={cn(
          "rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card border border-border text-foreground"
        )}>
          {isUser ? (
            <p>{msg.content}</p>
          ) : (
            <ReactMarkdown
              className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              components={{
                code: ({ inline, children }) => inline
                  ? <code className="bg-secondary px-1.5 py-0.5 rounded text-xs font-mono text-primary">{children}</code>
                  : <pre className="bg-secondary rounded-lg p-3 overflow-x-auto my-2"><code className="text-xs font-mono">{children}</code></pre>,
                p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="my-1 ml-4 list-disc space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="my-1 ml-4 list-decimal space-y-0.5">{children}</ol>,
                strong: ({ children }) => <strong className="text-primary font-semibold">{children}</strong>,
              }}
            >
              {msg.content}
            </ReactMarkdown>
          )}
        </div>
        {!isUser && (
          <button
            onClick={() => navigator.clipboard.writeText(msg.content)}
            className="mt-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {isUser && (
        <div className="h-8 w-8 rounded-xl bg-secondary border border-border flex items-center justify-center shrink-0 mt-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

export default function CognitiveChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text) => {
    const content = text ?? input.trim();
    if (!content || loading) return;
    setInput("");

    const newMessages = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setLoading(true);

    const res = await base44.functions.invoke("gemmaChat", {
      messages: newMessages.map(m => ({ role: m.role, content: m.content }))
    });

    setMessages(prev => [...prev, { role: "assistant", content: res.data.reply }]);
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clear = () => setMessages([]);

  return (
    <div className="flex flex-col h-[calc(100vh-112px)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">AEGIS-Q Cognitive AI</h2>
            <p className="text-xs text-muted-foreground">Propulsé par Gemma 3 · Hugging Face</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block mr-1.5" />
            Gemma 3 · 27B
          </Badge>
          {messages.length > 0 && (
            <button onClick={clear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-muted-foreground hover:text-red-400 hover:border-red-400/30 transition-all">
              <Trash2 className="h-3.5 w-3.5" />Effacer
            </button>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 min-h-0 bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
              <div className="h-20 w-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-float">
                <Brain className="h-10 w-10 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-foreground">AEGIS-Q Cognitive AI</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Intelligence artificielle souveraine · Expert DeFi, Blockchain & AEGIS-Q
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => send(s.text)}
                    className="flex items-center gap-3 px-4 py-3 bg-secondary/50 border border-border rounded-xl text-left text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all">
                    <s.icon className="h-4 w-4 text-primary shrink-0" />
                    <span>{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Analyse cognitive en cours…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-3">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Posez votre question sur AEGIS-Q, DeFi, blockchain, staking…"
              rows={1}
              style={{ resize: "none" }}
              className="flex-1 bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary min-h-[44px] max-h-32 leading-relaxed"
            />
            <Button onClick={() => send()} disabled={!input.trim() || loading} size="icon" className="h-11 w-11 rounded-xl shrink-0">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Entrée pour envoyer · Shift+Entrée pour nouvelle ligne
          </p>
        </div>
      </div>
    </div>
  );
}