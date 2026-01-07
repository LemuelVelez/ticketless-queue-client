/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { Monitor, RefreshCw, Maximize2, Minimize2, Copy, ExternalLink } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { STAFF_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { useSession } from "@/hooks/use-session"
import { staffApi } from "@/api/staff"
import { api } from "@/lib/http"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

type DisplayNowServing = {
    id: string
    queueNumber: number
    windowNumber: number | null
    calledAt: string | null
} | null

type DisplayUpNextRow = {
    id: string
    queueNumber: number
}

type DepartmentDisplayResponse = {
    department: { id: string; name: string }
    nowServing: DisplayNowServing
    upNext: DisplayUpNextRow[]
}

function parseBool(v: unknown): boolean {
    if (typeof v === "boolean") return v
    if (typeof v !== "string") return false
    const s = v.trim().toLowerCase()
    return s === "1" || s === "true" || s === "yes" || s === "y" || s === "on"
}

function fmtTime(v?: string | null) {
    if (!v) return "—"
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString()
}

function stripTrailingSlash(s: string) {
    return s.endsWith("/") ? s.slice(0, -1) : s
}

function joinUrl(base: string, path: string) {
    const b = stripTrailingSlash(base || "")
    const p = path.startsWith("/") ? path : `/${path}`
    return b ? `${b}${p}` : p
}

function getClientPublicUrl() {
    // ✅ Prefer VITE_CLIENT_PUBLIC_URL for QR/redirect links
    const envBase = String((import.meta as any)?.env?.VITE_CLIENT_PUBLIC_URL ?? "").trim()
    if (envBase) return stripTrailingSlash(envBase)

    // Fallback (dev/local)
    if (typeof window !== "undefined") return stripTrailingSlash(window.location.origin)
    return ""
}

async function copyToClipboard(text: string) {
    try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
            return true
        }
    } catch {
        // ignore
    }
    // fallback
    try {
        window.prompt("Copy this link:", text)
        return true
    } catch {
        return false
    }
}

