// app/api/proxy/route.ts
import { NextRequest, NextResponse } from 'next/server';

// ⚠️ 사설 인증서 무시 (필수)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// AI 서버 주소 (환경변수 또는 직접 지정)
const AI_SERVER_BASE = process.env.AI_SERVER_URL || 'https://192.168.0.245:8443';

export async function POST(request: NextRequest) {
  const timestamp = new Date().toLocaleTimeString('ko-KR');
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 [Proxy ${timestamp}] 요청 도착!`);

  try {
    // 0. step 파라미터 확인
    const { searchParams } = new URL(request.url);
    const step = searchParams.get('step') || 'step1';
    console.log(`📋 [Proxy] step 파라미터: ${step}`);

    // 1. FormData 읽기
    console.log(`📥 [Proxy] FormData 파싱 시작...`);
    let formData: FormData;
    try {
      formData = await request.formData();
      console.log(`✅ [Proxy] FormData 파싱 성공`);
    } catch (parseErr: any) {
      console.error(`❌ [Proxy] FormData 파싱 실패:`, parseErr.message);
      return NextResponse.json({ 
        status: 'error', 
        message: 'FormData 파싱 실패', 
        error_msg: parseErr.message 
      }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file) {
      console.error("❌ [Proxy] 파일이 FormData에 없습니다.");
      // FormData 키 목록 출력
      const keys: string[] = [];
      formData.forEach((_, key) => keys.push(key));
      console.error(`   FormData 키 목록: [${keys.join(', ')}]`);
      return NextResponse.json({ status: 'error', message: 'No file in FormData' }, { status: 400 });
    }

    const fileObj = file as File;
    console.log(`📦 [Proxy] 파일 확인: name=${fileObj.name}, size=${fileObj.size} bytes, type=${fileObj.type}`);

    if (fileObj.size === 0) {
      console.error("❌ [Proxy] 파일 크기가 0 bytes!");
      return NextResponse.json({ status: 'error', message: 'Empty file' }, { status: 400 });
    }

    // 2. AI 서버 엔드포인트 결정
    const endpoint = step === 'step2'
      ? `${AI_SERVER_BASE}/api/nbti/analyze/step2`
      : `${AI_SERVER_BASE}/api/nbti/analyze/step1`;
    
    console.log(`📡 [Proxy] AI 서버 호출: ${endpoint}`);

    // 3. FormData 재생성해서 전송
    const backendFormData = new FormData();
    backendFormData.append("file", file);

    console.log(`⏳ [Proxy] fetch 시작...`);
    const startTime = Date.now();

    const backendResponse = await fetch(endpoint, {
      method: 'POST',
      body: backendFormData,
    });

    const elapsed = Date.now() - startTime;
    console.log(`✅ [Proxy] AI 서버 응답: status=${backendResponse.status} (${elapsed}ms)`);

    if (!backendResponse.ok) {
      // AI 서버가 에러 JSON을 보냈을 수 있으므로 먼저 JSON 파싱 시도
      try {
        const errorData = await backendResponse.json();
        console.error(`🔥 [Proxy] AI 서버 에러 (JSON): ${JSON.stringify(errorData).substring(0, 300)}`);
        // AI 서버의 에러 응답을 그대로 프론트에 전달 (status: 'error' 포함)
        return NextResponse.json({
          ...errorData,
          status: errorData.status || 'error',
          error_code: errorData.error_code || 'AI_SERVER_ERROR',
        });
      } catch {
        const errorText = await backendResponse.text();
        console.error(`🔥 [Proxy] AI 서버 에러 (text): ${errorText.substring(0, 500)}`);
        return NextResponse.json({
          status: 'error',
          error_code: 'AI_SERVER_ERROR',
          message: `AI 분석 중 오류가 발생했습니다.\n다시 촬영해주세요.`,
        });
      }
    }

    // 4. 결과 파싱 및 반환
    const data = await backendResponse.json();
    console.log(`🎉 [Proxy] 분석 성공!`);
    console.log(`   measurements 키: [${Object.keys(data.measurements || {}).join(', ')}]`);
    console.log(`   vis_image 존재: ${!!data.vis_image}`);

    // vis_image → processed_image 호환 매핑
    return NextResponse.json({
      ...data,
      processed_image: data.vis_image || data.processed_image || '',
    });

  } catch (error: any) {
    console.error(`☠️ [Proxy] 치명적 에러:`);
    console.error(`   message: ${error.message}`);
    console.error(`   cause: ${error.cause?.message || 'N/A'}`);
    console.error(`   code: ${error.code || 'N/A'}`);
    
    // 흔한 에러 원인 안내
    let hint = '';
    if (error.message?.includes('ECONNREFUSED')) {
      hint = 'AI 서버가 꺼져있거나 포트가 다릅니다. AI 서버 실행 상태를 확인하세요.';
    } else if (error.message?.includes('ETIMEDOUT') || error.message?.includes('timeout')) {
      hint = 'AI 서버 응답 시간 초과. 네트워크 또는 방화벽을 확인하세요.';
    } else if (error.message?.includes('certificate') || error.message?.includes('SSL')) {
      hint = 'SSL 인증서 문제. NODE_TLS_REJECT_UNAUTHORIZED 설정을 확인하세요.';
    } else if (error.message?.includes('ENOTFOUND')) {
      hint = 'AI 서버 주소를 찾을 수 없습니다. IP/도메인을 확인하세요.';
    }

    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Proxy Connection Failed', 
        error_msg: error.message,
        hint: hint || '서버 로그를 확인해주세요.',
      },
      { status: 500 }
    );
  }
}
