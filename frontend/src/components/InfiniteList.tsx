"use client";

import { useEffect, useRef } from "react";
import { TrailCardSkeleton } from "./ui/Skeleton";

interface InfiniteListProps {
  children: React.ReactNode;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
  isLoading?: boolean;
  skeletonCount?: number;
}

export function InfiniteList({
  children,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  isLoading,
  skeletonCount = 4,
}: InfiniteListProps) {
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!observerRef.current || !hasNextPage || !fetchNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <TrailCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {children}
      {hasNextPage && (
        <div ref={observerRef} className="py-8 flex justify-center">
          {isFetchingNextPage && (
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
