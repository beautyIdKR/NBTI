'use client';

import { useState, useRef, useMemo } from 'react';
import { analyzeStep1, analyzeStep2 } from '@/app/utils/nbtiLogic';
import type { Step2ResultType } from '@/app/utils/nbtiLogic';
import Step1Result from '@/app/components/nbti/Step1Result';
import Step2Result from '@/app/components/nbti/Step2Result';

// --- [상수 및 설정] ---
const STEPS = {
  INTRO: 'INTRO',
  STEP1_GUIDE: 'STEP1_GUIDE',
  STEP1_COMPARE: 'STEP1_COMPARE',
  STEP1_ANALYSIS: 'STEP1_ANALYSIS',
  STEP1_RESULT: 'STEP1_RESULT',
  STEP2_GUIDE: 'STEP2_GUIDE',
  STEP2_COMPARE: 'STEP2_COMPARE',
  STEP2_ANALYSIS: 'STEP2_ANALYSIS',
  FINAL_RESULT: 'FINAL_RESULT',
};

const STEP_TITLES: Record<string, string> = {
  STEP1_GUIDE: '촬영 가이드',
  STEP1_COMPARE: '사진 확인',
  STEP1_ANALYSIS: 'AI 분석 중',
  STEP1_RESULT: '1단계 결과',
  STEP2_GUIDE: '촬영 가이드',
  STEP2_COMPARE: '사진 확인',
  STEP2_ANALYSIS: 'AI 분석 중',
  FINAL_RESULT: '최종 결과',
};

const CHECK_QUESTIONS = {
  STEP1: [
    "1. 카드가 사진 안에 다 나오나요?",
    "2. 손톱 4개가 다 나오나요?",
    "3. 탑뷰(위에서) 촬영했나요?"
  ],
  STEP2: [
    "1. 터널 모양(∩)이 보이나요?",
    "2. 초점이 잘 맞았나요?",
    "3. 손가락이 중앙에 있나요?"
  ]
};

interface ServerResponse {
  status: string;
  measurements: Record<string, { w: number; h: number; curvature?: number }>;
  processed_image: string;
  vis_image?: string;
  message?: string;
  error_code?: string;
}

