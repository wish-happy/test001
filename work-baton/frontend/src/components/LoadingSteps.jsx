import { useState, useEffect } from 'react';

const STEP_SEQUENCES = {
  upload: [
    { text: '📂 파일 구조 분석 중...', delay: 0 },
    { text: '📄 HWP · HWPX · DOCX · PDF 파싱 중...', delay: 2000 },
    { text: '🔍 표 구조 및 메타데이터 추출 중...', delay: 4000 },
  ],
  classify: [
    { text: '🧠 AI가 파일 내용을 읽고 있습니다...', delay: 0 },
    { text: '🏷️ 업무 단위로 자동 분류 중...', delay: 3000 },
    { text: '📊 상시/순기 업무 구분 중...', delay: 6000 },
    { text: '🔗 업무 간 관계 분석 중...', delay: 9000 },
  ],
  interview: [
    { text: '📋 업무별 커버리지 분석 중...', delay: 0 },
    { text: '🔍 문서 빈틈 탐지 중...', delay: 2000 },
    { text: '🎤 전임자 인터뷰 질문 생성 중...', delay: 5000 },
  ],
  generate: [
    { text: '💾 전임자 답변 저장 중...', delay: 0 },
    { text: '📅 업무 일정 및 기한 추출 중...', delay: 2000 },
    { text: '📋 인수인계서 초안 작성 중...', delay: 5000 },
    { text: '✍️ 업무별 이해관계자 정리 중...', delay: 8000 },
    { text: '📎 출처 문서 연결 중...', delay: 12000 },
    { text: '✅ 최종 검토 및 포맷팅...', delay: 16000 },
  ],
};

export default function LoadingSteps({ phase }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const steps = STEP_SEQUENCES[phase] || STEP_SEQUENCES.upload;

  useEffect(() => {
    setCurrentIdx(0);
    const timers = steps.map((step, idx) => {
      if (idx === 0) return null;
      return setTimeout(() => setCurrentIdx(idx), step.delay);
    });
    return () => timers.forEach(t => t && clearTimeout(t));
  }, [phase]);

  return (
    <div style={{
      padding: 28, textAlign: 'center', background: 'white',
      borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16,
    }}>
      {/* 진행 바 */}
      <div style={{
        width: '100%', height: 4, background: '#e5e7eb',
        borderRadius: 2, marginBottom: 20, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', background: 'linear-gradient(90deg, #2563eb, #7c3aed)',
          borderRadius: 2, transition: 'width 0.5s ease',
          width: `${((currentIdx + 1) / steps.length) * 100}%`,
        }} />
      </div>

      {/* 단계 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        {steps.map((step, idx) => (
          <div key={idx} style={{
            fontSize: 14,
            fontWeight: idx === currentIdx ? 600 : 400,
            color: idx < currentIdx ? '#059669' : (idx === currentIdx ? '#1f2937' : '#d1d5db'),
            transition: 'all 0.3s',
          }}>
            {idx < currentIdx ? '✅' : (idx === currentIdx ? '⏳' : '⬜')} {step.text}
          </div>
        ))}
      </div>
    </div>
  );
}
