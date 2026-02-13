// app/utils/nbtiLogic.ts

export type Measurement = { w: number; h: number };
export type MeasurementWithCurvature = { w: number; h: number; curvature?: number };

export interface Step1ResultType {
  id: string;
  name: string;
  subTitle: string;
  tags: string[];
  desc: string;
  mainImg: string;
  shapeImg: string;
  resultImg: string;
  matchNails: { name: string; img: string }[];
  isEmotional: boolean | 'balance';
  isSlim: boolean;
  colors: {
    bg: string;
    text: string;
    dome: string;
    card: string;
  };
  ratio: string;
}

export interface Step2ResultType {
  id: string;           // 'D-A', 'D-B', 'D-C'
  typeName: string;     // 'IRON', 'BALANCE', 'GLASS'
  name: string;         // 진단명
  subTitle: string;     // 부제
  tags: string[];
  desc: string;         // 멘탈/건강 분석 카피
  solution: string;     // 세일즈 포인트
  curvatureLevel: '상' | '중' | '하';
  stats: {
    hardness: number;   // 멘탈 방어력 (%)
    flexibility: number; // 회복 탄력성 (%)
    gloss: number;       // 에너지 발산력 (%)
  };
  mainImg: string;
  resultImg: string;   // 공유용 결과 카드 이미지
  matchNails: { name: string; img: string }[];
  colors: {
    bg: string;
    text: string;
    accent: string;
    card: string;
  };
  avgCurvature: string; // 평균 곡률 표시용
}

// ============================================================
// STEP 1 분석 로직 (기존 유지)
// ============================================================
export function analyzeStep1(measurements: Record<string, Measurement>): Step1ResultType {
  const index = measurements['Index'];
  const ring = measurements['Ring'];

  if (!index || !ring) throw new Error("데이터 부족");

  const ratio2D4D = ring.h > 0 ? index.h / ring.h : 1;
  const ratioStr = ratio2D4D.toFixed(4);

  let tendency: 'emotional' | 'instinct' | 'balance' = 'balance';
  if (ratio2D4D > 1.02) tendency = 'emotional';
  else if (ratio2D4D < 0.98) tendency = 'instinct';

  const indexRatio = index.w > 0 ? index.h / index.w : 0;
  const ringRatio = ring.w > 0 ? ring.h / ring.w : 0;
  const shapeAvg = (indexRatio + ringRatio) / 2;
  const isSlim = shapeAvg >= 1.2;

  let resultId = 'P6';
  if (tendency === 'emotional' && isSlim) resultId = 'P1';
  else if (tendency === 'emotional' && !isSlim) resultId = 'P2';
  else if (tendency === 'instinct' && isSlim) resultId = 'P3';
  else if (tendency === 'instinct' && !isSlim) resultId = 'P4';
  else if (tendency === 'balance' && isSlim) resultId = 'P5';

  return {
    ...DB_STEP1[resultId],
    ratio: ratioStr,
  };
}

