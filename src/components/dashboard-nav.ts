import {
    BarChart3,
    Monitor,
    Settings,
    Ticket,
    Users,
    LayoutDashboard,
    Building2,
    LayoutGrid,
    ShieldCheck,
    Megaphone,
    Home,
    User,
    GraduationCap,
} from "lucide-react"

export type NavMainItem = {
    title: string
    href: string
    icon?: React.ComponentType<{ className?: string }>
    badge?: React.ReactNode
    items?: Array<{ title: string; href: string }>
}

export type ParticipantNavRole = "STUDENT" | "GUEST"

/**
 * Participant nav (authenticated student/guest pages).
 */
export const STUDENT_NAV_ITEMS: NavMainItem[] = [
    { title: "Home", href: "/", icon: Home },
    { title: "Join Queue", href: "/queue/join", icon: Ticket },
    { title: "My Tickets", href: "/queue/my-tickets", icon: GraduationCap },
    { title: "Profile", href: "/profile", icon: User },
]

export const GUEST_NAV_ITEMS: NavMainItem[] = [
    { title: "Home", href: "/", icon: Home },
    { title: "Join Queue", href: "/queue/join", icon: Ticket },
    { title: "My Tickets", href: "/queue/my-tickets", icon: Ticket },
    { title: "Profile", href: "/profile", icon: User },
]

export const PARTICIPANT_NAV_ITEMS: Record<ParticipantNavRole, NavMainItem[]> = {
    STUDENT: STUDENT_NAV_ITEMS,
    GUEST: GUEST_NAV_ITEMS,
}

export const STAFF_NAV_ITEMS: NavMainItem[] = [
    { title: "Dashboard", href: "/staff/dashboard", icon: LayoutDashboard },
    { title: "Queue", href: "/staff/queue", icon: Ticket },
    { title: "Now Serving", href: "/staff/now-serving", icon: Megaphone },
    { title: "Public Display", href: "/staff/display", icon: Monitor },
    { title: "Reports", href: "/staff/reports", icon: BarChart3 },
    { title: "Settings", href: "/staff/settings", icon: Settings },
]

export const ADMIN_NAV_ITEMS: NavMainItem[] = [
    { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { title: "Departments", href: "/admin/departments", icon: Building2 },
    { title: "Windows", href: "/admin/windows", icon: LayoutGrid },
    { title: "Accounts", href: "/admin/accounts", icon: Users },
    { title: "Reports", href: "/admin/reports", icon: BarChart3 },
    { title: "Audit Logs", href: "/admin/audit-logs", icon: ShieldCheck },
    { title: "Settings", href: "/admin/settings", icon: Settings },
]
