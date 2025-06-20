// this file is the legacy code that came from old codebase
// it is intended to be temporary to progressively move towards modularization

import { FC, useCallback, useEffect, useState } from "react";
import { unknownErrorToErrorLike } from "./utils/errors";
import { Contact, NetworkType } from "./types/all";
import { FetchApiMessages } from "./components/FetchApiMessages";
import { useMessagingStore } from "./store/messaging.store";
import { ContactCard } from "./components/ContactCard";
import { WalletInfo } from "./components/WalletInfo";
import { ErrorCard } from "./components/ErrorCard";
import { useWalletStore } from "./store/wallet.store";
import { WalletGuard } from "./containers/WalletGuard";
import { NewChatForm } from "./components/NewChatForm";
import styles from "./OneLiner.module.css";
import clsx from "clsx";
import { MessageSection } from "./containers/MessagesSection";

// import our new hook
import { useKaspaClient } from "./hooks/useKaspaClient";

export const OneLiner: FC = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWalletReady, setIsWalletReady] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>(
    import.meta.env.VITE_DEFAULT_KASPA_NETWORK ?? "mainnet"
  );

  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();
  const unlockedWalletName = useWalletStore(
    (state) => state.unlockedWallet?.name
  );
  
  // OneLiner.tsx – when you create the hook
  const {
    client: currentClient,
    status: connectionStatus,
    isConnected,
    connect,
    disconnect,
  } = useKaspaClient(selectedNetwork, {
    onConnect: (c) => {
      walletStore.setSelectedNetwork(c.networkId); 
      walletStore.setRpcClient(c);
    },
    onError: (e) => setErrorMessage(`Connection Failed: ${e.message}`),
  });

  // Auto-clear connection-related errors when connection succeeds
  useEffect(() => {
    if (isConnected && connectionStatus.includes("Connected")) {
      if (
        errorMessage?.includes("WebSocket") ||
        errorMessage?.includes("RPC") ||
        errorMessage?.includes("Failed to start messaging")
      ) {
        setErrorMessage(null);
      }
    }
  }, [isConnected, connectionStatus, errorMessage]);

  const onWalletUnlocked = useCallback(() => {
    setIsWalletReady(true);
  }, []);

  const onNewChatClicked = useCallback(async () => {
    try {
      if (!walletStore.unlockedWallet?.password) {
        setErrorMessage("Please unlock your wallet first");
        return;
      }

      messageStore.setIsCreatingNewChat(true);
    } catch (error) {
      console.error("Failed to start new chat:", error);
      setErrorMessage(
        `Failed to start new chat: ${unknownErrorToErrorLike(error)}`
      );
    }
  }, [walletStore.unlockedWallet, messageStore]);

  const onStartMessagingProcessClicked = useCallback(async () => {
    try {
      setErrorMessage(null);

      if (!currentClient || !currentClient.connected) {
        setErrorMessage(
          "Please choose a network and connect to the Kaspa Network first"
        );
        return;
      }

      if (!walletStore.unlockedWallet) {
        setErrorMessage("Please unlock your wallet first");
        return;
      }

      const { receiveAddress } = await walletStore.start(currentClient);
      const receiveAddressStr = receiveAddress.toString();

      messageStore.initializeConversationManager(receiveAddressStr);
      messageStore.loadMessages(receiveAddressStr);
      messageStore.setIsLoaded(true);
      setErrorMessage(null);

      const shouldFetchApi = localStorage.getItem("kasia_fetch_api_on_start");
      if (shouldFetchApi === "true") {
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("kasia-trigger-api-fetch", {
              detail: { address: receiveAddressStr },
            })
          );
        }, 1000);
        localStorage.removeItem("kasia_fetch_api_on_start");
      }
    } catch (error) {
      console.error("Failed to start messaging process:", error);
      setErrorMessage(
        `Failed to start messaging: ${unknownErrorToErrorLike(error)}`
      );
    }
  }, [currentClient, walletStore, messageStore]);

  const onContactClicked = useCallback(
    (contact: Contact) => {
      if (!walletStore.address) {
        console.error("No wallet address");
        return;
      }
      messageStore.setIsCreatingNewChat(false);
      messageStore.setOpenedRecipient(contact.address);
    },
    [messageStore, walletStore.address]
  );

  return (
    <div className="container">
      <div className="header-container">
        <div className="app-title">
          <img src="/kasia-logo.png" alt="Kasia Logo" className="app-logo" />
          <h1>Kasia</h1>
        </div>
        <div className="header-right">
          <WalletInfo
            state={walletStore.address ? "connected" : "detected"}
            address={walletStore.address?.toString()}
            isWalletReady={isWalletReady}
          />
        </div>
      </div>

      <div className="px-8 py-4 bg-[var(--primary-bg)]">
        <div className="flex items-center gap-4">
          {isWalletReady ? (
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 w-full">
              <div className="flex flex-col items-start text-xs gap-1 whitespace-nowrap">
                <div>
                  <strong>Network:</strong> {walletStore.selectedNetwork}
                </div>
                <div>
                  <strong>Wallet Name:</strong> {unlockedWalletName}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <button
                  className={clsx(
                    "bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white text-sm font-bold py-2 px-4 rounded cursor-pointer",
                    { "opacity-50 cursor-not-allowed": messageStore.isLoaded }
                  )}
                  onClick={onStartMessagingProcessClicked}
                >
                  Start Wallet Service
                </button>
                <button
                  onClick={() => {
                    walletStore.lock();
                    setIsWalletReady(false);
                    messageStore.setIsLoaded(false);
                    messageStore.setOpenedRecipient(null);
                    messageStore.setIsCreatingNewChat(false);
                  }}
                  className="bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white text-sm font-bold py-2 px-4 rounded cursor-pointer"
                >
                  Close Wallet
                </button>
              </div>
            </div>
          ) : (
            <WalletGuard
              onSuccess={onWalletUnlocked}
              selectedNetwork={selectedNetwork}
              onNetworkChange={setSelectedNetwork}
              isConnected={isConnected}
            />
          )}
        </div>
      </div>

      {messageStore.isLoaded ? (
        <div className="messages-container">
          <div className="contacts-sidebar">
            <div className="contacts-header">
              <h3>Conversations</h3>
              <button
                onClick={onNewChatClicked}
                className="new-conversation-btn"
              >
                New Chat
              </button>
            </div>
            <div className="contacts-list">
              {messageStore.contacts
                ?.filter(
                  (c) =>
                    c?.address && c.address !== walletStore.address?.toString()
                )
                .map((c) => (
                  <ContactCard
                    isSelected={c.address === messageStore.openedRecipient}
                    key={`${c.address}-${c.status || "unknown"}`}
                    contact={c}
                    onClick={onContactClicked}
                  />
                ))}
            </div>
          </div>
          <MessageSection />
          {walletStore.address && (
            <div className="hidden">
              <FetchApiMessages address={walletStore.address.toString()} />
            </div>
          )}
        </div>
      ) : null}

      <div id="transactions">
        <ErrorCard
          error={errorMessage}
          onDismiss={() => setErrorMessage(null)}
        />
      </div>

      {messageStore.isCreatingNewChat && (
        <div className={styles["modal-overlay"]}>
          <NewChatForm
            onClose={() => messageStore.setIsCreatingNewChat(false)}
          />
        </div>
      )}
    </div>
  );
};
