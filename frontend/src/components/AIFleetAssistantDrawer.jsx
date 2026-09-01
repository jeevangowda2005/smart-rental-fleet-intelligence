import React, { useState, useRef, useEffect } from 'react';
import { X, Bot, Send, Loader2, ChevronRight, Sparkles } from 'lucide-react';
import { aiService } from '../services/aiService';

const QUICK_PROMPTS = [
  'Which machines are under-utilized?',
  'What equipment is needed next week?',
  'Are there any anomalies flagged?',
  'Give me a fleet summary.',
  'Which machine should I move to Site S003?',
];

const IntentBadge = ({ intent }) => {
  const colors = {
    under_utilized: 'bg-amber-500/20 text-amber-300',
    anomalies: 'bg-rose-500/20 text-rose-300',
    demand: 'bg-blue-500/20 text-blue-300',
    recommend: 'bg-emerald-500/20 text-emerald-300',
    fleet_summary: 'bg-slate-500/20 text-slate-300',
    unknown: 'bg-slate-700/30 text-slate-400',
  };
  return (
    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${colors[intent] || colors.unknown}`}>
      {intent?.replace(/_/g, ' ').toUpperCase()}
    </span>
  );
};

export const AIFleetAssistantDrawer = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversation, setConversation] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation]);

  const sendQuery = async (q) => {
    const text = (q || query).trim();
    if (!text) return;

    setConversation(prev => [...prev, { role: 'user', content: text }]);
    setQuery('');
    setLoading(true);

    try {
      const result = await aiService.queryAssistant(text);
      setConversation(prev => [...prev, { role: 'assistant', content: result.answer, intent: result.intent, data: result.data, evidence: result.evidence, dataset_label: result.dataset_label }]);
    } catch (e) {
      setConversation(prev => [...prev, { role: 'assistant', content: 'Unable to retrieve fleet data at this time. Please ensure the backend is running.', intent: 'error' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col bg-slate-950 border-l border-industrial-border shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-industrial-border bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cat-500/10 border border-cat-500/30">
            <Bot className="w-5 h-5 text-cat-500" />
          </div>
          <div>
            <div className="font-bold text-white text-sm">AI Fleet Assistant</div>
            <div className="text-[10px] text-cat-400 font-mono">DATA-DRIVEN · EXPLAINABLE ANSWERS</div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Conversation Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {conversation.length === 0 && (
          <div className="space-y-4">
            <div className="text-center py-6">
              <Sparkles className="w-10 h-10 text-cat-500/50 mx-auto mb-3" />
              <p className="text-slate-300 text-sm font-semibold">AI Fleet Assistant</p>
              <p className="text-slate-500 text-xs mt-1">Answers based on live fleet data and AI model outputs.</p>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quick Queries:</div>
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendQuery(p)}
                  className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition text-xs text-slate-300"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-cat-500 shrink-0" />
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {conversation.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'user' ? (
              <div className="bg-cat-500/20 border border-cat-500/30 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%]">
                <p className="text-sm text-white">{msg.content}</p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[95%] space-y-2">
                <div className="flex items-center gap-2">
                  <Bot className="w-3.5 h-3.5 text-cat-500 shrink-0" />
                  {msg.intent && <IntentBadge intent={msg.intent} />}
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">{msg.content}</p>

                {/* Structured Evidence */}
                {msg.evidence && (
                  <div className="mt-2 p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1.5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SUPPORTING EVIDENCE</div>
                    {Object.entries(msg.evidence).filter(([k]) => k !== 'reasons').map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs font-mono">
                        <span className="text-slate-500">{k.replace(/_/g, ' ')}:</span>
                        <span className="text-slate-200 font-semibold">{String(v)}</span>
                      </div>
                    ))}
                    {msg.evidence.reasons && (
                      <div className="pt-1 border-t border-slate-700 space-y-0.5">
                        {msg.evidence.reasons.map((r, i) => (
                          <div key={i} className="flex items-start gap-1 text-[11px] text-slate-400">
                            <ChevronRight className="w-3 h-3 text-cat-500 shrink-0 mt-0.5" />
                            {r}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {msg.dataset_label && (
                  <p className="text-[10px] text-slate-600 font-mono">{msg.dataset_label}</p>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-cat-500 animate-spin" />
              <span className="text-sm text-slate-400">Analyzing fleet data...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-industrial-border bg-slate-900">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && sendQuery()}
            placeholder="Ask about fleet status, anomalies, demand..."
            className="flex-1 bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-4 py-2.5 placeholder-slate-500 focus:outline-none focus:border-cat-500 transition"
          />
          <button
            onClick={() => sendQuery()}
            disabled={loading || !query.trim()}
            className="p-2.5 rounded-xl bg-cat-500 hover:bg-cat-600 text-black transition disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
