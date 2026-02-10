'use client';

import React, { useEffect, useState } from 'react';
import { Step1ResultType, Step2ResultType } from '@/app/utils/nbtiLogic';

const KAKAO_API_KEY = '1d6d2cac31191b3c1aa4ab7ac672272d';

declare global {
  interface Window {
    Kakao: any;
  }
}

interface Props {
  step1Data: Step1ResultType;  // Step1 결과 (상단 카드용)
  step2Data: Step2ResultType;  // Step2 결과 (하단 진단 카드)
  onBuy: () => void;
  onRetry: () => void;
}

export default function Step2Result({ step1Data, step2Data, onBuy, onRetry }: Props) {
  const [isSharing, setIsSharing] = useState(false);
  const c2 = step2Data.colors;
  const currentUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0] : '';

  useEffect(() => {
    if (!KAKAO_API_KEY) return;
    const script = document.createElement('script');
    script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.6.0/kakao.min.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        window.Kakao.init(KAKAO_API_KEY);
      }
    };
    document.head.appendChild(script);
  }, []);

  const getAbsoluteUrl = (path: string) => {
    if (path.startsWith('http')) return path;
    return typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}${path}`
      : path;
  };

  // --- 공유 기능 ---
  const handleNativeShare = async (platformName?: string) => {
    setIsSharing(true);
    try {
      try { await navigator.clipboard.writeText(currentUrl); } catch (e) {}
      const shareData: ShareData = {
        title: '(네일)NBTI 결과',
        text: `[(네일)NBTI] ${step1Data.name} × ${step2Data.name}`,
        url: currentUrl,
      };
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        if (platformName === 'twitter') shareTwitterFallback();
        else if (platformName === 'facebook') shareFacebookFallback();
      }
    } catch (err) {
      console.log('Share Failed:', err);
      if (platformName === 'twitter') shareTwitterFallback();
      else if (platformName === 'facebook') shareFacebookFallback();
    } finally {
      setIsSharing(false);
    }
  };

  const shareTwitterFallback = () => {
    const text = `[(네일)NBTI] ${step1Data.name} × ${step2Data.name} - 내 손톱 성격 확인하기`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(currentUrl)}`, '_blank');
  };

  const shareFacebookFallback = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`, '_blank');
  };

  const shareKakao = () => {
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      alert('카카오톡 로딩 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `[네일BTI] ${step1Data.name} × ${step2Data.name}`,
        description: `${step2Data.subTitle}`,
        imageUrl: getAbsoluteUrl(step2Data.mainImg) + '?t=' + Date.now(),
        imageWidth: 800,
        imageHeight: 800,
        link: { mobileWebUrl: currentUrl, webUrl: currentUrl },
      },
      buttons: [
        { title: '결과 자세히 보기', link: { mobileWebUrl: currentUrl, webUrl: currentUrl } },
        { title: '나도 테스트하기', link: { mobileWebUrl: currentUrl, webUrl: currentUrl } },
      ],
    });
  };

  // --- 스탯바 컴포넌트 ---
  const StatBar = ({ label, value }: { label: string; value: number }) => (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px' }}>
        <div style={{
          width: `${value}%`, height: '100%', borderRadius: '4px',
          background: 'linear-gradient(90deg, #fff 0%, rgba(255,255,255,0.8) 100%)',
          transition: 'width 1s ease-out',
        }} />
      </div>
    </div>
  );

  if (!step2Data) return <div>Loading...</div>;

  return (
    <div style={{ backgroundColor: '#F5F3F0', minHeight: '100%', color: '#333', paddingBottom: '30px', overflowX: 'hidden' }}>

      {/* 0. 상단 바 */}
      <div style={{
        background: '#4E3B38', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px', fontWeight: 'bold', color: '#fff', position: 'sticky', top: 0, zIndex: 10,
      }}>
        (네일)NBTI : 손톱으로 알아보는 내 성격
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* 1. 타이틀 */}
        <div style={{ textAlign: 'center', marginTop: '25px', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '900', margin: 0, color: '#333' }}>{step2Data.name}</h1>
          <p style={{ fontSize: '15px', marginTop: '5px', color: '#666', fontWeight: '600' }}>{step2Data.subTitle}</p>
        </div>

        {/* 2. 메인 카드 (기획서 8p 디자인) */}
        <div style={{
          background: c2.bg, borderRadius: '20px', padding: '25px 20px', position: 'relative',
          color: '#fff', marginBottom: '25px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        }}>
          {/* 상단: TYPE 텍스트 + 곡률 뱃지 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '900', margin: 0, lineHeight: 1.1 }}>
                TYPE -<br />{step2Data.typeName}
              </h2>
            </div>
            <div style={{
              background: 'rgba(0,0,0,0.25)', padding: '8px 14px', borderRadius: '10px',
              textAlign: 'center', fontSize: '12px', lineHeight: 1.4,
            }}>
              곡률<br />
              <span style={{ fontSize: '24px', fontWeight: '900' }}>{step2Data.curvatureLevel}</span>
            </div>
          </div>

          {/* 캐릭터 이미지 */}
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '15px 0' }}>
            <img
              src={step2Data.mainImg}
              alt={step2Data.name}
              style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'contain' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>

          {/* 태그 */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '15px' }}>
            {step2Data.tags.map((tag) => (
              <span key={tag} style={{
                fontSize: '14px', fontWeight: '800', letterSpacing: '-0.5px',
              }}>{tag}</span>
            ))}
          </div>

          {/* 스탯 바 */}
          <StatBar label="Hardness (멘탈 방어력)" value={step2Data.stats.hardness} />
          <StatBar label="Flexibility (회복 탄력성)" value={step2Data.stats.flexibility} />
          <StatBar label="Gloss (에너지 발산력)" value={step2Data.stats.gloss} />
        </div>

        {/* 3. 설명 텍스트 */}
        <div style={{ marginBottom: '25px' }}>
          <p style={{ fontSize: '14px', lineHeight: '1.7', color: '#444', whiteSpace: 'pre-wrap', wordBreak: 'keep-all' }}>
            {step2Data.desc}
          </p>
        </div>

        {/* 4. Solution */}
        <div style={{
          background: '#fff', borderRadius: '16px', padding: '25px 20px', marginBottom: '25px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '12px', color: '#333' }}>Solution</h3>
          <p style={{ fontSize: '14px', lineHeight: '1.7', color: '#555', wordBreak: 'keep-all' }}>
            {step2Data.solution}
          </p>
        </div>

        {/* 5. 추천 네일 */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', textAlign: 'center', marginBottom: '15px', color: '#333' }}>
            이 성격유형이 좋아하는 네일은?
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {step2Data.matchNails.map((nail, idx) => (
              <div key={idx} style={{
                background: '#fff', borderRadius: '16px', padding: '12px 20px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '130px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
              }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                  <img src={nail.img} alt={nail.name} style={{ height: '90px', objectFit: 'contain' }} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#555', marginTop: '4px' }}>{nail.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 6. 구매 유도 */}
        <div style={{
          background: 'linear-gradient(135deg, #5D423D 0%, #3E2723 100%)', borderRadius: '20px',
          padding: '30px 20px', textAlign: 'center', color: '#fff', marginBottom: '25px',
        }}>
          <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>
            AI가 당신의 <b>{step1Data.name}</b> 손톱에 딱 맞춘 키트를 설계했습니다.
          </p>
          <p style={{ fontSize: '13px', opacity: 0.7, marginBottom: '20px' }}>
            이미 촬영 33% 완료! 나머지 사진만 찍으면 제작 가능.
          </p>
          <button onClick={onBuy} style={{
            width: '100%', padding: '18px', borderRadius: '50px', border: 'none',
            background: 'linear-gradient(90deg, #FF6B35 0%, #FF4444 100%)', color: '#fff',
            fontSize: '17px', fontWeight: 'bold', cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(255,107,53,0.4)',
          }}>
            맞춤 키트 쿠폰 받기
          </button>
        </div>

        {/* 7. 공유 & 다시하기 */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <p style={{ fontSize: '12px', marginBottom: '12px', fontWeight: 'bold', color: '#888' }}>내 결과 공유하기</p>

          <button onClick={() => handleNativeShare()} disabled={isSharing} style={{
            width: 'auto', padding: '12px 24px', borderRadius: '30px', border: 'none',
            background: isSharing ? '#999' : '#fff', color: isSharing ? '#fff' : '#222',
            fontSize: '14px', fontWeight: 'bold', cursor: isSharing ? 'wait' : 'pointer',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)', marginBottom: '20px',
            display: 'inline-flex', alignItems: 'center', gap: '8px',
          }}>
            {isSharing ? '공유 준비 중...' : '📤 결과 카드 공유하기'}
          </button>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '10px' }}>
            <div onClick={() => handleNativeShare('instagram')} style={{
              width: '40px', height: '40px',
              background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', cursor: 'pointer', color: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}>📷</div>
            <div onClick={shareKakao} style={{
              width: '40px', height: '40px', background: '#FEE500', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#000', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px',
            }}>TALK</div>
            <div onClick={() => handleNativeShare('twitter')} style={{
              width: '40px', height: '40px', background: '#000', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', cursor: 'pointer', color: '#fff',
            }}>𝕏</div>
            <div onClick={() => handleNativeShare('facebook')} style={{
              width: '40px', height: '40px', background: '#1877F2', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', cursor: 'pointer', color: '#fff',
            }}>f</div>
          </div>

          <button onClick={onRetry} style={{
            width: '100%', padding: '16px', borderRadius: '50px', border: 'none',
            background: '#888', color: '#fff', fontSize: '16px', fontWeight: 'bold',
            cursor: 'pointer', marginTop: '30px',
          }}>
            다시하기
          </button>
        </div>
      </div>
    </div>
  );
}
