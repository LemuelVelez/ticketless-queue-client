/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { MoreHorizontal, Plus, RefreshCw, Building2, DoorOpen } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ADMIN_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { adminApi, type Department, type ServiceWindow } from "@/api/admin"
import { useSession } from "@/hooks/use-session"

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
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

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

export default function AdminDepartmentsPage() {
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

    const [pageTab, setPageTab] = React.useState<"departments" | "windows">("departments")

    // filters
    const [deptQ, setDeptQ] = React.useState("")
    const [deptStatusTab, setDeptStatusTab] = React.useState<"all" | "enabled" | "disabled">("all")

    const [winQ, setWinQ] = React.useState("")
    const [winStatusTab, setWinStatusTab] = React.useState<"all" | "enabled" | "disabled">("all")
    const [winDeptFilter, setWinDeptFilter] = React.useState<string>("all")

    // dialogs
    const [createDeptOpen, setCreateDeptOpen] = React.useState(false)
    const [editDeptOpen, setEditDeptOpen] = React.useState(false)
    const [createWinOpen, setCreateWinOpen] = React.useState(false)
    const [editWinOpen, setEditWinOpen] = React.useState(false)

    // selected
    const [selectedDept, setSelectedDept] = React.useState<Department | null>(null)
    const [selectedWin, setSelectedWin] = React.useState<ServiceWindow | null>(null)

    // create dept form
    const [cDeptName, setCDeptName] = React.useState("")
    const [cDeptCode, setCDeptCode] = React.useState("")

    // edit dept form
    const [eDeptName, setEDeptName] = React.useState("")
    const [eDeptCode, setEDeptCode] = React.useState("")
    const [eDeptEnabled, setEDeptEnabled] = React.useState(true)

    // create window form
    const [cWinDeptId, setCWinDeptId] = React.useState<string>("")
    const [cWinName, setCWinName] = React.useState("")
    const [cWinNumber, setCWinNumber] = React.useState<number>(1)

    // edit window form
    const [eWinName, setEWinName] = React.useState("")
    const [eWinNumber, setEWinNumber] = React.useState<number>(1)
    const [eWinEnabled, setEWinEnabled] = React.useState(true)

    const deptById = React.useMemo(() => {
        const m = new Map<string, Department>()
        for (const d of departments) m.set(d._id, d)
        return m
    }, [departments])

    const enabledDepartments = React.useMemo(
        () => departments.filter((d) => isEnabledFlag(d.enabled)),
        [departments],
    )

    const windowsByDept = React.useMemo(() => {
        const m = new Map<string, ServiceWindow[]>()
        for (const w of windows) {
            const arr = m.get(w.department) ?? []
            arr.push(w)
            m.set(w.department, arr)
        }
        return m
    }, [windows])

    const fetchAll = React.useCallback(async () => {
        setLoading(true)
        try {
            const [deptRes, winRes] = await Promise.all([
                adminApi.listDepartments(),
                adminApi.listWindows(),
            ])
            setDepartments(deptRes.departments ?? [])
            setWindows(winRes.windows ?? [])
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load departments/windows."
            toast.error(msg)
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void fetchAll()
    }, [fetchAll])

    function resetCreateDeptForm() {
        setCDeptName("")
        setCDeptCode("")
    }

    function resetCreateWinForm() {
        setCWinDeptId("")
        setCWinName("")
        setCWinNumber(1)
    }

    const deptRows = React.useMemo(() => {
        const q = deptQ.trim().toLowerCase()

        return (departments ?? [])
            .filter((d) => {
                const enabled = isEnabledFlag(d.enabled)
                if (deptStatusTab === "enabled" && !enabled) return false
                if (deptStatusTab === "disabled" && enabled) return false

                if (!q) return true
                const hay = `${d.name ?? ""} ${d.code ?? ""}`.toLowerCase()
                return hay.includes(q)
            })
            .sort((a, b) => {
                const ae = isEnabledFlag(a.enabled)
                const be = isEnabledFlag(b.enabled)
                if (ae !== be) return ae ? -1 : 1
                return (a.name ?? "").localeCompare(b.name ?? "")
            })
    }, [departments, deptQ, deptStatusTab])

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

    function openEditDept(d: Department) {
        setSelectedDept(d)
        setEDeptName(d.name ?? "")
        setEDeptCode(d.code ?? "")
        setEDeptEnabled(isEnabledFlag(d.enabled))
        setEditDeptOpen(true)
    }

    function openEditWin(w: ServiceWindow) {
        setSelectedWin(w)
        setEWinName(w.name ?? "")
        setEWinNumber(Number(w.number ?? 1))
        setEWinEnabled(isEnabledFlag(w.enabled))
        setEditWinOpen(true)
    }

    async function handleCreateDept() {
        const name = cDeptName.trim()
        const code = cDeptCode.trim()

        if (!name) return toast.error("Department name is required.")

        setSaving(true)
        try {
            await adminApi.createDepartment({ name, code: code || undefined })
            toast.success("Department created.")
            setCreateDeptOpen(false)
            resetCreateDeptForm()
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to create department."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    async function handleSaveDept() {
        if (!selectedDept) return
        const id = selectedDept._id
        if (!id) return toast.error("Invalid department id.")

        const name = eDeptName.trim()
        const code = eDeptCode.trim()

        if (!name) return toast.error("Department name is required.")

        setSaving(true)
        try {
            await adminApi.updateDepartment(id, {
                name,
                code: code || undefined,
                enabled: eDeptEnabled,
            })
            toast.success("Department updated.")
            setEditDeptOpen(false)
            setSelectedDept(null)
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to update department."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
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

    const stats = React.useMemo(() => {
        const deptTotal = departments.length
        const deptEnabled = departments.filter((d) => isEnabledFlag(d.enabled)).length

        const winTotal = windows.length
        const winEnabled = windows.filter((w) => isEnabledFlag(w.enabled)).length

        return {
            deptTotal,
            deptEnabled,
            deptDisabled: deptTotal - deptEnabled,
            winTotal,
            winEnabled,
            winDisabled: winTotal - winEnabled,
        }
    }, [departments, windows])

    return (
        <DashboardLayout
            title="Departments"
            navItems={ADMIN_NAV_ITEMS}
            user={dashboardUser}
            activePath={location.pathname}
        >
            <div className="grid gap-6">
                <Card>
                    <CardHeader className="gap-2">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <CardTitle>Departments & Windows</CardTitle>
                                <CardDescription>
                                    Manage departments and service windows. Disable items to hide them from selection without deleting.
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
                                        resetCreateDeptForm()
                                        setCreateDeptOpen(true)
                                    }}
                                    disabled={saving}
                                    className="gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    New department
                                </Button>

                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        resetCreateWinForm()
                                        setCreateWinOpen(true)
                                    }}
                                    disabled={saving}
                                    className="gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    New window
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="secondary">Depts: {stats.deptTotal}</Badge>
                                <Badge variant="default">Enabled: {stats.deptEnabled}</Badge>
                                <Badge variant="secondary">Disabled: {stats.deptDisabled}</Badge>

                                <span className="mx-1 hidden md:inline">•</span>

                                <Badge variant="secondary">Windows: {stats.winTotal}</Badge>
                                <Badge variant="default">Enabled: {stats.winEnabled}</Badge>
                                <Badge variant="secondary">Disabled: {stats.winDisabled}</Badge>
                            </div>

                            <Tabs value={pageTab} onValueChange={(v) => setPageTab(v as any)}>
                                <TabsList className="grid w-full grid-cols-2 md:w-80">
                                    <TabsTrigger value="departments" className="gap-2">
                                        <Building2 className="h-4 w-4" />
                                        Departments
                                    </TabsTrigger>
                                    <TabsTrigger value="windows" className="gap-2">
                                        <DoorOpen className="h-4 w-4" />
                                        Windows
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <Tabs value={pageTab} onValueChange={(v) => setPageTab(v as any)}>
                            <TabsContent value="departments">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <Input
                                        value={deptQ}
                                        onChange={(e) => setDeptQ(e.target.value)}
                                        placeholder="Search departments…"
                                        className="w-full md:w-96"
                                    />

                                    <Tabs value={deptStatusTab} onValueChange={(v) => setDeptStatusTab(v as any)}>
                                        <TabsList className="grid w-full grid-cols-3 md:w-80">
                                            <TabsTrigger value="all">All</TabsTrigger>
                                            <TabsTrigger value="enabled">Enabled</TabsTrigger>
                                            <TabsTrigger value="disabled">Disabled</TabsTrigger>
                                        </TabsList>
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
                                        <div className="rounded-lg border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Name</TableHead>
                                                        <TableHead className="hidden md:table-cell">Code</TableHead>
                                                        <TableHead className="hidden lg:table-cell">Windows</TableHead>
                                                        <TableHead className="text-right">Status</TableHead>
                                                        <TableHead className="w-14" />
                                                    </TableRow>
                                                </TableHeader>

                                                <TableBody>
                                                    {deptRows.map((d) => {
                                                        const winCount = (windowsByDept.get(d._id) ?? []).length
                                                        return (
                                                            <TableRow key={d._id}>
                                                                <TableCell className="font-medium">
                                                                    <div className="flex flex-col">
                                                                        <span className="truncate">{d.name}</span>
                                                                        <span className="truncate text-xs text-muted-foreground md:hidden">
                                                                            {d.code || "—"}
                                                                        </span>
                                                                    </div>
                                                                </TableCell>

                                                                <TableCell className="hidden md:table-cell">
                                                                    <span className="text-muted-foreground">{d.code || "—"}</span>
                                                                </TableCell>

                                                                <TableCell className="hidden lg:table-cell">
                                                                    <span className="text-muted-foreground">{winCount}</span>
                                                                </TableCell>

                                                                <TableCell className="text-right">{statusBadge(d.enabled)}</TableCell>

                                                                <TableCell className="text-right">
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="icon" aria-label="Row actions">
                                                                                <MoreHorizontal className="h-4 w-4" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>

                                                                        <DropdownMenuContent align="end" className="w-44">
                                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem
                                                                                onClick={() => openEditDept(d)}
                                                                                className="cursor-pointer"
                                                                            >
                                                                                Edit department
                                                                            </DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })}

                                                    {deptRows.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                                                                No departments match your filters.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : null}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="windows">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
                                        <Input
                                            value={winQ}
                                            onChange={(e) => setWinQ(e.target.value)}
                                            placeholder="Search windows…"
                                            className="w-full md:w-80"
                                        />

                                        <Select value={winDeptFilter} onValueChange={setWinDeptFilter}>
                                            <SelectTrigger className="w-full md:w-80">
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

                                    <Tabs value={winStatusTab} onValueChange={(v) => setWinStatusTab(v as any)}>
                                        <TabsList className="grid w-full grid-cols-3 md:w-80">
                                            <TabsTrigger value="all">All</TabsTrigger>
                                            <TabsTrigger value="enabled">Enabled</TabsTrigger>
                                            <TabsTrigger value="disabled">Disabled</TabsTrigger>
                                        </TabsList>
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
                                        <div className="rounded-lg border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Window</TableHead>
                                                        <TableHead className="hidden md:table-cell">Department</TableHead>
                                                        <TableHead className="text-right">Status</TableHead>
                                                        <TableHead className="w-14" />
                                                    </TableRow>
                                                </TableHeader>

                                                <TableBody>
                                                    {winRows.map((w) => {
                                                        const deptName = deptById.get(w.department)?.name ?? "—"
                                                        return (
                                                            <TableRow key={w._id}>
                                                                <TableCell className="font-medium">
                                                                    <div className="flex flex-col">
                                                                        <span className="truncate">
                                                                            {w.name} <span className="text-muted-foreground">(#{w.number})</span>
                                                                        </span>
                                                                        <span className="truncate text-xs text-muted-foreground md:hidden">
                                                                            {deptName}
                                                                        </span>
                                                                    </div>
                                                                </TableCell>

                                                                <TableCell className="hidden md:table-cell">
                                                                    <span className="text-muted-foreground">{deptName}</span>
                                                                </TableCell>

                                                                <TableCell className="text-right">{statusBadge(w.enabled)}</TableCell>

                                                                <TableCell className="text-right">
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="icon" aria-label="Row actions">
                                                                                <MoreHorizontal className="h-4 w-4" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>

                                                                        <DropdownMenuContent align="end" className="w-44">
                                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                            <DropdownMenuSeparator />
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
                                                            <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                                                                No windows match your filters.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : null}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>

            {/* Create Department */}
            <Dialog open={createDeptOpen} onOpenChange={setCreateDeptOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create department</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="c-dept-name">Name</Label>
                            <Input
                                id="c-dept-name"
                                value={cDeptName}
                                onChange={(e) => setCDeptName(e.target.value)}
                                placeholder="e.g., Registrar"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="c-dept-code">Code (optional)</Label>
                            <Input
                                id="c-dept-code"
                                value={cDeptCode}
                                onChange={(e) => setCDeptCode(e.target.value)}
                                placeholder="e.g., REG"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setCreateDeptOpen(false)
                                resetCreateDeptForm()
                            }}
                            disabled={saving}
                            className="mr-2"
                        >
                            Cancel
                        </Button>

                        <Button type="button" onClick={() => void handleCreateDept()} disabled={saving}>
                            {saving ? "Creating…" : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Department */}
            <Dialog open={editDeptOpen} onOpenChange={setEditDeptOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit department</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="e-dept-name">Name</Label>
                            <Input
                                id="e-dept-name"
                                value={eDeptName}
                                onChange={(e) => setEDeptName(e.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="e-dept-code">Code</Label>
                            <Input
                                id="e-dept-code"
                                value={eDeptCode}
                                onChange={(e) => setEDeptCode(e.target.value)}
                                placeholder="Optional"
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="grid gap-0.5">
                                <div className="text-sm font-medium">Enabled</div>
                                <div className="text-xs text-muted-foreground">
                                    Disabled departments won’t appear in public/join selection.
                                </div>
                            </div>
                            <Switch checked={eDeptEnabled} onCheckedChange={setEDeptEnabled} />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setEditDeptOpen(false)
                                setSelectedDept(null)
                            }}
                            disabled={saving}
                            className="mr-2"
                        >
                            Cancel
                        </Button>

                        <Button type="button" onClick={() => void handleSaveDept()} disabled={saving}>
                            {saving ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Window */}
            <Dialog open={createWinOpen} onOpenChange={setCreateWinOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create window</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label>Department</Label>
                            <Select
                                value={cWinDeptId || "none"}
                                onValueChange={(v) => setCWinDeptId(v === "none" ? "" : v)}
                            >
                                <SelectTrigger>
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
                            <p className="text-xs text-muted-foreground">
                                Only enabled departments are selectable here.
                            </p>
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

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setCreateWinOpen(false)
                                resetCreateWinForm()
                            }}
                            disabled={saving}
                            className="mr-2"
                        >
                            Cancel
                        </Button>

                        <Button type="button" onClick={() => void handleCreateWin()} disabled={saving}>
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
                            <Input value={selectedWin ? (deptById.get(selectedWin.department)?.name ?? "—") : ""} readOnly />
                            <p className="text-xs text-muted-foreground">
                                Window department can’t be changed (create a new window instead).
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="e-win-name">Window name</Label>
                            <Input
                                id="e-win-name"
                                value={eWinName}
                                onChange={(e) => setEWinName(e.target.value)}
                            />
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

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setEditWinOpen(false)
                                setSelectedWin(null)
                            }}
                            disabled={saving}
                            className="mr-2"
                        >
                            Cancel
                        </Button>

                        <Button type="button" onClick={() => void handleSaveWin()} disabled={saving}>
                            {saving ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    )
}
