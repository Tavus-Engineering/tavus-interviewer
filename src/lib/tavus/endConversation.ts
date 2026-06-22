/**
 * endConversation.ts
 *
 * Browser-side function that calls the /api/conversation/end proxy.
 * Never calls tavusapi.com directly — the API key stays server-side.
 *
 * Consumed by: hooks/useConversation.ts
 * Tavus docs: https://docs.tavus.io/api-reference/conversations/end-conversation
 */

import { apiPost } from "./client";
import type {
  EndConversationRequest,
  EndConversationResponse,
} from "./types";

export async function endConversation(
  conversationId: string
): Promise<EndConversationResponse> {
  return apiPost<EndConversationRequest, EndConversationResponse>(
    "/api/conversation/end",
    { conversation_id: conversationId }
  );
}
