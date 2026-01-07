/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { CalendarDays, RefreshCw, ShieldCheck, Table2 } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { format } from "date-fns"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ADMIN_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { adminApi, type AuditLogsResponse } from "@/api/admin"
import { useSession } from "@/hooks/use-session"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

function ymdLocal(d: Date) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
}

function lastNDaysRange(n: number): DateRange {
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - (n - 1))
    return { from, to }
}

function formatNumber(n: number | null | undefined) {
    if (n === null || n === undefined || Number.isNaN(n)) return "—"
    return new Intl.NumberFormat().format(n)
}

function DateRangePicker({
    value,
    onChange,
    disabled,
}: {
    value: DateRange | undefined
    onChange: (v: DateRange | undefined) => void
    disabled?: boolean
}) {
    const label = React.useMemo(() => {
        if (value?.from) {
            if (value.to) return `${format(value.from, "LLL dd, y")} – ${format(value.to, "LLL dd, y")}`
            return format(value.from, "LLL dd, y")
        }
        return "Pick a date range"
    }, [value])

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    disabled={disabled}
                    className={cn("w-full justify-start text-left font-normal", !value?.from && "text-muted-foreground")}
                >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {label}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" selected={value} onSelect={onChange} initialFocus numberOfMonths={1} />
            </PopoverContent>
        </Popover>
    )
}

