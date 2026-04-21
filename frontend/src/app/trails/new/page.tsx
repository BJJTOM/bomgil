"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StepForm } from "@/components/StepForm";
import { ImageUploader } from "@/components/ImageUploader";
import { MapView } from "@/components/MapView";
import { TrailDrawMap } from "@/components/TrailDrawMap";
import { useAuthStore } from "@/stores/auth";
import api from "@/lib/api";

const STEPS = ["기본 정보", "경로 그리기", "경유지 등록", "이미지 & 확인"];

const COUNTRIES = [
  { code: "KR", label: "한국", flag: "\uD83C\uDDF0\uD83C\uDDF7" },
  { code: "JP", label: "일본", flag: "\uD83C\uDDEF\uD83C\uDDF5" },
  { code: "TW", label: "대만", flag: "\uD83C\uDDF9\uD83C\uDDFC" },
  { code: "TH", label: "태국", flag: "\uD83C\uDDF9\uD83C\uDDED" },
  { code: "US", label: "미국", flag: "\uD83C\uDDFA\uD83C\uDDF8" },
  { code: "GB", label: "영국", flag: "\uD83C\uDDEC\uD83C\uDDE7" },
  { code: "FR", label: "프랑스", flag: "\uD83C\uDDEB\uD83C\uDDF7" },
  { code: "ES", label: "스페인", flag: "\uD83C\uDDEA\uD83C\uDDF8" },
];

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "여유롭게", emoji: "\uD83D\uDEB6" },
  { value: "moderate", label: "보통", emoji: "\uD83E\uDDB6" },
  { value: "hard", label: "도전적", emoji: "\uD83E\uDD7E" },
];

const TRAIL_TYPES = [
  { value: "urban", label: "도심", emoji: "\uD83C\uDFD9\uFE0F" },
  { value: "coastal", label: "해안", emoji: "\uD83C\uDF0A" },
  { value: "village", label: "마을", emoji: "\uD83C\uDFD8\uFE0F" },
  { value: "cultural", label: "문화", emoji: "\uD83C\uDFDB\uFE0F" },
  { value: "nature", label: "자연", emoji: "\uD83C\uDF3F" },
  { value: "mixed", label: "복합", emoji: "\uD83D\uDDFA\uFE0F" },
];

const SURFACE_OPTIONS = [
  { value: "paved", label: "포장" },
  { value: "mixed", label: "혼합" },
  { value: "unpaved", label: "비포장" },
];

const SPOT_TYPES = [
  { value: "start", label: "출발", emoji: "\uD83D\uDEA9" },
  { value: "restaurant", label: "맛집", emoji: "\uD83C\uDF5C" },
  { value: "cafe", label: "카페", emoji: "\u2615" },
  { value: "photo", label: "포토스팟", emoji: "\uD83D\uDCF8" },
  { value: "rest", label: "휴식", emoji: "\uD83E\uDE91" },
  { value: "view", label: "전망", emoji: "\uD83C\uDF04" },
  { value: "danger", label: "주의구간", emoji: "\u26A0\uFE0F" },
  { value: "market", label: "시장", emoji: "\uD83D\uDED2" },
  { value: "gallery", label: "갤러리", emoji: "\uD83C\uDFA8" },
  { value: "temple", label: "사찰/성당", emoji: "\u26E9\uFE0F" },
  { value: "accommodation", label: "숙소", emoji: "\uD83C\uDFE8" },
  { value: "transport", label: "교통", emoji: "\uD83D\uDE89" },
  { value: "tip", label: "꿀팁", emoji: "\uD83D\uDCA1" },
  { value: "toilet", label: "화장실", emoji: "\uD83D\uDEBB" },
  { value: "water", label: "식수대", emoji: "\uD83D\uDEB0" },
  { value: "store", label: "편의점/매점", emoji: "\uD83C\uDFEA" },
  { value: "pharmacy", label: "약국", emoji: "\uD83D\uDC8A" },
  { value: "hospital", label: "병원/의원", emoji: "\uD83C\uDFE5" },
  { value: "police", label: "경찰서/파출소", emoji: "\uD83D\uDC6E" },
  { value: "parking", label: "주차장", emoji: "\uD83C\uDD7F\uFE0F" },
  { value: "end", label: "도착", emoji: "\uD83C\uDFC1" },
];

const SEASON_OPTIONS = [
  { value: "all", label: "사계절" },
  { value: "spring", label: "봄" },
  { value: "summer", label: "여름" },
  { value: "fall", label: "가을" },
  { value: "winter", label: "겨울" },
];

