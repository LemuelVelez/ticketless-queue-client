 
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import {
    MoreHorizontal,
    Plus,
    RefreshCw,
    LayoutGrid,
    Building2,
    UserPlus2,
    UserMinus,
    Trash2,
    Check,
    ChevronsUpDown,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ADMIN_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { adminApi, type Department, type ServiceWindow, type StaffUser } from "@/api/admin"
import { useSession } from "@/hooks/use-session"

import { cn } from "@/lib/utils"

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

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const DEFAULT_MANAGER = "REGISTRAR"

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

function normalizeManagerKey(value: unknown, fallback = DEFAULT_MANAGER) {
    const v = String(value || "")
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

function getStaffId(s: StaffUser) {
    return s._id || s.id || ""
}

function uniqueStringIds(values: Array<string | null | undefined>) {
    const seen = new Set<string>()
    const out: string[] = []

    for (const raw of values) {
        const s = String(raw ?? "").trim()
        if (!s) continue
        if (seen.has(s)) continue
        seen.add(s)
        out.push(s)
    }

    return out
}

function getStaffDepartmentIds(staff: StaffUser): string[] {
    return uniqueStringIds([
        ...(Array.isArray(staff.assignedDepartments) ? staff.assignedDepartments : []),
        staff.assignedDepartment ?? "",
    ])
}

function getWindowDepartmentIds(win?: ServiceWindow | null): string[] {
    if (!win) return []
    return uniqueStringIds([
        ...(Array.isArray(win.departmentIds) ? win.departmentIds : []),
        win.department ?? "",
    ])
}

function departmentLabelList(ids: string[], deptById: Map<string, Department>) {
    return ids.map((id) => deptById.get(id)?.name || id)
}

type DepartmentMultiSelectProps = {
    value: string[]
    onChange: (next: string[]) => void
    options: Department[]
    placeholder?: string
    disabled?: boolean
}

function DepartmentMultiSelect({
    value,
    onChange,
    options,
    placeholder = "Select departments",
    disabled,
}: DepartmentMultiSelectProps) {
    const [open, setOpen] = React.useState(false)

    const selectedNames = React.useMemo(() => {
        const selectedSet = new Set(value)
        return options.filter((d) => selectedSet.has(d._id)).map((d) => d.name)
    }, [value, options])

    const buttonText = React.useMemo(() => {
        if (selectedNames.length === 0) return placeholder
        if (selectedNames.length <= 2) return selectedNames.join(", ")
        return `${selectedNames.slice(0, 2).join(", ")} +${selectedNames.length - 2}`
    }, [selectedNames, placeholder])

    function toggle(id: string) {
        if (value.includes(id)) {
            onChange(value.filter((v) => v !== id))
            return
        }
        onChange([...value, id])
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between" disabled={disabled}>
                    <span className="truncate text-left">{buttonText}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search department..." />
                    <CommandList>
                        <CommandEmpty>No department found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((d) => {
                                const checked = value.includes(d._id)
                                return (
                                    <CommandItem
                                        key={d._id}
                                        value={`${d.name} ${d.code ?? ""}`}
                                        onSelect={() => toggle(d._id)}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                                        <span className="truncate">{d.name}</span>
                                        {d.code ? <span className="ml-1 text-xs text-muted-foreground">({d.code})</span> : null}
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
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

    const [mainTab, setMainTab] = React.useState<"windows" | "departments">("windows")

    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)

    const [departments, setDepartments] = React.useState<Department[]>([])
    const [windows, setWindows] = React.useState<ServiceWindow[]>([])
    const [staffUsers, setStaffUsers] = React.useState<StaffUser[]>([])

    // window filters
    const [winQ, setWinQ] = React.useState("")
    const [winStatusTab, setWinStatusTab] = React.useState<"all" | "enabled" | "disabled">("all")
    const [winDeptFilter, setWinDeptFilter] = React.useState<string>("all")

    // department filters
    const [deptQ, setDeptQ] = React.useState("")
    const [deptStatusTab, setDeptStatusTab] = React.useState<"all" | "enabled" | "disabled">("all")
    const [deptManagerFilter, setDeptManagerFilter] = React.useState<string>("all")

    // window dialogs
    const [createWinOpen, setCreateWinOpen] = React.useState(false)
    const [editWinOpen, setEditWinOpen] = React.useState(false)
    const [deleteWinOpen, setDeleteWinOpen] = React.useState(false)
    const [assignStaffOpen, setAssignStaffOpen] = React.useState(false)

    // department dialogs
    const [createDeptOpen, setCreateDeptOpen] = React.useState(false)
    const [editDeptOpen, setEditDeptOpen] = React.useState(false)
    const [deleteDeptOpen, setDeleteDeptOpen] = React.useState(false)

    // selected
    const [selectedWin, setSelectedWin] = React.useState<ServiceWindow | null>(null)
    const [assignTargetWin, setAssignTargetWin] = React.useState<ServiceWindow | null>(null)
    const [selectedDept, setSelectedDept] = React.useState<Department | null>(null)

    // create window form
    const [cWinDepartmentIds, setCWinDepartmentIds] = React.useState<string[]>([])
    const [cWinName, setCWinName] = React.useState("")
    const [cWinNumber, setCWinNumber] = React.useState<number>(1)

    // edit window form
    const [eWinDepartmentIds, setEWinDepartmentIds] = React.useState<string[]>([])
    const [eWinName, setEWinName] = React.useState("")
    const [eWinNumber, setEWinNumber] = React.useState<number>(1)
    const [eWinEnabled, setEWinEnabled] = React.useState(true)

    // assign staff form
    const [aStaffId, setAStaffId] = React.useState<string>("none")

    // create department form
    const [cDeptName, setCDeptName] = React.useState("")
    const [cDeptCode, setCDeptCode] = React.useState("")
    const [cDeptManager, setCDeptManager] = React.useState(DEFAULT_MANAGER)

    // edit department form
    const [eDeptName, setEDeptName] = React.useState("")
    const [eDeptCode, setEDeptCode] = React.useState("")
    const [eDeptManager, setEDeptManager] = React.useState(DEFAULT_MANAGER)
    const [eDeptEnabled, setEDeptEnabled] = React.useState(true)

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

    const windowsByDept = React.useMemo(() => {
        const m = new Map<string, ServiceWindow[]>()

        for (const w of windows) {
            const deptIds = getWindowDepartmentIds(w)
            for (const depId of deptIds) {
                const arr = m.get(depId) ?? []
                arr.push(w)
                m.set(depId, arr)
            }
        }

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

    const enabledDepartments = React.useMemo(
        () =>
            departments
                .filter((d) => isEnabledFlag(d.enabled))
                .sort((a, b) => a.name.localeCompare(b.name)),
        [departments]
    )

    const managerOptions = React.useMemo(() => {
        const values = new Set<string>()

        for (const d of departments) {
            const m = normalizeManagerKey(d.transactionManager || DEFAULT_MANAGER, "")
            if (m) values.add(m)
        }

        const liveInputs = [cDeptManager, eDeptManager, deptManagerFilter !== "all" ? deptManagerFilter : ""]
        for (const raw of liveInputs) {
            const m = normalizeManagerKey(raw, "")
            if (m) values.add(m)
        }

        if (values.size === 0) values.add(DEFAULT_MANAGER)

        return Array.from(values).sort((a, b) => a.localeCompare(b))
    }, [departments, cDeptManager, eDeptManager, deptManagerFilter])

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
            const msg = e instanceof Error ? e.message : "Failed to load admin data."
            toast.error(msg)
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void fetchAll()
    }, [fetchAll])

    function resetCreateWinForm() {
        setCWinDepartmentIds([])
        setCWinName("")
        setCWinNumber(1)
    }

    function resetCreateDeptForm() {
        setCDeptName("")
        setCDeptCode("")
        setCDeptManager(DEFAULT_MANAGER)
    }

    const winRows = React.useMemo(() => {
        const q = winQ.trim().toLowerCase()

        return (windows ?? [])
            .filter((w) => {
                const enabled = isEnabledFlag(w.enabled)
                if (winStatusTab === "enabled" && !enabled) return false
                if (winStatusTab === "disabled" && enabled) return false

                const departmentIds = getWindowDepartmentIds(w)
                if (winDeptFilter !== "all" && !departmentIds.includes(winDeptFilter)) return false

                if (!q) return true

                const deptNames = departmentLabelList(departmentIds, deptById).join(" ")
                const hay = `${w.name ?? ""} ${w.number ?? ""} ${deptNames}`.toLowerCase()
                return hay.includes(q)
            })
            .sort((a, b) => {
                const ae = isEnabledFlag(a.enabled)
                const be = isEnabledFlag(b.enabled)
                if (ae !== be) return ae ? -1 : 1

                const deptA = departmentLabelList(getWindowDepartmentIds(a), deptById).join(" | ")
                const deptB = departmentLabelList(getWindowDepartmentIds(b), deptById).join(" | ")
                if (deptA !== deptB) return deptA.localeCompare(deptB)

                return (a.number ?? 0) - (b.number ?? 0)
            })
    }, [windows, winQ, winStatusTab, winDeptFilter, deptById])

    const deptRows = React.useMemo(() => {
        const q = deptQ.trim().toLowerCase()

        return (departments ?? [])
            .filter((d) => {
                const enabled = isEnabledFlag(d.enabled)
                if (deptStatusTab === "enabled" && !enabled) return false
                if (deptStatusTab === "disabled" && enabled) return false

                const manager = normalizeManagerKey(d.transactionManager || DEFAULT_MANAGER)
                if (deptManagerFilter !== "all" && manager !== deptManagerFilter) return false

                if (!q) return true
                const hay = `${d.name ?? ""} ${d.code ?? ""} ${manager}`.toLowerCase()
                return hay.includes(q)
            })
            .sort((a, b) => {
                const ae = isEnabledFlag(a.enabled)
                const be = isEnabledFlag(b.enabled)
                if (ae !== be) return ae ? -1 : 1

                const am = normalizeManagerKey(a.transactionManager || DEFAULT_MANAGER)
                const bm = normalizeManagerKey(b.transactionManager || DEFAULT_MANAGER)
                if (am !== bm) return am.localeCompare(bm)

                return (a.name ?? "").localeCompare(b.name ?? "")
            })
    }, [departments, deptQ, deptStatusTab, deptManagerFilter])

    function openEditWin(w: ServiceWindow) {
        setSelectedWin(w)
        setEWinDepartmentIds(getWindowDepartmentIds(w))
        setEWinName(w.name ?? "")
        setEWinNumber(Number(w.number ?? 1))
        setEWinEnabled(isEnabledFlag(w.enabled))
        setEditWinOpen(true)
    }

    function openDeleteWin(w: ServiceWindow) {
        setSelectedWin(w)
        setDeleteWinOpen(true)
    }

    function openAssignStaff(w: ServiceWindow) {
        setAssignTargetWin(w)
        setAStaffId("none")
        setAssignStaffOpen(true)
    }

    function openEditDept(d: Department) {
        setSelectedDept(d)
        setEDeptName(d.name ?? "")
        setEDeptCode(d.code ?? "")
        setEDeptManager(normalizeManagerKey(d.transactionManager || DEFAULT_MANAGER))
        setEDeptEnabled(isEnabledFlag(d.enabled))
        setEditDeptOpen(true)
    }

    function openDeleteDept(d: Department) {
        setSelectedDept(d)
        setDeleteDeptOpen(true)
    }

    async function handleCreateWin() {
        const departmentIds = uniqueStringIds(cWinDepartmentIds)
        const name = cWinName.trim()
        const number = Number(cWinNumber)

        if (departmentIds.length === 0) return toast.error("Select at least one department.")
        if (!name) return toast.error("Window name is required.")
        if (!Number.isFinite(number) || number <= 0) return toast.error("Window number must be a positive integer.")

        setSaving(true)
        try {
            await adminApi.createWindow({ departmentIds, name, number })
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

        const departmentIds = uniqueStringIds(eWinDepartmentIds)
        const name = eWinName.trim()
        const number = Number(eWinNumber)

        if (departmentIds.length === 0) return toast.error("Select at least one department.")
        if (!name) return toast.error("Window name is required.")
        if (!Number.isFinite(number) || number <= 0) return toast.error("Window number must be a positive integer.")

        setSaving(true)
        try {
            await adminApi.updateWindow(id, { name, number, enabled: eWinEnabled, departmentIds })
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

    async function handleDeleteWin() {
        if (!selectedWin?._id) return toast.error("Invalid window id.")

        setSaving(true)
        try {
            await adminApi.deleteWindow(selectedWin._id)
            toast.success("Window deleted.")
            setDeleteWinOpen(false)
            setSelectedWin(null)
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to delete window."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    async function handleAssignStaffToWindow() {
        if (!assignTargetWin) return toast.error("Please select a window.")
        if (!assignTargetWin._id) return toast.error("Invalid window id.")
        if (!aStaffId || aStaffId === "none") return toast.error("Please select a staff account.")

        const picked = assignableStaff.find((s) => getStaffId(s) === aStaffId)
        if (!picked) return toast.error("Selected staff was not found.")

        const windowDepartmentIds = getWindowDepartmentIds(assignTargetWin)
        if (windowDepartmentIds.length === 0) return toast.error("Window must have at least one department.")

        setSaving(true)
        try {
            const movedFromWindowId = picked.assignedWindow || null

            // Keep one staff on this window.
            const currentlyAssignedHere = (staffAssignedByWindow.get(assignTargetWin._id) ?? []).filter(
                (s) => getStaffId(s) && getStaffId(s) !== aStaffId
            )

            for (const staff of currentlyAssignedHere) {
                const sid = getStaffId(staff)
                if (!sid) continue
                const keepDepartments = getStaffDepartmentIds(staff)
                await adminApi.updateStaff(sid, {
                    departmentIds: keepDepartments.length > 0 ? keepDepartments : windowDepartmentIds,
                    windowId: null,
                })
            }

            // Keep existing staff departments + include all departments bound to this window.
            const nextDepartmentIds = uniqueStringIds([
                ...getStaffDepartmentIds(picked),
                ...windowDepartmentIds,
            ])

            await adminApi.updateStaff(aStaffId, {
                departmentIds: nextDepartmentIds,
                windowId: assignTargetWin._id,
            })

            const movedText =
                movedFromWindowId && movedFromWindowId !== assignTargetWin._id
                    ? ` Moved from ${windowById.get(movedFromWindowId)?.name ?? "another window"}.`
                    : ""

            const replacedNames = currentlyAssignedHere
                .map((s) => s.name?.trim() || s.email)
                .filter(Boolean)
                .join(", ")

            const replacedText = replacedNames ? ` Replaced ${replacedNames}.` : ""

            toast.success(
                `Staff assigned to ${assignTargetWin.name} (#${assignTargetWin.number}).${movedText}${replacedText}`
            )

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

        const windowDepartmentIds = getWindowDepartmentIds(assignTargetWin)

        setSaving(true)
        try {
            const existingDepartments = getStaffDepartmentIds(staff)
            const nextDepartmentIds =
                existingDepartments.length > 0 ? existingDepartments : windowDepartmentIds

            await adminApi.updateStaff(staffId, {
                departmentIds: nextDepartmentIds,
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

    async function handleCreateDept() {
        const name = cDeptName.trim()
        const code = cDeptCode.trim()
        const transactionManager = normalizeManagerKey(cDeptManager, DEFAULT_MANAGER)

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
        if (!selectedDept?._id) return toast.error("Invalid department id.")

        const name = eDeptName.trim()
        const code = eDeptCode.trim()
        const transactionManager = normalizeManagerKey(eDeptManager, DEFAULT_MANAGER)

        if (!name) return toast.error("Department name is required.")

        setSaving(true)
        try {
            await adminApi.updateDepartment(selectedDept._id, {
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

    async function handleDeleteDept() {
        if (!selectedDept?._id) return toast.error("Invalid department id.")

        setSaving(true)
        try {
            await adminApi.deleteDepartment(selectedDept._id)
            toast.success("Department deleted.")
            setDeleteDeptOpen(false)
            setSelectedDept(null)
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to delete department."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    const stats = React.useMemo(() => {
        const totalWindows = windows.length
        const enabledWindows = windows.filter((w) => isEnabledFlag(w.enabled)).length
        const withAssignedStaff = windows.filter((w) => (staffAssignedByWindow.get(w._id)?.[0] ? true : false)).length

        const totalDepartments = departments.length
        const enabledDepartmentsCount = departments.filter((d) => isEnabledFlag(d.enabled)).length

        return {
            windows: {
                total: totalWindows,
                enabled: enabledWindows,
                disabled: totalWindows - enabledWindows,
                withAssignedStaff,
            },
            departments: {
                total: totalDepartments,
                enabled: enabledDepartmentsCount,
                disabled: totalDepartments - enabledDepartmentsCount,
            },
        }
    }, [windows, staffAssignedByWindow, departments])

    const assignedStaffForTargetWin = React.useMemo(() => {
        if (!assignTargetWin?._id) return []
        return staffAssignedByWindow.get(assignTargetWin._id) ?? []
    }, [assignTargetWin, staffAssignedByWindow])

    return (
        <DashboardLayout title="Windows" navItems={ADMIN_NAV_ITEMS} user={dashboardUser} activePath={location.pathname}>
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "windows" | "departments")} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:w-105">
                        <TabsTrigger value="windows" className="gap-2">
                            <LayoutGrid className="h-4 w-4" />
                            Windows
                        </TabsTrigger>
                        <TabsTrigger value="departments" className="gap-2">
                            <Building2 className="h-4 w-4" />
                            Departments
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="windows" className="mt-4">
                        <Card className="min-w-0">
                            <CardHeader className="gap-2">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0">
                                        <CardTitle>Window Management</CardTitle>
                                        <CardDescription>
                                            Manage window records, link multiple departments, and keep one staff assignment per window.
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

                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={() => setMainTab("departments")}
                                            className="w-full gap-2 sm:w-auto"
                                        >
                                            <Building2 className="h-4 w-4" />
                                            Manage departments
                                        </Button>
                                    </div>
                                </div>

                                <Separator />

                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="flex flex-wrap items-center gap-2 text-sm">
                                        <Badge variant="secondary">Total: {stats.windows.total}</Badge>
                                        <Badge variant="default">Enabled: {stats.windows.enabled}</Badge>
                                        <Badge variant="secondary">Disabled: {stats.windows.disabled}</Badge>
                                        <Badge variant="secondary">With staff: {stats.windows.withAssignedStaff}</Badge>
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

                                    <Tabs value={winStatusTab} onValueChange={(v) => setWinStatusTab(v as "all" | "enabled" | "disabled")} className="w-full md:w-auto">
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
                                        <div className="overflow-x-auto rounded-lg border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Window</TableHead>
                                                        <TableHead className="hidden md:table-cell">Departments</TableHead>
                                                        <TableHead className="hidden md:table-cell">Staff assigned</TableHead>
                                                        <TableHead className="text-right">Status</TableHead>
                                                        <TableHead className="w-14" />
                                                    </TableRow>
                                                </TableHeader>

                                                <TableBody>
                                                    {winRows.map((w) => {
                                                        const windowDepartmentIds = getWindowDepartmentIds(w)
                                                        const deptNames = departmentLabelList(windowDepartmentIds, deptById)
                                                        const preview = deptNames.slice(0, 2).join(", ")
                                                        const deptText =
                                                            deptNames.length > 2
                                                                ? `${preview} +${deptNames.length - 2}`
                                                                : preview || "—"

                                                        const assignedStaff = staffAssignedByWindow.get(w._id) ?? []
                                                        const assignedPrimary = assignedStaff[0] ?? null
                                                        const extraAssignedCount = Math.max(0, assignedStaff.length - 1)
                                                        const assignedDisplay = assignedPrimary
                                                            ? `${assignedPrimary.name || assignedPrimary.email}`
                                                            : "—"

                                                        return (
                                                            <TableRow key={w._id}>
                                                                <TableCell className="font-medium">
                                                                    <div className="flex min-w-0 flex-col">
                                                                        <span className="truncate">
                                                                            {w.name}{" "}
                                                                            <span className="text-muted-foreground">(#{w.number})</span>
                                                                        </span>
                                                                        <span className="truncate text-xs text-muted-foreground md:hidden" title={deptNames.join(", ")}>
                                                                            {deptText}
                                                                        </span>
                                                                        <span className="truncate text-xs text-muted-foreground md:hidden">
                                                                            Staff: {assignedDisplay}
                                                                            {extraAssignedCount > 0 ? ` (+${extraAssignedCount} extra)` : ""}
                                                                        </span>
                                                                    </div>
                                                                </TableCell>

                                                                <TableCell className="hidden md:table-cell">
                                                                    <div className="min-w-0">
                                                                        {deptNames.length > 0 ? (
                                                                            <p className="truncate text-muted-foreground" title={deptNames.join(", ")}>
                                                                                {deptText}
                                                                            </p>
                                                                        ) : (
                                                                            <span className="text-muted-foreground">—</span>
                                                                        )}
                                                                    </div>
                                                                </TableCell>

                                                                <TableCell className="hidden md:table-cell">
                                                                    {assignedPrimary ? (
                                                                        <div className="min-w-0">
                                                                            <Badge variant="secondary">1</Badge>
                                                                            <p className="mt-1 truncate text-xs text-muted-foreground">
                                                                                {assignedDisplay}
                                                                            </p>
                                                                            {extraAssignedCount > 0 ? (
                                                                                <p className="truncate text-xs text-amber-600">
                                                                                    +{extraAssignedCount} extra assignment{extraAssignedCount > 1 ? "s" : ""}
                                                                                </p>
                                                                            ) : null}
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
                                                                            <DropdownMenuItem
                                                                                onClick={() => openDeleteWin(w)}
                                                                                className="cursor-pointer text-destructive focus:text-destructive"
                                                                            >
                                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                                Delete window
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
                    </TabsContent>

                    <TabsContent value="departments" className="mt-4">
                        <Card className="min-w-0">
                            <CardHeader className="gap-2">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0">
                                        <CardTitle>Department Management</CardTitle>
                                        <CardDescription>
                                            Manage department records and manager keys used by window mappings.
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

                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={() => setMainTab("windows")}
                                            className="w-full gap-2 sm:w-auto"
                                        >
                                            <LayoutGrid className="h-4 w-4" />
                                            Manage windows
                                        </Button>
                                    </div>
                                </div>

                                <Separator />

                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="flex flex-wrap items-center gap-2 text-sm">
                                        <Badge variant="secondary">Total: {stats.departments.total}</Badge>
                                        <Badge variant="default">Enabled: {stats.departments.enabled}</Badge>
                                        <Badge variant="secondary">Disabled: {stats.departments.disabled}</Badge>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground">Departments</span>
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
                                        onValueChange={(v) => setDeptStatusTab(v as "all" | "enabled" | "disabled")}
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
                                                        const manager = normalizeManagerKey(d.transactionManager || DEFAULT_MANAGER)

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

                                                                        <DropdownMenuContent align="end" className="w-52">
                                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem
                                                                                onClick={() => openEditDept(d)}
                                                                                className="cursor-pointer"
                                                                            >
                                                                                Edit department
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem
                                                                                onClick={() => openDeleteDept(d)}
                                                                                className="cursor-pointer text-destructive focus:text-destructive"
                                                                            >
                                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                                Delete department
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
                </Tabs>
            </div>

            {/* Create Window */}
            <Dialog open={createWinOpen} onOpenChange={setCreateWinOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create window</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label>Departments</Label>
                            <DepartmentMultiSelect
                                value={cWinDepartmentIds}
                                onChange={setCWinDepartmentIds}
                                options={enabledDepartments}
                                placeholder="Select departments"
                                disabled={saving}
                            />
                            <p className="text-xs text-muted-foreground">Choose one or more enabled departments.</p>
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
                            className="w-full sm:mr-2 sm:w-auto"
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
                            <Label>Departments</Label>
                            <DepartmentMultiSelect
                                value={eWinDepartmentIds}
                                onChange={setEWinDepartmentIds}
                                options={enabledDepartments}
                                placeholder="Select departments"
                                disabled={saving}
                            />
                            <p className="text-xs text-muted-foreground">
                                One window can include multiple departments.
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
                                    Disabled windows are hidden in normal assignment flow.
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
                                setEWinDepartmentIds([])
                            }}
                            disabled={saving}
                            className="w-full sm:mr-2 sm:w-auto"
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
                                    <span className="text-muted-foreground">(#{assignTargetWin.number})</span>
                                ) : null}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                                Departments:{" "}
                                {assignTargetWin
                                    ? (departmentLabelList(getWindowDepartmentIds(assignTargetWin), deptById).join(", ") || "—")
                                    : "—"}
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
                                Staff can only be in one window at a time. Department assignments are kept and merged with this window’s departments.
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
                            {assignedStaffForTargetWin.length > 1 ? (
                                <p className="text-xs text-amber-600">
                                    More than one staff is currently attached. Assigning again will keep only one.
                                </p>
                            ) : null}
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
                            className="w-full sm:mr-2 sm:w-auto"
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

            {/* Delete Window */}
            <AlertDialog open={deleteWinOpen} onOpenChange={setDeleteWinOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete window?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete{" "}
                            <span className="font-medium">
                                {selectedWin?.name ? `${selectedWin.name} (#${selectedWin.number})` : "this window"}
                            </span>.
                            <br />
                            <br />
                            A window can only be deleted if no staff account is currently assigned to it.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel
                            disabled={saving}
                            onClick={() => {
                                setDeleteWinOpen(false)
                                setSelectedWin(null)
                            }}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                void handleDeleteWin()
                            }}
                            disabled={saving}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            {saving ? "Deleting…" : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
                                    Disabled departments are excluded from new window mapping selection.
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

            {/* Delete Department */}
            <AlertDialog open={deleteDeptOpen} onOpenChange={setDeleteDeptOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete department?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete{" "}
                            <span className="font-medium">{selectedDept?.name || "this department"}</span>.
                            <br />
                            <br />
                            A department can only be deleted if it is not referenced by windows, staff assignments, or transaction purposes.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel
                            disabled={saving}
                            onClick={() => {
                                setDeleteDeptOpen(false)
                                setSelectedDept(null)
                            }}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                void handleDeleteDept()
                            }}
                            disabled={saving}
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
