// 리포트 공유 링크: 서버 없이, 계산에 쓴 프로필을 링크 안에 담아 보냅니다.
// 받은 사람은 같은 리포트를 보기만 하고, 그 사람 브라우저에는 저장하지 않아요.
// 링크에 입력한 숫자(월급 등)가 들어가므로 공유 전에 화면에서 안내합니다.
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

export function encodeShare(profile, { demo = false } = {}) {
  return toBase64Url(JSON.stringify({ v: VERSION, d: demo ? 1 : 0, p: profile }));
}

// 잘못되거나 손상된 링크면 null
export function decodeShare(code) {
  if (!code || typeof code !== 'string' || code.length > 8000) return null;
  try {
    const data = JSON.parse(fromBase64Url(code));
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
