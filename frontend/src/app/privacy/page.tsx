"use client";

import Link from "next/link";
import { LegalDocumentView } from "@/components/LegalDocumentView";

export default function PrivacyPage() {
  return (
    <div className="md:pt-[60px] min-h-screen bg-warm pb-24">
      <div className="max-w-2xl mx-auto px-5 pt-14 md:pt-6">
        <h1 className="text-[22px] font-bold mb-4">개인정보처리방침</h1>
        <LegalDocumentView slug="privacy" />
        <div className="mt-4 text-[12px] text-text-tertiary">
          관련 문서:{" "}
          <Link href="/terms" className="underline">이용약관</Link>,{" "}
          <Link href="/terms/location" className="underline">위치기반서비스 약관</Link>,{" "}
          <Link href="/privacy/location" className="underline">위치정보 처리방침</Link>,{" "}
          <Link href="/terms/marketing" className="underline">마케팅 수신 동의</Link>
        </div>
      </div>
    </div>
  );
}