export default function AdminAuditsPage() {
    const location = useLocation()
    const { user: sessionUser } = useSession()

    const dashboardUser: DashboardUser | undefined = React.useMemo(() => {
        if (!sessionUser) return undefined
        return {
            name: sessionUser.name ?? "Admin",
            email: sessionUser.email ?? "",
        }
    }, [sessionUser])

    // Filters
    const [range, setRange] = React.useState<DateRange | undefined>(() => lastNDaysRange(7))
    const from = React.useMemo(() => (range?.from ? ymdLocal(range.from) : ""), [range?.from])
    const to = React.useMemo(() => (range?.to ? ymdLocal(range.to) : ""), [range?.to])

    const [action, setAction] = React.useState("")
    const [entityType, setEntityType] = React.useState("")
    const [actorRole, setActorRole] = React.useState<"ALL" | "ADMIN" | "STAFF">("ALL")

    // Pagination
    const [page, setPage] = React.useState(1)
    const [limit, setLimit] = React.useState(50)

    // Data
    const [loading, setLoading] = React.useState(true)
    const [logs, setLogs] = React.useState<AuditLogsResponse | null>(null)

    // Meta dialog
    const [metaOpen, setMetaOpen] = React.useState(false)
    const [metaTitle, setMetaTitle] = React.useState("Meta")
    const [metaJson, setMetaJson] = React.useState<string>("{}")

    const canApplyRange = React.useMemo(() => {
        // allow empty range (meaning no date filter)
        if (!range?.from && !range?.to) return true
        if (range?.from && range?.to) return from <= to
        // if only one side, backend will still accept (we send what exists)
        return true
    }, [range?.from, range?.to, from, to])

    const totalPages = React.useMemo(() => {
        const t = logs?.total ?? 0
        return Math.max(1, Math.ceil(t / limit))
    }, [logs?.total, limit])

    function openMeta(title: string, obj: unknown) {
        setMetaTitle(title)
        try {
            setMetaJson(JSON.stringify(obj ?? {}, null, 2))
        } catch {
            setMetaJson(String(obj ?? ""))
        }
        setMetaOpen(true)
    }

    const fetchAuditLogs = React.useCallback(async () => {
        setLoading(true)
        try {
            const roleParam = actorRole === "ALL" ? undefined : actorRole

            const res = await adminApi.listAuditLogs({
                page,
                limit,
                action: action.trim() || undefined,
                entityType: entityType.trim() || undefined,
                actorRole: roleParam as any,
                from: from || undefined,
                to: to || undefined,
            })

            setLogs(res)
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load audit logs."
            toast.error(msg)
        } finally {
            setLoading(false)
        }
    }, [page, limit, action, entityType, actorRole, from, to])

    React.useEffect(() => {
        void fetchAuditLogs()
    }, [fetchAuditLogs])

    return (
        <DashboardLayout title="Audit logs" navItems={ADMIN_NAV_ITEMS} user={dashboardUser} activePath={location.pathname}>
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                <Card className="min-w-0">
                    <CardHeader className="gap-2">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5" />
                                    Audit logs
                                </CardTitle>
                                <CardDescription>
                                    Filter and review admin/staff actions.
                                </CardDescription>
                            </div>

                            {/* XS: stack; desktop unchanged */}
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                <Select value={String(limit)} onValueChange={(v) => { setPage(1); setLimit(Number(v)) }}>
                                    <SelectTrigger className="w-full sm:w-36">
                                        <SelectValue placeholder="Rows" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[10, 20, 50, 100, 200].map((n) => (
                                            <SelectItem key={n} value={String(n)}>
                                                {n} / page
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Button
                                    variant="outline"
                                    onClick={() => void fetchAuditLogs()}
                                    className="w-full gap-2 sm:w-auto"
                                    disabled={loading}
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Refresh
                                </Button>

                                <Button
                                    onClick={() => {
                                        if (!canApplyRange) return toast.error("Pick a valid date range (start and end).")
                                        setPage(1)
                                        void fetchAuditLogs()
                                    }}
                                    className="w-full gap-2 sm:w-auto"
                                    disabled={loading || !canApplyRange}
                                >
                                    <CalendarDays className="h-4 w-4" />
                                    Apply
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        <div className="grid gap-4 md:grid-cols-12">
                            <div className="grid gap-2 md:col-span-4">
                                <Label>Date range</Label>
                                <DateRangePicker value={range} onChange={setRange} disabled={loading} />

                                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => { setPage(1); setRange({ from: new Date(), to: new Date() }) }}
                                    >
                                        Today
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => { setPage(1); setRange(lastNDaysRange(7)) }}
                                    >
                                        Last 7 days
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => { setPage(1); setRange(lastNDaysRange(30)) }}
                                    >
                                        Last 30 days
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => { setPage(1); setRange(undefined) }}
                                    >
                                        Clear
                                    </Button>
                                </div>

                                <div className="text-xs text-muted-foreground">
                                    API range: <span className="font-medium">{from || "—"}</span> →{" "}
                                    <span className="font-medium">{to || "—"}</span>
                                </div>
                            </div>

                            <div className="grid gap-2 md:col-span-3">
                                <Label htmlFor="audit-action">Action (optional)</Label>
                                <Input
                                    id="audit-action"
                                    value={action}
                                    onChange={(e) => setAction(e.target.value)}
                                    placeholder="e.g., ADMIN_UPDATE_USER"
                                    className="w-full min-w-0"
                                />
                                <div className="text-xs text-muted-foreground">
                                    Tip: backend matches action exactly (case-sensitive).
                                </div>
                            </div>

                            <div className="grid gap-2 md:col-span-3">
                                <Label htmlFor="audit-entity">Entity type (optional)</Label>
                                <Input
                                    id="audit-entity"
                                    value={entityType}
                                    onChange={(e) => setEntityType(e.target.value)}
                                    placeholder="e.g., User, Department"
                                    className="w-full min-w-0"
                                />
                            </div>

                            <div className="grid gap-2 md:col-span-2">
                                <Label>Actor role</Label>
                                <Select value={actorRole} onValueChange={(v) => { setPage(1); setActorRole(v as any) }}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All</SelectItem>
                                        <SelectItem value="ADMIN">ADMIN</SelectItem>
                                        <SelectItem value="STAFF">STAFF</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="min-w-0">
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex flex-wrap items-center gap-2 text-sm">
                                        <Badge variant="secondary">Total: {formatNumber(logs?.total ?? 0)}</Badge>
                                        <Badge variant="secondary">
                                            Page: {page} / {totalPages}
                                        </Badge>
                                        <Badge variant="secondary" className="gap-2">
                                            <Table2 className="h-4 w-4" />
                                            {formatNumber(logs?.logs?.length ?? 0)} rows
                                        </Badge>
                                    </div>

                                    {/* XS: stack; desktop unchanged */}
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <Button
                                            variant="outline"
                                            className="w-full sm:w-auto"
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            disabled={page <= 1}
                                        >
                                            Prev
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="w-full sm:w-auto"
                                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                            disabled={page >= totalPages}
                                        >
                                            Next
                                        </Button>
                                        <Button
                                            onClick={() => void fetchAuditLogs()}
                                            disabled={loading}
                                            className="w-full gap-2 sm:w-auto"
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                            Load
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-4 rounded-lg border overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>When</TableHead>
                                                <TableHead>Actor</TableHead>
                                                <TableHead className="hidden sm:table-cell">Role</TableHead>
                                                <TableHead>Action</TableHead>
                                                <TableHead className="hidden lg:table-cell">Entity</TableHead>
                                                <TableHead className="text-right">Meta</TableHead>
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody>
                                            {(logs?.logs ?? []).map((l) => (
                                                <TableRow key={l.id}>
                                                    <TableCell className="whitespace-nowrap">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">
                                                                {new Date(l.createdAt).toLocaleString()}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">{l.id}</span>
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="min-w-48">
                                                        <div className="flex min-w-0 flex-col">
                                                            <span className="truncate font-medium">{l.actorName || "—"}</span>
                                                            <span className="truncate text-xs text-muted-foreground">
                                                                {l.actorEmail || l.actorId || "—"}
                                                            </span>
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="hidden sm:table-cell">
                                                        <Badge variant={l.actorRole === "ADMIN" ? "default" : "secondary"}>
                                                            {l.actorRole ?? "—"}
                                                        </Badge>
                                                    </TableCell>

                                                    <TableCell className="font-medium">
                                                        <span className="wrap-break-word">{l.action}</span>
                                                    </TableCell>

                                                    <TableCell className="hidden lg:table-cell">
                                                        <div className="flex min-w-0 flex-col">
                                                            <span className="truncate">{l.entityType || "—"}</span>
                                                            <span className="truncate text-xs text-muted-foreground">{l.entityId || "—"}</span>
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="text-right">
                                                        {l.meta && Object.keys(l.meta).length ? (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => openMeta(`${l.action} • ${l.entityType ?? "Meta"}`, l.meta)}
                                                            >
                                                                View
                                                            </Button>
                                                        ) : (
                                                            <span className="text-sm text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}

                                            {(logs?.logs?.length ?? 0) === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                                                        No audit logs match your filters.
                                                    </TableCell>
                                                </TableRow>
                                            ) : null}
                                        </TableBody>
                                    </Table>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Meta viewer */}
            <Dialog open={metaOpen} onOpenChange={setMetaOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{metaTitle}</DialogTitle>
                    </DialogHeader>

                    <div className="rounded-lg border bg-muted/30 p-3">
                        <pre className="max-h-[60vh] overflow-auto text-xs leading-relaxed">{metaJson}</pre>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(metaJson)
                                    toast.success("Copied to clipboard.")
                                } catch {
                                    toast.error("Copy failed.")
                                }
                            }}
                        >
                            Copy
                        </Button>

                        <Button className="w-full sm:w-auto" onClick={() => setMetaOpen(false)}>
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    )
}
