import { useEffect, useState } from "react";

export interface InstallPromptResult {
  outcome: "accepted" | "dismissed";
  platform: string;
}

export function useAddToHomeScreen() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // iOS 감지 (버튼 숨김용)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsAndroid(!isIOS);

    // 안드로이드 크롬에서만 beforeinstallprompt 발생
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as any);
      setIsSupported(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const promptToInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome }: InstallPromptResult = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setIsSupported(false);
    }
  };

  return {
    isSupported: isSupported && isAndroid,
    canInstall: !!deferredPrompt && isAndroid,
    promptToInstall,
    isAndroid
  };
}
