import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonTone = "default" | "primary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
}

export function Button({
  children,
  className = "",
  tone = "default",
  type = "button",
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      className={`v2-button v2-button--${tone} ${className}`.trim()}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
