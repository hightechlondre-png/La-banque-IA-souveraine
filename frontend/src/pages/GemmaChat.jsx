import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import {
  Send, Bot, User, Trash2, Loader2, Zap, Brain,
  Copy, ChevronDown, Hexagon
} from "lucide-react";

const SUGGESTIONS = [
  "Explique-moi le mécanisme de staking AEGIS-Q et les APY disponibles",
  "Quelles sont les principales vulnérabilités de reentrancy dans les smart contracts ?",
  "Analyse la politique monétaire déflationniste du token AQ",
  "Comment fonctionne la mémoire fractale N-MEM-B ?",
  "Quels sont les risques d'un bridge cross-chain Lock & Mint ?",
  "Explique le vote pondéré dans le DAO AEGIS-Q",
];

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn("flex gap-3 group", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <Hexagon className="h-4 w-4 text-primary" />
        </div>
      )}

      <div className={cn("max-w-[80%] space-y-1", isUser && "items-end flex flex-col")}>
        <div className={cn(
          "rounded-2xl px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card border border-border"
        )}>
          {isUser ? (
            <p className="text-sm leading-relaxed">{msg.content}</p>
          ) : (
            <ReactMarkdown
              className="text-sm prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              components={{
                code: ({ inline, children }) =>
                  inline
                    ? <code className="px-1 py-0.5 rounded bg-secondary text-accent text-xs font-mono">{children}</code>
                    : <pre className="bg-background rounded-lg p-3 overflow-x-auto my-2 text-xs font-mono text-foreground">{children}</pre>,
                p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="my-1 ml-4 list-disc space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="my-1 ml-4 list-decimal space-y-0.5">{children}</ol>,
                li: ({ children }) => <li className="text-foreground">{children}</li>,
                strong: ({ children }) => <strong className="text-accent font-semibold">{children}</strong>,
                h3: ({ children }) => <h3 className="text-sm font-bold text-foreground mt-3 mb-1">{children}</h3>,
              }}
            >
              {msg.content}
            </ReactMarkdown>
          )}
        </div>

        {!isUser && (
          <button onClick={copy}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-1">
            <Copy className="h-3 w-3" />
            {copied ? "Copié !" : "Copier"}
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

export default function GemmaChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");

    const userMsg = { role: "user", content };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);

    const res = await base44.functions.invoke("gemmaChat", {
      messages: history.map(m => ({ role: m.role, content: m.content })),
    });

    const aiMsg = { role: "assistant", content: res.data.content ?? "Erreur de réponse." };
    setMessages(prev => [...prev, aiMsg]);
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clear = () => { setMessages([]); setInput(""); };

  return (
    <div className="flex flex-col h-[calc(100vh-112px)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">AEGIS-AI · Gemma 4</h2>
            <p className="text-xs text-muted-foreground">Intelligence cognitive temps réel · google/gemma-3-27b-it</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block mr-1.5" />
            En ligne
          </Badge>
          {messages.length > 0 && (
            <button onClick={clear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-muted-foreground hover:text-red-400 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />Effacer
            </button>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto bg-card border border-border rounded-xl p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-6">
            <div className="h-20 w-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-float">
              <Brain className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">AEGIS-AI prête</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Intelligence cognitive alimentée par Gemma 4. Posez vos questions sur la DeFi, le protocole AEGIS-Q, les smart contracts ou la tokenomique.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="text-left px-3 py-2.5 rounded-xl bg-secondary/60 border border-border hover:border-primary/30 hover:bg-primary/5 text-xs text-muted-foreground hover:text-foreground transition-all">
                  {s}
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
            <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Hexagon className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">AEGIS-AI réfléchit…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 bg-card border border-border rounded-xl p-3 flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Posez votre question à AEGIS-AI… (Entrée pour envoyer)"
          rows={1}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed max-h-32 overflow-y-auto"
          style={{ minHeight: "24px" }}
          onInput={e => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
          }}
        />
        <Button onClick={() => send()} disabled={loading || !input.trim()} size="sm" className="shrink-0 gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Envoyer
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-2">
        Gemma 4 via Hugging Face · Shift+Entrée pour nouvelle ligne
      </p>
    </div>
  );
}