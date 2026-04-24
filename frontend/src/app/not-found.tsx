import Link from "next/link";

export const metadata = {
  title: "페이지를 찾을 수 없어요 · Moru",
};

export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="text-[60px] leading-none mb-4 select-none">🧭</div>
        <h1 className="text-[22px] font-bold text-text-primary mb-2">
          길을 잃으셨나요?
        </h1>
        <p className="text-[14px] text-text-secondary mb-6 leading-relaxed">
          찾으시는 페이지가 사라졌거나, 주소가 잘못 입력된 것 같아요.
          <br />
          지도에서 다시 시작해 볼까요?
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/explore"
            className="inline-flex items-center justify-center rounded-full bg-primary text-white px-5 py-2.5 text-[14px] font-semibold hover:bg-primary/90 transition"
          >
            코스 둘러보기
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-white dark:bg-gray-900 border border-border-default text-text-primary px-5 py-2.5 text-[14px] font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            홈으로
          </Link>
        </div>
        <p className="mt-8 text-[11px] font-en text-text-tertiary tracking-wider">
          404 · PAGE NOT FOUND
        </p>
      </div>
    </main>
  );
}
