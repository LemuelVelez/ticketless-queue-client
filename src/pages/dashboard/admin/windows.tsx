import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import {
    MoreHorizontal,
    Plus,
    RefreshCw,
    LayoutGrid,
    UserPlus2,
    UserMinus,
    Trash2,
    Check,
    ChevronsUpDown,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ADMIN_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { API_PATHS, getResolvedApiBaseUrl } from "@/api/api"
import { useSession } from "@/hooks/use-session"
import { ApiError, api } from "@/lib/http"
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

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const DEFAULT_MANAGER = "REGISTRAR"

type Department = {
    _id: string
    id?: string
    name: string
    code?: string
    enabled?: boolean
    transactionManager?: string | null
    [key: string]: unknown
}

type ServiceWindow = {
    _id: string
    id?: string
    name: string
    number?: number
    enabled?: boolean
    department?: string | null
    departmentId?: string | null
    departmentIds?: string[]
    [key: string]: unknown
}

type StaffUser = {
    _id?: string
    id?: string
    role?: string | null
    active?: boolean
    enabled?: boolean
    name?: string | null
    email?: string | null
    assignedWindow?: string | null
    assignedDepartment?: string | null
    assignedDepartments?: string[] | null
    departmentIds?: string[] | null
    transactionManager?: string | null
    [key: string]: unknown
}

type CreateWindowInput = {
    departmentIds: string[]
    name: string
    number: number
}

type UpdateWindowInput = CreateWindowInput & {
    enabled: boolean
}

type UpdateStaffInput = {
    departmentIds: string[]
    windowId: string | null
    transactionManager?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value)
}

function normalizeString(value: unknown) {
    return String(value ?? "").trim()
}

function normalizeOptionalString(value: unknown): string | null {
    const clean = normalizeString(value)
    return clean || null
}

function normalizeBoolean(value: unknown, fallback?: boolean) {
    if (typeof value === "boolean") return value
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase()
        if (normalized === "true") return true
        if (normalized === "false") return false
    }
    return fallback
}

function normalizeNumber(value: unknown, fallback = 0) {
    if (typeof value === "number" && Number.isFinite(value)) return value
    const parsed = Number.parseInt(String(value ?? "").trim(), 10)
    return Number.isFinite(parsed) ? parsed : fallback
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

function toIdArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []

    const ids: string[] = []

    for (const item of value) {
        if (typeof item === "string" || typeof item === "number") {
            const id = normalizeString(item)
            if (id) ids.push(id)
            continue
        }

        if (isRecord(item)) {
            const id = normalizeString(item._id ?? item.id ?? item.departmentId ?? item.value)
            if (id) ids.push(id)
        }
    }

    return uniqueStringIds(ids)
}

function extractCollection<T>(
    value: unknown,
    keys: string[],
    mapItem: (item: unknown) => T
): T[] {
    if (Array.isArray(value)) return value.map(mapItem)

    if (isRecord(value)) {
        for (const key of keys) {
            const candidate = value[key]
            if (Array.isArray(candidate)) return candidate.map(mapItem)
        }
    }

    return []
}

function normalizeDepartment(rawValue: unknown): Department {
    const raw = isRecord(rawValue) ? rawValue : {}
    const _id = normalizeString(raw._id ?? raw.id)
    const code = normalizeOptionalString(raw.code)
    const name =
        normalizeString(raw.name ?? raw.departmentName) ||
        code ||
        _id ||
        "Unnamed Department"

    return {
        ...raw,
        _id,
        ...(normalizeOptionalString(raw.id) ? { id: normalizeString(raw.id) } : {}),
        name,
        ...(code ? { code } : {}),
        enabled: normalizeBoolean(raw.enabled ?? raw.isEnabled, true),
        transactionManager:
            normalizeOptionalString(
                raw.transactionManager ?? raw.managerKey ?? raw.transaction_manager
            ) ?? DEFAULT_MANAGER,
    }
}

function normalizeWindow(rawValue: unknown): ServiceWindow {
    const raw = isRecord(rawValue) ? rawValue : {}
    const _id = normalizeString(raw._id ?? raw.id)

    const departmentIds = uniqueStringIds([
        ...toIdArray(raw.departmentIds),
        ...toIdArray(raw.departments),
        normalizeOptionalString(raw.departmentId),
        normalizeOptionalString(raw.department),
    ])

    const firstDepartmentId = departmentIds[0] ?? null

    return {
        ...raw,
        _id,
        ...(normalizeOptionalString(raw.id) ? { id: normalizeString(raw.id) } : {}),
        name:
            normalizeString(raw.name ?? raw.windowName ?? raw.label) ||
            `Window ${normalizeNumber(raw.number ?? raw.windowNumber, 1)}`,
        number: normalizeNumber(raw.number ?? raw.windowNumber, 1),
        enabled: normalizeBoolean(raw.enabled ?? raw.isEnabled, true),
        departmentIds,
        departmentId: firstDepartmentId,
        department: firstDepartmentId,
    }
}

