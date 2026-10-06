// 우선순위 타임라인(지도) 단계 카드. buildPlan 결과를 지도 화면이 쓰는 roadmap 형태로 바꿉니다.
// 각 단계는 해야 할 일 / 내 기준(내 금액으로 환산한 숫자) / 방법 / 관련 정책·제도로 구성됩니다.
// 단계 id 중 housing_budget·housing_deposit·move_in_cost·contract_check·housing_search·saving_method는
// data/policies.json의 step 값과 같아서 정책이 자동으로 붙습니다.
import { groupByStep } from '../goal/policies.js';
import { monthLabel } from '../report/computeReport.js';
import { money } from '../report/format.js';

// 금액 표기는 리포트와 같은 규칙(1억 이상은 '1억 2,345만 원')
const won = n => money(n);
const CLOSING = '여기까지가 지금 입력한 상황에서 챙길 단계예요. 상황이 바뀌면 답변을 고쳐 지도를 다시 만들어요.';
const NEVER = Infinity;

// policies: filterPolicies(profile, data) 결과
// rule: 'A'(비상자금 먼저 전부) | 'B'(비상자금 일부만 먼저). 단계 시점이 규칙에 따라 달라집니다.
// 한 단계 안에서 같은 내용이 두 번 나오지 않게 해요.
// 같은 문장은 물론, 앞 문장에 이미 나온 비율(%)만 다시 말하는 문장도 뺍니다.
// (예: "월급의 53.5%를 모아야 하는데 무리예요…" 다음의 "필요한 저축이 월급의 53.5%라 무리예요")
// '이렇게 해보세요' 아래에 붙이는 공식 사이트 바로 가기 (상품이 아닌 공공 정보만)
const LINKS = {
  accounts: { label: '내 계좌 한눈에 보기 (계좌정보통합관리서비스)', url: 'https://www.payinfo.or.kr' },
  fine: { label: '금융소비자 정보 포털 파인 (금융감독원)', url: 'https://fine.fss.or.kr' },
  realPrice: { label: '실거래가 공개시스템 (국토교통부)', url: 'https://rt.molit.go.kr' },
  myHome: { label: '마이홈포털 (공공임대·주거지원)', url: 'https://www.myhome.go.kr' },
  registry: { label: '인터넷등기소 (등기부등본 열람)', url: 'https://www.iros.go.kr' },
  hug: { label: '주택도시보증공사 (전세보증금 반환보증)', url: 'https://www.khug.or.kr' },
  fund: { label: '주택도시기금 (청년 전월세 대출)', url: 'https://nhuf.molit.go.kr' },
};

// 모든 단계의 초록 칸은 '이 단계의 목표' 한 가지 뜻이에요.
//   figure: 이 단계에서 해낼 일 + 숫자 (예: '매달 73만 원 자동이체')
//   now: 비교할 지금 값이 있으면 상세 창에 회색으로 붙여요 (없으면 null)

// 독립 전후 비교 한 문장. 실제로 늘었는지·줄었는지·그대로인지에 맞춰 말하고, 적자면 모자란 금액을 말해요.
function afterLine(cf) {
  const { now, after } = cf;
  const spend =
    after.spend > now.spend
      ? `쓰는 돈이 ${won(after.spend)}으로 늘고`
      : after.spend < now.spend
        ? `쓰는 돈이 ${won(after.spend)}으로 줄고`
        : `쓰는 돈은 ${won(after.spend)}으로 그대로이고`;
  const save =
    after.save < 0
      ? `매달 ${won(-after.save)}이 모자라요`
      : after.save < now.save
        ? `모으는 돈은 ${won(after.save)}(${after.rate}%)으로 줄어요`
        : after.save > now.save
          ? `모으는 돈은 ${won(after.save)}(${after.rate}%)으로 늘어요`
          : `모으는 돈도 ${won(after.save)}(${after.rate}%)으로 그대로예요`;
  if (after.spend === now.spend && after.save === now.save) return '독립해도 쓰는 돈과 모으는 돈은 그대로예요.';
  return `독립하면 ${spend}, ${save}.`;
}

