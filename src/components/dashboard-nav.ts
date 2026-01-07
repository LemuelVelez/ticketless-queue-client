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
    QrCode,
    Home,
} from "lucide-react"

export type NavMainItem = {
    title: string
    href: string
    icon?: React.ComponentType<{ className?: string }>
    badge?: React.ReactNode
    items?: Array<{ title: string; href: string }>
}

/**
 * ✅ Student nav (public pages — no login, no dashboard)
 * Use this for student-facing layouts/pages.
 */
export const STUDENT_NAV_ITEMS: NavMainItem[] = [
    { title: "Home", href: "/student", icon: Home },
    { title: "Join Queue", href: "/join", icon: QrCode },
    { title: "Public Display", href: "/display", icon: Monitor },
]

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
