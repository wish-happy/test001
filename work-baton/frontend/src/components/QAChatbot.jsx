import { useState, useRef, useEffect } from 'react';
import { decodeFilename } from '../api/utils';

const CONF = {
  high: { label: '높음', color: '#166534', bg: '#dcfce7' },
  medium: { label: '보통', color: '#92400e', bg: '#fef3c7' },
  low: { label: '확인필요', color: '#64748b', bg: '#f1f5f9' },
};

export default function QAChatbot({ sessionId, onAsk }) {
  const [messages, setMessages] = useState([
    { role: 'bot', text: '안녕하세요! 전임자 자료를 기반으로 답변합니다.\n아래 추천 질문을 눌러보거나 직접 질문하세요.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const q = input.trim(); setInput('');
    setMessages(p => [...p, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const r = await onAsk(q);
      setMessages(p => [...p, { role: 'bot', text: r.answer || '', sources: r.sources || [], citations: r.citations || [], confidence: r.confidence, action_items: r.action_items || [] }]);
    } catch { setMessages(p => [...p, { role: 'bot', text: '오류가 발생했습니다.' }]); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 520, background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', background: '#1e293b', color: 'white', fontSize: 15, fontWeight: 600 }}>💬 전임자 Q&A 챗봇</div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '85%', padding: '12px 16px', borderRadius: 12, background: m.role === 'user' ? '#4f46e5' : '#f8fafc', color: m.role === 'user' ? 'white' : '#1e293b', border: m.role === 'user' ? 'none' : '1px solid #e2e8f0', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {m.text}
              {m.citations?.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                  {m.citations.map((c, j) => (
                    <div key={j} style={{ fontSize: 12, padding: '6px 10px', margin: '4px 0', background: '#fffbeb', borderLeft: '3px solid #f59e0b', borderRadius: '0 6px 6px 0', color: '#475569' }}>
                      <span style={{ fontStyle: 'italic' }}>"{c.text}"</span>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>📄 {decodeFilename(c.file || '')}</div>
                    </div>
                  ))}
                </div>
              )}
              {m.role === 'bot' && (m.sources?.length > 0 || m.confidence) && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {m.sources?.map((s, j) => <span key={j} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#eef2ff', color: '#3730a3', border: '1px solid #c7d2fe' }}>📄 {decodeFilename(s)}</span>)}
                  {m.confidence && (() => { const c = CONF[m.confidence] || CONF.low; return <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: c.bg, color: c.color }}>신뢰도: {c.label}</span>; })()}
                  {m.action_items?.length > 0 && (
                    <div style={{ marginTop: 8, padding: 10, background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>🎯 즉시 실행할 Action</div>
                      {m.action_items.map((a, k) => (
                        <div key={k} style={{ fontSize: 12, color: '#1e3a5f', padding: '3px 0', display: 'flex', gap: 6 }}>
                          <span>▸</span><span>{typeof a === 'string' ? a : a.action || a.task || JSON.stringify(a)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <div style={{ display: 'flex' }}><div style={{ padding: '10px 16px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 14, color: '#94a3b8' }}>문서를 검색하고 답변을 작성 중...</div></div>}
        <div ref={endRef} />
      </div>
      <div style={{ padding: 12, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="질문을 입력하세요 (예: 예산 담당자가 누구야?)" style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, fontFamily: 'inherit' }} />
        <button onClick={handleSend} disabled={loading || !input.trim()} style={{ padding: '10px 20px', background: loading ? '#94a3b8' : '#4f46e5', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>전송</button>
      </div>
    </div>
  );
}
