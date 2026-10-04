import { useState, useRef, useEffect } from 'react';

export default function QAChatbot({ sessionId, onAsk }) {
  const [messages, setMessages] = useState([
    { role: 'bot', text: '안녕하세요! 전임자 자료를 기반으로 질문에 답변합니다. 궁금한 점을 물어보세요.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setLoading(true);

    try {
      const result = await onAsk(question);
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: result.answer,
          sources: result.sources,
          confidence: result.confidence,
          related: result.related_category,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: '오류가 발생했습니다. 다시 시도해주세요.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const CONFIDENCE_LABEL = {
    high: { text: '확신', color: '#059669' },
    medium: { text: '보통', color: '#d97706' },
    low: { text: '불확실', color: '#dc2626' },
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: 500,
      background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden',
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '12px 16px', background: '#1e3a5f', color: 'white',
        fontSize: 15, fontWeight: 600,
      }}>
        💬 전임자 Q&A 챗봇
      </div>

      {/* 메시지 영역 */}
      <div style={{
        flex: 1, overflow: 'auto', padding: 16,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '80%', padding: '10px 14px', borderRadius: 12,
              background: msg.role === 'user' ? '#2563eb' : '#f3f4f6',
              color: msg.role === 'user' ? 'white' : '#1f2937',
              fontSize: 14, lineHeight: 1.5,
            }}>
              <div>{msg.text}</div>

              {/* 출처 */}
              {msg.sources?.length > 0 && (
                <div style={{
                  marginTop: 8, paddingTop: 8,
                  borderTop: '1px solid rgba(0,0,0,0.1)', fontSize: 12,
                  color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : '#6b7280',
                }}>
                  📎 출처: {msg.sources.join(', ')}
                </div>
              )}

              {/* 신뢰도 */}
              {msg.confidence && (
                <div style={{ marginTop: 4, fontSize: 11 }}>
                  <span style={{
                    padding: '1px 6px', borderRadius: 8,
                    background: 'rgba(0,0,0,0.05)',
                    color: CONFIDENCE_LABEL[msg.confidence]?.color || '#6b7280',
                  }}>
                    신뢰도: {CONFIDENCE_LABEL[msg.confidence]?.text || msg.confidence}
                  </span>
                  {msg.related && (
                    <span style={{ marginLeft: 6, color: '#6b7280' }}>
                      관련: {msg.related}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '10px 14px', borderRadius: 12,
              background: '#f3f4f6', color: '#9ca3af', fontSize: 14,
            }}>
              ⏳ 문서를 검색하고 있습니다...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* 입력 영역 */}
      <div style={{
        padding: 12, borderTop: '1px solid #e5e7eb',
        display: 'flex', gap: 8,
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="질문을 입력하세요... (예: 예산 담당자가 누구야?)"
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 8,
            border: '1px solid #d1d5db', fontSize: 14, fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 18px', background: loading ? '#9ca3af' : '#2563eb',
            color: 'white', border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          전송
        </button>
      </div>
    </div>
  );
}
