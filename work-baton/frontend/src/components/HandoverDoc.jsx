import { useState } from 'react';

function ToolBtn({ icon, label, onClick }) {
  return <button onClick={onClick} style={{ padding: '6px 12px', background: 'white', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>{icon} {label}</button>;
}

export default function HandoverDoc({ markdown, sessionId }) {
  const [copied, setCopied] = useState(false);
  if (!markdown) return null;

  const toHtml = (md) => {
    // 마크다운 표 변환
    let html = md;
    
    // 표 처리
    const tableRegex = /(\|.+\|\n)(\|[-:| ]+\|\n)((?:\|.+\|\n?)+)/g;
    html = html.replace(tableRegex, (match, headerRow, separator, bodyRows) => {
      const headers = headerRow.trim().split('|').filter(c => c.trim());
      const rows = bodyRows.trim().split('\n').map(r => r.split('|').filter(c => c.trim()));
      let table = '<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px">';
      table += '<thead><tr>' + headers.map(h => '<th style="border:1px solid #e2e8f0;padding:8px;background:#f8fafc;text-align:left">' + h.trim() + '</th>').join('') + '</tr></thead>';
      table += '<tbody>' + rows.map(r => '<tr>' + r.map(c => '<td style="border:1px solid #e2e8f0;padding:8px">' + c.trim() + '</td>').join('') + '</tr>').join('') + '</tbody>';
      table += '</table>';
      return table;
    });
    
    // 제목/불릿 등 기존 변환
    html = html
      .replace(/^### (.+)$/gm, '<h3 style="margin:18px 0 8px;font-size:16px;color:#1e293b">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="margin:24px 0 10px;font-size:18px;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:6px">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="margin:28px 0 12px;font-size:22px;font-weight:800;color:#0f172a;text-align:center">$1</h1>')
      .replace(/^[•\-\*] (.+)$/gm, '<div style="padding:2px 0 2px 16px">• $1</div>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
    return html;
  }

  const handleCopy = () => { navigator.clipboard.writeText(markdown); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleExport = (fmt) => window.open('/api/baton/handover/' + sessionId + '/export?format=' + fmt, '_blank');

  return (
    <div style={{ background: '#f1f5f9', padding: '24px 0', minHeight: '100vh' }}>
      <div style={{ maxWidth: 800, margin: '0 auto 16px', display: 'flex', justifyContent: 'flex-end', gap: 6, padding: '0 8px' }}>
        <ToolBtn icon="📋" label={copied ? '복사됨!' : '복사'} onClick={handleCopy} />
        <ToolBtn icon="📄" label="Word" onClick={() => handleExport('docx')} />
        <ToolBtn icon="📕" label="PDF" onClick={() => handleExport('pdf')} />
        <ToolBtn icon="🖨" label="인쇄" onClick={() => window.print()} />
      </div>
      <div style={{ maxWidth: 800, margin: '0 auto', background: 'white', border: '1px solid #d1d5db', borderRadius: 4, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '48px 56px', lineHeight: 1.8, fontSize: 14, color: '#334155', minHeight: 600 }}>
        <div dangerouslySetInnerHTML={{ __html: toHtml(markdown) }} />
      </div>
      <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 12 }}>AI가 생성한 초안입니다. 전임자 검토가 필요합니다.</p>
    </div>
  );
}
