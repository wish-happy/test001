import { useState } from 'react';
import { decodeFilename } from '../api/utils';

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const NOW = new Date().getMonth() + 1;

export default function WorkCalendar({ data }) {
  if (!data) return null;
  const { monthly_view } = data;
  const { monthly, always_on } = monthly_view;
  const routineEvents = always_on || [];
  const currentMonthEvents = monthly[String(NOW)] || [];

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 600px', minWidth: 0 }}>
        <div style={{
          padding: 20, marginBottom: 20, borderRadius: 12,
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', color: 'white',
        }}>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>📌 이번 달 인계 타임라인</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{NOW}월 주요 업무</div>
          {currentMonthEvents.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {currentMonthEvents.map((evt, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', background: 'rgba(255,255,255,0.1)',
                  borderRadius: 8, borderLeft: '3px solid #818cf8',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#c7d2fe', minWidth: 50 }}>
                    {evt.day ? evt.day + '일' : '상시'}
                  </span>
                  <span style={{ fontSize: 14, flex: 1 }}>{decodeFilename(evt.title)}</span>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.15)', color: '#e0e7ff',
                  }}>{decodeFilename(evt.category_name)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 14, opacity: 0.6 }}>이번 달 예정된 순기 업무 없음</div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
          {MONTHS.map((name, i) => {
            const month = i + 1;
            const events = monthly[String(month)] || [];
            const isPast = month < NOW;
            const isCurrent = month === NOW;
            return (
              <div key={i} style={{
                padding: 12, borderRadius: 10, minHeight: 90,
                background: isCurrent ? '#ffffff' : '#ffffff',
                border: isCurrent ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                opacity: isPast ? 0.5 : 1,
                boxShadow: isCurrent ? '0 4px 12px rgba(79,70,229,0.15)' : 'none',
              }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, marginBottom: 6,
                  color: isCurrent ? '#4f46e5' : isPast ? '#94a3b8' : '#475569',
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span>{name}</span>
                  {events.length > 0 && (
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%', fontSize: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isCurrent ? '#4f46e5' : '#e2e8f0',
                      color: isCurrent ? 'white' : '#64748b', fontWeight: 700,
                    }}>{events.length}</span>
                  )}
                </div>
                {events.slice(0, 3).map((evt, j) => (
                  <div key={j} style={{
                    fontSize: 11, color: '#475569', padding: '2px 0',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{evt.day ? evt.day + '일 ' : ''}{decodeFilename(evt.title)}</div>
                ))}
                {events.length > 3 && <div style={{ fontSize: 10, color: '#94a3b8' }}>+{events.length - 3}건</div>}
                {events.length === 0 && <div style={{ fontSize: 11, color: '#cbd5e1', textAlign: 'center', paddingTop: 8 }}>—</div>}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ flex: '0 0 240px' }}>
        <div style={{ padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', position: 'sticky', top: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 12 }}>🔄 반복 루틴 업무</div>
          {routineEvents.length > 0 ? routineEvents.map((evt, i) => (
            <div key={i} style={{ padding: '8px 10px', marginBottom: 6, borderRadius: 8, background: 'white', border: '1px solid #e2e8f0', fontSize: 13 }}>
              <div style={{ fontWeight: 500, color: '#1e293b', marginBottom: 2 }}>{decodeFilename(evt.title)}</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#e0e7ff', color: '#3730a3' }}>{evt.recurrence}</span>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#f1f5f9', color: '#64748b' }}>{decodeFilename(evt.category_name)}</span>
              </div>
            </div>
          )) : <div style={{ fontSize: 12, color: '#94a3b8' }}>없음</div>}
        </div>
      </div>
    </div>
  );
}
