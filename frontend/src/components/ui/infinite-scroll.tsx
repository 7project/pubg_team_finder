"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import { Button } from "@/components/ui";
import { Loader2 } from "lucide-react";

interface InfiniteScrollProps {
  children: ReactNode;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  loader?: ReactNode;
  endMessage?: ReactNode;
}

export function InfiniteScroll({
  children,
  onLoadMore,
  hasMore,
  isLoading,
  loader,
  endMessage,
}: InfiniteScrollProps) {
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore]);

  const defaultLoader = (
    <div className="flex justify-center py-4">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  const defaultEndMessage = (
    <p className="text-center text-gray-500 py-4">Больше записей нет</p>
  );

  return (
    <div>
      {children}

      {hasMore && (
        <div ref={observerRef} className="flex justify-center py-4">
          {isLoading ? (
            loader || defaultLoader
          ) : (
            <Button variant="secondary" onClick={onLoadMore}>
              Загрузить ещё
            </Button>
          )}
        </div>
      )}

      {!hasMore && children && (
        <div className="text-center py-4">
          {endMessage || defaultEndMessage}
        </div>
      )}
    </div>
  );
}
