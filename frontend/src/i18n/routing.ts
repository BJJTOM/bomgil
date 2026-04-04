import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ko", "en", "ja"],
  defaultLocale: "ko",
  localePrefix: "as-needed", // ko는 prefix 생략, en/ja는 명시
});