// ============================================================
// STEP 2 분석 로직 (신규)
// ============================================================
export function analyzeStep2(measurements: Record<string, MeasurementWithCurvature>): Step2ResultType {
  // 1. 각 손톱의 curvature 값 수집
  const nailKeys = ['Index', 'Middle', 'Ring', 'Pinky'];
  const curvatures: number[] = [];

  for (const key of nailKeys) {
    const nail = measurements[key];
    if (nail && nail.curvature !== undefined && nail.curvature > 0) {
      curvatures.push(nail.curvature);
    }
  }

  // curvature 데이터가 없으면 w/h 기반으로 계산
  if (curvatures.length === 0) {
    for (const key of nailKeys) {
      const nail = measurements[key];
      if (nail && nail.w > 0) {
        curvatures.push(nail.h / nail.w);
      }
    }
  }

  // 데이터가 아예 없으면 기본값(Type C)
  if (curvatures.length === 0) {
    return { ...DB_STEP2['D-C'], avgCurvature: '0.0000' };
  }

  // 2. 평균 곡률 & 편차 계산
  const avgCurvature = curvatures.reduce((a, b) => a + b, 0) / curvatures.length;
  const maxCurvature = Math.max(...curvatures);
  const variance = curvatures.reduce((sum, c) => sum + Math.pow(c - avgCurvature, 2), 0) / curvatures.length;
  const stdDev = Math.sqrt(variance);

  const avgStr = avgCurvature.toFixed(4);

  // 3. 분류 로직 (기획서 4.1 기반, arc_ratio 임계값)
  // curvature = arc_length / chord_length
  //   1.0 = 완전 평평, 클수록 곡률 높음 (일반적으로 1.0 ~ 1.2+ 범위)
  //
  // D-A (Iron/뚝심있는 승부사): 곡률 높음 → "상"
  //   하나라도 1.10 이상 or 편차 0.03 이상
  // D-C (Glass/투명한 감성의 아티스트): 곡률 낮음 → "하"
  //   평균 1.03 미만 & 편차 작음
  // D-B (Balance/유연한 지성의 마에스트로): 나머지 → "중"

  let resultId = 'D-B'; // 기본: Balance (중)

  if (maxCurvature >= 1.10 || stdDev >= 0.03) {
    resultId = 'D-A'; // Iron (상)
  } else if (avgCurvature < 1.03 && stdDev < 0.03) {
    resultId = 'D-C'; // Glass (하)
  }

  return {
    ...DB_STEP2[resultId],
    avgCurvature: avgStr,
  };
}

