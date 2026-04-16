"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useT } from "@/stores/language";

interface NotificationItem {
  id: number;
  title: string;
  body: string;
  notification_type: "like" | "comment" | "reply" | "follow" | "system";
  target_type: "post" | "trail" | "activity" | null;
  target_id: number | null;
  actor_nickname: string | null;
  actor_profile_image: string | null;
  is_read: boolean;
  created_at: string;
}

const NOTIF_ICON: Record<string, { icon: string; color: string; bg: string }> = {
  like: { icon: "♥", color: "#E74C3C", bg: "#FDECEC" },
  comment: { icon: "💬", color: "#3498DB", bg: "#EBF5FB" },
  reply: { icon: "↩", color: "#8E44AD", bg: "#F4ECF7" },
  follow: { icon: "👤+", color: "#27AE60", bg: "#EAFAF1" },
  system: { icon: "🔔", color: "#F39C12", bg: "#FEF9E7" },
};

export default function NotificationsPage() {
  const { isAuthenticated } = useAuthStore();
  const { t, language } = useT();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<NotificationItem[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data } = await api.get("/auth/notifications/");
      return (data.results || data) as NotificationItem[];
    },
    enabled: isAuthenticated,
  });

  const readAll = useMutation({
    mutationFn: async () => (await api.post("/auth/notifications/read-all/")).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notification-count"] });
    },
  });

  const handleClick = (n: NotificationItem) => {
    // Optimistically mark as read
    if (!n.is_read) {
      qc.setQueryData<NotificationItem[]>(["notifications"], (old) =>
        old ? old.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)) : old,
      );
      qc.invalidateQueries({ queryKey: ["notification-count"] });
    }
    if (n.target_type === "post" && n.target_id) {
      router.push(`/community/post/${n.target_id}`);
    } else if (n.target_type === "trail" && n.target_id) {
      router.push(`/trails/${n.target_id}`);
    } else if (n.target_type === "activity" && n.target_id) {
      router.push(`/activities/${n.target_id}`);
    } else if (n.notification_type === "follow" && n.actor_nickname) {
      router.push(`/profile/${n.actor_nickname}`);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return t("community.minutesAgo").replace("{n}", String(mins));
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t("community.hoursAgo").replace("{n}", String(hours));
    const days = Math.floor(hours / 24);
    if (days < 7) return t("community.daysAgo").replace("{n}", String(days));
    return new Date(dateStr).toLocaleDateString(language);
  };

  if (!isAuthenticated) {
    return (
      <div className="md:pt-[60px] min-h-screen bg-warm flex items-center justify-center">
        <p className="text-text-tertiary">{t("community.loginRequired")}</p>
      </div>
    );
  }

  return (
    <div className="md:pt-[60px] min-h-screen bg-warm">
      <header className="sticky top-0 md:top-[60px] z-30 bg-white/95 backdrop-blur-xl border-b border-border-light">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h1 className="text-[18px] font-bold">{t("notifications.title")}</h1>
          </div>
          {notifications.length > 0 && (
            <button
              onClick={() => readAll.mutate()}
              className="text-[13px] text-primary font-semibold hover:underline"
            >
              {t("notifications.readAll")}
            </button>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto">
        {isLoading ? (
          <div className="py-20 text-center text-text-tertiary">
            <div className="flex gap-1.5 justify-center mb-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-secondary flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ADB5BD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            </div>
            <p className="text-[15px] text-text-tertiary">{t("notifications.empty")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border-light">
            {notifications.map((n) => {
              const iconInfo = NOTIF_ICON[n.notification_type] || NOTIF_ICON.system;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-white/60 transition-colors ${
                    !n.is_read ? "bg-primary/5" : ""
                  }`}
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: iconInfo.bg, color: iconInfo.color }}
                  >
                    <span className="text-[18px]">{iconInfo.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] leading-snug ${!n.is_read ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-[13px] text-text-secondary leading-snug mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                    <p className="text-[12px] text-text-tertiary mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
