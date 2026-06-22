/**
 * createConversation.ts
 *
 * Browser-side function that calls the /api/conversation/create proxy.
 * Never calls tavusapi.com directly — the API key stays server-side.
 *
 * Consumed by: hooks/useConversation.ts
 * Tavus docs: https://docs.tavus.io/api-reference/conversations/create-conversation
 */

import { apiPost } from "./client";
import type {
  CreateConversationResponse,
} from "./types";

interface CreateConversationParams {
  role: string;
  conversationalContext?: string;
  persona_id?: string;
  replica_id?: string;
}

export async function createConversation(
  params: CreateConversationParams
): Promise<CreateConversationResponse> {
  return apiPost<CreateConversationParams, CreateConversationResponse>(
    "/api/conversation/create",
    params
  );
}
