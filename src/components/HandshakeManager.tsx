import React from "react";
import { useMessagingStore } from "../store/messaging.store";
import { HandshakeState, PendingConversation } from "../types/messaging.types";

const HandshakeManager: React.FC = () => {
  const messagingStore = useMessagingStore();
  const pendingConversations = messagingStore.getPendingConversations();

  const handleAcceptHandshake = async (
    pendingConversation: PendingConversation
  ) => {
    try {
      if (!pendingConversation.kaspaAddress) {
        throw new Error("Invalid conversation: missing kaspaAddress");
      }

      // Convert Conversation to HandshakeState
      const handshakeState: HandshakeState = {
        conversationId: pendingConversation.conversationId,
        myAlias: pendingConversation.myAlias || "Anonymous",
        theirAlias: pendingConversation.theirAlias || null,
        senderAddress: pendingConversation.kaspaAddress,
        kaspaAddress: pendingConversation.kaspaAddress,
        status: pendingConversation.status,
        createdAt: pendingConversation.createdAt,
        lastActivity: pendingConversation.lastActivity,
        initiatedByMe: pendingConversation.initiatedByMe,
      };

      await messagingStore.respondToHandshake(handshakeState);
    } catch (error) {
      console.error("Error accepting handshake:", error);
    }
  };

  if (pendingConversations.length === 0) {
    return null;
  }

  return (
    <div className="p-4 bg-gray-900 rounded-lg my-4 text-white">
      <h3 className="m-0 mb-4 text-white text-xl">Pending Handshakes</h3>
      <div className="flex flex-col gap-4">
        {pendingConversations.map((conv) => (
          <div key={conv.kaspaAddress} className="bg-gray-800 rounded-md p-4 flex justify-between items-center">
            <div className="flex-1">
              <p className="my-1 text-sm text-blue-400 font-mono break-all">From: {conv.kaspaAddress}</p>
              {conv.theirAlias && (
                <p className="my-1 text-sm text-green-400">Their Alias: {conv.theirAlias}</p>
              )}
              <p className="my-1 text-sm text-gray-400 text-xs">Status: {conv.status}</p>
            </div>
            {!conv.initiatedByMe && (
              <button
                onClick={() => handleAcceptHandshake(conv)}
                className="bg-blue-600 text-white border-none rounded py-2 px-4 cursor-pointer text-sm transition-colors ml-4 whitespace-nowrap hover:bg-blue-500"
              >
                Accept & Send Response
              </button>
            )}
            {conv.initiatedByMe && (
              <p className="text-gray-400 text-sm my-0 ml-4 italic">Waiting for their response...</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HandshakeManager;
