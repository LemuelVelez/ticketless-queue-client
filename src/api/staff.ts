/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from "@/lib/http"

export type TicketStatus = "WAITING" | "CALLED" | "HOLD" | "OUT" | "SERVED"

export type ServiceWindow = {
    _id: string
    department: string
    name: string
    number: number
    enabled?: boolean
    createdAt?: string
    updatedAt?: string
}

export type Ticket = {
    _id: string
    department: string
    dateKey: string
    queueNumber: number

    studentId: string
    phone?: string

    status: TicketStatus
    holdAttempts: number

    waitingSince?: string
    window?: string
    windowNumber?: number

    calledAt?: string
    servedAt?: string
    outAt?: string

    createdAt?: string
    updatedAt?: string

    [key: string]: any
}

export type MyAssignmentResponse = {
    departmentId: string | null
    window: ServiceWindow | null
    handledDepartmentIds?: string[]
}

export type TicketResponse = { ticket: Ticket }
export type CurrentCalledResponse = { ticket: Ticket | null }
export type ListTicketsResponse = { tickets: Ticket[] }

export type StaffDisplaySnapshotResponse = {
    department: {
        id: string
        name: string
        handledDepartmentIds: string[]
    }
    window: {
        id: string
        name: string
        number: number
    } | null
    nowServing: {
        id: string
        queueNumber: number
        windowNumber: number | null
        calledAt: string | null
    } | null
    upNext: Array<{
        id: string
        queueNumber: number
    }>
    meta: {
        generatedAt: string
        refreshMs: number
        upNextCount: number
    }
}

function toQuery(params?: Record<string, string | number | boolean | undefined | null>) {
    const qs = new URLSearchParams()
    if (!params) return ""
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === "") continue
        qs.set(k, String(v))
    }
    const s = qs.toString()
    return s ? `?${s}` : ""
}

/** =========================
 * REPORTS TYPES (STAFF-SCOPED)
 * ========================= */

export type ReportRange = {
    from: string // YYYY-MM-DD
    to: string // YYYY-MM-DD
}

export type StatusCounts = Partial<Record<TicketStatus, number>>

export type DepartmentReportRow = {
    departmentId: string
    name?: string
    code?: string

    total: number
    waiting: number
    called: number
    hold: number
    out: number
    served: number

    avgWaitMs: number | null
    avgServiceMs: number | null
}

export type ReportsSummaryResponse = {
    range: ReportRange
    totals: {
        total: number
        byStatus: StatusCounts
        avgWaitMs: number | null
        avgServiceMs: number | null
    }
    departments: DepartmentReportRow[]
}

export type ReportsTimeseriesPoint = {
    dateKey: string // YYYY-MM-DD
    total: number
    waiting: number
    called: number
    hold: number
    out: number
    served: number
}

export type ReportsTimeseriesResponse = {
    range: ReportRange
    series: ReportsTimeseriesPoint[]
}

export const staffApi = {
    myAssignment: () => api.get<MyAssignmentResponse>("/staff/me/assignment"),

    // ✅ Dedicated backend snapshot for staff presentation/monitor pages
    getDisplaySnapshot: () => api.get<StaffDisplaySnapshotResponse>("/staff/display/snapshot"),

    listWaiting: (opts?: { limit?: number }) =>
        api.get<ListTicketsResponse>(`/staff/queue/waiting${toQuery(opts as any)}`),

    listHold: (opts?: { limit?: number }) =>
        api.get<ListTicketsResponse>(`/staff/queue/hold${toQuery(opts as any)}`),

    listOut: (opts?: { limit?: number }) =>
        api.get<ListTicketsResponse>(`/staff/queue/out${toQuery(opts as any)}`),

    // ✅ mine=true => only tickets for this staff's assigned window
    listHistory: (opts?: { limit?: number; mine?: boolean }) =>
        api.get<ListTicketsResponse>(`/staff/queue/history${toQuery(opts as any)}`),

    callNext: () => api.post<TicketResponse>("/staff/queue/call-next"),

    currentCalledForWindow: () => api.get<CurrentCalledResponse>("/staff/queue/current-called"),

    markServed: (ticketId: string) => api.post<TicketResponse>(`/staff/tickets/${ticketId}/served`),

    holdNoShow: (ticketId: string) => api.post<TicketResponse>(`/staff/tickets/${ticketId}/hold`),

    returnFromHold: (ticketId: string) => api.post<TicketResponse>(`/staff/tickets/${ticketId}/return`),

    // ✅ Staff reports (scoped to assigned department on backend)
    getReportsSummary: (opts?: { from?: string; to?: string }) =>
        api.get<ReportsSummaryResponse>(`/staff/reports/summary${toQuery(opts as any)}`),

    getReportsTimeseries: (opts?: { from?: string; to?: string }) =>
        api.get<ReportsTimeseriesResponse>(`/staff/reports/timeseries${toQuery(opts as any)}`),
}
