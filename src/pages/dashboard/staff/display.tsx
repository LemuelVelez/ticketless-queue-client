/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { Monitor, RefreshCw } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { STAFF_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { useSession } from "@/hooks/use-session"
import { staffApi, type StaffDisplaySnapshotResponse } from "@/api/staff"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

type DisplayNowServing = StaffDisplaySnapshotResponse["nowServing"]
type DisplayUpNextRow = StaffDisplaySnapshotResponse["upNext"][number]

function fmtTime(v?: string | null) {
    if (!v) return "—"
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString()
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
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
    const [generatedAt, setGeneratedAt] = React.useState<string | null>(null)

    const [autoRefresh, setAutoRefresh] = React.useState(true)
    const [refreshEveryMs, setRefreshEveryMs] = React.useState(5000)

    const assignedOk = Boolean(departmentId)

    const refresh = React.useCallback(async () => {
        try {
            const snap = await staffApi.getDisplaySnapshot()

            setDepartmentId(snap.department?.id ?? null)
            setDepartmentName(snap.department?.name ?? "—")
            setNowServing(snap.nowServing ?? null)
            setUpNext(Array.isArray(snap.upNext) ? snap.upNext : [])
            setGeneratedAt(snap.meta?.generatedAt ?? null)

            const refreshMs = clamp(Number(snap.meta?.refreshMs ?? 5000), 2000, 60000)
            setRefreshEveryMs(refreshMs)
        } catch (e: any) {
            const status = Number(e?.status || 0)
            if (status === 400) {
                // staff not assigned -> render empty/assigned message without toast spam
                setDepartmentId(null)
                setDepartmentName("—")
                setNowServing(null)
                setUpNext([])
                setGeneratedAt(null)
                return
            }
            toast.error(e?.message ?? "Failed to load display snapshot.")
        }
    }, [])

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

    React.useEffect(() => {
        if (!autoRefresh) return
        const intervalMs = clamp(refreshEveryMs, 2000, 60000)
        const t = window.setInterval(() => void refresh(), intervalMs)
        return () => window.clearInterval(t)
    }, [autoRefresh, refresh, refreshEveryMs])

    async function onManualRefresh() {
        setBusy(true)
        try {
            await refresh()
        } finally {
            setBusy(false)
        }
    }

    return (
        <DashboardLayout title="Display Preview" navItems={STAFF_NAV_ITEMS} user={dashboardUser} activePath={location.pathname}>
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                <Card className="min-w-0">
                    <CardHeader className="gap-2">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <CardTitle className="flex items-center gap-2">
                                    <Monitor className="h-5 w-5" />
                                    Student/Alumni/Visitor Display Preview
                                </CardTitle>
                                <CardDescription>
                                    Read-only preview of the public queue screen seen by students, alumni, and visitors.
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
                            </div>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="secondary">Department: {departmentName}</Badge>
                                <Badge variant="secondary">Dept ID: {departmentId ?? "—"}</Badge>
                                {!assignedOk ? <Badge variant="destructive">Not assigned</Badge> : null}
                                <Badge variant="outline">Refresh: {Math.round(refreshEveryMs / 1000)}s</Badge>
                                <Badge variant="outline">Updated: {fmtTime(generatedAt)}</Badge>
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
                                <Skeleton className="h-20 w-full" />
                                <Skeleton className="h-64 w-full" />
                            </div>
                        ) : !assignedOk ? (
                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                You are not assigned to a department. Please ask an admin to assign your department.
                            </div>
                        ) : (
                            <Card className="overflow-hidden">
                                <CardHeader>
                                    <CardTitle>Public Queue Board Preview</CardTitle>
                                    <CardDescription>
                                        This mirrors the participant-facing queue board: now serving and up next.
                                    </CardDescription>
                                </CardHeader>

                                <CardContent>
                                    <div className="grid gap-6 lg:grid-cols-12">
                                        {/* Now serving */}
                                        <div className="lg:col-span-7">
                                            <div className="rounded-2xl border bg-muted p-6">
                                                <div className="flex items-center justify-between">
                                                    <div className="text-sm uppercase tracking-widest text-muted-foreground">
                                                        Now serving
                                                    </div>
                                                    {nowServing ? <Badge>CALLED</Badge> : <Badge variant="secondary">—</Badge>}
                                                </div>

                                                <div className="mt-4">
                                                    {nowServing ? (
                                                        <>
                                                            <div className="text-[clamp(4rem,12vw,9rem)] font-semibold leading-none tracking-tight">
                                                                #{nowServing.queueNumber}
                                                            </div>
                                                            <div className="mt-4 text-sm text-muted-foreground">
                                                                Window: {nowServing.windowNumber ? `#${nowServing.windowNumber}` : "—"}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground">
                                                                Called at: {fmtTime(nowServing.calledAt)}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
                                                            No ticket is currently being called.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Up next */}
                                        <div className="lg:col-span-5">
                                            <div className="rounded-2xl border p-6">
                                                <div className="mb-4 flex items-center justify-between">
                                                    <div className="text-sm uppercase tracking-widest text-muted-foreground">
                                                        Up next
                                                    </div>
                                                    <Badge variant="secondary">{upNext.length}</Badge>
                                                </div>

                                                {upNext.length === 0 ? (
                                                    <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                                                        No waiting tickets.
                                                    </div>
                                                ) : (
                                                    <div className="grid gap-3">
                                                        {upNext.slice(0, 8).map((t, idx) => (
                                                            <div key={t.id} className="flex items-center justify-between rounded-xl border p-4">
                                                                <div className="text-2xl font-semibold">#{t.queueNumber}</div>
                                                                <Badge variant={idx === 0 ? "default" : "secondary"}>
                                                                    {idx === 0 ? "Next" : "Waiting"}
                                                                </Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
