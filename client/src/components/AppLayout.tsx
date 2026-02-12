import { useState } from "react"; 
import { Link, useLocation } from "wouter"; 
import { Menu, Download } from "lucide-react"; 
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"; 
import { cn } from "@/lib/utils"; 
import { useAddToHomeScreen } from "@/hooks/useAddToHomeScreen"; 

interface AppLayoutProps { 
  title: string; 
  rightSlot?: React.ReactNode; 
  children: React.ReactNode; 
} 

type SidebarItem = {
  label: string;
  path: string;
  isInstallMenu?: boolean;
};

const SIDEBAR_ITEMS: SidebarItem[] = [
  { label: "시설물 현행화", path: "/renew" },
  { label: "경쟁사 동향", path: "/etc" },
  { label: "앱 설치", path: "/install", isInstallMenu: true },
];

export default function AppLayout({ title, rightSlot, children }: AppLayoutProps) { 
  const [sidebarOpen, setSidebarOpen] = useState(false); 
  const [currentPath] = useLocation(); 
  const { canInstall, isInstalled, promptToInstall } = useAddToHomeScreen(); 

  return ( 
    <div className="min-h-screen bg-gray-900 text-gray-50 flex flex-col"> 
      <header className="bg-gray-800 shadow-lg border-b border-gray-700"> 
        <div className="flex w-full items-center px-4 py-4"> 
          <div className="w-12 flex items-center shrink-0"> 
            <button 
              type="button" 
              onClick={() => setSidebarOpen(true)} 
              className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-300 hover:text-gray-100 hover:bg-gray-700 transition-colors" 
              aria-label="메뉴 열기" 
            > 
              <Menu className="w-6 h-6" /> 
            </button> 
          </div> 
          <h1 className="text-xl font-bold text-gray-50 flex-grow text-center tracking-wide"> 
            {title} 
          </h1> 
          <div className="w-12 flex justify-end shrink-0"> 
            {rightSlot ?? <div />} 
          </div> 
        </div> 
      </header> 

      <main className="flex-1 flex flex-col relative overflow-hidden"> 
        {children} 
      </main> 

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}> 
        <SheetContent 
          side="left" 
          className="bg-gray-800 border-gray-700 w-[280px] p-0" 
        > 
          <SheetHeader className="p-4 border-b border-gray-700 text-left"> 
            <SheetTitle className="text-gray-50">메뉴</SheetTitle> 
          </SheetHeader> 
          <nav className="flex flex-col py-2"> 
            {SIDEBAR_ITEMS.map((item) => {
              const { label, path, isInstallMenu } = item;
              
              const isDisabled = isInstallMenu && (isInstalled || !canInstall);
              
              const handleClick = () => {
                if (isInstallMenu && canInstall && !isInstalled) {
                  promptToInstall();
                  setSidebarOpen(false);
                }
              };

              return isDisabled ? ( 
                <span 
                  key={path} 
                  className="px-4 py-3 text-gray-500 cursor-not-allowed flex items-center" 
                  aria-disabled 
                > 
                  {isInstallMenu && <Download className="w-5 h-5 mr-3" />}
                  {label} 
                </span> 
              ) : isInstallMenu ? (
                <button
                  key={path}
                  onClick={handleClick}
                  className="px-4 py-3 text-left text-gray-200 hover:bg-gray-700 hover:text-gray-50 transition-colors flex items-center"
                >
                  <Download className="w-5 h-5 mr-3 text-blue-400" />
                  <span className="text-blue-400 font-medium">{label}</span>
                </button>
              ) : ( 
                <Link 
                  key={path} 
                  href={path} 
                  onClick={() => setSidebarOpen(false)} 
                  className={cn( 
                    "px-4 py-3 text-gray-200 hover:bg-gray-700 hover:text-gray-50 transition-colors", 
                    currentPath === path && "bg-gray-700 text-gray-50 font-medium" 
                  )} 
                > 
                  {label} 
                </Link> 
              ); 
            })} 
          </nav> 
        </SheetContent> 
      </Sheet> 
    </div> 
  ); 
}