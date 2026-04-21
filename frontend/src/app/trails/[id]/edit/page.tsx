"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { useT } from "@/stores/language";
import { ImageUploader } from "@/components/ImageUploader";
import { MapView } from "@/components/MapView";
import api from "@/lib/api";
import type { Trail } from "@/types";

// ── i18n labels ──────────────────────────────────────────────────────────────

const L = {
  pageTitle: { ko: "코스 수정", en: "Edit Trail", ja: "コース編集", zh: "编辑路线" },
  pageDesc: { ko: "코스 정보를 수정합니다", en: "Update trail information", ja: "コース情報を修正します", zh: "修改路线信息" },
  noAuth: { ko: "권한이 없습니다", en: "No permission", ja: "権限がありません", zh: "没有权限" },
  noAuthDesc: { ko: "이 코스를 수정할 권한이 없습니다.", en: "You don't have permission to edit this trail.", ja: "このコースを編集する権限がありません。", zh: "您没有权限编辑此路线。" },
  loginRequired: { ko: "로그인이 필요합니다", en: "Login required", ja: "ログインが必要です", zh: "需要登录" },
  loginDesc: { ko: "코스를 수정하려면 먼저 로그인해주세요.", en: "Please log in to edit trails.", ja: "コースを編集するにはログインしてください。", zh: "请先登录以编辑路线。" },
  login: { ko: "로그인하기", en: "Log in", ja: "ログイン", zh: "登录" },
  goBack: { ko: "돌아가기", en: "Go back", ja: "戻る", zh: "返回" },
  loading: { ko: "불러오는 중...", en: "Loading...", ja: "読み込み中...", zh: "加载中..." },
  // Steps
  step1: { ko: "기본 정보", en: "Basic Info", ja: "基本情報", zh: "基本信息" },
  step2: { ko: "코스 상세", en: "Trail Details", ja: "コース詳細", zh: "路线详情" },
  step3: { ko: "이미지 & 확인", en: "Image & Confirm", ja: "画像 & 確認", zh: "图片 & 确认" },
  // Fields
  title: { ko: "코스 제목", en: "Trail Title", ja: "コースタイトル", zh: "路线标题" },
  description: { ko: "코스 설명", en: "Description", ja: "コース説明", zh: "路线描述" },
  region: { ko: "지역", en: "Region", ja: "地域", zh: "地区" },
  country: { ko: "국가", en: "Country", ja: "国", zh: "国家" },
  trailType: { ko: "코스 타입", en: "Trail Type", ja: "コースタイプ", zh: "路线类型" },
  surface: { ko: "노면 상태", en: "Surface", ja: "路面状態", zh: "路面状况" },
  difficulty: { ko: "난이도", en: "Difficulty", ja: "難易度", zh: "难度" },
  season: { ko: "추천 시즌", en: "Best Season", ja: "おすすめ時期", zh: "推荐季节" },
  duration: { ko: "소요시간 (분)", en: "Duration (min)", ja: "所要時間 (分)", zh: "所需时间 (分钟)" },
  distance: { ko: "거리 (km)", en: "Distance (km)", ja: "距離 (km)", zh: "距离 (km)" },
  elevation: { ko: "고도 변화 (m)", en: "Elevation Gain (m)", ja: "標高差 (m)", zh: "爬升 (m)" },
  transport: { ko: "대중교통 접근", en: "Transport Access", ja: "アクセス", zh: "交通" },
  multiDay: { ko: "여러 날 코스", en: "Multi-day", ja: "複数日コース", zh: "多日路线" },
  multiDayDesc: { ko: "1박 이상 소요되는 코스인가요?", en: "Does this trail take more than one day?", ja: "1泊以上のコースですか？", zh: "此路线需要一天以上吗？" },
  totalDays: { ko: "총 일수", en: "Total Days", ja: "合計日数", zh: "总天数" },
  coverImage: { ko: "커버 이미지", en: "Cover Image", ja: "カバー画像", zh: "封面图片" },
  coverImageKeep: { ko: "현재 이미지를 유지하려면 새 이미지를 업로드하지 마세요.", en: "Leave empty to keep the current image.", ja: "現在の画像を維持するには新しい画像をアップロードしないでください。", zh: "留空以保留当前图片。" },
  currentImage: { ko: "현재 커버 이미지", en: "Current cover image", ja: "現在のカバー画像", zh: "当前封面图片" },
  preview: { ko: "수정 미리보기", en: "Edit Preview", ja: "編集プレビュー", zh: "编辑预览" },
  // Buttons
  prev: { ko: "이전", en: "Previous", ja: "前へ", zh: "上一步" },
  next: { ko: "다음", en: "Next", ja: "次へ", zh: "下一步" },
  submit: { ko: "수정 완료", en: "Save Changes", ja: "変更を保存", zh: "保存修改" },
  submitting: { ko: "수정 중...", en: "Saving...", ja: "保存中...", zh: "保存中..." },
  success: { ko: "수정이 완료되었습니다!", en: "Changes saved!", ja: "変更が保存されました！", zh: "修改已保存！" },
  successDesc: { ko: "잠시 후 코스 페이지로 이동합니다...", en: "Redirecting to trail page...", ja: "コースページに移動します...", zh: "正在跳转到路线页面..." },
  errorFetch: { ko: "코스 정보를 불러올 수 없습니다.", en: "Failed to load trail.", ja: "コース情報を読み込めません。", zh: "无法加载路线信息。" },
  errorSubmit: { ko: "수정에 실패했습니다. 다시 시도해주세요.", en: "Failed to save. Please try again.", ja: "保存に失敗しました。もう一度お試しください。", zh: "保存失败，请重试。" },
  required: { ko: "필수", en: "Required", ja: "必須", zh: "必填" },
  mapPreview: { ko: "경로 지도", en: "Route Map", ja: "ルートマップ", zh: "路线地图" },
  routeNote: { ko: "경로(좌표) 수정은 현재 지원되지 않습니다. 기본 정보만 수정 가능합니다.", en: "Route/coordinate editing is not supported yet. Only basic info can be edited.", ja: "ルート（座標）の編集はまだサポートされていません。基本情報のみ編集できます。", zh: "暂不支持路线（坐标）编辑。仅可编辑基本信息。" },
} as const;

