import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

const variantClass: Record<ButtonVariant, string> = {
  primary: "app-btn-primary",
  secondary: "app-btn-secondary",
  danger: "app-btn-danger",
};

export function Button({
  variant = "secondary",
  size,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm";
  children: ReactNode;
}) {
  return (
    <button
      className={`app-btn ${variantClass[variant]} ${size === "sm" ? "app-btn-sm" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
