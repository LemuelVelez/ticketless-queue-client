/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { Monitor, RefreshCw, Maximize2, Minimize2 } from "lucide-react"

import Header from "@/components/Header"
import Footer from "@/components/Footer"

import { studentApi, type Department } from "@/api/student"
import { api } from "@/lib/http"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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

function pickNonEmptyString(v: unknown) {
    return typeof v === "string" && v.trim() ? v.trim() : ""
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

export default function StudentDisplayPage() {
    const location = useLocation()

    const qs = React.useMemo(() => new URLSearchParams(location.search || ""), [location.search])
    const preDeptId = React.useMemo(() => pickNonEmptyString(qs.get("departmentId")), [qs])

    const [loadingDepts, setLoadingDepts] = React.useState(true)
    const [departments, setDepartments] = React.useState<Department[]>([])

    const [departmentId, setDepartmentId] = React.useState<string>("")
    const [departmentName, setDepartmentName] = React.useState<string>("—")

    const [loadingDisplay, setLoadingDisplay] = React.useState(true)
    const [busy, setBusy] = React.useState(false)

    const [nowServing, setNowServing] = React.useState<DisplayNowServing>(null)
    const [upNext, setUpNext] = React.useState<DisplayUpNextRow[]>([])

    const [autoRefresh, setAutoRefresh] = React.useState(true)

    // Presentation / fullscreen
    const [presentation, setPresentation] = React.useState(false)
    const presentationRequestedRef = React.useRef(false)
    const autoPresentDoneRef = React.useRef(false)

    const selectedDept = React.useMemo(
        () => departments.find((d) => d._id === departmentId) || null,
        [departments, departmentId],
    )

    const loadDepartments = React.useCallback(async () => {
        setLoadingDepts(true)
        try {
            const res = await studentApi.listDepartments()
            const list = res.departments ?? []
            setDepartments(list)

            const canUsePre = preDeptId && list.some((d) => d._id === preDeptId)
            const next = canUsePre ? preDeptId : list[0]?._id ?? ""
            setDepartmentId((prev) => prev || next)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load departments.")
            setDepartments([])
            setDepartmentId("")
        } finally {
            setLoadingDepts(false)
        }
    }, [preDeptId])

    const refreshDisplay = React.useCallback(
        async (deptId: string) => {
            if (!deptId) return
            setLoadingDisplay(true)
            try {
                const res = await api.get<DepartmentDisplayResponse>(`/display/${deptId}`, { auth: false })
                setDepartmentName(res.department?.name ?? selectedDept?.name ?? "—")
                setNowServing(res.nowServing ?? null)
                setUpNext(res.upNext ?? [])
            } catch (e: any) {
                toast.error(e?.message ?? "Failed to load display.")
                setDepartmentName(selectedDept?.name ?? "—")
                setNowServing(null)
                setUpNext([])
            } finally {
                setLoadingDisplay(false)
            }
        },
        [selectedDept?.name],
    )

    React.useEffect(() => {
        void loadDepartments()
    }, [loadDepartments])

    React.useEffect(() => {
        if (!departmentId) return
        void refreshDisplay(departmentId)
    }, [departmentId, refreshDisplay])

    React.useEffect(() => {
        if (!autoRefresh || !departmentId) return
        const t = window.setInterval(() => void refreshDisplay(departmentId), 5000)
        return () => window.clearInterval(t)
    }, [autoRefresh, departmentId, refreshDisplay])

    // Auto-enter presentation mode when /display?departmentId=...&present=1
    React.useEffect(() => {
        if (autoPresentDoneRef.current) return
        const shouldPresent = parseBool(qs.get("present"))
        if (!shouldPresent) return

        autoPresentDoneRef.current = true
        void enterPresentation()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search])

    // Keep presentation state in sync if user presses ESC
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
        if (!departmentId) return
        setBusy(true)
        try {
            await refreshDisplay(departmentId)
        } finally {
            setBusy(false)
        }
    }

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

    // ✅ Presentation overlay (big screen)
    if (presentation) {
        const bigNumberClass = "text-7xl sm:text-8xl md:text-9xl font-semibold tracking-tight leading-none"

        return (
            <div className="fixed inset-0 z-50 bg-background">
                <div className="flex h-full w-full flex-col">
                    <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">Department: {departmentName}</Badge>
                                {departmentId ? <Badge variant="secondary">Dept ID: {departmentId}</Badge> : null}
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

                            <Button variant="outline" onClick={() => void onManualRefresh()} disabled={busy || !departmentId} className="gap-2">
                                <RefreshCw className="h-4 w-4" />
                                Refresh
                            </Button>

                            <Button variant="secondary" onClick={() => void exitPresentation()} className="gap-2">
                                <Minimize2 className="h-4 w-4" />
                                Exit
                            </Button>
                        </div>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col gap-6 p-4 lg:flex-row lg:p-8">
                        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border bg-muted p-6">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">NOW SERVING</div>
                                {nowServing ? <Badge>CALLED</Badge> : <Badge variant="secondary">—</Badge>}
                            </div>

                            <div className="mt-4 flex flex-1 flex-col justify-center">
                                {loadingDisplay ? (
                                    <div className="text-center text-lg text-muted-foreground">Loading…</div>
                                ) : nowServing ? (
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

                        <div className="w-full max-w-none rounded-2xl border p-6 lg:w-105">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-medium">UP NEXT</div>
                                <Badge variant="secondary">{upNext.length}</Badge>
                            </div>

                            <div className="mt-4 grid gap-3">
                                {loadingDisplay ? (
                                    <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading…</div>
                                ) : upNext.length === 0 ? (
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

    // ✅ Normal page (student/public)
    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header variant="student" />

            <main className="mx-auto w-full max-w-4xl px-4 py-10">
                <div className="mb-6">
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <Monitor className="h-6 w-6" />
                        Public Display
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Live queue updates for your selected department.
                    </p>
                </div>

                <Card className="min-w-0">
                    <CardHeader className="gap-2">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <CardTitle>Department Display</CardTitle>
                                <CardDescription>Now Serving + Up Next. Auto updates every 5 seconds.</CardDescription>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <Button
                                    variant="outline"
                                    onClick={() => void onManualRefresh()}
                                    disabled={busy || !departmentId}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Refresh
                                </Button>

                                <Button
                                    variant="secondary"
                                    onClick={() => void enterPresentation()}
                                    disabled={!departmentId}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <Maximize2 className="h-4 w-4" />
                                    Presentation
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                            <div className="min-w-0 space-y-2">
                                <Label>Department</Label>
                                {loadingDepts ? (
                                    <Skeleton className="h-10 w-full" />
                                ) : (
                                    <Select value={departmentId} onValueChange={setDepartmentId} disabled={busy || !departments.length}>
                                        <SelectTrigger className="w-full min-w-0">
                                            <SelectValue placeholder="Select department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {departments.map((d) => (
                                                <SelectItem key={d._id} value={d._id}>
                                                    {d.name}
                                                    {d.code ? ` (${d.code})` : ""}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            <div className="flex items-center gap-2 md:justify-end">
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

                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Badge variant="secondary">Department: {departmentName}</Badge>
                            {departmentId ? <Badge variant="secondary">Dept ID: {departmentId}</Badge> : null}
                        </div>
                    </CardHeader>

                    <CardContent className="min-w-0">
                        {!departmentId && !loadingDepts ? (
                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                Please select a department to view the display.
                            </div>
                        ) : loadingDepts || loadingDisplay ? (
                            <div className="space-y-3">
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-48 w-full" />
                                <Skeleton className="h-40 w-full" />
                            </div>
                        ) : (
                            <div className="grid gap-6 lg:grid-cols-12">
                                <Card className="lg:col-span-7">
                                    <CardHeader>
                                        <CardTitle>Now serving</CardTitle>
                                        <CardDescription>Latest called ticket for this department.</CardDescription>
                                    </CardHeader>

                                    <CardContent>
                                        {nowServing ? (
                                            <div className="rounded-2xl border bg-muted p-6">
                                                <div className="text-sm text-muted-foreground">NOW SERVING</div>
                                                <div className="mt-1 text-6xl font-semibold tracking-tight">#{nowServing.queueNumber}</div>
                                                <div className="mt-2 text-sm text-muted-foreground">
                                                    Window: {nowServing.windowNumber ? `#${nowServing.windowNumber}` : "—"}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    Called at: {fmtTime(nowServing.calledAt)}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                                No ticket is currently being called.
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

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
            </main>

            <Footer variant="student" />
        </div>
    )
}
