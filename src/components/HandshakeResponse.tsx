import React, { useState } from "react";
import { useMessagingStore } from "../store/messaging.store";
import {
  PendingConversation,
  RejectedConversation,
} from "src/types/messaging.types";

export const HandshakeResponse: React.FC<{
  conversation: PendingConversation | RejectedConversation;
}> = ({ conversation }) => {
  const messagingStore = useMessagingStore();
  const [isResponding, setIsResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRespond = async () => {
    try {
      setIsResponding(true);
      setError(null);
      await messagingStore.respondToHandshake({
        conversationId: conversation.conversationId,
        myAlias: conversation.myAlias,
        theirAlias: conversation.theirAlias,
        kaspaAddress: conversation.kaspaAddress,
        status:
          conversation.status === "rejected" ? "pending" : conversation.status,
        createdAt: conversation.createdAt,
        lastActivity: conversation.lastActivity,
        initiatedByMe: conversation.initiatedByMe,
      });
    } catch (error) {
      console.error("Error responding to handshake:", error);
      setError(
        error instanceof Error ? error.message : "Failed to send response"
      );
    } finally {
      setIsResponding(false);
    }
  };

  return (
    <div className="bg-gray-100 rounded-lg p-4 my-2">
      <div className="mb-3">
        <p className="my-1 text-gray-800">Handshake received from: {conversation.kaspaAddress}</p>
        <p className="my-1 text-gray-800">Their alias: {conversation.theirAlias}</p>
        <p className="my-1 text-gray-800">Status: {conversation.status}</p>
        {error && <p className="text-red-600 mt-2">{error}</p>}
      </div>
      {!conversation.initiatedByMe && conversation.status === "pending" && (
        <button
          onClick={handleRespond}
          className="bg-green-600 text-white border-none rounded py-2 px-4 cursor-pointer text-sm disabled:bg-gray-500 disabled:cursor-not-allowed hover:bg-green-700 hover:disabled:bg-gray-500"
          disabled={isResponding}
        >
          {isResponding ? "Sending Response..." : "Accept & Send Response"}
        </button>
      )}
    </div>
  );
};
