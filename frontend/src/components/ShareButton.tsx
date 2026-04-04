"use client";

import { useState } from "react";

interface ShareButtonProps {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
}

export function ShareButton({
  title,
  description,
  url,
  imageUrl,
}: ShareButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowMenu(false);
  };

  const handleKakaoShare = () => {
    if (typeof window !== "undefined" && (window as any).Kakao) {
      const Kakao = (window as any).Kakao;
      Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title,
          description,
          imageUrl: imageUrl || "",
          link: { mobileWebUrl: url, webUrl: url },
        },
        buttons: [
          {
            title: "코스 보기",
            link: { mobileWebUrl: url, webUrl: url },
          },
        ],
      });
    }
    setShowMenu(false);
  };

  const handleTwitterShare = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      `${title} - ${description}`
    )}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, "_blank", "width=600,height=400");
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-4 py-2 bg-white rounded-button shadow-soft text-sm hover:shadow-hover transition-all"
      >
        <span>🔗</span> 공유
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-full mt-2 bg-white rounded-card shadow-hover z-50 py-2 min-w-[160px]">
            <button
              onClick={handleKakaoShare}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-warm transition-colors flex items-center gap-2"
            >
              💬 카카오톡
            </button>
            <button
              onClick={handleTwitterShare}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-warm transition-colors flex items-center gap-2"
            >
              🐦 트위터/X
            </button>
            <button
              onClick={handleCopyLink}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-warm transition-colors flex items-center gap-2"
            >
              {copied ? "✅ 복사됨!" : "🔗 링크 복사"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
