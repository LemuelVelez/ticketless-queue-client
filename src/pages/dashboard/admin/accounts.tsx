/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { MoreHorizontal, Plus, RefreshCw, Shield, UserCog } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ADMIN_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { adminApi, type Department, type ServiceWindow } from "@/api/admin"
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

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

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

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type AccountRole = "STAFF" | "ADMIN"

type AccountUser = {
    id?: string
    _id?: string
    name: string
    email: string
    role?: AccountRole
    active: boolean
    assignedDepartment: string | null
    assignedWindow: string | null
    assignedTransactionManager?: string | null
}

const DEFAULT_MANAGER = "REGISTRAR"

function userId(u: AccountUser) {
    return u._id ?? u.id ?? ""
}

function isEnabledFlag(value: boolean | undefined) {
    return value !== false
}

function normalizeManagerKey(value: unknown, fallback = DEFAULT_MANAGER) {
    const v = String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_")
    return v || fallback
}

function prettyManager(value?: string) {
    const v = String(value || "").trim()
    if (!v) return DEFAULT_MANAGER
    return v
        .toLowerCase()
        .split("_")
        .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
        .join(" ")
}

function roleBadge(role: AccountRole) {
    if (role === "ADMIN") {
        return (
            <Badge className="gap-1" variant="default">
                <Shield className="h-4 w-4" />
                ADMIN
            </Badge>
        )
    }
    return (
        <Badge variant="secondary" className="gap-1">
            <UserCog className="h-4 w-4" />
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
    const [users, setUsers] = React.useState<AccountUser[]>([])

    const [q, setQ] = React.useState("")
    const [deptFilter, setDeptFilter] = React.useState<string>("all")
    const [tab, setTab] = React.useState<"all" | "active" | "inactive">("all")

    // dialogs
    const [createOpen, setCreateOpen] = React.useState(false)
    const [editOpen, setEditOpen] = React.useState(false)
    const [resetOpen, setResetOpen] = React.useState(false)
    const [deleteOpen, setDeleteOpen] = React.useState(false)

    // selected user
    const [selected, setSelected] = React.useState<AccountUser | null>(null)

    // create form
    const [cName, setCName] = React.useState("")
    const [cEmail, setCEmail] = React.useState("")
    const [cPassword, setCPassword] = React.useState("")
    const [cDepartmentId, setCDepartmentId] = React.useState<string>("")
    const [cWindowId, setCWindowId] = React.useState<string>("")
    const [cRole, setCRole] = React.useState<AccountRole>("STAFF")
    const [cTransactionManager, setCTransactionManager] = React.useState<string>(DEFAULT_MANAGER)

    // edit form
    const [eName, setEName] = React.useState("")
    const [eRole, setERole] = React.useState<AccountRole>("STAFF")
    const [eActive, setEActive] = React.useState(true)
    const [eDepartmentId, setEDepartmentId] = React.useState<string>("")
    const [eWindowId, setEWindowId] = React.useState<string>("")
    const [eTransactionManager, setETransactionManager] = React.useState<string>(DEFAULT_MANAGER)

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

    const enabledDepartments = React.useMemo(() => departments.filter((d) => isEnabledFlag(d.enabled)), [departments])

    const managerOptions = React.useMemo(() => {
        const set = new Set<string>()

        for (const d of enabledDepartments) {
            set.add(normalizeManagerKey(d.transactionManager || DEFAULT_MANAGER, DEFAULT_MANAGER))
        }

        for (const u of users) {
            const m = String(u.assignedTransactionManager ?? "").trim()
            if (m) set.add(normalizeManagerKey(m, ""))
        }

        const createManager = normalizeManagerKey(cTransactionManager, "")
        const editManager = normalizeManagerKey(eTransactionManager, "")

        if (createManager) set.add(createManager)
        if (editManager) set.add(editManager)

        if (set.size === 0) set.add(DEFAULT_MANAGER)

        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }, [enabledDepartments, users, cTransactionManager, eTransactionManager])

    const enabledWindows = React.useMemo(() => windows.filter((w) => isEnabledFlag(w.enabled)), [windows])

    const windowsForDept = React.useCallback(
        (departmentId: string) => enabledWindows.filter((w) => w.department === departmentId),
        [enabledWindows],
    )

    const inferManagerFromDepartment = React.useCallback(
        (departmentId?: string | null) => {
            const id = String(departmentId ?? "").trim()
            if (!id) return DEFAULT_MANAGER
            const dept = deptById.get(id)
            return normalizeManagerKey(dept?.transactionManager || DEFAULT_MANAGER, DEFAULT_MANAGER)
        },
        [deptById],
    )

    const departmentsForManager = React.useCallback(
        (manager: string) => {
            const key = normalizeManagerKey(manager, DEFAULT_MANAGER)
            return enabledDepartments.filter(
                (d) => normalizeManagerKey(d.transactionManager || DEFAULT_MANAGER, DEFAULT_MANAGER) === key,
            )
        },
        [enabledDepartments],
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
            setUsers((staffRes.staff ?? []) as any)
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

    const rows = React.useMemo(() => {
        return (users ?? []).map((u) => {
            const role = (u.role ?? "STAFF") as AccountRole
            return { ...u, role }
        })
    }, [users])

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

    function openEdit(u: AccountUser & { role: AccountRole }) {
        setSelected(u)
        setEName(u.name ?? "")
        setEActive(!!u.active)

        setERole(u.role ?? "STAFF")
        setEDepartmentId(u.assignedDepartment ?? "")
        setEWindowId(u.assignedWindow ?? "")

        const manager = normalizeManagerKey(
            u.assignedTransactionManager || inferManagerFromDepartment(u.assignedDepartment) || DEFAULT_MANAGER,
            DEFAULT_MANAGER,
        )
        setETransactionManager(manager)

        setEditOpen(true)
    }

    function openReset(u: AccountUser) {
        setSelected(u)
        setNewPassword("")
        setResetOpen(true)
    }

    function openDelete(u: AccountUser) {
        setSelected(u)
        setDeleteOpen(true)
    }

    function resetCreateForm() {
        setCName("")
        setCEmail("")
        setCPassword("")
        setCDepartmentId("")
        setCWindowId("")
        setCRole("STAFF")
        setCTransactionManager(DEFAULT_MANAGER)
    }

    async function handleCreate() {
        const name = cName.trim()
        const email = cEmail.trim()
        const password = cPassword

        if (!name) return toast.error("Name is required.")
        if (!email) return toast.error("Email is required.")
        if (!password) return toast.error("Password is required.")

        const payload: any = {
            name,
            email,
            password,
            role: cRole,
        }

        if (cRole === "STAFF") {
            const manager = normalizeManagerKey(
                cTransactionManager || inferManagerFromDepartment(cDepartmentId) || DEFAULT_MANAGER,
                DEFAULT_MANAGER,
            )

            if (!cDepartmentId) return toast.error("Department is required for STAFF.")
            if (!cWindowId) return toast.error("Window is required for STAFF.")

            const dept = deptById.get(cDepartmentId)
            if (!dept) return toast.error("Selected department does not exist.")

            const deptManager = normalizeManagerKey(dept.transactionManager || DEFAULT_MANAGER, DEFAULT_MANAGER)
            if (deptManager !== manager) {
                return toast.error(
                    `Selected department belongs to ${prettyManager(deptManager)}. Please pick a matching manager.`,
                )
            }

            payload.departmentId = cDepartmentId
            payload.windowId = cWindowId
            payload.transactionManager = manager
        } else {
            payload.departmentId = null
            payload.windowId = null
            payload.transactionManager = null
        }

        setSaving(true)
        try {
            await adminApi.createStaff(payload)
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
        const id = userId(selected)
        if (!id) return toast.error("Invalid user id.")

        const name = eName.trim()
        if (!name) return toast.error("Name is required.")

        const payload: Record<string, unknown> = {
            name,
            active: eActive,
            role: eRole,
        }

        if (eRole === "STAFF") {
            const manager = normalizeManagerKey(
                eTransactionManager || inferManagerFromDepartment(eDepartmentId) || DEFAULT_MANAGER,
                DEFAULT_MANAGER,
            )

            if (eDepartmentId) {
                const dept = deptById.get(eDepartmentId)
                if (!dept) return toast.error("Selected department does not exist.")

                const deptManager = normalizeManagerKey(dept.transactionManager || DEFAULT_MANAGER, DEFAULT_MANAGER)
                if (deptManager !== manager) {
                    return toast.error(
                        `Selected department belongs to ${prettyManager(deptManager)}. Please pick a matching manager.`,
                    )
                }
            }

            payload.departmentId = eDepartmentId || null
            payload.windowId = eWindowId || null
            payload.transactionManager = manager
        } else {
            payload.departmentId = null
            payload.windowId = null
            payload.transactionManager = null
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
        const id = userId(selected)
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
        const id = userId(selected)
        if (!id) return toast.error("Invalid user id.")

        setSaving(true)
        try {
            const apiAny = api as any

            if (typeof apiAny.delete === "function") {
                await apiAny.delete(`/admin/staff/${id}`)
            } else if (typeof apiAny.del === "function") {
                await apiAny.del(`/admin/staff/${id}`)
            } else {
                await adminApi.updateStaff(id, { active: false })
            }

            toast.success("Account removed.")
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

    return (
        <DashboardLayout title="Accounts" navItems={ADMIN_NAV_ITEMS} user={dashboardUser} activePath={location.pathname}>
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                <Card className="min-w-0">
                    <CardHeader className="gap-2">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <CardTitle>Account Management</CardTitle>
                                <CardDescription>
                                    Create users, update roles, reset passwords, assign manager-aligned departments/windows,
                                    and disable or delete accounts.
                                </CardDescription>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                <Button
                                    variant="outline"
                                    onClick={() => void fetchAll()}
                                    disabled={loading || saving}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Refresh
                                </Button>

                                <Button
                                    onClick={() => {
                                        resetCreateForm()
                                        setCreateOpen(true)
                                    }}
                                    className="w-full gap-2 sm:w-auto"
                                    disabled={saving}
                                >
                                    <Plus className="h-4 w-4" />
                                    New user
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                                <Input
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Search name or email…"
                                    className="w-full min-w-0 sm:w-80"
                                />

                                <Select value={deptFilter} onValueChange={setDeptFilter}>
                                    <SelectTrigger className="w-full min-w-0 sm:w-64">
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

                    <CardContent className="min-w-0">
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
                                    <div className="rounded-lg border overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead className="hidden md:table-cell">Email</TableHead>
                                                    <TableHead>Role</TableHead>
                                                    <TableHead className="hidden xl:table-cell">Manager</TableHead>
                                                    <TableHead className="hidden lg:table-cell">Department</TableHead>
                                                    <TableHead className="hidden lg:table-cell">Window</TableHead>
                                                    <TableHead className="text-right">Status</TableHead>
                                                    <TableHead className="w-14" />
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {filtered.map((u) => {
                                                    const id = userId(u) || u.email
                                                    const role = (u.role ?? "STAFF") as AccountRole

                                                    const deptName =
                                                        u.assignedDepartment && deptById.get(u.assignedDepartment)
                                                            ? deptById.get(u.assignedDepartment)!.name
                                                            : "—"

                                                    const winName =
                                                        u.assignedWindow && winById.get(u.assignedWindow)
                                                            ? winById.get(u.assignedWindow)!.name
                                                            : "—"

                                                    const managerKey =
                                                        role === "STAFF"
                                                            ? normalizeManagerKey(
                                                                u.assignedTransactionManager ||
                                                                inferManagerFromDepartment(u.assignedDepartment) ||
                                                                DEFAULT_MANAGER,
                                                                DEFAULT_MANAGER,
                                                            )
                                                            : ""

                                                    return (
                                                        <TableRow key={id}>
                                                            <TableCell className="font-medium">
                                                                <div className="flex min-w-0 flex-col">
                                                                    <span className="truncate">{u.name}</span>
                                                                    <span className="truncate text-xs text-muted-foreground md:hidden">
                                                                        {u.email}
                                                                    </span>
                                                                    {role === "STAFF" ? (
                                                                        <span className="truncate text-xs text-muted-foreground xl:hidden">
                                                                            {prettyManager(managerKey)}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                            </TableCell>

                                                            <TableCell className="hidden md:table-cell">
                                                                <span className="text-muted-foreground">{u.email}</span>
                                                            </TableCell>

                                                            <TableCell>{roleBadge(role)}</TableCell>

                                                            <TableCell className="hidden xl:table-cell">
                                                                {role === "STAFF" ? (
                                                                    <Badge variant="outline">{prettyManager(managerKey)}</Badge>
                                                                ) : (
                                                                    <span className="text-muted-foreground">—</span>
                                                                )}
                                                            </TableCell>

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
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            aria-label="Row actions"
                                                                        >
                                                                            <MoreHorizontal className="h-4 w-4" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>

                                                                    <DropdownMenuContent align="end" className="w-52">
                                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                        <DropdownMenuSeparator />

                                                                        <DropdownMenuItem
                                                                            onClick={() => openEdit({ ...(u as any), role } as any)}
                                                                            className="cursor-pointer"
                                                                        >
                                                                            Edit account
                                                                        </DropdownMenuItem>

                                                                        <DropdownMenuItem
                                                                            onClick={() => openReset(u)}
                                                                            className="cursor-pointer"
                                                                        >
                                                                            Reset password
                                                                        </DropdownMenuItem>

                                                                        <DropdownMenuSeparator />

                                                                        <DropdownMenuItem
                                                                            onClick={() => openDelete(u)}
                                                                            className="cursor-pointer text-destructive focus:text-destructive"
                                                                        >
                                                                            Delete account
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}

                                                {filtered.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
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
                <DialogContent className="sm:max-w-lg flex max-h-[85vh] flex-col overflow-hidden sm:max-h-none sm:overflow-visible">
                    <DialogHeader>
                        <DialogTitle>Create new user</DialogTitle>
                    </DialogHeader>

                    <div className="grid flex-1 gap-4 overflow-y-auto pr-1 sm:overflow-visible sm:pr-0">
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
                            <Select
                                value={cRole}
                                onValueChange={(v) => {
                                    const next = v as AccountRole
                                    setCRole(next)
                                    if (next === "ADMIN") {
                                        setCDepartmentId("")
                                        setCWindowId("")
                                    } else if (!cTransactionManager) {
                                        setCTransactionManager(DEFAULT_MANAGER)
                                    }
                                }}
                            >
                                <SelectTrigger className="w-full min-w-0">
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="STAFF">STAFF</SelectItem>
                                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="c-transaction-manager">Transaction manager</Label>
                            <Input
                                id="c-transaction-manager"
                                list="c-transaction-manager-options"
                                value={cTransactionManager}
                                onChange={(e) => {
                                    const nextManager = normalizeManagerKey(e.target.value, "")
                                    setCTransactionManager(nextManager)

                                    if (cDepartmentId) {
                                        const dept = deptById.get(cDepartmentId)
                                        const deptManager = normalizeManagerKey(dept?.transactionManager || DEFAULT_MANAGER, DEFAULT_MANAGER)
                                        if (!nextManager || deptManager !== nextManager) {
                                            setCDepartmentId("")
                                            setCWindowId("")
                                        }
                                    }
                                }}
                                onBlur={() => {
                                    if (!String(cTransactionManager || "").trim()) {
                                        setCTransactionManager(DEFAULT_MANAGER)
                                    }
                                }}
                                placeholder="e.g., REGISTRAR"
                                disabled={cRole === "ADMIN"}
                            />
                            <datalist id="c-transaction-manager-options">
                                {managerOptions.map((m) => (
                                    <option key={`c-manager-opt-${m}`} value={m}>
                                        {prettyManager(m)}
                                    </option>
                                ))}
                            </datalist>

                            <div className="flex flex-wrap gap-2">
                                {managerOptions.slice(0, 6).map((m) => (
                                    <Button
                                        key={`c-manager-chip-${m}`}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={cRole === "ADMIN"}
                                        onClick={() => {
                                            setCTransactionManager(m)

                                            if (cDepartmentId) {
                                                const dept = deptById.get(cDepartmentId)
                                                const deptManager = normalizeManagerKey(dept?.transactionManager || DEFAULT_MANAGER, DEFAULT_MANAGER)
                                                if (deptManager !== m) {
                                                    setCDepartmentId("")
                                                    setCWindowId("")
                                                }
                                            }
                                        }}
                                    >
                                        {prettyManager(m)}
                                    </Button>
                                ))}
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Type any manager key. Departments are limited to the selected manager.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label>Department</Label>
                            <Select
                                value={cDepartmentId || "none"}
                                onValueChange={(v) => {
                                    const next = v === "none" ? "" : v
                                    setCDepartmentId(next)
                                    setCWindowId("")

                                    if (next) {
                                        const dept = deptById.get(next)
                                        const deptManager = normalizeManagerKey(dept?.transactionManager || DEFAULT_MANAGER, DEFAULT_MANAGER)
                                        setCTransactionManager(deptManager)
                                    }
                                }}
                                disabled={cRole === "ADMIN"}
                            >
                                <SelectTrigger className="w-full min-w-0">
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Unassigned</SelectItem>
                                    {departmentsForManager(cTransactionManager || DEFAULT_MANAGER).map((d) => (
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
                                <SelectTrigger className="w-full min-w-0">
                                    <SelectValue
                                        placeholder={cDepartmentId ? "Select window" : "Select department first"}
                                    />
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

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setCreateOpen(false)
                                resetCreateForm()
                            }}
                            disabled={saving}
                            className="w-full sm:w-auto sm:mr-2"
                        >
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            onClick={() => void handleCreate()}
                            disabled={saving}
                            className="w-full sm:w-auto"
                        >
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
                            <Select
                                value={eRole}
                                onValueChange={(v) => {
                                    const next = v as AccountRole
                                    setERole(next)
                                    if (next === "ADMIN") {
                                        setEDepartmentId("")
                                        setEWindowId("")
                                    } else if (!eTransactionManager) {
                                        setETransactionManager(DEFAULT_MANAGER)
                                    }
                                }}
                            >
                                <SelectTrigger className="w-full min-w-0">
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="STAFF">STAFF</SelectItem>
                                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="grid gap-0.5">
                                <div className="text-sm font-medium">Active</div>
                                <div className="text-xs text-muted-foreground">Disable to block login without deleting.</div>
                            </div>
                            <Switch checked={eActive} onCheckedChange={setEActive} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="e-transaction-manager">Transaction manager</Label>
                            <Input
                                id="e-transaction-manager"
                                list="e-transaction-manager-options"
                                value={eTransactionManager}
                                onChange={(e) => {
                                    const nextManager = normalizeManagerKey(e.target.value, "")
                                    setETransactionManager(nextManager)

                                    if (eDepartmentId) {
                                        const dept = deptById.get(eDepartmentId)
                                        const deptManager = normalizeManagerKey(dept?.transactionManager || DEFAULT_MANAGER, DEFAULT_MANAGER)
                                        if (!nextManager || deptManager !== nextManager) {
                                            setEDepartmentId("")
                                            setEWindowId("")
                                        }
                                    }
                                }}
                                onBlur={() => {
                                    if (!String(eTransactionManager || "").trim()) {
                                        setETransactionManager(DEFAULT_MANAGER)
                                    }
                                }}
                                placeholder="e.g., REGISTRAR"
                                disabled={eRole === "ADMIN"}
                            />
                            <datalist id="e-transaction-manager-options">
                                {managerOptions.map((m) => (
                                    <option key={`e-manager-opt-${m}`} value={m}>
                                        {prettyManager(m)}
                                    </option>
                                ))}
                            </datalist>

                            <div className="flex flex-wrap gap-2">
                                {managerOptions.slice(0, 6).map((m) => (
                                    <Button
                                        key={`e-manager-chip-${m}`}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={eRole === "ADMIN"}
                                        onClick={() => {
                                            setETransactionManager(m)

                                            if (eDepartmentId) {
                                                const dept = deptById.get(eDepartmentId)
                                                const deptManager = normalizeManagerKey(dept?.transactionManager || DEFAULT_MANAGER, DEFAULT_MANAGER)
                                                if (deptManager !== m) {
                                                    setEDepartmentId("")
                                                    setEWindowId("")
                                                }
                                            }
                                        }}
                                    >
                                        {prettyManager(m)}
                                    </Button>
                                ))}
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Type any manager key. Departments are limited to the selected manager.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label>Department</Label>
                            <Select
                                value={eDepartmentId || "none"}
                                onValueChange={(v) => {
                                    const next = v === "none" ? "" : v
                                    setEDepartmentId(next)
                                    setEWindowId("")

                                    if (next) {
                                        const dept = deptById.get(next)
                                        const deptManager = normalizeManagerKey(dept?.transactionManager || DEFAULT_MANAGER, DEFAULT_MANAGER)
                                        setETransactionManager(deptManager)
                                    }
                                }}
                                disabled={eRole === "ADMIN"}
                            >
                                <SelectTrigger className="w-full min-w-0">
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Unassigned</SelectItem>
                                    {departmentsForManager(eTransactionManager || DEFAULT_MANAGER).map((d) => (
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
                                <SelectTrigger className="w-full min-w-0">
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

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setEditOpen(false)
                                setSelected(null)
                            }}
                            disabled={saving}
                            className="w-full sm:w-auto sm:mr-2"
                        >
                            Cancel
                        </Button>

                        <Button type="button" onClick={() => void handleSaveEdit()} disabled={saving} className="w-full sm:w-auto">
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

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setResetOpen(false)
                                setSelected(null)
                                setNewPassword("")
                            }}
                            disabled={saving}
                            className="w-full sm:w-auto sm:mr-2"
                        >
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            onClick={() => void handleResetPassword()}
                            disabled={saving}
                            className="w-full sm:w-auto"
                        >
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
                            This will remove the user (or disable them if your client can’t send DELETE).
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
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            {saving ? "Deleting…" : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DashboardLayout>
    )
}
