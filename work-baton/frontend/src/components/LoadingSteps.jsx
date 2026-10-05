import { useState, useEffect } from 'react';

const STEP_SEQUENCES = {
  upload: [
    { text: '📂 전임자 폴더를 열어보고 있어요...', delay: 0 },
    { text: '📄 HWP · HWPX · DOCX · PDF 문서를 읽는 중...', delay: 2000 },
    { text: '🔍 표 구조와 날짜, 인물, 금액을 추출하고 있어요', delay: 4000 },
    { text: '🧮 파일 간 연관 관계를 파악하고 있어요', delay: 6000 },
  ],
  classify: [
    { text: '🧠 AI가 300개 파일의 내용을 읽고 있어요', delay: 0 },
    { text: '🏷️ 예산, 계약, 보안... 업무 단위로 묶는 중', delay: 3000 },
    { text: '📊 상시 업무와 시기별 업무를 구분하고 있어요', delay: 6000 },
    { text: '🔗 부서 간 업무 관계를 분석하고 있어요', delay: 9000 },
    { text: '✨ 거의 다 됐어요!', delay: 12000 },
  ],
  interview: [
    { text: '📋 업무별로 문서가 충분한지 진단 중...', delay: 0 },
    { text: '🔍 인수인계에 빠진 정보를 찾고 있어요', delay: 3000 },
    { text: '🎤 전임자에게 물어볼 질문을 만들고 있어요', delay: 6000 },
    { text: '⚠️ 리스크가 높은 업무를 체크하고 있어요', delay: 9000 },
  ],
  generate: [
    { text: '💾 전임자 답변을 정리하고 있어요', delay: 0 },
    { text: '📅 월별 업무 일정을 캘린더로 만드는 중', delay: 2000 },
    { text: '📋 인수인계서 초안을 작성하고 있어요', delay: 5000 },
    { text: '👥 업무별 담당자와 연락처를 정리 중', delay: 8000 },
    { text: '📎 각 항목에 출처 문서를 연결하고 있어요', delay: 12000 },
    { text: '✅ 최종 검토 중... 곧 완료됩니다!', delay: 16000 },
  ],
};

export default function LoadingSteps({ phase }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [dots, setDots] = useState('');
  const steps = STEP_SEQUENCES[phase] || STEP_SEQUENCES.upload;

  useEffect(() => {
    setCurrentIdx(0);
    const timers = steps.map((step, idx) => {
      if (idx === 0) return null;
      return setTimeout(() => setCurrentIdx(idx), step.delay);
    });
    return () => timers.forEach(t => t && clearTimeout(t));
  }, [phase]);

  // 점 애니메이션
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      padding: 40, textAlign: 'center',
      background: 'linear-gradient(135deg, #fafafe, #f0f4ff)',
      borderRadius: 20, marginBottom: 16,
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
    }}>
      {/* 아이콘 펄스 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: 'inline-flex', width: 64, height: 64, borderRadius: 20,
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          alignItems: 'center', justifyContent: 'center', fontSize: 28,
          animation: 'pulse 2s ease-in-out infinite',
          boxShadow: '0 8px 24px rgba(79,70,229,0.25)',
        }}>
          {phase === 'upload' ? '📂' : phase === 'classify' ? '🧠' : phase === 'interview' ? '🎤' : '📋'}
        </div>
      </div>

      {/* 현재 단계 메시지 */}
      <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
        {steps[currentIdx]?.text}{dots}
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>
        {currentIdx + 1} / {steps.length} 단계
      </div>

      {/* 프로그레스 바 */}
      <div style={{
        width: '100%', maxWidth: 360, height: 6, background: '#e2e8f0',
        borderRadius: 3, margin: '0 auto', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
          borderRadius: 3, transition: 'width 0.8s ease',
          width: ((currentIdx + 1) / steps.length * 100) + '%',
        }} />
      </div>

      {/* CSS 애니메이션 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
