import { useState, useRef } from 'react';

const EXT_LABELS = {
  '.hwp': '한글(HWP)',
  '.hwpx': '한글(HWPX)',
  '.docx': 'Word',
  '.xlsx': 'Excel',
  '.pdf': 'PDF',
  '.txt': '텍스트',
  '.csv': 'CSV',
  '.md': 'Markdown',
};

export default function FileUpload({ onUpload, loading }) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]);
  const folderRef = useRef();
  const fileRef = useRef();

  const handleFiles = (fileList) => {
    const arr = Array.from(fileList);
    setFiles(arr);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleSubmit = () => {
    if (files.length > 0) onUpload(files);
  };

  // 파일 통계
  const extCount = {};
  files.forEach((f) => {
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    extCount[ext] = (extCount[ext] || 0) + 1;
  });

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? '#3b82f6' : '#d1d5db'}`,
          borderRadius: 12,
          padding: '48px 24px',
          textAlign: 'center',
          background: dragOver ? '#eff6ff' : '#fafafa',
          transition: 'all 0.2s',
          cursor: 'pointer',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
        <p style={{ fontSize: 18, fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>
          전임자의 업무 폴더를 여기에 끌어다 놓으세요
        </p>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px' }}>
          HWP · HWPX · DOCX · XLSX · PDF · TXT 지원
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={() => folderRef.current?.click()}
            style={{
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            📁 폴더 선택
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              padding: '10px 20px',
              background: 'white',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            📄 파일 선택
          </button>
        </div>
        <input
          ref={folderRef}
          type="file"
          webkitdirectory="true"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".hwp,.hwpx,.docx,.xlsx,.pdf,.txt,.csv,.md"
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: 20, padding: 20, background: 'white', borderRadius: 12, border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
              선택된 파일: {files.length}개
            </h3>
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                padding: '10px 24px',
                background: loading ? '#9ca3af' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '⏳ 업로드 중...' : '🚀 분석 시작'}
            </button>
          </div>

          {/* 확장자별 통계 */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {Object.entries(extCount).map(([ext, count]) => (
              <span
                key={ext}
                style={{
                  padding: '4px 10px',
                  background: '#f3f4f6',
                  borderRadius: 20,
                  fontSize: 13,
                  color: '#4b5563',
                }}
              >
                {EXT_LABELS[ext] || ext} {count}
              </span>
            ))}
          </div>

          {/* 파일 목록 (최대 20개) */}
          <div style={{ maxHeight: 200, overflow: 'auto', fontSize: 13, color: '#6b7280' }}>
            {files.slice(0, 20).map((f, i) => (
              <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid #f3f4f6' }}>
                {f.webkitRelativePath || f.name}
              </div>
            ))}
            {files.length > 20 && (
              <div style={{ padding: '6px 0', color: '#9ca3af' }}>
                ... 외 {files.length - 20}개
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