const COUNTRIES = [
  { code: "KR", label: { ko: "한국", en: "Korea", ja: "韓国", zh: "韩国" }, flag: "\uD83C\uDDF0\uD83C\uDDF7" },
  { code: "JP", label: { ko: "일본", en: "Japan", ja: "日本", zh: "日本" }, flag: "\uD83C\uDDEF\uD83C\uDDF5" },
  { code: "TW", label: { ko: "대만", en: "Taiwan", ja: "台湾", zh: "台湾" }, flag: "\uD83C\uDDF9\uD83C\uDDFC" },
  { code: "TH", label: { ko: "태국", en: "Thailand", ja: "タイ", zh: "泰国" }, flag: "\uD83C\uDDF9\uD83C\uDDED" },
  { code: "US", label: { ko: "미국", en: "USA", ja: "アメリカ", zh: "美国" }, flag: "\uD83C\uDDFA\uD83C\uDDF8" },
  { code: "GB", label: { ko: "영국", en: "UK", ja: "イギリス", zh: "英国" }, flag: "\uD83C\uDDEC\uD83C\uDDE7" },
  { code: "FR", label: { ko: "프랑스", en: "France", ja: "フランス", zh: "法国" }, flag: "\uD83C\uDDEB\uD83C\uDDF7" },
  { code: "ES", label: { ko: "스페인", en: "Spain", ja: "スペイン", zh: "西班牙" }, flag: "\uD83C\uDDEA\uD83C\uDDF8" },
];

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: { ko: "여유롭게", en: "Easy", ja: "のんびり", zh: "轻松" }, emoji: "\uD83D\uDEB6" },
  { value: "moderate", label: { ko: "보통", en: "Moderate", ja: "普通", zh: "适中" }, emoji: "\uD83E\uDDB6" },
  { value: "hard", label: { ko: "도전적", en: "Hard", ja: "チャレンジ", zh: "挑战" }, emoji: "\uD83E\uDD7E" },
];