export default function StaffDisplayPage() {
    const location = useLocation()
    const { user: sessionUser } = useSession()

    const dashboardUser: DashboardUser | undefined = React.useMemo(() => {
        if (!sessionUser) return undefined
        return {
            name: sessionUser.name ?? "Staff",
            email: sessionUser.email ?? "",
            avatarUrl: (sessionUser as any)?.avatarUrl ?? undefined,
        }
    }, [sessionUser])

    const [loading, setLoading] = React.useState(true)
    const [busy, setBusy] = React.useState(false)

    const [departmentId, setDepartmentId] = React.useState<string | null>(null)
    const [departmentName, setDepartmentName] = React.useState<string>("—")

    const [nowServing, setNowServing] = React.useState<DisplayNowServing>(null)
    const [upNext, setUpNext] = React.useState<DisplayUpNextRow[]>([])

    const [autoRefresh, setAutoRefresh] = React.useState(true)

    // ✅ Presentation mode (overlay + optional browser fullscreen)
    const [presentation, setPresentation] = React.useState(false)
    const presentationRequestedRef = React.useRef(false)
    const autoPresentDoneRef = React.useRef(false)

    const assignedOk = Boolean(departmentId)

    const clientPublicBase = React.useMemo(() => getClientPublicUrl(), [])

    // ✅ These are the links you can embed into your QR code
    // - staffDisplayUrl: opens this staff page (requires login)
    // - publicDisplayUrl: suggested public route using departmentId (adjust if your public route differs)
    const staffDisplayUrl = React.useMemo(() => joinUrl(clientPublicBase, "/staff/display"), [clientPublicBase])

    const publicDisplayUrl = React.useMemo(() => {
        if (!departmentId) return ""
        // Common pattern: /display?departmentId=...
        return joinUrl(clientPublicBase, `/display?departmentId=${encodeURIComponent(departmentId)}`)
    }, [clientPublicBase, departmentId])

    const refresh = React.useCallback(async () => {
        try {
            const a = await staffApi.myAssignment()
            const deptId = a.departmentId ?? null
            setDepartmentId(deptId)

            if (!deptId) {
                setDepartmentName("—")
                setNowServing(null)
                setUpNext([])
                return
            }

            // Public display API endpoint (no auth required)
            const res = await api.get<DepartmentDisplayResponse>(`/display/${deptId}`, { auth: false })
            setDepartmentName(res.department?.name ?? "—")
            setNowServing(res.nowServing ?? null)
            setUpNext(res.upNext ?? [])
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load public display data.")
        }
    }, [])

    async function enterPresentation() {
        setPresentation(true)
        try {
            presentationRequestedRef.current = true
            await document.documentElement.requestFullscreen()
        } catch {
            presentationRequestedRef.current = false
        }
    }

    async function exitPresentation() {
        setPresentation(false)
        try {
            if (document.fullscreenElement) await document.exitFullscreen()
        } catch {
            // ignore
        } finally {
            presentationRequestedRef.current = false
        }
    }

    React.useEffect(() => {
        ; (async () => {
            setLoading(true)
            try {
                await refresh()
            } finally {
                setLoading(false)
            }
        })()
    }, [refresh])

    // ✅ Auto-enter Presentation Mode when opening /staff/display?present=1
    React.useEffect(() => {
        if (autoPresentDoneRef.current) return
        const qs = new URLSearchParams(location.search || "")
        const shouldPresent = parseBool(qs.get("present"))
        if (!shouldPresent) return

        autoPresentDoneRef.current = true
        void enterPresentation()
         
    }, [location.search])

    React.useEffect(() => {
        if (!autoRefresh) return
        const t = window.setInterval(() => void refresh(), 5000)
        return () => window.clearInterval(t)
    }, [autoRefresh, refresh])

    // Keep presentation state in sync if user presses ESC to exit fullscreen
    React.useEffect(() => {
        const onFsChange = () => {
            const isFs = typeof document !== "undefined" && !!document.fullscreenElement
            if (presentation && presentationRequestedRef.current && !isFs) {
                presentationRequestedRef.current = false
                setPresentation(false)
            }
        }
        document.addEventListener("fullscreenchange", onFsChange)
        return () => document.removeEventListener("fullscreenchange", onFsChange)
    }, [presentation])

    async function onManualRefresh() {
        setBusy(true)
        try {
            await refresh()
        } finally {
            setBusy(false)
        }
    }

    async function onCopy(url: string) {
        if (!url) return
        const ok = await copyToClipboard(url)
        if (ok) toast.success("Link copied.")
        else toast.error("Failed to copy link.")
    }

    function onOpen(url: string) {
        if (!url) return
        window.open(url, "_blank", "noopener,noreferrer")
    }

    // ✅ Presentation overlay
    if (presentation) {
        const bigNumberClass = "text-7xl sm:text-8xl md:text-9xl font-semibold tracking-tight leading-none"

        return (
            <div className="fixed inset-0 z-50 bg-background">
                <div className="flex h-full w-full flex-col">
                    {/* Top bar */}
                    <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">Department: {departmentName}</Badge>
                                <Badge variant="secondary">Dept ID: {departmentId ?? "—"}</Badge>
                                {!assignedOk ? <Badge variant="destructive">Not assigned</Badge> : null}
                            </div>
                            <div className="mt-2 text-sm text-muted-foreground">Auto refresh: {autoRefresh ? "On" : "Off"} • Updates every 5s</div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="flex items-center gap-2">
                                <Switch
                                    id="autoRefreshPm"
                                    checked={autoRefresh}
                                    onCheckedChange={(v) => setAutoRefresh(Boolean(v))}
                                    disabled={busy}
                                />
                                <Label htmlFor="autoRefreshPm" className="text-sm">
                                    Auto refresh
                                </Label>
                            </div>

                            <Button variant="outline" onClick={() => void onManualRefresh()} disabled={busy} className="gap-2">
                                <RefreshCw className="h-4 w-4" />
                                Refresh
                            </Button>

                            <Button variant="secondary" onClick={() => void exitPresentation()} className="gap-2">
                                <Minimize2 className="h-4 w-4" />
                                Exit
                            </Button>
                        </div>
                    </div>

                    {/* Main content */}
                    <div className="flex min-h-0 flex-1 flex-col gap-6 p-4 lg:flex-row lg:p-8">
                        {/* Now serving */}
                        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border bg-muted p-6">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">NOW SERVING</div>
                                {nowServing ? <Badge>CALLED</Badge> : <Badge variant="secondary">—</Badge>}
                            </div>

                            <div className="mt-4 flex flex-1 flex-col justify-center">
                                {nowServing ? (
                                    <>
                                        <div className={bigNumberClass}>#{nowServing.queueNumber}</div>
                                        <div className="mt-4 text-lg text-muted-foreground">
                                            Window: {nowServing.windowNumber ? `#${nowServing.windowNumber}` : "—"}
                                        </div>
                                        <div className="mt-1 text-sm text-muted-foreground">
                                            Called at: {fmtTime(nowServing.calledAt)}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center text-lg text-muted-foreground">No ticket is currently being called.</div>
                                )}
                            </div>
                        </div>

                        {/* Up next */}
                        <div className="w-full max-w-none rounded-2xl border p-6 lg:w-105">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-medium">UP NEXT</div>
                                <Badge variant="secondary">{upNext.length}</Badge>
                            </div>

                            <div className="mt-4 grid gap-3">
                                {upNext.length === 0 ? (
                                    <div className="rounded-lg border p-4 text-sm text-muted-foreground">No waiting tickets.</div>
                                ) : (
                                    upNext.map((t) => (
                                        <div key={t.id} className="flex items-center justify-between rounded-xl border p-4">
                                            <div className="text-3xl font-semibold">#{t.queueNumber}</div>
                                            <div className="text-right text-xs text-muted-foreground">Up next</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ✅ Normal dashboard layout
    return (
        <DashboardLayout title="Display" navItems={STAFF_NAV_ITEMS} user={dashboardUser} activePath={location.pathname}>
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                <Card className="min-w-0">
                    <CardHeader className="gap-2">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <CardTitle className="flex items-center gap-2">
                                    <Monitor className="h-5 w-5" />
                                    Staff Display
                                </CardTitle>
                                <CardDescription>
                                    Department public display data (based on your assignment). Links below use <b>VITE_CLIENT_PUBLIC_URL</b>.
                                </CardDescription>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <Button
                                    variant="outline"
                                    onClick={() => void onManualRefresh()}
                                    disabled={loading || busy}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Refresh
                                </Button>

                                <Button
                                    variant="secondary"
                                    onClick={() => void enterPresentation()}
                                    disabled={busy}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <Maximize2 className="h-4 w-4" />
                                    Presentation
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="secondary">Department: {departmentName}</Badge>
                                <Badge variant="secondary">Dept ID: {departmentId ?? "—"}</Badge>
                                {!assignedOk ? <Badge variant="destructive">Not assigned</Badge> : null}
                            </div>

                            <div className="flex items-center gap-2">
                                <Switch
                                    id="autoRefresh"
                                    checked={autoRefresh}
                                    onCheckedChange={(v) => setAutoRefresh(Boolean(v))}
                                    disabled={busy}
                                />
                                <Label htmlFor="autoRefresh" className="text-sm">
                                    Auto refresh
                                </Label>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="min-w-0">
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-48 w-full" />
                                <Skeleton className="h-40 w-full" />
                            </div>
                        ) : !assignedOk ? (
                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                You are not assigned to a department. Please ask an admin to assign your department.
                            </div>
                        ) : (
                            <div className="grid gap-6 lg:grid-cols-12">
                                {/* Share links (QR code destination) */}
                                <Card className="lg:col-span-12">
                                    <CardHeader>
                                        <CardTitle>QR / Redirect Links</CardTitle>
                                        <CardDescription>
                                            Use these URLs as your QR code target. Base comes from <b>VITE_CLIENT_PUBLIC_URL</b>.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="rounded-lg border p-4">
                                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium">Staff Display (requires login)</div>
                                                    <div className="break-all text-xs text-muted-foreground">{staffDisplayUrl}</div>
                                                </div>
                                                <div className="flex flex-col gap-2 sm:flex-row">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="gap-2"
                                                        onClick={() => void onCopy(staffDisplayUrl)}
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                        Copy
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        className="gap-2"
                                                        onClick={() => onOpen(staffDisplayUrl)}
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                        Open
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-lg border p-4">
                                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium">Public Display (department-specific)</div>
                                                    <div className="break-all text-xs text-muted-foreground">
                                                        {publicDisplayUrl || "—"}
                                                    </div>
                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                        If your public route uses a different format, adjust this path in this file.
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 sm:flex-row">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="gap-2"
                                                        disabled={!publicDisplayUrl}
                                                        onClick={() => void onCopy(publicDisplayUrl)}
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                        Copy
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        className="gap-2"
                                                        disabled={!publicDisplayUrl}
                                                        onClick={() => onOpen(publicDisplayUrl)}
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                        Open
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Now serving */}
                                <Card className="lg:col-span-7">
                                    <CardHeader>
                                        <CardTitle>Now serving</CardTitle>
                                        <CardDescription>Latest called ticket for your department.</CardDescription>
                                    </CardHeader>

                                    <CardContent>
                                        {nowServing ? (
                                            <div className="rounded-2xl border bg-muted p-6">
                                                <div className="text-sm text-muted-foreground">NOW SERVING</div>
                                                <div className="mt-1 text-6xl font-semibold tracking-tight">#{nowServing.queueNumber}</div>
                                                <div className="mt-2 text-sm text-muted-foreground">
                                                    Window: {nowServing.windowNumber ? `#${nowServing.windowNumber}` : "—"}
                                                </div>
                                                <div className="text-sm text-muted-foreground">Called at: {fmtTime(nowServing.calledAt)}</div>
                                            </div>
                                        ) : (
                                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                                No ticket is currently being called.
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Up next */}
                                <Card className="lg:col-span-5">
                                    <CardHeader>
                                        <CardTitle>Up next</CardTitle>
                                        <CardDescription>Next waiting tickets (oldest first).</CardDescription>
                                    </CardHeader>

                                    <CardContent>
                                        {upNext.length === 0 ? (
                                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">No waiting tickets.</div>
                                        ) : (
                                            <div className="grid gap-3">
                                                {upNext.map((t) => (
                                                    <div key={t.id} className="flex items-center justify-between rounded-xl border p-4">
                                                        <div className="text-2xl font-semibold">#{t.queueNumber}</div>
                                                        <Badge variant="secondary">Waiting</Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
