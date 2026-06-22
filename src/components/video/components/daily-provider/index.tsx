import { DailyProvider } from "@daily-co/daily-react";

export const DailyWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <DailyProvider>
      {children}
    </DailyProvider>
  )
}
