const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

export default function WorkCalendar({ data }) {
  if (!data) return null;

  const { monthly_view, events } = data;
  const { monthly, always_on } = monthly_view;

  return (
    <div>
      {/* 상시 업무 */}
      {always_on?.length > 0 && (
        <div style={{
          padding: 16, background: '#eff6ff', borderRadius: 12,
          border: '1px solid #bfdbfe', marginBottom: 20,
        }}>
          <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 600, color: '#1e40af' }}>
            🔄 상시 업무
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {always_on.map((evt, i) => (
              <div key={i} style={{ fontSize: 14, color: '#374151', display: 'flex', gap: 8 }}>
                <span style={{
                  padding: '1px 8px', background: '#dbeafe', borderRadius: 12,
                  fontSize: 12, color: '#1e40af', whiteSpace: 'nowrap',
                }}>
                  {evt.recurrence}
                </span>
                <span style={{ fontWeight: 500 }}>{evt.title}</span>
                <span style={{ color: '#9ca3af', fontSize: 13 }}>— {evt.category_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 월별 그리드 */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 12,
      }}>
        {MONTH_NAMES.map((name, i) => {
          const monthEvents = monthly[String(i + 1)] || [];
          const hasEvents = monthEvents.length > 0;

          return (
            <div key={i} style={{
              padding: 14, background: 'white', borderRadius: 12,
              border: `1px solid ${hasEvents ? '#fbbf24' : '#e5e7eb'}`,
              opacity: hasEvents ? 1 : 0.6,
              minHeight: 100,
            }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: hasEvents ? '#d97706' : '#9ca3af',
                marginBottom: 8, display: 'flex', justifyContent: 'space-between',
              }}>
                <span>{name}</span>
                {hasEvents && (
                  <span style={{
                    padding: '0 6px', background: '#fef3c7', borderRadius: 10,
                    fontSize: 11, color: '#92400e',
                  }}>
                    {monthEvents.length}
                  </span>
                )}
              </div>
              {monthEvents.map((evt, j) => (
                <div key={j} style={{
                  fontSize: 13, padding: '4px 0', color: '#374151',
                  borderBottom: j < monthEvents.length - 1 ? '1px solid #f3f4f6' : 'none',
                }}>
                  <div style={{ fontWeight: 500 }}>
                    {evt.day ? `${evt.day}일 ` : ''}{evt.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{evt.category_name}</div>
                </div>
              ))}
              {!hasEvents && (
                <div style={{ fontSize: 12, color: '#d1d5db', textAlign: 'center', paddingTop: 12 }}>
                  일정 없음
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
