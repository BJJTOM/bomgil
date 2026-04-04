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
import type { Trail, Spot, ActivityTrack } from "@/types";

export default function TrailDetailPage() {
  const { id } = useParams();
  const trailId = Number(id);
  const { isAuthenticated } = useAuthStore();

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
        <p className="text-text-secondary">코스를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const t: Trail = trail;
  const pathCoords = t.path_data?.coordinates || [];
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

  return (
    <div className="md:pt-16">
      {/* Cover Image */}
      <div className="relative h-64 md:h-80 bg-primary">
        {t.cover_image ? (
          <Image
            src={t.cover_image}
            alt={t.title}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#2D4A2E] to-[#3A5C3B] flex items-center justify-center">
            <span className="text-8xl opacity-30">🥾</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 text-white">
          <DifficultyBadge difficulty={t.difficulty} />
          <h1 className="text-3xl md:text-4xl font-semibold mt-2">{t.title}</h1>
          <p className="text-sm opacity-80 mt-1">
            {t.region}, {t.country}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <InfoCard label="거리" value={formatDistance(t.distance_km)} />
          <InfoCard label="소요시간" value={formatDuration(t.estimated_minutes)} />
          <InfoCard
            label="고도"
            value={t.elevation_gain ? `${t.elevation_gain}m` : "-"}
          />
          <InfoCard label="시즌" value={SEASON_LABELS[t.best_season] || t.best_season} />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 mb-10">
          <button
            onClick={() => toggleLike.mutate(trailId)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-button text-sm font-medium transition-all ${
              t.is_liked
                ? "bg-danger text-white"
                : "card hover:shadow-hover"
            }`}
          >
            {t.is_liked ? "❤️" : "🤍"} {t.like_count}
          </button>
          <ShareButton
            title={t.title}
            description={t.description}
            url={typeof window !== "undefined" ? window.location.href : ""}
          />
          <div className="flex-1" />
          <span className="text-sm text-text-tertiary">
            👁️ {t.view_count}
          </span>
        </div>

        {/* Description */}
        <div className="card p-7 mb-10">
          <h2 className="text-[18px] font-semibold mb-3">코스 소개</h2>
          <p className="text-text-secondary leading-relaxed whitespace-pre-line">
            {t.description}
          </p>
          {t.tags.length > 0 && (
            <div className="flex gap-2 mt-5 flex-wrap">
              {t.tags.map((tag) => (
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
        <div className="card overflow-hidden mb-10">
          <h2 className="text-[18px] font-semibold p-7 pb-0">경로 지도</h2>
          <div className="h-80 mt-4">
            <MapView
              country={t.country}
              center={{
                lat: parseFloat(t.start_lat),
                lng: parseFloat(t.start_lng),
              }}
              zoom={13}
              markers={mapMarkers}
              pathCoordinates={pathCoords}
            />
          </div>
        </div>

        {/* Spot Timeline */}
        {spots.length > 0 && (
          <div className="mb-10">
            <h2 className="text-[18px] font-semibold mb-6">경유지 타임라인</h2>
            <SpotTimeline spots={spots} />
          </div>
        )}

        {/* Reviews */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-[18px] font-semibold">리뷰</h2>
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
                이 코스 걸어봤어요
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
              <h3 className="text-[18px] font-semibold mb-5">리뷰 작성</h3>
              <div className="space-y-5">
                <div>
                  <label className="text-sm text-text-secondary block mb-2">
                    별점
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
                    방문일
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
                    리뷰
                  </label>
                  <textarea
                    value={reviewForm.content}
                    onChange={(e) =>
                      setReviewForm((p) => ({ ...p, content: e.target.value }))
                    }
                    rows={4}
                    maxLength={1000}
                    placeholder="코스에 대한 솔직한 후기를 남겨주세요"
                    className="input-field resize-none"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowReviewForm(false)}
                    className="btn-ghost px-5 py-2.5 text-sm"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSubmitReview}
                    disabled={!reviewForm.content || createReview.isPending}
                    className="btn-primary px-6 py-2.5 text-sm disabled:opacity-50"
                  >
                    {createReview.isPending ? "등록 중..." : "리뷰 등록"}
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
              <h2 className="text-[18px] font-semibold">활동 기록</h2>
              <span className="text-[12px] text-text-tertiary">{activities.length}명이 기록했어요</span>
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
                        {act.distance_km ? `${parseFloat(act.distance_km).toFixed(1)}km` : "-"} · {act.duration_minutes ? `${Math.floor(act.duration_minutes / 60)}시간 ${act.duration_minutes % 60}분` : "-"}
                        {act.total_steps ? ` · ${act.total_steps.toLocaleString()}걸음` : ""}
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
          <h2 className="text-[18px] font-semibold mb-5">작성자</h2>
          <Link
            href={`/profile/${t.author.nickname}`}
            className="flex items-center gap-4 hover:bg-[#F5F6F7] -m-3 p-3 rounded-card transition-colors"
          >
            <div className="w-14 h-14 rounded-full bg-accent/30 flex items-center justify-center overflow-hidden">
              {t.author.profile_image ? (
                <Image
                  src={t.author.profile_image}
                  alt={t.author.nickname}
                  width={56}
                  height={56}
                  className="object-cover"
                />
              ) : (
                <span className="text-2xl">👤</span>
              )}
            </div>
            <div>
              <p className="font-semibold">{t.author.nickname}</p>
              {t.author.is_guide && (
                <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-pill">
                  인증 가이드
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
