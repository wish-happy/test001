import { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { decodeFilename } from '../api/utils';

const CYCLE = { '상시': { bg: '#6366f1', border: '#4f46e5' }, '순기': { bg: '#f59e0b', border: '#d97706' } };

export default function WorkGraph({ categories, relations }) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!containerRef.current || !categories?.length) return;
    const nodes = new DataSet(categories.map((cat) => {
      const c = CYCLE[cat.cycle_type] || CYCLE['상시'];
      return {
        id: cat.id, label: decodeFilename(cat.name), value: cat.file_count * 15 + 35,
        color: { background: c.bg, border: c.border, highlight: { background: c.border, border: '#0f172a' } },
        font: { color: '#1e293b', size: 14, face: 'Pretendard, sans-serif', strokeWidth: 4, strokeColor: '#ffffff' },
        shape: 'dot', borderWidth: 2,
      };
    }));
    const edges = new DataSet((relations || []).map((r, i) => ({
      id: 'e'+i, from: r.source, to: r.target,
      color: { color: r.type === 'shared_person' ? '#a78bfa' : '#cbd5e1' },
      dashes: r.type === 'shared_person' ? [6, 4] : false,
      width: 1.5, smooth: { type: 'curvedCW', roundness: 0.15 },
    })));
    const net = new Network(containerRef.current, { nodes, edges }, {
      nodes: { scaling: { min: 35, max: 75 }, shadow: { enabled: true, size: 6, color: 'rgba(0,0,0,0.08)' } },
      physics: { barnesHut: { gravitationalConstant: -5000, centralGravity: 0.4, springLength: 200, springConstant: 0.05, damping: 0.3 }, stabilization: { iterations: 250, fit: true } },
      interaction: { hover: true, tooltipDelay: 100 },
    });
    net.on('click', (e) => { if (e.nodes.length) { setSelected(categories.find(c => c.id === e.nodes[0]) || null); } else { setSelected(null); } });
    net.once('stabilizationIterationsDone', () => net.fit({ animation: { duration: 400 } }));
    networkRef.current = net;
    return () => net.destroy();
  }, [categories, relations]);

  if (!categories?.length) return null;
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', margin: 0 }}>업무 관계도</h3>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748b' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }}/>상시</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}/>순기</span>
          </div>
        </div>
        <div ref={containerRef} style={{ width: '100%', height: 440, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc' }} />
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, textAlign: 'center' }}>노드 클릭 시 상세 정보 · 드래그/스크롤 확대축소</p>
      </div>
      {selected && (
        <div style={{ width: 280, padding: 20, borderRadius: 12, background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{decodeFilename(selected.name)}</h4>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94a3b8', cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, display: 'inline-block', marginBottom: 10, background: selected.cycle_type === '상시' ? '#eef2ff' : '#fef3c7', color: selected.cycle_type === '상시' ? '#3730a3' : '#92400e' }}>
            {selected.cycle_type}{selected.cycle_detail ? ' · ' + selected.cycle_detail : ''}
          </div>
          {selected.description && <p style={{ color: '#475569', lineHeight: 1.5, margin: '0 0 12px' }}>{selected.description}</p>}
          {selected.related_people?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>관련 인물</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {selected.related_people.map((p, i) => <span key={i} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, background: '#f1f5f9', color: '#475569' }}>{p}</span>)}
              </div>
            </div>
          )}
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>파일 ({selected.file_count})</div>
          {selected.files?.map((f, i) => <div key={i} style={{ fontSize: 12, color: '#475569', padding: '2px 0' }}>📄 {decodeFilename(f.path || f.filename)}</div>)}
        </div>
      )}
    </div>
  );
}
