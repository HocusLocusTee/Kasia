import React, { useState, useCallback, useEffect } from 'react';
import { useMessagingStore } from '../store/messaging.store';
import { useWalletStore } from '../store/wallet.store';
import { kaspaToSompi, sompiToKaspaString } from 'kaspa-wasm';

interface NewChatFormProps {
  onClose: () => void;
}

export const NewChatForm: React.FC<NewChatFormProps> = ({ onClose }) => {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [handshakeAmount, setHandshakeAmount] = useState('0.2');
  const [error, setError] = useState<string | null>(null);
  const [recipientWarning, setRecipientWarning] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isCheckingRecipient, setIsCheckingRecipient] = useState(false);
  
  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();
  const balance = useWalletStore((state) => state.balance);

  // Handle clicking outside to close
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const checkRecipientBalance = useCallback(async (address: string) => {
    if (!address || (!address.startsWith('kaspa:') && !address.startsWith('kaspatest:'))) {
      setRecipientWarning(null);
      return;
    }

    setIsCheckingRecipient(true);
    setRecipientWarning(null);

    try {
      // Use the Kaspa API to check recipient balance
      const networkId = walletStore.accountService?.networkId || 'mainnet';
      const baseUrl = networkId === "mainnet" 
        ? "https://api.kaspa.org" 
        : "https://api-tn10.kaspa.org";
      
      const encodedAddress = encodeURIComponent(address);
      const response = await fetch(`${baseUrl}/addresses/${encodedAddress}/balance`);
      
      if (!response.ok) {
        setRecipientWarning('Could not verify recipient balance. They may not be able to respond if they have no KAS.');
        return;
      }

      const balanceData = await response.json();
      const balance = BigInt(balanceData.balance || 0);
      
      if (balance === BigInt(0)) {
        setRecipientWarning('⚠️ Warning: Recipient has zero KAS balance and will not be able to respond to your handshake. Consider sending a higher amount.');
      } else {
        setRecipientWarning(null);
      }
    } catch (error) {
      console.warn('Could not check recipient balance:', error);
      setRecipientWarning('Could not verify recipient balance. They may not be able to respond if they have no KAS.');
    } finally {
      setIsCheckingRecipient(false);
    }
  }, [walletStore.accountService]);

  // Debounced recipient balance check
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (recipientAddress) {
        checkRecipientBalance(recipientAddress);
      }
    }, 1000); // Wait 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }, [recipientAddress, checkRecipientBalance]);

  const handleAmountChange = useCallback((value: string) => {
    // Allow decimal numbers
    if (/^\d*\.?\d*$/.test(value)) {
      setHandshakeAmount(value);
    }
  }, []);

  const handleQuickAmount = useCallback((amount: string) => {
    setHandshakeAmount(amount);
  }, []);

  const validateAndPrepareHandshake = useCallback(() => {
    setError(null);

    if (!walletStore.unlockedWallet?.password) {
      setError("Please unlock your wallet first");
      return false;
    }

    // Validate address format
    if (!recipientAddress.startsWith('kaspa:') && !recipientAddress.startsWith('kaspatest:')) {
      setError("Invalid Kaspa address format. Must start with 'kaspa:' or 'kaspatest:'");
      return false;
    }

    // Check if we already have an active conversation
    const existingConversations = messageStore.getActiveConversations();
    const existingConv = existingConversations.find(conv => conv.kaspaAddress === recipientAddress);
    if (existingConv) {
      setError("You already have an active conversation with this address");
      return false;
    }

    // Validate amount
    const amountSompi = kaspaToSompi(handshakeAmount);
    if (!amountSompi) {
      setError("Invalid handshake amount");
      return false;
    }

    // Check minimum amount
    const minAmount = kaspaToSompi("0.2");
    if (amountSompi < minAmount!) {
      setError("Handshake amount must be at least 0.2 KAS");
      return false;
    }

    // Check balance
    if (!balance?.mature || balance.mature < amountSompi) {
      setError(`Insufficient balance. Need ${handshakeAmount} KAS, have ${balance?.matureDisplay || "0"} KAS`);
      return false;
    }

    return true;
  }, [recipientAddress, handshakeAmount, balance, messageStore, walletStore]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateAndPrepareHandshake()) {
      return;
    }

    setShowConfirmation(true);
  };

  const confirmHandshake = async () => {
    setError(null);
    setIsLoading(true);
    setShowConfirmation(false);

    try {
      const amountSompi = kaspaToSompi(handshakeAmount);
      
      // Initiate handshake with custom amount
      await messageStore.initiateHandshake(recipientAddress, amountSompi);

      // Close the form
      onClose();
    } catch (error) {
      console.error('Failed to create new chat:', error);
      setError(error instanceof Error ? error.message : 'Failed to create new chat');
    } finally {
      setIsLoading(false);
    }
  };

  if (showConfirmation) {
    return (
      <div className="modal-overlay" onClick={handleOverlayClick}>
        <div className="bg-[var(--secondary-bg)] p-5 rounded-xl relative max-w-lg w-[90%] max-h-[90vh] overflow-y-auto border border-[var(--border-color)] animate-[modalFadeIn_0.3s_ease-out] text-white" onClick={(e) => e.stopPropagation()}>
          <h3 className="my-0 mb-5 text-white text-xl">Confirm Handshake</h3>
          <div className="text-white/80 text-sm mb-5 leading-6">
            <p><strong>Recipient:</strong> {recipientAddress}</p>
            <p><strong>Amount:</strong> {handshakeAmount} KAS</p>
            <p><strong>Your Balance:</strong> {balance?.matureDisplay || "0"} KAS</p>
            {parseFloat(handshakeAmount) > 0.2 && (
              <p className="text-white/70 text-xs mt-1 leading-6">
                The extra amount ({(parseFloat(handshakeAmount) - 0.2).toFixed(8)} KAS) helps the recipient respond even if they have no KAS.
              </p>
            )}
            {/* Only show warning if user is NOT sending extra amount */}
            {recipientWarning && parseFloat(handshakeAmount) <= 0.2 && (
              <p className="text-amber-400 text-sm my-1 leading-6">
                {recipientWarning}
              </p>
            )}
            <p>This will initiate a handshake conversation. Continue?</p>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button
              type="button"
              className="py-2 px-5 border-none rounded cursor-pointer text-sm font-bold transition-all bg-gray-600 text-white hover:bg-gray-500 disabled:opacity-60 disabled:cursor-not-allowed hover:disabled:bg-gray-600 active:disabled:translate-y-0 hover:disabled:translate-y-0 hover:-translate-y-px active:translate-y-0"
              onClick={() => setShowConfirmation(false)}
              disabled={isLoading}
            >
              Back
            </button>
            <button
              type="button"
              className="py-2 px-5 border-none rounded cursor-pointer text-sm font-bold transition-all bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed hover:disabled:bg-blue-500 active:disabled:translate-y-0 hover:disabled:translate-y-0 hover:-translate-y-px active:translate-y-0"
              onClick={confirmHandshake}
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Confirm & Send'}
            </button>
          </div>
        </div>
      </div>
    );
  }

      return (
      <div className="modal-overlay" onClick={handleOverlayClick}>
        <div className="bg-[var(--secondary-bg)] p-5 rounded-xl relative max-w-lg w-[90%] max-h-[90vh] overflow-y-auto border border-[var(--border-color)] animate-[modalFadeIn_0.3s_ease-out] text-white" onClick={(e) => e.stopPropagation()}>
          <h3 className="my-0 mb-5 text-white text-xl">Start New Conversation</h3>
                  <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label className="block mb-1 text-white font-bold text-sm" htmlFor="recipientAddress">
                Recipient Address
              </label>
              <input
                className="w-full py-2 px-3 border border-white/10 rounded-md text-sm bg-black/30 text-white font-mono transition-all box-border leading-normal h-10 flex items-center placeholder-white/50 hover:bg-white/10 hover:border-white/20 focus:outline-none focus:bg-white/10 focus:border-white/20 disabled:bg-black/50 disabled:text-white/30"
                type="text"
                id="recipientAddress"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="kaspa:..."
                disabled={isLoading}
                required
              />
              {isCheckingRecipient && (
                <div className="text-white/60 text-xs mt-1 italic">
                  Checking recipient balance...
                </div>
              )}
              {recipientWarning && (
                <div className="bg-amber-500/10 text-amber-400 py-2 px-2 rounded border border-amber-500/30 mt-1 text-sm leading-normal">
                  {recipientWarning}
                </div>
              )}
            </div>

                      <div className="mb-5">
              <label className="block mb-1 text-white font-bold text-sm" htmlFor="handshakeAmount">
                Handshake Amount (KAS)
              </label>
              <input
                className="w-full py-2 px-3 border border-white/10 rounded-md text-sm bg-black/30 text-white font-mono transition-all box-border leading-normal h-10 flex items-center mb-2 placeholder-white/50 hover:bg-white/10 hover:border-white/20 focus:outline-none focus:bg-white/10 focus:border-white/20"
                type="text"
                id="handshakeAmount"
                value={handshakeAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.2"
                disabled={isLoading}
              />
              <div className="flex gap-2 mb-2">
                              <button
                  type="button"
                  className={`flex-1 bg-blue-500/20 border border-blue-500/50 rounded text-blue-400 cursor-pointer py-2 px-3 transition-all text-xs font-bold h-9 flex items-center justify-center hover:bg-blue-500/30 hover:border-blue-500 hover:-translate-y-px disabled:bg-blue-500/10 disabled:border-blue-500/20 disabled:text-blue-500/30 disabled:cursor-not-allowed disabled:transform-none ${handshakeAmount === '0.2' ? 'bg-blue-500 border-blue-500 text-white' : ''}`}
                  onClick={() => handleQuickAmount('0.2')}
                  disabled={isLoading}
                >
                  0.2
                </button>
                <button
                  type="button"
                  className={`flex-1 bg-blue-500/20 border border-blue-500/50 rounded text-blue-400 cursor-pointer py-2 px-3 transition-all text-xs font-bold h-9 flex items-center justify-center hover:bg-blue-500/30 hover:border-blue-500 hover:-translate-y-px disabled:bg-blue-500/10 disabled:border-blue-500/20 disabled:text-blue-500/30 disabled:cursor-not-allowed disabled:transform-none ${handshakeAmount === '0.5' ? 'bg-blue-500 border-blue-500 text-white' : ''}`}
                  onClick={() => handleQuickAmount('0.5')}
                  disabled={isLoading}
                >
                  0.5
                </button>
                <button
                  type="button"
                  className={`flex-1 bg-blue-500/20 border border-blue-500/50 rounded text-blue-400 cursor-pointer py-2 px-3 transition-all text-xs font-bold h-9 flex items-center justify-center hover:bg-blue-500/30 hover:border-blue-500 hover:-translate-y-px disabled:bg-blue-500/10 disabled:border-blue-500/20 disabled:text-blue-500/30 disabled:cursor-not-allowed disabled:transform-none ${handshakeAmount === '1' ? 'bg-blue-500 border-blue-500 text-white' : ''}`}
                  onClick={() => handleQuickAmount('1')}
                  disabled={isLoading}
                >
                  1
                </button>
            </div>
                          <div className="text-white/70 text-xs mt-1 leading-6">
                Default: 0.2 KAS. Higher amounts help recipients respond even if they have no KAS.
                This creates a better experience for newcomers to Kasia.
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 text-red-400 py-2 px-2 rounded border border-red-500/30 mb-4 text-sm">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                className="py-2 px-5 border-none rounded cursor-pointer text-sm font-bold transition-all bg-gray-600 text-white hover:bg-gray-500 disabled:opacity-60 disabled:cursor-not-allowed hover:disabled:bg-gray-600 active:disabled:translate-y-0 hover:disabled:translate-y-0 hover:-translate-y-px active:translate-y-0"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-2 px-5 border-none rounded cursor-pointer text-sm font-bold transition-all bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed hover:disabled:bg-blue-500 active:disabled:translate-y-0 hover:disabled:translate-y-0 hover:-translate-y-px active:translate-y-0"
                disabled={isLoading}
              >
                {isLoading ? 'Initiating...' : 'Start Chat'}
              </button>
            </div>
        </form>
      </div>
    </div>
  );
}; 