// GitHub Pages 배포 때만(GITHUB_PAGES=true) 정적 사이트로 내보냅니다.
// 로컬 npm run dev / build / start는 기존과 같습니다.
const isPages = process.env.GITHUB_PAGES === 'true';

const basePath = process.env.PAGES_BASE_PATH ?? '/FinPath';

const nextConfig = isPages
  ? {
      output: 'export',
      basePath,
      trailingSlash: true,
      images: { unoptimized: true },
      // 리포트 공유 링크를 만들 때 씁니다 (lib/report/share.js)
      env: { NEXT_PUBLIC_BASE_PATH: basePath, NEXT_PUBLIC_TRAILING_SLASH: '1' },
    }
  : {};

export default nextConfig;
