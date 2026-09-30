import { Noto_Sans_KR } from 'next/font/google';
import './globals.css';

const notoSansKr = Noto_Sans_KR({ weight: ['400', '500', '700'], display: 'swap', preload: false });

export const metadata = { title: 'FinPath | 금융 정보 내비게이션', description: '지금 상황을 말하면 무엇을 어떤 순서로 알아봐야 하는지 금융 지도로 보여주는 FinPath 데모' };
export default function RootLayout({ children }) { return <html lang="ko" className={notoSansKr.className}><body>{children}</body></html>; }
