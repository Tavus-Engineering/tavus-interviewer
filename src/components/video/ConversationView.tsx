/**
 * ConversationView.tsx
 *
 * Layout wrapper around the scaffolded <Conversation /> component.
 * The Conversation component renders the replica video and self-view via
 * Daily; call controls are rendered as overlay children by the screen.
 *
 * Consumed by: InterviewScreen
 */

import React from "react";
import { Conversation } from "./components/conversation";

interface ConversationViewProps {
  conversationUrl: string;
  onLeave: () => void;
  videoDeviceId?: string | null;
  audioDeviceId?: string | null;
  speakerDeviceId?: string | null;
  showPresentation?: boolean;
  children?: React.ReactNode;
}

export function ConversationView({
  conversationUrl,
  onLeave,
  videoDeviceId,
  audioDeviceId,
  speakerDeviceId,
  showPresentation = true,
  children,
}: ConversationViewProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        backgroundColor: "var(--color-background-dark)",
        overflow: "hidden",
      }}
    >
      <Conversation
        conversationUrl={conversationUrl}
        onLeave={onLeave}
        videoDeviceId={videoDeviceId}
        audioDeviceId={audioDeviceId}
        speakerDeviceId={speakerDeviceId}
        showPresentation={showPresentation}
      />
      {children}
    </div>
  );
}
