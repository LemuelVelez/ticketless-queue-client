/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { MoreHorizontal, Plus, RefreshCw, LayoutGrid, Building2, UserPlus2, UserMinus } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ADMIN_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { adminApi, type Department, type ServiceWindow, type StaffUser } from "@/api/admin"
import { useSession } from "@/hooks/use-session"

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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function isEnabledFlag(value: boolean | undefined) {
    return value !== false
}

function statusBadge(enabled: boolean | undefined) {
    const on = isEnabledFlag(enabled)
    return <Badge variant={on ? "default" : "secondary"}>{on ? "Enabled" : "Disabled"}</Badge>
}

function safeInt(v: string) {
    const n = Number.parseInt(v, 10)
    return Number.isFinite(n) ? n : 0
}

function getStaffId(s: StaffUser) {
    return s._id || s.id || ""
}

export default function AdminWindowsPage() {
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
    const [staffUsers, setStaffUsers] = React.useState<StaffUser[]>([])

    // filters
    const [winQ, setWinQ] = React.useState("")
    const [winStatusTab, setWinStatusTab] = React.useState<"all" | "enabled" | "disabled">("all")
    const [winDeptFilter, setWinDeptFilter] = React.useState<string>("all")

    // dialogs
    const [createWinOpen, setCreateWinOpen] = React.useState(false)
    const [editWinOpen, setEditWinOpen] = React.useState(false)
    const [assignStaffOpen, setAssignStaffOpen] = React.useState(false)

    // selected
    const [selectedWin, setSelectedWin] = React.useState<ServiceWindow | null>(null)
    const [assignTargetWin, setAssignTargetWin] = React.useState<ServiceWindow | null>(null)

    // create window form
    const [cWinDeptId, setCWinDeptId] = React.useState<string>("")
    const [cWinName, setCWinName] = React.useState("")
    const [cWinNumber, setCWinNumber] = React.useState<number>(1)

    // edit window form
    const [eWinName, setEWinName] = React.useState("")
    const [eWinNumber, setEWinNumber] = React.useState<number>(1)
    const [eWinEnabled, setEWinEnabled] = React.useState(true)

    // assign staff form
    const [aStaffId, setAStaffId] = React.useState<string>("none")

    const deptById = React.useMemo(() => {
        const m = new Map<string, Department>()
        for (const d of departments) m.set(d._id, d)
        return m
    }, [departments])

    const windowById = React.useMemo(() => {
        const m = new Map<string, ServiceWindow>()
        for (const w of windows) m.set(w._id, w)
        return m
    }, [windows])

    const staffAssignedByWindow = React.useMemo(() => {
        const m = new Map<string, StaffUser[]>()
        for (const s of staffUsers ?? []) {
            if (s.role !== "STAFF") continue
            if (!s.active) continue
            if (!s.assignedWindow) continue

            const arr = m.get(s.assignedWindow) ?? []
            arr.push(s)
            m.set(s.assignedWindow, arr)
        }

        for (const [k, arr] of m.entries()) {
            arr.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
            m.set(k, arr)
        }

        return m
    }, [staffUsers])

    const assignableStaff = React.useMemo(() => {
        return (staffUsers ?? [])
            .filter((s) => s.role === "STAFF" && s.active && getStaffId(s))
            .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
    }, [staffUsers])

    const enabledDepartments = React.useMemo(() => departments.filter((d) => isEnabledFlag(d.enabled)), [departments])

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
            setStaffUsers(staffRes.staff ?? [])
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load windows."
            toast.error(msg)
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void fetchAll()
    }, [fetchAll])

    function resetCreateWinForm() {
        setCWinDeptId("")
        setCWinName("")
        setCWinNumber(1)
    }

    const winRows = React.useMemo(() => {
        const q = winQ.trim().toLowerCase()

        return (windows ?? [])
            .filter((w) => {
                const enabled = isEnabledFlag(w.enabled)
                if (winStatusTab === "enabled" && !enabled) return false
                if (winStatusTab === "disabled" && enabled) return false

                if (winDeptFilter !== "all" && w.department !== winDeptFilter) return false

                if (!q) return true
                const deptName = deptById.get(w.department)?.name ?? ""
                const hay = `${w.name ?? ""} ${w.number ?? ""} ${deptName}`.toLowerCase()
                return hay.includes(q)
            })
            .sort((a, b) => {
                const ae = isEnabledFlag(a.enabled)
                const be = isEnabledFlag(b.enabled)
                if (ae !== be) return ae ? -1 : 1
                const deptA = deptById.get(a.department)?.name ?? ""
                const deptB = deptById.get(b.department)?.name ?? ""
                if (deptA !== deptB) return deptA.localeCompare(deptB)
                return (a.number ?? 0) - (b.number ?? 0)
            })
    }, [windows, winQ, winStatusTab, winDeptFilter, deptById])

    function openEditWin(w: ServiceWindow) {
        setSelectedWin(w)
        setEWinName(w.name ?? "")
        setEWinNumber(Number(w.number ?? 1))
        setEWinEnabled(isEnabledFlag(w.enabled))
        setEditWinOpen(true)
    }

    function openAssignStaff(w: ServiceWindow) {
        setAssignTargetWin(w)
        setAStaffId("none")
        setAssignStaffOpen(true)
    }

    async function handleCreateWin() {
        const departmentId = cWinDeptId
        const name = cWinName.trim()
        const number = Number(cWinNumber)

        if (!departmentId) return toast.error("Department is required.")
        if (!name) return toast.error("Window name is required.")
        if (!Number.isFinite(number) || number <= 0) return toast.error("Window number must be a positive integer.")

        setSaving(true)
        try {
            await adminApi.createWindow({ departmentId, name, number })
            toast.success("Window created.")
            setCreateWinOpen(false)
            resetCreateWinForm()
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to create window."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    async function handleSaveWin() {
        if (!selectedWin) return
        const id = selectedWin._id
        if (!id) return toast.error("Invalid window id.")

        const name = eWinName.trim()
        const number = Number(eWinNumber)

        if (!name) return toast.error("Window name is required.")
        if (!Number.isFinite(number) || number <= 0) return toast.error("Window number must be a positive integer.")

        setSaving(true)
        try {
            await adminApi.updateWindow(id, { name, number, enabled: eWinEnabled })
            toast.success("Window updated.")
            setEditWinOpen(false)
            setSelectedWin(null)
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to update window."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    async function handleAssignStaffToWindow() {
        if (!assignTargetWin) return toast.error("Please select a window.")
        if (!assignTargetWin._id) return toast.error("Invalid window id.")
        if (!assignTargetWin.department) return toast.error("Invalid window department.")
        if (!aStaffId || aStaffId === "none") return toast.error("Please select a staff account.")

        const picked = assignableStaff.find((s) => getStaffId(s) === aStaffId)
        if (!picked) return toast.error("Selected staff was not found.")

        setSaving(true)
        try {
            const movedFromWindowId = picked.assignedWindow || null

            await adminApi.updateStaff(aStaffId, {
                departmentId: assignTargetWin.department,
                windowId: assignTargetWin._id,
            })

            const movedText =
                movedFromWindowId && movedFromWindowId !== assignTargetWin._id
                    ? ` Moved from ${windowById.get(movedFromWindowId)?.name ?? "another window"}.`
                    : ""

            toast.success(`Staff assigned to ${assignTargetWin.name} (#${assignTargetWin.number}).${movedText}`)

            setAStaffId("none")
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to assign staff."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    async function handleUnassignStaffFromWindow(staff: StaffUser) {
        if (!assignTargetWin) return toast.error("Please select a window.")
        const staffId = getStaffId(staff)
        if (!staffId) return toast.error("Invalid staff id.")

        setSaving(true)
        try {
            await adminApi.updateStaff(staffId, {
                // keep/update department to the window's department; remove window assignment
                departmentId: assignTargetWin.department,
                windowId: null,
            })
            toast.success(`Removed ${staff.name} from ${assignTargetWin.name} (#${assignTargetWin.number}).`)
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to unassign staff."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    const stats = React.useMemo(() => {
        const total = windows.length
        const enabled = windows.filter((w) => isEnabledFlag(w.enabled)).length
        return { total, enabled, disabled: total - enabled }
    }, [windows])

    const assignedStaffForTargetWin = React.useMemo(() => {
        if (!assignTargetWin?._id) return []
        return staffAssignedByWindow.get(assignTargetWin._id) ?? []
    }, [assignTargetWin, staffAssignedByWindow])

    return (
        <DashboardLayout title="Windows" navItems={ADMIN_NAV_ITEMS} user={dashboardUser} activePath={location.pathname}>
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                <Card className="min-w-0">
                    <CardHeader className="gap-2">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <CardTitle>Window Management</CardTitle>
                                <CardDescription>
                                    Create and manage service windows. Assign staff directly from this page.
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
                                        resetCreateWinForm()
                                        setCreateWinOpen(true)
                                    }}
                                    disabled={saving}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <Plus className="h-4 w-4" />
                                    New window
                                </Button>

                                <Button asChild variant="secondary" className="w-full gap-2 sm:w-auto">
                                    <a href="/admin/departments">
                                        <Building2 className="h-4 w-4" />
                                        View departments
                                    </a>
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="secondary">Total: {stats.total}</Badge>
                                <Badge variant="default">Enabled: {stats.enabled}</Badge>
                                <Badge variant="secondary">Disabled: {stats.disabled}</Badge>
                            </div>

                            <div className="flex items-center gap-2">
                                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Windows</span>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="min-w-0">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center">
                                <Input
                                    value={winQ}
                                    onChange={(e) => setWinQ(e.target.value)}
                                    placeholder="Search windows…"
                                    className="w-full min-w-0 md:w-80"
                                />

                                <Select value={winDeptFilter} onValueChange={setWinDeptFilter}>
                                    <SelectTrigger className="w-full min-w-0 md:w-80">
                                        <SelectValue placeholder="Filter by department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All departments</SelectItem>
                                        {departments.map((d) => (
                                            <SelectItem key={d._id} value={d._id}>
                                                {d.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Tabs value={winStatusTab} onValueChange={(v) => setWinStatusTab(v as any)} className="w-full md:w-auto">
                                <TabsList className="grid w-full grid-cols-3 md:w-80">
                                    <TabsTrigger value="all">All</TabsTrigger>
                                    <TabsTrigger value="enabled">Enabled</TabsTrigger>
                                    <TabsTrigger value="disabled">Disabled</TabsTrigger>
                                </TabsList>
                                <TabsContent value={winStatusTab} />
                            </Tabs>
                        </div>

                        <div className="mt-4">
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
                                                <TableHead>Window</TableHead>
                                                <TableHead className="hidden md:table-cell">Department</TableHead>
                                                <TableHead className="hidden md:table-cell">Staff assigned</TableHead>
                                                <TableHead className="text-right">Status</TableHead>
                                                <TableHead className="w-14" />
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody>
                                            {winRows.map((w) => {
                                                const deptName = deptById.get(w.department)?.name ?? "—"
                                                const assignedStaff = staffAssignedByWindow.get(w._id) ?? []
                                                const assignedCount = assignedStaff.length
                                                const assignedNames = assignedStaff
                                                    .map((s) => (s.name?.trim() ? s.name.trim() : s.email))
                                                    .filter(Boolean)

                                                return (
                                                    <TableRow key={w._id}>
                                                        <TableCell className="font-medium">
                                                            <div className="flex min-w-0 flex-col">
                                                                <span className="truncate">
                                                                    {w.name}{" "}
                                                                    <span className="text-muted-foreground">(#{w.number})</span>
                                                                </span>
                                                                <span className="truncate text-xs text-muted-foreground md:hidden">
                                                                    {deptName}
                                                                </span>
                                                                <span className="truncate text-xs text-muted-foreground md:hidden">
                                                                    Staff assigned: {assignedCount}
                                                                </span>
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="hidden md:table-cell">
                                                            <span className="text-muted-foreground">{deptName}</span>
                                                        </TableCell>

                                                        <TableCell className="hidden md:table-cell">
                                                            {assignedCount > 0 ? (
                                                                <div className="min-w-0">
                                                                    <Badge variant="secondary">{assignedCount}</Badge>
                                                                    <p className="mt-1 truncate text-xs text-muted-foreground" title={assignedNames.join(", ")}>
                                                                        {assignedNames.join(", ")}
                                                                    </p>
                                                                    <Button
                                                                        type="button"
                                                                        variant="link"
                                                                        size="sm"
                                                                        className="h-auto p-0 text-xs"
                                                                        onClick={() => openAssignStaff(w)}
                                                                    >
                                                                        Manage assignment
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-muted-foreground">—</span>
                                                                    <Button
                                                                        type="button"
                                                                        variant="link"
                                                                        size="sm"
                                                                        className="h-auto p-0 text-xs"
                                                                        onClick={() => openAssignStaff(w)}
                                                                    >
                                                                        Assign staff
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </TableCell>

                                                        <TableCell className="text-right">{statusBadge(w.enabled)}</TableCell>

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
                                                                        onClick={() => openAssignStaff(w)}
                                                                        className="cursor-pointer"
                                                                    >
                                                                        <UserPlus2 className="mr-2 h-4 w-4" />
                                                                        Assign staff
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        onClick={() => openEditWin(w)}
                                                                        className="cursor-pointer"
                                                                    >
                                                                        Edit window
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}

                                            {winRows.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                                                        No windows match your filters.
                                                    </TableCell>
                                                </TableRow>
                                            ) : null}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Create Window */}
            <Dialog open={createWinOpen} onOpenChange={setCreateWinOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create window</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label>Department</Label>
                            <Select value={cWinDeptId || "none"} onValueChange={(v) => setCWinDeptId(v === "none" ? "" : v)}>
                                <SelectTrigger className="w-full min-w-0">
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Select…</SelectItem>
                                    {enabledDepartments.map((d) => (
                                        <SelectItem key={d._id} value={d._id}>
                                            {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Only enabled departments are selectable here.</p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="c-win-name">Window name</Label>
                            <Input
                                id="c-win-name"
                                value={cWinName}
                                onChange={(e) => setCWinName(e.target.value)}
                                placeholder="e.g., Window A"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="c-win-number">Window number</Label>
                            <Input
                                id="c-win-number"
                                type="number"
                                value={String(cWinNumber)}
                                onChange={(e) => setCWinNumber(safeInt(e.target.value))}
                                min={1}
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setCreateWinOpen(false)
                                resetCreateWinForm()
                            }}
                            disabled={saving}
                            className="w-full sm:w-auto sm:mr-2"
                        >
                            Cancel
                        </Button>

                        <Button type="button" onClick={() => void handleCreateWin()} disabled={saving} className="w-full sm:w-auto">
                            {saving ? "Creating…" : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Window */}
            <Dialog open={editWinOpen} onOpenChange={setEditWinOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit window</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label>Department</Label>
                            <Input value={selectedWin ? deptById.get(selectedWin.department)?.name ?? "—" : ""} readOnly />
                            <p className="text-xs text-muted-foreground">
                                Window department can’t be changed (create a new window instead).
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="e-win-name">Window name</Label>
                            <Input id="e-win-name" value={eWinName} onChange={(e) => setEWinName(e.target.value)} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="e-win-number">Window number</Label>
                            <Input
                                id="e-win-number"
                                type="number"
                                value={String(eWinNumber)}
                                onChange={(e) => setEWinNumber(safeInt(e.target.value))}
                                min={1}
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="grid gap-0.5">
                                <div className="text-sm font-medium">Enabled</div>
                                <div className="text-xs text-muted-foreground">
                                    Disabled windows won’t appear when assigning staff.
                                </div>
                            </div>
                            <Switch checked={eWinEnabled} onCheckedChange={setEWinEnabled} />
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setEditWinOpen(false)
                                setSelectedWin(null)
                            }}
                            disabled={saving}
                            className="w-full sm:w-auto sm:mr-2"
                        >
                            Cancel
                        </Button>

                        <Button type="button" onClick={() => void handleSaveWin()} disabled={saving} className="w-full sm:w-auto">
                            {saving ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assign Staff */}
            <Dialog
                open={assignStaffOpen}
                onOpenChange={(open) => {
                    setAssignStaffOpen(open)
                    if (!open) {
                        setAssignTargetWin(null)
                        setAStaffId("none")
                    }
                }}
            >
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Assign staff to window</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="rounded-lg border p-3">
                            <div className="text-sm font-medium">
                                {assignTargetWin?.name || "—"}{" "}
                                {assignTargetWin ? (
                                    <span className="text-muted-foreground">(# {assignTargetWin.number})</span>
                                ) : null}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                                Department:{" "}
                                {assignTargetWin ? (deptById.get(assignTargetWin.department)?.name ?? "—") : "—"}
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Select staff</Label>
                            <Select value={aStaffId} onValueChange={setAStaffId}>
                                <SelectTrigger className="w-full min-w-0">
                                    <SelectValue placeholder="Choose staff account" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Select…</SelectItem>
                                    {assignableStaff.map((s) => {
                                        const staffId = getStaffId(s)
                                        const currentWindow = s.assignedWindow ? windowById.get(s.assignedWindow) : null
                                        const tag = currentWindow
                                            ? ` • currently at ${currentWindow.name} (#${currentWindow.number})`
                                            : ""
                                        return (
                                            <SelectItem key={staffId} value={staffId}>
                                                {s.name} ({s.email}){tag}
                                            </SelectItem>
                                        )
                                    })}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Assigning here will set staff department to this window’s department and update window assignment.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label>Currently assigned in this window</Label>
                            <div className="max-h-48 overflow-y-auto rounded-lg border p-2">
                                {assignedStaffForTargetWin.length === 0 ? (
                                    <p className="px-1 py-2 text-sm text-muted-foreground">No staff assigned yet.</p>
                                ) : (
                                    <div className="grid gap-2">
                                        {assignedStaffForTargetWin.map((s) => {
                                            const sid = getStaffId(s)
                                            return (
                                                <div
                                                    key={sid}
                                                    className="flex items-center justify-between rounded-md border px-3 py-2"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-medium">{s.name}</p>
                                                        <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => void handleUnassignStaffFromWindow(s)}
                                                        disabled={saving}
                                                        className="gap-1"
                                                    >
                                                        <UserMinus className="h-4 w-4" />
                                                        Unassign
                                                    </Button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setAssignStaffOpen(false)
                                setAssignTargetWin(null)
                                setAStaffId("none")
                            }}
                            disabled={saving}
                            className="w-full sm:w-auto sm:mr-2"
                        >
                            Close
                        </Button>

                        <Button
                            type="button"
                            onClick={() => void handleAssignStaffToWindow()}
                            disabled={saving}
                            className="w-full gap-2 sm:w-auto"
                        >
                            <UserPlus2 className="h-4 w-4" />
                            {saving ? "Assigning…" : "Assign staff"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    )
}