export default function NBTIPage() {
  const [currentStep, setCurrentStep] = useState(STEPS.INTRO);
  const [history, setHistory] = useState<string[]>([]);
  const [imgSrc1, setImgSrc1] = useState<string | null>(null);
  const [imgSrc2, setImgSrc2] = useState<string | null>(null);
  const [serverResult, setServerResult] = useState<ServerResponse | null>(null);
  const [serverResult2, setServerResult2] = useState<ServerResponse | null>(null);
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);
  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  const isAllChecked = checks.every(Boolean);

  // 🌟 nbtiLogic 연결
  const nbtiStep1Data = useMemo(() => {
    if (!serverResult?.measurements) return null;
    try { return analyzeStep1(serverResult.measurements); } catch (e) { console.error(e); return null; }
  }, [serverResult]);

  const nbtiStep2Data = useMemo(() => {
    if (!serverResult2?.measurements) return null;
    try { return analyzeStep2(serverResult2.measurements); } catch (e) { console.error(e); return null; }
  }, [serverResult2]);

  // --- [네비게이션] ---
  const goStep = (step: string) => { setHistory(prev => [...prev, currentStep]); setCurrentStep(step); setChecks([false, false, false]); setAnalysisDone(false); };
  const goBack = () => { if (history.length > 0) { setCurrentStep(history[history.length - 1]); setHistory(prev => prev.slice(0, -1)); }};
  const toggleCheck = (i: number) => setChecks(prev => prev.map((v, idx) => idx === i ? !v : v));

  // --- [카메라/이미지] ---
  const triggerCamera = (step: number) => { step === 1 ? fileInputRef1.current?.click() : fileInputRef2.current?.click(); };
  const compressImage = (file: File, maxW = 1280): Promise<string> => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = img.width > maxW ? maxW / img.width : 1;
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, step: number) => {
    const file = e.target.files?.[0]; if (!file) return;
    const compressed = await compressImage(file);
    if (step === 1) { setImgSrc1(compressed); goStep(STEPS.STEP1_COMPARE); }
    else { setImgSrc2(compressed); goStep(STEPS.STEP2_COMPARE); }
    e.target.value = '';
  };

  // --- [AI 분석] ---
  const analyzeImage = async (imgDataUrl: string, step: 'step1' | 'step2' = 'step1'): Promise<any> => {
    try {
      console.log(`[analyzeImage] 시작 - step: ${step}`);
      const response = await fetch(imgDataUrl);
      const blob = await response.blob();
      console.log(`[analyzeImage] Blob: size=${blob.size}`);
      if (blob.size === 0) return null;
      const formData = new FormData();
      formData.append("file", blob, "left4.jpeg");
      const proxyUrl = step === 'step2' ? '/api/proxy?step=step2' : '/api/proxy';
      const serverRes = await fetch(proxyUrl, { method: 'POST', body: formData });
      const data = await serverRes.json();
      console.log(`[analyzeImage] 응답:`, JSON.stringify(data).substring(0, 200));
      return data;
    } catch (error: any) { console.error(`[analyzeImage] 에러:`, error.message); return null; }
  };

  const startRealAnalysis = async (nextStep: string) => {
    if (!isAllChecked) return;
    goStep(nextStep);
    setIsAnalyzing(true);
    setAnalysisDone(false);

    const isStep1 = nextStep === STEPS.STEP1_ANALYSIS;
    const imgSrc = isStep1 ? imgSrc1 : imgSrc2;
    const stepKey = isStep1 ? 'step1' : 'step2';
    const compareStep = isStep1 ? STEPS.STEP1_COMPARE : STEPS.STEP2_COMPARE;

    if (imgSrc) {
      const result = await analyzeImage(imgSrc, stepKey as 'step1' | 'step2');
      if (result && result.status === 'success') {
        isStep1 ? setServerResult(result) : setServerResult2(result);
        setAnalysisDone(true);
        setIsAnalyzing(false);
      } else if (result && result.status === 'error') {
        setIsAnalyzing(false);
        const ec = result.error_code || '';
        let msg = result.message || '분석에 실패했습니다.';
        if (ec === 'NOTHING_DETECTED') msg = isStep1
          ? '⚠️ 카드와 손톱이 모두 감지되지 않았습니다.\n\n카드 위에 왼손 네 손가락을 올리고\n다시 촬영해주세요.'
          : '⚠️ 손톱이 감지되지 않았습니다.\n\n손톱 끝의 터널 모양(∩)이 보이도록\n다시 촬영해주세요.';
        else if (ec === 'NO_CARD') msg = '⚠️ 카드가 감지되지 않았습니다.\n\n카드 전체가 사진 안에 보이도록\n다시 촬영해주세요.';
        else if (ec === 'INSUFFICIENT_NAILS' || ec === 'MISSING_KEY_NAILS') msg = '⚠️ 손톱이 정확히 감지되지 않았습니다.\n\n4개의 손톱이 모두 선명하게 보이도록\n다시 촬영해주세요.';
        else if (ec === 'ANALYSIS_FAILED') msg = '⚠️ AI 분석 중 오류가 발생했습니다.\n\n다시 촬영해주세요.';
        alert(msg);
        setCurrentStep(compareStep);
        setHistory(prev => prev.filter(s => s !== nextStep));
        setChecks([false, false, false]);
      } else {
        setIsAnalyzing(false);
        alert('⚠️ 서버 연결에 실패했습니다.\n잠시 후 다시 시도해주세요.');
        setCurrentStep(compareStep);
        setHistory(prev => prev.filter(s => s !== nextStep));
        setChecks([false, false, false]);
      }
    }
  };

  // =========================================================
  // RENDER
  // =========================================================
  const C = {
    pink: '#F06292',
    pinkDark: '#D94040',
    pinkLight: '#EFDEDE',
    pinkBg: '#FFF5F7',
    pinkGrad: 'linear-gradient(135deg, #F8787C 0%, #F06292 100%)',
    coral: '#F8787C',
    headerBg: '#FAF5F5',
    headerText: '#E8D5C4',
    textDark: '#333',
    textMid: '#666',
    textLight: '#999',
    bg: '#FAF5F5',
    white: '#fff',
    border: '#F0E8E4',
    checkGreen: '#E8685A',
  };

  return (
    <div style={{ width: '100%', maxWidth: '420px', height: '100dvh', backgroundColor: C.white, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', margin: '0 auto' }}>

      {/* 글로벌 스타일 + 폰트 */}
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansBold.woff2');
        @import url('https://cdn.jsdelivr.net/gh/sunn-us/SUIT/fonts/variable/woff2/SUIT-Variable.css');
        @font-face { font-family: 'yg-jalnan'; src: url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_four@1.2/JalnanGothic.woff') format('woff'); font-weight: normal; font-style: normal; }
        * { font-family: 'SUIT Variable', 'SUIT', -apple-system, sans-serif; }
        .font-jalnan { font-family: 'yg-jalnan', 'SUIT Variable', sans-serif !important; }
        @keyframes scan { 0% { top: 0%; opacity: 0.5; } 50% { top: 100%; opacity: 1; } 100% { top: 0%; opacity: 0.5; } }
        .scanner-line { position: absolute; width: 100%; height: 3px; background: #00E676; box-shadow: 0 0 15px #00E676; animation: scan 2s linear infinite; z-index: 20; }
        .scan-overlay { background: linear-gradient(180deg, rgba(0,230,118,0.08) 0%, rgba(0,0,0,0) 50%, rgba(0,230,118,0.08) 100%); position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 15; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.5s ease-out; }
      `}</style>

      <input type="file" accept="image/*" capture="environment" ref={fileInputRef1} onChange={(e) => handleFileChange(e, 1)} style={{display:'none'}} />
      <input type="file" accept="image/*" capture="environment" ref={fileInputRef2} onChange={(e) => handleFileChange(e, 2)} style={{display:'none'}} />

      {/* ====== 헤더 ====== */}
      {currentStep !== STEPS.INTRO && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '48px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 12px', zIndex: 100, background: C.headerBg, borderBottom: `0px solid ${C.border}`,
        }}>
          <button onClick={goBack} style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <span style={{ fontSize: '20px', fontWeight: '800', color: C.textDark }}>
            {analysisDone && currentStep.includes('ANALYSIS') ? 'AI 분석완료' : STEP_TITLES[currentStep]}
          </span>
          <span style={{ fontSize: '12px', color: C.coral, fontWeight: '600', padding: '8px', cursor: 'pointer' }}>
            {currentStep.includes('STEP2') || currentStep === STEPS.FINAL_RESULT ? '멘탈유형' : '성격유형'}
          </span>
        </div>
      )}

      {/* ====== 메인 스크롤 영역 ====== */}
      <div style={{
        flex: 1, overflowY: 'auto', width: '100%',
        paddingTop: currentStep === STEPS.INTRO ? 0 : '48px',
        background: currentStep === STEPS.INTRO ? C.pinkBg : C.bg,
        WebkitOverflowScrolling: 'touch',
      }}>
       <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', paddingBottom: '20px' }}>

        {/* ===== A. INTRO (시작하기) ===== */}
        {currentStep === STEPS.INTRO && (
          <div style={{
            background: `linear-gradient(180deg, ${C.pinkBg} 0%, #FFE4E8 60%, ${C.pinkBg} 100%)`,
            minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '50px 24px 120px',
          }}>
            {/* 타이틀 */}
            <h1 className="font-jalnan" style={{ fontSize: '20px', color: C.pinkDark, marginBottom: '28px', letterSpacing: '-0.5px' }}>
              손톱으로 몰랐던 내 성격 알아보기
            </h1>

            {/* 메인 로고 이미지 */}
            <div style={{ marginBottom: '28px', width: '260px', textAlign: 'center' }}>
              <img src="/images/nbti/nbti_logo.png" alt="Nail NBTI Test"
                style={{ width: '100%', height: 'auto' }}
                onError={(e) => {
                  // 이미지 없으면 텍스트 대체
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = `
                    <div style="text-align:center">
                      <div style="font-size:18px;color:#E8685A;font-weight:900;margin-bottom:4px">Nail</div>
                      <div style="font-size:42px;font-weight:900;color:#D94040;letter-spacing:-2px">NBTI</div>
                      <div style="font-size:18px;color:#E8685A;font-weight:900">Test</div>
                    </div>`;
                }}
              />
            </div>

            {/* 설명 */}
            <p style={{ textAlign: 'center', color: C.textDark, fontSize: '14px', lineHeight: '1.7', marginBottom: '32px', letterSpacing: '-0.3px' }}>
              영국 존 매닝 교수의 <b>2D:4D이론</b>을 적용하여<br/>
              <b>손톱AI 분석 기술로 성향을 분석</b>할 수 있어요!
            </p>

            {/* Step 카드 2개 */}
            <div style={{ display: 'flex', gap: '12px', width: '100%', marginBottom: '20px' }}>
              {/* Step 1 카드 */}
              <div style={{
                flex: 1, background: C.white, borderRadius: '16px', padding: '20px 14px',
                textAlign: 'center', border: `1.5px solid ${C.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  display: 'inline-block', border: `2px solid ${C.pinkDark}`, borderRadius: '20px',
                  padding: '3px 14px', fontSize: '13px', fontWeight: '800', color: C.pinkDark, marginBottom: '12px',
                }}>step.1</div>
                <p style={{ fontSize: '11px', color: C.textLight, marginBottom: '4px', fontStyle: 'italic' }}>Social Persona</p>
                <p style={{ fontSize: '14px', fontWeight: '700', color: C.textDark, marginBottom: '8px', lineHeight: '1.4' }}>내 손톱에 맞는<br/>캐릭터는?</p>
                <p style={{ fontSize: '12px', color: C.textMid }}>왼손톱 Top View 분석</p>
              </div>
              {/* Step 2 카드 */}
              <div style={{
                flex: 1, background: C.white, borderRadius: '16px', padding: '20px 14px',
                textAlign: 'center', border: `1.5px solid ${C.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  display: 'inline-block', border: `2px solid ${C.textMid}`, borderRadius: '20px',
                  padding: '3px 14px', fontSize: '13px', fontWeight: '800', color: C.textMid, marginBottom: '12px',
                }}>step.2</div>
                <p style={{ fontSize: '11px', color: C.textLight, marginBottom: '4px', fontStyle: 'italic' }}>Hidden Ego</p>
                <p style={{ fontSize: '14px', fontWeight: '700', color: C.textDark, marginBottom: '8px', lineHeight: '1.4' }}>내 멘탈은<br/>얼마나 강할까?</p>
                <p style={{ fontSize: '12px', color: C.textMid }}>왼손톱 Front View 분석</p>
              </div>
            </div>
          </div>
        )}

        {/* ===== B. STEP1 촬영 가이드 ===== */}
        {currentStep === STEPS.STEP1_GUIDE && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* 상단 안내 */}
            <div style={{ textAlign: 'center', padding: '24px 20px 16px' }}>
              <p style={{ fontSize: '15px', color: C.textDark, lineHeight: '1.6' }}>
                카드 위에 <span style={{ fontWeight: '800', color: C.textDark }}>왼손 네 손톱</span>을 올려주세요.
              </p>
            </div>

            {/* 가이드 이미지 */}
            <div style={{ width: 'calc(100% - 40px)', margin: '0 20px 24px', borderRadius: '16px', overflow: 'hidden', background: C.pinkLight }}>
              <img src="/images/nbti/left4Guide.jpg" alt="촬영가이드"
                style={{ width: '100%', display: 'block' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).parentElement!.style.height = '220px';
                  (e.target as HTMLImageElement).parentElement!.style.display = 'flex';
                  (e.target as HTMLImageElement).parentElement!.style.alignItems = 'center';
                  (e.target as HTMLImageElement).parentElement!.style.justifyContent = 'center';
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<span style="font-size:48px">📸</span>';
                }}
              />
            </div>

            {/* 가이드 설명 카드 */}
            <div style={{
              width: 'calc(100% - 40px)', margin: '0 20px',
              background: C.pinkLight, borderRadius: '16px', padding: '24px 20px',
            }}>
              {[
                { n: '1', text: <>카드 위에 <b style={{color: C.pinkDark}}>네 손가락을 밀착</b>해주세요.</> },
                { n: '2', text: <>모든 손톱이 <b>정면</b>으로 보이도록 조정하고,<br/>특히 <b style={{color: C.pinkDark}}>새끼 손톱</b>이 잘 보이도록 유의해 주세요.</> },
                { n: '3', text: <>카드와 손톱이 <b>모두 화면에 보이도록</b> 하고,<br/><b style={{color: C.pinkDark}}>손톱에 초점</b>을 맞춰 촬영해 주세요.</> },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: i < 2 ? '18px' : 0 }}>
                  <div style={{
                    minWidth: '28px', height: '28px', borderRadius: '50%',
                    background: C.coral, color: C.white,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: '800', fontSize: '14px', marginRight: '12px', marginTop: '1px', flexShrink: 0,
                  }}>{item.n}</div>
                  <span style={{ fontSize: '14px', color: C.textDark, lineHeight: '1.6' }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== C. STEP1 사진확인 (COMPARE) ===== */}
        {currentStep === STEPS.STEP1_COMPARE && (
          <div className="fade-in">
            <div style={{ textAlign: 'center', padding: '20px 20px 12px' }}>
              <p style={{ fontSize: '15px', color: C.textDark, fontWeight: '500' }}>선명하게 잘 나왔나요?</p>
            </div>

            {/* 사진 비교 */}
            <div style={{ display: 'flex', gap: '10px', padding: '0 20px', marginBottom: '16px' }}>
              {/* 잘된사진 */}
              <div style={{ flex: 1 }}>
                <div style={{
                  background: '#4A90A4', borderRadius: '12px 12px 0 0', padding: '8px',
                  textAlign: 'center', color: C.white, fontSize: '13px', fontWeight: '700',
                }}>잘된사진</div>
                <div style={{ aspectRatio: '3/4', borderRadius: '0 0 12px 12px', overflow: 'hidden', border: `1px solid ${C.border}`, borderTop: 'none' }}>
                  <img src="/images/nbti/left4Good.jpg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="잘된사진"
                    onError={(e) => { (e.target as HTMLImageElement).style.background = '#f0f0f0'; }}
                  />
                </div>
              </div>
              {/* 내 사진 */}
              <div style={{ flex: 1 }}>
                <div style={{
                  background: C.coral, borderRadius: '12px 12px 0 0', padding: '8px',
                  textAlign: 'center', color: C.white, fontSize: '13px', fontWeight: '700',
                }}>내 사진</div>
                <div style={{ aspectRatio: '3/4', borderRadius: '0 0 12px 12px', overflow: 'hidden', border: `1px solid ${C.border}`, borderTop: 'none' }}>
                  <img src={imgSrc1!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="내사진" />
                </div>
              </div>
            </div>

            {/* 체크리스트 */}
            <div style={{
              margin: '0 20px', background: C.white, borderRadius: '16px', backgroundColor: C.pinkLight,
              border: `1px solid ${C.border}`, overflow: 'hidden',
            }}>
              <div style={{ padding: '16px 20px 8px', borderBottom: `1px solid ${C.border}` }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: C.textDark, margin: 0, textAlign: 'center' }}>체크리스트</h3>
              </div>
              {CHECK_QUESTIONS.STEP1.map((q, i) => (
                <div key={i} onClick={() => toggleCheck(i)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', borderBottom: i < 2 ? `1px solid ${C.border}` : 'none',
                  cursor: 'pointer',
                }}>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: C.textDark }}>{q}</span>
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, marginLeft: '12px',
                    background: checks[i] ? C.coral : '#ccc3c3',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#eeecec" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== D. AI 분석중 / 분석완료 ===== */}
        {(currentStep === STEPS.STEP1_ANALYSIS || currentStep === STEPS.STEP2_ANALYSIS) && (
          <>
            <div style={{ padding: '20px 20px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: C.textMid }}>
                {analysisDone ? '데이터 분석이 끝났습니다.' : 'AI가 손톱을 정밀 분석하고 있습니다.'}
              </p>
            </div>

            {/* 이미지 + 스캔 애니메이션 */}
            <div style={{
              margin: '0 20px', borderRadius: '16px', overflow: 'hidden',
              background: analysisDone ? '#1a1a1a' : '#f5f5f5',
              border: analysisDone ? '2px solid #333' : `2px solid ${C.border}`,
              position: 'relative',
              maxHeight: analysisDone ? '300px' : '400px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img
                src={
                  analysisDone && currentStep === STEPS.STEP1_ANALYSIS && serverResult
                    ? (serverResult.vis_image || serverResult.processed_image)
                    : analysisDone && currentStep === STEPS.STEP2_ANALYSIS && serverResult2
                    ? (serverResult2.vis_image || serverResult2.processed_image)
                    : (currentStep === STEPS.STEP1_ANALYSIS ? imgSrc1! : imgSrc2!)
                }
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              {!analysisDone && (
                <>
                  <div className="scanner-line"></div>
                  <div className="scan-overlay"></div>
                  <div style={{ position: 'absolute', bottom: '20px', width: '100%', textAlign: 'center', color: '#00E676', fontWeight: '700', fontSize: '14px', textShadow: '0 1px 4px rgba(0,0,0,0.6)', letterSpacing: '1px' }}>
                    AI Analyzing...
                  </div>
                </>
              )}
            </div>

            {/* Step1 실측데이터 */}
            {analysisDone && currentStep === STEPS.STEP1_ANALYSIS && serverResult?.measurements && nbtiStep1Data && (
              <div className="fade-in" style={{ margin: '20px', background: C.pinkLight, borderRadius: '16px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px 10px', borderBottom: `1px solid ${C.border}` }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: C.textDark, margin: 0, textAlign: 'center' }}>실측 데이터 (mm)</h3>
                </div>
                {[
                  { key: 'Index', label: '검지손톱' },
                  { key: 'Middle', label: '중지손톱' },
                  { key: 'Ring', label: '약지손톱' },
                  { key: 'Pinky', label: '소지손톱' },
                ].map((item, i) => (
                  <div key={item.key} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 20px', borderBottom: i < 3 ? `1px solid ${C.border}` : 'none',
                  }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: C.textDark }}>{item.label}</span>
                    <span style={{ fontSize: '14px', color: C.textMid }}>
                      W : {serverResult.measurements[item.key]?.w?.toFixed(2) || '0.00'}  |  H : {serverResult.measurements[item.key]?.h?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                ))}
                {/* 2D:4D 비율 */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 20px', borderTop: `1.5px solid ${C.textDark}`, background: '#EFDEDE',
                }}>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: C.textDark }}>검지 : 약지 비율(2D:4D)</span>
                  <span style={{ fontSize: '18px', fontWeight: '800', color: C.pinkDark }}>{nbtiStep1Data.ratio}</span>
                </div>
              </div>
            )}

            {/* Step2 곡률 데이터 */}
            {analysisDone && currentStep === STEPS.STEP2_ANALYSIS && serverResult2?.measurements && nbtiStep2Data && (
              <div className="fade-in" style={{ margin: '20px', background: C.pinkLight, borderRadius: '16px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px 10px', borderBottom: `1px solid ${C.border}` }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: C.textDark, margin: 0, textAlign: 'center' }}>곡률 분석 데이터</h3>
                </div>
                {[
                  { key: 'Index', label: '검지손톱' },
                  { key: 'Middle', label: '중지손톱' },
                  { key: 'Ring', label: '약지손톱' },
                  { key: 'Pinky', label: '소지손톱' },
                ].map((item, i) => (
                  <div key={item.key} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 20px', borderBottom: `1px solid ${C.border}`,
                  }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: C.textDark }}>{item.label}</span>
                    <span style={{ fontSize: '14px', color: C.textMid }}>
                      곡률 : {serverResult2.measurements[item.key]?.curvature?.toFixed(4) || '0.0000'}
                    </span>
                  </div>
                ))}
                {/* 평균 곡률 */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.pinkLight,
                }}>
                  <span style={{ fontSize: '16px', fontWeight: '800', color: C.textDark }}>평균 곡률</span>
                  <span style={{ fontSize: '16px', fontWeight: '800', color: C.textDark }}>{nbtiStep2Data.avgCurvature}</span>
                </div>
                {/* 진단 유형 */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 20px', background: C.pinkLight,
                }}>
                  <span style={{ fontSize: '16px', fontWeight: '800', color: C.textDark }}>진단 유형</span>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: C.pinkDark }}>
                    {nbtiStep2Data.name} ({nbtiStep2Data.curvatureLevel})
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== E. STEP2 GUIDE ===== */}
        {currentStep === STEPS.STEP2_GUIDE && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* 상단 안내 */}
            <div style={{ textAlign: 'center', padding: '24px 20px 16px' }}>
              <p style={{ fontSize: '15px', color: C.textDark, lineHeight: '1.6' }}>
                <span style={{ fontWeight: '800', color: C.textDark }}>손톱 끝 터널</span>이 보이게 해주세요.
              </p>
            </div>

            {/* 가이드 이미지 */}
            <div style={{ width: 'calc(100% - 40px)', margin: '0 20px 24px', borderRadius: '16px', overflow: 'hidden', background: C.pinkLight }}>
              <img src="/images/nbti/front4Guide.jpg" alt="촬영가이드"
                style={{ width: '100%', display: 'block' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).parentElement!.style.height = '220px';
                  (e.target as HTMLImageElement).parentElement!.style.display = 'flex';
                  (e.target as HTMLImageElement).parentElement!.style.alignItems = 'center';
                  (e.target as HTMLImageElement).parentElement!.style.justifyContent = 'center';
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<span style="font-size:48px">📸</span>';
                }}
              />
            </div>

            {/* 가이드 설명 카드 */}
            <div style={{
              width: 'calc(100% - 40px)', margin: '0 20px',
              background: C.pinkLight, borderRadius: '16px', padding: '24px 20px',
            }}>
              {[
                { n: '1', text: <><b style={{color: C.pinkDark}}>카드는 필요하지 않습니다.</b></> },
                { n: '2', text: <>엄지를 제외한 왼손 <b>네 손톱 끝 곡률선</b>이<br/><b style={{color: C.pinkDark}}>위로 볼록하게</b> 보이도록 촬영해 주세요.</> },
                { n: '3', text: <>손톱이 <b>모두 화면에 보이도록</b> 하고,<br/><b style={{color: C.pinkDark}}>손톱에 초점</b>을 맞춰 촬영해 주세요.</> },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: i < 2 ? '18px' : 0 }}>
                  <div style={{
                    minWidth: '28px', height: '28px', borderRadius: '50%',
                    background: C.coral, color: C.white,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: '800', fontSize: '14px', marginRight: '12px', marginTop: '1px', flexShrink: 0,
                  }}>{item.n}</div>
                  <span style={{ fontSize: '14px', color: C.textDark, lineHeight: '1.6' }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== F. STEP2 COMPARE ===== */}
        {currentStep === STEPS.STEP2_COMPARE && (
          <div className="fade-in">
            <div style={{ textAlign: 'center', padding: '20px 20px 12px' }}>
              <p style={{ fontSize: '15px', color: C.textDark, fontWeight: '500' }}>선명하게 잘 나왔나요?</p>
            </div>

            {/* 사진 비교 */}
            <div style={{ display: 'flex', gap: '10px', padding: '0 20px', marginBottom: '16px' }}>
              {/* 잘된사진 */}
              <div style={{ flex: 1 }}>
                <div style={{
                  background: '#4A90A4', borderRadius: '12px 12px 0 0', padding: '8px',
                  textAlign: 'center', color: C.white, fontSize: '13px', fontWeight: '700',
                }}>잘된사진</div>
                <div style={{ aspectRatio: '3/4', borderRadius: '0 0 12px 12px', overflow: 'hidden', border: `1px solid ${C.border}`, borderTop: 'none' }}>
                  <img src="/images/nbti/front4Good.jpg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="잘된사진"
                    onError={(e) => { 
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).parentElement!.style.background = '#f0f0f0';
                      (e.target as HTMLImageElement).parentElement!.style.display = 'flex';
                      (e.target as HTMLImageElement).parentElement!.style.alignItems = 'center';
                      (e.target as HTMLImageElement).parentElement!.style.justifyContent = 'center';
                      (e.target as HTMLImageElement).parentElement!.innerHTML = '<span style="color:#999;font-size:13px">가이드 사진</span>';
                    }}
                  />
                </div>
              </div>
              {/* 내 사진 */}
              <div style={{ flex: 1 }}>
                <div style={{
                  background: C.coral, borderRadius: '12px 12px 0 0', padding: '8px',
                  textAlign: 'center', color: C.white, fontSize: '13px', fontWeight: '700',
                }}>내 사진</div>
                <div style={{ aspectRatio: '3/4', borderRadius: '0 0 12px 12px', overflow: 'hidden', border: `1px solid ${C.border}`, borderTop: 'none' }}>
                  <img src={imgSrc2!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="내사진" />
                </div>
              </div>
            </div>

            {/* 체크리스트 */}
            <div style={{
              margin: '0 20px', background: C.pinkLight, borderRadius: '16px',
              border: `1px solid ${C.border}`, overflow: 'hidden',
            }}>
              <div style={{ padding: '16px 20px 8px', borderBottom: `1px solid ${C.border}` }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: C.textDark, margin: 0, textAlign: 'center' }}>체크리스트</h3>
              </div>
              {CHECK_QUESTIONS.STEP2.map((q, i) => (
                <div key={i} onClick={() => toggleCheck(i)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', borderBottom: i < 2 ? `1px solid ${C.border}` : 'none', cursor: 'pointer',
                }}>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: C.textDark }}>{q}</span>
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, marginLeft: '12px',
                    background: checks[i] ? C.coral : '#ccc3c3',
                    // border: checks[i] ? 'none' : '2px solid #ddd',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#eeecec" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== G. RESULTS ===== */}
        {currentStep === STEPS.STEP1_RESULT && nbtiStep1Data && (
          <Step1Result data={nbtiStep1Data} onNext={() => goStep(STEPS.STEP2_GUIDE)} onRetry={() => window.location.reload()} />
        )}
        {currentStep === STEPS.FINAL_RESULT && nbtiStep1Data && nbtiStep2Data && (
          <Step2Result step1Data={nbtiStep1Data} step2Data={nbtiStep2Data} onBuy={() => alert('구매 페이지 이동 (준비중)')} onRetry={() => window.location.reload()} />
        )}

       </div>{/* inner flex column 닫기 */}
      </div>{/* 스크롤 영역 닫기 */}

      {/* ====== 하단 고정 버튼 ====== */}
      {!(currentStep === STEPS.STEP1_RESULT || currentStep === STEPS.FINAL_RESULT) && (
        <div style={{
          flexShrink: 0, padding: '16px 20px',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          background: currentStep === STEPS.INTRO ? 'transparent' : C.white,
          borderTop: currentStep === STEPS.INTRO ? 'none' : `1px solid ${C.border}`,
          position: currentStep === STEPS.INTRO ? 'absolute' : 'relative', bottom: 0, width: '100%', zIndex: 10,
        }}>
          {currentStep === STEPS.INTRO ? (
            <button onClick={() => goStep(STEPS.STEP1_GUIDE)} style={{
              width: '100%', padding: '18px', borderRadius: '50px', border: 'none',
              background: C.pinkGrad, color: C.white, fontSize: '18px', fontWeight: '800',
              cursor: 'pointer', boxShadow: '0 4px 15px rgba(248,120,124,0.4)', letterSpacing: '-0.3px',
            }}>시작하기</button>
          ) : currentStep.includes('GUIDE') ? (
            <button onClick={() => triggerCamera(currentStep.includes('STEP1') ? 1 : 2)} style={{
              width: '100%', padding: '18px', borderRadius: '50px', border: 'none',
              background: C.pinkGrad, color: C.white, fontSize: '17px', fontWeight: '800',
              cursor: 'pointer', boxShadow: '0 4px 15px rgba(248,120,124,0.4)',
            }}>촬영하기</button>
          ) : currentStep.includes('COMPARE') ? (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => triggerCamera(currentStep.includes('STEP1') ? 1 : 2)} style={{
                flex: 1, padding: '16px', borderRadius: '50px',
                border: `2px solid ${C.coral}`, background: C.white, color: C.coral,
                fontSize: '16px', fontWeight: '700', cursor: 'pointer',
              }}>다시 찍기</button>
              <button
                disabled={!isAllChecked}
                onClick={() => startRealAnalysis(currentStep.includes('STEP1') ? STEPS.STEP1_ANALYSIS : STEPS.STEP2_ANALYSIS)}
                style={{
                  flex: 1.3, padding: '16px', borderRadius: '50px', border: 'none',
                  background: isAllChecked ? C.pinkGrad : '#E0D8D5', color: isAllChecked ? C.white : '#aaa',
                  fontSize: '16px', fontWeight: '800', cursor: isAllChecked ? 'pointer' : 'not-allowed',
                  boxShadow: isAllChecked ? '0 4px 15px rgba(248,120,124,0.4)' : 'none',
                }}
              >분석하기</button>
            </div>
          ) : analysisDone ? (
            <button onClick={() => goStep(currentStep === STEPS.STEP1_ANALYSIS ? STEPS.STEP1_RESULT : STEPS.FINAL_RESULT)} style={{
              width: '100%', padding: '18px', borderRadius: '50px', border: 'none',
              background: C.pinkGrad, color: C.white, fontSize: '17px', fontWeight: '800',
              cursor: 'pointer', boxShadow: '0 4px 15px rgba(248,120,124,0.4)',
            }}>
              {currentStep === STEPS.STEP1_ANALYSIS ? '내 성격 유형 보기' : '최종 결과 확인하기'}
            </button>
          ) : null}
        </div>
      )}

    </div>
  );
}
