// GitHub Pages 배포 때만(GITHUB_PAGES=true) 정적 사이트로 내보냅니다.
// 로컬 npm run dev / build / start는 기존과 같습니다.
const isPages = process.env.GITHUB_PAGES === 'true';

const nextConfig = isPages
  ? {
      output: 'export',
      basePath: process.env.PAGES_BASE_PATH ?? '/FinPath',
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {};

export default nextConfig;
