"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "@/lib/api";

interface LegalDocument {
  slug: string;
  slug_display: string;
  title: string;
  body_markdown: string;
  version: string;
  effective_from: string;
  updated_at: string;
}

export function LegalDocumentView({ slug }: { slug: string }) {
  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/community/legal/${slug}/`)
      .then((res) => {
        if (!cancelled) setDoc(res.data);
      })
      .catch(() => {
        if (!cancelled)
          setError("문서를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <div className="card p-6 text-[14px] text-text-secondary">{error}</div>
    );
  }
  if (!doc) {
    return (
      <div className="card p-6 space-y-3">
        <div className="animate-pulse bg-gray-200 rounded-md h-5 w-3/4" />
        <div className="animate-pulse bg-gray-200 rounded-md h-4 w-full" />
        <div className="animate-pulse bg-gray-200 rounded-md h-4 w-5/6" />
        <div className="animate-pulse bg-gray-200 rounded-md h-4 w-4/6" />
      </div>
    );
  }

  return (
    <article className="card p-6 legal-markdown text-[14px] text-text-secondary leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {doc.body_markdown}
      </ReactMarkdown>
      <p className="text-[12px] text-text-tertiary mt-6 pt-4 border-t border-gray-200">
        버전 {doc.version} · 시행일 {doc.effective_from} · 최종 수정{" "}
        {new Date(doc.updated_at).toLocaleDateString("ko-KR")}
      </p>
    </article>
  );
}