interface SpotForm {
  name: string;
  spot_type: string;
  lat: string;
  lng: string;
  description: string;
  menu_highlight: string;
  price_range: string;
  tip: string;
  is_must_visit: boolean;
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function NewTrailPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [isCircular, setIsCircular] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    region: "",
    country: "KR",
    difficulty: "moderate",
    best_season: "all",
    estimated_minutes: 60,
    distance_km: "",
    elevation_gain: "",
    start_lat: "",
    start_lng: "",
    end_lat: "",
    end_lng: "",
    trail_type: "urban",
    walking_surface: "paved",
    transport_access: "",
    is_multi_day: false,
    total_days: 1,
  });

  const [spots, setSpots] = useState<SpotForm[]>([]);

  // Trail drawing state
  const [drawMode, setDrawMode] = useState(true); // true = draw on map, false = manual coordinates
  const [pathCoords, setPathCoords] = useState<[number, number][]>([]); // [lng, lat]
  const [drawDistance, setDrawDistance] = useState(0);
  const [drawDuration, setDrawDuration] = useState(0);

  // Hydrate from sessionStorage if a walk record was staged for trail creation
  // (legacy entry point — retained for external callers that still set this key).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") !== "walk") return;
    try {
      const raw = sessionStorage.getItem("moru_walk_to_trail");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data.pathCoords || data.pathCoords.length < 2) return;
      const start = data.pathCoords[0];
      const end = data.pathCoords[data.pathCoords.length - 1];
      setPathCoords(data.pathCoords);
      setDrawDistance(data.distance || 0);
      setDrawDuration(Math.round((data.duration || 0) / 60));
      setForm((prev) => ({
        ...prev,
        start_lng: String(start[0]),
        start_lat: String(start[1]),
        end_lng: String(end[0]),
        end_lat: String(end[1]),
        distance_km: (data.distance || 0).toFixed(2),
        estimated_minutes: Math.round((data.duration || 0) / 60) || prev.estimated_minutes,
        elevation_gain: data.eleGain ? String(data.eleGain) : prev.elevation_gain,
      }));
      setDrawMode(false); // user already walked the route; show manual fields with prefilled data
      sessionStorage.removeItem("moru_walk_to_trail");
    } catch {}
  }, []);

  const handleDrawChange = useCallback(
    (data: {
      waypoints: [number, number][];
      routeCoords: [number, number][];
      distanceKm: number;
      durationMin: number;
    }) => {
      setPathCoords(data.routeCoords);
      setDrawDistance(data.distanceKm);
      setDrawDuration(data.durationMin);
      if (data.routeCoords.length >= 2) {
        const start = data.routeCoords[0];
        const end = data.routeCoords[data.routeCoords.length - 1];
        setForm((prev) => ({
          ...prev,
          start_lng: String(start[0]),
          start_lat: String(start[1]),
          end_lng: String(end[0]),
          end_lat: String(end[1]),
          distance_km: data.distanceKm.toFixed(2),
          estimated_minutes: data.durationMin || prev.estimated_minutes,
        }));
      }
    },
    [],
  );

  // Auto-calculate distance when coordinates change
  useEffect(() => {
    const sLat = parseFloat(form.start_lat);
    const sLng = parseFloat(form.start_lng);
    const eLat = parseFloat(form.end_lat);
    const eLng = parseFloat(form.end_lng);

    if (!isNaN(sLat) && !isNaN(sLng) && !isNaN(eLat) && !isNaN(eLng)) {
      const dist = haversineDistance(sLat, sLng, eLat, eLng);
      setForm((prev) => ({ ...prev, distance_km: dist.toFixed(2) }));
    }
  }, [form.start_lat, form.start_lng, form.end_lat, form.end_lng]);

  // Sync circular course
  useEffect(() => {
    if (isCircular && form.start_lat && form.start_lng) {
      setForm((prev) => ({
        ...prev,
        end_lat: prev.start_lat,
        end_lng: prev.start_lng,
      }));
    }
  }, [isCircular, form.start_lat, form.start_lng]);

  if (!isAuthenticated) {
    return (
      <div className="md:pt-16 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">{"\uD83D\uDD12"}</div>
          <h2 className="text-xl font-bold mb-2">로그인이 필요합니다</h2>
          <p className="text-text-secondary mb-6">
            코스를 등록하려면 먼저 로그인해주세요.
          </p>
          <a
            href="/auth/login"
            className="inline-block bg-primary text-white px-6 py-3 rounded-button font-medium"
          >
            로그인하기
          </a>
        </div>
      </div>
    );
  }

  const updateForm = (key: string, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const addSpot = () => {
    setSpots((prev) => [
      ...prev,
      {
        name: "",
        spot_type: "photo",
        lat: "",
        lng: "",
        description: "",
        menu_highlight: "",
        price_range: "",
        tip: "",
        is_must_visit: false,
      },
    ]);
  };

  const updateSpot = (index: number, key: string, value: string | boolean) => {
    setSpots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [key]: value } : s))
    );
  };

  const removeSpot = (index: number) => {
    setSpots((prev) => prev.filter((_, i) => i !== index));
  };

  const useCurrentLocation = (target: "start" | "end") => {
    if (!navigator.geolocation) {
      alert("이 브라우저에서는 위치 서비스를 지원하지 않습니다.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        if (target === "start") {
          setForm((prev) => ({ ...prev, start_lat: lat, start_lng: lng }));
        } else {
          setForm((prev) => ({ ...prev, end_lat: lat, end_lng: lng }));
        }
        setIsLocating(false);
      },
      (error) => {
        alert("위치를 가져올 수 없습니다. 위치 권한을 확인해주세요.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const validate = (): string[] => {
    const errors: string[] = [];
    if (!form.title.trim()) errors.push("코스 제목을 입력해주세요.");
    if (!form.description.trim()) errors.push("코스 설명을 입력해주세요.");
    if (!form.start_lat || !form.start_lng)
      errors.push("출발 좌표를 입력해주세요.");
    if (!form.end_lat || !form.end_lng)
      errors.push("도착 좌표를 입력해주세요.");
    if (images.length === 0) errors.push("커버 이미지를 최소 1장 등록해주세요.");
    return errors;
  };

  const canProceedStep = (step: number): boolean => {
    switch (step) {
      case 0:
        return !!(form.title.trim() && form.description.trim());
      case 1:
        return !!(form.start_lat && form.start_lng && form.end_lat && form.end_lng);
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!canProceedStep(currentStep)) {
      if (currentStep === 0) {
        setValidationErrors(
          [
            !form.title.trim() && "코스 제목을 입력해주세요.",
            !form.description.trim() && "코스 설명을 입력해주세요.",
          ].filter(Boolean) as string[]
        );
      } else if (currentStep === 1) {
        setValidationErrors(["출발/도착 좌표를 모두 입력해주세요."]);
      }
      return;
    }
    setValidationErrors([]);
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
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
      Object.entries(form).forEach(([k, v]) => {
        if (k === "is_multi_day") {
          formData.append(k, String(v));
        } else if (k === "total_days") {
          if (form.is_multi_day) formData.append(k, String(v));
        } else if (v !== "") {
          formData.append(k, String(v));
        }
      });
      formData.append("status", "pending");
      if (pathCoords.length >= 2) {
        formData.append(
          "path_data",
          JSON.stringify({ type: "LineString", coordinates: pathCoords }),
        );
      }
      if (images[0]) formData.append("cover_image", images[0]);

      const { data: trail } = await api.post("/trails/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Create spots
      for (let i = 0; i < spots.length; i++) {
        const spot = spots[i];
        if (spot.name && spot.lat && spot.lng) {
          await api.post("/spots/", {
            trail: trail.id,
            name: spot.name,
            spot_type: spot.spot_type,
            lat: spot.lat,
            lng: spot.lng,
            description: spot.description,
            menu_highlight: spot.menu_highlight,
            price_range: spot.price_range,
            tip: spot.tip,
            is_must_visit: spot.is_must_visit,
            order: i,
            distance_from_start_km: "0",
          });
        }
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        router.push(`/trails/${trail.id}`);
      }, 1500);
    } catch (error: any) {
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        "코스 등록에 실패했습니다. 다시 시도해주세요.";
      setSubmitError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === "is_multi_day") {
          formData.append(k, String(v));
        } else if (k === "total_days") {
          if (form.is_multi_day) formData.append(k, String(v));
        } else if (v !== "") {
          formData.append(k, String(v));
        }
      });
      formData.append("status", "draft");
      if (pathCoords.length >= 2) {
        formData.append(
          "path_data",
          JSON.stringify({ type: "LineString", coordinates: pathCoords }),
        );
      }
      if (images[0]) formData.append("cover_image", images[0]);
      await api.post("/trails/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("임시저장되었습니다!");
    } catch (error: any) {
      const msg =
        error?.response?.data?.detail ||
        "임시저장에 실패했습니다. 다시 시도해주세요.";
      alert(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
  };

  if (submitSuccess) {
    return (
      <div className="md:pt-16 flex items-center justify-center min-h-screen">
        <div className="text-center animate-fade-in">
          <div className="text-7xl mb-6">{"\uD83C\uDF89"}</div>
          <h2 className="text-2xl font-bold mb-2">코스가 등록되었습니다!</h2>
          <p className="text-text-secondary">
            관리자 검토 후 공개됩니다. 잠시 후 이동합니다...
          </p>
        </div>
      </div>
    );
  }

  const difficultyLabel = DIFFICULTY_OPTIONS.find(
    (d) => d.value === form.difficulty
  )?.label;
  const trailTypeObj = TRAIL_TYPES.find((t) => t.value === form.trail_type);
  const countryObj = COUNTRIES.find((c) => c.code === form.country);
  const surfaceLabel = SURFACE_OPTIONS.find(
    (s) => s.value === form.walking_surface
  )?.label;

  return (
    <div className="md:pt-16 max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-title mb-2">코스 등록</h1>
      <p className="text-text-secondary text-sm mb-8">
        등록하면 관리자 검토 후 공개됩니다
      </p>

      {/* Validation errors banner */}
      {validationErrors.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-card p-4">
          <div className="flex items-start gap-2">
            <span className="text-red-500 text-lg">{"\u26A0\uFE0F"}</span>
            <div>
              {validationErrors.map((err, i) => (
                <p key={i} className="text-sm text-red-600">
                  {err}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      <StepForm
        steps={STEPS}
        currentStep={currentStep}
        onNext={handleNext}
        onPrev={() => {
          setValidationErrors([]);
          setCurrentStep((s) => Math.max(s - 1, 0));
        }}
        onSubmit={handleSubmit}
        isLastStep={currentStep === STEPS.length - 1}
        isSubmitting={isSubmitting}
      >
        {/* Step 1: Basic Info */}
        {currentStep === 0 && (
          <div className="space-y-6">
            {/* Title & Description */}
            <SectionCard title="기본 정보">
              <div className="space-y-5">
                <Field label="코스 제목" required>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => updateForm("title", e.target.value)}
                    placeholder="예) 북촌한옥마을 골목 산책"
                    maxLength={100}
                    className="input-field"
                  />
                  <CharCount current={form.title.length} max={100} />
                </Field>
                <Field label="코스 설명" required>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateForm("description", e.target.value)}
                    placeholder="코스에 대한 상세 설명을 적어주세요"
                    rows={4}
                    maxLength={1000}
                    className="input-field resize-none"
                  />
                  <CharCount current={form.description.length} max={1000} />
                </Field>
              </div>
            </SectionCard>

            {/* Region & Country */}
            <SectionCard title="지역 정보">
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="지역">
                    <input
                      type="text"
                      value={form.region}
                      onChange={(e) => updateForm("region", e.target.value)}
                      placeholder="예) 서울, Tokyo"
                      className="input-field"
                    />
                  </Field>
                  <Field label="국가">
                    <select
                      value={form.country}
                      onChange={(e) => updateForm("country", e.target.value)}
                      className="input-field"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            </SectionCard>

            {/* Trail Type */}
            <SectionCard title="코스 유형">
              <div className="space-y-5">
                <Field label="코스 타입">
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
                        <span
                          className={`text-xs font-medium ${
                            form.trail_type === t.value
                              ? "text-primary"
                              : "text-text-secondary"
                          }`}
                        >
                          {t.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="노면 상태">
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
                        {s.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </SectionCard>

            {/* Difficulty & Season & Duration */}
            <SectionCard title="난이도 & 시간">
              <div className="space-y-5">
                <Field label="난이도">
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
                        {d.emoji} {d.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="추천 시즌">
                    <select
                      value={form.best_season}
                      onChange={(e) => updateForm("best_season", e.target.value)}
                      className="input-field"
                    >
                      {SEASON_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="소요시간 (분)">
                    <input
                      type="number"
                      value={form.estimated_minutes}
                      onChange={(e) =>
                        updateForm(
                          "estimated_minutes",
                          parseInt(e.target.value) || 0
                        )
                      }
                      min={0}
                      className="input-field"
                    />
                  </Field>
                </div>

                {/* Multi-day toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <span className="text-sm font-medium text-text-primary">
                      여러 날 코스
                    </span>
                    <p className="text-xs text-text-secondary mt-0.5">
                      1박 이상 소요되는 코스인가요?
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateForm("is_multi_day", !form.is_multi_day)
                    }
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      form.is_multi_day ? "bg-primary" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                        form.is_multi_day ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                {form.is_multi_day && (
                  <Field label="총 일수">
                    <input
                      type="number"
                      value={form.total_days}
                      onChange={(e) =>
                        updateForm(
                          "total_days",
                          Math.max(1, parseInt(e.target.value) || 1)
                        )
                      }
                      min={1}
                      max={30}
                      className="input-field"
                    />
                  </Field>
                )}
              </div>
            </SectionCard>

            {/* Transport Access */}
            <SectionCard title="교통 정보">
              <Field label="대중교통 접근">
                <input
                  type="text"
                  value={form.transport_access}
                  onChange={(e) =>
                    updateForm("transport_access", e.target.value)
                  }
                  placeholder="예) 지하철 3호선 안국역 2번 출구"
                  className="input-field"
                />
                <p className="text-xs text-text-secondary mt-1">
                  출발지까지의 대중교통 정보를 입력하세요
                </p>
              </Field>
            </SectionCard>
          </div>
        )}

        {/* Step 2: Route Drawing */}
        {currentStep === 1 && (
          <div className="space-y-6">
            {/* Mode toggle */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setDrawMode(true)}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
                  drawMode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                {"\uD83D\uDDFA\uFE0F"} 지도에서 그리기
              </button>
              <button
                type="button"
                onClick={() => setDrawMode(false)}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
                  !drawMode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                {"\u270F\uFE0F"} 좌표 직접 입력
              </button>
            </div>

            {drawMode && (
              <>
                <SectionCard title="경로 그리기">
                  <p className="text-xs text-text-secondary mb-3">
                    지도를 탭하여 경유지를 추가하세요. 두 점 이상이면 OSRM 도보 경로로 자동 보정됩니다.
                  </p>
                  <div className="h-[480px] rounded-card overflow-hidden border border-gray-200">
                    <TrailDrawMap
                      initialCenter={
                        form.start_lat && form.start_lng
                          ? { lat: parseFloat(form.start_lat), lng: parseFloat(form.start_lng) }
                          : undefined
                      }
                      onChange={handleDrawChange}
                    />
                  </div>
                  {pathCoords.length >= 2 && (
                    <div className="mt-3 p-3 bg-emerald-50 rounded-xl flex items-center justify-between text-[13px]">
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-700 font-semibold">{drawDistance.toFixed(2)} km</span>
                        <span className="text-emerald-700/60">·</span>
                        <span className="text-emerald-700 font-semibold">
                          {drawDuration >= 60
                            ? `${Math.floor(drawDuration / 60)}시간 ${drawDuration % 60}분`
                            : `${drawDuration}분`}
                        </span>
                      </div>
                      <span className="text-[11px] text-emerald-600">자동 계산됨</span>
                    </div>
                  )}
                </SectionCard>

                {pathCoords.length >= 2 && (
                  <SectionCard title="고도 (선택)">
                    <Field label="고도 변화 (m)">
                      <input
                        type="text"
                        value={form.elevation_gain}
                        onChange={(e) => updateForm("elevation_gain", e.target.value)}
                        placeholder="50"
                        className="input-field"
                      />
                    </Field>
                  </SectionCard>
                )}
              </>
            )}

            {!drawMode && (<>
            {pathCoords.length >= 2 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="text-[24px]">{"\u2705"}</div>
                  <div className="flex-1">
                    <p className="text-[14px] font-semibold text-emerald-900">방금 걸은 경로가 자동으로 입력되었습니다</p>
                    <p className="text-[12px] text-emerald-700 mt-0.5">
                      {drawDistance.toFixed(2)} km · {drawDuration}분 · {pathCoords.length}개 지점
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-[200px] rounded-xl overflow-hidden border border-emerald-200">
                  <MapView
                    pathCoordinates={pathCoords}
                    theme="light"
                    className="w-full h-full"
                  />
                </div>
              </div>
            )}
            <SectionCard title="출발지 좌표">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="위도 (Latitude)">
                    <input
                      type="text"
                      value={form.start_lat}
                      onChange={(e) => updateForm("start_lat", e.target.value)}
                      placeholder="37.5665"
                      className="input-field"
                    />
                  </Field>
                  <Field label="경도 (Longitude)">
                    <input
                      type="text"
                      value={form.start_lng}
                      onChange={(e) => updateForm("start_lng", e.target.value)}
                      placeholder="126.9780"
                      className="input-field"
                    />
                  </Field>
                </div>
                <button
                  type="button"
                  onClick={() => useCurrentLocation("start")}
                  disabled={isLocating}
                  className="w-full py-2.5 px-4 bg-primary/10 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLocating ? (
                    <>
                      <span className="animate-spin">{"\u23F3"}</span> 위치
                      확인 중...
                    </>
                  ) : (
                    <>
                      {"\uD83D\uDCCD"} 현재 위치 사용 (출발지)
                    </>
                  )}
                </button>
              </div>
            </SectionCard>

            {/* Circular course toggle */}
            <div className="flex items-center gap-3 px-1">
              <input
                type="checkbox"
                id="circular"
                checked={isCircular}
                onChange={(e) => {
                  setIsCircular(e.target.checked);
                  if (e.target.checked) {
                    setForm((prev) => ({
                      ...prev,
                      end_lat: prev.start_lat,
                      end_lng: prev.start_lng,
                    }));
                  }
                }}
                className="w-4 h-4 accent-primary rounded"
              />
              <label htmlFor="circular" className="text-sm text-text-primary">
                출발지와 도착지가 같음 (순환 코스)
              </label>
            </div>

            <SectionCard title="도착지 좌표">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="위도 (Latitude)">
                    <input
                      type="text"
                      value={form.end_lat}
                      onChange={(e) => updateForm("end_lat", e.target.value)}
                      placeholder="37.5700"
                      disabled={isCircular}
                      className={`input-field ${
                        isCircular ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    />
                  </Field>
                  <Field label="경도 (Longitude)">
                    <input
                      type="text"
                      value={form.end_lng}
                      onChange={(e) => updateForm("end_lng", e.target.value)}
                      placeholder="126.9820"
                      disabled={isCircular}
                      className={`input-field ${
                        isCircular ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    />
                  </Field>
                </div>
                {!isCircular && (
                  <button
                    type="button"
                    onClick={() => useCurrentLocation("end")}
                    disabled={isLocating}
                    className="w-full py-2.5 px-4 bg-primary/10 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLocating ? (
                      <>
                        <span className="animate-spin">{"\u23F3"}</span> 위치
                        확인 중...
                      </>
                    ) : (
                      <>
                        {"\uD83D\uDCCD"} 현재 위치 사용 (도착지)
                      </>
                    )}
                  </button>
                )}
                <p className="text-xs text-text-secondary">
                  좌표 형식: 소수점 형태 (예: 37.5665, 126.9780). Google Maps에서 위치를 우클릭하면 좌표를 복사할 수 있습니다.
                </p>
              </div>
            </SectionCard>

            <SectionCard title="거리 & 고도">
              <div className="grid grid-cols-2 gap-4">
                <Field label="거리 (km)">
                  <input
                    type="text"
                    value={form.distance_km}
                    onChange={(e) => updateForm("distance_km", e.target.value)}
                    placeholder="자동 계산됨"
                    className="input-field"
                  />
                  <p className="text-xs text-text-secondary mt-1">
                    좌표 입력 시 직선거리가 자동 계산됩니다
                  </p>
                </Field>
                <Field label="고도 (m, 선택)">
                  <input
                    type="text"
                    value={form.elevation_gain}
                    onChange={(e) =>
                      updateForm("elevation_gain", e.target.value)
                    }
                    placeholder="50"
                    className="input-field"
                  />
                </Field>
              </div>
            </SectionCard>

            {/* Map preview */}
            <div className="h-80 rounded-card overflow-hidden border border-gray-200">
              <MapView
                country={form.country}
                center={
                  form.start_lat && form.start_lng
                    ? {
                        lat: parseFloat(form.start_lat),
                        lng: parseFloat(form.start_lng),
                      }
                    : undefined
                }
                markers={
                  form.start_lat && form.start_lng
                    ? [
                        {
                          id: 1,
                          lat: parseFloat(form.start_lat),
                          lng: parseFloat(form.start_lng),
                          title: "출발",
                          emoji: "\uD83D\uDEA9",
                        },
                        ...(form.end_lat && form.end_lng
                          ? [
                              {
                                id: 2,
                                lat: parseFloat(form.end_lat),
                                lng: parseFloat(form.end_lng),
                                title: "도착",
                                emoji: "\uD83C\uDFC1",
                              },
                            ]
                          : []),
                      ]
                    : []
                }
              />
            </div>
            </>)}
          </div>
        )}

        {/* Step 3: Spots */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">
                  코스 중 경유지를 등록하세요 (맛집, 포토스팟, 카페 등)
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  드래그하여 순서를 변경할 수 있습니다
                </p>
              </div>
              <button
                onClick={addSpot}
                type="button"
                className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:shadow-hover transition-all"
              >
                + 경유지 추가
              </button>
            </div>

            {spots.length === 0 && (
              <div className="text-center py-16 bg-gray-50 rounded-2xl">
                <div className="text-6xl mb-4">{"\uD83D\uDDFA\uFE0F"}</div>
                <p className="text-text-secondary font-medium mb-1">
                  아직 등록된 경유지가 없습니다
                </p>
                <p className="text-text-secondary text-sm">
                  위의 &quot;+ 경유지 추가&quot; 버튼을 눌러 경유지를
                  등록해보세요
                </p>
              </div>
            )}

            {spots.map((spot, i) => {
              const spotTypeObj = SPOT_TYPES.find(
                (t) => t.value === spot.spot_type
              );
              return (
                <div
                  key={i}
                  className="bg-white rounded-2xl shadow-soft p-5 space-y-4 border border-gray-100"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-primary flex items-center gap-2">
                      <span className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-xs">
                        {i + 1}
                      </span>
                      경유지 {i + 1}
                    </span>
                    <button
                      onClick={() => removeSpot(i)}
                      type="button"
                      className="text-danger text-sm hover:underline"
                    >
                      삭제
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="이름">
                      <input
                        type="text"
                        value={spot.name}
                        onChange={(e) => updateSpot(i, "name", e.target.value)}
                        placeholder="경유지 이름"
                        className="input-field"
                      />
                    </Field>
                    <Field label="유형">
                      <select
                        value={spot.spot_type}
                        onChange={(e) =>
                          updateSpot(i, "spot_type", e.target.value)
                        }
                        className="input-field"
                      >
                        {SPOT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.emoji} {t.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="위도">
                      <input
                        type="text"
                        value={spot.lat}
                        onChange={(e) => updateSpot(i, "lat", e.target.value)}
                        placeholder="37.5665"
                        className="input-field"
                      />
                    </Field>
                    <Field label="경도">
                      <input
                        type="text"
                        value={spot.lng}
                        onChange={(e) => updateSpot(i, "lng", e.target.value)}
                        placeholder="126.9780"
                        className="input-field"
                      />
                    </Field>
                  </div>

                  <Field label="설명">
                    <textarea
                      value={spot.description}
                      onChange={(e) =>
                        updateSpot(i, "description", e.target.value)
                      }
                      placeholder="설명 (선택)"
                      rows={2}
                      className="input-field resize-none"
                    />
                  </Field>

                  {(spot.spot_type === "restaurant" ||
                    spot.spot_type === "cafe") && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="대표 메뉴">
                        <input
                          type="text"
                          value={spot.menu_highlight}
                          onChange={(e) =>
                            updateSpot(i, "menu_highlight", e.target.value)
                          }
                          placeholder="대표 메뉴"
                          className="input-field"
                        />
                      </Field>
                      <Field label="가격대">
                        <input
                          type="text"
                          value={spot.price_range}
                          onChange={(e) =>
                            updateSpot(i, "price_range", e.target.value)
                          }
                          placeholder="가격대"
                          className="input-field"
                        />
                      </Field>
                    </div>
                  )}

                  <Field label="꿀팁">
                    <input
                      type="text"
                      value={spot.tip}
                      onChange={(e) => updateSpot(i, "tip", e.target.value)}
                      placeholder="꿀팁 (선택)"
                      className="input-field"
                    />
                  </Field>

                  {/* Must visit checkbox */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id={`must-visit-${i}`}
                      checked={spot.is_must_visit}
                      onChange={(e) =>
                        updateSpot(i, "is_must_visit", e.target.checked)
                      }
                      className="w-4 h-4 accent-primary rounded"
                    />
                    <label
                      htmlFor={`must-visit-${i}`}
                      className="text-sm text-text-primary"
                    >
                      {"\u2B50"} 필수 방문 경유지
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Step 4: Images & Preview */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <SectionCard title="커버 이미지">
              <ImageUploader images={images} onChange={setImages} maxFiles={5} />
            </SectionCard>

            {/* Rich preview card */}
            <SectionCard title="등록 미리보기">
              <div className="bg-white rounded-2xl shadow-soft overflow-hidden border border-gray-100">
                {/* Card header image area */}
                {images.length > 0 ? (
                  <div className="h-40 bg-gray-100 relative overflow-hidden">
                    <img
                      src={URL.createObjectURL(images[0])}
                      alt="커버"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                      <h3 className="text-white font-bold text-lg">
                        {form.title || "(제목 미입력)"}
                      </h3>
                    </div>
                  </div>
                ) : (
                  <div className="h-32 bg-gray-100 flex items-center justify-center">
                    <span className="text-text-secondary text-sm">
                      커버 이미지 미등록
                    </span>
                  </div>
                )}

                <div className="p-4 space-y-3">
                  {/* Tags row */}
                  <div className="flex flex-wrap gap-1.5">
                    {countryObj && (
                      <span className="text-xs px-2.5 py-1 bg-gray-100 rounded-full">
                        {countryObj.flag} {countryObj.label}
                      </span>
                    )}
                    {form.region && (
                      <span className="text-xs px-2.5 py-1 bg-gray-100 rounded-full">
                        {form.region}
                      </span>
                    )}
                    {trailTypeObj && (
                      <span className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-full">
                        {trailTypeObj.emoji} {trailTypeObj.label}
                      </span>
                    )}
                    <span className="text-xs px-2.5 py-1 bg-gray-100 rounded-full">
                      {difficultyLabel}
                    </span>
                    {surfaceLabel && (
                      <span className="text-xs px-2.5 py-1 bg-gray-100 rounded-full">
                        {surfaceLabel}
                      </span>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 text-center py-2">
                    <div>
                      <div className="text-lg font-bold text-primary">
                        {form.distance_km || "-"}{" "}
                        <span className="text-xs font-normal text-text-secondary">
                          km
                        </span>
                      </div>
                      <div className="text-xs text-text-secondary">거리</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-primary">
                        {form.estimated_minutes}{" "}
                        <span className="text-xs font-normal text-text-secondary">
                          분
                        </span>
                      </div>
                      <div className="text-xs text-text-secondary">소요시간</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-primary">
                        {spots.length}{" "}
                        <span className="text-xs font-normal text-text-secondary">
                          곳
                        </span>
                      </div>
                      <div className="text-xs text-text-secondary">경유지</div>
                    </div>
                  </div>

                  {form.description && (
                    <p className="text-sm text-text-secondary line-clamp-2">
                      {form.description}
                    </p>
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
                      <span>{form.total_days}일 코스</span>
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* Map preview */}
            {form.start_lat && form.start_lng && (
              <SectionCard title="경로 지도">
                <div className="h-48 rounded-xl overflow-hidden border border-gray-200">
                  <MapView
                    country={form.country}
                    center={{
                      lat: parseFloat(form.start_lat),
                      lng: parseFloat(form.start_lng),
                    }}
                    markers={[
                      {
                        id: 1,
                        lat: parseFloat(form.start_lat),
                        lng: parseFloat(form.start_lng),
                        title: "출발",
                        emoji: "\uD83D\uDEA9",
                      },
                      ...(form.end_lat && form.end_lng
                        ? [
                            {
                              id: 2,
                              lat: parseFloat(form.end_lat),
                              lng: parseFloat(form.end_lng),
                              title: "도착",
                              emoji: "\uD83C\uDFC1",
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </SectionCard>
            )}

            {/* Completion checklist */}
            <SectionCard title="등록 전 체크리스트">
              <div className="space-y-2">
                <CheckItem
                  done={!!form.title.trim()}
                  label="코스 제목 입력"
                />
                <CheckItem
                  done={!!form.description.trim()}
                  label="코스 설명 입력"
                />
                <CheckItem
                  done={!!(form.start_lat && form.start_lng)}
                  label="출발 좌표 입력"
                />
                <CheckItem
                  done={!!(form.end_lat && form.end_lng)}
                  label="도착 좌표 입력"
                />
                <CheckItem done={spots.length > 0} label="경유지 1곳 이상" />
                <CheckItem
                  done={images.length > 0}
                  label="커버 이미지 1장 이상"
                />
              </div>
            </SectionCard>

            {/* Error display */}
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <span className="text-red-500">{"\u274C"}</span>
                  <div>
                    <p className="text-sm font-medium text-red-700">
                      등록 실패
                    </p>
                    <p className="text-sm text-red-600 mt-1">{submitError}</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleSaveDraft}
              type="button"
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-text-secondary hover:border-primary hover:text-primary transition-colors"
            >
              임시저장하기
            </button>
          </div>
        )}
      </StepForm>
    </div>
  );
}

/* ---------- Utility Components ---------- */

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-text-primary block mb-2">
        {label}
        {required && (
          <span className="text-danger ml-1 text-xs align-top">*</span>
        )}
      </label>
      {children}
    </div>
  );
}

function CharCount({ current, max }: { current: number; max: number }) {
  return (
    <div className="flex justify-end mt-1">
      <span
        className={`text-xs ${
          current > max * 0.9 ? "text-danger" : "text-text-secondary"
        }`}
      >
        {current}/{max}
      </span>
    </div>
  );
}

function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
          done ? "bg-primary text-white" : "bg-gray-200 text-gray-400"
        }`}
      >
        {done ? "\u2713" : ""}
      </span>
      <span
        className={`text-sm ${
          done ? "text-text-primary" : "text-text-secondary"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
