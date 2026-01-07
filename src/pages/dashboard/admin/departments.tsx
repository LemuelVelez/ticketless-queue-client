/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { MoreHorizontal, Plus, RefreshCw, Building2, LayoutGrid } from "lucide-react"

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

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function isEnabledFlag(value: boolean | undefined) {
    return value !== false
}

function statusBadge(enabled: boolean | undefined) {
    const on = isEnabledFlag(enabled)
    return <Badge variant={on ? "default" : "secondary"}>{on ? "Enabled" : "Disabled"}</Badge>
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
    // Only for showing window counts per department (management happens in /admin/windows)
    const [windows, setWindows] = React.useState<ServiceWindow[]>([])

    // filters
    const [deptQ, setDeptQ] = React.useState("")
    const [deptStatusTab, setDeptStatusTab] = React.useState<"all" | "enabled" | "disabled">("all")

    // dialogs
    const [createDeptOpen, setCreateDeptOpen] = React.useState(false)
    const [editDeptOpen, setEditDeptOpen] = React.useState(false)

    // selected
    const [selectedDept, setSelectedDept] = React.useState<Department | null>(null)

    // create dept form
    const [cDeptName, setCDeptName] = React.useState("")
    const [cDeptCode, setCDeptCode] = React.useState("")

    // edit dept form
    const [eDeptName, setEDeptName] = React.useState("")
    const [eDeptCode, setEDeptCode] = React.useState("")
    const [eDeptEnabled, setEDeptEnabled] = React.useState(true)

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
            const [deptRes, winRes] = await Promise.all([adminApi.listDepartments(), adminApi.listWindows()])
            setDepartments(deptRes.departments ?? [])
            setWindows(winRes.windows ?? [])
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load departments."
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

    function openEditDept(d: Department) {
        setSelectedDept(d)
        setEDeptName(d.name ?? "")
        setEDeptCode(d.code ?? "")
        setEDeptEnabled(isEnabledFlag(d.enabled))
        setEditDeptOpen(true)
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

    const stats = React.useMemo(() => {
        const deptTotal = departments.length
        const deptEnabled = departments.filter((d) => isEnabledFlag(d.enabled)).length
        const winTotal = windows.length
        return {
            deptTotal,
            deptEnabled,
            deptDisabled: deptTotal - deptEnabled,
            winTotal,
        }
    }, [departments, windows])

    return (
        <DashboardLayout
            title="Departments"
            navItems={ADMIN_NAV_ITEMS}
            user={dashboardUser}
            activePath={location.pathname}
        >
            {/* ✅ Responsiveness fix: define columns + allow shrink */}
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                <Card className="min-w-0">
                    <CardHeader className="gap-2">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <CardTitle>Department Management</CardTitle>
                                <CardDescription>
                                    Create and manage departments. Disable to hide from public selection.
                                </CardDescription>
                            </div>

                            {/* ✅ XS stack; desktop unchanged */}
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
                                        resetCreateDeptForm()
                                        setCreateDeptOpen(true)
                                    }}
                                    disabled={saving}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <Plus className="h-4 w-4" />
                                    New department
                                </Button>

                                <Button asChild variant="secondary" className="w-full gap-2 sm:w-auto">
                                    <a href="/admin/windows">
                                        <LayoutGrid className="h-4 w-4" />
                                        Manage windows
                                    </a>
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="secondary">Depts: {stats.deptTotal}</Badge>
                                <Badge variant="default">Enabled: {stats.deptEnabled}</Badge>
                                <Badge variant="secondary">Disabled: {stats.deptDisabled}</Badge>
                                <Badge variant="secondary">Windows: {stats.winTotal}</Badge>
                            </div>

                            <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Departments</span>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="min-w-0">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <Input
                                value={deptQ}
                                onChange={(e) => setDeptQ(e.target.value)}
                                placeholder="Search departments…"
                                className="w-full min-w-0 md:w-96"
                            />

                            <Tabs value={deptStatusTab} onValueChange={(v) => setDeptStatusTab(v as any)} className="w-full md:w-auto">
                                <TabsList className="grid w-full grid-cols-3 md:w-80">
                                    <TabsTrigger value="all">All</TabsTrigger>
                                    <TabsTrigger value="enabled">Enabled</TabsTrigger>
                                    <TabsTrigger value="disabled">Disabled</TabsTrigger>
                                </TabsList>
                                <TabsContent value={deptStatusTab} />
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
                                // ✅ Prevent page overflow from table
                                <div className="rounded-lg border overflow-x-auto">
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
                                                            <div className="flex min-w-0 flex-col">
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

                    {/* ✅ Mobile footer fix (no w-full + mr-2 overflow) */}
                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setCreateDeptOpen(false)
                                resetCreateDeptForm()
                            }}
                            disabled={saving}
                            className="w-full sm:w-auto sm:mr-2"
                        >
                            Cancel
                        </Button>

                        <Button type="button" onClick={() => void handleCreateDept()} disabled={saving} className="w-full sm:w-auto">
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
                            <Input id="e-dept-name" value={eDeptName} onChange={(e) => setEDeptName(e.target.value)} />
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

                    {/* ✅ Mobile footer fix */}
                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setEditDeptOpen(false)
                                setSelectedDept(null)
                            }}
                            disabled={saving}
                            className="w-full sm:w-auto sm:mr-2"
                        >
                            Cancel
                        </Button>

                        <Button type="button" onClick={() => void handleSaveDept()} disabled={saving} className="w-full sm:w-auto">
                            {saving ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    )
}
