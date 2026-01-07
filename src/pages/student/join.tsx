/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { toast } from "sonner"

import Header from "@/components/Header"
import Footer from "@/components/Footer"

import { studentApi, type Department, type Ticket } from "@/api/student"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

function pickNonEmptyString(v: unknown) {
    return typeof v === "string" && v.trim() ? v.trim() : ""
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

export default function StudentJoinPage() {
    const location = useLocation()

    const qs = React.useMemo(() => new URLSearchParams(location.search || ""), [location.search])
    const preDeptId = React.useMemo(() => pickNonEmptyString(qs.get("departmentId")), [qs])
    const preStudentId = React.useMemo(() => pickNonEmptyString(qs.get("studentId")), [qs])
    const ticketId = React.useMemo(() => pickNonEmptyString(qs.get("ticketId") || qs.get("id")), [qs])

    const [loadingDepts, setLoadingDepts] = React.useState(true)
    const [departments, setDepartments] = React.useState<Department[]>([])

    const [departmentId, setDepartmentId] = React.useState<string>("")
    const [studentId, setStudentId] = React.useState<string>(preStudentId)
    const [phone, setPhone] = React.useState<string>("")

    const [busy, setBusy] = React.useState(false)
    const [ticket, setTicket] = React.useState<Ticket | null>(null)

    const selectedDept = React.useMemo(
        () => departments.find((d) => d._id === departmentId) || null,
        [departments, departmentId],
    )

    const publicDisplayUrl = React.useMemo(() => {
        if (!departmentId) return ""
        return `/display?departmentId=${encodeURIComponent(departmentId)}`
    }, [departmentId])

    const loadDepartments = React.useCallback(async () => {
        setLoadingDepts(true)
        try {
            const res = await studentApi.listDepartments()
            const list = res.departments ?? []
            setDepartments(list)

            // Choose initial department
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
            if ((res.ticket as any)?.studentId) setStudentId(String((res.ticket as any).studentId))
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

    async function onFindActive() {
        const sid = studentId.trim()
        if (!departmentId) return toast.error("Please select a department.")
        if (!sid) return toast.error("Please enter your Student ID.")

        setBusy(true)
        try {
            const res = await studentApi.findActiveByStudent({ departmentId, studentId: sid })
            if (res.ticket) {
                setTicket(res.ticket)
                toast.success("Active ticket found.")
            } else {
                setTicket(null)
                toast.message("No active ticket found for today.")
            }
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to find active ticket.")
        } finally {
            setBusy(false)
        }
    }

    async function onJoin() {
        const sid = studentId.trim()
        const ph = phone.trim()

        if (!departmentId) return toast.error("Please select a department.")
        if (!sid) return toast.error("Student ID is required.")

        setBusy(true)
        try {
            const res = await studentApi.joinQueue({
                departmentId,
                studentId: sid,
                phone: ph || undefined,
            })
            setTicket(res.ticket)
            toast.success("You are now in the queue.")
        } catch (e: any) {
            const status = (e as any)?.status
            const existing = (e as any)?.data?.ticket
            if (status === 409 && existing) {
                setTicket(existing as Ticket)
                toast.message("You already have an active ticket for today.")
                return
            }
            toast.error(e?.message ?? "Failed to join queue.")
        } finally {
            setBusy(false)
        }
    }

    const ticketDeptName = React.useMemo(() => {
        if (!ticket) return "—"
        return deptNameFromTicketDepartment(ticket.department, selectedDept?.name)
    }, [ticket, selectedDept?.name])

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* ✅ Dedicated public header/footer for join page */}
            <Header variant="student" />

            <main className="mx-auto w-full max-w-3xl px-4 py-10">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold tracking-tight">Join Queue</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Select a department and enter your Student ID to get a queue number.
                    </p>
                </div>

                <div className="grid gap-6">
                    <Card className="min-w-0">
                        <CardHeader>
                            <CardTitle>Queue Entry</CardTitle>
                            <CardDescription>
                                If you already joined today, you can use <b>Find my ticket</b> instead.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-5">
                            {loadingDepts ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-full" />
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
                                            {!departments.length ? (
                                                <div className="text-xs text-muted-foreground">No departments available.</div>
                                            ) : null}
                                        </div>

                                        <div className="space-y-2 min-w-0">
                                            <Label htmlFor="studentId">Student ID</Label>
                                            <Input
                                                id="studentId"
                                                value={studentId}
                                                onChange={(e) => setStudentId(e.target.value)}
                                                placeholder="e.g. TC-20-A-00001"
                                                autoComplete="off"
                                                inputMode="text"
                                                disabled={busy}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Phone (optional)</Label>
                                        <Input
                                            id="phone"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="e.g. 09xxxxxxxxx"
                                            autoComplete="tel"
                                            inputMode="tel"
                                            disabled={busy}
                                        />
                                        <div className="text-xs text-muted-foreground">
                                            If your system sends SMS, enter your phone number for notifications.
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                        <Button type="button" variant="outline" onClick={() => void onFindActive()} disabled={busy}>
                                            Find my ticket
                                        </Button>
                                        <Button type="button" onClick={() => void onJoin()} disabled={busy || !departmentId || !studentId.trim()}>
                                            {busy ? "Please wait…" : "Join Queue"}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {ticket ? (
                        <Card className="min-w-0">
                            <CardHeader>
                                <CardTitle>Your Ticket</CardTitle>
                                <CardDescription>Keep this page open or take a screenshot.</CardDescription>
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

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="text-sm text-muted-foreground">
                                        Want to see updates? Open the public display for this department.
                                    </div>

                                    <Button asChild variant="outline" className="w-full sm:w-auto" disabled={!departmentId}>
                                        <Link to={publicDisplayUrl}>Open Public Display</Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : null}
                </div>
            </main>

            <Footer variant="student" />
        </div>
    )
}
