import { useState } from 'react';
import FileUpload from './components/FileUpload';
import ClassifyResult from './components/ClassifyResult';
import WorkGraph from './components/WorkGraph';
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

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const TABS = [
  { id: 'graph', label: '🔗 관계도', step: 3 },
  { id: 'classify', label: '🏷️ 분류', step: 3 },
  { id: 'interview', label: '🎤 인터뷰', step: 4 },
  { id: 'calendar', label: '📅 캘린더', step: 5 },
  { id: 'handover', label: '📋 인수인계서', step: 6 },
  { id: 'chat', label: '💬 Q&A', step: 6 },
];

export default function App() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('upload');
  const [error, setError] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [classifyResult, setClassifyResult] = useState(null);
  const [interviewData, setInterviewData] = useState(null);
  const [calendarData, setCalendarData] = useState(null);
  const [handoverMd, setHandoverMd] = useState(null);
  const [activeTab, setActiveTab] = useState('graph');
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
      const cRes = await classifyFiles(upRes.session_id, 'groq', apiKey);
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

  const visibleTabs = TABS.filter((t) => t.step <= step);

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      {/* ─── 헤더 ─── */}
      <header style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
        color: 'white', padding: '20px 20px 0',
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
              <button onClick={() => setShowSettings(!showSettings)}
                style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.15)', color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                ⚙️
              </button>
              {step > 1 && (
                <button onClick={handleReset}
                  style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.15)', color: 'white',
                    border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                  🔄
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
                    background: activeTab === tab.id ? 'white' : 'transparent',
                    color: activeTab === tab.id ? '#1e3a5f' : 'rgba(255,255,255,0.7)',
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
                <div style={{ padding: 20, background: 'white', borderRadius: 12,
                  border: '1px solid #e5e7eb', marginBottom: 16 }}>
                  <WorkGraph categories={classifyResult.categories} relations={classifyResult.relations} />
                </div>
                {step === 3 && (
                  <div style={{ textAlign: 'center' }}>
                    <button onClick={handleInterview}
                      style={{ padding: '12px 32px', background: '#2563eb', color: 'white',
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
                <HandoverDoc markdown={handoverMd} />
                {/* 내보내기 버튼 */}
                <div style={{
                  display: 'flex', gap: 10, justifyContent: 'center',
                  marginTop: 16, padding: 16, background: 'white',
                  borderRadius: 12, border: '1px solid #e5e7eb',
                }}>
                  <button onClick={() => handleExport('docx')}
                    style={{ padding: '10px 24px', background: '#2563eb', color: 'white',
                      border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    📄 Word(.docx) 다운로드
                  </button>
                  <button onClick={() => handleExport('pdf')}
                    style={{ padding: '10px 24px', background: '#7c3aed', color: 'white',
                      border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    📕 PDF 다운로드
                  </button>
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
