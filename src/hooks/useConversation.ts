/**
 * useConversation.ts
 *
 * Creates and manages the Tavus conversation lifecycle. Calls the server-side
 * proxy to create a conversation, holds the conversation_url for the provider,
 * and handles ending the conversation.
 *
 * Consumed by: LobbyScreen, InterviewScreen
 * Tavus docs: https://docs.tavus.io/api-reference/conversations/create-conversation
 */

import { useState, useCallback } from "react";
import { createConversation } from "@/lib/tavus/createConversation";
import { endConversation } from "@/lib/tavus/endConversation";

interface ConversationState {
  conversationId: string | null;
  conversationUrl: string | null;
  isCreating: boolean;
  isEnding: boolean;
  error: string | null;
}

export function useConversation() {
  const [state, setState] = useState<ConversationState>({
    conversationId: null,
    conversationUrl: null,
    isCreating: false,
    isEnding: false,
    error: null,
  });

  const create = useCallback(async (role: string, persona_id?: string, replica_id?: string) => {
    setState((prev) => ({ ...prev, isCreating: true, error: null }));
    try {
      const response = await createConversation({ role, persona_id, replica_id });
      setState({
        conversationId: response.conversation_id,
        conversationUrl: response.conversation_url,
        isCreating: false,
        isEnding: false,
        error: null,
      });
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create conversation";
      setState((prev) => ({ ...prev, isCreating: false, error: message }));
      throw err;
    }
  }, []);

  const end = useCallback(async () => {
    if (!state.conversationId) return;
    setState((prev) => ({ ...prev, isEnding: true, error: null }));
    try {
      await endConversation(state.conversationId);
      setState((prev) => ({ ...prev, isEnding: false }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to end conversation";
      setState((prev) => ({ ...prev, isEnding: false, error: message }));
      throw err;
    }
  }, [state.conversationId]);

  return {
    ...state,
    create,
    end,
  };
}
