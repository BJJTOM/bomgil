"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "@/lib/api";

interface LegalDoc {
  id: number;
  slug: string;
  slug_display: string;
  title: string;
  body_markdown: string;
  version: string;
  effective_from: string;
  is_published: boolean;
  updated_at: string;
}

const SLUGS = [
  { value: "terms", label: "이용약관" },
  { value: "privacy", label: "개인정보처리방침" },
  { value: "location-terms", label: "위치기반서비스 이용약관" },
  { value: "location-privacy", label: "위치정보 처리방침" },
  { value: "marketing-consent", label: "마케팅 수신 동의" },
];

export default function LegalAdminPage() {
  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [activeSlug, setActiveSlug] = useState<string>("terms");
  const [editing, setEditing] = useState<LegalDoc | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Partial<LegalDoc>>({});
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/community/admin/legal/", {
        params: { slug: activeSlug },
      });
      setDocs(data);
    } catch {
      setMessage("목록을 불러오지 못했습니다. 관리자 권한을 확인하세요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    setEditing(null);
    setCreating(false);

  }, [activeSlug]);

  const startCreate = () => {
    const defaultTitle = SLUGS.find((s) => s.value === activeSlug)?.label ?? "";
    setDraft({
      slug: activeSlug,
      title: defaultTitle,
      body_markdown: "",
      version: "1.0",
      effective_from: new Date().toISOString().slice(0, 10),
      is_published: false,
    });
    setCreating(true);
    setEditing(null);
    setPreview(false);
  };

  const startEdit = (doc: LegalDoc) => {
    setDraft(doc);
    setEditing(doc);
    setCreating(false);
    setPreview(false);
  };

  const save = async () => {
    try {
      if (creating) {
        await api.post("/community/admin/legal/", draft);
        setMessage("새 버전이 생성되었습니다.");
      } else if (editing) {
        await api.patch(`/community/admin/legal/${editing.id}/`, draft);
        setMessage("저장되었습니다.");
      }
      setCreating(false);
      setEditing(null);
      setDraft({});
      load();
    } catch {
      setMessage("저장에 실패했습니다. 입력값을 확인하세요.");
    }
  };

  const remove = async (doc: LegalDoc) => {
    if (!confirm(`v${doc.version}을(를) 삭제하시겠습니까? 되돌릴 수 없습니다.`)) return;
    try {
      await api.delete(`/community/admin/legal/${doc.id}/`);
      setMessage("삭제되었습니다.");
      load();
    } catch {
      setMessage("삭제에 실패했습니다.");
    }
  };

  return (
    <div className="md:pt-[60px] min-h-screen bg-warm pb-24">
      <div className="max-w-4xl mx-auto px-5 pt-14 md:pt-6">
        <h1 className="text-[22px] font-bold mb-2">약관·방침 관리</h1>
        <p className="text-[12px] text-text-tertiary mb-4">
          Markdown(GFM)으로 작성합니다. 공개 중인 문서를 수정하면 즉시
          반영됩니다. 법적 이력 보존을 위해 큰 변경은 <b>새 버전 추가</b>를
          권장합니다.
        </p>

        {/* Slug tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {SLUGS.map((s) => (
            <button
              key={s.value}
              onClick={() => setActiveSlug(s.value)}
              className={`px-3 py-1.5 rounded-full text-[13px] ${
                activeSlug === s.value
                  ? "bg-gray-900 text-white"
                  : "bg-white border border-gray-200 text-text-secondary"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {message && (
          <div className="mb-4 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-[13px]">
            {message}
          </div>
        )}

        {/* Version list */}
        <div className="card p-4 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-[15px]">
              {SLUGS.find((s) => s.value === activeSlug)?.label} — 버전 이력
            </h2>
            <button
              onClick={startCreate}
              className="bg-gray-900 text-white px-3 py-1.5 rounded text-[13px] font-medium"
            >
              + 새 버전 추가
            </button>
          </div>
          {loading ? (
            <p className="text-text-tertiary text-[13px]">불러오는 중…</p>
          ) : docs.length === 0 ? (
            <p className="text-text-tertiary text-[13px]">아직 버전이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {docs.map((doc) => (
                <li key={doc.id} className="py-2 flex justify-between items-center">
                  <div>
                    <span className="font-medium">v{doc.version}</span>{" "}
                    <span className="text-text-tertiary text-[12px]">
                      시행 {doc.effective_from}
                    </span>{" "}
                    {doc.is_published && (
                      <span className="ml-2 text-[11px] px-2 py-0.5 bg-green-100 text-green-700 rounded">
                        공개
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 text-[12px]">
                    <button onClick={() => startEdit(doc)} className="underline">
                      편집
                    </button>
                    <button
                      onClick={() => remove(doc)}
                      className="underline text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Editor */}
        {(creating || editing) && (
          <div className="card p-4 space-y-3">
            <h2 className="font-bold text-[15px]">
              {creating ? "새 버전" : `v${editing?.version} 편집`}
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <LabeledInput
                label="제목"
                value={draft.title ?? ""}
                onChange={(v) => setDraft({ ...draft, title: v })}
              />
              <LabeledInput
                label="버전"
                value={draft.version ?? ""}
                onChange={(v) => setDraft({ ...draft, version: v })}
              />
              <LabeledInput
                label="시행일"
                type="date"
                value={draft.effective_from ?? ""}
                onChange={(v) => setDraft({ ...draft, effective_from: v })}
              />
              <label className="flex items-center gap-2 mt-5">
                <input
                  type="checkbox"
                  checked={!!draft.is_published}
                  onChange={(e) =>
                    setDraft({ ...draft, is_published: e.target.checked })
                  }
                />
                <span className="text-[13px]">공개 (체크 시 사용자에게 노출)</span>
              </label>
            </div>

            <div className="flex justify-between items-center mt-3">
              <label className="text-[13px] font-medium">본문 (Markdown)</label>
              <button
                onClick={() => setPreview(!preview)}
                className="text-[12px] underline text-text-tertiary"
              >
                {preview ? "편집 모드" : "미리보기"}
              </button>
            </div>
            {preview ? (
              <div className="border rounded p-4 legal-markdown bg-white min-h-[300px]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {draft.body_markdown ?? ""}
                </ReactMarkdown>
              </div>
            ) : (
              <textarea
                value={draft.body_markdown ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, body_markdown: e.target.value })
                }
                className="w-full min-h-[400px] font-mono text-[13px] p-3 border rounded"
                placeholder="# 제목\n\n내용을 Markdown으로 작성..."
              />
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                  setDraft({});
                }}
                className="px-4 py-2 text-[13px] border border-gray-200 rounded"
              >
                취소
              </button>
              <button
                onClick={save}
                className="px-4 py-2 text-[13px] bg-gray-900 text-white rounded font-medium"
              >
                저장
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[13px] text-text-secondary mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded text-[14px]"
      />
    </label>
  );
}