export function dedupeLines(lines) {
  const out = [];
  const seenRates = new Set();
  for (const line of lines) {
    if (out.includes(line)) continue;
    const rates = line.match(/\d+(?:\.\d+)?%/g) || [];
    const amounts = line.match(/\d[\d,]*만 원/g) || [];
    if (rates.length && !amounts.length && rates.every(r => seenRates.has(r))) continue;
    rates.forEach(r => seenRates.add(r));
    out.push(line);
  }
  return out;
}

export function buildPlanRoadmap(plan, policies = [], { rule = 'A' } = {}) {
  const at = month => monthLabel(plan.asOf, month);
  const byStep = groupByStep(policies);
  const { cashflow: cf, budget, core, profile, recommended } = plan;
  const rec = recommended[rule] || recommended.A;
  const goal = id => budget.planGoals.find(g => g.id === id);
  const original = id => plan.goals.find(g => g.id === id);
  const doneAt = id => {
    const month = rec.done[id];
    return month === null || month === undefined ? NEVER : month;
  };
  const doneLabel = id => (doneAt(id) === NEVER ? null : at(doneAt(id)));
  const pace = budget.plan.monthly;
  const h = plan.housing;
  const emergency = goal('emergency'),
    housing = goal('housing'),
    wedding = goal('wedding'),
    invest = goal('invest');
  const tag = id => original(id)?.label;

  const steps = [];
  const add = step => steps.push({ first: [], note: null, now: null, personal: [], policies: [], links: [], ...step });

  add({
    id: 'cashflow',
    month: 0,
    tags: [],
    title: '월 현금흐름 확인하기',
    figure: `쓰는 돈 ${won(cf.now.spend)} 나눠 적기`,
    now: `월 ${won(cf.now.save)} 저축 중`,
    why: '돈이 어디로 가는지 알아야, 얼마를 모을 수 있는지 계산할 수 있어요.',
    how: [
      `세후 월급 ${won(cf.income)}에서 매달 쓰는 돈 ${won(cf.now.spend)}을 고정지출(월세·통신비·보험)과 변동지출(식비·쇼핑)로 나눠 적어 봐요.`,
      '카드·통장 내역 최근 3개월치로 변동지출 평균을 잡아요. 한 달만 보면 들쭉날쭉해요.',
      `세후 월급 ${won(cf.income)} − 쓰는 돈 ${won(cf.now.spend)} = 남는 돈 ${won(cf.now.save)}. 실제로 통장에 남는 돈과 차이가 크면 빠진 지출이 있어요.`,
    ],
    links: [LINKS.accounts],
    personal: [
      `월급 ${won(cf.income)} 중 쓰는 돈 ${won(cf.now.spend)}, 모으는 돈 ${won(cf.now.save)}(월급의 ${cf.now.rate}%)이에요.`,
      ...(h ? [afterLine(cf)] : []),
      ...(plan.diagnosis.debt
        ? [
            `쓰는 돈 ${won(cf.now.spend)} 안에 매달 빚 갚는 돈 ${won(plan.diagnosis.debt.monthly)}이 들어 있어요. 따로 더 빼지 않아도 돼요.`,
          ]
        : []),
    ],
  });

  add({
    id: 'budget',
    month: 0,
    tags: [],
    title: '저축·생활비 목표 정하기',
    figure: pace > 0 ? `저축률 ${budget.plan.saveRate}%로 정하기` : '매달 모을 돈부터 만들기',
    now: `저축률 ${cf.now.rate}%`,
    why: '저축을 쓰고 남은 돈으로 두면 잘 안 모여요. 모을 몫을 먼저 정하면 생활비 상한이 정해져요.',
    how:
      pace > 0
        ? [
            `월급이 들어오면 ${won(budget.plan.monthly)}부터 먼저 떼어 모아요(선저축).`,
            `세후 월급 ${won(cf.income)} − 모을 돈 ${won(budget.plan.monthly)}${h ? ` − ${cf.housingName} ${won(cf.housingCost)}` : ''} = 한 달 생활비 상한 ${won(budget.plan.livingMax)}이에요.`,
            '상한을 넘는 달이 생기면 줄일 항목(구독·외식 등)을 미리 정해 둬요.',
          ]
        : [
            '카드·통장 내역에서 줄일 수 있는 지출(구독·외식·배달 등)을 한두 개 골라요.',
            '줄인 만큼을 월급날 바로 떼어 모아요. 처음엔 5만 원이어도 괜찮아요.',
          ],
    personal: [...plan.text],
    note: budget.verdict === 'extend' ? '지금 방식으로는 기한에 맞추기 어려워 기간을 늘리는 쪽으로 계산했어요.' : null,
    first: ['cashflow'],
  });

  // 첫 달에 목적별 통장으로 실제로 나눠 넣는 돈의 합 (다 채운 목표가 있으면 권장 저축보다 적을 수 있어요)
  const allocated = budget.planGoals.reduce((a, g) => a + Math.max(0, rec.firstMonth[g.id] || 0), 0);
  const autoTotal = allocated > 0 ? allocated : pace;
  add({
    id: 'saving_method',
    month: 0,
    tags: [],
    title: '통장 나누고 자동이체 걸기',
    figure: pace > 0 ? `매달 ${won(autoTotal)} 자동이체` : '목적별 통장 먼저 만들기',
    now: null,
    why: '목적별로 통장을 나누고 월급날 자동이체를 걸어 두면, 돈이 섞이지 않고 꾸준히 모여요.',
    how: [
      '목적별로 통장(또는 적금)을 나눠요. 이름을 "비상자금", "보증금"처럼 붙이면 헷갈리지 않아요.',
      pace > 0
        ? `월급이 들어온 다음 날로 매달 ${won(autoTotal)} 자동이체를 걸어요.`
        : '모을 돈이 생기면 월급이 들어온 다음 날로 자동이체를 걸어요.',
      `생활비 통장은 따로 두고, 생활비 상한 ${won(budget.plan.livingMax)}만큼만 옮겨 써요.`,
    ],
    links: [LINKS.accounts],
    personal: budget.planGoals
      .filter(g => (rec.firstMonth[g.id] || 0) > 0)
      .map(g => `${g.label} 통장에 월 ${won(rec.firstMonth[g.id])}`),
    policies: byStep.saving_method || [],
    first: ['budget'],
  });

  if (emergency) {
    const have = Math.min(profile.saved, emergency.target);
    add({
      id: 'emergency',
      month: doneAt('emergency'),
      tags: [tag('emergency')],
      title: `비상자금 ${won(emergency.target)} 채우기`,
      figure: `${won(emergency.target)}까지 모으기`,
      now: `${won(have)} 모음`,
      why: '갑자기 돈이 나갈 때 다른 목표 자금을 건드리지 않으려면 따로 둔 돈이 필요해요.',
      how: [
        `바로 꺼낼 수 있는 통장에 ${won(emergency.target)}까지 따로 모아요. 지금 ${won(have)}이 있어요.`,
        '다른 목표보다 먼저 채워요.',
        '쓰고 나면 다시 채우는 걸 첫 번째로 해요.',
      ],
      personal: [
        ...emergency.basis.slice(0, 1),
        have > 0
          ? `지금 모아둔 돈 중 ${won(have)}이 이미 있어요.`
          : '아직 모아둔 비상자금이 없어요. 적은 금액이라도 따로 떼어 두는 것부터 시작해요.',
        ...(doneLabel('emergency') ? [`${doneLabel('emergency')}에 목표를 채워요.`] : []),
        ...(budget.buffer
          ? [
              `리포트의 기본 목표 ${won(original('emergency').target)}에, 주거비 부담에 대비해 1개월치 ${won(budget.buffer)}을 더한 권장 목표예요.`,
            ]
          : []),
        ...(rule === 'B' && housing
          ? ['규칙 B: 비상자금은 일부만 먼저 채우고, 나머지는 주거 자금을 모은 뒤에 채워요.']
          : []),
      ],
      first: ['saving_method'],
    });
  }

  if (h && housing) {
    const afford = budget.housing.affordable;
    // 집 알아보기·계약·보증금 단계는 사용자가 입력한 입주 달에 맞춰요.
    const moveMonth = Math.max(0, h.moveInMonths ?? 0);
    const lead = n => Math.max(0, moveMonth - n);
    // 돈이 다 모이는 달은 리포트의 '다 모으는 때'와 같은 기준(지금 속도)으로 말해요.
    const ready = plan.scenarios.A.done.housing;
    const isBuy = h.type === '매매';
    const depositLabel = isBuy ? '집값' : '보증금';
    add({
      id: 'housing_budget',
      month: 0,
      tags: [tag('housing')],
      title: h.type === '월세' ? '월세·관리비 범위 정하기' : '집 예산 정하기',
      figure: h.rent
        ? afford.unrealistic
          ? '주거비와 생활비 함께 줄이기'
          : `${cf.housingName} ${won(afford.max)} 이하로`
        : `${depositLabel} ${won(h.deposit)} 안에서 정하기`,
      now: h.rent ? `계획 ${won(cf.housingCost)}` : h.interest ? `대출 이자 월 ${won(h.interest)}` : null,
      why: '매달 나가는 주거비가 저축 속도를 정해서, 집을 보기 전에 감당할 범위부터 정해야 해요.',
      how: [
        h.rent
          ? afford.unrealistic
            ? `${cf.housingName} ${won(cf.housingCost)}은 세후 월급의 ${cf.housingRate}%예요. 주거비만 줄여서는 저축을 지키기 어려워서, 생활비도 함께 줄일 항목을 정해요.`
            : `${cf.housingName} ${won(cf.housingCost)}은 세후 월급의 ${cf.housingRate}%예요. ${won(afford.max)} 이하로 맞추면 독립 후에도 저축을 지킬 수 있어요.`
          : '세후 월급 대비 주거비(월세+관리비) 비율을 계산해요. 일반적으로 30% 이하가 무리 없어요.',
        '보증금을 올리면 월세가 줄어드는 조합을 비교해요. 같은 집도 조건을 바꿔 물어볼 수 있어요.',
        '관리비에 포함된 항목(인터넷·수도 등)과 따로 내는 공과금을 확인해요.',
      ],
      links: [LINKS.realPrice],
      personal: [
        ...(h.rent
          ? [
              `계획한 ${cf.housingName} ${won(cf.housingCost)}은 월급의 ${cf.housingRate}%예요. 일반적으로 30% 이하를 권해요.`,
              !budget.housing.tooHigh
                ? '지금 계획은 독립 후 저축을 지킬 수 있는 범위예요.'
                : afford.unrealistic
                  ? `독립 후 저축을 지키려면 ${won(afford.max)} 이하여야 하는데, 이 금액으로는 집을 구하기 어려워요. 주거비와 함께 생활비도 줄여야 해요.`
                  : `독립 후에도 저축을 지키려면 ${won(afford.max)} 이하가 좋아요.`,
            ]
          : [
              `${isBuy ? '집값' : `${h.type} 보증금`} ${won(h.deposit)}${h.loan ? `, 대출 ${won(h.loan)}` : ''}으로 계산했어요.`,
            ]),
        ...(h.interest
          ? [
              `대출 이자를 연 4%로 잡으면 매달 약 ${won(h.interest)}이에요. 독립 후 매달 나가는 돈에 더했어요(원금 상환은 빼고 계산).`,
            ]
          : []),
        ...(plan.usedDefaults.some(k => ['deposit', 'rent', 'maintenance'].includes(k))
          ? ['모른다고 답한 값은 일반적인 기준값으로 계산했어요. 알아본 뒤 답변을 고치면 숫자가 바뀌어요.']
          : []),
      ],
      policies: byStep.housing_budget || [],
      first: ['budget'],
    });
    add({
      id: 'housing_search',
      month: lead(3),
      tags: [tag('housing')],
      title: '살 집 알아보기',
      figure: `${plan.region.split(' ').at(-1)}에서 집 후보 고르기`,
      now: null,
      why: '예산 안에서 갈 수 있는 지역·집 조건을 미리 알아보면 계약 때 서두르지 않아요.',
      how: [
        '예산과 출퇴근 시간으로 지역을 좁혀요.',
        '실거래가·시세를 공식 사이트에서 확인해요.',
        '청년 대상 공공 임대 공고가 있는지 봐요.',
      ],
      links: [LINKS.realPrice, LINKS.myHome],
      personal: [
        `${plan.region} 기준으로, ${depositLabel} ${won(h.deposit)}${h.rent ? `에 월세·관리비 ${won(h.rent + h.maintenance)}` : ''} 안쪽 집을 찾아요.`,
      ],
      policies: byStep.housing_search || [],
      first: ['housing_budget'],
    });
    // 보증금과 이사·초기 비용을 한 단계에서 함께 챙겨요 (계산은 이 단계에만)
    const own = Math.max(0, h.deposit - (h.loan || 0));
    add({
      id: 'housing_deposit',
      month: moveMonth,
      tags: [tag('housing')],
      title: `${depositLabel}·이사 비용 마련하기`,
      figure: `${won(housing.target)} 마련하기`,
      now: ready !== null && ready > moveMonth ? `지금 속도면 ${at(ready)}` : null,
      why: `${depositLabel}과 중개수수료·이사비·가전 같은 비용이 한꺼번에 들어가서, 미리 모아 둬야 해요.`,
      how: [
        `주거 통장에 매달 ${won(pace)}씩 자동이체로 모아요.`,
        '이사 업체 견적을 2~3곳에서 받아 비교하고, 가전·가구는 꼭 필요한 것부터 사요.',
        h.loan > 0
          ? `대출 ${won(h.loan)}의 금리와 상환 방식을 은행 2~3곳에서 비교해요.`
          : isBuy
            ? '모자라면 주택담보대출 조건을 공식 기관에서 확인해요.'
            : '모자라면 청년 대상 전월세 대출을 공식 기관에서 확인해요.',
      ],
      links: isBuy ? [] : [LINKS.fund],
      personal: [
        `예상 금액: ${depositLabel} ${won(h.deposit)}${h.loan > 0 ? ` − 대출 ${won(h.loan)}` : ''} + ${h.initialCosts
          .map(item => `${item.label} ${won(item.amount)}`)
          .join(' + ')} = ${won(housing.target)}`,
        ...(h.loan > 0 ? [`${depositLabel} 중 내 돈으로 모을 몫은 ${won(own)}이에요.`] : []),
        h.rent
          ? '중개수수료는 환산보증금(보증금 + 월세 × 100)에 요율을 곱한 추정값이에요.'
          : '중개수수료는 거래 금액에 요율을 곱한 추정값이에요.',
        ...(ready === null
          ? ['지금 저축으로는 마련하기 어려워요. 기간이나 목표를 조정해야 해요.']
          : ready <= moveMonth
            ? [
                `지금처럼 매달 ${won(profile.saveNow)}씩 모으면 ${at(ready)}에 마련해서, 입주하는 ${at(moveMonth)} 전에 준비가 끝나요.`,
              ]
            : [
                `입주하는 ${at(moveMonth)}까지 ${won(core.gap)}이 부족해요. 지금처럼 매달 ${won(profile.saveNow)}씩 모으면 ${at(ready)}에 마련해요.`,
              ]),
      ],
      policies: [...(byStep.housing_deposit || []), ...(byStep.move_in_cost || [])],
      first: ['emergency', 'saving_method'].filter(id => id !== 'emergency' || emergency),
    });
    add({
      id: 'contract_check',
      month: lead(1),
      tags: [tag('housing')],
      title: '계약 전 확인할 것 챙기기',
      figure: `${at(lead(1))}쯤 서류 확인하기`,
      now: null,
      why: '계약하고 나면 되돌리기 어려워서, 서명 전에 확인해야 해요.',
      how: isBuy
        ? [
            '등기부등본으로 집과 소유자 정보, 근저당이 있는지 확인해요.',
            '잔금 치르기 전에 등기부등본을 다시 떼어 바뀐 게 없는지 봐요.',
            '계약서 날짜와 특약을 읽어요.',
          ]
        : [
            '등기부등본으로 집과 집주인 정보를 확인해요.',
            `보증금 ${won(h.deposit)}을 지키는 반환보증(보증보험)에 들 수 있는지 알아봐요.`,
            '계약서 날짜와 특약을 읽어요.',
          ],
      links: isBuy ? [LINKS.registry] : [LINKS.registry, LINKS.hug],
      personal: [
        isBuy
          ? '잔금을 치르는 날 소유권 이전 등기를 바로 신청해요.'
          : `계약한 보증금 ${won(h.deposit)}을 지키려면 전입신고와 확정일자를 입주 당일에 받아요.`,
        `입주하려는 ${at(moveMonth)} 기준으로 계약은 ${at(lead(1))}쯤이에요.`,
      ],
      policies: byStep.contract_check || [],
      first: ['housing_search'],
    });
  }

  if (wedding) {
    const sim = plan.scenarios.A.atDeadline.find(item => item.id === 'wedding');
    const monthly = Math.ceil(wedding.target / Math.max(1, wedding.deadline));
    add({
      id: 'wedding',
      month: doneAt('wedding'),
      tags: [tag('wedding')],
      title: `결혼 내 몫 ${won(wedding.target)} 모으기`,
      figure: `${won(wedding.target)} 모으기`,
      now: null,
      why: '결혼 비용은 한 번에 크게 들어가서, 기한에서 거꾸로 계산해 매달 모을 돈을 정해야 해요.',
      how: ['항목별 예상 비용을 적어요.', '배우자·가족과 부담 비율을 의논해요.', '신혼집은 주거 계획과 함께 봐요.'],
      personal: [
        ...wedding.basis,
        `${wedding.deadline}개월 안에 모으려면 매달 ${won(monthly)}이 필요해요.`,
        ...(sim && sim.shortfall > 0 ? [`지금 저축 속도로는 기한에 ${won(sim.shortfall)}이 부족해요.`] : []),
      ],
      first: emergency ? ['emergency'] : ['saving_method'],
    });
  }

  if (plan.diagnosis.debt) {
    const d = plan.diagnosis.debt;
    const debtGoal = goal('debt');
    add({
      id: 'debt',
      month: debtGoal ? doneAt('debt') : 0,
      tags: [tag('debt')].filter(Boolean),
      title: '빚 상환 계획 세우기',
      figure: d.months ? `${d.months}개월 안에 다 갚기` : `${won(d.remain)} 갚기`,
      now: `남은 빚 ${won(d.remain)}`,
      why: '매달 갚는 금액과 끝나는 때를 알아야 저축 계획을 현실적으로 세울 수 있어요.',
      how: [
        `남은 ${won(d.remain)}, 매달 ${won(d.monthly)}. 대출별 금리를 적고, 금리가 높은 것부터 먼저 갚을지 비교해요.`,
        '먼저 갚을 대출이 있는지 비교해요.',
        '일찍 갚을 때 수수료(중도상환수수료)가 있는지 확인해요.',
      ],
      links: [LINKS.fine],
      personal: [
        `남은 ${won(d.remain)}을 매달 ${won(d.monthly)}씩 갚으면 ${d.doneLabel ?? '언제 끝날지 알 수 없어요'}에 다 갚아요.`,
        ...(debtGoal ? debtGoal.basis : []),
        ...(d.doneLabel ? [`다 갚고 나면 매달 ${won(d.monthly)}을 더 모을 수 있어요.`] : []),
      ],
      first: ['cashflow'],
    });
  }

  if (invest) {
    const start = rec.investStart;
    // 다른 목표를 채운 뒤 매달 남는 돈 안에서만 넣을 수 있어요 (리포트와 같은 기준)
    const room = Math.max(0, plan.housing ? cf.after.save : cf.now.save);
    const possible = Math.min(invest.monthlyCap, room);
    add({
      id: 'invest',
      month: start === null || possible <= 0 ? NEVER : start,
      tags: [tag('invest')],
      title: '남는 돈으로 투자 시작하기',
      figure: possible > 0 ? `월 ${won(possible)} 안에서만 투자` : '남는 돈이 생기면 투자하기',
      now: null,
      why: '비상자금과 다른 목표를 채운 뒤 남는 돈 안에서만 투자해야 생활이 흔들리지 않아요.',
      how: [
        '투자 기간과 매달 넣을 금액을 먼저 정해요.',
        '손실이 나도 생활에 지장 없는 돈인지 확인해요.',
        '상품은 공식 비교 자료로 직접 확인해요. FinPath는 상품을 추천하지 않아요.',
      ],
      personal: [
        ...(start === null || possible <= 0
          ? ['지금 저축으로는 다른 목표를 채우고 나서 남는 돈이 없어요.']
          : [
              `${at(start)}부터 매달 최대 ${won(possible)}을 넣을 수 있어요.`,
              ...(possible < invest.monthlyCap
                ? [`원하는 ${won(invest.monthlyCap)} 중 남는 돈으로는 매달 ${won(possible)}까지예요.`]
                : []),
              `${invest.months}개월 동안 넣으면 원금 ${won(possible * invest.months)}이에요. 수익률은 가정하지 않았어요.`,
            ]),
      ],
      first: ['saving_method'],
    });
  }

  if (core.deadline !== null && (core.gap > 0 || budget.verdict === 'extend')) {
    add({
      id: 'review',
      month: core.deadline,
      tags: [],
      title: `${core.deadlineLabel} 계획 점검하기`,
      figure: core.gap > 0 ? `부족한 ${won(core.gap)} 메울 방법 고르기` : '기한에 맞는지 점검하기',
      now: core.gap > 0 ? `지금 속도면 ${won(core.gap)} 부족` : null,
      why: '정한 기한에 맞는지 점검하고, 부족하면 기간·생활비·목표 중 무엇을 조정할지 정해야 해요.',
      how: [
        '그달에 주거·비상자금 통장 잔액을 합쳐 계획한 금액과 비교해요.',
        '부족하면 아래 세 가지(기간·생활비·목표 금액) 중 하나를 골라 조정해요.',
        '조정한 뒤 답변을 고치면 지도가 다시 계산돼요.',
      ],
      personal: [
        ...(core.gap > 0 ? [`지금 속도로는 ${core.deadlineLabel}에 ${won(core.gap)}이 부족해요.`] : []),
        ...plan.fixes.map(fix => `${fix.title}: ${fix.headline}. ${fix.detail}`),
      ],
      first: ['saving_method'],
    });
  }

  // 기한이 이른 순으로 정렬하고(같으면 위 순서 유지), 같은 시점끼리 묶습니다.
  const sorted = steps
    .map((step, i) => ({ step, i }))
    .sort((a, b) => a.step.month - b.step.month || a.i - b.i)
    .map(({ step }) => step);
  const ids = sorted.map(step => step.id);
  const built = sorted.map((step, index) => ({
    ...step,
    personal: dedupeLines(step.personal),
    number: index + 1,
    phase: `m${step.month}`,
    phaseLabel: step.month === 0 ? '지금' : step.month === NEVER ? '모을 수 있게 되면' : at(step.month),
    tags: step.tags.length ? step.tags : [profile.purposes.length ? '내 돈 상황' : '내 돈 상황'],
    first: step.first.filter(id => ids.indexOf(id) > -1 && ids.indexOf(id) < index),
  }));
  built.forEach((step, i) => {
    step.next = built[i + 1]?.title || CLOSING;
  });
  const groups = [];
  for (const step of built) {
    const last = groups.at(-1);
    if (last?.phase === step.phase) last.steps.push(step);
    else groups.push({ phase: step.phase, label: step.phaseLabel, steps: [step] });
  }
  return {
    status: 'complete',
    situation: [plan.region, ...profile.purposes],
    deferred: [],
    steps: built,
    groups,
  };
}
