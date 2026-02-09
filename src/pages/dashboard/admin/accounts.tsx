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
    DropdownMenuCheckboxItem,
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
    assignedDepartments?: string[]
    assignedWindow: string | null
    assignedTransactionManager?: string | null
}

type AccountRow = AccountUser & {
    role: AccountRole
    assignedDepartment: string | null
    assignedDepartments: string[]
}

type TakenDepartment = {
    userId: string
    name: string | null
    email: string | null
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

function uniqueStringIds(values: Array<string | null | undefined>) {
    const seen = new Set<string>()
    const out: string[] = []

    for (const raw of values) {
        const s = String(raw ?? "").trim()
        if (!s || seen.has(s)) continue
        seen.add(s)
        out.push(s)
    }

    return out
}

function extractUserDepartmentIds(user: Partial<AccountUser>) {
    return uniqueStringIds([...(user.assignedDepartments ?? []), user.assignedDepartment ?? ""])
}

function extractWindowDepartmentIds(windowDoc?: ServiceWindow | null) {
    if (!windowDoc) return []
    return uniqueStringIds([...(windowDoc.departmentIds ?? []), windowDoc.department])
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
    const [cDepartmentIds, setCDepartmentIds] = React.useState<string[]>([])
    const [cWindowId, setCWindowId] = React.useState<string>("")
    const [cRole, setCRole] = React.useState<AccountRole>("STAFF")
    const [cTransactionManager, setCTransactionManager] = React.useState<string>(DEFAULT_MANAGER)

    // edit form
    const [eName, setEName] = React.useState("")
    const [eRole, setERole] = React.useState<AccountRole>("STAFF")
    const [eActive, setEActive] = React.useState(true)
    const [eDepartmentIds, setEDepartmentIds] = React.useState<string[]>([])
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

    const enabledWindows = React.useMemo(() => windows.filter((w) => isEnabledFlag(w.enabled)), [windows])

    const inferManagerFromDepartment = React.useCallback(
        (departmentId?: string | null) => {
            const id = String(departmentId ?? "").trim()
            if (!id) return DEFAULT_MANAGER
            const dept = deptById.get(id)
            return normalizeManagerKey(dept?.transactionManager || DEFAULT_MANAGER, DEFAULT_MANAGER)
        },
        [deptById],
    )

    const inferManagerFromDepartments = React.useCallback(
        (departmentIds: string[]) => {
            const ids = uniqueStringIds(departmentIds ?? [])
            if (ids.length === 0) return DEFAULT_MANAGER
            return inferManagerFromDepartment(ids[0])
        },
        [inferManagerFromDepartment],
    )

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

    const departmentsForManager = React.useCallback(
        (manager: string) => {
            const key = normalizeManagerKey(manager, DEFAULT_MANAGER)
            return enabledDepartments
                .filter((d) => normalizeManagerKey(d.transactionManager || DEFAULT_MANAGER, DEFAULT_MANAGER) === key)
                .sort((a, b) => a.name.localeCompare(b.name))
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

    const rows = React.useMemo<AccountRow[]>(() => {
        return (users ?? []).map((u) => {
            const role = (u.role ?? "STAFF") as AccountRole
            const assignedDepartments = extractUserDepartmentIds(u)
            const assignedDepartment = u.assignedDepartment ? String(u.assignedDepartment) : assignedDepartments[0] ?? null
            return {
                ...u,
                role,
                assignedDepartment,
                assignedDepartments,
            }
        })
    }, [users])

    const takenDepartmentById = React.useMemo(() => {
        const map = new Map<string, TakenDepartment>()

        for (const u of rows) {
            if (u.role !== "STAFF") continue
            const uid = userId(u)
            if (!uid) continue

            for (const depId of u.assignedDepartments) {
                if (!depId || map.has(depId)) continue
                map.set(depId, {
                    userId: uid,
                    name: u.name ?? null,
                    email: u.email ?? null,
                })
            }
        }

        return map
    }, [rows])

    const isDepartmentTakenByOther = React.useCallback(
        (departmentId: string, currentUserId?: string | null) => {
            const taken = takenDepartmentById.get(departmentId)
            if (!taken) return false
            if (currentUserId && taken.userId === currentUserId) return false
            return true
        },
        [takenDepartmentById],
    )

    const getWindowManager = React.useCallback(
        (w: ServiceWindow) => {
            const depIds = extractWindowDepartmentIds(w)
            if (depIds.length === 0) return null

            const managers = new Set<string>()
            for (const depId of depIds) {
                const dep = deptById.get(depId)
                const manager = normalizeManagerKey(dep?.transactionManager || "", "")
                if (!manager) return null
                managers.add(manager)
            }

            if (managers.size !== 1) return null
            return Array.from(managers)[0]
        },
        [deptById],
    )

    const windowsForManager = React.useCallback(
        (manager: string, currentUserId?: string | null) => {
            const managerKey = normalizeManagerKey(manager, DEFAULT_MANAGER)

            return enabledWindows
                .filter((w) => {
                    const depIds = extractWindowDepartmentIds(w)
                    if (depIds.length === 0) return false

                    const winManager = getWindowManager(w)
                    if (!winManager || winManager !== managerKey) return false

                    for (const depId of depIds) {
                        if (isDepartmentTakenByOther(depId, currentUserId)) return false
                    }

                    return true
                })
                .sort((a, b) => a.number - b.number || a.name.localeCompare(b.name))
        },
        [enabledWindows, getWindowManager, isDepartmentTakenByOther],
    )

    const windowLabel = React.useCallback(
        (w: ServiceWindow) => {
            const depIds = extractWindowDepartmentIds(w)
            const depNames = depIds
                .map((id) => deptById.get(id)?.name)
                .filter((v): v is string => Boolean(v))
            const suffix = depNames.length > 0 ? ` • ${depNames.join(", ")}` : ""
            return `${w.name} (#${w.number})${suffix}`
        },
        [deptById],
    )

    const filtered = React.useMemo(() => {
        const query = q.trim().toLowerCase()

        return rows
            .filter((u) => {
                if (tab === "active" && !u.active) return false
                if (tab === "inactive" && u.active) return false

                if (deptFilter !== "all") {
                    const ids = u.assignedDepartments ?? []
                    if (!ids.includes(deptFilter)) return false
                }

                if (!query) return true
                const hay = `${u.name} ${u.email}`.toLowerCase()
                return hay.includes(query)
            })
            .sort((a, b) => (a.active === b.active ? a.name.localeCompare(b.name) : a.active ? -1 : 1))
    }, [rows, q, deptFilter, tab])

    const createDepartmentOptions = React.useMemo(
        () => departmentsForManager(cTransactionManager || DEFAULT_MANAGER),
        [departmentsForManager, cTransactionManager],
    )

    const selectedEditUserId = selected ? userId(selected) : ""

    const editDepartmentOptions = React.useMemo(
        () => departmentsForManager(eTransactionManager || DEFAULT_MANAGER),
        [departmentsForManager, eTransactionManager],
    )

    const createWindowOptions = React.useMemo(
        () => windowsForManager(cTransactionManager || DEFAULT_MANAGER, null),
        [windowsForManager, cTransactionManager],
    )

    const editWindowOptions = React.useMemo(
        () => windowsForManager(eTransactionManager || DEFAULT_MANAGER, selectedEditUserId || null),
        [windowsForManager, eTransactionManager, selectedEditUserId],
    )

    function openEdit(u: AccountRow) {
        setSelected(u)
        setEName(u.name ?? "")
        setEActive(!!u.active)
        setERole(u.role ?? "STAFF")

        const nextDepartmentIds = extractUserDepartmentIds(u)
        setEDepartmentIds(nextDepartmentIds)
        setEWindowId(u.assignedWindow ?? "")

        const manager = normalizeManagerKey(
            u.assignedTransactionManager || inferManagerFromDepartments(nextDepartmentIds) || DEFAULT_MANAGER,
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
        setCDepartmentIds([])
        setCWindowId("")
        setCRole("STAFF")
        setCTransactionManager(DEFAULT_MANAGER)
    }

    function toggleCreateDepartment(depId: string, checked: boolean) {
        if (isDepartmentTakenByOther(depId, null)) return

        setCDepartmentIds((prev) => {
            const next = checked ? uniqueStringIds([...prev, depId]) : prev.filter((x) => x !== depId)
            return next
        })
    }

    function toggleEditDepartment(depId: string, checked: boolean) {
        const sid = selected ? userId(selected) : ""
        if (isDepartmentTakenByOther(depId, sid || null)) return

        setEDepartmentIds((prev) => {
            const next = checked ? uniqueStringIds([...prev, depId]) : prev.filter((x) => x !== depId)
            return next
        })
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
                cTransactionManager || inferManagerFromDepartments(cDepartmentIds) || DEFAULT_MANAGER,
                DEFAULT_MANAGER,
            )

            if (!cWindowId) return toast.error("Window is required for STAFF.")
            if (cDepartmentIds.length === 0) return toast.error("Select at least one department for STAFF.")

            const finalDepartmentIds = uniqueStringIds(cDepartmentIds)

            for (const depId of finalDepartmentIds) {
                const dept = deptById.get(depId)
                if (!dept) return toast.error("A selected department does not exist.")

                const deptManager = normalizeManagerKey(dept.transactionManager || DEFAULT_MANAGER, DEFAULT_MANAGER)
                if (deptManager !== manager) {
                    return toast.error(
                        `All selected departments must belong to ${prettyManager(manager)}.`,
                    )
                }

                if (isDepartmentTakenByOther(depId, null)) {
                    const taken = takenDepartmentById.get(depId)
                    const deptName = dept.name || "department"
                    const holder = taken?.name || taken?.email || "another staff"
                    return toast.error(`${deptName} is already assigned to ${holder}.`)
                }
            }

            const selectedWindow = winById.get(cWindowId)
            if (!selectedWindow) return toast.error("Selected window does not exist.")

            const windowDepartmentIds = extractWindowDepartmentIds(selectedWindow)
            for (const depId of windowDepartmentIds) {
                if (isDepartmentTakenByOther(depId, null)) {
                    const depName = deptById.get(depId)?.name || "A window department"
                    const taken = takenDepartmentById.get(depId)
                    const holder = taken?.name || taken?.email || "another staff"
                    return toast.error(`${depName} (from selected window) is already assigned to ${holder}.`)
                }
            }

            payload.departmentIds = uniqueStringIds([...finalDepartmentIds, ...windowDepartmentIds])
            payload.windowId = cWindowId
            payload.transactionManager = manager
        } else {
            payload.departmentId = null
            payload.departmentIds = null
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
            if (eDepartmentIds.length === 0) return toast.error("Select at least one department for STAFF.")

            const manager = normalizeManagerKey(
                eTransactionManager || inferManagerFromDepartments(eDepartmentIds) || DEFAULT_MANAGER,
                DEFAULT_MANAGER,
            )

            let finalDepartmentIds = uniqueStringIds(eDepartmentIds)

            for (const depId of finalDepartmentIds) {
                const dept = deptById.get(depId)
                if (!dept) return toast.error("A selected department does not exist.")

                const deptManager = normalizeManagerKey(dept.transactionManager || DEFAULT_MANAGER, DEFAULT_MANAGER)
                if (deptManager !== manager) {
                    return toast.error(
                        `All selected departments must belong to ${prettyManager(manager)}.`,
                    )
                }

                if (isDepartmentTakenByOther(depId, id)) {
                    const taken = takenDepartmentById.get(depId)
                    const deptName = dept.name || "department"
                    const holder = taken?.name || taken?.email || "another staff"
                    return toast.error(`${deptName} is already assigned to ${holder}.`)
                }
            }

            if (eWindowId) {
                const selectedWindow = winById.get(eWindowId)
                if (!selectedWindow) return toast.error("Selected window does not exist.")

                const winManager = getWindowManager(selectedWindow)
                if (!winManager || winManager !== manager) {
                    return toast.error(`Selected window does not belong to ${prettyManager(manager)}.`)
                }

                const winDeps = extractWindowDepartmentIds(selectedWindow)

                for (const depId of winDeps) {
                    if (isDepartmentTakenByOther(depId, id)) {
                        const depName = deptById.get(depId)?.name || "A window department"
                        const taken = takenDepartmentById.get(depId)
                        const holder = taken?.name || taken?.email || "another staff"
                        return toast.error(`${depName} (from selected window) is already assigned to ${holder}.`)
                    }
                }

                finalDepartmentIds = uniqueStringIds([...finalDepartmentIds, ...winDeps])
            }

            payload.departmentIds = finalDepartmentIds
            payload.windowId = eWindowId || null
            payload.transactionManager = manager
        } else {
            payload.departmentId = null
            payload.departmentIds = null
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
                                    Create users, update roles, reset passwords, assign one transaction manager with
                                    multiple departments per staff, and prevent department reuse across staff.
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
                                        {departments
                                            .slice()
                                            .sort((a, b) => a.name.localeCompare(b.name))
                                            .map((d) => (
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
                                    <div className="overflow-x-auto rounded-lg border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead className="hidden md:table-cell">Email</TableHead>
                                                    <TableHead>Role</TableHead>
                                                    <TableHead className="hidden xl:table-cell">Manager</TableHead>
                                                    <TableHead className="hidden lg:table-cell">Departments</TableHead>
                                                    <TableHead className="hidden lg:table-cell">Window</TableHead>
                                                    <TableHead className="text-right">Status</TableHead>
                                                    <TableHead className="w-14" />
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {filtered.map((u) => {
                                                    const id = userId(u) || u.email
                                                    const role = (u.role ?? "STAFF") as AccountRole

                                                    const departmentNames =
                                                        u.assignedDepartments.length > 0
                                                            ? u.assignedDepartments
                                                                .map((depId) => deptById.get(depId)?.name)
                                                                .filter((v): v is string => Boolean(v))
                                                            : []

                                                    const winName =
                                                        u.assignedWindow && winById.get(u.assignedWindow)
                                                            ? winById.get(u.assignedWindow)!.name
                                                            : "—"

                                                    const managerKey =
                                                        role === "STAFF"
                                                            ? normalizeManagerKey(
                                                                u.assignedTransactionManager ||
                                                                inferManagerFromDepartments(u.assignedDepartments) ||
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
                                                                {departmentNames.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {departmentNames.slice(0, 2).map((name) => (
                                                                            <Badge key={`${id}-${name}`} variant="secondary">
                                                                                {name}
                                                                            </Badge>
                                                                        ))}
                                                                        {departmentNames.length > 2 ? (
                                                                            <Badge variant="outline">
                                                                                +{departmentNames.length - 2} more
                                                                            </Badge>
                                                                        ) : null}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-muted-foreground">—</span>
                                                                )}
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

                                                                    <DropdownMenuContent align="end" className="w-52">
                                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                        <DropdownMenuSeparator />

                                                                        <DropdownMenuItem
                                                                            onClick={() => openEdit(u)}
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
                                        setCDepartmentIds([])
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
                            <Label>Transaction manager</Label>
                            <Select
                                value={normalizeManagerKey(cTransactionManager, DEFAULT_MANAGER)}
                                onValueChange={(v) => {
                                    const next = normalizeManagerKey(v, DEFAULT_MANAGER)
                                    setCTransactionManager(next)
                                    setCDepartmentIds([])
                                    setCWindowId("")
                                }}
                                disabled={cRole === "ADMIN"}
                            >
                                <SelectTrigger className="w-full min-w-0">
                                    <SelectValue placeholder="Select manager" />
                                </SelectTrigger>
                                <SelectContent>
                                    {managerOptions.map((m) => (
                                        <SelectItem key={`c-manager-${m}`} value={m}>
                                            {prettyManager(m)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                STAFF must have one manager. Departments and windows are limited to that manager.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label>Departments</Label>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full justify-between"
                                        disabled={cRole === "ADMIN"}
                                    >
                                        <span className="truncate">
                                            {cDepartmentIds.length > 0
                                                ? `${cDepartmentIds.length} selected`
                                                : "Select departments"}
                                        </span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="max-h-72 w-md overflow-y-auto">
                                    {createDepartmentOptions.length === 0 ? (
                                        <DropdownMenuItem disabled>No available departments for this manager.</DropdownMenuItem>
                                    ) : (
                                        createDepartmentOptions.map((d) => {
                                            const taken = isDepartmentTakenByOther(d._id, null)
                                            const holder = takenDepartmentById.get(d._id)
                                            const checked = cDepartmentIds.includes(d._id)

                                            return (
                                                <DropdownMenuCheckboxItem
                                                    key={`c-dept-${d._id}`}
                                                    checked={checked}
                                                    disabled={taken}
                                                    onSelect={(e) => e.preventDefault()}
                                                    onCheckedChange={(v) => toggleCreateDepartment(d._id, v === true)}
                                                >
                                                    <div className="flex min-w-0 flex-col">
                                                        <span className="truncate">{d.name}</span>
                                                        {taken ? (
                                                            <span className="truncate text-xs text-muted-foreground">
                                                                Taken by {holder?.name || holder?.email || "another staff"}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </DropdownMenuCheckboxItem>
                                            )
                                        })
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {cDepartmentIds.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                    {cDepartmentIds.map((depId) => {
                                        const dep = deptById.get(depId)
                                        return (
                                            <Badge key={`c-selected-${depId}`} variant="secondary">
                                                {dep?.name || depId}
                                            </Badge>
                                        )
                                    })}
                                </div>
                            ) : null}
                        </div>

                        <div className="grid gap-2">
                            <Label>Window</Label>
                            <Select
                                value={cWindowId || "none"}
                                onValueChange={(v) => {
                                    const next = v === "none" ? "" : v
                                    setCWindowId(next)

                                    if (!next) return
                                    const selectedWindow = winById.get(next)
                                    if (!selectedWindow) return

                                    const winDeptIds = extractWindowDepartmentIds(selectedWindow)

                                    const blocked = winDeptIds.find((depId) => isDepartmentTakenByOther(depId, null))
                                    if (blocked) {
                                        const holder = takenDepartmentById.get(blocked)
                                        const depName = deptById.get(blocked)?.name || "A window department"
                                        toast.error(
                                            `${depName} is already assigned to ${holder?.name || holder?.email || "another staff"}.`,
                                        )
                                        setCWindowId("")
                                        return
                                    }

                                    setCDepartmentIds((prev) => uniqueStringIds([...prev, ...winDeptIds]))
                                }}
                                disabled={cRole === "ADMIN"}
                            >
                                <SelectTrigger className="w-full min-w-0">
                                    <SelectValue placeholder="Select window" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Unassigned</SelectItem>
                                    {createWindowOptions.map((w) => (
                                        <SelectItem key={w._id} value={w._id}>
                                            {windowLabel(w)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Selecting a window automatically includes its departments.
                            </p>
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
                                        setEDepartmentIds([])
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
                            <Label>Transaction manager</Label>
                            <Select
                                value={normalizeManagerKey(eTransactionManager, DEFAULT_MANAGER)}
                                onValueChange={(v) => {
                                    const next = normalizeManagerKey(v, DEFAULT_MANAGER)
                                    setETransactionManager(next)
                                    setEDepartmentIds([])
                                    setEWindowId("")
                                }}
                                disabled={eRole === "ADMIN"}
                            >
                                <SelectTrigger className="w-full min-w-0">
                                    <SelectValue placeholder="Select manager" />
                                </SelectTrigger>
                                <SelectContent>
                                    {managerOptions.map((m) => (
                                        <SelectItem key={`e-manager-${m}`} value={m}>
                                            {prettyManager(m)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                STAFF must keep one manager. All assigned departments must match it.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label>Departments</Label>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full justify-between"
                                        disabled={eRole === "ADMIN"}
                                    >
                                        <span className="truncate">
                                            {eDepartmentIds.length > 0
                                                ? `${eDepartmentIds.length} selected`
                                                : "Select departments"}
                                        </span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="max-h-72 w-md overflow-y-auto">
                                    {editDepartmentOptions.length === 0 ? (
                                        <DropdownMenuItem disabled>No available departments for this manager.</DropdownMenuItem>
                                    ) : (
                                        editDepartmentOptions.map((d) => {
                                            const sid = selected ? userId(selected) : ""
                                            const taken = isDepartmentTakenByOther(d._id, sid || null)
                                            const holder = takenDepartmentById.get(d._id)
                                            const checked = eDepartmentIds.includes(d._id)

                                            return (
                                                <DropdownMenuCheckboxItem
                                                    key={`e-dept-${d._id}`}
                                                    checked={checked}
                                                    disabled={taken}
                                                    onSelect={(e) => e.preventDefault()}
                                                    onCheckedChange={(v) => toggleEditDepartment(d._id, v === true)}
                                                >
                                                    <div className="flex min-w-0 flex-col">
                                                        <span className="truncate">{d.name}</span>
                                                        {taken ? (
                                                            <span className="truncate text-xs text-muted-foreground">
                                                                Taken by {holder?.name || holder?.email || "another staff"}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </DropdownMenuCheckboxItem>
                                            )
                                        })
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {eDepartmentIds.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                    {eDepartmentIds.map((depId) => {
                                        const dep = deptById.get(depId)
                                        return (
                                            <Badge key={`e-selected-${depId}`} variant="secondary">
                                                {dep?.name || depId}
                                            </Badge>
                                        )
                                    })}
                                </div>
                            ) : null}
                        </div>

                        <div className="grid gap-2">
                            <Label>Window</Label>
                            <Select
                                value={eWindowId || "none"}
                                onValueChange={(v) => {
                                    const next = v === "none" ? "" : v
                                    setEWindowId(next)

                                    if (!next) return
                                    const selectedWindow = winById.get(next)
                                    if (!selectedWindow) return

                                    const sid = selected ? userId(selected) : ""
                                    const winDeps = extractWindowDepartmentIds(selectedWindow)

                                    const blocked = winDeps.find((depId) => isDepartmentTakenByOther(depId, sid || null))
                                    if (blocked) {
                                        const holder = takenDepartmentById.get(blocked)
                                        const depName = deptById.get(blocked)?.name || "A window department"
                                        toast.error(
                                            `${depName} is already assigned to ${holder?.name || holder?.email || "another staff"}.`,
                                        )
                                        setEWindowId("")
                                        return
                                    }

                                    setEDepartmentIds((prev) => uniqueStringIds([...prev, ...winDeps]))
                                }}
                                disabled={eRole === "ADMIN"}
                            >
                                <SelectTrigger className="w-full min-w-0">
                                    <SelectValue placeholder="Select window" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Unassigned</SelectItem>
                                    {editWindowOptions.map((w) => (
                                        <SelectItem key={w._id} value={w._id}>
                                            {windowLabel(w)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Selecting a window automatically includes its departments.
                            </p>
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
