/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { MoreHorizontal, Plus, RefreshCw, Shield, UserCog } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ADMIN_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { adminApi, type Department, type ServiceWindow, type StaffUser } from "@/api/admin"
import { useSession } from "@/hooks/use-session"
import { api } from "@/lib/http"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type AccountRole = "STAFF" | "ADMIN"

type AccountRow = {
    id: string
    name: string
    email: string
    role: AccountRole
    active: boolean
    assignedDepartment: string | null
    assignedWindow: string | null
    /**
     * Accounts coming from /admin/staff are manageable with adminApi.updateStaff/delete.
     * The current admin session row is shown as a helpful fallback if /admin/staff returns empty.
     */
    source: "staff" | "session"
    raw?: StaffUser
}

function staffId(s: StaffUser) {
    return s._id ?? s.id ?? ""
}

function isEnabledFlag(value: boolean | undefined) {
    return value !== false
}

function roleBadge(role: AccountRole) {
    if (role === "ADMIN") {
        return (
            <Badge className="gap-1" variant="default">
                <Shield className="h-3.5 w-3.5" />
                ADMIN
            </Badge>
        )
    }
    return (
        <Badge variant="secondary" className="gap-1">
            <UserCog className="h-3.5 w-3.5" />
            STAFF
        </Badge>
    )
}

