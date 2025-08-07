import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function SiteHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
      <div className="flex w-full items-center gap-1 px-3 sm:px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1 h-8 w-8 sm:h-7 sm:w-7" />
        <Separator
          orientation="vertical"
          className="mx-1 sm:mx-2 data-[orientation=vertical]:h-4"
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm sm:text-base font-medium truncate">
            <span className="hidden sm:inline">JRMSU Queue Management System</span>
            <span className="sm:hidden">JRMSU Queue</span>
          </h1>
        </div>
        {/* Optional: Add mobile menu or actions */}
        <div className="flex items-center gap-2 sm:hidden">
          {/* You can add mobile-specific actions here */}
        </div>
      </div>
    </header>
  )
}
