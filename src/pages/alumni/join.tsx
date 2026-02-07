/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { toast } from "sonner"

import Header from "@/components/Header"
import Footer from "@/components/Footer"

import { studentApi, type Department, type ParticipantTransaction, type Ticket } from "@/api/student"

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

function toggleKey(keys: string[], key: string) {
    if (keys.includes(key)) return keys.filter((k) => k !== key)
    return [...keys, key]
}

export default function AlumniJoinPage() {
    const location = useLocation()

    const qs = React.useMemo(() => new URLSearchParams(location.search || ""), [location.search])
    const preDeptId = React.useMemo(() => pickNonEmptyString(qs.get("departmentId")), [qs])
    const preMobile = React.useMemo(() => pickNonEmptyString(qs.get("mobileNumber") || qs.get("phone")), [qs])
    const ticketId = React.useMemo(() => pickNonEmptyString(qs.get("ticketId") || qs.get("id")), [qs])

    const [loadingDepts, setLoadingDepts] = React.useState(true)
    const [loadingSession, setLoadingSession] = React.useState(true)
    const [departments, setDepartments] = React.useState<Department[]>([])

    const [sessionDepartmentId, setSessionDepartmentId] = React.useState<string>("")
    const [departmentId, setDepartmentId] = React.useState<string>("")
    const [studentId, setStudentId] = React.useState<string>("")
    const [mobileNumber, setMobileNumber] = React.useState<string>(preMobile)

    const [participant, setParticipant] = React.useState<any | null>(null)
    const [availableTransactions, setAvailableTransactions] = React.useState<ParticipantTransaction[]>([])
    const [selectedTransactions, setSelectedTransactions] = React.useState<string[]>([])

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

    const myTicketsUrl = React.useMemo(() => {
        const q = new URLSearchParams()
        const identifier = studentId.trim() || normalizeMobile(mobileNumber)

        if (departmentId) q.set("departmentId", departmentId)
        if (identifier) q.set("studentId", identifier)

        const qsStr = q.toString()
        return `/queue/my-tickets${qsStr ? `?${qsStr}` : ""}`
    }, [departmentId, studentId, mobileNumber])

    const loadDepartments = React.useCallback(async () => {
        setLoadingDepts(true)
        try {
            const res = await studentApi.listDepartments()
            setDepartments(res.departments ?? [])
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load departments.")
            setDepartments([])
            setDepartmentId("")
        } finally {
            setLoadingDepts(false)
        }
    }, [])

    const loadSession = React.useCallback(async () => {
        setLoadingSession(true)
        try {
            const res = await studentApi.getSession()
            const p = (res.participant ?? null) as any
            const tx = (res.availableTransactions ?? []).filter((x) => pickNonEmptyString(x?.key))

            setParticipant(p)
            setAvailableTransactions(tx)

            const sid = pickNonEmptyString(p?.tcNumber) || pickNonEmptyString(p?.studentId)
            const mobile = pickNonEmptyString(p?.mobileNumber) || pickNonEmptyString(p?.phone)
            const dept = pickNonEmptyString(p?.departmentId)

            if (sid) setStudentId((prev) => prev || sid)
            if (mobile) setMobileNumber((prev) => prev || mobile)
            if (dept) {
                setSessionDepartmentId(dept)
                setDepartmentId((prev) => prev || dept)
            }
        } catch {
            setParticipant(null)
            setAvailableTransactions([])
        } finally {
            setLoadingSession(false)
        }
    }, [])

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
            if (sid) setStudentId(sid)

            const ph = pickNonEmptyString((res.ticket as any)?.phone)
            if (ph) setMobileNumber(ph)

            const txKeys = Array.isArray(res.transactions?.transactionKeys)
                ? res.transactions?.transactionKeys.filter((k) => pickNonEmptyString(k))
                : []

            if (txKeys.length) setSelectedTransactions(txKeys)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load ticket.")
        } finally {
            setBusy(false)
        }
    }, [ticketId])

    React.useEffect(() => {
        void loadDepartments()
        void loadSession()
    }, [loadDepartments, loadSession])

    React.useEffect(() => {
        if (!departments.length) return

        setDepartmentId((prev) => {
            const has = (id: string) => !!id && departments.some((d) => d._id === id)

            if (has(prev)) return prev
            if (has(preDeptId)) return preDeptId
            if (has(sessionDepartmentId)) return sessionDepartmentId

            return departments[0]?._id ?? ""
        })
    }, [departments, preDeptId, sessionDepartmentId])

    React.useEffect(() => {
        void loadTicketById()
    }, [loadTicketById])

    async function onFindActive() {
        const mobile = normalizeMobile(mobileNumber)
        const sid = studentId.trim()
        const identifier = sid || mobile

        if (!departmentId) return toast.error("Please select a department.")
        if (!identifier) return toast.error("Please enter Student ID or Phone Number.")

        setBusy(true)
        try {
            const res = await studentApi.findActiveByStudent({
                departmentId,
                studentId: identifier,
            })

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
        const mobile = normalizeMobile(mobileNumber)
        const sid = studentId.trim()
        const identifier = sid || mobile

        if (!departmentId) return toast.error("Please select a department.")
        if (!mobile) return toast.error("Phone number is required.")
        if (!identifier) return toast.error("Student ID or Phone identifier is required.")

        const isSessionFlow = !!participant
        if (isSessionFlow && !availableTransactions.length) {
            return toast.error("No queue purpose is available for this account.")
        }
        if (isSessionFlow && !selectedTransactions.length) {
            return toast.error("Please select at least one queue purpose.")
        }

        setBusy(true)
        try {
            const res = await studentApi.joinQueue(
                isSessionFlow
                    ? {
                        departmentId,
                        studentId: identifier,
                        phone: mobile,
                        transactionKeys: selectedTransactions,
                    }
                    : {
                        departmentId,
                        studentId: identifier,
                        phone: mobile,
                    }
            )
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
            <Header variant="student" />

            <main className="mx-auto w-full px-4 py-10">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold tracking-tight">Join Queue</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Department defaults to your registered profile. You can change it here if needed.
                    </p>
                </div>

                <div className="grid gap-6">
                    <Card className="min-w-0">
                        <CardHeader>
                            <CardTitle>Alumni / Visitor Queue Entry</CardTitle>
                            <CardDescription>
                                Student ID and phone can be prefilled from your account. You may modify before joining.
                            </CardDescription>
                            <div className="pt-1">
                                {loadingSession ? (
                                    <Skeleton className="h-5 w-40" />
                                ) : participant ? (
                                    <Badge variant="secondary">Profile synced</Badge>
                                ) : (
                                    <Badge variant="outline">Guest mode</Badge>
                                )}
                            </div>
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
                                    <div className="grid gap-4 sm:grid-cols-3">
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
                                            <Label htmlFor="studentId">Student ID / Reference ID</Label>
                                            <Input
                                                id="studentId"
                                                value={studentId}
                                                onChange={(e) => setStudentId(e.target.value)}
                                                placeholder="Optional (if available)"
                                                autoComplete="off"
                                                inputMode="text"
                                                disabled={busy}
                                            />
                                        </div>

                                        <div className="space-y-2 min-w-0">
                                            <Label htmlFor="mobile">Phone Number</Label>
                                            <Input
                                                id="mobile"
                                                value={mobileNumber}
                                                onChange={(e) => setMobileNumber(e.target.value)}
                                                placeholder="e.g. 09xxxxxxxxx or +639xxxxxxxxx"
                                                autoComplete="tel"
                                                inputMode="tel"
                                                disabled={busy}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <Label>Purpose of Queue (Transaction)</Label>
                                            {selectedTransactions.length ? (
                                                <Badge variant="secondary">{selectedTransactions.length} selected</Badge>
                                            ) : null}
                                        </div>

                                        {loadingSession ? (
                                            <div className="space-y-2">
                                                <Skeleton className="h-9 w-full" />
                                                <Skeleton className="h-9 w-full" />
                                            </div>
                                        ) : participant ? (
                                            availableTransactions.length ? (
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    {availableTransactions.map((tx) => {
                                                        const txKey = pickNonEmptyString(tx?.key)
                                                        const active = selectedTransactions.includes(txKey)

                                                        return (
                                                            <Button
                                                                key={txKey}
                                                                type="button"
                                                                variant={active ? "default" : "outline"}
                                                                className="h-auto justify-start whitespace-normal text-left"
                                                                onClick={() =>
                                                                    setSelectedTransactions((prev) => toggleKey(prev, txKey))
                                                                }
                                                                disabled={busy || !txKey}
                                                            >
                                                                {tx.label}
                                                            </Button>
                                                        )
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">
                                                    No transaction options are available for your account.
                                                </div>
                                            )
                                        ) : (
                                            <div className="text-sm text-muted-foreground">
                                                Login first to select queue purpose. Guest mode supports legacy joining only.
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                        <Button type="button" variant="outline" onClick={() => void onFindActive()} disabled={busy}>
                                            Find my ticket
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={() => void onJoin()}
                                            disabled={
                                                busy ||
                                                !departmentId ||
                                                !normalizeMobile(mobileNumber) ||
                                                (!!participant &&
                                                    (!availableTransactions.length || !selectedTransactions.length))
                                            }
                                        >
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

                                <div className="grid gap-2 sm:grid-cols-2">
                                    <Button asChild variant="outline" className="w-full" disabled={!departmentId}>
                                        <Link to={publicDisplayUrl}>Open Public Display</Link>
                                    </Button>

                                    <Button asChild variant="secondary" className="w-full">
                                        <Link to={myTicketsUrl}>Go to My Tickets</Link>
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