export default function AdminAccountsPage() {
    const location = useLocation()
    const { user: sessionUser } = useSession()

    const dashboardUser: DashboardUser | undefined = React.useMemo(() => {
        if (!sessionUser) return undefined
        return {
            name: sessionUser.name ?? "Admin",
            email: sessionUser.email ?? "",
        }
    }, [sessionUser])

    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)

    const [departments, setDepartments] = React.useState<Department[]>([])
    const [windows, setWindows] = React.useState<ServiceWindow[]>([])
    const [staff, setStaff] = React.useState<StaffUser[]>([])

    const [q, setQ] = React.useState("")
    const [deptFilter, setDeptFilter] = React.useState<string>("all")
    const [tab, setTab] = React.useState<"all" | "active" | "inactive">("all")

    // dialogs
    const [createOpen, setCreateOpen] = React.useState(false)
    const [editOpen, setEditOpen] = React.useState(false)
    const [resetOpen, setResetOpen] = React.useState(false)
    const [deleteOpen, setDeleteOpen] = React.useState(false)

    // selected user (only staff rows are editable with current adminApi)
    const [selected, setSelected] = React.useState<StaffUser | null>(null)

    // create form
    const [cName, setCName] = React.useState("")
    const [cEmail, setCEmail] = React.useState("")
    const [cPassword, setCPassword] = React.useState("")
    const [cDepartmentId, setCDepartmentId] = React.useState<string>("")
    const [cWindowId, setCWindowId] = React.useState<string>("")
    const [cRole, setCRole] = React.useState<AccountRole>("STAFF")

    // edit form
    const [eName, setEName] = React.useState("")
    const [eRole, setERole] = React.useState<AccountRole>("STAFF")
    const [eActive, setEActive] = React.useState(true)
    const [eDepartmentId, setEDepartmentId] = React.useState<string>("")
    const [eWindowId, setEWindowId] = React.useState<string>("")

    // reset password form
    const [newPassword, setNewPassword] = React.useState("")

    const deptById = React.useMemo(() => {
        const m = new Map<string, Department>()
        for (const d of departments) m.set(d._id, d)
        return m
    }, [departments])

    const winById = React.useMemo(() => {
        const m = new Map<string, ServiceWindow>()
        for (const w of windows) m.set(w._id, w)
        return m
    }, [windows])

    const enabledDepartments = React.useMemo(
        () => departments.filter((d) => isEnabledFlag(d.enabled)),
        [departments],
    )

    const enabledWindows = React.useMemo(
        () => windows.filter((w) => isEnabledFlag(w.enabled)),
        [windows],
    )

    const windowsForDept = React.useCallback(
        (departmentId: string) => enabledWindows.filter((w) => w.department === departmentId),
        [enabledWindows],
    )

    const fetchAll = React.useCallback(async () => {
        setLoading(true)
        try {
            const [deptRes, winRes, staffRes] = await Promise.all([
                adminApi.listDepartments(),
                adminApi.listWindows(),
                adminApi.listStaff(),
            ])

            setDepartments(deptRes.departments ?? [])
            setWindows(winRes.windows ?? [])
            setStaff(staffRes.staff ?? [])
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load accounts."
            toast.error(msg)
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void fetchAll()
    }, [fetchAll])

    /**
     * ✅ IMPORTANT FIX:
     * Your backend endpoint `GET /admin/staff` often returns STAFF accounts only.
     * If you only have an ADMIN account in the system, it won't show up.
     *
     * So we always show the current admin session as a fallback row if it isn't present in /admin/staff.
     */
    const rows: AccountRow[] = React.useMemo(() => {
        const fromStaff: AccountRow[] = (staff ?? []).map((u) => {
            const id = staffId(u) || u.email
            const role = (((u as unknown as { role?: AccountRole }).role ?? "STAFF") as AccountRole)
            return {
                id,
                name: u.name,
                email: u.email,
                role,
                active: !!u.active,
                assignedDepartment: u.assignedDepartment ?? null,
                assignedWindow: u.assignedWindow ?? null,
                source: "staff",
                raw: u,
            }
        })

        // Add current session admin as fallback row (only if it's not already included).
        if (sessionUser?.role === "ADMIN") {
            const sessionId = sessionUser.id
            const sessionEmail = sessionUser.email ?? ""
            const exists =
                fromStaff.some((r) => r.id === sessionId) ||
                (sessionEmail ? fromStaff.some((r) => r.email.toLowerCase() === sessionEmail.toLowerCase()) : false)

            if (!exists) {
                fromStaff.unshift({
                    id: sessionId,
                    name: sessionUser.name ?? "Admin",
                    email: sessionUser.email ?? "—",
                    role: "ADMIN",
                    active: true,
                    assignedDepartment: sessionUser.assignedDepartment ?? null,
                    assignedWindow: sessionUser.assignedWindow ?? null,
                    source: "session",
                })
            }
        }

        return fromStaff
    }, [staff, sessionUser])

    const filtered = React.useMemo(() => {
        const query = q.trim().toLowerCase()

        return rows
            .filter((u) => {
                if (tab === "active" && !u.active) return false
                if (tab === "inactive" && u.active) return false

                if (deptFilter !== "all") {
                    if ((u.assignedDepartment ?? "") !== deptFilter) return false
                }

                if (!query) return true
                const hay = `${u.name} ${u.email}`.toLowerCase()
                return hay.includes(query)
            })
            .sort((a, b) => (a.active === b.active ? a.name.localeCompare(b.name) : a.active ? -1 : 1))
    }, [rows, q, deptFilter, tab])

    function openEdit(row: AccountRow) {
        if (row.source !== "staff" || !row.raw) {
            toast.error("This account isn't returned by /admin/staff, so it can’t be edited here.")
            return
        }

        const u = row.raw
        setSelected(u)
        setEName(u.name ?? "")
        setEActive(!!u.active)

        const role = (((u as unknown as { role?: AccountRole }).role ?? "STAFF") as AccountRole)
        setERole(role)

        setEDepartmentId(u.assignedDepartment ?? "")
        setEWindowId(u.assignedWindow ?? "")
        setEditOpen(true)
    }

    function openReset(row: AccountRow) {
        if (row.source !== "staff" || !row.raw) {
            toast.error("This account isn't returned by /admin/staff, so it can’t be updated here.")
            return
        }
        setSelected(row.raw)
        setNewPassword("")
        setResetOpen(true)
    }

    function openDelete(row: AccountRow) {
        if (row.source !== "staff" || !row.raw) {
            toast.error("This account isn't returned by /admin/staff, so it can’t be deleted here.")
            return
        }
        setSelected(row.raw)
        setDeleteOpen(true)
    }

    function resetCreateForm() {
        setCName("")
        setCEmail("")
        setCPassword("")
        setCDepartmentId("")
        setCWindowId("")
        setCRole("STAFF")
    }

    async function handleCreate() {
        const name = cName.trim()
        const email = cEmail.trim()
        const password = cPassword

        if (!name) return toast.error("Name is required.")
        if (!email) return toast.error("Email is required.")
        if (!password) return toast.error("Password is required.")

        if (cRole === "STAFF") {
            if (!cDepartmentId) return toast.error("Department is required for STAFF.")
            if (!cWindowId) return toast.error("Window is required for STAFF.")
        }

        setSaving(true)
        try {
            await adminApi.createStaff({
                name,
                email,
                password,
                departmentId: cDepartmentId,
                windowId: cWindowId,
                role: cRole,
            } as any)

            toast.success("Account created.")
            setCreateOpen(false)
            resetCreateForm()
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to create account."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    async function handleSaveEdit() {
        if (!selected) return
        const id = staffId(selected)
        if (!id) return toast.error("Invalid user id.")

        const name = eName.trim()
        if (!name) return toast.error("Name is required.")

        const payload: Record<string, unknown> = {
            name,
            active: eActive,
            role: eRole,
        }

        if (eRole === "STAFF") {
            payload.departmentId = eDepartmentId || null
            payload.windowId = eWindowId || null
        } else {
            payload.departmentId = null
            payload.windowId = null
        }

        setSaving(true)
        try {
            await adminApi.updateStaff(id, payload as any)
            toast.success("Account updated.")
            setEditOpen(false)
            setSelected(null)
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to update account."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    async function handleResetPassword() {
        if (!selected) return
        const id = staffId(selected)
        if (!id) return toast.error("Invalid user id.")
        if (!newPassword) return toast.error("New password is required.")

        setSaving(true)
        try {
            await adminApi.updateStaff(id, { password: newPassword })
            toast.success("Password updated.")
            setResetOpen(false)
            setSelected(null)
            setNewPassword("")
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to update password."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    async function handleDeleteAccount() {
        if (!selected) return
        const id = staffId(selected)
        if (!id) return toast.error("Invalid user id.")

        setSaving(true)
        try {
            const apiAny = api as any

            if (typeof apiAny.delete === "function") {
                await apiAny.delete(`/admin/staff/${id}`)
                toast.success("Account deleted.")
            } else if (typeof apiAny.del === "function") {
                await apiAny.del(`/admin/staff/${id}`)
                toast.success("Account deleted.")
            } else {
                await adminApi.updateStaff(id, { active: false })
                toast.success("No DELETE client found — account deactivated instead.")
            }

            setDeleteOpen(false)
            setSelected(null)
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to delete account."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    const stats = React.useMemo(() => {
        const total = rows.length
        const active = rows.filter((s) => s.active).length
        const inactive = total - active
        return { total, active, inactive }
    }, [rows])

    const showAdminFallbackNote =
        !loading && staff.length === 0 && sessionUser?.role === "ADMIN"

    return (
        <DashboardLayout
            title="Accounts"
            navItems={ADMIN_NAV_ITEMS}
            user={dashboardUser}
            activePath={location.pathname}
        >
            <div className="grid gap-6">
                <Card>
                    <CardHeader className="gap-2">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <CardTitle>Account Management</CardTitle>
                                <CardDescription>
                                    Create users, update roles, reset passwords, assign departments/windows, and disable or delete accounts.
                                </CardDescription>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => void fetchAll()}
                                    disabled={loading || saving}
                                    className="gap-2"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Refresh
                                </Button>

                                <Button
                                    onClick={() => {
                                        resetCreateForm()
                                        setCreateOpen(true)
                                    }}
                                    className="gap-2"
                                    disabled={saving}
                                >
                                    <Plus className="h-4 w-4" />
                                    New user
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        {showAdminFallbackNote ? (
                            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                                You’re logged in as an <span className="font-medium">ADMIN</span>, but <code>/admin/staff</code> returned no rows.
                                This page is showing your current session as a fallback.
                                If you want ADMIN accounts to be listed/managed here, your backend should expose an endpoint that returns them.
                            </div>
                        ) : null}

                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <Input
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Search name or email…"
                                    className="w-full sm:w-80"
                                />

                                <Select value={deptFilter} onValueChange={setDeptFilter}>
                                    <SelectTrigger className="w-full sm:w-64">
                                        <SelectValue placeholder="Filter by department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All departments</SelectItem>
                                        {enabledDepartments.map((d) => (
                                            <SelectItem key={d._id} value={d._id}>
                                                {d.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="secondary">Total: {stats.total}</Badge>
                                <Badge variant="default">Active: {stats.active}</Badge>
                                <Badge variant="secondary">Inactive: {stats.inactive}</Badge>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                            <TabsList className="grid w-full grid-cols-3 md:w-90">
                                <TabsTrigger value="all">All</TabsTrigger>
                                <TabsTrigger value="active">Active</TabsTrigger>
                                <TabsTrigger value="inactive">Inactive</TabsTrigger>
                            </TabsList>

                            <TabsContent value={tab} className="mt-4">
                                {loading ? (
                                    <div className="space-y-3">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : (
                                    <div className="rounded-lg border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead className="hidden md:table-cell">Email</TableHead>
                                                    <TableHead>Role</TableHead>
                                                    <TableHead className="hidden lg:table-cell">Department</TableHead>
                                                    <TableHead className="hidden lg:table-cell">Window</TableHead>
                                                    <TableHead className="text-right">Status</TableHead>
                                                    <TableHead className="w-14" />
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {filtered.map((u) => {
                                                    const deptName =
                                                        u.assignedDepartment && deptById.get(u.assignedDepartment)
                                                            ? deptById.get(u.assignedDepartment)!.name
                                                            : "—"

                                                    const winName =
                                                        u.assignedWindow && winById.get(u.assignedWindow)
                                                            ? winById.get(u.assignedWindow)!.name
                                                            : "—"

                                                    return (
                                                        <TableRow key={u.id || u.email}>
                                                            <TableCell className="font-medium">
                                                                <div className="flex flex-col">
                                                                    <span className="truncate">
                                                                        {u.name}
                                                                        {u.source === "session" ? (
                                                                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                                                                                (current session)
                                                                            </span>
                                                                        ) : null}
                                                                    </span>
                                                                    <span className="truncate text-xs text-muted-foreground md:hidden">
                                                                        {u.email}
                                                                    </span>
                                                                </div>
                                                            </TableCell>

                                                            <TableCell className="hidden md:table-cell">
                                                                <span className="text-muted-foreground">{u.email}</span>
                                                            </TableCell>

                                                            <TableCell>{roleBadge(u.role)}</TableCell>

                                                            <TableCell className="hidden lg:table-cell">
                                                                <span className="text-muted-foreground">{deptName}</span>
                                                            </TableCell>

                                                            <TableCell className="hidden lg:table-cell">
                                                                <span className="text-muted-foreground">{winName}</span>
                                                            </TableCell>

                                                            <TableCell className="text-right">
                                                                <Badge variant={u.active ? "default" : "secondary"}>
                                                                    {u.active ? "Active" : "Inactive"}
                                                                </Badge>
                                                            </TableCell>

                                                            <TableCell className="text-right">
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" size="icon" aria-label="Row actions">
                                                                            <MoreHorizontal className="h-4 w-4" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>

                                                                    <DropdownMenuContent align="end" className="w-56">
                                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                        <DropdownMenuSeparator />

                                                                        <DropdownMenuItem
                                                                            disabled={u.source !== "staff"}
                                                                            onClick={() => openEdit(u)}
                                                                            className={u.source === "staff" ? "cursor-pointer" : undefined}
                                                                        >
                                                                            Edit account
                                                                        </DropdownMenuItem>

                                                                        <DropdownMenuItem
                                                                            disabled={u.source !== "staff"}
                                                                            onClick={() => openReset(u)}
                                                                            className={u.source === "staff" ? "cursor-pointer" : undefined}
                                                                        >
                                                                            Reset password
                                                                        </DropdownMenuItem>

                                                                        <DropdownMenuSeparator />

                                                                        <DropdownMenuItem
                                                                            disabled={u.source !== "staff"}
                                                                            onClick={() => openDelete(u)}
                                                                            className={
                                                                                u.source === "staff"
                                                                                    ? "cursor-pointer text-destructive focus:text-destructive"
                                                                                    : "text-muted-foreground"
                                                                            }
                                                                        >
                                                                            Delete account
                                                                        </DropdownMenuItem>

                                                                        {u.source !== "staff" ? (
                                                                            <>
                                                                                <DropdownMenuSeparator />
                                                                                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                                                                    This row is shown from the current session.
                                                                                    Admin accounts aren’t managed via <code>/admin/staff</code>.
                                                                                </div>
                                                                            </>
                                                                        ) : null}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}

                                                {filtered.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                                                            No accounts match your filters.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : null}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>

            {/* Create dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create new user</DialogTitle>
                        <DialogDescription>
                            Creates a new account. By default, this uses your current STAFF endpoints.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="c-name">Name</Label>
                            <Input
                                id="c-name"
                                value={cName}
                                onChange={(e) => setCName(e.target.value)}
                                placeholder="Full name"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="c-email">Email</Label>
                            <Input
                                id="c-email"
                                value={cEmail}
                                onChange={(e) => setCEmail(e.target.value)}
                                placeholder="name@school.edu"
                                type="email"
                                autoComplete="email"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="c-password">Temporary password</Label>
                            <Input
                                id="c-password"
                                value={cPassword}
                                onChange={(e) => setCPassword(e.target.value)}
                                placeholder="Set an initial password"
                                type="password"
                                autoComplete="new-password"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Role</Label>
                            <Select value={cRole} onValueChange={(v) => setCRole(v as AccountRole)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="STAFF">STAFF</SelectItem>
                                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>Department</Label>
                            <Select
                                value={cDepartmentId || "none"}
                                onValueChange={(v) => {
                                    const next = v === "none" ? "" : v
                                    setCDepartmentId(next)
                                    setCWindowId("")
                                }}
                                disabled={cRole === "ADMIN"}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Unassigned</SelectItem>
                                    {enabledDepartments.map((d) => (
                                        <SelectItem key={d._id} value={d._id}>
                                            {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>Window</Label>
                            <Select
                                value={cWindowId || "none"}
                                onValueChange={(v) => setCWindowId(v === "none" ? "" : v)}
                                disabled={cRole === "ADMIN" || !cDepartmentId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={cDepartmentId ? "Select window" : "Select department first"} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Unassigned</SelectItem>
                                    {cDepartmentId
                                        ? windowsForDept(cDepartmentId).map((w) => (
                                            <SelectItem key={w._id} value={w._id}>
                                                {w.name} (#{w.number})
                                            </SelectItem>
                                        ))
                                        : null}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setCreateOpen(false)
                                resetCreateForm()
                            }}
                            disabled={saving}
                        >
                            Cancel
                        </Button>

                        <Button type="button" onClick={() => void handleCreate()} disabled={saving}>
                            {saving ? "Creating…" : "Create user"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit account</DialogTitle>
                        <DialogDescription>
                            Update details, role, assignments, and status.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="e-name">Name</Label>
                            <Input id="e-name" value={eName} onChange={(e) => setEName(e.target.value)} />
                        </div>

                        <div className="grid gap-2">
                            <Label>Email</Label>
                            <Input value={selected?.email ?? ""} readOnly />
                        </div>

                        <div className="grid gap-2">
                            <Label>Role</Label>
                            <Select value={eRole} onValueChange={(v) => setERole(v as AccountRole)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="STAFF">STAFF</SelectItem>
                                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Role changes require backend support. This UI sends <code>role</code> best-effort on update.
                            </p>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="grid gap-0.5">
                                <div className="text-sm font-medium">Active</div>
                                <div className="text-xs text-muted-foreground">
                                    Disable to block login without deleting.
                                </div>
                            </div>
                            <Switch checked={eActive} onCheckedChange={setEActive} />
                        </div>

                        <div className="grid gap-2">
                            <Label>Department</Label>
                            <Select
                                value={eDepartmentId || "none"}
                                onValueChange={(v) => {
                                    const next = v === "none" ? "" : v
                                    setEDepartmentId(next)
                                    setEWindowId("")
                                }}
                                disabled={eRole === "ADMIN"}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Unassigned</SelectItem>
                                    {enabledDepartments.map((d) => (
                                        <SelectItem key={d._id} value={d._id}>
                                            {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>Window</Label>
                            <Select
                                value={eWindowId || "none"}
                                onValueChange={(v) => setEWindowId(v === "none" ? "" : v)}
                                disabled={eRole === "ADMIN" || !eDepartmentId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={eDepartmentId ? "Select window" : "Select department first"} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Unassigned</SelectItem>
                                    {eDepartmentId
                                        ? windowsForDept(eDepartmentId).map((w) => (
                                            <SelectItem key={w._id} value={w._id}>
                                                {w.name} (#{w.number})
                                            </SelectItem>
                                        ))
                                        : null}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setEditOpen(false)
                                setSelected(null)
                            }}
                            disabled={saving}
                        >
                            Cancel
                        </Button>

                        <Button type="button" onClick={() => void handleSaveEdit()} disabled={saving}>
                            {saving ? "Saving…" : "Save changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reset password dialog */}
            <Dialog open={resetOpen} onOpenChange={setResetOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Reset password</DialogTitle>
                        <DialogDescription>
                            Set a new password for <span className="font-medium">{selected?.email ?? "this account"}</span>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-2">
                        <Label htmlFor="new-password">New password</Label>
                        <Input
                            id="new-password"
                            type="password"
                            autoComplete="new-password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter a new password"
                        />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setResetOpen(false)
                                setSelected(null)
                                setNewPassword("")
                            }}
                            disabled={saving}
                        >
                            Cancel
                        </Button>

                        <Button type="button" onClick={() => void handleResetPassword()} disabled={saving}>
                            {saving ? "Updating…" : "Update password"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirm */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete account?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone if your backend supports hard delete.
                            If hard delete is not available, this page will deactivate the account instead.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel
                            disabled={saving}
                            onClick={() => {
                                setDeleteOpen(false)
                                setSelected(null)
                            }}
                        >
                            Cancel
                        </AlertDialogCancel>

                        <AlertDialogAction
                            disabled={saving}
                            onClick={(e) => {
                                e.preventDefault()
                                void handleDeleteAccount()
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {saving ? "Deleting…" : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DashboardLayout>
    )
}
