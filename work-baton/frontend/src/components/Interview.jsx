import { useState } from 'react';
import { decodeFilename } from '../api/utils';

const RISK = {
  High: { bg: '#fef2f2', border: '#fecaca', badge: '#ef4444', text: '#991b1b', label: '높음' },
  Medium: { bg: '#fffbeb', border: '#fde68a', badge: '#f59e0b', text: '#92400e', label: '보통' },
  Low: { bg: '#f0fdf4', border: '#bbf7d0', badge: '#10b981', text: '#166534', label: '낮음' },
};
const PRI = {
  high: { bg: '#fef2f2', border: '#fecaca', label: '필수', color: '#991b1b' },
  medium: { bg: '#fffbeb', border: '#fde68a', label: '중요', color: '#92400e' },
  low: { bg: '#f0fdf4', border: '#bbf7d0', label: '참고', color: '#166534' },
};

function Stepper({ checklist }) {
  const days = Object.entries(checklist || {});
  if (!days.length) return null;
  return (
    <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
      {days.map(([day, items], idx) => (
        <div key={day} style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            {idx > 0 && <div style={{ flex: 1, height: 2, background: '#e2e8f0' }} />}
            <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: '#4f46e5', color: 'white', flexShrink: 0 }}>{day}</div>
            {idx < days.length - 1 && <div style={{ flex: 1, height: 2, background: '#e2e8f0' }} />}
          </div>
          <div style={{ padding: '0 4px' }}>
            {items.map((item, i) => <div key={i} style={{ fontSize: 11, color: '#475569', padding: '1px 0', lineHeight: 1.4 }}>☐ {item}</div>)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Interview({ data, onSubmitAnswers, loading }) {
  const [answers, setAnswers] = useState({});
  const [activeId, setActiveId] = useState(null);
  if (!data) return null;
  const { reports, total_questions } = data;
  const sorted = [...reports].sort((a, b) => ({ High: 0, Medium: 1, Low: 2 }[a.risk_level] ?? 1) - ({ High: 0, Medium: 1, Low: 2 }[b.risk_level] ?? 1));
  const active = sorted.find(r => r.category_id === activeId) || sorted[0];
  const answeredCount = Object.values(answers).filter(v => v.trim()).length;
  const risk = RISK[active?.risk_level] || RISK.Medium;

  return (
    <div style={{ display: 'flex', gap: 16, minHeight: 500 }}>
      <div style={{ width: 260, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>인수인계 업무 ({sorted.length})</div>
        {sorted.map(r => {
          const rk = RISK[r.risk_level] || RISK.Medium;
          const isAct = r.category_id === active?.category_id;
          const barColor = r.score >= 70 ? '#10b981' : r.score >= 40 ? '#f59e0b' : '#ef4444';
          return (
            <div key={r.category_id} onClick={() => setActiveId(r.category_id)} style={{
              padding: '12px 14px', marginBottom: 6, borderRadius: 10, cursor: 'pointer',
              background: isAct ? '#f8fafc' : 'white', border: isAct ? '2px solid #4f46e5' : '1px solid #e2e8f0',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{decodeFilename(r.category_name)}</span>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, fontWeight: 600, background: rk.badge, color: 'white' }}>{rk.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: r.score + '%', background: barColor, borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 11, color: '#64748b', minWidth: 30 }}>{r.score}%</span>
              </div>
            </div>
          );
        })}
        <button onClick={() => onSubmitAnswers(answers)} disabled={loading} style={{
          width: '100%', padding: 12, marginTop: 12, borderRadius: 10,
          background: loading ? '#94a3b8' : '#4f46e5', color: 'white',
          border: 'none', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
        }}>{loading ? '처리 중...' : '인수인계서 생성 (' + answeredCount + '/' + total_questions + ')'}</button>
      </div>
      {active && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ padding: 20, borderRadius: 12, background: 'white', border: '1px solid ' + risk.border, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{decodeFilename(active.category_name)}</h3>
              <span style={{ padding: '4px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: risk.badge, color: 'white' }}>위험도 {risk.label}</span>
            </div>
            {active.risk_reason && (
              <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: risk.bg, borderLeft: '3px solid ' + risk.badge, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{active.risk_reason}</div>
            )}
            <Stepper checklist={active.dday_checklist} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 14, borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#166534', marginBottom: 8 }}>✅ 확인 완료</div>
                {(active.found || []).map((item, i) => <div key={i} style={{ fontSize: 12, padding: '4px 8px', marginBottom: 4, borderRadius: 6, background: '#dcfce7', color: '#166534', lineHeight: 1.4 }}>{item}</div>)}
              </div>
              <div style={{ padding: 14, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', marginBottom: 8 }}>⚠️ 확인 필요</div>
                {(active.missing || []).map((item, i) => <div key={i} style={{ fontSize: 12, padding: '4px 8px', marginBottom: 4, borderRadius: 6, background: '#fee2e2', color: '#991b1b', lineHeight: 1.4 }}>{item}</div>)}
              </div>
            </div>
          </div>
          {active.questions?.map(q => {
            const ps = PRI[q.priority] || PRI.medium;
            return (
              <div key={q.id} style={{ padding: 16, marginBottom: 10, borderRadius: 10, background: ps.bg, border: '1px solid ' + ps.border }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, color: ps.color, background: 'white', border: '1px solid ' + ps.border }}>{ps.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#1e293b' }}>{q.question}</span>
                </div>
                {q.why && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>💬 {q.why}</div>}
                <textarea value={answers[q.id] || ''} onChange={e => setAnswers(p => ({...p, [q.id]: e.target.value}))} placeholder="전임자 답변을 입력하세요..." rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
