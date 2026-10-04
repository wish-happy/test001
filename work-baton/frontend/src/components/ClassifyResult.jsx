import { useState } from 'react';
import { decodeFilename, getExtIcon } from '../api/utils';

const CB = { '상시': { bg: '#eef2ff', color: '#3730a3', border: '#c7d2fe' }, '순기': { bg: '#fffbeb', color: '#92400e', border: '#fde68a' } };

function Stat({ label, value }) {
  return (
    <div style={{ padding: '8px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center', minWidth: 60 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
    </div>
  );
}

export default function ClassifyResult({ data }) {
  const [openId, setOpenId] = useState(null);
  if (!data) return null;
  const { categories, stats, model } = data;
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <Stat label="총 업무" value={stats.total_categories} />
          <Stat label="총 파일" value={stats.total_files} />
          <Stat label="상시" value={stats.cycle_summary['상시']} />
          <Stat label="순기" value={stats.cycle_summary['순기']} />
        </div>
        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 8, background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
          {model?.provider} · {model?.model} 분석
        </span>
      </div>
      {categories.map(cat => {
        const isOpen = openId === cat.id;
        const cycle = CB[cat.cycle_type] || CB['상시'];
        return (
          <div key={cat.id} style={{ marginBottom: 8, borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', background: 'white' }}>
            <div onClick={() => setOpenId(isOpen ? null : cat.id)} style={{
              padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: isOpen ? '#f8fafc' : 'white',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, color: '#64748b' }}>{isOpen ? '▼' : '▶'}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>{decodeFilename(cat.name)}</span>
                <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: cycle.bg, color: cycle.color, border: '1px solid ' + cycle.border }}>
                  {cat.cycle_type}{cat.cycle_detail ? ' · ' + cat.cycle_detail : ''}
                </span>
              </div>
              <span style={{ fontSize: 13, color: '#64748b' }}>{cat.file_count}개 파일</span>
            </div>
            {isOpen && (
              <div style={{ padding: '0 18px 16px', borderTop: '1px solid #f1f5f9' }}>
                {cat.description && <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, margin: '12px 0' }}>{cat.description}</p>}
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', padding: '6px 4px', color: '#64748b', fontWeight: 500 }}>파일명</th>
                    <th style={{ textAlign: 'left', padding: '6px 4px', color: '#64748b', fontWeight: 500, width: 60 }}>형식</th>
                  </tr></thead>
                  <tbody>{cat.files?.map((f, i) => {
                    const nm = decodeFilename(f.path || f.filename);
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '6px 4px', color: '#334155' }}>{getExtIcon(nm)} {nm}</td>
                        <td style={{ padding: '6px 4px' }}>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#f1f5f9', color: '#475569', fontWeight: 500 }}>{nm.split('.').pop().toUpperCase()}</span>
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
                {cat.related_people?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>관련: </span>
                    {cat.related_people.map((p, i) => <span key={i} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, marginRight: 4, background: '#f1f5f9', color: '#475569' }}>{p}</span>)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
