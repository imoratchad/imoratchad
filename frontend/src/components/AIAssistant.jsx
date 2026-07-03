import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { Link } from "react-router-dom";

const AIAssistant = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([{ role: "assistant", content: t("ai.greeting") }]);
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const { data } = await api.post("/ai/chat", { message: text, session_id: sessionId });
      setSessionId(data.session_id);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "Erreur, réessayez plus tard." }]);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = (content) => {
    // Detect [property_id] tags and convert to links
    const parts = content.split(/(\[[a-f0-9-]{8,}\])/g);
    return parts.map((p, i) => {
      const m = p.match(/^\[([a-f0-9-]{8,})\]$/);
      if (m) return <Link key={i} to={`/property/${m[1]}`} className="text-[#00B4FF] underline font-bold">[voir]</Link>;
      return <span key={i}>{p}</span>;
    });
  };

  return (
    <>
      <button
        data-testid="ai-assistant-fab"
        onClick={() => setOpen(true)}
        className="hidden md:flex fixed bottom-6 left-6 z-30 bg-[#00B4FF] hover:bg-[#0099D9] text-white rounded-full shadow-lg p-4 items-center gap-2 font-bold transition active:scale-95"
        aria-label="Open IMORA Assistant"
      >
        <Sparkles className="h-5 w-5" />
        <span className="hidden sm:inline text-sm">{t("ai.title")}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-6 bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col h-[80vh] md:h-[600px]" onClick={(e) => e.stopPropagation()} data-testid="ai-assistant-modal">
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 bg-[#0A0A0A] text-white md:rounded-t-2xl rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="bg-[#00B4FF] rounded-full p-2"><Sparkles className="h-4 w-4" /></div>
                <div>
                  <div className="font-heading font-bold">{t("ai.title")}</div>
                  <div className="text-xs text-white/60">{t("ai.subtitle")}</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} data-testid="ai-close-btn" className="p-2 hover:bg-white/10 rounded-lg"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.role === "user" ? "bg-[#FF6B1A] text-white" : "bg-neutral-100 text-neutral-900"}`}>
                    {renderContent(m.content)}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-neutral-100 text-neutral-500 rounded-2xl px-4 py-2 text-sm italic">{t("ai.thinking")}</div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            <div className="border-t border-neutral-200 p-3 flex gap-2">
              <input
                data-testid="ai-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={t("ai.placeholder")}
                className="imora-input flex-1"
              />
              <button onClick={send} data-testid="ai-send-btn" disabled={loading} className="imora-btn-primary !px-4 !w-12 !h-12 disabled:opacity-50">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
