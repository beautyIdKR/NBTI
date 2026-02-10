import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { image } = body;

  // TODO: 여기서 실제 Python AI 엔진이나 ncmscnd 모듈을 호출하여 분석 수행
  // 지금은 테스트를 위해 더미 데이터 반환 (기획서 8p Response 예시)
  
  // 가상 분석 로직 (1초 딜레이)
  await new Promise(resolve => setTimeout(resolve, 1000));

  return NextResponse.json({
    personald: 1,      // 1: 우아한 뮤즈
    ratio: 0.96,       // 검지/약지 비율
    shape: 1.4,        // 슬림핏
    boundingBox: { x: 10, y: 10, w: 100, h: 200 } // 시각화용 좌표
  });
}