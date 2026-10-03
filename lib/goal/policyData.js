// 화면이 쓰는 정책 목록. 손으로 확인한 정책을 먼저, 보조금24 API로 받은 정책은 이름이 겹치지 않을 때만 뒤에 붙입니다.
import { mergePolicies } from './gov24.js';
import manualPolicies from '../../data/policies.json';
import gov24Policies from '../../data/policies-gov24.json';

export const policyData = {
  checked_at: manualPolicies.checked_at,
  fetched_at: gov24Policies.fetched_at,
  policies: mergePolicies(manualPolicies.policies, gov24Policies.policies),
};
