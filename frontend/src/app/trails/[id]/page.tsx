"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useTrail, useToggleLike } from "@/hooks/useTrails";
import { useTrailSpots } from "@/hooks/useSpots";
import { useTrailReviews, useCreateReview, useToggleHelpful } from "@/hooks/useReviews";
import { useTrailActivities } from "@/hooks/useActivities";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { SpotTimeline } from "@/components/SpotTimeline";
import { ReviewCard } from "@/components/ReviewCard";
import { MapView } from "@/components/MapView";
import { MapFullscreen, MapExpandButton } from "@/components/MapFullscreen";
import { ShareButton } from "@/components/ShareButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDistance, formatDuration, SEASON_LABELS, SPOT_TYPE_LABELS } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useT } from "@/stores/language";
import type { Trail, Spot, ActivityTrack } from "@/types";

export default function TrailDetailPage() {
  const { id } = useParams();
  const trailId = Number(id);
  const { isAuthenticated } = useAuthStore();
  const { t, language } = useT();

  const { data: trail, isLoading: trailLoading } = useTrail(trailId);
  const { data: spots = [] } = useTrailSpots(trailId);
  const { data: reviews = [] } = useTrailReviews(trailId);
  const { data: activities = [] } = useTrailActivities(trailId);
  const toggleLike = useToggleLike();
  const toggleHelpful = useToggleHelpful();

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showAllSpots, setShowAllSpots] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    content: "",
    visited_date: new Date().toISOString().split("T")[0],
  });
  const [reviewImages, setReviewImages] = useState<File[]>([]);
  const [reviewPreviews, setReviewPreviews] = useState<string[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const createReview = useCreateReview(trailId);

  // Check saved status from localStorage
  useEffect(() => {
    if (typeof window === "undefined" || !trailId) return;
    try {
      const saved = JSON.parse(localStorage.getItem("moru_saved_trails") || "[]");
      setIsSaved(saved.some((t: any) => t.id === trailId));
    } catch {}
  }, [trailId]);

  const handleToggleSave = () => {
    if (typeof window === "undefined" || !trail) return;
    try {
      const saved = JSON.parse(localStorage.getItem("moru_saved_trails") || "[]");
      if (isSaved) {
        const filtered = saved.filter((t: any) => t.id !== trailId);
        localStorage.setItem("moru_saved_trails", JSON.stringify(filtered));
        setIsSaved(false);
        alert("저장이 해제되었습니다");
      } else {
        const minimal = { id: trailId, title: trail.title, region: trail.region, distance_km: trail.distance_km, cover_image: trail.cover_image, savedAt: Date.now() };
        saved.push(minimal);
        localStorage.setItem("moru_saved_trails", JSON.stringify(saved));
        setIsSaved(true);
        alert("오프라인 저장 완료");
      }
    } catch {}
  };

  const handleReviewImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 3 - reviewImages.length;
    const newFiles = files.slice(0, remaining);
    setReviewImages(prev => [...prev, ...newFiles]);
    setReviewPreviews(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const removeReviewImage = (i: number) => {
    URL.revokeObjectURL(reviewPreviews[i]);
    setReviewImages(prev => prev.filter((_, idx) => idx !== i));
    setReviewPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  if (trailLoading) {
    return (
      <div className="md:pt-16">
        <Skeleton className="h-64 w-full rounded-none" />
        <div className="max-w-3xl mx-auto px-5 py-8 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!trail) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-text-secondary">{t("common.noResults")}</p>
      </div>
    );
  }

  const tr: Trail = trail;
  const pathCoords = tr.path_data?.coordinates || [];
  const mapMarkers = spots.map((s: Spot) => ({
    id: s.id,
    lat: parseFloat(s.lat),
    lng: parseFloat(s.lng),
    title: s.name,
    emoji: SPOT_TYPE_LABELS[s.spot_type]?.emoji,
  }));

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  const handleSubmitReview = async () => {
    // If images, use FormData
    if (reviewImages.length > 0) {
      const formData = new FormData();
      formData.append("trail", String(trailId));
      formData.append("rating", String(reviewForm.rating));
      formData.append("content", reviewForm.content);
      formData.append("visited_date", reviewForm.visited_date);
      reviewImages.forEach((img) => formData.append("images", img));
      try {
        const api = (await import("@/lib/api")).default;
        await api.post("/reviews/", formData, { headers: { "Content-Type": "multipart/form-data" } });
      } catch (e: any) {
        alert("리뷰 작성 실패");
        return;
      }
    } else {
      await createReview.mutateAsync(reviewForm);
    }
    setShowReviewForm(false);
    setReviewForm({ rating: 5, content: "", visited_date: new Date().toISOString().split("T")[0] });
    setReviewImages([]);
    reviewPreviews.forEach(URL.revokeObjectURL);
    setReviewPreviews([]);
  };

  function formatActivityDuration(minutes: number | null) {
    if (!minutes) return "-";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (language === "ko") return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
    if (language === "ja") return h > 0 ? `${h}時間${m}分` : `${m}分`;
    if (language === "zh") return h > 0 ? `${h}小时${m}分钟` : `${m}分钟`;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  const visibleSpots = showAllSpots ? spots : spots.slice(0, 3);

  const likeLabel = language === "ko" ? "좋아요" : language === "ja" ? "いいね" : language === "zh" ? "点赞" : "Like";
  const shareLabel = language === "ko" ? "공유" : language === "ja" ? "共有" : language === "zh" ? "分享" : "Share";
  const saveLabel = language === "ko" ? "저장" : language === "ja" ? "保存" : language === "zh" ? "收藏" : "Save";
  const walkLabel = language === "ko" ? "걷기" : language === "ja" ? "歩く" : language === "zh" ? "步行" : "Walk";
  const moreLabel = language === "ko" ? "더보기" : language === "ja" ? "もっと見る" : language === "zh" ? "查看更多" : "Show more";

  return (
    <div className="md:pt-16" style={{ backgroundColor: "#FAFAFA" }}>
      {/* Cover Image */}
      <div className="relative h-56 md:h-72 bg-primary">
        {tr.cover_image || tr.thumbnail_url ? (
          <img src={tr.cover_image || tr.thumbnail_url} alt={tr.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#2D4A2E] to-[#3A5C3B] flex items-center justify-center">
            <span className="text-7xl opacity-30">🥾</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <button
          onClick={() => window.history.back()}
          className="absolute top-14 left-4 md:top-20 bg-black/50 backdrop-blur-md w-9 h-9 rounded-full flex items-center justify-center border border-white/10 z-10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div className="absolute bottom-5 left-5 right-5 text-white">
          <DifficultyBadge difficulty={tr.difficulty} />
          <h1 className="text-[22px] md:text-[28px] font-bold mt-1.5 leading-tight">{tr.title}</h1>
          <p className="text-[13px] opacity-70 mt-0.5">
            {tr.region}, {tr.country}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6">
        {/* Quick stats — single line with dot separators */}
        <div className="flex items-center gap-2 text-[14px] text-text-secondary mb-5 flex-wrap">
          <span className="font-semibold text-text-primary">{formatDistance(tr.distance_km)}</span>
          <span>·</span>
          <span>{formatDuration(tr.estimated_minutes)}</span>
          <span>·</span>
          <span>{tr.elevation_gain ? `${tr.elevation_gain}m` : "-"} {t("trail.elevation")}</span>
          <span>·</span>
          <span>{SEASON_LABELS[tr.best_season] || tr.best_season}</span>
          {avgRating && (
            <>
              <span>·</span>
              <span className="text-yellow-600">★ {avgRating}</span>
            </>
          )}
        </div>

        {/* Action buttons — pills */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button
            onClick={() => toggleLike.mutate(trailId)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-[20px] text-[13px] font-medium transition-all ${
              tr.is_liked
                ? "bg-red-50 text-red-500 border border-red-200"
                : "bg-white border border-border-default text-text-primary"
            }`}
          >
            {tr.is_liked ? "❤️" : "🤍"} {likeLabel} {tr.like_count > 0 && tr.like_count}
          </button>
          <ShareButton
            title={tr.title}
            description={tr.description}
            url={typeof window !== "undefined" ? window.location.href : ""}
          />
          <button onClick={handleToggleSave} className={`flex items-center gap-1.5 px-4 py-2 rounded-[20px] text-[13px] font-medium ${isSaved ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-white border border-border-default text-text-primary"}`}>
            {isSaved ? "🔖 저장됨" : "🔖 " + saveLabel}
          </button>
          <Link
            href={`/walk?trail=${trailId}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-[20px] text-[13px] font-semibold bg-primary text-white"
          >
            🚶 {walkLabel}
          </Link>
          <span className="ml-auto text-[12px] text-text-tertiary">
            👁️ {tr.view_count}
          </span>
        </div>

        {/* Description */}
        <div className="mb-6">
          <h2 className="text-[17px] font-bold text-text-primary mb-2">{t("trail.description")}</h2>
          <p className="text-[14px] text-text-secondary leading-relaxed whitespace-pre-line">
            {tr.description}
          </p>
          {tr.tags.length > 0 && (
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {tr.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2.5 py-1 rounded-[20px] text-[12px] font-medium bg-bg-secondary text-text-secondary"
                >
                  #{tag.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="mb-6 -mx-5 md:mx-0 md:rounded-[16px] overflow-hidden">
          <div className="h-[320px] md:h-[400px] relative">
            <MapView
              country={tr.country}
              center={{
                lat: parseFloat(tr.start_lat),
                lng: parseFloat(tr.start_lng),
              }}
              zoom={14}
              markers={mapMarkers}
              pathCoordinates={pathCoords}
              theme="dark"
              showStats
              distance={tr.distance_km}
              duration={String(tr.estimated_minutes)}
            />
            <MapExpandButton onClick={() => setMapFullscreen(true)} />
          </div>
        </div>

        <MapFullscreen
          open={mapFullscreen}
          onClose={() => setMapFullscreen(false)}
          title={tr.title}
          pathCoordinates={pathCoords}
          markers={mapMarkers}
          distance={tr.distance_km}
          duration={String(tr.estimated_minutes)}
          theme="dark"
        />

        {/* Spots — max 3, then "more" */}
        {spots.length > 0 && (
          <div className="mb-6">
            <h2 className="text-[17px] font-bold text-text-primary mb-4">{t("trail.spotTimeline")}</h2>
            <SpotTimeline spots={visibleSpots} />
            {spots.length > 3 && !showAllSpots && (
              <button
                onClick={() => setShowAllSpots(true)}
                className="mt-3 w-full py-2.5 text-[13px] font-medium text-primary bg-[#f0f7f0] rounded-[14px] hover:bg-[#d9eed9] transition-colors"
              >
                {moreLabel} ({spots.length - 3})
              </button>
            )}
          </div>
        )}

        {/* Reviews — no rating distribution chart */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-bold text-text-primary">{t("review.title")}</h2>
              {avgRating && (
                <span className="text-[13px] text-yellow-600 font-medium">
                  ★ {avgRating} ({reviews.length})
                </span>
              )}
            </div>
            {isAuthenticated && (
              <button
                onClick={() => setShowReviewForm(!showReviewForm)}
                className="px-4 py-2 bg-primary text-white rounded-[14px] text-[13px] font-semibold"
              >
                {t("trail.writeReview")}
              </button>
            )}
          </div>

          {/* Review Form */}
          {showReviewForm && (
            <div className="card p-5 mb-4">
              <h3 className="text-[17px] font-bold text-text-primary mb-4">{t("review.write")}</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[13px] text-text-secondary block mb-1.5">
                    {t("review.rating")}
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() =>
                          setReviewForm((p) => ({ ...p, rating: star }))
                        }
                        className={`text-2xl transition-colors ${
                          star <= reviewForm.rating
                            ? "text-yellow-400"
                            : "text-gray-200"
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[13px] text-text-secondary block mb-1.5">
                    {t("review.visitDate")}
                  </label>
                  <input
                    type="date"
                    value={reviewForm.visited_date}
                    onChange={(e) =>
                      setReviewForm((p) => ({
                        ...p,
                        visited_date: e.target.value,
                      }))
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-[13px] text-text-secondary block mb-1.5">
                    {t("review.content")}
                  </label>
                  <textarea
                    value={reviewForm.content}
                    onChange={(e) =>
                      setReviewForm((p) => ({ ...p, content: e.target.value }))
                    }
                    rows={4}
                    maxLength={1000}
                    placeholder={t("review.placeholder")}
                    className="input-field resize-none"
                  />
                </div>
                {/* Image upload (max 3) */}
                <div>
                  <label className="text-[13px] text-text-secondary block mb-1.5">사진 (최대 3장)</label>
                  <div className="flex gap-2 flex-wrap">
                    <input id="review-img-input" type="file" accept="image/*" multiple className="hidden" onChange={handleReviewImagePick} />
                    {reviewImages.length < 3 && (
                      <label htmlFor="review-img-input" className="w-[72px] h-[72px] rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-primary">
                        <span className="text-2xl text-gray-400">+</span>
                      </label>
                    )}
                    {reviewPreviews.map((url, i) => (
                      <div key={i} className="relative">
                        <img src={url} alt="" className="w-[72px] h-[72px] rounded-xl object-cover" />
                        <button onClick={() => removeReviewImage(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowReviewForm(false)}
                    className="px-4 py-2 text-[13px] font-medium text-text-secondary hover:bg-bg-secondary rounded-[14px] transition-colors"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    onClick={handleSubmitReview}
                    disabled={!reviewForm.content || createReview.isPending}
                    className="px-5 py-2 bg-primary text-white rounded-[14px] text-[13px] font-semibold disabled:opacity-50"
                  >
                    {createReview.isPending ? t("review.submitting") : t("review.submit")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Review List */}
          <div className="space-y-3">
            {reviews.map((review: any) => (
              <ReviewCard
                key={review.id}
                review={review}
                onHelpful={(id) => toggleHelpful.mutate(id)}
              />
            ))}
          </div>
        </div>

        {/* Activity Records */}
        {activities.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[17px] font-bold text-text-primary">{t("activities.title")}</h2>
              <span className="text-[12px] text-text-tertiary">{activities.length}{t("activities.recorded")}</span>
            </div>
            <div className="space-y-2">
              {activities.slice(0, 5).map((act: ActivityTrack) => (
                <Link key={act.id} href={`/activities/${act.id}`} className="block card-hover p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#A8E6CF]/30 flex items-center justify-center text-sm">
                      {act.user?.profile_image ? (
                        <Image src={act.user.profile_image} alt="" width={36} height={36} className="rounded-full object-cover" />
                      ) : "👤"}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-text-primary">{act.user?.nickname}</p>
                      <p className="text-[11px] text-text-tertiary">
                        {act.distance_km ? `${parseFloat(act.distance_km).toFixed(1)}km` : "-"} · {formatActivityDuration(act.duration_minutes)}
                        {act.total_steps ? ` · ${act.total_steps.toLocaleString()} ${t("activities.steps")}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-[20px] text-[10px] font-medium bg-bg-secondary text-text-secondary">{act.source === "apple_watch" ? "⌚" : act.source === "garmin" ? "⌚" : act.source === "cashwalk" ? "🚶" : "📍"} {act.source.replace("_", " ")}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Author */}
        <div className="card p-5 mb-6">
          <h2 className="text-[17px] font-bold text-text-primary mb-4">{t("trail.author")}</h2>
          <Link
            href={`/profile/${tr.author.nickname}`}
            className="flex items-center gap-3 hover:bg-bg-secondary -m-2 p-2 rounded-[12px] transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-[#A8E6CF]/30 flex items-center justify-center overflow-hidden">
              {tr.author.profile_image ? (
                <Image
                  src={tr.author.profile_image}
                  alt={tr.author.nickname}
                  width={48}
                  height={48}
                  className="object-cover"
                />
              ) : (
                <span className="text-xl">👤</span>
              )}
            </div>
            <div>
              <p className="text-[14px] font-semibold text-text-primary">{tr.author.nickname}</p>
              {tr.author.is_guide && (
                <span className="text-[11px] bg-[#f0f7f0] text-primary px-2 py-0.5 rounded-[20px] font-medium">
                  {t("trail.certifiedGuide")}
                </span>
              )}
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
