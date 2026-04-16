"use client";

import { useT } from "@/stores/language";

const LICENSES = [
  { name: "Next.js", license: "MIT", url: "https://github.com/vercel/next.js" },
  { name: "React", license: "MIT", url: "https://github.com/facebook/react" },
  { name: "Tailwind CSS", license: "MIT", url: "https://github.com/tailwindlabs/tailwindcss" },
  { name: "Leaflet", license: "BSD-2-Clause", url: "https://github.com/Leaflet/Leaflet" },
  { name: "Axios", license: "MIT", url: "https://github.com/axios/axios" },
  { name: "TanStack Query", license: "MIT", url: "https://github.com/TanStack/query" },
  { name: "Zustand", license: "MIT", url: "https://github.com/pmndrs/zustand" },
  { name: "Mapbox GL JS", license: "BSD-3-Clause", url: "https://github.com/mapbox/mapbox-gl-js" },
  { name: "@rnmapbox/maps", license: "MIT", url: "https://github.com/rnmapbox/maps" },
  { name: "React Native", license: "MIT", url: "https://github.com/facebook/react-native" },
  { name: "Django", license: "BSD-3-Clause", url: "https://github.com/django/django" },
  { name: "Django REST Framework", license: "BSD-3-Clause", url: "https://github.com/encode/django-rest-framework" },
];

export default function LicensesPage() {
  const { language } = useT();
  const ko = language === "ko";

  return (
    <div className="md:pt-16 max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">{ko ? "오픈소스 라이선스" : "Open Source Licenses"}</h1>
      <p className="text-[13px] text-text-tertiary mb-6">
        {ko ? "Moru는 다음 오픈소스 소프트웨어를 사용합니다." : "Moru uses the following open source software."}
      </p>

      <div className="bg-white rounded-card shadow-soft overflow-hidden divide-y divide-border-light">
        {LICENSES.map((lib) => (
          <a
            key={lib.name}
            href={lib.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-4 py-3.5 hover:bg-bg-secondary transition-colors"
          >
            <div>
              <p className="text-[14px] font-medium">{lib.name}</p>
              <p className="text-[12px] text-text-tertiary">{lib.license}</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-tertiary)" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  );
}
