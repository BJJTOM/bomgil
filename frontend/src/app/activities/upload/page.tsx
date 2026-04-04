"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCreateActivity, useCreateActivityJSON } from "@/hooks/useActivities";

const SOURCES = [
  { value: "manual_gpx", label: "GPX 파일 업로드", icon: "📁", desc: "Garmin, Strava 등에서 내보낸 GPX 파일" },
  { value: "apple_watch", label: "Apple Watch", icon: "⌚", desc: "Apple 건강 앱에서 내보낸 데이터" },
  { value: "garmin", label: "Garmin", icon: "⌚", desc: "Garmin Connect 데이터" },
  { value: "samsung_health", label: "Samsung Health", icon: "📱", desc: "삼성 헬스 운동 기록" },
  { value: "google_fit", label: "Google Fit", icon: "📱", desc: "Google Fit 걸기 데이터" },
  { value: "cashwalk", label: "캐시워크", icon: "🚶", desc: "캐시워크 걸음 기록" },
  { value: "phone_gps", label: "스마트폰 GPS", icon: "📍", desc: "직접 GPS 기록" },
  { value: "strava", label: "Strava", icon: "🏃", desc: "Strava 활동 데이터" },
];

export default function UploadActivityPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState("manual_gpx");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [steps, setSteps] = useState("");
  const [calories, setCalories] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const createActivity = useCreateActivity();
  const createActivityJSON = useCreateActivityJSON();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.gpx$/i, ""));
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (source === "manual_gpx" && file) {
        const formData = new FormData();
        formData.append("gpx_file", file);
        formData.append("source", source);
        if (title) formData.append("title", title);
        if (steps) formData.append("total_steps", steps);
        if (calories) formData.append("calories_burned", calories);
        await createActivity.mutateAsync(formData);
      } else {
        await createActivityJSON.mutateAsync({
          source,
          title,
          total_steps: steps ? parseInt(steps) : undefined,
          calories_burned: calories ? parseInt(calories) : undefined,
          track_points: [],
        });
      }
      router.push("/activities");
    } catch (err) {
      console.error(err);
      alert("업로드에 실패했어요. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-warm pb-24 pt-14 md:pt-20">
      <div className="max-w-2xl mx-auto px-5">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-[13px] text-text-secondary mb-4 hover:text-text-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          뒤로
        </button>

        <h1 className="text-[22px] font-bold tracking-tight mb-1">활동 기록 추가</h1>
        <p className="text-[13px] text-text-tertiary mb-6">GPX 파일 업로드 또는 수동 입력</p>

        {/* Source Select */}
        <div className="mb-6">
          <label className="text-[13px] font-semibold mb-2.5 block">데이터 소스</label>
          <div className="grid grid-cols-2 gap-2">
            {SOURCES.map((s) => (
              <button
                key={s.value}
                onClick={() => setSource(s.value)}
                className={`p-3.5 rounded-card border text-left transition-all ${
                  source === s.value
                    ? "border-primary bg-primary-50 ring-1 ring-primary/20"
                    : "border-border-light bg-white hover:border-primary/30"
                }`}
              >
                <span className="text-xl">{s.icon}</span>
                <p className="text-[13px] font-semibold mt-1">{s.label}</p>
                <p className="text-[11px] text-text-tertiary mt-0.5 line-clamp-1">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* GPX Upload */}
        {source === "manual_gpx" && (
          <div className="mb-6">
            <label className="text-[13px] font-semibold mb-2.5 block">GPX 파일</label>
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-card p-8 text-center cursor-pointer transition-colors ${
                file ? "border-primary bg-primary-50/30" : "border-border-light hover:border-primary/40"
              }`}
            >
              {file ? (
                <div>
                  <p className="text-3xl mb-2">✅</p>
                  <p className="text-[14px] font-medium">{file.name}</p>
                  <p className="text-[12px] text-text-tertiary mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-3xl mb-2">📂</p>
                  <p className="text-[14px] font-medium">GPX 파일을 선택하세요</p>
                  <p className="text-[12px] text-text-tertiary mt-1">Garmin, Strava, Apple Watch 등에서 내보내기</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".gpx,application/gpx+xml"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {/* Title */}
        <div className="mb-4">
          <label className="text-[13px] font-semibold mb-2 block">제목 (선택)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 성수동 오후 산책"
            className="input-field"
          />
        </div>

        {/* Manual Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div>
            <label className="text-[13px] font-semibold mb-2 block">걸음수 (선택)</label>
            <input
              type="number"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder="8,500"
              className="input-field"
            />
          </div>
          <div>
            <label className="text-[13px] font-semibold mb-2 block">칼로리 (선택)</label>
            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="350"
              className="input-field"
            />
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-primary-50/50 border border-primary/10 rounded-card p-4 mb-6">
          <p className="text-[13px] font-medium text-primary mb-1">💡 더 정확한 기록을 위해</p>
          <ul className="text-[12px] text-text-secondary space-y-1">
            <li>• GPX 파일에는 GPS 경로, 고도, 시간 정보가 포함됩니다</li>
            <li>• Apple Watch, Garmin 등의 앱에서 GPX로 내보내기 가능해요</li>
            <li>• 걸음수와 칼로리는 기기에서 확인 후 수동 입력해주세요</li>
          </ul>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || (source === "manual_gpx" && !file)}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "업로드 중..." : "기록 저장하기"}
        </button>
      </div>
    </div>
  );
}
