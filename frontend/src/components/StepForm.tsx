"use client";

import { cn } from "@/lib/utils";

interface StepFormProps {
  steps: string[];
  currentStep: number;
  children: React.ReactNode;
  onNext?: () => void;
  onPrev?: () => void;
  onSubmit?: () => void;
  isLastStep?: boolean;
  isSubmitting?: boolean;
}

export function StepForm({
  steps,
  currentStep,
  children,
  onNext,
  onPrev,
  onSubmit,
  isLastStep = false,
  isSubmitting = false,
}: StepFormProps) {
  return (
    <div>
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                  index <= currentStep
                    ? "bg-primary text-white"
                    : "bg-gray-200 text-text-secondary"
                )}
              >
                {index < currentStep ? "✓" : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-8 sm:w-16 md:w-24 mx-1 transition-colors",
                    index < currentStep ? "bg-primary" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between">
          {steps.map((step, index) => (
            <span
              key={index}
              className={cn(
                "text-xs",
                index <= currentStep
                  ? "text-primary font-medium"
                  : "text-text-secondary"
              )}
            >
              {step}
            </span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">{children}</div>

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t">
        <button
          onClick={onPrev}
          disabled={currentStep === 0}
          className={cn(
            "px-6 py-3 rounded-button text-sm font-medium transition-all",
            currentStep === 0
              ? "text-gray-300 cursor-not-allowed"
              : "text-text-primary hover:bg-gray-100"
          )}
        >
          이전
        </button>
        {isLastStep ? (
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="px-8 py-3 bg-primary text-white rounded-button text-sm font-bold hover:shadow-hover transition-all disabled:opacity-50"
          >
            {isSubmitting ? "등록 중..." : "코스 등록하기"}
          </button>
        ) : (
          <button
            onClick={onNext}
            className="px-8 py-3 bg-primary text-white rounded-button text-sm font-bold hover:shadow-hover transition-all"
          >
            다음
          </button>
        )}
      </div>
    </div>
  );
}