const TRAIL_TYPES = [
  { value: "urban", label: { ko: "도심", en: "Urban", ja: "都市", zh: "城市" }, emoji: "\uD83C\uDFD9\uFE0F" },
  { value: "coastal", label: { ko: "해안", en: "Coastal", ja: "海岸", zh: "海岸" }, emoji: "\uD83C\uDF0A" },
  { value: "village", label: { ko: "마을", en: "Village", ja: "村", zh: "乡村" }, emoji: "\uD83C\uDFD8\uFE0F" },
  { value: "cultural", label: { ko: "문화", en: "Cultural", ja: "文化", zh: "文化" }, emoji: "\uD83C\uDFDB\uFE0F" },
  { value: "nature", label: { ko: "자연", en: "Nature", ja: "自然", zh: "自然" }, emoji: "\uD83C\uDF3F" },
  { value: "mixed", label: { ko: "복합", en: "Mixed", ja: "複合", zh: "混合" }, emoji: "\uD83D\uDDFA\uFE0F" },
];

const SURFACE_OPTIONS = [
  { value: "paved", label: { ko: "포장", en: "Paved", ja: "舗装", zh: "铺装" } },
  { value: "mixed", label: { ko: "혼합", en: "Mixed", ja: "混合", zh: "混合" } },
  { value: "unpaved", label: { ko: "비포장", en: "Unpaved", ja: "未舗装", zh: "未铺装" } },
];

const SEASON_OPTIONS = [
  { value: "all", label: { ko: "사계절", en: "All Year", ja: "通年", zh: "全年" } },
  { value: "spring", label: { ko: "봄", en: "Spring", ja: "春", zh: "春" } },
  { value: "summer", label: { ko: "여름", en: "Summer", ja: "夏", zh: "夏" } },
  { value: "fall", label: { ko: "가을", en: "Fall", ja: "秋", zh: "秋" } },
  { value: "winter", label: { ko: "겨울", en: "Winter", ja: "冬", zh: "冬" } },
];

type LangKey = "ko" | "en" | "ja" | "zh";

function l(obj: Record<string, string>, lang: string): string {
  return obj[lang] || obj.en || obj.ko;
}

// ── Form state type ─────────────────────────────────────────────────────────

interface EditForm {
  title: string;
  description: string;
  region: string;
  country: string;
  difficulty: string;
  best_season: string;
  estimated_minutes: number;
  distance_km: string;
  elevation_gain: string;
  trail_type: string;
  walking_surface: string;
  transport_access: string;
  is_multi_day: boolean;
  total_days: number;
}

// ── Page component ──────────────────────────────────────────────────────────

