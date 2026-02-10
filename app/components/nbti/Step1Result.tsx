'use client';

import React, { useEffect, useState } from 'react';
import { Step1ResultType } from '@/app/utils/nbtiLogic';

// ✅ 카카오 API 키
const KAKAO_API_KEY = '1d6d2cac31191b3c1aa4ab7ac672272d'; 

declare global {
  interface Window {
    Kakao: any;
  }
}

interface Props {
  data: Step1ResultType;
  onNext: () => void;
  onRetry: () => void;
}

export default function Step1Result({ data, onNext, onRetry }: Props) {
  const [isSharing, setIsSharing] = useState(false);

  // 안전장치 및 스타일 변수
  const c = data?.colors || { bg: '#BF9495', text: '#212121', dome: 'rgba(255,255,255,0.2)', card: '#fff' };
  const size = 'M'; 
  
  // URL 파라미터 제거
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

  // 🌟 [시스템 공유] 인스타/X/페북
  const handleNativeShare = async (platformName?: string) => {
    setIsSharing(true);
    try {
      try { await navigator.clipboard.writeText(currentUrl); } catch (e) {}

      // 이미지 캐시 방지
      const noCacheImgUrl = `${data.resultImg}?t=${new Date().getTime()}`;
      const response = await fetch(noCacheImgUrl);
      const blob = await response.blob();
      const file = new File([blob], `NBTI_${data.name}.png`, { type: 'image/png' });

      const shareData: ShareData = {
        files: [file], 
        title: 'NBTI 결과',
        text: `[N(네일)BTI] ${data.name} (${data.subTitle})`, 
        url: currentUrl 
      };

      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        if (platformName === 'twitter') shareTwitterFallback();
        else if (platformName === 'facebook') shareFacebookFallback();
        else downloadImageFallback(); 
      }
    } catch (err) {
      console.log("Native Share Failed:", err);
      if (platformName === 'twitter') shareTwitterFallback();
      else if (platformName === 'facebook') shareFacebookFallback();
    } finally {
      setIsSharing(false);
    }
  };

  const shareTwitterFallback = () => {
    const text = `[N(네일)BTI] ${data.name} - 내 성격 유형 확인하기`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(currentUrl)}`, '_blank');
  };

  const shareFacebookFallback = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`, '_blank');
  };

  const downloadImageFallback = async () => {
    try {
        const response = await fetch(data.resultImg);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NBTI_${data.name}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        alert("✅ 이미지가 저장되었습니다! SNS에 이미지와 링크를 함께 올려주세요.");
    } catch (e) {
        window.open(data.resultImg, '_blank');
    }
  };

  // 🌟 [카카오톡] 
  const shareKakao = () => {
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      alert('카카오톡 로딩 중입니다. 잠시 후 다시 시도해주세요.'); return;
    }
    
    // 이미지 주소 (캐시 방지)
    const resultImageUrl = getAbsoluteUrl(data.resultImg) + '?t=' + new Date().getTime();
    
    // 현재 페이지 주소 (여기가 등록된 도메인이어야 함!)
    console.log("Sharing URL:", currentUrl); 

    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `[(네일)NBTI] ${data.name}`,
        description: data.subTitle,
        imageUrl: resultImageUrl,
        // 이미지가 잘 나온다고 하셨으니 800x800 유지 (정사각형 강제)
        imageWidth: 800,
        imageHeight: 800,
        // 👇 [중요] content 안의 link가 있어야 이미지를 눌렀을 때 이동함
        link: {
          mobileWebUrl: currentUrl,
          webUrl: currentUrl,
        },
      },
      buttons: [
        {
          title: '결과 자세히 보기',
          // 👇 [중요] buttons 안의 link가 있어야 버튼을 눌렀을 때 이동함
          link: {
            mobileWebUrl: currentUrl,
            webUrl: currentUrl,
          },
        },
        {
          title: '나도 테스트하기',
          link: {
            mobileWebUrl: currentUrl,
            webUrl: currentUrl,
          },
        },
      ],
    });
  };

  const handleLoginRequest = () => {
    const confirmLogin = window.confirm("이 서비스는 로그인이 필요합니다.\n회원가입/로그인 페이지로 이동하시겠습니까?");
    if (confirmLogin) onNext();
  };

  if (!data) return <div>Loading...</div>;

  return (
    <div style={{ backgroundColor: c.bg, minHeight: '100%', color: '#fff', paddingBottom: '80px', overflowX:'hidden' }}>
      
      {/* 1. 상단 네비게이션 */}
      <div style={{ 
          background: '#4E3B38', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', fontWeight: 'bold', color: '#fff', position: 'sticky', top: 0, zIndex: 10
      }}>
        (네일)NBTI : 손톱으로 알아보는 내 성격
      </div>

      <div style={{ padding: '0 20px' }}>
        
        {/* 2. 타이틀 */}
        <div style={{ textAlign: 'center', marginTop: '30px' }}>
            <h1 style={{ fontSize: '32px', fontWeight: '900', margin: 0, letterSpacing: '-1px', textShadow: '0px 2px 4px rgba(0,0,0,0.1)' }}>{data.name}</h1>
            <p style={{ fontSize: '24px', marginTop: '5px', letterSpacing: '-1px', fontWeight: '600', opacity: 0.9, color: c.text }}>{data.subTitle}</p>
        </div>

        {/* 3. 캐릭터 이미지 */}
        <div style={{ 
            marginTop: '30px', 
            width: '100%', 
            aspectRatio: '1/1',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            overflow: 'hidden', position: 'relative'
        }}>
            <img 
                src={data.mainImg} 
                alt={data.name} 
                style={{ width: '90%', height: '90%', objectFit: 'contain', marginBottom: '20px' }} 
            />
        </div>

        {/* 4. 태그 & 뱃지 & 쉐입 */}
        <div style={{ display: 'flex', marginTop: '25px', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginLeft: '20px' }}>
                <div style={{ marginBottom: '10px' }}>
                    {data.tags.map(tag => (
                        <div key={tag} style={{ fontSize: '20px', fontWeight: '900', letterSpacing: '-1px', marginBottom: '4px', textShadow:'0 1px 2px rgba(0,0,0,0.1)' }}>{tag}</div>
                    ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ background: '#5D423D', borderRadius: '50px', padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '140px' }}>
                        {['S', 'M', 'L'].map((s) => (
                            <div key={s} style={{ width: '24px', height: '24px', borderRadius: '50%', background: size === s ? '#C18888' : 'transparent', color: size === s ? '#fff' : '#AFAFAF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>{s}</div>
                        ))}
                    </div>
                    <div style={{ background: '#5D423D', borderRadius: '50px', padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '140px' }}>
                        <div style={{ flex: 1, textAlign: 'center', padding: '4px 0', borderRadius: '20px', background: data.isSlim ? '#C18888' : 'transparent', color: data.isSlim ? '#fff' : '#AFAFAF', fontSize: '12px', fontWeight: 'bold' }}>SLIM</div>
                        <div style={{ flex: 1, textAlign: 'center', padding: '4px 0', borderRadius: '20px', background: !data.isSlim ? '#A592F3' : 'transparent', color: !data.isSlim ? '#fff' : '#AFAFAF', fontSize: '12px', fontWeight: 'bold' }}>WIDE</div>
                    </div>
                </div>
            </div>

            <div style={{ width: '120px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: '20px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#444', marginBottom: '10px', display: 'block' }}>
                    {data.isEmotional === 'balance' ? '밸런스형' : (data.isEmotional ? '감성형' : '본능형')}
                </span>
                <div style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }}>
                    <img src={data.shapeImg} alt="nail shape" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
            </div>
        </div>

        <div style={{ marginTop: '30px' }}>
             <p style={{ fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-wrap', letterSpacing: '-0.5px', fontWeight: '400', wordBreak: 'keep-all', opacity: 0.95, margin: '0 20px' }}>
                {data.desc}
             </p>
        </div>

        <div style={{ marginTop: '40px' }}>
            <h3 style={{ fontSize: '22px', fontWeight: 'bold', letterSpacing: '-0.5px', marginBottom: '15px', textAlign: 'center' }}>이 성격유형이 좋아하는 네일은?</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', margin: '0 20px' }}>
                {data.matchNails.map((nail, idx) => (
                    <div key={idx} style={{ background: c.card, borderRadius: '20px', padding: '10px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '140px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                            <img src={nail.img} alt={nail.name} style={{ height: '100px', objectFit: 'contain' }} />
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: c.text, marginTop: '5px' }}>{nail.name}</span>
                    </div>
                ))}
            </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '50px' }}>
            <p style={{ fontSize: '13px', opacity: 0.9, marginBottom: '15px', fontWeight: '500' }}>
                아이네일 로그인 하면<br/>몰랐던 내 성격 더 알아볼 수 있어요
            </p>
            <button onClick={handleLoginRequest} style={{
                width: '100%', padding: '18px', borderRadius: '50px', border: 'none',
                background: '#5D423D', color: '#fff', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
            }}>
                멘탈 테스트 하러가기
            </button>

            <div style={{ margin: '30px 0' }}>
                <p style={{ fontSize: '12px', marginBottom: '10px', fontWeight: 'bold' }}>내 결과 공유하기</p>

                <button onClick={() => handleNativeShare()} disabled={isSharing} style={{
                    width: 'auto', padding: '12px 24px', borderRadius: '30px', border: 'none',
                    background: isSharing ? '#999' : '#fff', color: isSharing ? '#fff' : '#222', 
                    fontSize: '14px', fontWeight: 'bold', cursor: isSharing ? 'wait' : 'pointer',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)', marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px'
                }}>
                    {isSharing ? '공유 준비 중...' : '📤 결과 카드 공유하기'}
                </button>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '10px' }}>
                    <div onClick={() => handleNativeShare('instagram')} style={{ width: '40px', height: '40px', background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', borderRadius: '50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', cursor:'pointer', color:'#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'}}>📷</div>
                    
                    {/* 카카오톡 */}
                    <div onClick={shareKakao} style={{ width: '40px', height: '40px', background: '#FEE500', borderRadius: '50%', display:'flex', alignItems:'center', justifyContent:'center', color:'#000', fontWeight:'bold', cursor:'pointer' }}>TALK</div>
                    
                    <div onClick={() => handleNativeShare('twitter')} style={{ width: '40px', height: '40px', background: '#000', borderRadius: '50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', cursor:'pointer', color:'#fff' }}>𝕏</div>
                    <div onClick={() => handleNativeShare('facebook')} style={{ width: '40px', height: '40px', background: '#1877F2', borderRadius: '50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', cursor:'pointer', color:'#fff' }}>f</div>
                </div>
            </div>

            <button onClick={onRetry} style={{
                width: '100%', padding: '16px', borderRadius: '50px', border: 'none',
                background: '#5D423D', color: '#fff', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)', marginBottom: '30px'
            }}>
                다시하기
            </button>
        </div>
      </div>
    </div>
  );
}