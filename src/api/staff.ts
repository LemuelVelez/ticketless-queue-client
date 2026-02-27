/* eslint-disable @typescript-eslint/no-explicit-any */
import { api, unwrapApiData } from "@/lib/http"

export type TicketStatus = "WAITING" | "CALLED" | "HOLD" | "OUT" | "SERVED"
export type TicketParticipantType = "STUDENT" | "ALUMNI_VISITOR" | "GUEST"

export type ServiceWindow = {
    _id: string
    id?: string
    department?: string | null
    departmentIds?: string[]
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

    /**
     * Who joined the queue.
     */
    participantType?: TicketParticipantType
    participantLabel?: string | null

    /**
     * ✅ Full name (Student / Alumni-Visitor / Guest)
     */
    participantFullName?: string | null

    /**
     * Queue purpose / transaction context.
     */
    transactionCategory?: string
    transactionKey?: string
    transactionKeys?: string[]
    transactionLabel?: string
    transactionLabels?: string[]
    selectedTransactionKeys?: string[]
    selectedTransactionLabels?: string[]
    purpose?: string
    queuePurpose?: string | null

    /**
     * Optional richer payloads that may come from backend enrichers.
     */
    participant?: string
    userType?: string
    role?: string
    participantTypeLabel?: string | null
    selectedTransactions?: Array<{
        key?: string
        label?: string
        name?: string
        title?: string
        [key: string]: any
    }>
    transactionSelections?: Array<{
        ticket?: string
        participant?: string | null
        participantType?: TicketParticipantType | string
        participantFullName?: string | null
        transactionKeys?: string[]
        transactionLabels?: string[]
        [key: string]: any
    }>
    transactions?: {
        participantType?: TicketParticipantType | string
        participantTypeLabel?: string | null
        transactionKey?: string | null
        transactionKeys?: string[]
        transactionLabel?: string | null
        transactionLabels?: string[]
        labels?: string[]
        [key: string]: any
    } | null
    selection?: {
        transactionKeys?: string[]
        transactionLabels?: string[]
        [key: string]: any
    } | null
    join?: {
        transactionKeys?: string[]
        transactionLabels?: string[]
        participantType?: string
        [key: string]: any
    } | null
    meta?: {
        purpose?: string
        transactionKey?: string
        transactionKeys?: string[]
        transactionLabel?: string
        transactionLabels?: string[]
        participantType?: string
        participantLabel?: string
        transactions?: any
        [key: string]: any
    } | null

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

export type DepartmentAssignment = {
    id: string
    name?: string
    code?: string | null
    transactionManager?: string | null
    enabled?: boolean
}

export type MyAssignmentResponse = {
    departmentId: string | null
    departmentName?: string | null
    assignedTransactionManager?: string | null

    assignedDepartmentIds?: string[]
    assignedDepartments?: DepartmentAssignment[]

    window: ServiceWindow | null

    handledDepartmentIds?: string[]
    handledDepartments?: DepartmentAssignment[]
}

export type TicketResponse = { ticket: Ticket }
export type CurrentCalledResponse = { ticket: Ticket | null }
export type ListTicketsResponse = { tickets: Ticket[] }

export type StaffDisplayNowServing = {
    id: string
    queueNumber: number
    departmentId: string | null
    departmentName: string | null
    departmentCode: string | null
    windowId: string | null
    windowName: string | null
    windowNumber: number | null

    // ✅ participant
    participantFullName: string | null
    participantLabel: string | null
    participantType: TicketParticipantType | string | null
    participantTypeLabel: string | null

    calledAt: string | null
}

export type StaffDisplayUpNextItem = {
    id: string
    queueNumber: number
    departmentId: string | null
    departmentName: string | null
    departmentCode: string | null

    // ✅ participant
    participantFullName: string | null
    participantLabel: string | null
    participantType: TicketParticipantType | string | null
    participantTypeLabel: string | null
}

export type StaffDisplayBoardWindow = {
    id: string
    name: string
    number: number
    departmentIds: string[]
    departments: Array<{
        id: string
        name: string
        code: string | null
    }>
    nowServing: {
        id: string
        queueNumber: number
        departmentId: string | null
        departmentName: string | null
        departmentCode: string | null

        // ✅ participant
        participantFullName: string | null
        participantLabel: string | null
        participantType: TicketParticipantType | string | null
        participantTypeLabel: string | null

        calledAt: string | null
    } | null
}

export type StaffDisplaySnapshotResponse = {
    department: {
        id: string | null
        name: string
        code?: string | null
        handledDepartmentIds: string[]
        handledDepartments?: DepartmentAssignment[]
    }
    window: {
        id: string
        name: string
        number: number
        department?: string | null
        departmentIds?: string[]
        enabled?: boolean
    } | null
    nowServing: StaffDisplayNowServing | null
    upNext: StaffDisplayUpNextItem[]
    board: {
        transactionManager: string | null
        minimumPanels: number
        recommendedPanels: number
        windows: StaffDisplayBoardWindow[]
    }
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

function toIdString(value: unknown): string {
    if (value === null || value === undefined) return ""
    if (typeof value === "string") return value.trim()

    if (typeof value === "object") {
        const maybeId = (value as any)?._id ?? (value as any)?.id
        if (maybeId) return toIdString(maybeId)
    }

    return String(value).trim()
}

function uniqueIds(values: unknown[]) {
    const seen = new Set<string>()
    const out: string[] = []

    for (const value of values) {
        const id = toIdString(value)
        if (!id || seen.has(id)) continue
        seen.add(id)
        out.push(id)
    }

    return out
}

function normalizeWindowPayload(windowRaw: any): ServiceWindow | null {
    if (!windowRaw) return null

    const id = toIdString(windowRaw?._id ?? windowRaw?.id)
    if (!id) return null

    const numberRaw =
        typeof windowRaw?.number === "number" ? Number(windowRaw.number) : Number(windowRaw?.number ?? NaN)

    const department = toIdString(windowRaw?.department)
    const departmentIds = Array.isArray(windowRaw?.departmentIds)
        ? uniqueIds(windowRaw.departmentIds)
        : department
            ? [department]
            : undefined

    return {
        _id: id,
        id,
        department: department || null,
        departmentIds,
        name:
            typeof windowRaw?.name === "string" && windowRaw.name.trim()
                ? String(windowRaw.name)
                : "Window",
        number: Number.isFinite(numberRaw) ? numberRaw : 0,
        enabled: windowRaw?.enabled !== false,
        createdAt: typeof windowRaw?.createdAt === "string" ? windowRaw.createdAt : undefined,
        updatedAt: typeof windowRaw?.updatedAt === "string" ? windowRaw.updatedAt : undefined,
    }
}

function normalizeDepartmentList(raw: any): DepartmentAssignment[] | undefined {
    if (!Array.isArray(raw)) return undefined

    return raw
        .map((d: any) => {
            const id = toIdString(d?.id ?? d?._id)
            if (!id) return null
            return {
                id,
                name: typeof d?.name === "string" ? d.name : undefined,
                code: typeof d?.code === "string" ? d.code : null,
                transactionManager:
                    typeof d?.transactionManager === "string" ? d.transactionManager : null,
                enabled: d?.enabled !== false,
            } satisfies DepartmentAssignment
        })
        .filter(Boolean) as DepartmentAssignment[]
}

function normalizeMyAssignmentPayload(payload: any): MyAssignmentResponse {
    const normalizedAssignedDepartments = normalizeDepartmentList(payload?.assignedDepartments)
    const normalizedHandledDepartments = normalizeDepartmentList(payload?.handledDepartments)

    const assignedDepartmentIds = uniqueIds([
        ...(Array.isArray(payload?.assignedDepartmentIds) ? payload.assignedDepartmentIds : []),
        ...(normalizedAssignedDepartments ?? []).map((d) => d.id),
    ])

    const handledDepartmentIds = uniqueIds([
        ...(Array.isArray(payload?.handledDepartmentIds) ? payload.handledDepartmentIds : []),
        ...(normalizedHandledDepartments ?? []).map((d) => d.id),
    ])

    const explicitDepartmentId = toIdString(payload?.departmentId)
    const departmentId = explicitDepartmentId || assignedDepartmentIds[0] || handledDepartmentIds[0] || null

    return {
        ...(payload || {}),
        departmentId,
        assignedDepartmentIds,
        assignedDepartments: normalizedAssignedDepartments,
        handledDepartmentIds,
        handledDepartments: normalizedHandledDepartments,
        window: normalizeWindowPayload(payload?.window),
    }
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

/** =========================
 * SMS TYPES (STAFF)
 * ========================= */

export type StaffSendSmsRequest = {
    /**
     * Backend accepts `numbers` (preferred) OR `number` (legacy).
     * You can pass a string, comma-separated string, or string[].
     */
    numbers?: string | string[]
    number?: string

    message: string
    senderName?: string

    priority?: boolean
    otp?: boolean
    otpCode?: string | number

    respectOptOut?: boolean
    supportedNetworkTokens?: string[]

    entityType?: string
    entityId?: string
    meta?: Record<string, any>
}

export type StaffSendTicketSmsBaseRequest = {
    message?: string
    senderName?: string

    priority?: boolean
    otp?: boolean
    otpCode?: string | number

    respectOptOut?: boolean
    supportedNetworkTokens?: string[]
    meta?: Record<string, any>
}

export type StaffTicketSmsStatus = "CALLED" | "HOLD" | "OUT" | "SERVED"

export type StaffSendTicketStatusSmsRequest = StaffSendTicketSmsBaseRequest & {
    status: StaffTicketSmsStatus
}

export type StaffSmsResponse = {
    ok: boolean
    provider?: string

    // present on ticket-based endpoints
    ticketId?: string
    status?: StaffTicketSmsStatus

    // present on raw send
    number?: string

    // server may include this on /staff/sms/send
    statusSummary?: Record<string, number>

    result?: any
    error?: string
}

export const staffApi = {
    myAssignment: () =>
        api
            .get<MyAssignmentResponse | { data: MyAssignmentResponse }>("/staff/me/assignment")
            .then((res) => normalizeMyAssignmentPayload(unwrapApiData(res))),

    // ✅ Dedicated backend snapshot for staff presentation/monitor pages
    getDisplaySnapshot: () =>
        api
            .get<StaffDisplaySnapshotResponse | { data: StaffDisplaySnapshotResponse }>("/staff/display/snapshot-full")
            .then((res) => unwrapApiData(res)),

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

    // ✅ SMS endpoints
    sendSms: (payload: StaffSendSmsRequest) =>
        api.post<StaffSmsResponse>("/staff/sms/send", payload),

    // Legacy alias: sends CALLED status (or custom message if provided)
    sendTicketCalledSms: (ticketId: string, payload?: StaffSendTicketSmsBaseRequest) =>
        api.post<StaffSmsResponse>(`/staff/tickets/${encodeURIComponent(ticketId)}/sms-called`, payload ?? {}),

    // Unified ticket status SMS (CALLED | HOLD | OUT | SERVED) + optional custom message override
    sendTicketStatusSms: (ticketId: string, payload: StaffSendTicketStatusSmsRequest) =>
        api.post<StaffSmsResponse>(`/staff/tickets/${encodeURIComponent(ticketId)}/sms-status`, payload),

    // ✅ Staff reports (scoped to assigned department on backend)
    getReportsSummary: (opts?: { from?: string; to?: string }) =>
        api.get<ReportsSummaryResponse>(`/staff/reports/summary${toQuery(opts as any)}`),

    getReportsTimeseries: (opts?: { from?: string; to?: string }) =>
        api.get<ReportsTimeseriesResponse>(`/staff/reports/timeseries${toQuery(opts as any)}`),
}