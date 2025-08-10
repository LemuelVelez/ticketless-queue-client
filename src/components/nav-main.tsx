import { IconPlus, IconBell, type Icon } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Link, useNavigate } from "react-router-dom"

export function NavMain({
  items,
  activeItem,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
  }[]
  activeItem?: string
}) {
  const navigate = useNavigate()

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              tooltip="Join New Queue"
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear cursor-pointer"
              onClick={() => navigate("/student")}
            >
              <IconPlus />
              <span>Join New Queue</span>
            </SidebarMenuButton>
            <Button
              size="icon"
              className="size-8 group-data-[collapsible=icon]:opacity-0 cursor-pointer"
              variant="outline"
              onClick={() => navigate("/my-queue")}
              aria-label="Notifications"
              title="Notifications"
            >
              <IconBell />
              <span className="sr-only">Notifications</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={activeItem === item.title}
                className={`${activeItem === item.title
                    ? "bg-blue-100 text-blue-900 border-l-4 border-blue-600 font-semibold dark:bg-blue-900 dark:text-blue-100 dark:border-blue-400"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  } transition-all duration-200 cursor-pointer`}
              >
                <Link to={item.url}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
