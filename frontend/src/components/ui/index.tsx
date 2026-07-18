"use client";

import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "rounded-lg font-medium transition-all duration-200 min-h-button flex items-center justify-center gap-2",
          "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background-dark",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          {
            "bg-primary hover:bg-primary-600 active:scale-[0.98] text-white": variant === "primary",
            "bg-military hover:bg-military-light active:scale-[0.98] text-white": variant === "secondary",
            "bg-transparent hover:bg-white/10 active:scale-[0.98] text-gray-300": variant === "ghost",
            "bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white": variant === "danger",
          },
          {
            "px-3 py-1.5 text-sm": size === "sm",
            "px-4 py-2": size === "md",
            "px-6 py-3 text-lg": size === "lg",
          },
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-background-darker rounded-lg border border-white/5 p-4",
          className
        )}
        {...props}
    />
  );
});
Card.displayName = "Card";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full px-4 py-2.5 bg-background-dark border border-white/10 rounded-lg",
            "text-gray-100 placeholder-gray-500",
            "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
            "transition-colors duration-200",
            error && "border-red-500 focus:ring-red-500/50",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            "w-full px-4 py-2.5 bg-background-dark border border-white/10 rounded-lg",
            "text-gray-100 placeholder-gray-500",
            "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
            "transition-colors duration-200 resize-none",
            error && "border-red-500 focus:ring-red-500/50",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }>(
  ({ className, label, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            "w-full px-4 py-2.5 bg-background-dark border border-white/10 rounded-lg",
            "text-gray-100",
            "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
            "transition-colors duration-200",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
Select.displayName = "Select";

export const Badge: React.FC<React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "primary" | "success" | "warning" | "danger" }> = ({
  className, variant = "default", ...props
}) => {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        {
          "bg-gray-700 text-gray-300": variant === "default",
          "bg-primary/20 text-primary": variant === "primary",
          "bg-green-500/20 text-green-400": variant === "success",
          "bg-yellow-500/20 text-yellow-400": variant === "warning",
          "bg-red-500/20 text-red-400": variant === "danger",
        },
        className
      )}
      {...props}
    />
  );
};

export const Avatar: React.FC<{ src?: string; alt?: string; size?: "sm" | "md" | "lg"; fallback?: string }> = ({
  src, alt, size = "md", fallback
}) => {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-lg",
    lg: "w-16 h-16 text-xl",
  };

  return (
    <div className={cn("rounded-full bg-military flex items-center justify-center overflow-hidden", sizeClasses[size])}>
      {src ? (
        <img src={src} alt={alt || ""} className="w-full h-full object-cover" />
      ) : (
        <span className="text-white font-medium">{fallback || "?"}</span>
      )}
    </div>
  );
};

export const StarRating: React.FC<{ value: number; onChange?: (value: number) => void; readonly?: boolean }> = ({
  value, onChange, readonly = false
}) => {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange?.(star)}
          className={cn(
            "text-2xl transition-transform",
            star <= value ? "text-primary" : "text-gray-600",
            !readonly && "hover:scale-110 cursor-pointer"
          )}
        >
          ★
        </button>
      ))}
    </div>
  );
};

export const Progress: React.FC<{ value: number; max?: number; className?: string }> = ({
  value, max = 100, className
}) => {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cn("w-full h-2 bg-gray-700 rounded-full overflow-hidden", className)}>
      <div
        className="h-full bg-primary transition-all duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

export const Spinner: React.FC<{ size?: "sm" | "md" | "lg" }> = ({ size = "md" }) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };
  return (
    <svg className={cn("animate-spin text-primary", sizeClasses[size])} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
};

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => {
  return <div className={cn("animate-pulse bg-gray-700 rounded", className)} />;
};

export const Divider: React.FC<{ className?: string }> = ({ className }) => {
  return <div className={cn("h-px bg-white/10", className)} />;
};

export const Toggle: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; label?: string }> = ({
  checked, onChange, label
}) => {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-11 h-6 rounded-full transition-colors duration-200",
          checked ? "bg-primary" : "bg-gray-700"
        )}
      >
        <div
          className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200",
            checked && "translate-x-5"
          )}
        />
      </div>
      {label && <span className="text-gray-300">{label}</span>}
    </label>
  );
};