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

export type ParticipantNavRole = "STUDENT" | "ALUMNI" | "GUEST"

/**
 * Participant nav (authenticated participant pages).
 * GUEST is intentionally mapped to ALUMNI routes.
 */
export const STUDENT_NAV_ITEMS: NavMainItem[] = [
    { title: "Home", href: "/student/home", icon: Home },
    { title: "Join Queue", href: "/student/join", icon: Ticket },
    { title: "My Tickets", href: "/student/my-tickets", icon: GraduationCap },
    { title: "Profile", href: "/student/profile", icon: User },
]

export const ALUMNI_NAV_ITEMS: NavMainItem[] = [
    { title: "Home", href: "/alumni/home", icon: Home },
    { title: "Join Queue", href: "/alumni/join", icon: Ticket },
    { title: "My Tickets", href: "/alumni/my-tickets", icon: Ticket },
    { title: "Profile", href: "/alumni/profile", icon: User },
]

// Guest uses the same pages/routes as Alumni
export const GUEST_NAV_ITEMS: NavMainItem[] = ALUMNI_NAV_ITEMS

export const PARTICIPANT_NAV_ITEMS: Record<ParticipantNavRole, NavMainItem[]> = {
    STUDENT: STUDENT_NAV_ITEMS,
    ALUMNI: ALUMNI_NAV_ITEMS,
    GUEST: GUEST_NAV_ITEMS,
}

export const STAFF_NAV_ITEMS: NavMainItem[] = [
    { title: "Dashboard", href: "/staff/dashboard", icon: LayoutDashboard },
    { title: "Queue", href: "/staff/queue", icon: Ticket },
    { title: "Queue Control Center", href: "/staff/queue-control-center", icon: LayoutGrid },
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