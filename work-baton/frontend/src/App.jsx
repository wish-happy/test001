import { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import ClassifyResult from './components/ClassifyResult';
import StakeholderMap from './components/StakeholderMap';
import Interview from './components/Interview';
import WorkCalendar from './components/WorkCalendar';
import HandoverDoc from './components/HandoverDoc';
import QAChatbot from './components/QAChatbot';
import LoadingSteps from './components/LoadingSteps';
import {
  uploadFiles, parseFiles, classifyFiles,
  generateInterview, submitAnswers, extractCalendar,
  generateHandover, chat,
} from './api/client';
import './index.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

const TABS = [
  { id: 'graph', label: '🔗 관계도', step: 3 },
  { id: 'classify', label: '🏷️ 분류', step: 3 },
  { id: 'interview', label: '🎤 인터뷰', step: 4 },
  { id: 'calendar', label: '📅 캘린더', step: 5 },
  { id: 'handover', label: '📋 인수인계서', step: 6 },
  { id: 'chat', label: '💬 Q&A', step: 6 },
  { id: 'dashboard', label: '📊 진행률', step: 3 },
];

export default function App() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('upload');
  const [error, setError] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    document.body.style.cssText = darkMode 
      ? 'background: #0f172a !important; color: #e2e8f0 !important; transition: all 0.3s;'
      : 'background: #f8fafc !important; color: #1e293b !important; transition: all 0.3s;';
  }, [darkMode]);
  const [classifyResult, setClassifyResult] = useState(null);
  const [classifyData, setClassifyData] = useState(null);
  const [interviewData, setInterviewData] = useState(null);
  const [calendarData, setCalendarData] = useState(null);
  const [handoverMd, setHandoverMd] = useState(null);
  
  const handleReclassify = (fromCatId, fileIdx, toCatId) => {
    if (!toCatId || !classifyData) return;
    const updated = { ...classifyData };
    const cats = [...updated.categories];
    const fromCat = cats.find(c => c.id === fromCatId);
    if (!fromCat || !fromCat.files[fileIdx]) return;
    const [movedFile] = fromCat.files.splice(fileIdx, 1);
    fromCat.file_count = fromCat.files.length;
    let toCat = cats.find(c => c.id === toCatId);
    if (!toCat) {
      toCat = { id: toCatId, name: '공통/참조 문서', description: '', cycle_type: '상시', files: [], file_count: 0 };
      cats.push(toCat);
    }
    toCat.files.push(movedFile);
    toCat.file_count = toCat.files.length;
    updated.categories = cats.filter(c => c.files.length > 0);
    updated.stats = { ...updated.stats, total_categories: updated.categories.length };
    setClassifyData(updated);
  };

  const [activeTab, setActiveTab] = useState('graph');
  const [currentModel, setCurrentModel] = useState('gemini-3.1-flash-lite');
  const MODEL_OPTIONS = [
    { id: 'gemini-3.1-flash-lite', label: 'Gemini Flash Lite', provider: 'Google' },
    { id: 'gemini-flash-lite-latest', label: 'Gemini Latest', provider: 'Google' },
    { id: 'gemini-3-flash-preview', label: 'Gemini Preview', provider: 'Google' },
  ];
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // ─── 1~3: 업로드 → 파싱 → 분류 ───
  const handleUploadAndClassify = async (files) => {
    setLoading(true); setError(null);
    try {
      setLoadingPhase('upload');
      const upRes = await uploadFiles(files);
      setSessionId(upRes.session_id);

      const pRes = await parseFiles(upRes.session_id);
      setParseResult(pRes); setStep(2);

      setLoadingPhase('classify');
      const cRes = await classifyFiles(upRes.session_id, 'gemini', apiKey);
      setClassifyResult(cRes); setStep(3); setActiveTab('graph');
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally { setLoading(false); }
  };

  // ─── 4: 인터뷰 ───
  const handleInterview = async () => {
    setLoading(true); setLoadingPhase('interview');
    try {
      const res = await generateInterview(sessionId);
      setInterviewData(res); setStep(4); setActiveTab('interview');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ─── 4-1 → 5 → 6 ───
  const handleSubmitAndGenerate = async (answers) => {
    setLoading(true); setError(null); setLoadingPhase('generate');
    try {
      await submitAnswers(sessionId, answers);
      const calRes = await extractCalendar(sessionId);
      setCalendarData(calRes); setStep(5);
      const hdRes = await generateHandover(sessionId);
      setHandoverMd(hdRes.handover_markdown); setStep(6); setActiveTab('handover');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleAsk = async (question) => await chat(sessionId, question);

  const handleExport = (format) => {
    window.open(`${API_BASE}/api/baton/handover/${sessionId}/export?format=${format}`, '_blank');
  };

  const handleReset = () => {
    setStep(1); setSessionId(null); setParseResult(null);
    setClassifyResult(null); setInterviewData(null);
    setCalendarData(null); setHandoverMd(null);
    setError(null); setActiveTab('graph');
  };

  const handleDemo = async () => {
    try {
      setStep(1);
      const uRes = await fetch('/api/baton/demo', { method: 'POST' });
      const uData = await uRes.json();
      setSessionId(uData.session_id);
      setParseResult(uData); setStep(2);
      const cRes = await classifyFiles(uData.session_id);
      setClassifyResult(cRes.categories || []);
      if (setClassifyData) setClassifyData(cRes);
      setStep(3); setActiveTab('graph');
    } catch (e) { alert('데모 로드 실패: ' + e.message); }
  };

  // 진행률 계산
  const progressSteps = [
    { label: '파일 업로드', done: step >= 2, icon: '📤' },
    { label: 'AI 분류', done: step >= 3, icon: '🏷️' },
    { label: '전임자 인터뷰', done: step >= 4, icon: '🎤' },
    { label: '캘린더 추출', done: step >= 5, icon: '📅' },
    { label: '인수인계서 생성', done: step >= 6, icon: '📋' },
    { label: 'Q&A 준비', done: step >= 6, icon: '💬' },
  ];
  const progressPercent = Math.round(progressSteps.filter(s => s.done).length / progressSteps.length * 100);

  const visibleTabs = TABS.filter((t) => t.step <= step);

  return (
    <div style={{ minHeight: '100vh', background: darkMode ? '#0f172a' : '#f3f4f6', color: darkMode ? '#e2e8f0' : '#1e293b', transition: 'all 0.3s' }}>
      {/* ─── 헤더 ─── */}
      <header style={{
        background: darkMode ? '#1e293b' : 'white', borderBottom: '1px solid ' + (darkMode ? '#334155' : '#e2e8f0'),
        color: darkMode ? '#e2e8f0' : '#1e293b', padding: '20px 20px 0',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 2px' }}>🏃 업무바통</h1>
              <p style={{ fontSize: 13, opacity: 0.8, margin: 0 }}>
                전임자는 전화 안 받아도 되고, 후임자는 전화 안 해도 되는 AI 인수인계 도구
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setDarkMode(d => !d)}
                style={{ padding: '5px 10px', background: darkMode ? '#334155' : '#f1f5f9',
                  border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 16, cursor: 'pointer' }}>
                {darkMode ? '☀️' : '🌙'}
              </button>
              {step > 1 && (
                <button onClick={handleReset}
                  style={{ padding: '5px 10px', background: '#f1f5f9',
                    border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: darkMode ? '#94a3b8' : '#64748b' }}>
                  초기화
                </button>
              )}

            </div>
          </div>

          {showSettings && (
            <div style={{ padding: 14, background: 'rgba(255,255,255,0.1)', borderRadius: 8, marginBottom: 12 }}>
              <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>OpenAI API Key</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                style={{ width: '100%', maxWidth: 360, padding: '6px 10px', borderRadius: 6,
                  border: 'none', fontSize: 13, background: 'rgba(255,255,255,0.9)', color: '#1f2937' }} />
            </div>
          )}

          {step >= 3 && (
            <div style={{ display: 'flex', gap: 2, paddingTop: 8 }}>
              {visibleTabs.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '8px 14px', fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
                    background: activeTab === tab.id ? (darkMode ? '#312e81' : '#eef2ff') : 'transparent',
                    color: activeTab === tab.id ? '#4f46e5' : '#64748b',
                    border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer',
                  }}>
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ─── 메인 ─── */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '20px 20px 60px' }}>
        {error && (
          <div style={{ padding: 14, background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 10, color: '#991b1b', fontSize: 13, marginBottom: 16 }}>
            ⚠️ {error}
            <button onClick={() => setError(null)} style={{ marginLeft: 12, background: 'none',
              border: 'none', color: '#991b1b', cursor: 'pointer', fontSize: 13 }}>✕</button>
          </div>
        )}

        {/* 단계별 로딩 */}
        {loading && <LoadingSteps phase={loadingPhase} />}

        {/* Step 1 */}
        {step === 1 && !loading && <FileUpload onUpload={handleUploadAndClassify} loading={loading} />}

        {/* Step 3+ */}
        {step >= 3 && !loading && (
          <div>
            {activeTab === 'graph' && classifyResult && (
              <div>
                <div style={{ padding: 20, background: darkMode ? '#1e293b' : 'white', borderRadius: 12,
                  border: '1px solid ' + (darkMode ? '#334155' : '#e5e7eb'), marginBottom: 16 }}>
                  <StakeholderMap categories={classifyResult.categories} relations={classifyResult.relations} />
                </div>
                {step === 3 && (
                  <div style={{ textAlign: 'center' }}>
                    <button onClick={handleInterview}
                      style={{ padding: '12px 32px', background: '#2563eb', color: '#1e293b',
                        border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                      🎤 다음: 커버리지 분석 & 전임자 인터뷰
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'classify' && classifyResult && <ClassifyResult data={classifyResult} />}

            {activeTab === 'interview' && interviewData && (
              <Interview data={interviewData} onSubmitAnswers={handleSubmitAndGenerate} loading={loading} />
            )}

            {activeTab === 'calendar' && calendarData && <WorkCalendar data={calendarData} />}

            {activeTab === 'handover' && handoverMd && (
              <div>
                <HandoverDoc markdown={handoverMd} sessionId={sessionId} />
                {/* 내보내기 버튼 */}
                <div style={{
                  display: 'flex', gap: 10, justifyContent: 'center',
                  marginTop: 16, padding: 16, background: darkMode ? '#1e293b' : 'white',
                  borderRadius: 12, border: '1px solid ' + (darkMode ? '#334155' : '#e5e7eb'),
                }}>
                  <button onClick={() => handleExport('docx')}
                    style={{ padding: '10px 24px', background: '#2563eb', color: '#1e293b',
                      border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    📄 Word(.docx) 다운로드
                  </button>
                  <button onClick={() => handleExport('pdf')}
                    style={{ padding: '10px 24px', background: '#7c3aed', color: '#1e293b',
                      border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    📕 PDF 다운로드
                  </button>
                </div>
              </div>
            )}

            
            {activeTab === 'dashboard' && (
              <div style={{ padding: 20 }}>
                <div style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', borderRadius: 16, padding: 24, color: 'white', marginBottom: 20 }}>
                  <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 4 }}>인수인계 진행률</div>
                  <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 12 }}>{progressPercent}%</div>
                  <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, height: 10, overflow: 'hidden' }}>
                    <div style={{ width: progressPercent + '%', height: '100%', background: 'white', borderRadius: 8, transition: 'width 0.5s' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
                  {progressSteps.map((s, i) => (
                    <div key={i} style={{ padding: 14, borderRadius: 10, border: '1px solid ' + (s.done ? '#bbf7d0' : '#fde68a'), background: s.done ? '#f0fdf4' : '#fffbeb' }}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: s.done ? '#166534' : '#92400e' }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: s.done ? '#16a34a' : '#d97706', marginTop: 2 }}>{s.done ? '✅ 완료' : '⏳ 대기'}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: darkMode ? '#1e293b' : '#f8fafc', borderRadius: 12, padding: 16, border: '1px solid ' + (darkMode ? '#334155' : '#e2e8f0') }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: darkMode ? '#e2e8f0' : '#334155' }}>🤖 AI 모델 설정</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {MODEL_OPTIONS.map(m => (
                      <button key={m.id} onClick={() => setCurrentModel(m.id)}
                        style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: currentModel === m.id ? 700 : 400,
                          background: currentModel === m.id ? '#4f46e5' : (darkMode ? '#334155' : 'white'),
                          color: currentModel === m.id ? 'white' : (darkMode ? '#e2e8f0' : '#64748b'),
                          border: '1px solid ' + (currentModel === m.id ? '#4f46e5' : (darkMode ? '#475569' : '#e2e8f0')) }}>
                        {m.label}
                        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{m.provider}</div>
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>현재 모델: {currentModel} · 모델 교체 시 주요 기능이 정상 구동됩니다</div>
                </div>
              </div>
            )}

            {activeTab === 'chat' && sessionId && <QAChatbot sessionId={sessionId} onAsk={handleAsk} />}
          </div>
        )}
      </main>
    </div>
  );
}
