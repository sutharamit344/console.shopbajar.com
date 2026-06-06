import React, { useState, useEffect } from "react";
import { useShopOwner } from "@/hooks/useShopOwner";
import { Loader2, Store, Lock, ArrowRight, ShieldAlert, Delete } from "lucide-react";
import Button from "../UI/Button";

interface PortalWrapperProps {
  children: React.ReactNode;
}

export const PortalWrapper: React.FC<PortalWrapperProps> = ({ children }) => {
  const { shop, loading, error } = useShopOwner();
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  const storageKey = shop ? `staff_portal_pin_${shop.id}` : "";

  // Check localStorage for prior authentication
  useEffect(() => {
    if (storageKey) {
      const savedState = localStorage.getItem(storageKey);
      if (savedState === "verified") {
        setIsUnlocked(true);
      }
    }
  }, [storageKey]);

  const handleKeyPress = (num: string) => {
    setPinError("");
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setPinError("");
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  const handleClear = () => {
    setPinError("");
    setPin("");
  };

  const verifyPin = (enteredPin: string) => {
    const correctPin = shop?.staffPin || "1234";
    if (enteredPin === correctPin) {
      localStorage.setItem(storageKey, "verified");
      setIsUnlocked(true);
    } else {
      setPinError("Invalid Access PIN code.");
      setPin("");
      // Add a brief vibration on mobile if supported
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(100);
      }
    }
  };

  // Keyboard support for physical input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isUnlocked || !shop) return;
      
      if (e.key >= "0" && e.key <= "9") {
        handleKeyPress(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Escape" || e.key === "Delete") {
        handleClear();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pin, isUnlocked, shop]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF6A00] mx-auto" />
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest animate-pulse">
            Connecting Staff Portal...
          </p>
        </div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-955 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-md shadow-sm">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-950/30 rounded-md flex items-center justify-center mx-auto text-red-500">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Portal Connection Error
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
            {error || "Unable to establish connection to the staff portal. Confirm that the URL is valid."}
          </p>
        </div>
      </div>
    );
  }

  // If already unlocked, render actual panel
  if (isUnlocked) {
    return <>{children}</>;
  }

  // Render the premium PIN entry lock screen
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-955 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 rounded-md shadow-lg max-w-sm w-full text-center space-y-6 animate-in fade-in duration-300">
        
        {/* Shop Header */}
        <div className="flex flex-col items-center space-y-3.5">
          <div className="w-12 h-12 rounded-md bg-[#FF6A00] flex items-center justify-center text-white font-bold shadow-md">
            {shop.logo ? (
              <img src={shop.logo} alt="" className="w-full h-full object-cover rounded" />
            ) : (
              shop.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {shop.name}
            </h1>
            <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-mono">
              Staff Portal Access
            </p>
          </div>
        </div>

        {/* PIN Indicators */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-center gap-4">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                  pin.length > index
                    ? "bg-[#FF6A00] border-[#FF6A00] scale-110 shadow-sm"
                    : "border-zinc-300 dark:border-zinc-700 bg-transparent"
                }`}
              />
            ))}
          </div>
          
          <div className="h-4.5">
            {pinError ? (
              <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider animate-bounce block">
                {pinError}
              </span>
            ) : (
              <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest flex items-center justify-center gap-1">
                <Lock size={9} /> Enter 4-digit passcode
              </span>
            )}
          </div>
        </div>

        {/* Virtual Keypad */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="h-12 w-12 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-[#FF6A00]/5 dark:hover:bg-[#FF6A00]/10 hover:border-[#FF6A00]/40 text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-center transition-all cursor-pointer active:scale-90"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-12 w-12 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-650 flex items-center justify-center cursor-pointer active:scale-90"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress("0")}
            className="h-12 w-12 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-[#FF6A00]/5 dark:hover:bg-[#FF6A00]/10 hover:border-[#FF6A00]/40 text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-center transition-all cursor-pointer active:scale-90"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 w-12 text-zinc-450 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 flex items-center justify-center cursor-pointer active:scale-90"
            title="Backspace"
          >
            <Delete size={18} />
          </button>
        </div>

      </div>
    </div>
  );
};
