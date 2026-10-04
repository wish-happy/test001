import { useState } from 'react';

const PRIORITY_STYLE = {
  high: { bg: '#fef2f2', border: '#fca5a5', label: '필수', color: '#991b1b' },
  medium: { bg: '#fefce8', border: '#fde68a', label: '중요', color: '#854d0e' },
  low: { bg: '#f0fdf4', border: '#86efac', label: '참고', color: '#166534' },
};

const RISK_STYLE = {
  High: { bg: '#dc2626', text: 'white' },
  Medium: { bg: '#f59e0b', text: 'white' },
  Low: { bg: '#10b981', text: 'white' },
};

export default function Interview({ data, onSubmitAnswers, loading }) {
  const [answers, setAnswers] = useState({});

  if (!data) return null;

  const { reports, total_questions } = data;
  const answeredCount = Object.values(answers).filter((v) => v.trim()).length;

  const handleAnswer = (qid, value) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  };

  const handleSubmit = () => {
    onSubmitAnswers(answers);
  };

  return (
    <div>
      {/* 상단 요약 */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 12, marginBottom: 24,
      }}>
        {reports.map((r) => (
          <div key={r.category_id} style={{
            padding: 14, background: 'white', borderRadius: 12,
            border: '1px solid #e5e7eb', textAlign: 'center',
          }}>
            <div style={{ fontSize: 28 }}>{r.coverage}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{r.category_name}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>커버리지 {r.score}점</div>
            {r.risk_level && (
              <span style={{
                padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                background: (RISK_STYLE[r.risk_level] || RISK_STYLE.Medium).bg,
                color: (RISK_STYLE[r.risk_level] || RISK_STYLE.Medium).text,
              }}>
                위험도: {r.risk_level}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 안내 */}
      <div style={{
        padding: 16, background: '#eff6ff', borderRadius: 12,
        border: '1px solid #bfdbfe', marginBottom: 20, fontSize: 14, color: '#1e40af',
      }}>
        💡 아래는 문서에서 확인되지 않은 사항입니다. 전임자가 답변하면 인수인계서에 반영됩니다.
        <br />답변하지 않아도 인수인계서 생성은 가능합니다.
      </div>

      {/* 업무별 질문 */}
      {reports.map((report) => (
        <div key={report.category_id} style={{
          marginBottom: 20, padding: 20, background: 'white',
          borderRadius: 12, border: '1px solid #e5e7eb',
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>
            {report.coverage} {report.category_name}
          </h3>

          {/* 리스크 사유 */}
          {report.risk_reason && (
            <div style={{ fontSize: 13, padding: '6px 10px', borderRadius: 6, marginBottom: 8,
              background: report.risk_level === 'High' ? '#fef2f2' : '#fefce8',
              color: report.risk_level === 'High' ? '#991b1b' : '#854d0e' }}>
              ⚠️ {report.risk_reason}
            </div>
          )}

          {/* D-day 체크리스트 */}
          {report.dday_checklist && Object.keys(report.dday_checklist).length > 0 && (
            <div style={{ marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 8,
              border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>
                📋 인수인계 D-day 체크리스트
              </div>
              {Object.entries(report.dday_checklist).map(([day, items]) => (
                <div key={day} style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb',
                    padding: '1px 6px', background: '#dbeafe', borderRadius: 4 }}>{day}</span>
                  {(items || []).map((item, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#475569', paddingLeft: 8, marginTop: 2 }}>
                      ☐ {item}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* 확인된 항목 */}
          {report.found?.length > 0 && (
            <div style={{ fontSize: 13, color: '#059669', marginBottom: 8 }}>
              ✅ {report.found.join(' · ')}
            </div>
          )}
          {/* 부족한 항목 */}
          {report.missing?.length > 0 && (
            <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 14 }}>
              ❌ {report.missing.join(' · ')}
            </div>
          )}

          {/* 질문 목록 */}
          {report.questions.map((q) => {
            const ps = PRIORITY_STYLE[q.priority] || PRIORITY_STYLE.medium;
            return (
              <div key={q.id} style={{
                padding: 14, marginBottom: 10, borderRadius: 8,
                background: ps.bg, border: `1px solid ${ps.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 12, fontSize: 11,
                    fontWeight: 600, color: ps.color, background: 'white',
                  }}>
                    {ps.label}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#1f2937' }}>
                    {q.question}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                  💬 {q.why}
                </div>
                <textarea
                  value={answers[q.id] || ''}
                  onChange={(e) => handleAnswer(q.id, e.target.value)}
                  placeholder="전임자 답변을 입력하세요..."
                  rows={2}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 6,
                    border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            );
          })}
        </div>
      ))}

      {/* 제출 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, color: '#6b7280' }}>
          {answeredCount}/{total_questions}개 답변 완료
        </span>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            padding: '12px 28px', background: loading ? '#9ca3af' : '#2563eb',
            color: 'white', border: 'none', borderRadius: 8,
            fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '처리 중...' : '✅ 답변 제출 후 인수인계서 생성'}
        </button>
      </div>
    </div>
  );
}
