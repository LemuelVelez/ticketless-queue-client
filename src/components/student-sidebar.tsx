import type * as React from "react"
import {
  IconBook,
  IconCalendarEvent,
  IconCash,
  IconClipboardList,
  IconDashboard,
  IconFileText,
  IconHelp,
  IconHistory,
  IconList,
  IconMedicalCross,
  IconNotification,
  IconSchool,
  IconSettings,
  IconTicket,
  IconUser,
  IconUsers,
} from "@tabler/icons-react"
import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Juan Dela Cruz",
    email: "juan.delacruz@jrmsu.edu.ph",
    avatar: "/avatars/student.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/student",
      icon: IconDashboard,
    },
    {
      title: "My Queue",
      url: "/my-queue",
      icon: IconList,
    },
    {
      title: "Join Queue",
      url: "/join-queue",
      icon: IconTicket,
    },
    {
      title: "Queue History",
      url: "/queue-history", // updated to real route
      icon: IconHistory,
    },
    {
      title: "Notifications",
      url: "#",
      icon: IconNotification,
    },
  ],
  navServices: [
    {
      title: "Registrar Office",
      icon: IconFileText,
      isActive: false,
      url: "#",
      items: [
        {
          title: "Transcript Request",
          url: "#",
        },
        {
          title: "Enrollment Services",
          url: "#",
        },
        {
          title: "Certificate Request",
          url: "#",
        },
      ],
    },
    {
      title: "Cashier",
      icon: IconCash,
      url: "#",
      items: [
        {
          title: "Tuition Payment",
          url: "#",
        },
        {
          title: "Miscellaneous Fees",
          url: "#",
        },
        {
          title: "Payment History",
          url: "#",
        },
      ],
    },
    {
      title: "Library",
      icon: IconBook,
      url: "#",
      items: [
        {
          title: "Book Borrowing",
          url: "#",
        },
        {
          title: "Book Return",
          url: "#",
        },
        {
          title: "Research Assistance",
          url: "#",
        },
      ],
    },
    {
      title: "Campus Clinic",
      icon: IconMedicalCross,
      url: "#",
      items: [
        {
          title: "Medical Consultation",
          url: "#",
        },
        {
          title: "Health Certificate",
          url: "#",
        },
        {
          title: "Medical Records",
          url: "#",
        },
      ],
    },
    {
      title: "NSTP/ROTC",
      icon: IconUsers,
      url: "#",
      items: [
        {
          title: "NSTP Registration",
          url: "#",
        },
        {
          title: "ROTC Processing",
          url: "#",
        },
        {
          title: "Community Service",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Profile Settings",
      url: "#",
      icon: IconUser,
    },
    {
      title: "Help & Support",
      url: "#",
      icon: IconHelp,
    },
    {
      title: "SMS Settings",
      url: "#",
      icon: IconSettings,
    },
  ],
  documents: [
    {
      name: "Student Handbook",
      url: "#",
      icon: IconBook,
    },
    {
      name: "Service Directory",
      url: "#",
      icon: IconClipboardList,
    },
    {
      name: "Academic Calendar",
      url: "#",
      icon: IconCalendarEvent,
    },
  ],
}

export function AppSidebar({
  onLogout,
  currentPage = "dashboard",
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  onLogout?: () => void
  currentPage?: string
}) {
  // Map current page to active nav items
  const getActiveNavItem = () => {
    switch (currentPage) {
      case "dashboard":
        return "Dashboard"
      case "my-queue":
        return "My Queue"
      case "join-queue":
        return "Join Queue"
      case "queue-history":
        return "Queue History"
      default:
        return "Dashboard"
    }
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <a href="#">
                <IconSchool className="!size-5" />
                <span className="text-base font-semibold">JRMSU Queue</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} activeItem={getActiveNavItem()} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} onLogout={onLogout} />
      </SidebarFooter>
    </Sidebar>
  )
}
