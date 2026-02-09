import { useEffect, useState } from "react";

export interface InstallPromptResult {
  outcome: "accepted" | "dismissed";
  platform: string;
}

export function useAddToHomeScreen() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);  // 👈 추가

  useEffect(() => {
    // iOS 감지 (버튼 숨김용)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsAndroid(!isIOS);

    // 👇 PWA 설치 여부 확인 추가
    const checkIfInstalled = () => {
      // 1. display-mode 확인 (standalone = 설치됨)
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return;
      }
      
      // 2. iOS Safari standalone 모드 확인
      if ((window.navigator as any).standalone === true) {
        setIsInstalled(true);
        return;
      }
      
      setIsInstalled(false);
    };

    checkIfInstalled();

    // 안드로이드 크롬에서만 beforeinstallprompt 발생
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as any);
      setIsSupported(true);
    };

    // 👇 앱 설치 완료 이벤트 추가
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsSupported(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);  // 👈 추가
    
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);  // 👈 추가
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
    isAndroid,
    isInstalled  // 👈 추가
  };
}