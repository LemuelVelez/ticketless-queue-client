import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { LayoutGrid, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ADMIN_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { API_PATHS, getResolvedApiBaseUrl } from "@/api/api"
import { useSession } from "@/hooks/use-session"
import { ApiError, api } from "@/lib/http"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

type Department = {
    _id: string
    id?: string
    name: string
    code?: string
    enabled?: boolean
    [key: string]: unknown
}

type ServiceWindow = {
    _id: string
    id?: string
    name: string
    number: number
    enabled?: boolean
    departmentId?: string | null
    departmentName?: string | null
    [key: string]: unknown
}

type WindowPayload = {
    name: string
    number: number
    departmentId: string
    enabled?: boolean
}

const WINDOW_FALLBACK_STATUSES = new Set([404, 405, 501])

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value)
}

function normalizeString(value: unknown) {
    return String(value ?? "").trim()
}

function normalizeOptionalString(value: unknown): string | null {
    const normalized = normalizeString(value)
    return normalized || null
}

function normalizeBoolean(value: unknown, fallback = true) {
    if (typeof value === "boolean") return value

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase()
        if (normalized === "true") return true
        if (normalized === "false") return false
    }

    return fallback
}

function normalizeNumber(value: unknown, fallback = 1) {
    if (typeof value === "number" && Number.isFinite(value)) return value

    const parsed = Number.parseInt(String(value ?? "").trim(), 10)
    return Number.isFinite(parsed) ? parsed : fallback
}

function parsePositiveInt(value: string) {
    const parsed = Number.parseInt(String(value ?? "").trim(), 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
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
    }
}

function normalizeWindow(rawValue: unknown): ServiceWindow {
    const raw = isRecord(rawValue) ? rawValue : {}
    const nestedDepartment = isRecord(raw.department) ? raw.department : null

    const departmentId =
        normalizeOptionalString(raw.departmentId ?? raw.department_id) ??
        normalizeOptionalString(raw.department) ??
        normalizeOptionalString(nestedDepartment?._id ?? nestedDepartment?.id) ??
        (Array.isArray(raw.departmentIds) ? normalizeOptionalString(raw.departmentIds[0]) : null)

    const departmentName =
        normalizeOptionalString(raw.departmentName) ??
        normalizeOptionalString(nestedDepartment?.name)

    const number = normalizeNumber(raw.number ?? raw.windowNumber ?? raw.windowNo, 1)
    const name =
        normalizeString(raw.name ?? raw.windowName) ||
        `Window ${number}`

    return {
        ...raw,
        _id: normalizeString(raw._id ?? raw.id),
        ...(normalizeOptionalString(raw.id) ? { id: normalizeString(raw.id) } : {}),
        name,
        number,
        enabled: normalizeBoolean(raw.enabled ?? raw.isEnabled, true),
        departmentId,
        departmentName,
    }
}

function getWindowId(window: ServiceWindow) {
    return window._id || window.id || ""
}

function getDepartmentId(window: ServiceWindow) {
    return normalizeOptionalString(window.departmentId)
}

function getDepartmentLabel(
    window: ServiceWindow,
    departmentById: Map<string, Department>
) {
    const departmentId = getDepartmentId(window)
    if (departmentId && departmentById.has(departmentId)) {
        return departmentById.get(departmentId)?.name || departmentId
    }

    return window.departmentName || departmentId || "—"
}

function statusBadge(enabled: boolean | undefined) {
    const active = enabled !== false
    return <Badge variant={active ? "default" : "secondary"}>{active ? "Enabled" : "Disabled"}</Badge>
}

function buildWindowPayload(input: WindowPayload) {
    const payload: Record<string, unknown> = {
        name: input.name.trim(),
        windowName: input.name.trim(),
        number: Number(input.number),
        windowNumber: Number(input.number),
        departmentId: input.departmentId,
        department: input.departmentId,
        departmentIds: [input.departmentId],
    }

    if (typeof input.enabled === "boolean") {
        payload.enabled = input.enabled
    }

    return payload
}

