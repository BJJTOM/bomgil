"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import api from "@/lib/api";
import type { WalkStory } from "@/types";

const MOOD_EMOJIS: Record<string, string> = {
  happy: "😊", peaceful: "☮️", exciting: "🤩", touching: "🥹", funny: "😄",
};
const MOOD_LABELS: Record<string, string> = {
  happy: "즐거웠어요", peaceful: "평화로웠어요", exciting: "신났어요",
  touching: "감동이었어요", funny: "웃겼어요",
};

export default function StoriesPage() {
  const [ordering, setOrdering] = useState("-created_at");

  const { data: stories = [], isLoading } = useQuery<WalkStory[]>({
    queryKey: ["stories", ordering],
    queryFn: async () => {
      const { data } = await api.get(`/stories/?ordering=${ordering}`);
      return data.results ?? data;
    },
  });

  const qc = useQueryClient();
  const likeMutation = useMutation({
    mutationFn: async (id: number) => (await api.post(`/stories/${id}/like/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stories"] }),
  });

  return (
    <div className="md:pt-16 max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-title mb-2">걸은 이야기</h1>
      <p className="text-text-secondary text-sm mb-6">함께 걸은 사람들의 이야기</p>

      <div className="flex gap-2 mb-6">
        {[
          { key: "-created_at", label: "최신" },
          { key: "-like_count", label: "인기" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setOrdering(tab.key)}
            className={`px-4 py-2 rounded-full text-sm ${
              ordering === tab.key ? "bg-primary text-white" : "bg-white border border-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-text-secondary">불러오는 중...</div>
      ) : (
        <div className="space-y-6">
          {stories.map((story) => (
            <div key={story.id} className="bg-white rounded-card shadow-soft overflow-hidden">
              {/* Photos carousel */}
              {story.photos.length > 0 && (
                <div className="flex overflow-x-auto scrollbar-hide">
                  {story.photos.map((photo) => (
                    <div key={photo.id} className="relative min-w-full h-64 flex-shrink-0">
                      <Image src={photo.image} alt="" fill className="object-cover" />
                      {photo.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 p-3">
                          <p className="text-white text-xs">{photo.caption}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="p-5">
                {/* Author */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center overflow-hidden">
                    {story.author.profile_image ? (
                      <Image src={story.author.profile_image} alt="" width={40} height={40} className="object-cover" />
                    ) : (
                      <span className="text-sm">👤</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {story.author.nickname}
                      {story.companions_tagged.length > 0 && (
                        <span className="text-text-secondary font-normal">
                          {" "}+ {story.companions_tagged.length}명
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-text-secondary">
                      <Link href={`/trails/${story.trail_id}`} className="hover:text-primary">
                        {story.trail_region} · {story.trail_title}
                      </Link>
                      {" "}· {new Date(story.created_at).toLocaleDateString("ko")}
                    </p>
                  </div>
                </div>

                {/* Mood */}
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-accent/20 text-primary rounded-full text-xs mb-3">
                  {MOOD_EMOJIS[story.mood]} {MOOD_LABELS[story.mood]}
                </span>

                {/* Content */}
                <p className="text-sm leading-relaxed whitespace-pre-line">{story.content}</p>

                {/* Actions */}
                <div className="flex items-center gap-4 mt-4 pt-3 border-t">
                  <button
                    onClick={() => likeMutation.mutate(story.id)}
                    className={`text-sm ${story.is_liked ? "text-danger" : "text-text-secondary"}`}
                  >
                    {story.is_liked ? "❤️" : "🤍"} {story.like_count}
                  </button>
                  <button className="text-sm text-text-secondary">🔗 공유</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
