/**
 * 앱 설치 페이지 (placeholder)
 * 라우트: /install
 */
import AppLayout from "@/components/AppLayout";

export default function Install() {
  return (
    <AppLayout title="앱 설치">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center text-gray-400">
          <p className="text-lg">앱 설치 페이지입니다.</p>
          <p className="text-sm mt-2">추후 설치 안내 및 PWA 프롬프트 등을 구성할 수 있습니다.</p>
        </div>
      </div>
    </AppLayout>
  );
}
