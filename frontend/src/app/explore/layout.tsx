import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "코스 탐색 — Moru",
  description:
    "전 세계 도보여행 코스를 탐색하세요. 난이도, 지역, 시즌별로 필터링할 수 있습니다. Discover walking trails worldwide.",
  openGraph: {
    title: "코스 탐색 — Moru",
    description:
      "전 세계 도보여행 코스를 탐색하세요. 난이도, 지역, 시즌별로 필터링할 수 있습니다.",
    type: "website",
    siteName: "Moru",
  },
  twitter: {
    card: "summary_large_image",
    title: "코스 탐색 — Moru",
    description:
      "전 세계 도보여행 코스를 탐색하세요. 난이도, 지역, 시즌별로 필터링할 수 있습니다.",
  },
};

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
