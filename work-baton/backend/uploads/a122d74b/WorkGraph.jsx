import { useEffect, useRef } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';

const CYCLE_COLORS = {
  '상시': { background: '#3b82f6', border: '#2563eb', font: '#ffffff' },
  '순기': { background: '#f59e0b', border: '#d97706', font: '#ffffff' },
};

const EDGE_COLORS = {
  related: { color: '#6b7280', dashes: false },
  shared_person: { color: '#8b5cf6', dashes: [5, 5] },
};

export default function WorkGraph({ categories, relations }) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !categories?.length) return;

    // 노드 생성
    const nodes = new DataSet(
      categories.map((cat) => {
        const colors = CYCLE_COLORS[cat.cycle_type] || CYCLE_COLORS['상시'];
        return {
          id: cat.id,
          label: `${cat.name}\n(${cat.file_count}개 파일)`,
          value: cat.file_count * 10 + 20, // 파일 수에 비례한 크기
          color: {
            background: colors.background,
            border: colors.border,
            highlight: { background: colors.border, border: '#1e3a5f' },
          },
          font: { color: colors.font, size: 14, face: 'Pretendard, sans-serif' },
          shape: 'dot',
          title: `${cat.name}\n${cat.description}\n주기: ${cat.cycle_type}${cat.cycle_detail ? ' (' + cat.cycle_detail + ')' : ''}`,
        };
      })
    );

    // 엣지 생성
    const edges = new DataSet(
      (relations || []).map((rel, i) => ({
        id: `edge_${i}`,
        from: rel.source,
        to: rel.target,
        color: EDGE_COLORS[rel.type]?.color || '#999',
        dashes: EDGE_COLORS[rel.type]?.dashes || false,
        title: rel.reason,
        width: 2,
        smooth: { type: 'continuous' },
      }))
    );

    const options = {
      nodes: {
        scaling: { min: 25, max: 60 },
        borderWidth: 2,
        shadow: { enabled: true, size: 6, x: 2, y: 2 },
      },
      edges: {
        width: 2,
        smooth: { enabled: true, type: 'continuous' },
      },
      physics: {
        enabled: true,
        barnesHut: {
          gravitationalConstant: -3000,
          centralGravity: 0.3,
          springLength: 150,
          springConstant: 0.04,
        },
        stabilization: { iterations: 150 },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        zoomView: true,
        dragView: true,
      },
    };

    networkRef.current = new Network(containerRef.current, { nodes, edges }, options);

    return () => {
      networkRef.current?.destroy();
    };
  }, [categories, relations]);

  if (!categories?.length) return null;

  return (
    <div>
      <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12, color: '#1f2937' }}>
        🔗 업무 관계도
      </h3>

      {/* 범례 */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 12,
        fontSize: 13,
        color: '#6b7280',
        flexWrap: 'wrap',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
          상시 업무
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
          순기 업무
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 24, height: 2, background: '#6b7280', display: 'inline-block' }} />
          연관 업무
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 24, height: 2, background: '#8b5cf6', display: 'inline-block', borderTop: '2px dashed #8b5cf6' }} />
          공통 관련자
        </span>
      </div>

      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: 400,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          background: '#fafafa',
        }}
      />

      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8, textAlign: 'center' }}>
        노드를 드래그하거나 스크롤로 확대/축소할 수 있습니다 · 노드 크기 = 파일 수
      </p>
    </div>
  );
}