// ============================================================
// STEP 1 DB
// ============================================================
const DB_STEP1: Record<string, Step1ResultType> = {
  P1: {
    id: 'P1',
    name: '우아한 뮤즈',
    subTitle: '섬세한 감각의 낭만파',
    tags: ['#감수성폭발', '#디테일장인'],
    desc: `감수성이 풍부하고 미적 감각이 뛰어난 당신!\n투박하고 거친 것은 딱 질색이고, 무엇보다 '분위기'를 중요하게 생각하는군요. 논리적인 설명보다 가슴을 울리는 이야기나 매력적인 향기가 당신을 움직입니다.\n\n당신에게 세상은 하나의 거대한 예술 작품과 같아요. 남들이 "그냥 물건"이라고 할 때, 당신은 그 물건이 놓일 공간의 조명과 공기까지 상상하는 디테일 장인입니다.`,
    mainImg: '/images/nbti/P1_icn.png',
    shapeImg: '/images/nbti/P1_shape.png',
    resultImg: '/images/nbti/P1_result.jpg',
    matchNails: [
      { name: '코지로지', img: '/images/nbti/nail_P1_1.png' },
      { name: '드리밍퍼플', img: '/images/nbti/nail_P1_2.png' },
    ],
    isEmotional: true,
    isSlim: true,
    colors: { bg: '#BF9495', text: '#5D423D', dome: 'rgba(255,255,255,0.2)', card: 'rgba(255,255,255,0.25)' },
    ratio: '',
  },
  P2: {
    id: 'P2',
    name: '꼼꼼한 플래너',
    subTitle: '빈틈없는 현실주의자',
    tags: ['#준비성철저', '#안전제일'],
    desc: `현실적이고 계획적인 당신. 혹시 MBTI가 'J'로 끝나나요?\n남들이 "설마 그런 일이 생기겠어?" 하며 넘기는 작은 실수도 당신의 레이더망을 피할 순 없죠.\n\n미래에 대한 불안을 완벽한 계획으로 잠재우는 당신은 친구들 사이에서 '걸어 다니는 준비물 가방'으로 통합니다. 여행 갈 때 분 단위 계획표는 기본, 혹시 몰라 비상약과 여벌 옷까지 챙겨야 마음이 편안해지는군요`,
    mainImg: '/images/nbti/P2_icn.png',
    shapeImg: '/images/nbti/P2_shape.png',
    resultImg: '/images/nbti/P2_result.jpg',
    matchNails: [
      { name: '프로스트블루', img: '/images/nbti/nail_P2_1.png' },
      { name: '소프트마그넷', img: '/images/nbti/nail_P2_2.png' },
    ],
    isEmotional: true,
    isSlim: false,
    colors: { bg: '#8DA399', text: '#3E4E46', dome: 'rgba(255,255,255,0.2)', card: 'rgba(255,255,255,0.25)' },
    ratio: '',
  },
  P3: {
    id: 'P3',
    name: '화려한 슈퍼스타',
    subTitle: '어딜가나 시선 집중',
    tags: ['#도파민중독', '#트렌드세터'],
    desc: `주목받는 것을 즐기는 당신은 진정한 핵인싸!\n새로운 도전과 트렌드에 가장 민감한 얼리어답터입니다. 남들보다 한발 앞서 나가는 짜릿함을 즐기고, "어디서 샀어?"라는 질문을 들을 때 가장 행복해하죠.\n\n지루한 건 딱 질색! 끊임없이 새로운 자극을 찾아 헤매는 당신은 숏폼 콘텐츠의 주인공이자 창조자입니다. 당신의 에너지는 주변 사람까지 들썩이게 만드는 힘이 있네요.`,
    mainImg: '/images/nbti/P3_icn.png',
    shapeImg: '/images/nbti/P3_shape.png',
    resultImg: '/images/nbti/P3_result.jpg',
    matchNails: [
      { name: '모브니트', img: '/images/nbti/nail_P3_1.png' },
      { name: '플럼스타', img: '/images/nbti/nail_P3_2.png' },
    ],
    isEmotional: false,
    isSlim: true,
    colors: { bg: '#E598D8', text: '#5A3A54', dome: 'rgba(255,255,255,0.2)', card: 'rgba(255,255,255,0.3)' },
    ratio: '',
  },
  P4: {
    id: 'P4',
    name: '카리스마 보스',
    subTitle: '직진하는 승부사',
    tags: ['#리더십', '#목표지향'],
    desc: `목표가 생기면 뒤도 안 보고 직진하는 불도저 같은 당신!\n시원시원한 리더십으로 주변을 이끄는 대장부 스타일이시군요. 복잡한 설명보다는 "그래서 결론이 뭔데?"를 선호하며, 확실한 성과와 보상을 중요하게 생각합니다.\n\n자신의 영역을 넓히고 지배하려는 욕구가 강해, 어딜가나 좌중을 압도하는 카리스마를 뿜어냅니다. 망설임 없는 당신의 결단력에 모두가 반할 수밖에 없겠네요.`,
    mainImg: '/images/nbti/P4_icn.png',
    shapeImg: '/images/nbti/P4_shape.png',
    resultImg: '/images/nbti/P4_result.jpg',
    matchNails: [
      { name: '블루아워', img: '/images/nbti/nail_P4_1.png' },
      { name: '모카글레이즈드', img: '/images/nbti/nail_P4_2.png' },
    ],
    isEmotional: false,
    isSlim: false,
    colors: { bg: '#D9A033', text: '#5C4217', dome: 'rgba(255,255,255,0.2)', card: 'rgba(255,255,255,0.3)' },
    ratio: '',
  },
  P5: {
    id: 'P5',
    name: '고귀한 성직자',
    subTitle: '외유내강의 정석',
    tags: ['#완벽주의', '#조용한럭셔리'],
    desc: `겉으로는 한없이 평온하고 우아해 보이지만, 물밑에선 누구보다 치열하게 물장구를 치고 있는 당신. 싸움을 싫어하고 평화를 지향하지만, 사실 그 평화는 당신의 고도화된 인내심과 노력으로 만들어진 것입니다.\n\n 남들에게 흐트러진 모습을 보이는 것을 싫어해서, 힘들어도 "괜찮아요"라고 웃어넘기는 경우가 많군요. 스스로에게 엄격한 외유내강형 리더입니다.`,
    mainImg: '/images/nbti/P5_icn.png',
    shapeImg: '/images/nbti/P5_shape.png',
    resultImg: '/images/nbti/P5_result.jpg',
    matchNails: [
      { name: '스노우치크', img: '/images/nbti/nail_P5_1.png' },
      { name: '스모크마그넷', img: '/images/nbti/nail_P5_2.png' },
    ],
    isEmotional: 'balance',
    isSlim: true,
    colors: { bg: '#AA9CBA', text: '#453B4D', dome: 'rgba(255,255,255,0.2)', card: 'rgba(255,255,255,0.25)' },
    ratio: '',
  },
  P6: {
    id: 'P6',
    name: '단단한 바위',
    subTitle: '흔들리지 않는 편안함',
    tags: ['#인간시몬스', '#신뢰의아이콘'],
    desc: `감정에 쉽게 휘둘리지 않고 언제나 침착한 당신은 인간 시몬스! 묵묵히 제 몫을 다하며 깊은 신뢰를 주는 당신 곁에 있으면, 누구나 마음의 안정을 얻게 됩니다.\n\n유행에 휩쓸리기보다는 변하지 않는 본질적인 가치를 중요하게 생각하며, 한번 맺은 인연을 소중히 여깁니다. 팀 내에서 묵묵히 중심을 잡아주는 정신적 지주 역할을 하는 경우가 많군요.`,
    mainImg: '/images/nbti/P6_icn.png',
    shapeImg: '/images/nbti/P6_shape.png',
    resultImg: '/images/nbti/P6_result.jpg',
    matchNails: [
      { name: '토피아가일', img: '/images/nbti/nail_P6_1.png' },
      { name: '웨딩베일', img: '/images/nbti/nail_P6_2.png' },
    ],
    isEmotional: 'balance',
    isSlim: false,
    colors: { bg: '#C9B9DB', text: '#2E3245', dome: 'rgba(255,255,255,0.2)', card: 'rgba(255,255,255,0.25)' },
    ratio: '',
  },
};

