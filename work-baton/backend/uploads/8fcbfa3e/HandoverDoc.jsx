export default function HandoverDoc({ markdown }) {
  if (!markdown) return null;

  // 간이 마크다운 → HTML (기본 변환)
  const toHtml = (md) => {
    return md
      .replace(/^### (.+)$/gm, '<h3 style="font-size:16px;font-weight:600;margin:18px 0 8px;color:#1e40af">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="font-size:18px;font-weight:700;margin:24px 0 10px;color:#1f2937;border-bottom:2px solid #e5e7eb;padding-bottom:6px">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="font-size:22px;font-weight:800;margin:0 0 16px;color:#1e3a5f">$1</h1>')
      .replace(/^\*\*(.+?)\*\*/gm, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<div style="padding:2px 0 2px 16px;font-size:14px">• $1</div>')
      .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>')
      .replace(/\|(.+)/g, (match) => {
        const cells = match.split('|').filter(c => c.trim());
        if (cells.every(c => c.trim().match(/^[-]+$/))) return '';
        const tds = cells.map(c => `<td style="padding:6px 10px;border:1px solid #e5e7eb;font-size:13px">${c.trim()}</td>`).join('');
        return `<tr>${tds}</tr>`;
      })
      .replace(/(<tr>.*<\/tr>\n?)+/g, (match) => `<table style="border-collapse:collapse;width:100%;margin:8px 0">${match}</table>`)
      .replace(/⚠️/g, '<span style="color:#dc2626">⚠️</span>')
      .replace(/\n\n/g, '<br/>')
      .replace(/\n/g, '\n');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
  };

  return (
    <div>
      {/* 상단 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
        <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>📋 인수인계서</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleCopy}
            style={{
              padding: '8px 16px', background: 'white', color: '#374151',
              border: '1px solid #d1d5db', borderRadius: 8,
              fontSize: 13, cursor: 'pointer',
            }}
          >
            📋 복사
          </button>
        </div>
      </div>

      {/* 문서 본문 */}
      <div style={{
        padding: 28, background: 'white', borderRadius: 12,
        border: '1px solid #e5e7eb', lineHeight: 1.7,
        fontSize: 14, color: '#374151',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        maxHeight: 600, overflow: 'auto',
      }}>
        <div dangerouslySetInnerHTML={{ __html: toHtml(markdown) }} />
      </div>

      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8, textAlign: 'center' }}>
        이 인수인계서는 AI가 생성한 초안입니다. 전임자의 검토·수정이 필요합니다.
      </p>
    </div>
  );
}
