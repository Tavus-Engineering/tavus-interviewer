/**
 * Request/response types for the Tavus API proxy calls.
 *
 * Tavus docs: https://docs.tavus.io/api-reference
 */

export interface CreateConversationResponse {
  conversation_id: string;
  conversation_name: string;
  conversation_url: string;
  status: string;
  created_at: string;
}

export interface EndConversationRequest {
  conversation_id: string;
}

export interface EndConversationResponse {
  status: string;
}
