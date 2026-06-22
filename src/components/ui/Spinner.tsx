/**
 * Spinner.tsx
 *
 * Loading spinner indicator. Uses brand primary by default.
 */

interface SpinnerProps {
  size?: number;
  color?: string;
}

export function Spinner({ size = 24, color = "var(--color-primary)" }: SpinnerProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: `3px solid var(--color-border)`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}
