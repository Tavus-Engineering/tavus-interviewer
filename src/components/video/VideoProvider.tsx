/**
 * VideoProvider.tsx
 *
 * Wraps the scaffolded DailyProvider from @daily-co/daily-react.
 *
 * Consumed by: InterviewScreen
 */

import React from "react";
import { DailyWrapper } from "./components/daily-provider";

interface VideoProviderProps {
  children: React.ReactNode;
}

export function VideoProvider({ children }: VideoProviderProps) {
  return <DailyWrapper>{children}</DailyWrapper>;
}
