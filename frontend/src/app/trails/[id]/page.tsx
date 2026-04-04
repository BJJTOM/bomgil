"use client";

import { useState } from "react";
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
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    content: "",
    visited_date: new Date().toISOString().split("T")[0],
  });
  const createReview = useCreateReview(trailId);

  if (trailLoading) {
    return (
      <div className="md:pt-16">
        <Skeleton className="h-80 w-full rounded-none" />
        <div className="max-w-4xl mx-auto px-6 py-10 space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-40 w-full" />
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
    await createReview.mutateAsync(reviewForm);
    setShowReviewForm(false);
    setReviewForm({ rating: 5, content: "", visited_date: new Date().toISOString().split("T")[0] });
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

  return (
    <div className="md:pt-16">
      {/* Cover Image */}
      <div className="relative h-64 md:h-80 bg-primary">
        {tr.cover_image || tr.thumbnail_url ? (
          <img src={tr.cover_image || tr.thumbnail_url} alt={tr.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#2D4A2E] to-[#3A5C3B] flex items-center justify-center">
            <span className="text-8xl opacity-30">🥾</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 text-white">
          <DifficultyBadge difficulty={tr.difficulty} />
          <h1 className="text-3xl md:text-4xl font-semibold mt-2">{tr.title}</h1>
          <p className="text-sm opacity-80 mt-1">
            {tr.region}, {tr.country}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <InfoCard label={t("trail.distance")} value={formatDistance(tr.distance_km)} />
          <InfoCard label={t("trail.time")} value={formatDuration(tr.estimated_minutes)} />
          <InfoCard
            label={t("trail.elevation")}
            value={tr.elevation_gain ? `${tr.elevation_gain}m` : "-"}
          />
          <InfoCard label={t("trail.season")} value={SEASON_LABELS[tr.best_season] || tr.best_season} />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 mb-10">
          <button
            onClick={() => toggleLike.mutate(trailId)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-button text-sm font-medium transition-all ${
              tr.is_liked
                ? "bg-danger text-white"
                : "card hover:shadow-hover"
            }`}
          >
            {tr.is_liked ? "❤️" : "🤍"} {tr.like_count}
          </button>
          <ShareButton
            title={tr.title}
            description={tr.description}
            url={typeof window !== "undefined" ? window.location.href : ""}
          />
          <div className="flex-1" />
          <span className="text-sm text-text-tertiary">
            👁️ {tr.view_count}
          </span>
        </div>

        {/* Description */}
        <div className="card p-7 mb-10">
          <h2 className="text-[18px] font-semibold mb-3">{t("trail.description")}</h2>
          <p className="text-text-secondary leading-relaxed whitespace-pre-line">
            {tr.description}
          </p>
          {tr.tags.length > 0 && (
            <div className="flex gap-2 mt-5 flex-wrap">
              {tr.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="chip text-sm"
                >
                  #{tag.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="mb-10 -mx-6 md:mx-0 md:rounded-card overflow-hidden">
          <div className="h-[400px] md:h-[500px] relative">
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
          </div>
        </div>

        {/* Spot Timeline */}
        {spots.length > 0 && (
          <div className="mb-10">
            <h2 className="text-[18px] font-semibold mb-6">{t("trail.spotTimeline")}</h2>
            <SpotTimeline spots={spots} />
          </div>
        )}

        {/* Reviews */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-[18px] font-semibold">{t("review.title")}</h2>
              {avgRating && (
                <span className="text-sm bg-yellow-50 text-yellow-700 px-3 py-1 rounded-pill font-medium">
                  ★ {avgRating} ({reviews.length})
                </span>
              )}
            </div>
            {isAuthenticated && (
              <button
                onClick={() => setShowReviewForm(!showReviewForm)}
                className="btn-primary px-5 py-2.5 text-sm"
              >
                {t("trail.writeReview")}
              </button>
            )}
          </div>

          {/* Rating distribution */}
          {reviews.length > 0 && (
            <div className="card p-5 mb-6">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = reviews.filter((r: any) => r.rating === star).length;
                const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2.5 py-1.5">
                    <span className="text-xs w-4 text-text-secondary">{star}</span>
                    <span className="text-xs text-yellow-400">★</span>
                    <div className="flex-1 h-2 bg-[#F5F6F7] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-text-tertiary w-6 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Review Form */}
          {showReviewForm && (
            <div className="card p-7 mb-6">
              <h3 className="text-[18px] font-semibold mb-5">{t("review.write")}</h3>
              <div className="space-y-5">
                <div>
                  <label className="text-sm text-text-secondary block mb-2">
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
                  <label className="text-sm text-text-secondary block mb-2">
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
                  <label className="text-sm text-text-secondary block mb-2">
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
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowReviewForm(false)}
                    className="btn-ghost px-5 py-2.5 text-sm"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    onClick={handleSubmitReview}
                    disabled={!reviewForm.content || createReview.isPending}
                    className="btn-primary px-6 py-2.5 text-sm disabled:opacity-50"
                  >
                    {createReview.isPending ? t("review.submitting") : t("review.submit")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Review List */}
          <div className="space-y-4">
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
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[18px] font-semibold">{t("activities.title")}</h2>
              <span className="text-[12px] text-text-tertiary">{activities.length}{t("activities.recorded")}</span>
            </div>
            <div className="space-y-3">
              {activities.slice(0, 5).map((act: ActivityTrack) => (
                <Link key={act.id} href={`/activities/${act.id}`} className="card-hover p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent/30 flex items-center justify-center text-sm">
                      {act.user?.profile_image ? (
                        <Image src={act.user.profile_image} alt="" width={36} height={36} className="rounded-full object-cover" />
                      ) : "👤"}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold">{act.user?.nickname}</p>
                      <p className="text-[11px] text-text-tertiary">
                        {act.distance_km ? `${parseFloat(act.distance_km).toFixed(1)}km` : "-"} · {formatActivityDuration(act.duration_minutes)}
                        {act.total_steps ? ` · ${act.total_steps.toLocaleString()} ${t("activities.steps")}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="chip text-[10px]">{act.source === "apple_watch" ? "⌚" : act.source === "garmin" ? "⌚" : act.source === "cashwalk" ? "🚶" : "📍"} {act.source.replace("_", " ")}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Author */}
        <div className="card p-7">
          <h2 className="text-[18px] font-semibold mb-5">{t("trail.author")}</h2>
          <Link
            href={`/profile/${tr.author.nickname}`}
            className="flex items-center gap-4 hover:bg-[#F5F6F7] -m-3 p-3 rounded-card transition-colors"
          >
            <div className="w-14 h-14 rounded-full bg-accent/30 flex items-center justify-center overflow-hidden">
              {tr.author.profile_image ? (
                <Image
                  src={tr.author.profile_image}
                  alt={tr.author.nickname}
                  width={56}
                  height={56}
                  className="object-cover"
                />
              ) : (
                <span className="text-2xl">👤</span>
              )}
            </div>
            <div>
              <p className="font-semibold">{tr.author.nickname}</p>
              {tr.author.is_guide && (
                <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-pill">
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5 text-center">
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className="font-semibold font-en text-lg">{value}</p>
    </div>
  );
}
