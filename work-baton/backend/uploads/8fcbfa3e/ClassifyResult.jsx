const CYCLE_COLORS = {
  '상시': { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  '순기': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
};

const EXT_ICONS = {
  '.hwp': '📝', '.hwpx': '📝', '.docx': '📄',
  '.xlsx': '📊', '.pdf': '📕', '.txt': '📃',
};

export default function ClassifyResult({ data }) {
  if (!data) return null;

  const { categories, stats, model } = data;

  return (
    <div>
      {/* 상단 통계 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 12,
        marginBottom: 24,
      }}>
        <StatCard label="총 업무" value={stats.total_categories} unit="개" color="#3b82f6" />
        <StatCard label="총 파일" value={stats.total_files} unit="개" color="#8b5cf6" />
        <StatCard label="상시 업무" value={stats.cycle_summary['상시']} unit="개" color="#2563eb" />
        <StatCard label="순기 업무" value={stats.cycle_summary['순기']} unit="개" color="#d97706" />
      </div>

      {/* 사용 모델 */}
      <div style={{
        padding: '8px 14px',
        background: '#f0fdf4',
        borderRadius: 8,
        fontSize: 13,
        color: '#166534',
        marginBottom: 20,
        border: '1px solid #bbf7d0',
      }}>
        🤖 분류 모델: {model?.provider} / {model?.model}
      </div>

      {/* 업무 카드 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {categories.map((cat) => (
          <CategoryCard key={cat.id} category={cat} />
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, color }) {
  return (
    <div style={{
      padding: 16,
      background: 'white',
      borderRadius: 12,
      border: '1px solid #e5e7eb',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 13, color: '#6b7280' }}>{label} ({unit})</div>
    </div>
  );
}

function CategoryCard({ category }) {
  const cycle = CYCLE_COLORS[category.cycle_type] || CYCLE_COLORS['상시'];

  return (
    <div style={{
      padding: 20,
      background: 'white',
      borderRadius: 12,
      border: '1px solid #e5e7eb',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, flex: 1 }}>
          {category.name}
        </h3>
        <span style={{
          padding: '3px 10px',
          background: cycle.bg,
          color: cycle.text,
          border: `1px solid ${cycle.border}`,
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
        }}>
          {category.cycle_type}
          {category.cycle_detail && ` · ${category.cycle_detail}`}
        </span>
      </div>

      {/* 설명 */}
      <p style={{ margin: '0 0 14px', fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
        {category.description}
      </p>

      {/* 파일 목록 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          📁 파일 ({category.file_count}개)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {category.files.map((f, i) => (
            <div key={i} style={{
              padding: '4px 10px',
              background: '#f9fafb',
              borderRadius: 6,
              fontSize: 13,
              color: '#4b5563',
            }}>
              {EXT_ICONS[f.path?.split('.').pop() ? '.' + f.path.split('.').pop() : ''] || '📄'}{' '}
              {f.path || f.filename}
            </div>
          ))}
        </div>
      </div>

      {/* 주요 일정 */}
      {category.key_dates?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            📅 주요 일정
          </div>
          {category.key_dates.map((kd, i) => (
            <div key={i} style={{ fontSize: 13, color: '#6b7280', padding: '2px 0' }}>
              <span style={{ color: '#2563eb', fontWeight: 500 }}>{kd.date_hint}</span> — {kd.task}
            </div>
          ))}
        </div>
      )}

      {/* 관련 인물 */}
      {category.related_people?.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            👤 관련 인물
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {category.related_people.map((p, i) => (
              <span key={i} style={{
                padding: '3px 10px',
                background: '#f3f4f6',
                borderRadius: 20,
                fontSize: 12,
                color: '#4b5563',
              }}>
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
