/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { toast } from "sonner"
import { Ticket, RefreshCw } from "lucide-react"

import Header from "@/components/Header"
import Footer from "@/components/Footer"

import { studentApi, type Department, type Ticket as TicketType } from "@/api/student"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

function pickNonEmptyString(v: unknown) {
    return typeof v === "string" && v.trim() ? v.trim() : ""
}

function normalizeMobile(value: string) {
    return value.replace(/[^\d+]/g, "").trim()
}

function deptNameFromTicketDepartment(dept: any, fallback?: string) {
    if (!dept) return fallback ?? "—"
    if (typeof dept === "string") return fallback ?? "—"
    return pickNonEmptyString(dept?.name) || fallback || "—"
}

function statusBadgeVariant(status?: string) {
    switch (status) {
        case "WAITING":
            return "outline"
        case "CALLED":
            return "default"
        case "HOLD":
            return "secondary"
        case "SERVED":
            return "default"
        case "OUT":
            return "secondary"
        default:
            return "secondary"
    }
}

export default function AlumniMyTicketsPage() {
    const location = useLocation()

    const qs = React.useMemo(() => new URLSearchParams(location.search || ""), [location.search])
    const preDeptId = React.useMemo(() => pickNonEmptyString(qs.get("departmentId")), [qs])
    const preMobile = React.useMemo(() => pickNonEmptyString(qs.get("mobileNumber") || qs.get("phone")), [qs])
    const ticketId = React.useMemo(() => pickNonEmptyString(qs.get("ticketId") || qs.get("id")), [qs])

    const [loadingDepts, setLoadingDepts] = React.useState(true)
    const [departments, setDepartments] = React.useState<Department[]>([])

    const [departmentId, setDepartmentId] = React.useState<string>("")
    const [mobileNumber, setMobileNumber] = React.useState<string>(preMobile)

    const [ticket, setTicket] = React.useState<TicketType | null>(null)
    const [busy, setBusy] = React.useState(false)
    const [autoRefresh, setAutoRefresh] = React.useState(false)

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

    const findActive = React.useCallback(async () => {
        const mobile = normalizeMobile(mobileNumber)
        if (!departmentId) return toast.error("Please select a department.")
        if (!mobile) return toast.error("Please enter your mobile number.")

        setBusy(true)
        try {
            const res = await studentApi.findActiveByStudent({
                departmentId,
                studentId: mobile,
            })

            setTicket(res.ticket ?? null)

            if (res.ticket) {
                toast.success("Active ticket found.")
            } else {
                toast.message("No active ticket found for today.")
            }
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to find active ticket.")
        } finally {
            setBusy(false)
        }
    }, [departmentId, mobileNumber])

    const loadTicketById = React.useCallback(async () => {
        if (!ticketId) return
        setBusy(true)
        try {
            const res = await studentApi.getTicket(ticketId)
            setTicket(res.ticket ?? null)

            const dept = (res.ticket as any)?.department
            const deptIdFromTicket =
                typeof dept === "string" ? dept : pickNonEmptyString(dept?._id) || pickNonEmptyString(dept?.id)

            if (deptIdFromTicket) setDepartmentId(deptIdFromTicket)

            const sid = pickNonEmptyString((res.ticket as any)?.studentId)
            if (sid) setMobileNumber(sid)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load ticket.")
        } finally {
            setBusy(false)
        }
    }, [ticketId])

    React.useEffect(() => {
        void loadDepartments()
    }, [loadDepartments])

    React.useEffect(() => {
        void loadTicketById()
    }, [loadTicketById])

    React.useEffect(() => {
        if (!autoRefresh) return
        if (!departmentId || !normalizeMobile(mobileNumber)) return

        const t = window.setInterval(() => {
            void findActive()
        }, 7000)

        return () => window.clearInterval(t)
    }, [autoRefresh, departmentId, mobileNumber, findActive])

    const ticketDeptName = React.useMemo(() => {
        if (!ticket) return "—"
        return deptNameFromTicketDepartment(ticket.department, selectedDept?.name)
    }, [ticket, selectedDept?.name])

    const joinUrl = React.useMemo(() => {
        const q = new URLSearchParams()
        if (departmentId) q.set("departmentId", departmentId)
        if (mobileNumber.trim()) q.set("mobileNumber", mobileNumber.trim())
        const qsStr = q.toString()
        return `/queue/join${qsStr ? `?${qsStr}` : ""}`
    }, [departmentId, mobileNumber])

    const displayUrl = React.useMemo(() => {
        if (!departmentId) return "/display"
        return `/display?departmentId=${encodeURIComponent(departmentId)}`
    }, [departmentId])

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header variant="student" />

            <main className="mx-auto w-full max-w-3xl px-4 py-10">
                <div className="mb-6">
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <Ticket className="h-6 w-6" />
                        My Tickets
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Lookup your current active queue ticket using your mobile number.
                    </p>
                </div>

                <div className="grid gap-6">
                    <Card className="min-w-0">
                        <CardHeader>
                            <CardTitle>Find Active Ticket</CardTitle>
                            <CardDescription>Enter your department and mobile number.</CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-5">
                            {loadingDepts ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : (
                                <>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2 min-w-0">
                                            <Label>Department</Label>
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
                                        </div>

                                        <div className="space-y-2 min-w-0">
                                            <Label htmlFor="mobile">Mobile Number</Label>
                                            <Input
                                                id="mobile"
                                                value={mobileNumber}
                                                onChange={(e) => setMobileNumber(e.target.value)}
                                                placeholder="e.g. 09xxxxxxxxx"
                                                autoComplete="tel"
                                                inputMode="tel"
                                                disabled={busy}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                id="autoRefresh"
                                                checked={autoRefresh}
                                                onCheckedChange={(v) => setAutoRefresh(Boolean(v))}
                                                disabled={busy}
                                            />
                                            <Label htmlFor="autoRefresh" className="text-sm">
                                                Auto refresh every 7s
                                            </Label>
                                        </div>

                                        <div className="flex gap-2">
                                            <Button variant="outline" onClick={() => void findActive()} disabled={busy}>
                                                {busy ? "Please wait…" : "Find Ticket"}
                                            </Button>
                                            <Button onClick={() => void findActive()} disabled={busy} className="gap-2">
                                                <RefreshCw className="h-4 w-4" />
                                                Refresh
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {ticket ? (
                        <Card className="min-w-0">
                            <CardHeader>
                                <CardTitle>Active Ticket</CardTitle>
                                <CardDescription>Current ticket details for today.</CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                <div className="rounded-2xl border bg-muted p-6">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="text-sm text-muted-foreground">Department</div>
                                            <div className="truncate text-lg font-medium">{ticketDeptName}</div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Badge variant={statusBadgeVariant(ticket.status) as any}>{ticket.status}</Badge>
                                            <Badge variant="secondary">{ticket.dateKey}</Badge>
                                        </div>
                                    </div>

                                    <Separator className="my-5" />

                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                        <div>
                                            <div className="text-sm text-muted-foreground">Queue Number</div>
                                            <div className="mt-1 text-6xl font-semibold tracking-tight">#{ticket.queueNumber}</div>
                                        </div>

                                        <div className="text-sm text-muted-foreground">
                                            Ticket ID: <span className="font-mono">{ticket._id}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2">
                                    <Button asChild variant="outline" className="w-full">
                                        <Link to={displayUrl}>Open Public Display</Link>
                                    </Button>
                                    <Button asChild variant="secondary" className="w-full">
                                        <Link to={joinUrl}>Join Again</Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="pt-6">
                                <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                    No active ticket loaded yet. Use <b>Find Ticket</b> above.
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>

            <Footer variant="student" />
        </div>
    )
}
