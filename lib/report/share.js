// 기본 공유는 목적만 허용 목록으로 직렬화합니다. 원본 프로필은 명시적으로 전체 공개를 선택할 때만 담습니다.
// 기존 v1 링크는 호환성을 위해 읽을 수 있으며, 이미 발행한 링크를 서버에서 취소할 수는 없습니다.
import { validateProfile } from '../goal/engine.js';

const VERSION = 1;

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(code) {
  const base64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
}

export function encodeShare(profile, { demo = false, includeAmounts = false } = {}) {
  if (!includeAmounts) return toBase64Url(JSON.stringify({ v: 2, purposes: profile.purposes }));
  return toBase64Url(JSON.stringify({ v: VERSION, d: demo ? 1 : 0, p: profile }));
}

// 잘못되거나 손상된 링크면 null
export function decodeShare(code) {
  if (!code || typeof code !== 'string' || code.length > 8000) return null;
  try {
    const data = JSON.parse(fromBase64Url(code));
    if (data?.v === 2) {
      if (
        !Array.isArray(data.purposes) ||
        data.purposes.length > 3 ||
        !data.purposes.every(p => ['비상자금', '주거', '투자', '결혼', '빚 상환'].includes(p))
      )
        return null;
      return { masked: true, purposes: data.purposes };
    }
    if (data?.v !== VERSION || !data.p || validateProfile(data.p).length) return null;
    return { profile: data.p, demo: data.d === 1 };
  } catch {
    return null;
  }
}

// 지금 사이트 주소 기준의 공유 링크 (GitHub Pages에서는 /FinPath/report/)
export function shareUrl(profile, options) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const slash = process.env.NEXT_PUBLIC_TRAILING_SLASH ? '/' : '';
  return `${window.location.origin}${base}/report${slash}?r=${encodeShare(profile, options)}`;
}