function normalizeStaff(rawValue: unknown): StaffUser {
    const raw = isRecord(rawValue) ? rawValue : {}

    const assignedDepartments = uniqueStringIds([
        ...toIdArray(raw.assignedDepartments),
        ...toIdArray(raw.departmentIds),
        normalizeOptionalString(raw.assignedDepartment),
    ])

    const fallbackName =
        [
            normalizeOptionalString(raw.firstName),
            normalizeOptionalString(raw.middleName),
            normalizeOptionalString(raw.lastName),
        ]
            .filter(Boolean)
            .join(" ")
            .trim() || null

    return {
        ...raw,
        _id: normalizeOptionalString(raw._id ?? raw.id) ?? undefined,
        id: normalizeOptionalString(raw.id) ?? undefined,
        role: normalizeOptionalString(raw.role),
        active: normalizeBoolean(raw.active, normalizeBoolean(raw.enabled, true)),
        enabled: normalizeBoolean(raw.enabled, true),
        name: normalizeOptionalString(raw.name) ?? fallbackName,
        email: normalizeOptionalString(raw.email),
        assignedWindow: normalizeOptionalString(
            raw.assignedWindow ?? raw.windowId ?? raw.serviceWindowId
        ),
        assignedDepartment: assignedDepartments[0] ?? null,
        assignedDepartments,
        departmentIds: assignedDepartments,
        transactionManager: normalizeOptionalString(raw.transactionManager),
    }
}

function buildWindowPayload(input: CreateWindowInput | UpdateWindowInput) {
    const departmentIds = uniqueStringIds(input.departmentIds)
    const firstDepartmentId = departmentIds[0] ?? null
    const enabled = "enabled" in input ? Boolean(input.enabled) : true
    const number = Number(input.number)
    const name = input.name.trim()

    return {
        name,
        windowName: name,
        number,
        windowNumber: number,
        enabled,
        isEnabled: enabled,
        departmentIds,
        departments: departmentIds,
        departmentId: firstDepartmentId,
        department: firstDepartmentId,
    }
}

