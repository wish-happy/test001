import { useState } from 'react';
import { decodeFilename } from '../api/utils';

export default function StakeholderMap({ categories }) {
  const [selected, setSelected] = useState(null);
  if (!categories?.length) return null;

  const cards = categories.map(cat => {
    const isExt = cat.name?.includes('외부') || cat.name?.includes('업체') || cat.name?.includes('랩');
    return { id: cat.id, name: decodeFilename(cat.name), description: cat.description || '', type: isExt ? '외부' : '내부',
      people: cat.related_people || [], fileCount: cat.file_count, files: cat.files || [], cycle: cat.cycle_type, cycleDetail: cat.cycle_detail };
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', margin: 0 }}>유관부서 및 협력기관</h3>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{cards.length}개 업무 영역</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {cards.map(card => {
          const isActive = selected?.id === card.id;
          return (
            <div key={card.id} onClick={() => setSelected(isActive ? null : card)} style={{
              padding: 18, borderRadius: 12, cursor: 'pointer', background: isActive ? '#f8fafc' : 'white',
              border: isActive ? '2px solid #4f46e5' : '1px solid #e2e8f0',
              boxShadow: isActive ? '0 4px 12px rgba(79,70,229,0.1)' : '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.15s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>{card.name}</span>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, fontWeight: 600,
                  background: card.type === '외부' ? '#fef3c7' : '#eef2ff', color: card.type === '외부' ? '#92400e' : '#3730a3' }}>{card.type}</span>
              </div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginBottom: 10 }}>{card.description || '업무 설명 없음'}</div>
              {card.people.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>소관 창구</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {card.people.map((p, i) => <span key={i} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, background: '#f1f5f9', color: '#334155' }}>{p}</span>)}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 6,
                  background: card.cycle === '순기' ? '#fef3c7' : '#eef2ff', color: card.cycle === '순기' ? '#92400e' : '#3730a3' }}>
                  {card.cycle}{card.cycleDetail ? ' · ' + card.cycleDetail : ''}</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>📄 {card.fileCount}개</span>
              </div>
            </div>
          );
        })}
      </div>
      {selected && (
        <div style={{ marginTop: 16, padding: 20, borderRadius: 12, background: 'white', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>📂 {selected.name} — 관련 문서</h4>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 16, color: '#94a3b8', cursor: 'pointer' }}>✕</button>
          </div>
          {selected.files.map((f, i) => (
            <div key={i} style={{ fontSize: 13, color: '#475569', padding: '4px 8px', borderRadius: 6, background: '#f8fafc', marginBottom: 4 }}>
              📄 {decodeFilename(f.path || f.filename)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
