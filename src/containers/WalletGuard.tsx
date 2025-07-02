import { useEffect, useRef, useState } from "react";
import { useWalletStore } from "../store/wallet.store";
import { Mnemonic } from "kaspa-wasm";
import { NetworkSelector } from "./NetworkSelector";
import { NetworkType } from "../types/all";
import { Wallet, WalletDerivationType } from "src/types/wallet.type";
import { PASSWORD_MIN_LENGTH, disablePasswordRequirements } from "../config/password";
import {MnemonicEntry} from "../components/MnemonicEntry";

type Step = {
  type: "home" | "create" | "import" | "unlock" | "finalizing" | "migrate";
  mnemonic?: Mnemonic;
  name?: string;
  walletId?: string; // For migration
};

type WalletGuardProps = {
  onSuccess: () => void;
  selectedNetwork: NetworkType;
  onNetworkChange: (network: NetworkType) => void;
  isConnected: boolean;
};

export const WalletGuard = ({
  onSuccess,
  selectedNetwork,
  onNetworkChange,
  isConnected,
}: WalletGuardProps) => {
  const [step, setStep] = useState<Step>({ type: "home" });
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [seedPhraseLength, setSeedPhraseLength] = useState<12 | 24>(24); // Default to 24 words
  const [derivationType, setDerivationType] =
    useState<WalletDerivationType>("standard"); // Default to standard
  const passwordRef = useRef<HTMLInputElement>(null);
  const mnemonicRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const {
    wallets,
    selectedWalletId,
    unlockedWallet,
    loadWallets,
    selectWallet,
    createWallet,
    deleteWallet,
    unlock,
    lock,
    migrateLegacyWallet,
    selectedNetwork: currentSelectedNetwork,
  } = useWalletStore();

  useEffect(() => {
    setIsMounted(true);
    loadWallets();
    return () => setIsMounted(false);
  }, [loadWallets]);

  useEffect(() => {
    if (unlockedWallet) {
      setStep({ type: "finalizing", mnemonic: undefined });
      onSuccess();
    }
  }, [unlockedWallet, onSuccess]);

  if (!isMounted) return null;

  const onClickStep = (type: Step["type"], walletId?: string) => {
    setStep({ type, walletId });
    setError(null);
  };

  const onCreateWallet = async () => {
    if (!nameRef.current?.value || !passwordRef.current?.value) {
      setError("Please enter a name and password");
      return;
    }

    try {
      // Generate mnemonic with specified word count
      // Pass the word count parameter to Mnemonic.random()
      const mnemonic = Mnemonic.random(seedPhraseLength);

      // Verify the mnemonic has the correct word count
      const wordCount = mnemonic.phrase.split(" ").length;
      if (wordCount !== seedPhraseLength) {
        throw new Error(
          `Generated mnemonic has ${wordCount} words, expected ${seedPhraseLength}`
        );
      }

      const pw = passwordRef.current!.value;
      if (!disablePasswordRequirements && pw.length < PASSWORD_MIN_LENGTH) {
        setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
        return;
      }

      await createWallet(
        nameRef.current.value,
        mnemonic,
        passwordRef.current.value,
        derivationType
      );
      setStep({ type: "finalizing", mnemonic });
    } catch (err) {
      console.error("Wallet creation error:", err);
      setError(err instanceof Error ? err.message : "Failed to create wallet");
    }
  };

  const onImportWallet = async () => {
    if (
      !nameRef.current?.value ||
      !mnemonicRef.current?.value ||
      !passwordRef.current?.value
    ) {
      setError("Please enter all fields");
      return;
    }

    const pw = passwordRef.current!.value;
    if (!disablePasswordRequirements && pw.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
      return;
    }

    try {
      const mnemonic = new Mnemonic(mnemonicRef.current.value);
      await createWallet(
        nameRef.current.value,
        mnemonic,
        passwordRef.current.value,
        derivationType
      );
      setStep({ type: "finalizing" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid mnemonic");
    }
  };

  const onUnlockWallet = async () => {
    if (!selectedWalletId || !passwordRef.current?.value) {
      setError("Please enter your wallet password");
      return;
    }

    try {
      await unlock(selectedWalletId, passwordRef.current.value);
    } catch (err) {
      console.error("Unlock error:", err);
      // Clear the password field and focus it
      if (passwordRef.current) {
        passwordRef.current.value = "";
        passwordRef.current.focus();
      }
      // Show user-friendly error message
      if (
        err instanceof Error &&
        err.message.toLowerCase().includes("invalid password")
      ) {
        setError("Incorrect password. Please try again.");
      } else {
        setError("Failed to unlock wallet. Please try again.");
      }
    }
  };

  const onMigrateWallet = async () => {
    if (
      !step.walletId ||
      !passwordRef.current?.value ||
      !nameRef.current?.value
    ) {
      setError("Please enter all required fields");
      return;
    }

    try {
      await migrateLegacyWallet(
        step.walletId,
        passwordRef.current.value,
        nameRef.current.value
      );
      setStep({ type: "home" });
      setError(null);
      // Show success message
      alert(
        "Wallet migrated successfully! You can now use the new standard wallet."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to migrate wallet");
    }
  };

  const onDeleteWallet = (walletId: string) => {
    if (window.confirm("Are you sure you want to delete this wallet?")) {
      deleteWallet(walletId);
    }
  };

  const onSelectWallet = (wallet: Wallet) => {
    selectWallet(wallet.id);
    setStep({ type: "unlock" });
  };

  const getDerivationTypeDisplay = (derivationType?: WalletDerivationType) => {
    if (derivationType === "standard") {
      return (
        <span className="bg-emerald-500 text-white py-1 px-2 rounded text-xs font-medium">
          Standard (Kaspium Compatible)
        </span>
      );
    } else {
      return <span className="bg-amber-500 text-white py-1 px-2 rounded text-xs font-medium">Legacy</span>;
    }
  };

  if (step.type === "home") {
    return (
      <div className="max-w-2xl mx-auto my-8 p-8 bg-[var(--secondary-bg)] rounded-xl border border-[var(--border-color)]">
        <NetworkSelector
          selectedNetwork={selectedNetwork}
          onNetworkChange={onNetworkChange}
          isConnected={isConnected}
        />
        <h2 className="text-center my-8 text-[var(--text-primary)] text-2xl font-semibold">Select Wallet</h2>
        <div className="flex flex-col gap-4 mb-8">
                      {wallets.map((wallet) => (
              <div key={wallet.id} className="bg-[var(--primary-bg)] border border-[var(--border-color)] rounded-lg p-4 flex justify-between items-center">
                <div className="flex flex-col gap-2">
                  <div className="font-semibold text-[var(--text-primary)]">{wallet.name}</div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    Created: {new Date(wallet.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2">
                  {getDerivationTypeDisplay(wallet.derivationType)}
                                      {wallet.derivationType === "legacy" && (
                      <button
                        onClick={() => onClickStep("migrate", wallet.id)}
                        className="bg-blue-500 text-white border-none py-1 px-2 rounded cursor-pointer text-xs transition-colors hover:bg-blue-600"
                        title="Migrate to standard derivation for Kaspium compatibility"
                      >
                        Migrate
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onSelectWallet(wallet)}
                    className="bg-[var(--accent-blue)] text-white border-none py-2 px-4 rounded-md cursor-pointer text-sm transition-colors hover:bg-[var(--accent-blue)]/90"
                  >
                    Select
                  </button>
                  <button
                    onClick={() => onDeleteWallet(wallet.id)}
                    className="bg-transparent text-red-500 border border-red-500 py-2 px-4 rounded-md cursor-pointer text-sm transition-all hover:bg-red-500 hover:text-white"
                  >
                    Delete
                  </button>
                </div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => onClickStep("create")}
            className="bg-[var(--accent-blue)] text-white border-none py-3 px-6 rounded-lg cursor-pointer text-base transition-colors hover:bg-[var(--accent-blue)]/90"
          >
            Create New Wallet
          </button>
          <button
            onClick={() => onClickStep("import")}
            className="bg-[var(--accent-blue)] text-white border-none py-3 px-6 rounded-lg cursor-pointer text-base transition-colors hover:bg-[var(--accent-blue)]/90"
          >
            Import Wallet
          </button>
        </div>
      </div>
    );
  }

  if (step.type === "create" || step.type === "import") {
    return (
      <div className="max-w-2xl mx-auto my-8 p-8 bg-[var(--secondary-bg)] rounded-xl border border-[var(--border-color)]">
        <h2 className="text-center my-8 text-[var(--text-primary)] text-2xl font-semibold">
          {step.type === "create" ? "Create New Wallet" : "Import Wallet"}
        </h2>

        {/* Derivation Type Selection */}
        <div className="mb-4">
          <label className="block mb-2 font-medium text-white">Derivation Standard</label>
          <div className="flex flex-col gap-3 mt-2">
            <label className="flex items-start gap-2 p-3 bg-[var(--primary-bg)] border border-[var(--border-color)] rounded-md cursor-pointer transition-all hover:border-[var(--accent-blue)] hover:bg-blue-500/5">
              <input
                type="radio"
                name="derivationType"
                value="standard"
                checked={derivationType === "standard"}
                onChange={(e) =>
                  setDerivationType(e.target.value as WalletDerivationType)
                }
                className="w-auto m-0 accent-[var(--accent-blue)]"
              />
              <div>
                <span className="font-medium text-[var(--text-primary)]">Standard (Recommended)</span>
                <small className="block text-[var(--text-secondary)] text-sm mt-1">Compatible with Kaspium and other standard wallets</small>
              </div>
            </label>
            <label className="flex items-start gap-2 p-3 bg-[var(--primary-bg)] border border-[var(--border-color)] rounded-md cursor-pointer transition-all hover:border-[var(--accent-blue)] hover:bg-blue-500/5">
              <input
                type="radio"
                name="derivationType"
                value="legacy"
                checked={derivationType === "legacy"}
                onChange={(e) =>
                  setDerivationType(e.target.value as WalletDerivationType)
                }
                className="w-auto m-0 accent-[var(--accent-blue)]"
              />
              <div>
                <span className="font-medium text-[var(--text-primary)]">Legacy</span>
                <small className="block text-[var(--text-secondary)] text-sm mt-1">For compatibility with older wallets</small>
              </div>
            </label>
          </div>
        </div>

        <div className="mb-4">
          <label className="block mb-2 font-medium text-white">Wallet Name</label>
          <input ref={nameRef} type="text" placeholder="My Wallet" className="w-full py-2 px-3 bg-slate-700 border border-slate-600 rounded text-white transition-all focus:outline-none focus:border-slate-500 focus:bg-slate-600" />
        </div>

        {step.type === "create" && (
          <div className="form-group">
            <label>Seed Phrase Length</label>
            <div className="seed-length-options">
              <label className="radio-option">
                <input
                  type="radio"
                  name="seedLength"
                  value="12"
                  checked={seedPhraseLength === 12}
                  onChange={() => setSeedPhraseLength(12)}
                />
                <span>12 words</span>
                <small>128-bit entropy</small>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="seedLength"
                  value="24"
                  checked={seedPhraseLength === 24}
                  onChange={() => setSeedPhraseLength(24)}
                />
                <span>24 words (Recommended)</span>
                <small>256-bit entropy</small>
              </label>
            </div>
          </div>
        )}

        {step.type === "import" && (
          <div className="form-group">
            <label>Seed Phrase Length</label>
            <div className="seed-length-options">
              <label className="radio-option">
                <input
                  type="radio"
                  name="importSeedLength"
                  value="12"
                  checked={seedPhraseLength === 12}
                  onChange={() => setSeedPhraseLength(12)}
                />
                <span>12 words</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="importSeedLength"
                  value="24"
                  checked={seedPhraseLength === 24}
                  onChange={() => setSeedPhraseLength(24)}
                />
                <span>24 words</span>
              </label>
            </div>
            <MnemonicEntry
              seedPhraseLength={seedPhraseLength}
              mnemonicRef={mnemonicRef}
            />
          </div>
        )}

        <div className="form-group">
          <label>Password</label>
          <input
            ref={passwordRef}
            type="password"
            placeholder="Enter password"
          />
        </div>
        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <button onClick={() => onClickStep("home")}>Back</button>
          <button
            onClick={step.type === "create" ? onCreateWallet : onImportWallet}
          >
            {step.type === "create" ? "Create" : "Import"}
          </button>
        </div>
      </div>
    );
  }

  if (step.type === "migrate") {
    const walletToMigrate = wallets.find((w) => w.id === step.walletId);
    return (
      <div className="wallet-guard">
        <h2>Migrate Legacy Wallet</h2>
        <div className="migration-info">
          <p>
            Migrating wallet: <strong>{walletToMigrate?.name}</strong>
          </p>
          <p>
            This will create a new wallet using the standard Kaspa derivation
            path (m/44'/111111'/0') that is compatible with Kaspium and other
            standard wallets.
          </p>
          <div className="warning-message">
            ⚠️ Your original wallet will remain unchanged. You'll need to
            transfer funds to the new wallet addresses.
          </div>
        </div>
        <div className="form-group">
          <label>New Wallet Name</label>
          <input
            ref={nameRef}
            type="text"
            placeholder={`${walletToMigrate?.name} (Standard)`}
            defaultValue={`${walletToMigrate?.name} (Standard)`}
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            ref={passwordRef}
            type="password"
            placeholder="Enter your current wallet password"
          />
        </div>
        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <button onClick={() => onClickStep("home")}>Cancel</button>
          <button onClick={onMigrateWallet}>Migrate Wallet</button>
        </div>
      </div>
    );
  }

  if (step.type === "unlock") {
    const selectedWallet = wallets.find((w) => w.id === selectedWalletId);
    return (
      <div className="wallet-guard">
        <h2>Unlock Wallet</h2>
        {selectedWallet && (
          <div className="selected-wallet-info">
            <span className="wallet-name">{selectedWallet.name}</span>
          </div>
        )}
        <div className="form-group">
          <label>Password</label>
          <input
            ref={passwordRef}
            type="password"
            placeholder="Enter your password"
            className={error ? "error" : ""}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onUnlockWallet();
              }
            }}
          />
        </div>
        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <button onClick={() => onClickStep("home")}>Back</button>
          <button onClick={onUnlockWallet}>Unlock</button>
        </div>
      </div>
    );
  }

  if (step.type === "finalizing") {
    return (
      <div className="wallet-guard">
        <h2>
          {step.mnemonic ? "Wallet Created Successfully!" : "Wallet Unlocked!"}
        </h2>
        {step.type === "finalizing" && step.mnemonic && (
          <div className="mnemonic-display">
            <p>Please save your mnemonic phrase securely:</p>
            <div className="warning-message">
              ⚠️ This is the only time you will see your seed phrase - back it
              up now!
            </div>
            <div className="show-phrase-toggle">
              <input
                type="checkbox"
                id="showPhrase"
                onChange={(e) => {
                  const phraseElement =
                    document.querySelector(".mnemonic-phrase");
                  if (phraseElement) {
                    phraseElement.classList.toggle("visible", e.target.checked);
                  }
                }}
              />
              <label htmlFor="showPhrase">
                I understand that anyone with my seed phrase can access my
                wallet. Show seed phrase
              </label>
            </div>
            <div className="mnemonic-phrase">
              {step.mnemonic.phrase.split(" ").map((word, i) => (
                <span key={i} className="mnemonic-word">
                  <span className="word-number">{i + 1}.</span> {word}
                </span>
              ))}
            </div>
            <button
              className="copy-button"
              onClick={() => {
                const words = step.mnemonic?.phrase || "";
                navigator.clipboard.writeText(words).then(() => {
                  const btn = document.querySelector(
                    ".copy-button"
                  ) as HTMLButtonElement;
                  if (btn) {
                    const originalText = btn.textContent;
                    btn.textContent = "Copied!";
                    setTimeout(() => {
                      btn.textContent = originalText;
                    }, 2000);
                  }
                });
              }}
            >
              Copy Seed Phrase
            </button>
          </div>
        )}
        <button
        className="bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white text-sm font-bold py-2 px-4 rounded cursor-pointer" 
        onClick={() => onClickStep("home")}>
          Back to Wallets
        </button>
      </div>
    );
  }

  return null;
};
