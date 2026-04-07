"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

export default function PasswordChangePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isAuthenticated) {
    router.replace("/auth/login");
    return null;
  }

  const canSubmit = currentPw.length >= 1 && newPw.length >= 8 && newPw === confirmPw;

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setError(""); setLoading(true);
    try {
      await api.post("/auth/password/change/", { old_password: currentPw, new_password1: newPw, new_password2: confirmPw });
      setSuccess(true);
      setTimeout(() => router.push("/settings"), 1500);
    } catch (e: any) {
      const msg = e?.response?.data?.old_password?.[0] || e?.response?.data?.new_password2?.[0] || e?.response?.data?.detail || "비밀번호 변경에 실패했습니다.";
      setError(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="md:pt-[60px] min-h-screen bg-white">
      <header className="sticky top-0 md:top-[60px] z-30 bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-lg">←</button>
          <span className="text-[16px] font-semibold text-gray-900">비밀번호 변경</span>
          <div className="w-8" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-8 space-y-5">
        {success ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">✓</div>
            <p className="text-[16px] font-semibold text-gray-900 mb-1">비밀번호가 변경되었습니다</p>
            <p className="text-sm text-gray-400">설정으로 돌아갑니다...</p>
          </div>
        ) : (
          <>
            {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

            <div>
              <label className="text-[13px] font-medium text-gray-500 block mb-2">현재 비밀번호</label>
              <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)}
                className="w-full bg-gray-50 rounded-xl px-4 py-3 text-[15px] outline-none text-gray-900 placeholder-gray-300"
                placeholder="현재 비밀번호 입력" />
            </div>

            <div>
              <label className="text-[13px] font-medium text-gray-500 block mb-2">새 비밀번호</label>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                className="w-full bg-gray-50 rounded-xl px-4 py-3 text-[15px] outline-none text-gray-900 placeholder-gray-300"
                placeholder="8자 이상" />
              {newPw.length > 0 && newPw.length < 8 && <p className="text-xs text-red-500 mt-1">8자 이상 입력해주세요</p>}
            </div>

            <div>
              <label className="text-[13px] font-medium text-gray-500 block mb-2">새 비밀번호 확인</label>
              <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full bg-gray-50 rounded-xl px-4 py-3 text-[15px] outline-none text-gray-900 placeholder-gray-300"
                placeholder="새 비밀번호 다시 입력" />
              {confirmPw.length > 0 && newPw !== confirmPw && <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다</p>}
            </div>

            <button onClick={handleSubmit} disabled={!canSubmit || loading}
              className={`w-full py-3.5 rounded-xl text-[15px] font-semibold transition-colors ${canSubmit ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"}`}>
              {loading ? "변경 중..." : "비밀번호 변경"}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