export default function EditTrailPage() {
  const { id } = useParams();
  const trailId = Number(id);
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const { language } = useT();
  const lang = language as LangKey;

  const [trail, setTrail] = useState<Trail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [notAuthor, setNotAuthor] = useState(false);

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);

  const [form, setForm] = useState<EditForm>({
    title: "",
    description: "",
    region: "",
    country: "KR",
    difficulty: "moderate",
    best_season: "all",
    estimated_minutes: 60,
    distance_km: "",
    elevation_gain: "",
    trail_type: "urban",
    walking_surface: "paved",
    transport_access: "",
    is_multi_day: false,
    total_days: 1,
  });

  const STEPS = [l(L.step1, lang), l(L.step2, lang), l(L.step3, lang)];

  // ── Fetch trail data ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!trailId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/trails/${trailId}/`);
        if (cancelled) return;
        setTrail(data);

        // Check ownership
        const authorId = data.author?.id;
        const currentUserId = useAuthStore.getState().user?.id;
        if (!currentUserId || authorId !== currentUserId) {
          setNotAuthor(true);
          setLoading(false);
          return;
        }

        // Populate form
        setForm({
          title: data.title || "",
          description: data.description || "",
          region: data.region || "",
          country: data.country || "KR",
          difficulty: data.difficulty || "moderate",
          best_season: data.best_season || "all",
          estimated_minutes: data.estimated_minutes || 60,
          distance_km: data.distance_km ? String(data.distance_km) : "",
          elevation_gain: data.elevation_gain ? String(data.elevation_gain) : "",
          trail_type: data.trail_type || "urban",
          walking_surface: data.walking_surface || "paved",
          transport_access: data.transport_access || "",
          is_multi_day: data.is_multi_day || false,
          total_days: data.total_days || 1,
        });
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setFetchError(l(L.errorFetch, lang));
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [trailId, lang]);

  // ── Auth guard ──────────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div className="md:pt-16 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">{"\uD83D\uDD12"}</div>
          <h2 className="text-xl font-bold mb-2">{l(L.loginRequired, lang)}</h2>
          <p className="text-text-secondary mb-6">{l(L.loginDesc, lang)}</p>
          <a href="/auth/login" className="inline-block bg-primary text-white px-6 py-3 rounded-button font-medium">
            {l(L.login, lang)}
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="md:pt-16 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">{"\u23F3"}</div>
          <p className="text-text-secondary">{l(L.loading, lang)}</p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="md:pt-16 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">{"\u26A0\uFE0F"}</div>
          <p className="text-text-secondary mb-4">{fetchError}</p>
          <button onClick={() => router.back()} className="text-primary font-medium hover:underline">
            {l(L.goBack, lang)}
          </button>
        </div>
      </div>
    );
  }

  if (notAuthor) {
    return (
      <div className="md:pt-16 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">{"\uD83D\uDEAB"}</div>
          <h2 className="text-xl font-bold mb-2">{l(L.noAuth, lang)}</h2>
          <p className="text-text-secondary mb-6">{l(L.noAuthDesc, lang)}</p>
          <button
            onClick={() => router.push(`/trails/${trailId}`)}
            className="inline-block bg-primary text-white px-6 py-3 rounded-button font-medium"
          >
            {l(L.goBack, lang)}
          </button>
        </div>
      </div>
    );
  }

  // ── Success screen ──────────────────────────────────────────────────────────

  if (submitSuccess) {
    return (
      <div className="md:pt-16 flex items-center justify-center min-h-screen">
        <div className="text-center animate-fade-in">
          <div className="text-7xl mb-6">{"\u2705"}</div>
          <h2 className="text-2xl font-bold mb-2">{l(L.success, lang)}</h2>
          <p className="text-text-secondary">{l(L.successDesc, lang)}</p>
        </div>
      </div>
    );
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  const updateForm = (key: string, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = (): string[] => {
    const errors: string[] = [];
    if (!form.title.trim()) errors.push(lang === "ko" ? "코스 제목을 입력해주세요." : "Trail title is required.");
    if (!form.description.trim()) errors.push(lang === "ko" ? "코스 설명을 입력해주세요." : "Description is required.");
    return errors;
  };

  const canProceedStep = (step: number): boolean => {
    if (step === 0) return !!(form.title.trim() && form.description.trim());
    return true;
  };

  const handleNext = () => {
    if (!canProceedStep(currentStep)) {
      setValidationErrors([
        !form.title.trim() && (lang === "ko" ? "코스 제목을 입력해주세요." : "Trail title is required."),
        !form.description.trim() && (lang === "ko" ? "코스 설명을 입력해주세요." : "Description is required."),
      ].filter(Boolean) as string[]);
      return;
    }
    setValidationErrors([]);
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handlePrev = () => {
    setValidationErrors([]);
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    const errors = validate();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();

      // Append all form fields
      formData.append("title", form.title);
      formData.append("description", form.description);
      if (form.region) formData.append("region", form.region);
      formData.append("country", form.country);
      formData.append("difficulty", form.difficulty);
      formData.append("best_season", form.best_season);
      formData.append("estimated_minutes", String(form.estimated_minutes));
      if (form.distance_km) formData.append("distance_km", form.distance_km);
      if (form.elevation_gain) formData.append("elevation_gain", form.elevation_gain);
      formData.append("trail_type", form.trail_type);
      formData.append("walking_surface", form.walking_surface);
      if (form.transport_access) formData.append("transport_access", form.transport_access);
      formData.append("is_multi_day", String(form.is_multi_day));
      if (form.is_multi_day) formData.append("total_days", String(form.total_days));

      // Only append cover image if user uploaded a new one
      if (newImages.length > 0) {
        formData.append("cover_image", newImages[0]);
      }

      await api.patch(`/trails/${trailId}/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSubmitSuccess(true);
      setTimeout(() => {
        router.push(`/trails/${trailId}`);
      }, 1500);
    } catch (error: any) {
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        l(L.errorSubmit, lang);
      setSubmitError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const diffObj = DIFFICULTY_OPTIONS.find((d) => d.value === form.difficulty);
  const typeObj = TRAIL_TYPES.find((t) => t.value === form.trail_type);
  const countryObj = COUNTRIES.find((c) => c.code === form.country);
  const surfaceObj = SURFACE_OPTIONS.find((s) => s.value === form.walking_surface);
  const pathCoords = trail?.path_data?.coordinates || [];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="md:pt-16 max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-title mb-2">{l(L.pageTitle, lang)}</h1>
      <p className="text-text-secondary text-sm mb-8">{l(L.pageDesc, lang)}</p>

      {/* Validation errors banner */}
      {validationErrors.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-card p-4">
          <div className="flex items-start gap-2">
            <span className="text-red-500 text-lg">{"\u26A0\uFE0F"}</span>
            <div>
              {validationErrors.map((err, i) => (
                <p key={i} className="text-sm text-red-600">{err}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          {STEPS.map((step, index) => (
            <div key={index} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  index <= currentStep ? "bg-primary text-white" : "bg-gray-200 text-text-secondary"
                }`}
              >
                {index < currentStep ? "\u2713" : index + 1}
              </div>
              {index < STEPS.length - 1 && (
                <div className={`h-0.5 w-8 sm:w-16 md:w-24 mx-1 transition-colors ${
                  index < currentStep ? "bg-primary" : "bg-gray-200"
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between">
          {STEPS.map((step, index) => (
            <span key={index} className={`text-xs ${index <= currentStep ? "text-primary font-medium" : "text-text-secondary"}`}>
              {step}
            </span>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="min-h-[400px]">
        {/* ─── Step 1: Basic Info ─── */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <SectionCard title={l(L.step1, lang)}>
              <div className="space-y-5">
                <Field label={l(L.title, lang)} required lang={lang}>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => updateForm("title", e.target.value)}
                    maxLength={100}
                    className="input-field"
                  />
                  <CharCount current={form.title.length} max={100} />
                </Field>
                <Field label={l(L.description, lang)} required lang={lang}>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateForm("description", e.target.value)}
                    rows={4}
                    maxLength={1000}
                    className="input-field resize-none"
                  />
                  <CharCount current={form.description.length} max={1000} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title={lang === "ko" ? "지역 정보" : lang === "ja" ? "地域情報" : lang === "zh" ? "地区信息" : "Region Info"}>
              <div className="grid grid-cols-2 gap-4">
                <Field label={l(L.region, lang)} lang={lang}>
                  <input
                    type="text"
                    value={form.region}
                    onChange={(e) => updateForm("region", e.target.value)}
                    className="input-field"
                  />
                </Field>
                <Field label={l(L.country, lang)} lang={lang}>
                  <select
                    value={form.country}
                    onChange={(e) => updateForm("country", e.target.value)}
                    className="input-field"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {l(c.label, lang)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </SectionCard>

            <SectionCard title={l(L.trailType, lang)}>
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-2">
                  {TRAIL_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => updateForm("trail_type", t.value)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                        form.trail_type === t.value
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-2xl">{t.emoji}</span>
                      <span className={`text-xs font-medium ${
                        form.trail_type === t.value ? "text-primary" : "text-text-secondary"
                      }`}>
                        {l(t.label, lang)}
                      </span>
                    </button>
                  ))}
                </div>

                <Field label={l(L.surface, lang)} lang={lang}>
                  <div className="flex gap-2">
                    {SURFACE_OPTIONS.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => updateForm("walking_surface", s.value)}
                        className={`flex-1 py-2.5 px-4 rounded-full text-sm font-medium border-2 transition-all ${
                          form.walking_surface === s.value
                            ? "border-primary bg-primary text-white"
                            : "border-gray-200 text-text-secondary hover:border-gray-300"
                        }`}
                      >
                        {l(s.label, lang)}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ─── Step 2: Trail Details ─── */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <SectionCard title={l(L.difficulty, lang) + " & " + l(L.duration, lang)}>
              <div className="space-y-5">
                <Field label={l(L.difficulty, lang)} lang={lang}>
                  <div className="flex gap-2">
                    {DIFFICULTY_OPTIONS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => updateForm("difficulty", d.value)}
                        className={`flex-1 py-2.5 px-4 rounded-full text-sm font-medium border-2 transition-all ${
                          form.difficulty === d.value
                            ? "border-primary bg-primary text-white"
                            : "border-gray-200 text-text-secondary hover:border-gray-300"
                        }`}
                      >
                        {d.emoji} {l(d.label, lang)}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label={l(L.season, lang)} lang={lang}>
                    <select
                      value={form.best_season}
                      onChange={(e) => updateForm("best_season", e.target.value)}
                      className="input-field"
                    >
                      {SEASON_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {l(s.label, lang)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={l(L.duration, lang)} lang={lang}>
                    <input
                      type="number"
                      value={form.estimated_minutes}
                      onChange={(e) => updateForm("estimated_minutes", parseInt(e.target.value) || 0)}
                      min={0}
                      className="input-field"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label={l(L.distance, lang)} lang={lang}>
                    <input
                      type="text"
                      value={form.distance_km}
                      onChange={(e) => updateForm("distance_km", e.target.value)}
                      className="input-field"
                    />
                  </Field>
                  <Field label={l(L.elevation, lang)} lang={lang}>
                    <input
                      type="text"
                      value={form.elevation_gain}
                      onChange={(e) => updateForm("elevation_gain", e.target.value)}
                      className="input-field"
                    />
                  </Field>
                </div>

                {/* Multi-day toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <span className="text-sm font-medium text-text-primary">{l(L.multiDay, lang)}</span>
                    <p className="text-xs text-text-secondary mt-0.5">{l(L.multiDayDesc, lang)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateForm("is_multi_day", !form.is_multi_day)}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      form.is_multi_day ? "bg-primary" : "bg-gray-300"
                    }`}
                  >
                    <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                      form.is_multi_day ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
                {form.is_multi_day && (
                  <Field label={l(L.totalDays, lang)} lang={lang}>
                    <input
                      type="number"
                      value={form.total_days}
                      onChange={(e) => updateForm("total_days", Math.max(1, parseInt(e.target.value) || 1))}
                      min={1}
                      max={30}
                      className="input-field"
                    />
                  </Field>
                )}
              </div>
            </SectionCard>

            <SectionCard title={l(L.transport, lang)}>
              <Field label={l(L.transport, lang)} lang={lang}>
                <input
                  type="text"
                  value={form.transport_access}
                  onChange={(e) => updateForm("transport_access", e.target.value)}
                  className="input-field"
                />
              </Field>
            </SectionCard>

            {/* Route note */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <span className="text-blue-500 text-lg">{"\u2139\uFE0F"}</span>
                <p className="text-sm text-blue-700">{l(L.routeNote, lang)}</p>
              </div>
            </div>

            {/* Map preview (read-only) */}
            {trail && trail.start_lat && trail.start_lng && (
              <SectionCard title={l(L.mapPreview, lang)}>
                <div className="h-64 rounded-xl overflow-hidden border border-gray-200">
                  <MapView
                    country={trail.country}
                    center={{
                      lat: parseFloat(trail.start_lat),
                      lng: parseFloat(trail.start_lng),
                    }}
                    pathCoordinates={pathCoords}
                    markers={[
                      {
                        id: 1,
                        lat: parseFloat(trail.start_lat),
                        lng: parseFloat(trail.start_lng),
                        title: lang === "ko" ? "출발" : "Start",
                        emoji: "\uD83D\uDEA9",
                      },
                      ...(trail.end_lat && trail.end_lng
                        ? [{
                            id: 2,
                            lat: parseFloat(trail.end_lat),
                            lng: parseFloat(trail.end_lng),
                            title: lang === "ko" ? "도착" : "End",
                            emoji: "\uD83C\uDFC1",
                          }]
                        : []),
                    ]}
                  />
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {/* ─── Step 3: Image & Confirm ─── */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <SectionCard title={l(L.coverImage, lang)}>
              {/* Current cover image */}
              {trail?.cover_image && (
                <div className="mb-4">
                  <p className="text-xs text-text-secondary mb-2">{l(L.currentImage, lang)}</p>
                  <div className="h-40 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                    <img
                      src={trail.cover_image}
                      alt={trail.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
              <ImageUploader images={newImages} onChange={setNewImages} maxFiles={1} />
              <p className="text-xs text-text-secondary mt-2">{l(L.coverImageKeep, lang)}</p>
            </SectionCard>

            {/* Preview card */}
            <SectionCard title={l(L.preview, lang)}>
              <div className="bg-white rounded-2xl shadow-soft overflow-hidden border border-gray-100">
                {/* Header image */}
                {(newImages.length > 0 || trail?.cover_image) ? (
                  <div className="h-40 bg-gray-100 relative overflow-hidden">
                    <img
                      src={newImages.length > 0 ? URL.createObjectURL(newImages[0]) : trail!.cover_image}
                      alt={form.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                      <h3 className="text-white font-bold text-lg">{form.title || "(--)"}</h3>
                    </div>
                  </div>
                ) : (
                  <div className="h-32 bg-gray-100 flex items-center justify-center">
                    <span className="text-text-secondary text-sm">
                      {lang === "ko" ? "커버 이미지 미등록" : "No cover image"}
                    </span>
                  </div>
                )}

                <div className="p-4 space-y-3">
                  {/* Tags row */}
                  <div className="flex flex-wrap gap-1.5">
                    {countryObj && (
                      <span className="text-xs px-2.5 py-1 bg-gray-100 rounded-full">
                        {countryObj.flag} {l(countryObj.label, lang)}
                      </span>
                    )}
                    {form.region && (
                      <span className="text-xs px-2.5 py-1 bg-gray-100 rounded-full">{form.region}</span>
                    )}
                    {typeObj && (
                      <span className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-full">
                        {typeObj.emoji} {l(typeObj.label, lang)}
                      </span>
                    )}
                    {diffObj && (
                      <span className="text-xs px-2.5 py-1 bg-gray-100 rounded-full">
                        {diffObj.emoji} {l(diffObj.label, lang)}
                      </span>
                    )}
                    {surfaceObj && (
                      <span className="text-xs px-2.5 py-1 bg-gray-100 rounded-full">
                        {l(surfaceObj.label, lang)}
                      </span>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 text-center py-2">
                    <div>
                      <div className="text-lg font-bold text-primary">
                        {form.distance_km || "-"}{" "}
                        <span className="text-xs font-normal text-text-secondary">km</span>
                      </div>
                      <div className="text-xs text-text-secondary">
                        {l(L.distance, lang).replace(" (km)", "")}
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-primary">
                        {form.estimated_minutes}{" "}
                        <span className="text-xs font-normal text-text-secondary">
                          {lang === "ko" ? "분" : lang === "ja" ? "分" : lang === "zh" ? "分钟" : "min"}
                        </span>
                      </div>
                      <div className="text-xs text-text-secondary">
                        {l(L.duration, lang).replace(/ \(.*\)/, "")}
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-primary">
                        {form.elevation_gain || "-"}{" "}
                        <span className="text-xs font-normal text-text-secondary">m</span>
                      </div>
                      <div className="text-xs text-text-secondary">
                        {l(L.elevation, lang).replace(/ \(.*\)/, "")}
                      </div>
                    </div>
                  </div>

                  {form.description && (
                    <p className="text-sm text-text-secondary line-clamp-2">{form.description}</p>
                  )}

                  {form.transport_access && (
                    <div className="flex items-center gap-2 text-xs text-text-secondary bg-gray-50 rounded-lg p-2">
                      <span>{"\uD83D\uDE89"}</span>
                      <span>{form.transport_access}</span>
                    </div>
                  )}

                  {form.is_multi_day && (
                    <div className="flex items-center gap-2 text-xs text-text-secondary bg-gray-50 rounded-lg p-2">
                      <span>{"\uD83C\uDFD5\uFE0F"}</span>
                      <span>{form.total_days}{lang === "ko" ? "일 코스" : lang === "ja" ? "日コース" : lang === "zh" ? "天路线" : " day trail"}</span>
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* Submit error */}
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <span className="text-red-500">{"\u274C"}</span>
                  <div>
                    <p className="text-sm font-medium text-red-700">
                      {lang === "ko" ? "수정 실패" : "Update failed"}
                    </p>
                    <p className="text-sm text-red-600 mt-1">{submitError}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t">
        <button
          onClick={handlePrev}
          disabled={currentStep === 0}
          className={`px-6 py-3 rounded-button text-sm font-medium transition-all ${
            currentStep === 0 ? "text-gray-300 cursor-not-allowed" : "text-text-primary hover:bg-gray-100"
          }`}
        >
          {l(L.prev, lang)}
        </button>
        {currentStep === STEPS.length - 1 ? (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-8 py-3 bg-primary text-white rounded-button text-sm font-bold hover:shadow-hover transition-all disabled:opacity-50"
          >
            {isSubmitting ? l(L.submitting, lang) : l(L.submit, lang)}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-8 py-3 bg-primary text-white rounded-button text-sm font-bold hover:shadow-hover transition-all"
          >
            {l(L.next, lang)}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Utility Components ──────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-5 border border-gray-100">
      <h3 className="text-base font-bold text-text-primary mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  lang,
  children,
}: {
  label: string;
  required?: boolean;
  lang?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-text-primary block mb-2">
        {label}
        {required && <span className="text-danger ml-1 text-xs align-top">*</span>}
      </label>
      {children}
    </div>
  );
}

function CharCount({ current, max }: { current: number; max: number }) {
  return (
    <div className="flex justify-end mt-1">
      <span className={`text-xs ${current > max * 0.9 ? "text-danger" : "text-text-secondary"}`}>
        {current}/{max}
      </span>
    </div>
  );
}
