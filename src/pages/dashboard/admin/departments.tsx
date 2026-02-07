/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import {
    MoreHorizontal,
    Plus,
    RefreshCw,
    Building2,
    LayoutGrid,
    FolderTree,
    ClipboardList,
    Trash2,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ADMIN_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import {
    adminApi,
    type Department,
    type ServiceWindow,
    type TransactionPurpose,
    type TransactionScope,
} from "@/api/admin"
import { useSession } from "@/hooks/use-session"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"

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

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const DEFAULT_MANAGERS = ["REGISTRAR", "LIBRARY", "ADMIN_BUILDING"] as const

function isEnabledFlag(value: boolean | undefined) {
    return value !== false
}

function statusBadge(enabled: boolean | undefined) {
    const on = isEnabledFlag(enabled)
    return <Badge variant={on ? "default" : "secondary"}>{on ? "Enabled" : "Disabled"}</Badge>
}

function normalizeManagerKey(value: string, fallback = "REGISTRAR") {
    const v = String(value || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_")
    return v || fallback
}

function prettyManager(value?: string) {
    const v = String(value || "").trim()
    if (!v) return "REGISTRAR"
    return v
        .toLowerCase()
        .split("_")
        .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
        .join(" ")
}

function uniqueScopes(scopes: string[]): TransactionScope[] {
    const seen = new Set<string>()
    const out: TransactionScope[] = []

    for (const raw of scopes) {
        const s = String(raw || "").trim().toUpperCase()
        if (s !== "INTERNAL" && s !== "EXTERNAL") continue
        if (seen.has(s)) continue
        seen.add(s)
        out.push(s as TransactionScope)
    }

    return out
}

function safeInt(v: string, fallback: number) {
    const n = Number.parseInt(v, 10)
    if (!Number.isFinite(n)) return fallback
    return n
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
    const [purposes, setPurposes] = React.useState<TransactionPurpose[]>([])

    const [mainTab, setMainTab] = React.useState<"departments" | "purposes">("departments")

    // departments filters
    const [deptQ, setDeptQ] = React.useState("")
    const [deptStatusTab, setDeptStatusTab] = React.useState<"all" | "enabled" | "disabled">("all")
    const [deptManagerFilter, setDeptManagerFilter] = React.useState<string>("all")

    // purposes filters
    const [purposeQ, setPurposeQ] = React.useState("")
    const [purposeStatusTab, setPurposeStatusTab] = React.useState<"all" | "enabled" | "disabled">("all")
    const [purposeManagerFilter, setPurposeManagerFilter] = React.useState<string>("all")
    const [purposeScopeFilter, setPurposeScopeFilter] = React.useState<string>("all")
    const [purposeDeptFilter, setPurposeDeptFilter] = React.useState<string>("all")

    // dialogs - departments
    const [createDeptOpen, setCreateDeptOpen] = React.useState(false)
    const [editDeptOpen, setEditDeptOpen] = React.useState(false)

    // dialogs - purposes
    const [createPurposeOpen, setCreatePurposeOpen] = React.useState(false)
    const [editPurposeOpen, setEditPurposeOpen] = React.useState(false)
    const [deletePurposeOpen, setDeletePurposeOpen] = React.useState(false)

    // selected
    const [selectedDept, setSelectedDept] = React.useState<Department | null>(null)
    const [selectedPurpose, setSelectedPurpose] = React.useState<TransactionPurpose | null>(null)

    // create dept form
    const [cDeptName, setCDeptName] = React.useState("")
    const [cDeptCode, setCDeptCode] = React.useState("")
    const [cDeptManager, setCDeptManager] = React.useState("REGISTRAR")

    // edit dept form
    const [eDeptName, setEDeptName] = React.useState("")
    const [eDeptCode, setEDeptCode] = React.useState("")
    const [eDeptManager, setEDeptManager] = React.useState("REGISTRAR")
    const [eDeptEnabled, setEDeptEnabled] = React.useState(true)

    // create purpose form
    const [cPurposeCategory, setCPurposeCategory] = React.useState("REGISTRAR")
    const [cPurposeKey, setCPurposeKey] = React.useState("")
    const [cPurposeLabel, setCPurposeLabel] = React.useState("")
    const [cPurposeScopes, setCPurposeScopes] = React.useState<TransactionScope[]>(["INTERNAL", "EXTERNAL"])
    const [cPurposeApplyAllDepartments, setCPurposeApplyAllDepartments] = React.useState(true)
    const [cPurposeDepartmentIds, setCPurposeDepartmentIds] = React.useState<string[]>([])
    const [cPurposeEnabled, setCPurposeEnabled] = React.useState(true)
    const [cPurposeSortOrder, setCPurposeSortOrder] = React.useState<number>(1000)

    // edit purpose form
    const [ePurposeCategory, setEPurposeCategory] = React.useState("REGISTRAR")
    const [ePurposeKey, setEPurposeKey] = React.useState("")
    const [ePurposeLabel, setEPurposeLabel] = React.useState("")
    const [ePurposeScopes, setEPurposeScopes] = React.useState<TransactionScope[]>(["INTERNAL", "EXTERNAL"])
    const [ePurposeApplyAllDepartments, setEPurposeApplyAllDepartments] = React.useState(true)
    const [ePurposeDepartmentIds, setEPurposeDepartmentIds] = React.useState<string[]>([])
    const [ePurposeEnabled, setEPurposeEnabled] = React.useState(true)
    const [ePurposeSortOrder, setEPurposeSortOrder] = React.useState<number>(1000)

    const windowsByDept = React.useMemo(() => {
        const m = new Map<string, ServiceWindow[]>()
        for (const w of windows) {
            const arr = m.get(w.department) ?? []
            arr.push(w)
            m.set(w.department, arr)
        }
        return m
    }, [windows])

    const deptById = React.useMemo(() => {
        const m = new Map<string, Department>()
        for (const d of departments) m.set(d._id, d)
        return m
    }, [departments])

    const managerOptions = React.useMemo(() => {
        const values = new Set<string>()
        for (const m of DEFAULT_MANAGERS) values.add(m)
        for (const d of departments) values.add(normalizeManagerKey(d.transactionManager || "REGISTRAR"))
        for (const p of purposes) values.add(normalizeManagerKey(p.category || "REGISTRAR"))
        return Array.from(values).sort((a, b) => a.localeCompare(b))
    }, [departments, purposes])

    const enabledDepartments = React.useMemo(
        () => departments.filter((d) => isEnabledFlag(d.enabled)).sort((a, b) => a.name.localeCompare(b.name)),
        [departments]
    )

    const fetchAll = React.useCallback(async () => {
        setLoading(true)
        try {
            const [deptRes, winRes, purposeRes] = await Promise.all([
                adminApi.listDepartments(),
                adminApi.listWindows(),
                adminApi.listTransactionPurposes({ includeDisabled: true }),
            ])

            setDepartments(deptRes.departments ?? [])
            setWindows(winRes.windows ?? [])
            setPurposes(purposeRes.transactions ?? [])
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load admin data."
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
        setCDeptManager("REGISTRAR")
    }

    function resetCreatePurposeForm() {
        setCPurposeCategory("REGISTRAR")
        setCPurposeKey("")
        setCPurposeLabel("")
        setCPurposeScopes(["INTERNAL", "EXTERNAL"])
        setCPurposeApplyAllDepartments(true)
        setCPurposeDepartmentIds([])
        setCPurposeEnabled(true)
        setCPurposeSortOrder(1000)
    }

    const deptRows = React.useMemo(() => {
        const q = deptQ.trim().toLowerCase()

        return (departments ?? [])
            .filter((d) => {
                const enabled = isEnabledFlag(d.enabled)
                if (deptStatusTab === "enabled" && !enabled) return false
                if (deptStatusTab === "disabled" && enabled) return false

                const manager = normalizeManagerKey(d.transactionManager || "REGISTRAR")
                if (deptManagerFilter !== "all" && manager !== deptManagerFilter) return false

                if (!q) return true
                const hay = `${d.name ?? ""} ${d.code ?? ""} ${manager}`.toLowerCase()
                return hay.includes(q)
            })
            .sort((a, b) => {
                const ae = isEnabledFlag(a.enabled)
                const be = isEnabledFlag(b.enabled)
                if (ae !== be) return ae ? -1 : 1

                const am = normalizeManagerKey(a.transactionManager || "REGISTRAR")
                const bm = normalizeManagerKey(b.transactionManager || "REGISTRAR")
                if (am !== bm) return am.localeCompare(bm)

                return (a.name ?? "").localeCompare(b.name ?? "")
            })
    }, [departments, deptQ, deptStatusTab, deptManagerFilter])

    const purposeRows = React.useMemo(() => {
        const q = purposeQ.trim().toLowerCase()

        return (purposes ?? [])
            .filter((p) => {
                const enabled = isEnabledFlag(p.enabled)
                if (purposeStatusTab === "enabled" && !enabled) return false
                if (purposeStatusTab === "disabled" && enabled) return false

                const category = normalizeManagerKey(p.category || "REGISTRAR")
                if (purposeManagerFilter !== "all" && category !== purposeManagerFilter) return false

                if (purposeScopeFilter !== "all" && !(p.scopes || []).includes(purposeScopeFilter as TransactionScope)) {
                    return false
                }

                if (purposeDeptFilter !== "all") {
                    if (purposeDeptFilter === "__all_departments__") {
                        if ((p.departmentIds || []).length > 0) return false
                    } else if (!(p.departmentIds || []).includes(purposeDeptFilter)) {
                        return false
                    }
                }

                if (!q) return true
                const deptNames = (p.departmentIds || [])
                    .map((id) => deptById.get(id)?.name || id)
                    .join(" ")
                    .toLowerCase()

                const hay = `${p.label ?? ""} ${p.key ?? ""} ${category} ${deptNames}`.toLowerCase()
                return hay.includes(q)
            })
            .sort((a, b) => {
                const ae = isEnabledFlag(a.enabled)
                const be = isEnabledFlag(b.enabled)
                if (ae !== be) return ae ? -1 : 1

                const am = normalizeManagerKey(a.category || "REGISTRAR")
                const bm = normalizeManagerKey(b.category || "REGISTRAR")
                if (am !== bm) return am.localeCompare(bm)

                const so = (a.sortOrder ?? 1000) - (b.sortOrder ?? 1000)
                if (so !== 0) return so

                return (a.label ?? "").localeCompare(b.label ?? "")
            })
    }, [purposes, purposeQ, purposeStatusTab, purposeManagerFilter, purposeScopeFilter, purposeDeptFilter, deptById])

    function openEditDept(d: Department) {
        setSelectedDept(d)
        setEDeptName(d.name ?? "")
        setEDeptCode(d.code ?? "")
        setEDeptManager(normalizeManagerKey(d.transactionManager || "REGISTRAR"))
        setEDeptEnabled(isEnabledFlag(d.enabled))
        setEditDeptOpen(true)
    }

    function openEditPurpose(p: TransactionPurpose) {
        setSelectedPurpose(p)

        setEPurposeCategory(normalizeManagerKey(p.category || "REGISTRAR"))
        setEPurposeKey(p.key ?? "")
        setEPurposeLabel(p.label ?? "")
        setEPurposeScopes(uniqueScopes(p.scopes || []))
        setEPurposeApplyAllDepartments((p.departmentIds || []).length === 0)
        setEPurposeDepartmentIds([...(p.departmentIds || [])])
        setEPurposeEnabled(isEnabledFlag(p.enabled))
        setEPurposeSortOrder(Number.isFinite(Number(p.sortOrder)) ? Number(p.sortOrder) : 1000)

        setEditPurposeOpen(true)
    }

    function purposeScopeBadges(scopes: string[]) {
        const normalized = uniqueScopes(scopes || [])
        if (!normalized.length) return <Badge variant="secondary">—</Badge>

        return (
            <div className="flex flex-wrap gap-1">
                {normalized.map((s) => (
                    <Badge key={s} variant="outline">
                        {s}
                    </Badge>
                ))}
            </div>
        )
    }

    function purposeDepartmentText(p: TransactionPurpose) {
        const ids = p.departmentIds || []
        if (!ids.length) {
            return <Badge variant="secondary">All departments</Badge>
        }

        const names = ids.map((id) => deptById.get(id)?.name || id)
        const preview = names.slice(0, 2).join(", ")

        return (
            <div className="min-w-0">
                <span className="truncate text-sm text-muted-foreground" title={names.join(", ")}>
                    {preview}
                    {names.length > 2 ? ` +${names.length - 2}` : ""}
                </span>
            </div>
        )
    }

    function toggleScope(
        state: TransactionScope[],
        setter: React.Dispatch<React.SetStateAction<TransactionScope[]>>,
        scope: TransactionScope,
        checked: boolean
    ) {
        if (checked) {
            if (state.includes(scope)) return
            setter([...state, scope])
            return
        }
        setter(state.filter((s) => s !== scope))
    }

    function toggleDepartmentId(
        state: string[],
        setter: React.Dispatch<React.SetStateAction<string[]>>,
        deptId: string,
        checked: boolean
    ) {
        if (checked) {
            if (state.includes(deptId)) return
            setter([...state, deptId])
            return
        }
        setter(state.filter((id) => id !== deptId))
    }

    async function handleCreateDept() {
        const name = cDeptName.trim()
        const code = cDeptCode.trim()
        const transactionManager = normalizeManagerKey(cDeptManager, "REGISTRAR")

        if (!name) return toast.error("Department name is required.")

        setSaving(true)
        try {
            await adminApi.createDepartment({
                name,
                code: code || undefined,
                transactionManager,
            })
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
        const transactionManager = normalizeManagerKey(eDeptManager, "REGISTRAR")
        if (!name) return toast.error("Department name is required.")

        setSaving(true)
        try {
            await adminApi.updateDepartment(id, {
                name,
                code: code || undefined,
                transactionManager,
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

    async function handleCreatePurpose() {
        const category = normalizeManagerKey(cPurposeCategory, "REGISTRAR")
        const key = cPurposeKey.trim()
        const label = cPurposeLabel.trim()
        const scopes = uniqueScopes(cPurposeScopes)
        const sortOrder = Number(cPurposeSortOrder)

        if (!key) return toast.error("Purpose key is required.")
        if (!label) return toast.error("Purpose label is required.")
        if (!scopes.length) return toast.error("Select at least one scope.")
        if (!cPurposeApplyAllDepartments && cPurposeDepartmentIds.length === 0) {
            return toast.error("Select at least one department or apply to all.")
        }
        if (!Number.isFinite(sortOrder)) return toast.error("Sort order must be a valid number.")

        setSaving(true)
        try {
            await adminApi.createTransactionPurpose({
                category,
                key,
                label,
                scopes,
                enabled: cPurposeEnabled,
                sortOrder,
                applyToAllDepartments: cPurposeApplyAllDepartments,
                departmentIds: cPurposeApplyAllDepartments ? [] : cPurposeDepartmentIds,
            })
            toast.success("Transaction purpose created.")
            setCreatePurposeOpen(false)
            resetCreatePurposeForm()
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to create transaction purpose."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    async function handleSavePurpose() {
        if (!selectedPurpose?.id) return toast.error("Invalid transaction purpose.")

        const category = normalizeManagerKey(ePurposeCategory, "REGISTRAR")
        const key = ePurposeKey.trim()
        const label = ePurposeLabel.trim()
        const scopes = uniqueScopes(ePurposeScopes)
        const sortOrder = Number(ePurposeSortOrder)

        if (!key) return toast.error("Purpose key is required.")
        if (!label) return toast.error("Purpose label is required.")
        if (!scopes.length) return toast.error("Select at least one scope.")
        if (!ePurposeApplyAllDepartments && ePurposeDepartmentIds.length === 0) {
            return toast.error("Select at least one department or apply to all.")
        }
        if (!Number.isFinite(sortOrder)) return toast.error("Sort order must be a valid number.")

        setSaving(true)
        try {
            await adminApi.updateTransactionPurpose(selectedPurpose.id, {
                category,
                key,
                label,
                scopes,
                enabled: ePurposeEnabled,
                sortOrder,
                applyToAllDepartments: ePurposeApplyAllDepartments,
                departmentIds: ePurposeApplyAllDepartments ? [] : ePurposeDepartmentIds,
            })
            toast.success("Transaction purpose updated.")
            setEditPurposeOpen(false)
            setSelectedPurpose(null)
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to update transaction purpose."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    async function handleDeletePurpose() {
        if (!selectedPurpose?.id) return toast.error("Invalid transaction purpose.")

        setSaving(true)
        try {
            await adminApi.deleteTransactionPurpose(selectedPurpose.id)
            toast.success("Transaction purpose deleted.")
            setDeletePurposeOpen(false)
            setSelectedPurpose(null)
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to delete transaction purpose."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    const stats = React.useMemo(() => {
        const deptTotal = departments.length
        const deptEnabled = departments.filter((d) => isEnabledFlag(d.enabled)).length
        const winTotal = windows.length

        const purposeTotal = purposes.length
        const purposeEnabled = purposes.filter((p) => isEnabledFlag(p.enabled)).length

        return {
            deptTotal,
            deptEnabled,
            deptDisabled: deptTotal - deptEnabled,
            winTotal,
            purposeTotal,
            purposeEnabled,
            purposeDisabled: purposeTotal - purposeEnabled,
        }
    }, [departments, windows, purposes])

    return (
        <DashboardLayout
            title="Departments"
            navItems={ADMIN_NAV_ITEMS}
            user={dashboardUser}
            activePath={location.pathname}
        >
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:w-105">
                        <TabsTrigger value="departments" className="gap-2">
                            <Building2 className="h-4 w-4" />
                            Departments
                        </TabsTrigger>
                        <TabsTrigger value="purposes" className="gap-2">
                            <ClipboardList className="h-4 w-4" />
                            Transaction purposes
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="departments" className="mt-4">
                        <Card className="min-w-0">
                            <CardHeader className="gap-2">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0">
                                        <CardTitle>Department Management</CardTitle>
                                        <CardDescription>
                                            Create departments and assign a top-level transaction manager
                                            (Registrar, Library, Admin Building, or any custom manager).
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
                                        <FolderTree className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground">Manager hierarchy enabled</span>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="min-w-0">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center">
                                        <Input
                                            value={deptQ}
                                            onChange={(e) => setDeptQ(e.target.value)}
                                            placeholder="Search departments…"
                                            className="w-full min-w-0 md:w-80"
                                        />

                                        <Select value={deptManagerFilter} onValueChange={setDeptManagerFilter}>
                                            <SelectTrigger className="w-full min-w-0 md:w-80">
                                                <SelectValue placeholder="Filter by manager" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All managers</SelectItem>
                                                {managerOptions.map((m) => (
                                                    <SelectItem key={m} value={m}>
                                                        {prettyManager(m)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Tabs
                                        value={deptStatusTab}
                                        onValueChange={(v) => setDeptStatusTab(v as any)}
                                        className="w-full md:w-auto"
                                    >
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
                                        <div className="overflow-x-auto rounded-lg border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Name</TableHead>
                                                        <TableHead className="hidden md:table-cell">Code</TableHead>
                                                        <TableHead className="hidden lg:table-cell">Manager</TableHead>
                                                        <TableHead className="hidden lg:table-cell">Windows</TableHead>
                                                        <TableHead className="text-right">Status</TableHead>
                                                        <TableHead className="w-14" />
                                                    </TableRow>
                                                </TableHeader>

                                                <TableBody>
                                                    {deptRows.map((d) => {
                                                        const winCount = (windowsByDept.get(d._id) ?? []).length
                                                        const manager = normalizeManagerKey(d.transactionManager || "REGISTRAR")

                                                        return (
                                                            <TableRow key={d._id}>
                                                                <TableCell className="font-medium">
                                                                    <div className="flex min-w-0 flex-col">
                                                                        <span className="truncate">{d.name}</span>
                                                                        <span className="truncate text-xs text-muted-foreground md:hidden">
                                                                            {d.code || "—"} · {prettyManager(manager)}
                                                                        </span>
                                                                    </div>
                                                                </TableCell>

                                                                <TableCell className="hidden md:table-cell">
                                                                    <span className="text-muted-foreground">{d.code || "—"}</span>
                                                                </TableCell>

                                                                <TableCell className="hidden lg:table-cell">
                                                                    <Badge variant="outline">{prettyManager(manager)}</Badge>
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
                                                            <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
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
                    </TabsContent>

                    <TabsContent value="purposes" className="mt-4">
                        <Card className="min-w-0">
                            <CardHeader className="gap-2">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0">
                                        <CardTitle>Transaction Purpose Management</CardTitle>
                                        <CardDescription>
                                            CRUD for queue transaction purposes per manager category and per department.
                                            Use this for Registrar, Library, Admin Building, and custom offices.
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
                                                resetCreatePurposeForm()
                                                setCreatePurposeOpen(true)
                                            }}
                                            disabled={saving}
                                            className="w-full gap-2 sm:w-auto"
                                        >
                                            <Plus className="h-4 w-4" />
                                            New purpose
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
                                        <Badge variant="secondary">Purposes: {stats.purposeTotal}</Badge>
                                        <Badge variant="default">Enabled: {stats.purposeEnabled}</Badge>
                                        <Badge variant="secondary">Disabled: {stats.purposeDisabled}</Badge>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground">Department-aware transactions</span>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="min-w-0">
                                <div className="flex flex-col gap-3">
                                    <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center">
                                        <Input
                                            value={purposeQ}
                                            onChange={(e) => setPurposeQ(e.target.value)}
                                            placeholder="Search purpose key / label…"
                                            className="w-full min-w-0 md:w-80"
                                        />

                                        <Select value={purposeManagerFilter} onValueChange={setPurposeManagerFilter}>
                                            <SelectTrigger className="w-full min-w-0 md:w-64">
                                                <SelectValue placeholder="Filter by manager" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All managers</SelectItem>
                                                {managerOptions.map((m) => (
                                                    <SelectItem key={m} value={m}>
                                                        {prettyManager(m)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <Select value={purposeScopeFilter} onValueChange={setPurposeScopeFilter}>
                                            <SelectTrigger className="w-full min-w-0 md:w-56">
                                                <SelectValue placeholder="Filter by scope" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All scopes</SelectItem>
                                                <SelectItem value="INTERNAL">Internal</SelectItem>
                                                <SelectItem value="EXTERNAL">External</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        <Select value={purposeDeptFilter} onValueChange={setPurposeDeptFilter}>
                                            <SelectTrigger className="w-full min-w-0 md:w-72">
                                                <SelectValue placeholder="Filter by department" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All department bindings</SelectItem>
                                                <SelectItem value="__all_departments__">Global (all departments)</SelectItem>
                                                {departments.map((d) => (
                                                    <SelectItem key={d._id} value={d._id}>
                                                        {d.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Tabs
                                        value={purposeStatusTab}
                                        onValueChange={(v) => setPurposeStatusTab(v as any)}
                                        className="w-full md:w-auto"
                                    >
                                        <TabsList className="grid w-full grid-cols-3 md:w-80">
                                            <TabsTrigger value="all">All</TabsTrigger>
                                            <TabsTrigger value="enabled">Enabled</TabsTrigger>
                                            <TabsTrigger value="disabled">Disabled</TabsTrigger>
                                        </TabsList>
                                        <TabsContent value={purposeStatusTab} />
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
                                        <div className="overflow-x-auto rounded-lg border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Purpose</TableHead>
                                                        <TableHead className="hidden md:table-cell">Manager</TableHead>
                                                        <TableHead className="hidden lg:table-cell">Scope</TableHead>
                                                        <TableHead className="hidden lg:table-cell">Department binding</TableHead>
                                                        <TableHead className="text-right">Status</TableHead>
                                                        <TableHead className="w-14" />
                                                    </TableRow>
                                                </TableHeader>

                                                <TableBody>
                                                    {purposeRows.map((p) => {
                                                        const category = normalizeManagerKey(p.category || "REGISTRAR")
                                                        return (
                                                            <TableRow key={p.id}>
                                                                <TableCell className="font-medium">
                                                                    <div className="flex min-w-0 flex-col">
                                                                        <span className="truncate">{p.label}</span>
                                                                        <span className="truncate text-xs text-muted-foreground">
                                                                            {p.key} · sort {p.sortOrder}
                                                                        </span>
                                                                        <span className="truncate text-xs text-muted-foreground md:hidden">
                                                                            {prettyManager(category)}
                                                                        </span>
                                                                    </div>
                                                                </TableCell>

                                                                <TableCell className="hidden md:table-cell">
                                                                    <Badge variant="outline">{prettyManager(category)}</Badge>
                                                                </TableCell>

                                                                <TableCell className="hidden lg:table-cell">
                                                                    {purposeScopeBadges(p.scopes || [])}
                                                                </TableCell>

                                                                <TableCell className="hidden lg:table-cell">
                                                                    {purposeDepartmentText(p)}
                                                                </TableCell>

                                                                <TableCell className="text-right">{statusBadge(p.enabled)}</TableCell>

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
                                                                                onClick={() => openEditPurpose(p)}
                                                                                className="cursor-pointer"
                                                                            >
                                                                                Edit purpose
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem
                                                                                onClick={() => {
                                                                                    setSelectedPurpose(p)
                                                                                    setDeletePurposeOpen(true)
                                                                                }}
                                                                                className="cursor-pointer text-destructive focus:text-destructive"
                                                                            >
                                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                                Delete purpose
                                                                            </DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })}

                                                    {purposeRows.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                                                                No transaction purposes match your filters.
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
                    </TabsContent>
                </Tabs>
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
                                placeholder="e.g., College of Computing Studies"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="c-dept-code">Code (optional)</Label>
                            <Input
                                id="c-dept-code"
                                value={cDeptCode}
                                onChange={(e) => setCDeptCode(e.target.value)}
                                placeholder="e.g., CCS"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="c-dept-manager">Transaction manager</Label>
                            <Input
                                id="c-dept-manager"
                                value={cDeptManager}
                                onChange={(e) => setCDeptManager(e.target.value)}
                                placeholder="e.g., REGISTRAR"
                            />
                            <div className="flex flex-wrap gap-2">
                                {managerOptions.slice(0, 6).map((m) => (
                                    <Button
                                        key={`c-dept-manager-${m}`}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCDeptManager(m)}
                                    >
                                        {prettyManager(m)}
                                    </Button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                This is the office above departments that manages their transaction catalog.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setCreateDeptOpen(false)
                                resetCreateDeptForm()
                            }}
                            disabled={saving}
                            className="w-full sm:mr-2 sm:w-auto"
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

                        <div className="grid gap-2">
                            <Label htmlFor="e-dept-manager">Transaction manager</Label>
                            <Input
                                id="e-dept-manager"
                                value={eDeptManager}
                                onChange={(e) => setEDeptManager(e.target.value)}
                                placeholder="e.g., REGISTRAR"
                            />
                            <div className="flex flex-wrap gap-2">
                                {managerOptions.slice(0, 6).map((m) => (
                                    <Button
                                        key={`e-dept-manager-${m}`}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setEDeptManager(m)}
                                    >
                                        {prettyManager(m)}
                                    </Button>
                                ))}
                            </div>
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

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setEditDeptOpen(false)
                                setSelectedDept(null)
                            }}
                            disabled={saving}
                            className="w-full sm:mr-2 sm:w-auto"
                        >
                            Cancel
                        </Button>

                        <Button type="button" onClick={() => void handleSaveDept()} disabled={saving} className="w-full sm:w-auto">
                            {saving ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Purpose */}
            <Dialog open={createPurposeOpen} onOpenChange={setCreatePurposeOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Create transaction purpose</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="grid gap-2 md:grid-cols-2 md:gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="c-purpose-category">Manager category</Label>
                                <Input
                                    id="c-purpose-category"
                                    value={cPurposeCategory}
                                    onChange={(e) => setCPurposeCategory(e.target.value)}
                                    placeholder="e.g., REGISTRAR"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="c-purpose-key">Key</Label>
                                <Input
                                    id="c-purpose-key"
                                    value={cPurposeKey}
                                    onChange={(e) => setCPurposeKey(e.target.value)}
                                    placeholder="e.g., issuance-tor"
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="c-purpose-label">Label</Label>
                            <Input
                                id="c-purpose-label"
                                value={cPurposeLabel}
                                onChange={(e) => setCPurposeLabel(e.target.value)}
                                placeholder="e.g., Issuance of Transcript of Records (TOR)"
                            />
                        </div>

                        <div className="grid gap-2 md:grid-cols-2 md:gap-4">
                            <div className="grid gap-2">
                                <Label>Scopes</Label>
                                <div className="flex flex-wrap gap-4 rounded-lg border p-3">
                                    <label className="flex items-center gap-2">
                                        <Checkbox
                                            checked={cPurposeScopes.includes("INTERNAL")}
                                            onCheckedChange={(checked) =>
                                                toggleScope(
                                                    cPurposeScopes,
                                                    setCPurposeScopes,
                                                    "INTERNAL",
                                                    checked === true
                                                )
                                            }
                                        />
                                        <span className="text-sm">Internal</span>
                                    </label>

                                    <label className="flex items-center gap-2">
                                        <Checkbox
                                            checked={cPurposeScopes.includes("EXTERNAL")}
                                            onCheckedChange={(checked) =>
                                                toggleScope(
                                                    cPurposeScopes,
                                                    setCPurposeScopes,
                                                    "EXTERNAL",
                                                    checked === true
                                                )
                                            }
                                        />
                                        <span className="text-sm">External</span>
                                    </label>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="c-purpose-sort-order">Sort order</Label>
                                <Input
                                    id="c-purpose-sort-order"
                                    type="number"
                                    value={String(cPurposeSortOrder)}
                                    onChange={(e) => setCPurposeSortOrder(safeInt(e.target.value, 1000))}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="grid gap-0.5">
                                <div className="text-sm font-medium">Apply to all departments</div>
                                <div className="text-xs text-muted-foreground">
                                    Turn off to bind this purpose to selected departments only.
                                </div>
                            </div>
                            <Switch checked={cPurposeApplyAllDepartments} onCheckedChange={setCPurposeApplyAllDepartments} />
                        </div>

                        {!cPurposeApplyAllDepartments ? (
                            <div className="grid gap-2">
                                <Label>Departments</Label>
                                <div className="max-h-48 overflow-y-auto rounded-lg border p-2">
                                    {enabledDepartments.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No enabled departments found.</p>
                                    ) : (
                                        <div className="grid gap-1">
                                            {enabledDepartments.map((d) => (
                                                <label key={`c-purpose-dept-${d._id}`} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50">
                                                    <Checkbox
                                                        checked={cPurposeDepartmentIds.includes(d._id)}
                                                        onCheckedChange={(checked) =>
                                                            toggleDepartmentId(
                                                                cPurposeDepartmentIds,
                                                                setCPurposeDepartmentIds,
                                                                d._id,
                                                                checked === true
                                                            )
                                                        }
                                                    />
                                                    <span className="text-sm">{d.name}</span>
                                                    <span className="text-xs text-muted-foreground">{d.code ? `(${d.code})` : ""}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="grid gap-0.5">
                                <div className="text-sm font-medium">Enabled</div>
                                <div className="text-xs text-muted-foreground">Disabled purposes are hidden from queue selection.</div>
                            </div>
                            <Switch checked={cPurposeEnabled} onCheckedChange={setCPurposeEnabled} />
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setCreatePurposeOpen(false)
                                resetCreatePurposeForm()
                            }}
                            disabled={saving}
                            className="w-full sm:mr-2 sm:w-auto"
                        >
                            Cancel
                        </Button>

                        <Button type="button" onClick={() => void handleCreatePurpose()} disabled={saving} className="w-full sm:w-auto">
                            {saving ? "Creating…" : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Purpose */}
            <Dialog open={editPurposeOpen} onOpenChange={setEditPurposeOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit transaction purpose</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="grid gap-2 md:grid-cols-2 md:gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="e-purpose-category">Manager category</Label>
                                <Input
                                    id="e-purpose-category"
                                    value={ePurposeCategory}
                                    onChange={(e) => setEPurposeCategory(e.target.value)}
                                    placeholder="e.g., LIBRARY"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="e-purpose-key">Key</Label>
                                <Input
                                    id="e-purpose-key"
                                    value={ePurposeKey}
                                    onChange={(e) => setEPurposeKey(e.target.value)}
                                    placeholder="e.g., issuance-library-clearance"
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="e-purpose-label">Label</Label>
                            <Input
                                id="e-purpose-label"
                                value={ePurposeLabel}
                                onChange={(e) => setEPurposeLabel(e.target.value)}
                            />
                        </div>

                        <div className="grid gap-2 md:grid-cols-2 md:gap-4">
                            <div className="grid gap-2">
                                <Label>Scopes</Label>
                                <div className="flex flex-wrap gap-4 rounded-lg border p-3">
                                    <label className="flex items-center gap-2">
                                        <Checkbox
                                            checked={ePurposeScopes.includes("INTERNAL")}
                                            onCheckedChange={(checked) =>
                                                toggleScope(
                                                    ePurposeScopes,
                                                    setEPurposeScopes,
                                                    "INTERNAL",
                                                    checked === true
                                                )
                                            }
                                        />
                                        <span className="text-sm">Internal</span>
                                    </label>

                                    <label className="flex items-center gap-2">
                                        <Checkbox
                                            checked={ePurposeScopes.includes("EXTERNAL")}
                                            onCheckedChange={(checked) =>
                                                toggleScope(
                                                    ePurposeScopes,
                                                    setEPurposeScopes,
                                                    "EXTERNAL",
                                                    checked === true
                                                )
                                            }
                                        />
                                        <span className="text-sm">External</span>
                                    </label>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="e-purpose-sort-order">Sort order</Label>
                                <Input
                                    id="e-purpose-sort-order"
                                    type="number"
                                    value={String(ePurposeSortOrder)}
                                    onChange={(e) => setEPurposeSortOrder(safeInt(e.target.value, 1000))}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="grid gap-0.5">
                                <div className="text-sm font-medium">Apply to all departments</div>
                                <div className="text-xs text-muted-foreground">
                                    Turn off to bind this purpose to selected departments only.
                                </div>
                            </div>
                            <Switch checked={ePurposeApplyAllDepartments} onCheckedChange={setEPurposeApplyAllDepartments} />
                        </div>

                        {!ePurposeApplyAllDepartments ? (
                            <div className="grid gap-2">
                                <Label>Departments</Label>
                                <div className="max-h-48 overflow-y-auto rounded-lg border p-2">
                                    {enabledDepartments.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No enabled departments found.</p>
                                    ) : (
                                        <div className="grid gap-1">
                                            {enabledDepartments.map((d) => (
                                                <label key={`e-purpose-dept-${d._id}`} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50">
                                                    <Checkbox
                                                        checked={ePurposeDepartmentIds.includes(d._id)}
                                                        onCheckedChange={(checked) =>
                                                            toggleDepartmentId(
                                                                ePurposeDepartmentIds,
                                                                setEPurposeDepartmentIds,
                                                                d._id,
                                                                checked === true
                                                            )
                                                        }
                                                    />
                                                    <span className="text-sm">{d.name}</span>
                                                    <span className="text-xs text-muted-foreground">{d.code ? `(${d.code})` : ""}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="grid gap-0.5">
                                <div className="text-sm font-medium">Enabled</div>
                                <div className="text-xs text-muted-foreground">Disabled purposes are hidden from queue selection.</div>
                            </div>
                            <Switch checked={ePurposeEnabled} onCheckedChange={setEPurposeEnabled} />
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setEditPurposeOpen(false)
                                setSelectedPurpose(null)
                            }}
                            disabled={saving}
                            className="w-full sm:mr-2 sm:w-auto"
                        >
                            Cancel
                        </Button>

                        <Button type="button" onClick={() => void handleSavePurpose()} disabled={saving} className="w-full sm:w-auto">
                            {saving ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Purpose */}
            <AlertDialog open={deletePurposeOpen} onOpenChange={setDeletePurposeOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete transaction purpose?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete{" "}
                            <span className="font-medium">{selectedPurpose?.label || selectedPurpose?.key}</span>.
                            Queue users will no longer be able to select it.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                void handleDeletePurpose()
                            }}
                            disabled={saving}
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