function shouldUseWindowFallback(error: unknown) {
    return error instanceof ApiError && WINDOW_FALLBACK_STATUSES.has(error.status)
}

function getAbsoluteApiBaseUrl() {
    const base = String(getResolvedApiBaseUrl() ?? "").replace(/\/+$/, "")

    if (/^https?:\/\//i.test(base)) return base

    if (typeof window !== "undefined") {
        const normalized = base.startsWith("/") ? base : `/${base}`
        return `${window.location.origin}${normalized}`
    }

    return base
}

function getLegacyWindowsCollectionUrl() {
    return `${getAbsoluteApiBaseUrl()}/windows`
}

function getLegacyWindowItemUrl(id: string) {
    return `${getLegacyWindowsCollectionUrl()}/${encodeURIComponent(id)}`
}

async function withWindowRouteFallback<T>(
    primary: () => Promise<T>,
    legacy: () => Promise<T>
) {
    try {
        return await primary()
    } catch (error) {
        if (!shouldUseWindowFallback(error)) throw error
        return legacy()
    }
}

async function patchOrPutWindow(path: string, payload: Record<string, unknown>) {
    try {
        return await api.patchData<unknown>(path, payload)
    } catch (error) {
        if (!shouldUseWindowFallback(error)) throw error
        return api.putData<unknown>(path, payload)
    }
}

const adminApi = {
    async listDepartments() {
        try {
            const response = await api.getData<unknown>(API_PATHS.departments.enabled)
            return {
                departments: extractCollection(
                    response,
                    ["departments", "items", "results"],
                    normalizeDepartment
                ),
            }
        } catch (error) {
            if (!(error instanceof ApiError) || error.status !== 404) throw error

            const response = await api.getData<unknown>(API_PATHS.departments.list)
            return {
                departments: extractCollection(
                    response,
                    ["departments", "items", "results"],
                    normalizeDepartment
                ),
            }
        }
    },

    async listWindows() {
        const response = await withWindowRouteFallback(
            () => api.getData<unknown>(API_PATHS.serviceWindows.list),
            () => api.getData<unknown>(getLegacyWindowsCollectionUrl())
        )

        return {
            windows: extractCollection(
                response,
                ["windows", "serviceWindows", "items", "results"],
                normalizeWindow
            ),
        }
    },

    async createWindow(payload: WindowPayload) {
        const body = buildWindowPayload(payload)

        return withWindowRouteFallback(
            () => api.postData<unknown>(API_PATHS.serviceWindows.create, body),
            () => api.postData<unknown>(getLegacyWindowsCollectionUrl(), body)
        )
    },

    async updateWindow(id: string, payload: WindowPayload) {
        const body = buildWindowPayload(payload)

        try {
            return await patchOrPutWindow(API_PATHS.serviceWindows.byId(id), body)
        } catch (error) {
            if (!shouldUseWindowFallback(error)) throw error
            return patchOrPutWindow(getLegacyWindowItemUrl(id), body)
        }
    },

    async deleteWindow(id: string) {
        return withWindowRouteFallback(
            () => api.deleteData<unknown>(API_PATHS.serviceWindows.byId(id)),
            () => api.deleteData<unknown>(getLegacyWindowItemUrl(id))
        )
    },
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

    const [searchQuery, setSearchQuery] = React.useState("")
    const [statusFilter, setStatusFilter] = React.useState<"all" | "enabled" | "disabled">("all")
    const [departmentFilter, setDepartmentFilter] = React.useState("all")

    const [createOpen, setCreateOpen] = React.useState(false)
    const [editOpen, setEditOpen] = React.useState(false)
    const [deleteOpen, setDeleteOpen] = React.useState(false)

    const [selectedWindow, setSelectedWindow] = React.useState<ServiceWindow | null>(null)

    const [createName, setCreateName] = React.useState("")
    const [createNumber, setCreateNumber] = React.useState("1")
    const [createDepartmentId, setCreateDepartmentId] = React.useState("")

    const [editName, setEditName] = React.useState("")
    const [editNumber, setEditNumber] = React.useState("1")
    const [editDepartmentId, setEditDepartmentId] = React.useState("")
    const [editEnabled, setEditEnabled] = React.useState(true)

    const departmentById = React.useMemo(() => {
        const map = new Map<string, Department>()

        for (const department of departments) {
            map.set(department._id, department)
        }

        return map
    }, [departments])

    const enabledDepartments = React.useMemo(
        () => departments.filter((department) => department.enabled !== false),
        [departments]
    )

    const fetchAll = React.useCallback(async () => {
        setLoading(true)

        const [departmentResult, windowResult] = await Promise.allSettled([
            adminApi.listDepartments(),
            adminApi.listWindows(),
        ])

        if (departmentResult.status === "fulfilled") {
            setDepartments(departmentResult.value.departments ?? [])
        } else {
            setDepartments([])
            const message =
                departmentResult.reason instanceof Error
                    ? departmentResult.reason.message
                    : "Failed to load departments."
            toast.error(message)
        }

        if (windowResult.status === "fulfilled") {
            setWindows(windowResult.value.windows ?? [])
        } else {
            setWindows([])
            const message =
                windowResult.reason instanceof Error
                    ? windowResult.reason.message
                    : "Failed to load windows."
            toast.error(message)
        }

        setLoading(false)
    }, [])

    React.useEffect(() => {
        void fetchAll()
    }, [fetchAll])

    function resetCreateForm() {
        setCreateName("")
        setCreateNumber("1")
        setCreateDepartmentId("")
    }

    function resetEditForm() {
        setEditName("")
        setEditNumber("1")
        setEditDepartmentId("")
        setEditEnabled(true)
    }

    function openCreateDialog() {
        resetCreateForm()
        setCreateOpen(true)
    }

    function openEditDialog(window: ServiceWindow) {
        setSelectedWindow(window)
        setEditName(window.name ?? "")
        setEditNumber(String(window.number ?? 1))
        setEditDepartmentId(getDepartmentId(window) ?? "")
        setEditEnabled(window.enabled !== false)
        setEditOpen(true)
    }

    function openDeleteDialog(window: ServiceWindow) {
        setSelectedWindow(window)
        setDeleteOpen(true)
    }

    const rows = React.useMemo(() => {
        const query = searchQuery.trim().toLowerCase()

        return windows
            .filter((window) => {
                const enabled = window.enabled !== false
                const departmentId = getDepartmentId(window)

                if (statusFilter === "enabled" && !enabled) return false
                if (statusFilter === "disabled" && enabled) return false
                if (departmentFilter !== "all" && departmentId !== departmentFilter) return false

                if (!query) return true

                const departmentLabel = getDepartmentLabel(window, departmentById).toLowerCase()
                const haystack = `${window.name} ${window.number} ${departmentLabel}`.toLowerCase()

                return haystack.includes(query)
            })
            .sort((a, b) => {
                const aEnabled = a.enabled !== false
                const bEnabled = b.enabled !== false

                if (aEnabled !== bEnabled) return aEnabled ? -1 : 1
                if (a.number !== b.number) return a.number - b.number

                return a.name.localeCompare(b.name)
            })
    }, [windows, searchQuery, statusFilter, departmentFilter, departmentById])

    const stats = React.useMemo(() => {
        const total = windows.length
        const enabled = windows.filter((window) => window.enabled !== false).length

        return {
            total,
            enabled,
            disabled: total - enabled,
        }
    }, [windows])

    async function handleCreateWindow() {
        const name = createName.trim()
        const number = parsePositiveInt(createNumber)
        const departmentId = createDepartmentId.trim()

        if (!departmentId) {
            toast.error("Please select a department.")
            return
        }

        if (!name) {
            toast.error("Window name is required.")
            return
        }

        if (!number) {
            toast.error("Window number must be a positive integer.")
            return
        }

        setSaving(true)

        try {
            await adminApi.createWindow({
                name,
                number,
                departmentId,
            })

            toast.success("Window created.")
            setCreateOpen(false)
            resetCreateForm()
            await fetchAll()
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Failed to create window."
            toast.error(message)
        } finally {
            setSaving(false)
        }
    }

    async function handleUpdateWindow() {
        const id = selectedWindow ? getWindowId(selectedWindow) : ""
        const name = editName.trim()
        const number = parsePositiveInt(editNumber)
        const departmentId = editDepartmentId.trim()

        if (!id) {
            toast.error("Invalid window id.")
            return
        }

        if (!departmentId) {
            toast.error("Please select a department.")
            return
        }

        if (!name) {
            toast.error("Window name is required.")
            return
        }

        if (!number) {
            toast.error("Window number must be a positive integer.")
            return
        }

        setSaving(true)

        try {
            await adminApi.updateWindow(id, {
                name,
                number,
                departmentId,
                enabled: editEnabled,
            })

            toast.success("Window updated.")
            setEditOpen(false)
            setSelectedWindow(null)
            resetEditForm()
            await fetchAll()
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Failed to update window."
            toast.error(message)
        } finally {
            setSaving(false)
        }
    }

    async function handleDeleteWindow() {
        const id = selectedWindow ? getWindowId(selectedWindow) : ""

        if (!id) {
            toast.error("Invalid window id.")
            return
        }

        setSaving(true)

        try {
            await adminApi.deleteWindow(id)
            toast.success("Window deleted.")
            setDeleteOpen(false)
            setSelectedWindow(null)
            await fetchAll()
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Failed to delete window."
            toast.error(message)
        } finally {
            setSaving(false)
        }
    }

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
                                    Create, update, and delete service windows with a clean single-department mapping.
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
                                    onClick={openCreateDialog}
                                    disabled={saving}
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
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="Search windows..."
                                    className="w-full min-w-0 md:w-80"
                                />

                                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                                    <SelectTrigger className="w-full min-w-0 md:w-72">
                                        <SelectValue placeholder="Filter by department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All departments</SelectItem>
                                        {departments.map((department) => (
                                            <SelectItem key={department._id} value={department._id}>
                                                {department.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={statusFilter}
                                    onValueChange={(value) =>
                                        setStatusFilter(value as "all" | "enabled" | "disabled")
                                    }
                                >
                                    <SelectTrigger className="w-full min-w-0 md:w-52">
                                        <SelectValue placeholder="Filter by status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        <SelectItem value="enabled">Enabled</SelectItem>
                                        <SelectItem value="disabled">Disabled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {enabledDepartments.length === 0 && !loading ? (
                            <div className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                No enabled departments found. Create or enable a department first before adding a window.
                            </div>
                        ) : null}

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
                                                <TableHead>Department</TableHead>
                                                <TableHead className="hidden sm:table-cell">Number</TableHead>
                                                <TableHead className="text-right">Status</TableHead>
                                                <TableHead className="w-14" />
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody>
                                            {rows.map((window) => (
                                                <TableRow key={getWindowId(window)}>
                                                    <TableCell className="font-medium">
                                                        <div className="flex min-w-0 flex-col">
                                                            <span className="truncate">{window.name}</span>
                                                            <span className="truncate text-xs text-muted-foreground sm:hidden">
                                                                #{window.number} · {getDepartmentLabel(window, departmentById)}
                                                            </span>
                                                        </div>
                                                    </TableCell>

                                                    <TableCell>
                                                        <span className="text-muted-foreground">
                                                            {getDepartmentLabel(window, departmentById)}
                                                        </span>
                                                    </TableCell>

                                                    <TableCell className="hidden sm:table-cell">
                                                        <span className="text-muted-foreground">#{window.number}</span>
                                                    </TableCell>

                                                    <TableCell className="text-right">
                                                        {statusBadge(window.enabled)}
                                                    </TableCell>

                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    aria-label="Window actions"
                                                                >
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>

                                                            <DropdownMenuContent align="end" className="w-48">
                                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    onClick={() => openEditDialog(window)}
                                                                    className="cursor-pointer"
                                                                >
                                                                    <Pencil className="mr-2 h-4 w-4" />
                                                                    Edit window
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => openDeleteDialog(window)}
                                                                    className="cursor-pointer text-destructive focus:text-destructive"
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Delete window
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            ))}

                                            {rows.length === 0 ? (
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

            <Dialog
                open={createOpen}
                onOpenChange={(open) => {
                    setCreateOpen(open)
                    if (!open) resetCreateForm()
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create window</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="create-window-name">Window name</Label>
                            <Input
                                id="create-window-name"
                                value={createName}
                                onChange={(event) => setCreateName(event.target.value)}
                                placeholder="e.g., Registrar Window 1"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="create-window-number">Window number</Label>
                            <Input
                                id="create-window-number"
                                type="number"
                                min={1}
                                value={createNumber}
                                onChange={(event) => setCreateNumber(event.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Department</Label>
                            <Select
                                value={createDepartmentId || "none"}
                                onValueChange={(value) =>
                                    setCreateDepartmentId(value === "none" ? "" : value)
                                }
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Select department</SelectItem>
                                    {enabledDepartments.map((department) => (
                                        <SelectItem key={department._id} value={department._id}>
                                            {department.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Only enabled departments are available for new windows.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setCreateOpen(false)}
                            disabled={saving}
                            className="w-full sm:mr-2 sm:w-auto"
                        >
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            onClick={() => void handleCreateWindow()}
                            disabled={saving || enabledDepartments.length === 0}
                            className="w-full sm:w-auto"
                        >
                            {saving ? "Creating..." : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={editOpen}
                onOpenChange={(open) => {
                    setEditOpen(open)
                    if (!open) {
                        setSelectedWindow(null)
                        resetEditForm()
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit window</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-window-name">Window name</Label>
                            <Input
                                id="edit-window-name"
                                value={editName}
                                onChange={(event) => setEditName(event.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="edit-window-number">Window number</Label>
                            <Input
                                id="edit-window-number"
                                type="number"
                                min={1}
                                value={editNumber}
                                onChange={(event) => setEditNumber(event.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Department</Label>
                            <Select
                                value={editDepartmentId || "none"}
                                onValueChange={(value) =>
                                    setEditDepartmentId(value === "none" ? "" : value)
                                }
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Select department</SelectItem>
                                    {departments.map((department) => (
                                        <SelectItem key={department._id} value={department._id}>
                                            {department.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="grid gap-0.5">
                                <div className="text-sm font-medium">Enabled</div>
                                <div className="text-xs text-muted-foreground">
                                    Disabled windows stay saved but can be hidden from active workflows.
                                </div>
                            </div>
                            <Switch checked={editEnabled} onCheckedChange={setEditEnabled} />
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setEditOpen(false)}
                            disabled={saving}
                            className="w-full sm:mr-2 sm:w-auto"
                        >
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            onClick={() => void handleUpdateWindow()}
                            disabled={saving}
                            className="w-full sm:w-auto"
                        >
                            {saving ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={deleteOpen}
                onOpenChange={(open) => {
                    setDeleteOpen(open)
                    if (!open) setSelectedWindow(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete window?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete{" "}
                            <span className="font-medium">
                                {selectedWindow
                                    ? `${selectedWindow.name} (#${selectedWindow.number})`
                                    : "this window"}
                            </span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => {
                                event.preventDefault()
                                void handleDeleteWindow()
                            }}
                            disabled={saving}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            {saving ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DashboardLayout>
    )
}