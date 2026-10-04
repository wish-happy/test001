import { useState } from 'react';

function ToolBtn({ icon, label, onClick }) {
  return <button onClick={onClick} style={{ padding: '6px 12px', background: 'white', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>{icon} {label}</button>;
}

export default function HandoverDoc({ markdown, sessionId }) {
  const [copied, setCopied] = useState(false);
  if (!markdown) return null;

  const toHtml = (md) => md
    .replace(/^### (.+)$/gm, '<h3 style="font-size:15px;font-weight:600;margin:20px 0 8px;color:#4f46e5;border-bottom:1px solid #e2e8f0;padding-bottom:4px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:17px;font-weight:700;margin:28px 0 10px;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:6px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:22px;font-weight:800;margin:0 0 20px;color:#0f172a;text-align:center">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1e293b">$1</strong>')
    .replace(/^- (.+)$/gm, '<div style="padding:3px 0 3px 20px;font-size:14px;color:#334155">• $1</div>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>')
    .replace(/⚠️/g, '<span style="color:#dc2626;font-weight:600">⚠️</span>')
    .replace(/\n\n/g, '<br/>');

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
