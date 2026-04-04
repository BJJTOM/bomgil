"use client";

import { useCallback, useState } from "react";
import Image from "next/image";

interface ImageUploaderProps {
  images: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
}

export function ImageUploader({
  images,
  onChange,
  maxFiles = 10,
}: ImageUploaderProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      const newImages = [...images, ...files].slice(0, maxFiles);
      onChange(newImages);
    },
    [images, onChange, maxFiles]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages = [...images, ...files].slice(0, maxFiles);
    onChange(newImages);
  };

  const handleRemove = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const handleReorder = (from: number, to: number) => {
    const newImages = [...images];
    const [moved] = newImages.splice(from, 1);
    newImages.splice(to, 0, moved);
    onChange(newImages);
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-card p-8 text-center transition-colors cursor-pointer ${
          dragOver
            ? "border-primary bg-accent/10"
            : "border-gray-300 hover:border-primary"
        }`}
        onClick={() => document.getElementById("image-input")?.click()}
      >
        <div className="text-4xl mb-2">📷</div>
        <p className="text-sm text-text-secondary">
          이미지를 드래그하거나 클릭하여 업로드
        </p>
        <p className="text-xs text-text-secondary mt-1">
          최대 {maxFiles}장 · JPG, PNG, WebP
        </p>
        <input
          id="image-input"
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* Preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
          {images.map((file, index) => (
            <div
              key={index}
              className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100"
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", String(index))}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = parseInt(e.dataTransfer.getData("text/plain"));
                handleReorder(from, index);
              }}
            >
              <Image
                src={URL.createObjectURL(file)}
                alt={`업로드 ${index + 1}`}
                fill
                className="object-cover"
              />
              {index === 0 && (
                <span className="absolute top-1 left-1 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded">
                  대표
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(index);
                }}
                className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
