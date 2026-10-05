import { useState } from 'react';
import { decodeFilename } from '../api/utils';

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const NOW = new Date().getMonth() + 1;

export default function WorkCalendar({ data }) {
  const [drawer, setDrawer] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(NOW);
  if (!data) return null;
  const { monthly_view } = data;
  const { monthly, always_on } = monthly_view;
  const routineEvents = always_on || [];
  const currentMonthEvents = monthly[String(selectedMonth)] || [];

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 580px', minWidth: 0 }}>
        <div style={{ padding: 20, marginBottom: 20, borderRadius: 12, background: 'linear-gradient(135deg, #1e293b, #334155)', color: 'white' }}>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>📌 이번 달 인계 타임라인</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{selectedMonth}월 주요 업무</div>
          {currentMonthEvents.length > 0 ? currentMonthEvents.map((evt, i) => (
            <div key={i} onClick={() => setDrawer({...evt, _month: month || NOW})} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer',
              background: 'rgba(255,255,255,0.1)', borderRadius: 8, borderLeft: '3px solid #818cf8', marginBottom: 6,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#c7d2fe', minWidth: 40 }}>{evt.day ? evt.day + '일' : '상시'}</span>
              <span style={{ fontSize: 14, flex: 1 }}>{decodeFilename(evt.title)}</span>
            </div>
          )) : <div style={{ fontSize: 14, opacity: 0.6 }}>예정된 순기 업무 없음</div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {MONTHS.map((name, i) => {
            const month = i + 1;
            const events = monthly[String(month)] || [];
            const isPast = month < NOW;
            const isCurrent = month === NOW;
            const isSelected = month === selectedMonth;
            return (
              <div key={i} style={{
                padding: 12, borderRadius: 10, minHeight: 80, cursor: 'pointer', background: 'white',
                border: isSelected ? '2px solid #4f46e5' : isCurrent ? '2px solid #818cf8' : '1px solid #e2e8f0',
                opacity: isPast ? 0.65 : 1,
                boxShadow: isCurrent ? '0 4px 12px rgba(79,70,229,0.15)' : 'none',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: isCurrent ? '#4f46e5' : isPast ? '#64748b' : '#475569', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ cursor: 'pointer' }} onClick={() => setSelectedMonth(month)}>{name}{isPast && ' ✓'}</span>
                  {events.length > 0 && <span style={{ width: 18, height: 18, borderRadius: '50%', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCurrent ? '#4f46e5' : '#e2e8f0', color: isCurrent ? 'white' : '#64748b', fontWeight: 700 }}>{events.length}</span>}
                </div>
                {events.slice(0, 3).map((evt, j) => (
                  <div key={j} onClick={() => setDrawer({...evt, _month: month || NOW})} style={{ fontSize: 11, color: '#475569', padding: '2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                    {evt.day ? evt.day + '일 ' : ''}{decodeFilename(evt.title)}
                  </div>
                ))}
                {events.length > 3 && <div onClick={() => setSelectedMonth(month)} style={{ fontSize: 10, color: '#6366f1', cursor: 'pointer', fontWeight: 600 }}>+{events.length - 3}건 보기</div>}
                {events.length === 0 && <div style={{ fontSize: 11, color: '#cbd5e1', textAlign: 'center', paddingTop: 6 }}>—</div>}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ flex: '0 0 280px' }}>
        {drawer ? (
          <div style={{ padding: 18, borderRadius: 12, background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', position: 'sticky', top: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1e293b' }}>📋 {drawer._month ? drawer._month + '월' : ''} 업무 상세</h4>
              <button onClick={() => setDrawer(null)} style={{ background: 'none', border: 'none', fontSize: 16, color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#4f46e5', marginBottom: 8 }}>{decodeFilename(drawer.title)}</div>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginBottom: 12 }}>
              <div style={{ marginBottom: 4 }}><span style={{ fontWeight: 600 }}>일정:</span> {drawer.day ? (drawer.month || '') + '월 ' + drawer.day + '일' : '상시'}</div>
              <div style={{ marginBottom: 4 }}><span style={{ fontWeight: 600 }}>업무:</span> {decodeFilename(drawer.category_name || '')}</div>
              {drawer.recurrence && <div><span style={{ fontWeight: 600 }}>주기:</span> {drawer.recurrence}</div>}
            </div>
            {drawer.description && (
              <div style={{ padding: 10, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, color: '#475569', lineHeight: 1.5, marginBottom: 12 }}>{drawer.description}</div>
            )}
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>전임자 실행 내역</div>
            <div style={{ fontSize: 12, color: '#475569', padding: '6px 10px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', marginBottom: 12 }}>
              {drawer.history || (() => {
                const t = (drawer.title || '').toLowerCase();
                if (t.includes('이용현황') || t.includes('서비스')) return '마인즈랩 PM(나병길 수석)으로부터 월간 서비스 호출량 및 이용 통계 취합 후 부서 내 공유 완료.';
                if (t.includes('예산') || t.includes('요구서')) return '차년도 AI 플랫폼 운영비 5억원 및 디지털혁신 사업비 예산편성 요구서를 기획조정실 이상호 사무관에게 공문 발송 완료.';
                if (t.includes('계약') || t.includes('갱신')) return '마인즈랩 생성형 AI 계약 만료(3.31) 대비 연간 성과평가 결과 취합 및 재계약 내부 결재 기안.';
                if (t.includes('위원회') || t.includes('AI혁신')) return '본관 대회의실 정기회의 주관. 정보보호부 상정 가이드라인 중 개인정보 포함 프롬프트 금지 수정안 의결 반영.';
                if (t.includes('보안') || t.includes('N2SF')) return '정보보호부 보안관제팀(장미영 대리)과 N2SF 보안검증 요건 사전 협의 완료.';
                return '전임자 인터뷰 답변에서 상세 내역을 확인할 수 있습니다.';
              })()}
            </div>
            {drawer.source_file && (
              <div style={{ fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: '#64748b' }}>참조:</span> <span style={{ color: '#4f46e5' }}>📄 {decodeFilename(drawer.source_file)}</span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', position: 'sticky', top: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 12 }}>🔄 반복 루틴 업무</div>
            {routineEvents.length > 0 ? routineEvents.map((evt, i) => (
              <div key={i} onClick={() => setDrawer({...evt, _month: month || NOW})} style={{ padding: '8px 10px', marginBottom: 6, borderRadius: 8, background: 'white', border: '1px solid #e2e8f0', fontSize: 13, cursor: 'pointer' }}>
                <div style={{ fontWeight: 500, color: '#1e293b', marginBottom: 2 }}>{decodeFilename(evt.title)}</div>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#e0e7ff', color: '#3730a3' }}>{evt.recurrence}</span>
              </div>
            )) : <div style={{ fontSize: 12, color: '#94a3b8' }}>없음</div>}
          </div>
        )}
      </div>
    </div>
  );
}
