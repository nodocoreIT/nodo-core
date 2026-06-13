import { type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "ghost" | "ghost-light";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-600 active:scale-[.98] border border-transparent",
  ghost:
    "bg-transparent text-navy border border-navy/30 hover:border-navy hover:bg-navy/5",
  "ghost-light":
    "bg-transparent text-white border hover:bg-white/[.08] hover:border-white transition-colors",
};

const ghostLightBorderStyle = { borderColor: "rgba(255,255,255,.28)" };

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm rounded-sm",
  md: "px-5 py-2.5 text-[15px] rounded-md",
  lg: "px-7 py-3.5 text-[16px] rounded-md",
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  style,
  children,
  ...props
}: ButtonProps) {
  const needsBorderStyle = variant === "ghost-light";

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      style={needsBorderStyle ? { ...ghostLightBorderStyle, ...style } : style}
      {...props}
    >
      {children}
    </button>
  );
}
