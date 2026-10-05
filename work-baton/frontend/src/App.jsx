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
  const [role, setRole] = useState(null); // 'sender' | 'receiver'
  const [step, setStep] = useState(0);
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
    setStep(0); setRole(null); setSessionId(null); setParseResult(null);
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

  const SENDER_TABS = ['graph', 'classify', 'interview', 'handover', 'dashboard'];
  const RECEIVER_TABS = ['handover', 'calendar', 'chat', 'dashboard'];
  const allowedTabs = role === 'sender' ? SENDER_TABS : role === 'receiver' ? RECEIVER_TABS : TABS.map(t => t.id);
  const visibleTabs = TABS.filter((t) => t.step <= step && allowedTabs.includes(t.id));

  return (
    <div style={{ minHeight: '100vh', background: darkMode ? '#0f172a' : '#f3f4f6', color: darkMode ? '#e2e8f0' : '#1e293b', transition: 'all 0.3s' }}>
      {/* ─── 헤더 ─── */}
      <header style={{
        display: step === 0 ? 'none' : 'block',
        background: darkMode ? '#1e293b' : 'white', borderBottom: '1px solid ' + (darkMode ? '#334155' : '#e2e8f0'),
        color: darkMode ? '#e2e8f0' : '#1e293b', padding: '20px 20px 0',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 2px' }}>🏃 업무바통
              {role && <span style={{ fontSize: 11, marginLeft: 8, padding: '2px 8px', borderRadius: 10,
                background: role === 'sender' ? '#eef2ff' : '#ecfdf5',
                color: role === 'sender' ? '#4f46e5' : '#10b981' }}>
                {role === 'sender' ? '📤 전임자' : '📥 후임자'}
              </span>}
            </h1>
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
            <div style={{ display: 'flex', gap: 4, paddingTop: 8, background: darkMode ? '#0f172a' : '#f8fafc', borderRadius: '12px 12px 0 0', padding: '6px 8px 0' }}>
              {visibleTabs.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '8px 14px', fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
                    background: activeTab === tab.id ? (darkMode ? '#312e81' : 'white') : 'transparent',
                    boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                    color: activeTab === tab.id ? (darkMode ? '#a5b4fc' : '#4f46e5') : (darkMode ? '#94a3b8' : '#64748b'),
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

        {/* Step 0: 역할 선택 */}
        {step === 0 && !loading && (
          <div style={{ paddingTop: 40, maxWidth: 640, margin: '0 auto' }}>
            {/* 히어로 섹션 */}
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 72, height: 72, borderRadius: 20, marginBottom: 20,
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                boxShadow: '0 8px 24px rgba(79, 70, 229, 0.25)' }}>
                <span style={{ fontSize: 36 }}>🏃</span>
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10,
                color: darkMode ? '#f1f5f9' : '#0f172a', letterSpacing: '-0.5px' }}>
                업무바통
              </h2>
              <p style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.7, marginBottom: 0 }}>
                전임자는 전화 안 받아도 되고<br/>후임자는 전화 안 해도 되는
              </p>
            </div>

            {/* 카드 선택 */}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              {/* 전임자 카드 */}
              <button onClick={() => { setRole('sender'); setStep(1); }}
                style={{ width: 290, padding: 0, borderRadius: 20, cursor: 'pointer',
                  background: darkMode ? '#1e293b' : 'white', border: 'none',
                  boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)',
                  transition: 'all 0.25s ease', overflow: 'hidden', textAlign: 'left' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(79,70,229,0.15)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)'; }}>
                {/* 카드 상단 그라데이션 */}
                <div style={{ padding: '28px 24px 20px', background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                      boxShadow: '0 2px 8px rgba(79,70,229,0.12)' }}>📤</div>
                    <div>
                      <div style={{ fontSize: 19, fontWeight: 800, color: '#1e293b' }}>전임자</div>
                      <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>바통 넘기기</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                    업무 폴더만 올리면 AI가<br/>인수인계서를 자동으로 만들어요
                  </div>
                </div>
                {/* 카드 하단 단계 */}
                <div style={{ padding: '16px 24px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {['업로드', '인터뷰', '완료'].map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', fontSize: 10, fontWeight: 700,
                          background: darkMode ? '#312e81' : '#eef2ff', color: darkMode ? '#a5b4fc' : '#4f46e5', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i+1}</div>
                        <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{s}</span>
                        {i < 2 && <span style={{ color: darkMode ? '#64748b' : '#cbd5e1', fontSize: 10 }}>→</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </button>

              {/* 후임자 카드 */}
              <button onClick={() => { setRole('receiver'); setStep(1); }}
                style={{ width: 290, padding: 0, borderRadius: 20, cursor: 'pointer',
                  background: darkMode ? '#1e293b' : 'white', border: 'none',
                  boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)',
                  transition: 'all 0.25s ease', overflow: 'hidden', textAlign: 'left' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(16,185,129,0.15)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)'; }}>
                <div style={{ padding: '28px 24px 20px', background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                      boxShadow: '0 2px 8px rgba(16,185,129,0.12)' }}>📥</div>
                    <div>
                      <div style={{ fontSize: 19, fontWeight: 800, color: '#1e293b' }}>후임자</div>
                      <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>바통 받기</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                    인수인계서를 받아 업무를 파악하고<br/>Q&A로 궁금한 점을 해결하세요
                  </div>
                </div>
                <div style={{ padding: '16px 24px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {['접속', '학습', 'Q&A'].map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', fontSize: 10, fontWeight: 700,
                          background: darkMode ? '#064e3b' : '#ecfdf5', color: darkMode ? '#6ee7b7' : '#10b981', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i+1}</div>
                        <span style={{ fontSize: 12, color: darkMode ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap' }}>{s}</span>
                        {i < 2 && <span style={{ color: darkMode ? '#64748b' : '#cbd5e1', fontSize: 10 }}>→</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </button>
            </div>

            {/* 하단 안내 */}
            <div style={{ textAlign: 'center', marginTop: 40 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 20,
                background: darkMode ? '#1e293b' : '#f8fafc', fontSize: 12, color: '#94a3b8' }}>
                <span>🤖</span> AI가 파일을 분석하고, 빈틈을 찾고, 인수인계서를 작성합니다
              </div>
            </div>
          </div>
        )}

        {/* Step 1: 전임자=파일업로드, 후임자=세션코드 입력 */}
        {step === 1 && !loading && role === 'sender' && (
          <FileUpload onUpload={handleUploadAndClassify} loading={loading} />
        )}
        {step === 1 && !loading && role === 'receiver' && (
          <div style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📥</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: darkMode ? '#e2e8f0' : '#1e293b' }}>
              인수인계 세션에 접속하세요
            </h2>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>
              전임자에게 받은 세션 코드를 입력하세요
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <input id="session-input" type="text" placeholder="세션 코드 (예: a1b2c3d4)"
                style={{ padding: '12px 16px', borderRadius: 10, border: '2px solid ' + (darkMode ? '#475569' : '#e2e8f0'),
                  fontSize: 15, width: 240, textAlign: 'center', background: darkMode ? '#1e293b' : 'white',
                  color: darkMode ? '#e2e8f0' : '#1e293b' }} />
              <button onClick={async () => {
                const code = document.getElementById('session-input').value.trim();
                if (!code) return alert('세션 코드를 입력하세요');
                try {
                  setLoading(true);
                  const res = await fetch('/api/baton/session/' + code);
                  if (!res.ok) throw new Error('세션을 찾을 수 없습니다');
                  const data = await res.json();
                  setSessionId(code);
                  if (data.categories) { setClassifyResult(data); setStep(3); }
                  if (data.calendar) { setCalendarData(data.calendar); setStep(5); }
                  if (data.handover_markdown) { setHandoverMd(data.handover_markdown); setStep(6); setActiveTab('handover'); }
                  if (!data.handover_markdown && !data.categories) { throw new Error('전임자가 아직 인수인계를 완료하지 않았습니다'); }
                } catch (e) { alert(e.message); }
                finally { setLoading(false); }
              }}
                style={{ padding: '12px 24px', background: '#10b981', color: 'white',
                  border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                접속
              </button>
            </div>
            <div style={{ marginTop: 32, padding: 16, background: darkMode ? '#1e293b' : '#f8fafc',
              borderRadius: 12, border: '1px solid ' + (darkMode ? '#334155' : '#e2e8f0'), textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: darkMode ? '#e2e8f0' : '#334155' }}>💡 사용 방법</div>
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
                1. 전임자가 업무바통에서 인수인계를 완료하면 세션 코드가 생성돼요<br/>
                2. 세션 코드를 입력하면 인수인계서, 캘린더, Q&A를 바로 이용할 수 있어요<br/>
                3. 궁금한 건 Q&A 탭에서 전임자 자료를 기반으로 질문하세요
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 20 }}>
              세션 코드가 없으면? <button onClick={() => { setRole('sender'); }}
                style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                전임자로 먼저 시작하기
              </button>
            </p>
          </div>
        )}

        {/* Step 3+ */}
        {step >= 3 && !loading && (
          <div>
            {activeTab === 'graph' && classifyResult && (
              <div>
                <div style={{ padding: 20, background: darkMode ? '#1e293b' : 'white', borderRadius: 12,
                  border: '1px solid ' + (darkMode ? '#334155' : '#e5e7eb'), marginBottom: 16 }}>
                  <StakeholderMap categories={classifyResult.categories} relations={classifyResult.relations} />
                </div>
                {step === 3 && role === 'sender' && (
                  <div style={{ textAlign: 'center' }}>
                    <button onClick={handleInterview}
                      style={{ padding: '12px 32px', background: '#2563eb', color: 'white',
                        border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                      🎤 다음: AI가 빈틈을 찾아 질문합니다
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
                {/* 완료 축하 배너 — 전임자만 */}
                {role === 'sender' && <div style={{
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  borderRadius: 16, padding: 24, color: 'white', marginBottom: 16,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>인수인계서가 완성되었습니다!</div>
                  <div style={{ fontSize: 13, opacity: 0.85 }}>
                    후임자에게 세션 코드를 전달하면 바로 업무를 파악할 수 있어요
                  </div>
                </div>}

                <HandoverDoc markdown={handoverMd} sessionId={sessionId} />
                {/* 내보내기 버튼 */}
                <div style={{
                  display: 'flex', gap: 10, justifyContent: 'center',
                  marginTop: 16, padding: 16, background: darkMode ? '#1e293b' : 'white',
                  borderRadius: 12, border: '1px solid ' + (darkMode ? '#334155' : '#e5e7eb'),
                }}>
                  <button onClick={() => handleExport('docx')}
                    style={{ padding: '10px 24px', background: '#2563eb', color: 'white',
                      border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    📄 Word(.docx) 다운로드
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(sessionId); alert('세션 코드 복사됨: ' + sessionId); }}
                    style={{ padding: '10px 24px', background: '#10b981', color: 'white',
                      border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    🔗 후임자에게 전달 (코드: {sessionId})
                  </button>
                  <button onClick={() => handleExport('pdf')}
                    style={{ padding: '10px 24px', background: '#7c3aed', color: 'white',
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