// ============================================================
// STEP 2 DB (기획서 4.2 기반)
// ============================================================
const DB_STEP2: Record<string, Step2ResultType> = {
  'D-A': {
    id: 'D-A',
    typeName: 'IRON',
    name: '뚝심있는 승부사',
    subTitle: '흔들리지 않는 단단한 내면',
    tags: ['#리더십', '#강인함', '#책임감'],
    desc: `최고의 멘탈을 가진 사파군입니다. 확고한 철학을 가진 리더형입니다. 한번 정한 목표는 끝까지 지켜내는 의리와 책임감이 돋보이며, 위기 상황에서 더욱 냉철한 판단력을 발휘합니다. 내면의 압력을 견디는 힘이 강해 주변에 신뢰감을 줍니다.\n\n굽히지 않는 당신의 신념처럼 손톱의 굴곡(C커브)도 깊고 확실하군요. 평평하거나 딱딱한 플라스틱 팁은 당신의 높은 손톱 아치에 맞지 않아 쉽게 들뜨거나 통증을 유발할 수 있습니다.`,
    solution: `깊은 굴곡까지 유연하게 늘어나 빈틈없이 밀착되는 '고밀착 젤네일 스티커'가 정답입니다. 당신의 강인한 손톱을 부드럽게 감싸주어, 어떤 상황에서도 흔들리지 않는 완벽한 지속력을 선사합니다.`,
    curvatureLevel: '상',
    stats: { hardness: 95, flexibility: 30, gloss: 85 },
    mainImg: '/images/nbti/ironType.png',
    resultImg: '/images/nbti/D_A_result.jpg',
    matchNails: [
      { name: '모카글레이즈드', img: '/images/nbti/nail_P4_1.png' },
      { name: '스모크마그넷', img: '/images/nbti/nail_P5_2.png' },
    ],
    colors: { bg: '#C94044', text: '#FFFFFF', accent: '#FF6B35', card: 'rgba(255,255,255,0.1)' },
    avgCurvature: '',
  },
  'D-B': {
    id: 'D-B',
    typeName: 'BALANCE',
    name: '유연한 지성의 마에스트로',
    subTitle: '빈틈없는 현실주의자',
    tags: ['#자기관리', '#균형감각', '#합리성'],
    desc: `어느 한쪽으로 치우치지 않고 중심을 잡는 탁월한 균형 감각을 가졌습니다. 이상을 꿈꾸되 현실적인 계획을 세울 줄 알며, 남들이 놓치는 미세한 디테일을 감지하는 섬세함으로 상황을 유연하게 조율합니다.\n\n이러한 당신의 성향처럼, 손톱 또한 가장 이상적인 표준 곡률을 가졌습니다. 어떤 네일도 잘 어울리지만, 철두철미한 당신은 비효율적인 시간 낭비를 싫어하죠.`,
    solution: `샵에 가는 번거로움 없이도 프로급 퀄리티를 내는 '프리미엄 네일 스티커'가 최고의 파트너입니다. 완벽한 규격으로 디자인되어 붙이기만 하면 끝나는 간편함은, 바쁜 일상 속에서도 균형을 잃지 않는 당신의 자기관리 철학과 딱 맞아떨어집니다.`,
    curvatureLevel: '중',
    stats: { hardness: 80, flexibility: 80, gloss: 60 },
    mainImg: '/images/nbti/balType.png',
    resultImg: '/images/nbti/D_B_result.jpg',
    matchNails: [
      { name: '프로스트블루', img: '/images/nbti/nail_P2_1.png' },
      { name: '토피아가일', img: '/images/nbti/nail_P6_1.png' },
    ],
    colors: { bg: '#4A9A44', text: '#FFFFFF', accent: '#4CAF50', card: 'rgba(255,255,255,0.1)' },
    avgCurvature: '',
  },
  'D-C': {
    id: 'D-C',
    typeName: 'GLASS',
    name: '투명한 감성의 아티스트',
    subTitle: '세상의 빛을 그대로 투영하는 순수한 영혼',
    tags: ['#직관력', '#공감능력', '#솔직함'],
    desc: `가식 없이 투명한 매력의 소유자입니다. 타인의 감정을 있는 그대로 비추는 공감 능력과 논리보다 앞서는 뛰어난 직관력을 지녔습니다. 변화에 유연하고 회복 탄력성이 좋아 쿨한 성격입니다.\n\n순수한 당신의 영혼처럼 손톱 또한 평평하고 매끈한 형태를 지녔군요. 굴곡이 적은 손톱은 두꺼운 팁이나 경화형 젤을 올렸을 때 조이는 압박감을 받아 답답해하기 쉽습니다.`,
    solution: `이물감 없이 내 손톱처럼 얇게 밀착되는 '퍼펙트핏 네일 스티커'가 필요합니다. 억지로 모양을 잡을 필요 없이 평평한 손톱 위에 가볍게 안착하며, 당신이 언제든 새로운 감성을 표현할 수 있도록 교체 또한 자유롭습니다.`,
    curvatureLevel: '하',
    stats: { hardness: 30, flexibility: 95, gloss: 90 },
    mainImg: '/images/nbti/glassType.png',
    resultImg: '/images/nbti/D_C_result.jpg',
    matchNails: [
      { name: '스노우치크', img: '/images/nbti/nail_P5_1.png' },
      { name: '드리밍퍼플도트', img: '/images/nbti/nail_P1_2.png' },
    ],
    colors: { bg: '#AEBAF3', text: '#FFFFFF', accent: '#CE93D8', card: 'rgba(255,255,255,0.1)' },
    avgCurvature: '',
  },
};
