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
  STEP1_GUIDE: '성향 분석 (1/2)',
  STEP1_COMPARE: '사진 확인',
  STEP1_ANALYSIS: 'AI 분석중', // 타이틀 변경
  STEP1_RESULT: '1단계 결과',
  STEP2_GUIDE: '멘탈 분석 (2/2)',
  STEP2_COMPARE: '사진 확인',
  STEP2_ANALYSIS: 'AI 분석중', // 타이틀 변경
  FINAL_RESULT: '최종 결과',
};

const CHECK_QUESTIONS = {
  STEP1: [
    "1. 카드가 사진안에 다 나오나요?",
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
}

export default function NBTIPage() {
  // --- [State 관리] ---
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

  // 🌟 nbtiLogic 연결
  const nbtiStep1Data = useMemo(() => {
    if (!serverResult?.measurements) return null;
    try {
        return analyzeStep1(serverResult.measurements);
    } catch (e) {
        console.error(e);
        return null;
    }
  }, [serverResult]);

  const nbtiStep2Data = useMemo(() => {
    if (!serverResult2?.measurements) return null;
    try {
        return analyzeStep2(serverResult2.measurements);
    } catch (e) {
        console.error(e);
        return null;
    }
  }, [serverResult2]);

  // --- [유틸리티] ---
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const MAX_WIDTH = 800;
          let width = img.width;
          let height = img.height;
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
      };
    });
  };

  const goStep = (step: string) => {
    setHistory((prev) => [...prev, currentStep]);
    setCurrentStep(step);
    setIsAnalyzing(false);
    setAnalysisDone(false);
    setChecks([false, false, false]);
  };

  const goBack = () => {
    if (history.length === 0) return;
    const prevStep = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setCurrentStep(prevStep);
  };

  const toggleCheck = (index: number) => {
    const newChecks = [...checks];
    newChecks[index] = !newChecks[index];
    setChecks(newChecks);
  };

  const isAllChecked = checks.every((c) => c);

  const triggerCamera = (step: number) => {
    if (step === 1) fileInputRef1.current?.click();
    else fileInputRef2.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, step: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressedDataUrl = await compressImage(file);
      if (step === 1) {
        setImgSrc1(compressedDataUrl);
        goStep(STEPS.STEP1_COMPARE);
      } else {
        setImgSrc2(compressedDataUrl);
        goStep(STEPS.STEP2_COMPARE);
      }
    }
  };

  const analyzeImage = async (imgDataUrl: string, step: 'step1' | 'step2' = 'step1'): Promise<any> => {
    try {
      console.log(`[analyzeImage] 시작 - step: ${step}, dataUrl 길이: ${imgDataUrl?.length}`);
      
      // DataURL → Blob 변환
      const response = await fetch(imgDataUrl);
      const blob = await response.blob();
      console.log(`[analyzeImage] Blob 생성: size=${blob.size}, type=${blob.type}`);

      if (blob.size === 0) {
        console.error('[analyzeImage] ❌ Blob 크기가 0! 이미지 변환 실패');
        return null;
      }

      const formData = new FormData();
      formData.append("file", blob, "left4.jpeg");

      // step에 따라 다른 프록시 엔드포인트 호출
      const proxyUrl = step === 'step2' ? '/api/proxy?step=step2' : '/api/proxy';
      console.log(`[analyzeImage] 프록시 호출: ${proxyUrl}`);

      const serverRes = await fetch(proxyUrl, {
        method: 'POST',
        body: formData,
      });

      console.log(`[analyzeImage] 프록시 응답: status=${serverRes.status}`);
      
      const data = await serverRes.json();
      console.log(`[analyzeImage] 응답 데이터:`, JSON.stringify(data).substring(0, 200));
      
      return data;
    } catch (error: any) {
      console.error(`[analyzeImage] ❌ 에러:`, error.message);
      return null;
    }
  };

  const startRealAnalysis = async (nextStep: string) => {
    if (!isAllChecked) return;
    goStep(nextStep); 
    setIsAnalyzing(true);
    setAnalysisDone(false);

    if (nextStep === STEPS.STEP1_ANALYSIS && imgSrc1) {
      const result = await analyzeImage(imgSrc1, 'step1');
      
      if (result && result.status === 'success') {
        setServerResult(result);
        setAnalysisDone(true);
        setIsAnalyzing(false);
      } else {
        // [테스트] 실패 시 임시 데이터
        console.log("서버 연결 실패/오류, 테스트 데이터 사용");
        setServerResult({
            status: 'success',
            measurements: {
                'Index': { w: 12.56, h: 15.56 }, 
                'Ring': { w: 12.56, h: 15.56 }  
            },
            processed_image: imgSrc1 || ''
        });
        setAnalysisDone(true);
        setIsAnalyzing(false);
      }
    } else if (nextStep === STEPS.STEP2_ANALYSIS && imgSrc2) {
      const result = await analyzeImage(imgSrc2, 'step2');
      
      if (result && result.status === 'success') {
        setServerResult2(result);
        setAnalysisDone(true);
        setIsAnalyzing(false);
      } else {
        // [테스트] 실패 시 임시 데이터 (곡률 포함)
        console.log("Step2 서버 연결 실패/오류, 테스트 데이터 사용");
        setServerResult2({
            status: 'success',
            measurements: {
                'Index': { w: 13.2, h: 15.8, curvature: 1.197 },
                'Middle': { w: 14.1, h: 16.5, curvature: 1.170 },
                'Ring': { w: 12.8, h: 15.1, curvature: 1.180 },
                'Pinky': { w: 10.5, h: 12.3, curvature: 1.171 }
            },
            processed_image: imgSrc2 || ''
        });
        setAnalysisDone(true);
        setIsAnalyzing(false);
      }
    } else {
      setTimeout(() => {
        setAnalysisDone(true);
        setIsAnalyzing(false);
      }, 2000);
    }
  };

  // --- [Styles] ---
  const containerStyle: React.CSSProperties = {
    width: '100%', maxWidth: '420px', height: '100dvh', 
    backgroundColor: '#fff', boxShadow: '0 0 20px rgba(0,0,0,0.1)',
    display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', margin: '0 auto'
  };
  const headerStyle: React.CSSProperties = {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '50px', 
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 10px', zIndex: 100, background: 'rgba(255,255,255,0.95)', borderBottom: '1px solid #eee',
  };
  const scrollableContentStyle: React.CSSProperties = {
    flex: 1, overflowY: 'auto', width: '100%', paddingTop: '50px', paddingBottom: '0',
    display: 'flex', flexDirection: 'column'
  };
  const fixedBottomStyle: React.CSSProperties = {
    flexShrink: 0, padding: '20px', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
    backgroundColor: '#fff', borderTop: '1px solid #f5f5f5', zIndex: 10, width: '100%',
  };
  const btnStyle: React.CSSProperties = {
    background: '#222', color: '#fff', padding: '16px', borderRadius: '12px',
    border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', width: '100%', display: 'block'
  };
  const disabledBtnStyle: React.CSSProperties = { ...btnStyle, background: '#E0E0E0', color: '#999', cursor: 'not-allowed' };
  
  const visualBoxStyle: React.CSSProperties = {
    flex: '0 0 auto', background: '#F4F4F4', marginBottom: '20px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', 
    overflow: 'hidden', position: 'relative', flexDirection: 'column', minHeight: '300px',
  };
  const textBoxStyle: React.CSSProperties = { padding: '0 20px', textAlign: 'center' };
  const checkListStyle: React.CSSProperties = {
    backgroundColor: '#F9F9F9', borderRadius: '12px', padding: '20px', margin: '10px 20px',
    fontSize: '13px', color: '#333', lineHeight: '1.8'
  };
  const checkboxItemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 0', borderBottom: '1px solid #eee', cursor: 'pointer'
  };
  
  // 🌟 [수정] 와이어프레임 맞춤형 결과 박스 스타일 (다크 그레이)
  const resultStatsStyle: React.CSSProperties = {
    background: '#424242', // 와이어프레임의 짙은 회색
    borderRadius: '16px', 
    padding: '25px 20px', 
    color: '#fff', 
    margin: '0 20px 20px 20px', 
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
  };
  const resultRowStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', marginBottom: '15px',
    fontSize: '15px', borderBottom: '1px solid #555', paddingBottom: '12px'
  };
  // 🌟 [수정] 와이어프레임 형광 연두색 텍스트
  const resultValueStyle: React.CSSProperties = {
    color: '#00E676', // 형광 연두
    fontWeight: 'bold', 
    fontFamily: 'monospace',
    fontSize: '15px'
  };

  const introContainerStyle: React.CSSProperties = {
    background: 'linear-gradient(180deg, #FFF5F7 0%, #FFE4E8 100%)', 
    minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '60px 20px 20px 20px'
  };
  const introBubbleStyle: React.CSSProperties = {
    background: '#FFE0E0', border: '1px solid #000', borderRadius: '20px',
    padding: '10px 20px', width: '100%', position: 'relative', marginBottom: '25px',
    boxShadow: '4px 4px 0px rgba(0,0,0,0.1)'
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div style={containerStyle}>
      {/* 🌟 스캐닝 애니메이션 스타일 정의 */}
      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0.5; }
          50% { top: 100%; opacity: 1; }
          100% { top: 0%; opacity: 0.5; }
        }
        .scanner-line {
          position: absolute;
          width: 100%;
          height: 3px;
          background: #00E676;
          box-shadow: 0 0 15px #00E676;
          animation: scan 2s linear infinite;
          z-index: 20;
        }
        .scan-overlay {
          background: linear-gradient(180deg, rgba(0,230,118,0.1) 0%, rgba(0,0,0,0) 50%, rgba(0,230,118,0.1) 100%);
          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          z-index: 15;
        }
      `}</style>

      <input type="file" accept="image/*" capture="environment" className="hidden-input" ref={fileInputRef1} onChange={(e) => handleFileChange(e, 1)} style={{display:'none'}} />
      <input type="file" accept="image/*" capture="environment" className="hidden-input" ref={fileInputRef2} onChange={(e) => handleFileChange(e, 2)} style={{display:'none'}} />

      {/* 1. 헤더 */}
      {currentStep !== STEPS.INTRO && (
        <div style={headerStyle}>
          <button onClick={goBack} style={{ background: 'none', border: 'none', padding: '10px', cursor: 'pointer' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#222' }}>
             {/* 분석완료 시 타이틀 변경 */}
             {analysisDone && (currentStep.includes('ANALYSIS')) ? "AI 분석완료" : STEP_TITLES[currentStep]}
          </span>
          <div style={{ width: '44px' }}></div>
        </div>
      )}

      {/* 2. 메인 스크롤 영역 */}
      <div style={{...scrollableContentStyle, paddingTop: currentStep === STEPS.INTRO ? 0 : '50px', background: currentStep === STEPS.INTRO ? '#FFF5F7' : '#fff'}}>
          
          {/* A. INTRO */}
          {currentStep === STEPS.INTRO && (
            <div style={introContainerStyle}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px', width: '100%' }}>
                    <div style={{ 
                        background: '#EE6464', borderRadius: '10px', width: '100%', height: '100px', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '-20px', zIndex: 2
                    }}>
                        <h1 style={{ color: '#fff', fontSize: '32px', fontWeight: '900', letterSpacing: '-1px', marginBottom: '30px' }}>Nail NBTI</h1>
                    </div>
                    <div style={{ background: '#ffffff', padding: '0px 10px', borderRadius: '1px', zIndex: 3, marginTop: '-25px' }}>
                        <span style={{ color: '#EE6464', fontSize: '14px', fontWeight: 'bold' }}>손톱으로 몰랐던 내 성격 알아보기</span>
                    </div>
                </div>
                <div style={{ textAlign: 'center', marginBottom: '30px', color: '#444', fontSize: '14px', lineHeight: '1.6', fontWeight: 'normal', letterSpacing: '-0.3px' }}>
                    영국 존 매닝 교수의 <b>2D:4D이론을</b> 적용하여<br/><b>손톱AI 분석기술로 성향을 분석</b>할 수 있어요!
                </div>
                <div style={introBubbleStyle}>
                    <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>Step.1 Social Persona</p>
                    <h3 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '5px' }}>내 손톱에 맞는 캐릭터는?</h3>
                    <p style={{ fontSize: '14px', color: '#555' }}>왼손톱 Top View 분석</p>
                    <div style={{ position: 'absolute', bottom: '-10px', left: '30px', width: '20px', height: '20px', background: '#FFE0E0', borderBottom: '1px solid #000', borderRight: '1px solid #000', transform: 'rotate(45deg)' }}></div>
                </div>
                <div style={introBubbleStyle}>
                    <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>Step.2 Hidden Ego</p>
                    <h3 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '5px' }}>내 멘탈은 얼마나 강할까?</h3>
                    <p style={{ fontSize: '14px', color: '#555' }}>왼손톱 Front View 분석</p>
                    <div style={{ position: 'absolute', bottom: '-10px', right: '30px', width: '20px', height: '20px', background: '#FFE0E0', borderBottom: '1px solid #000', borderRight: '1px solid #000', transform: 'rotate(45deg)' }}></div>
                </div>
            </div>
          )}

          {/* B. GUIDE - STEP1 */}
          {currentStep === STEPS.STEP1_GUIDE && (
            <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ textAlign: 'center', marginTop: '30px', marginBottom: '30px' }}>
                    <h2 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '10px' }}>촬영 가이드</h2>
                    <p style={{ color: '#666', fontSize: '15px' }}>
                        카드위에 <span style={{ fontWeight: 'bold', color: '#000' }}>왼손 네 손톱</span>을 올려주세요
                    </p>
                </div>
                <div style={{ width: '100%', marginBottom: '30px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                    <img src="/images/nbti/left4Guide.jpg" alt="guide" style={{ width: '100%', display: 'block' }} />
                </div>
                <div style={{ width: '100%', backgroundColor: '#FFF5F7', borderRadius: '16px', padding: '25px 20px', fontSize: '15px', color: '#333', lineHeight: '1.6', textAlign: 'left' }}>
                    <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'flex-start' }}>
                        <div style={{ minWidth: '24px', height: '24px', background: '#FF4081', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px', marginRight: '10px', marginTop: '2px' }}>1</div>
                        <span>카드 위에 <span style={{fontWeight:'bold', color: '#D94040'}}>네 손가락을 밀착</span>해 주세요.</span>
                    </div>
                    <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'flex-start' }}>
                        <div style={{ minWidth: '24px', height: '24px', background: '#FF4081', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px', marginRight: '10px', marginTop: '2px' }}>2</div>
                        <span><span style={{fontWeight:'bold'}}>모든 손톱이 정면</span>으로 보이도록 조정하고, 특히 <span style={{fontWeight:'bold', color: '#D94040'}}>새끼손톱</span>이 잘 보이도록 유의해 주세요.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                        <div style={{ minWidth: '24px', height: '24px', background: '#FF4081', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px', marginRight: '10px', marginTop: '2px' }}>3</div>
                        <span>카드와 손톱이 <span style={{fontWeight:'bold'}}>모두 화면에 보이도록</span> 하고, <span style={{fontWeight:'bold', color: '#D94040'}}>손톱에 초점</span>을 맞춰 촬영해 주세요.</span>
                    </div>
                </div>
            </div>
          )}

          {/* B. GUIDE - STEP2 & COMPARE */}
          {(currentStep === STEPS.STEP1_COMPARE || currentStep === STEPS.STEP2_GUIDE || currentStep === STEPS.STEP2_COMPARE) && (
            <>
                 <div style={textBoxStyle}>
                    <h2 style={{marginTop: '20px'}}>{currentStep.includes('GUIDE') ? "촬영 가이드" : "사진 확인"}</h2>
                    <p style={{color: '#666'}}>
                      {currentStep.includes('GUIDE') ? "손톱 끝 터널이 보이게 찍어주세요" : "선명하게 잘 나왔나요?"}
                    </p>
                 </div>
                 {currentStep.includes('COMPARE') && (
                    <div style={{ display: 'flex', gap: '10px', padding: '0 20px', marginTop: '20px' }}>
                        <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#00C853', display: 'block', marginBottom: '5px' }}>✔ 잘된사진</span>
                            <div style={{ aspectRatio: '3/4', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #eee' }}>
                                {currentStep.includes('STEP1') ? (
                                    <img src="/images/nbti/left4Good.jpg" style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="잘된사진" />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', background: '#e0f2f1', display:'flex', alignItems:'center', justifyContent:'center'}}>Good</div>
                                )}
                            </div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#222', display: 'block', marginBottom: '5px' }}>✋ 내 사진</span>
                            <div style={{ aspectRatio: '3/4', width: '100%', background: '#eee', borderRadius: '12px', overflow: 'hidden' }}>
                                 <img src={currentStep.includes('STEP1') ? imgSrc1! : imgSrc2!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                        </div>
                    </div>
                 )}
                 {currentStep.includes('GUIDE') && (
                    <div style={{ ...visualBoxStyle, margin: '20px', borderRadius: '12px', height: '200px' }}>
                      <div style={{ fontSize: '50px' }}>📸</div>
                    </div>
                 )}
                 {currentStep.includes('COMPARE') && (
                    <div style={checkListStyle}>
                        <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#222' }}>체크리스트</h3>
                        {(currentStep.includes('STEP1') ? CHECK_QUESTIONS.STEP1 : CHECK_QUESTIONS.STEP2).map((q, i) => (
                            <div key={i} style={checkboxItemStyle} onClick={() => toggleCheck(i)}>
                                <span style={{ fontSize: '14px', fontWeight: '500' }}>{q}</span>
                                <div style={{
                                    width: '24px', height: '24px', borderRadius: '50%', 
                                    backgroundColor: checks[i] ? '#FF4081' : '#eee', 
                                    border: checks[i] ? 'none' : '1px solid #ddd',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff', fontSize: '14px', transition: 'all 0.2s ease'
                                }}>
                                    {checks[i] && '✓'} 
                                </div>
                            </div>
                        ))}
                    </div>
                 )}
            </>
          )}

          {/* C. ANALYSIS (분석 및 결과 확인) */}
          {(currentStep === STEPS.STEP1_ANALYSIS || currentStep === STEPS.STEP2_ANALYSIS) && (
            <>
                 {/* 1. 타이틀 섹션 */}
                 <div style={{ padding: '0 20px', textAlign: 'center' }}>
                    <h2 style={{marginTop: '20px', fontSize: '24px', fontWeight: '900'}}>
                        {analysisDone ? "분석완료" : "AI 분석중..."}
                    </h2>
                    <p style={{ color: '#666', marginTop: '5px', fontSize: '15px' }}>
                        {analysisDone ? "데이터 분석이 끝났습니다." : "AI가 손톱을 정밀 분석하고 있습니다."}
                    </p>
                 </div>
                
                {/* 2. 이미지 섹션 + 애니메이션 */}
                <div style={{ ...visualBoxStyle, justifyContent: 'flex-start', margin: '20px 30px', borderRadius: '4px', background: analysisDone ? '#222' : '#F4F4F4', border: '2px solid #222', minHeight: '350px' }}>
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
                  
                  {/* 🌟 스캐닝 애니메이션 (분석 중일 때만 표시) */}
                  {!analysisDone && (
                    <>
                      <div className="scanner-line"></div>
                      <div className="scan-overlay"></div>
                      <div style={{ position: 'absolute', bottom: '20px', width: '100%', textAlign: 'center', color: '#00E676', fontWeight: 'bold', fontSize: '14px', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                        AI Analyzing...
                      </div>
                    </>
                  )}
                </div>
                  
                {/* 3. 데이터 결과 박스 (Step1) */}
                {analysisDone && currentStep === STEPS.STEP1_ANALYSIS && serverResult && serverResult.measurements && nbtiStep1Data && (
                  <div style={resultStatsStyle} className="fade-in">
                      <h3 style={{fontSize:'15px', borderBottom:'1px solid #666', paddingBottom:'12px', marginBottom:'15px', color: '#fff'}}>
                        실측데이터(mm)
                      </h3>
                      
                      {/* 1. 손가락별 수치 리스트 */}
                      {[
                        { key: 'Index', label: '검지손톱' },
                        { key: 'Middle', label: '중지손톱' },
                        { key: 'Ring', label: '소지손톱' },
                        { key: 'Pinky', label: '새끼손톱' }
                      ].map((item) => (
                        <div key={item.key} style={resultRowStyle}>
                          <span style={{color: '#fff'}}>{item.label}</span>
                          <div style={{textAlign:'right', display:'flex', gap:'10px'}}>
                            <span style={resultValueStyle}>W: {serverResult.measurements[item.key]?.w || '0.00'}</span>
                            <span style={{color:'#666'}}>|</span>
                            <span style={resultValueStyle}>H: {serverResult.measurements[item.key]?.h || '0.00'}</span>
                          </div>
                        </div>
                      ))}

                      {/* 2. 비율 표시 행 추가 */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        marginTop: '20px', 
                        paddingTop: '15px', 
                        borderTop: '1px solid #555' 
                      }}>
                        <span style={{ color: '#fff', fontSize: '15px', fontWeight: 'bold' }}>
                          검지 : 소지 비율(2D:4D)
                        </span>
                        <span style={{ color: '#FF4081', fontWeight: 'bold', fontSize: '18px' }}>
                          {nbtiStep1Data.ratio}
                        </span>
                      </div>
                  </div>
                )}

                {/* 3-2. 데이터 결과 박스 (Step2 - 곡률) */}
                {analysisDone && currentStep === STEPS.STEP2_ANALYSIS && serverResult2 && serverResult2.measurements && nbtiStep2Data && (
                  <div style={resultStatsStyle} className="fade-in">
                      <h3 style={{fontSize:'15px', borderBottom:'1px solid #666', paddingBottom:'12px', marginBottom:'15px', color: '#fff'}}>
                        곡률 분석 데이터
                      </h3>
                      
                      {[
                        { key: 'Index', label: '검지손톱' },
                        { key: 'Middle', label: '중지손톱' },
                        { key: 'Ring', label: '약지손톱' },
                        { key: 'Pinky', label: '새끼손톱' }
                      ].map((item) => (
                        <div key={item.key} style={resultRowStyle}>
                          <span style={{color: '#fff'}}>{item.label}</span>
                          <div style={{textAlign:'right', display:'flex', gap:'10px'}}>
                            <span style={resultValueStyle}>
                              곡률: {serverResult2.measurements[item.key]?.curvature?.toFixed(4) || 
                                     (serverResult2.measurements[item.key]?.w > 0 
                                       ? (serverResult2.measurements[item.key].h / serverResult2.measurements[item.key].w).toFixed(4) 
                                       : '0.0000')}
                            </span>
                          </div>
                        </div>
                      ))}

                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        marginTop: '20px', 
                        paddingTop: '15px', 
                        borderTop: '1px solid #555' 
                      }}>
                        <span style={{ color: '#fff', fontSize: '15px', fontWeight: 'bold' }}>
                          평균 곡률
                        </span>
                        <span style={{ color: '#FF4081', fontWeight: 'bold', fontSize: '18px' }}>
                          {nbtiStep2Data.avgCurvature}
                        </span>
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        marginTop: '10px',
                      }}>
                        <span style={{ color: '#aaa', fontSize: '14px' }}>
                          진단 유형
                        </span>
                        <span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '16px' }}>
                          {nbtiStep2Data.name} ({nbtiStep2Data.curvatureLevel})
                        </span>
                      </div>
                  </div>
                )}
            </>
          )}

          {/* D. RESULTS */}
          {currentStep === STEPS.STEP1_RESULT && nbtiStep1Data && (
             <Step1Result 
                data={nbtiStep1Data} 
                onNext={() => goStep(STEPS.STEP2_GUIDE)} 
                onRetry={() => window.location.reload()} 
             />
          )}

          {currentStep === STEPS.FINAL_RESULT && nbtiStep1Data && nbtiStep2Data && (
             <Step2Result 
                step1Data={nbtiStep1Data}
                step2Data={nbtiStep2Data}
                onBuy={() => alert('구매 페이지 이동 (준비중)')} 
                onRetry={() => window.location.reload()} 
             />
          )}

      </div>

      {/* 3. 하단 고정 버튼 */}
      {!(currentStep === STEPS.STEP1_RESULT || currentStep === STEPS.FINAL_RESULT) && (
          <div style={{...fixedBottomStyle, background: currentStep === STEPS.INTRO ? 'transparent' : '#fff', borderTop: currentStep === STEPS.INTRO ? 'none' : '1px solid #f5f5f5', position: currentStep === STEPS.INTRO ? 'absolute' : 'relative', bottom: 0 }}>
             {currentStep === STEPS.INTRO ? (
                 <button style={{ ...btnStyle, background: 'linear-gradient(90deg, #F06262 0%, #D94040 100%)', boxShadow: '0 4px 15px rgba(240, 98, 98, 0.4)', padding: '18px', fontSize: '18px' }} onClick={() => goStep(STEPS.STEP1_GUIDE)}>시작하기</button>
             ) : (currentStep.includes('GUIDE') ? (
                 <button style={{ ...btnStyle, background: currentStep === STEPS.STEP1_GUIDE ? '#F06262' : '#222' }} onClick={() => triggerCamera(currentStep.includes('STEP1') ? 1 : 2)}>촬영하기</button>
             ) : (currentStep.includes('COMPARE') ? (
                 <div style={{display:'flex', gap:'10px'}}>
                   <button style={{...btnStyle, background:'#fff', color:'#333', border:'1px solid #ddd'}} onClick={() => triggerCamera(currentStep.includes('STEP1') ? 1 : 2)}>다시 찍기</button>
                   <button style={isAllChecked ? btnStyle : disabledBtnStyle} disabled={!isAllChecked} onClick={() => startRealAnalysis(currentStep.includes('STEP1') ? STEPS.STEP1_ANALYSIS : STEPS.STEP2_ANALYSIS)}>분석하기</button>
                 </div>
             ) : (analysisDone && (
                 <button style={{ ...btnStyle, background: '#FF4081', fontSize: '18px' }} onClick={() => goStep(currentStep === STEPS.STEP1_ANALYSIS ? STEPS.STEP1_RESULT : STEPS.FINAL_RESULT)}>
                    {currentStep === STEPS.STEP1_ANALYSIS ? "내 성격 유형 보기" : "최종 결과 확인하기"}
                 </button>
             ))))}
          </div>
      )}

    </div>
  );
}