function normalizeManagerKey(value: unknown, fallback = DEFAULT_MANAGER) {
    const v = String(value || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_")
    return v || fallback
}

function buildStaffUpdatePayload(input: UpdateStaffInput) {
    const departmentIds = uniqueStringIds(input.departmentIds)
    const firstDepartmentId = departmentIds[0] ?? null
    const normalizedManager = input.transactionManager
        ? normalizeManagerKey(input.transactionManager, DEFAULT_MANAGER)
        : undefined

    return {
        departmentIds,
        assignedDepartments: departmentIds,
        assignedDepartment: firstDepartmentId,
        departmentId: firstDepartmentId,
        windowId: input.windowId,
        assignedWindow: input.windowId,
        serviceWindowId: input.windowId,
        ...(normalizedManager ? { transactionManager: normalizedManager } : {}),
    }
}

function buildAbsoluteApiUrl(path: string) {
    const base = getResolvedApiBaseUrl().replace(/\/+$/, "")
    const normalizedPath = path.startsWith("/") ? path : `/${path}`

    if (/^https?:\/\//i.test(base) || base.startsWith("//")) {
        return `${base}${normalizedPath}`
    }

    if (typeof window !== "undefined") {
        return `${window.location.origin}${base}${normalizedPath}`
    }

    return `${base}${normalizedPath}`
}

async function runWithEndpointFallback<T>(requests: Array<() => Promise<T>>) {
    let lastError: unknown = null

    for (const request of requests) {
        try {
            return await request()
        } catch (error) {
            lastError = error
            if (!(error instanceof ApiError)) continue
            if (![404, 405, 501].includes(error.status)) throw error
        }
    }

    throw lastError ?? new Error("Request failed.")
}

const adminApi = {
    async listDepartments() {
        const res = await runWithEndpointFallback([
            () => api.getData<unknown>(API_PATHS.departments.enabled),
            () => api.getData<unknown>(API_PATHS.departments.list),
        ])

        return {
            departments: extractCollection(
                res,
                ["departments", "items", "results", "data"],
                normalizeDepartment
            ),
        }
    },

    async listWindows() {
        const res = await runWithEndpointFallback([
            () => api.getData<unknown>(API_PATHS.serviceWindows.list),
            () => api.getData<unknown>(buildAbsoluteApiUrl("/windows")),
            () => api.getData<unknown>(buildAbsoluteApiUrl("/window")),
        ])

        return {
            windows: extractCollection(
                res,
                ["windows", "serviceWindows", "items", "results", "data"],
                normalizeWindow
            ),
        }
    },

    async createWindow(payload: CreateWindowInput) {
        const body = buildWindowPayload(payload)

        return runWithEndpointFallback([
            () => api.postData<unknown>(API_PATHS.serviceWindows.create, body),
            () => api.postData<unknown>(buildAbsoluteApiUrl("/windows"), body),
            () => api.postData<unknown>(buildAbsoluteApiUrl("/window"), body),
        ])
    },

    async updateWindow(id: string, payload: UpdateWindowInput) {
        const body = buildWindowPayload(payload)

        return runWithEndpointFallback([
            () => api.patchData<unknown>(API_PATHS.serviceWindows.byId(id), body),
            () => api.putData<unknown>(API_PATHS.serviceWindows.byId(id), body),
            () => api.patchData<unknown>(buildAbsoluteApiUrl(`/windows/${id}`), body),
            () => api.putData<unknown>(buildAbsoluteApiUrl(`/windows/${id}`), body),
            () => api.patchData<unknown>(buildAbsoluteApiUrl(`/window/${id}`), body),
            () => api.putData<unknown>(buildAbsoluteApiUrl(`/window/${id}`), body),
        ])
    },

    async deleteWindow(id: string) {
        return runWithEndpointFallback([
            () => api.deleteData<unknown>(API_PATHS.serviceWindows.byId(id)),
            () => api.deleteData<unknown>(buildAbsoluteApiUrl(`/windows/${id}`)),
            () => api.deleteData<unknown>(buildAbsoluteApiUrl(`/window/${id}`)),
        ])
    },

    async listStaff() {
        const res = await runWithEndpointFallback([
            () => api.getData<unknown>(API_PATHS.users.staff),
            () => api.getData<unknown>(API_PATHS.admin.staff),
        ])

        return {
            staff: extractCollection(
                res,
                ["staff", "users", "items", "results", "data"],
                normalizeStaff
            ),
        }
    },

    async updateStaff(id: string, payload: UpdateStaffInput) {
        const body = buildStaffUpdatePayload(payload)

        return runWithEndpointFallback([
            () => api.patchData<unknown>(API_PATHS.users.byId(id), body),
            () => api.putData<unknown>(API_PATHS.users.byId(id), body),
            () => api.patchData<unknown>(buildAbsoluteApiUrl(`/users/${id}`), body),
            () => api.putData<unknown>(buildAbsoluteApiUrl(`/users/${id}`), body),
        ])
    },
}

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

function getStaffDepartmentIds(staff: StaffUser): string[] {
    return uniqueStringIds([
        ...(Array.isArray(staff.assignedDepartments) ? staff.assignedDepartments : []),
        staff.assignedDepartment ?? "",
        ...(Array.isArray(staff.departmentIds) ? staff.departmentIds : []),
    ])
}

function getWindowDepartmentIds(win?: ServiceWindow | null): string[] {
    if (!win) return []
    return uniqueStringIds([
        ...(Array.isArray(win.departmentIds) ? win.departmentIds : []),
        win.department ?? "",
        win.departmentId ?? "",
    ])
}

function departmentLabelList(ids: string[], deptById: Map<string, Department>) {
    return ids.map((id) => deptById.get(id)?.name || id)
}

function getDepartmentManagerById(departmentId: string, deptById: Map<string, Department>) {
    const dep = deptById.get(departmentId)
    const manager = normalizeManagerKey(dep?.transactionManager || "", "")
    return manager || null
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
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between gap-2 overflow-hidden"
                    disabled={disabled}
                    title={buttonText}
                >
                    <span className="min-w-0 flex-1 truncate text-left">
                        {buttonText}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
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
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                checked ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <span className="truncate">{d.name}</span>
                                        {d.code ? (
                                            <span className="ml-1 text-xs text-muted-foreground">
                                                ({d.code})
                                            </span>
                                        ) : null}
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

    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)

    const [departments, setDepartments] = React.useState<Department[]>([])
    const [windows, setWindows] = React.useState<ServiceWindow[]>([])
    const [staffUsers, setStaffUsers] = React.useState<StaffUser[]>([])

    const [winQ, setWinQ] = React.useState("")
    const [winStatusTab, setWinStatusTab] = React.useState<"all" | "enabled" | "disabled">("all")
    const [winDeptFilter, setWinDeptFilter] = React.useState<string>("all")

    const [createWinOpen, setCreateWinOpen] = React.useState(false)
    const [editWinOpen, setEditWinOpen] = React.useState(false)
    const [deleteWinOpen, setDeleteWinOpen] = React.useState(false)
    const [assignStaffOpen, setAssignStaffOpen] = React.useState(false)

    const [selectedWin, setSelectedWin] = React.useState<ServiceWindow | null>(null)
    const [assignTargetWin, setAssignTargetWin] = React.useState<ServiceWindow | null>(null)

    const [cWinDepartmentIds, setCWinDepartmentIds] = React.useState<string[]>([])
    const [cWinName, setCWinName] = React.useState("")
    const [cWinNumber, setCWinNumber] = React.useState<number>(1)

    const [eWinDepartmentIds, setEWinDepartmentIds] = React.useState<string[]>([])
    const [eWinName, setEWinName] = React.useState("")
    const [eWinNumber, setEWinNumber] = React.useState<number>(1)
    const [eWinEnabled, setEWinEnabled] = React.useState(true)

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
            if (String(s.role ?? "").toUpperCase() !== "STAFF") continue
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
            .filter((s) => String(s.role ?? "").toUpperCase() === "STAFF" && s.active && getStaffId(s))
            .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
    }, [staffUsers])

    const enabledDepartments = React.useMemo(
        () =>
            departments
                .filter((d) => isEnabledFlag(d.enabled))
                .sort((a, b) => a.name.localeCompare(b.name)),
        [departments]
    )

    const hasDepartmentOptions = enabledDepartments.length > 0

    const fetchAll = React.useCallback(async () => {
        setLoading(true)

        const [deptResult, winResult, staffResult] = await Promise.allSettled([
            adminApi.listDepartments(),
            adminApi.listWindows(),
            adminApi.listStaff(),
        ])

        if (deptResult.status === "fulfilled") {
            setDepartments(deptResult.value.departments ?? [])
        } else {
            setDepartments([])
        }

        if (winResult.status === "fulfilled") {
            setWindows(winResult.value.windows ?? [])
        } else {
            setWindows([])
        }

        if (staffResult.status === "fulfilled") {
            setStaffUsers(staffResult.value.staff ?? [])
        } else {
            setStaffUsers([])
        }

        if (winResult.status === "rejected") {
            const msg = winResult.reason instanceof Error ? winResult.reason.message : "Failed to load windows."
            toast.error(msg)
        }

        if (deptResult.status === "rejected") {
            const msg = deptResult.reason instanceof Error ? deptResult.reason.message : "Failed to load departments."
            toast.error(msg)
        }

        if (staffResult.status === "rejected") {
            const msg = staffResult.reason instanceof Error ? staffResult.reason.message : "Failed to load staff accounts."
            toast.error(msg)
        }

        setLoading(false)
    }, [])

    React.useEffect(() => {
        void fetchAll()
    }, [fetchAll])

    function resetCreateWinForm() {
        setCWinDepartmentIds([])
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

    async function handleCreateWin() {
        const departmentIds = uniqueStringIds(cWinDepartmentIds)
        const name = cWinName.trim()
        const number = Number(cWinNumber)

        if (departmentIds.length === 0) return toast.error("Select at least one department.")
        if (!name) return toast.error("Window name is required.")
        if (!Number.isFinite(number) || number <= 0) {
            return toast.error("Window number must be a positive integer.")
        }

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
        if (!Number.isFinite(number) || number <= 0) {
            return toast.error("Window number must be a positive integer.")
        }

        setSaving(true)
        try {
            await adminApi.updateWindow(id, {
                name,
                number,
                enabled: eWinEnabled,
                departmentIds,
            })
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

        const assignedStaff = staffAssignedByWindow.get(selectedWin._id) ?? []
        if (assignedStaff.length > 0) {
            return toast.error("Unassign the staff member from this window before deleting it.")
        }

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
        if (windowDepartmentIds.length === 0) {
            return toast.error("Window must have at least one department.")
        }

        const currentAssignments = (staffAssignedByWindow.get(assignTargetWin._id) ?? []).filter((s) =>
            getStaffId(s)
        )
        const otherAssignments = currentAssignments.filter((s) => getStaffId(s) !== aStaffId)

        const windowManagers = uniqueStringIds(
            windowDepartmentIds
                .map((depId) => getDepartmentManagerById(depId, deptById))
                .filter((m): m is string => Boolean(m))
        )

        if (windowManagers.length > 1) {
            return toast.error("Window departments are inconsistent (different transaction managers).")
        }

        const targetManager = windowManagers[0] ?? null
        const pickedDepartmentIds = getStaffDepartmentIds(picked)
        const compatiblePickedDepartmentIds = targetManager
            ? pickedDepartmentIds.filter((depId) => getDepartmentManagerById(depId, deptById) === targetManager)
            : pickedDepartmentIds

        const nextDepartmentIds = uniqueStringIds([
            ...compatiblePickedDepartmentIds,
            ...windowDepartmentIds,
        ])

        if (nextDepartmentIds.length === 0) {
            return toast.error("Unable to resolve department assignment for selected staff.")
        }

        setSaving(true)
        try {
            const movedFromWindowId = picked.assignedWindow || null

            await adminApi.updateStaff(aStaffId, {
                departmentIds: nextDepartmentIds,
                windowId: assignTargetWin._id,
                ...(targetManager ? { transactionManager: targetManager } : {}),
            })

            for (const assigned of otherAssignments) {
                const assignedId = getStaffId(assigned)
                if (!assignedId) continue

                await adminApi.updateStaff(assignedId, {
                    departmentIds: getStaffDepartmentIds(assigned),
                    windowId: null,
                    ...(targetManager ? { transactionManager: targetManager } : {}),
                })
            }

            const movedText =
                movedFromWindowId && movedFromWindowId !== assignTargetWin._id
                    ? ` Moved from ${windowById.get(movedFromWindowId)?.name ?? "another window"}.`
                    : ""

            const replacedNames = otherAssignments
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
            toast.success(
                `Removed ${staff.name} from ${assignTargetWin.name} (#${assignTargetWin.number}).`
            )
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to unassign staff."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    const stats = React.useMemo(() => {
        const totalWindows = windows.length
        const enabledWindows = windows.filter((w) => isEnabledFlag(w.enabled)).length
        const withAssignedStaff = windows.filter((w) =>
            staffAssignedByWindow.get(w._id)?.[0] ? true : false
        ).length

        return {
            total: totalWindows,
            enabled: enabledWindows,
            disabled: totalWindows - enabledWindows,
            withAssignedStaff,
        }
    }, [windows, staffAssignedByWindow])

    const assignedStaffForTargetWin = React.useMemo(() => {
        if (!assignTargetWin?._id) return []
        return staffAssignedByWindow.get(assignTargetWin._id) ?? []
    }, [assignTargetWin, staffAssignedByWindow])

    return (
        <DashboardLayout
            title="Windows"
            navItems={ADMIN_NAV_ITEMS}
            user={dashboardUser}
            activePath={location.pathname}
        >
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                <Card className="min-w-0">
                    <CardHeader className="gap-2">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <CardTitle>Window Management</CardTitle>
                                <CardDescription>
                                    Manage window records, link multiple departments, and keep one staff
                                    assignment per window.
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
                                    disabled={saving || !hasDepartmentOptions}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <Plus className="h-4 w-4" />
                                    New window
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="secondary">Total: {stats.total}</Badge>
                                <Badge variant="default">Enabled: {stats.enabled}</Badge>
                                <Badge variant="secondary">Disabled: {stats.disabled}</Badge>
                                <Badge variant="secondary">With staff: {stats.withAssignedStaff}</Badge>
                            </div>

                            <div className="flex items-center gap-2">
                                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Windows</span>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="min-w-0">
                        {!hasDepartmentOptions && !loading ? (
                            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                No enabled departments were loaded. Window create and edit actions stay
                                disabled until the department endpoint responds.
                            </div>
                        ) : null}

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

                            <Tabs
                                value={winStatusTab}
                                onValueChange={(v) => setWinStatusTab(v as "all" | "enabled" | "disabled")}
                                className="w-full md:w-auto"
                            >
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
                                <div className="overflow-x-auto rounded-lg border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Window</TableHead>
                                                <TableHead className="hidden md:table-cell">
                                                    Departments
                                                </TableHead>
                                                <TableHead className="hidden md:table-cell">
                                                    Staff assigned
                                                </TableHead>
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
                                                                    <span className="text-muted-foreground">
                                                                        (#{w.number})
                                                                    </span>
                                                                </span>
                                                                <span
                                                                    className="truncate text-xs text-muted-foreground md:hidden"
                                                                    title={deptNames.join(", ")}
                                                                >
                                                                    {deptText}
                                                                </span>
                                                                <span className="truncate text-xs text-muted-foreground md:hidden">
                                                                    Staff: {assignedDisplay}
                                                                    {extraAssignedCount > 0
                                                                        ? ` (+${extraAssignedCount} extra)`
                                                                        : ""}
                                                                </span>
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="hidden md:table-cell">
                                                            <div className="min-w-0">
                                                                {deptNames.length > 0 ? (
                                                                    <p
                                                                        className="truncate text-muted-foreground"
                                                                        title={deptNames.join(", ")}
                                                                    >
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
                                                                            +{extraAssignedCount} extra assignment
                                                                            {extraAssignedCount > 1 ? "s" : ""}
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

                                                        <TableCell className="text-right">
                                                            {statusBadge(w.enabled)}
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

                                                                <DropdownMenuContent
                                                                    align="end"
                                                                    className="w-52"
                                                                >
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
                                                                        disabled={!hasDepartmentOptions}
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
                                                    <TableCell
                                                        colSpan={5}
                                                        className="py-10 text-center text-muted-foreground"
                                                    >
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
                                disabled={saving || !hasDepartmentOptions}
                            />
                            <p className="text-xs text-muted-foreground">
                                Choose one or more enabled departments.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="c-win-name">Window name</Label>
                            <Input
                                id="c-win-name"
                                value={cWinName}
                                onChange={(e) => setCWinName(e.target.value)}
                                placeholder="e.g., Window A"
                                disabled={saving || !hasDepartmentOptions}
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
                                disabled={saving || !hasDepartmentOptions}
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

                        <Button
                            type="button"
                            onClick={() => void handleCreateWin()}
                            disabled={saving || !hasDepartmentOptions}
                            className="w-full sm:w-auto"
                        >
                            {saving ? "Creating…" : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                                disabled={saving || !hasDepartmentOptions}
                            />
                            <p className="text-xs text-muted-foreground">
                                One window can include multiple departments.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="e-win-name">Window name</Label>
                            <Input
                                id="e-win-name"
                                value={eWinName}
                                onChange={(e) => setEWinName(e.target.value)}
                                disabled={saving || !hasDepartmentOptions}
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
                                disabled={saving || !hasDepartmentOptions}
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="grid gap-0.5">
                                <div className="text-sm font-medium">Enabled</div>
                                <div className="text-xs text-muted-foreground">
                                    Disabled windows are hidden in normal assignment flow.
                                </div>
                            </div>
                            <Switch checked={eWinEnabled} onCheckedChange={setEWinEnabled} disabled={saving} />
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

                        <Button
                            type="button"
                            onClick={() => void handleSaveWin()}
                            disabled={saving || !hasDepartmentOptions}
                            className="w-full sm:w-auto"
                        >
                            {saving ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                                    <span className="text-muted-foreground">
                                        (#{assignTargetWin.number})
                                    </span>
                                ) : null}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                                Departments:{" "}
                                {assignTargetWin
                                    ? (departmentLabelList(
                                          getWindowDepartmentIds(assignTargetWin),
                                          deptById
                                      ).join(", ") || "—")
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
                                        const currentWindow = s.assignedWindow
                                            ? windowById.get(s.assignedWindow)
                                            : null
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
                                Staff can only be in one window at a time. Reassigning here
                                automatically removes any previous staff attached to this window.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label>Currently assigned in this window</Label>
                            <div className="max-h-48 overflow-y-auto rounded-lg border p-2">
                                {assignedStaffForTargetWin.length === 0 ? (
                                    <p className="px-1 py-2 text-sm text-muted-foreground">
                                        No staff assigned yet.
                                    </p>
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
                                                        <p className="truncate text-sm font-medium">
                                                            {s.name}
                                                        </p>
                                                        <p className="truncate text-xs text-muted-foreground">
                                                            {s.email}
                                                        </p>
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

            <AlertDialog open={deleteWinOpen} onOpenChange={setDeleteWinOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete window?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete{" "}
                            <span className="font-medium">
                                {selectedWin?.name
                                    ? `${selectedWin.name} (#${selectedWin.number})`
                                    : "this window"}
                            </span>
                            .
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
        </DashboardLayout>
    )
}