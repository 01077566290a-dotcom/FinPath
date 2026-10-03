// 계산 기준값 모음 (2번: 계산·개인화). 금액 단위: 만 원.
// 기획안 6장 결정 #2(비상자금 개월 수)·#4(기준 비율)가 정해지면 이 파일의 값만 바꿉니다.
// source가 null인 값은 출처 확인 전 초안이라, 화면에는 "일반적으로" 표현과 함께 보여줘야 합니다.

export const PLAN_CONFIG = {
  // 비상자금 개월 수 (고용 형태별). 결정 #2 전 초안.
  emergencyMonths: {
    values: { 정규직: 3, 계약직: 6, '프리랜서·기타': 6 },
    fallback: 3,
    source: null,
  },
  // 배분 규칙 B: 비상자금을 이 비율만 먼저 채우고 나머지는 다른 목표에 배분
  partialEmergencyRatio: { value: 0.5, source: null },
  // 개인화 판단 기준 (월 실수령액 대비 비율). 결정 #4 전 초안.
  limits: {
    maxSaveRate: { value: 0.5, source: null }, // 저축이 월급의 이 비율을 넘으면 무리로 봄
    housingCap: { value: 0.3, source: null }, // 월세+관리비 상한
    minAfterSaveRate: { value: 0.1, source: null }, // 독립 후에도 남겨야 할 저축 비율
    housingBurdenExtraEmergencyMonths: { value: 1, source: null }, // 주거비 부담이 크면 비상자금을 더 쌓음
  },
  // 모르겠다고 답한 값을 채우는 기준값. 지역별 시세는 결정 #5(시연 지역 데이터)에서 byRegion에 추가합니다.
  defaults: {
    deposit: { 월세: 1000, 전세: 10000, 매매: 30000 },
    rent: { rent: 60, maintenance: 8 },
    weddingCost: 3000,
    byRegion: {}, // 예: { '서울 마포구': { deposit: { 월세: 1000 }, rent: { rent: 60, maintenance: 8 } } }
    source: null,
  },
  // 이사·초기 비용 추정 (서비스가 추정). 중개수수료는 환산보증금 × 요율.
  initialCosts: {
    brokerageRate: 0.004,
    moving: 30,
    furnishing: 142,
    source: null,
  },
  defaultHorizonMonths: 12, // 기한이 있는 목적이 없을 때 쓰는 기간
  maxMonths: 600,
};
