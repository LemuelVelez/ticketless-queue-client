/* eslint-disable @typescript-eslint/no-explicit-any */
import { api, pickTransactionPurpose, validateSemaphoreReceipts } from "@/lib/http"

export type TicketStatus = "WAITING" | "CALLED" | "HOLD" | "OUT" | "SERVED"
export type TicketParticipantType = "STUDENT" | "ALUMNI_VISITOR" | "GUEST"

export type TicketGuidanceDetails = {
    whereToGo: string
    participantTypeLabel: string
    departmentName?: string | null
    departmentCode?: string | null
    transactionManager?: string | null
    windowNumber?: number | null
    windowName?: string | null
    staffName?: string | null
    servedDepartments: string[]
    transactionLabels: string[]
}

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

export type TicketTransaction = {
    category?: string | null
    key?: string | null
    label?: string | null
    purpose?: string | null
}

export type Ticket = {
    _id: string
    department: string
    dateKey: string
    queueNumber: number

    /**
     * ⚠️ Backward-compat identifier.
     * Backend may store Student ID OR Mobile here (older schema).
     */
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
     * ✅ New enriched fields from updated staffController enrichTickets()
     * - participantDisplay: "Full Name • Student ID (if student) • Mobile"
     * - participantStudentId: only when participantType === STUDENT
     * - participantMobileNumber: best-effort extracted mobile number
     * - participantIdentifier: original identifier (student id OR mobile)
     */
    participantDisplay?: string | null
    participantStudentId?: string | null
    participantMobileNumber?: string | null
    participantIdentifier?: string | null

    /**
     * ✅ Optional richer helpers returned by backend enrichers
     */
    guidance?: TicketGuidanceDetails | null
    voiceAnnouncement?: string | null

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
     * ✅ New explicit purpose field (aligned with updated staffController / queueManagement controller)
     */
    transactionPurpose?: string | null

    /**
     * ✅ Normalized transaction object (aligned with backend)
     */
    transaction?: TicketTransaction | null

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
        participantStudentId?: string | null
        participantMobileNumber?: string | null
        transactionKeys?: string[]
        transactionLabels?: string[]
        [key: string]: any
    }>
    transactions?: {
        participantType?: TicketParticipantType | string
        participantTypeLabel?: string | null

        transactionCategory?: string | null

        transactionKey?: string | null
        transactionKeys?: string[]
        transactionLabel?: string | null
        transactionLabels?: string[]
        labels?: string[]

        purpose?: string | null

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
        transactionPurpose?: string
        transactionCategory?: string
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

export type WindowAssignmentsResponse = {
    /**
     * Map: windowNumber -> department codes (strings).
     * JSON object keys will be strings when returned by Express.
     */
    assignments: Record<string, string[]>
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
    transactionManager?: string | null
    windowId: string | null
    windowName: string | null
    windowNumber: number | null

    // ✅ participant
    participantFullName: string | null
    participantDisplay?: string | null
    participantStudentId?: string | null
    participantMobileNumber?: string | null

    participantLabel: string | null
    participantType: TicketParticipantType | string | null
    participantTypeLabel: string | null

    // ✅ transaction purpose/labels (updated backend snapshot payload)
    transactionPurpose?: string | null
    transactionLabel?: string | null
    transactionLabels?: string[]

    // ✅ guidance/voice (added by staffController enrichTickets)
    guidance?: TicketGuidanceDetails | null
    voiceAnnouncement?: string | null

    calledAt: string | null
}

export type StaffDisplayUpNextItem = {
    id: string
    queueNumber: number
    departmentId: string | null
    departmentName: string | null
    departmentCode: string | null
    transactionManager?: string | null

    // ✅ participant
    participantFullName: string | null
    participantDisplay?: string | null
    participantStudentId?: string | null
    participantMobileNumber?: string | null

    participantLabel: string | null
    participantType: TicketParticipantType | string | null
    participantTypeLabel: string | null

    // ✅ transaction purpose/labels (updated backend snapshot payload)
    transactionPurpose?: string | null
    transactionLabel?: string | null
    transactionLabels?: string[]

    // ✅ guidance (added by staffController enrichTickets)
    guidance?: TicketGuidanceDetails | null
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
        participantDisplay?: string | null
        participantStudentId?: string | null
        participantMobileNumber?: string | null

        participantLabel: string | null
        participantType: TicketParticipantType | string | null
        participantTypeLabel: string | null

        // ✅ transaction purpose/labels (updated backend snapshot payload)
        transactionPurpose?: string | null
        transactionLabel?: string | null
        transactionLabels?: string[]

        // ✅ guidance/voice
        guidance?: TicketGuidanceDetails | null
        voiceAnnouncement?: string | null

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

/**
 * ✅ CENTRALIZED REAL-TIME QUEUE STATE (pollable)
 * Backend shape may evolve; keep flexible but still typed enough for UI use.
 */
export type StaffQueueStateResponse = {
    ok?: boolean
    nowServing?: Ticket | null
    upNext?: Ticket[]
    waiting?: Ticket[]
    hold?: Ticket[]
    out?: Ticket[]
    history?: Ticket[]
    state?: Record<string, any>
    meta?: Record<string, any>
    [key: string]: any
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

    const numberRaw = typeof windowRaw?.number === "number" ? Number(windowRaw.number) : Number(windowRaw?.number ?? NaN)

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
        name: typeof windowRaw?.name === "string" && windowRaw.name.trim() ? String(windowRaw.name) : "Window",
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
                transactionManager: typeof d?.transactionManager === "string" ? d.transactionManager : null,
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
 * PARTICIPANT DISPLAY NORMALIZATION
 * ========================= */

function isLikelyHumanName(label: unknown, identifier?: string) {
    const s = String(label ?? "").trim()
    if (!s) return false
    if (identifier && s === String(identifier).trim()) return false

    const lower = s.toLowerCase()
    const reject = new Set(["student", "alumni / visitor", "alumni/visitor", "guest", "participant"])
    if (reject.has(lower)) return false

    if (/^\+?\d[\d\s()-]{6,}$/.test(s)) return false
    if (!/[a-z]/i.test(s)) return false

    return true
}

function looksLikePhoneNumber(input?: string) {
    const raw = String(input || "").trim()
    if (!raw) return false
    if (raw.includes("@")) return false
    if (!/^[\d+\-\s()]+$/.test(raw)) return false
    const digits = raw.replace(/[^\d]/g, "")
    return digits.length >= 10
}

function normalizeParticipantType(value: unknown): TicketParticipantType | string | null {
    const raw = String(value ?? "").trim().toUpperCase()
    if (!raw) return null
    if (raw === "STUDENT") return "STUDENT"
    if (raw === "GUEST") return "GUEST"
    if (raw === "ALUMNI_VISITOR" || raw === "ALUMNI/VISITOR" || raw === "ALUMNI" || raw === "VISITOR") {
        return "ALUMNI_VISITOR"
    }
    return raw
}

function buildParticipantDisplayLine(params: {
    participantFullName: string
    participantType?: string | null
    studentId?: string | null
    mobileNumber?: string | null
}) {
    const fullName = String(params.participantFullName || "").trim()
    const type = String(params.participantType || "").toUpperCase()
    const studentId = String(params.studentId || "").trim()
    const mobile = String(params.mobileNumber || "").trim()

    const parts: string[] = []
    if (fullName) parts.push(fullName)

    // only show student id when participant is student
    if (type === "STUDENT" && studentId && studentId !== fullName) parts.push(studentId)

    // show mobile if available (for Student/Alumni/Guest)
    if (mobile && mobile !== fullName) parts.push(mobile)

    return parts.join(" • ")
}

function normalizeTicketParticipant(t: Ticket): Ticket {
    const identifier = String(t?.participantIdentifier ?? t?.studentId ?? "").trim()
    const participantTypeRaw =
        t?.participantType ??
        t?.transactions?.participantType ??
        t?.meta?.participantType ??
        t?.join?.participantType ??
        t?.userType ??
        t?.role

    const participantType = normalizeParticipantType(participantTypeRaw)

    const selectionName = Array.isArray(t?.transactionSelections)
        ? String(t.transactionSelections.find(Boolean)?.participantFullName ?? "").trim()
        : ""

    const label = String(t?.participantLabel ?? "").trim()

    const participantFullName =
        String(t?.participantFullName ?? "").trim() ||
        (selectionName ? selectionName : "") ||
        (isLikelyHumanName(label, identifier) ? label : "")

    const finalFullName = participantFullName ? participantFullName : null

    // ✅ Student ID should only appear for students
    const studentIdFromTicket = !looksLikePhoneNumber(identifier) ? identifier : ""
    const participantStudentId =
        participantType === "STUDENT"
            ? String(t?.participantStudentId ?? "").trim() || (studentIdFromTicket ? studentIdFromTicket : "")
            : ""

    // ✅ Mobile should show for anyone if we can infer it
    const phone = String(t?.phone ?? "").trim()
    const participantMobileNumber =
        String(t?.participantMobileNumber ?? "").trim() ||
        (phone ? phone : "") ||
        (looksLikePhoneNumber(identifier) ? identifier : "")

    const baseName =
        (finalFullName && finalFullName.trim()) ||
        (isLikelyHumanName(label, identifier) ? label : "") ||
        (identifier ? identifier : "") ||
        "Participant"

    const participantDisplay =
        String(t?.participantDisplay ?? "").trim() ||
        buildParticipantDisplayLine({
            participantFullName: baseName,
            participantType: String(participantType ?? ""),
            studentId: participantStudentId || null,
            mobileNumber: participantMobileNumber || null,
        })

    const displayFinal = participantDisplay ? participantDisplay : null

    // ✅ Transaction purpose normalization (align with updated staffController)
    const pickedPurpose = pickTransactionPurpose(t)
    const transactionPurpose = String(t?.transactionPurpose ?? "").trim() || (pickedPurpose ? pickedPurpose : "") || null

    // ✅ FIX: `purpose` field is `string | undefined` (NOT null)
    const purposeLegacy: string | undefined =
        String(t?.purpose ?? "").trim() || (transactionPurpose ? transactionPurpose : "") || undefined

    const transactionLabelsRaw =
        Array.isArray(t?.transactionLabels) && t.transactionLabels.length
            ? t.transactionLabels
            : Array.isArray(t?.transactions?.transactionLabels) && (t.transactions as any)?.transactionLabels?.length
              ? ((t.transactions as any).transactionLabels as any[])
              : Array.isArray(t?.transactions?.labels) && (t.transactions as any)?.labels?.length
                ? ((t.transactions as any).labels as any[])
                : []

    const transactionLabels = Array.isArray(transactionLabelsRaw)
        ? transactionLabelsRaw.map((x) => String(x ?? "").trim()).filter(Boolean)
        : []

    const transactionLabel =
        String(t?.transactionLabel ?? "").trim() ||
        String((t as any)?.transaction?.label ?? "").trim() ||
        String(t?.transactions?.transactionLabel ?? "").trim() ||
        (transactionLabels[0] ? String(transactionLabels[0]).trim() : "") ||
        null

    const transactionCategory =
        String(t?.transactionCategory ?? "").trim() ||
        String(t?.transactions?.transactionCategory ?? "").trim() ||
        String((t as any)?.transaction?.category ?? "").trim() ||
        null

    const transactionKey =
        String(t?.transactionKey ?? "").trim() ||
        String(t?.transactions?.transactionKey ?? "").trim() ||
        String((t as any)?.transaction?.key ?? "").trim() ||
        null

    const existingTx = t?.transaction && typeof t.transaction === "object" ? { ...(t.transaction as any) } : null

    const normalizedTx: TicketTransaction | null =
        existingTx || transactionPurpose || transactionLabel || transactionCategory || transactionKey
            ? {
                  category: String(existingTx?.category ?? "").trim() || transactionCategory,
                  key: String(existingTx?.key ?? "").trim() || transactionKey,
                  label: String(existingTx?.label ?? "").trim() || transactionLabel,
                  purpose: String(existingTx?.purpose ?? "").trim() || transactionPurpose,
              }
            : null

    return {
        ...t,
        participantType: (participantType as any) ?? t.participantType,
        participantFullName: finalFullName,
        participantStudentId: participantStudentId ? participantStudentId : (t.participantStudentId ?? null),
        participantMobileNumber: participantMobileNumber ? participantMobileNumber : (t.participantMobileNumber ?? null),
        participantDisplay: displayFinal,
        // ✅ For BEST UX, make existing UIs that render `participantLabel` show the rich display line.
        participantLabel: displayFinal || finalFullName || (t.participantLabel ?? null),

        // ✅ ensure transaction purpose is always present for staff queue UIs
        transactionPurpose,
        purpose: purposeLegacy,

        transactionLabel: (t.transactionLabel ?? (transactionLabel || undefined)) as any,
        transactionLabels:
            Array.isArray(t.transactionLabels) && t.transactionLabels.length
                ? t.transactionLabels
                : transactionLabels.length
                  ? transactionLabels
                  : (t.transactionLabels as any),
        transactionCategory: (t.transactionCategory ?? (transactionCategory || undefined)) as any,
        transactionKey: (t.transactionKey ?? (transactionKey || undefined)) as any,
        transaction: normalizedTx,
    }
}

function normalizeTicketsResponse(res: ListTicketsResponse): ListTicketsResponse {
    return {
        ...res,
        tickets: Array.isArray(res?.tickets) ? res.tickets.map((t) => normalizeTicketParticipant(t)) : [],
    }
}

function normalizeTicketResponse(res: TicketResponse): TicketResponse {
    return {
        ...res,
        ticket: res?.ticket ? normalizeTicketParticipant(res.ticket) : (res.ticket as any),
    }
}

function normalizeCurrentCalledResponse(res: CurrentCalledResponse): CurrentCalledResponse {
    return {
        ...res,
        ticket: res?.ticket ? normalizeTicketParticipant(res.ticket) : null,
    }
}

function normalizeSnapshot(res: StaffDisplaySnapshotResponse): StaffDisplaySnapshotResponse {
    const normalizeDisplay = (item: any) => {
        if (!item) return item

        const type = normalizeParticipantType(item?.participantType)
        const full = String(item?.participantFullName ?? "").trim()
        const label = String(item?.participantLabel ?? "").trim()

        const studentId = String(item?.participantStudentId ?? "").trim()
        const mobile = String(item?.participantMobileNumber ?? "").trim()

        const baseName = full || (isLikelyHumanName(label) ? label : "") || "Participant"

        const display =
            String(item?.participantDisplay ?? "").trim() ||
            buildParticipantDisplayLine({
                participantFullName: baseName,
                participantType: String(type ?? ""),
                studentId: studentId || null,
                mobileNumber: mobile || null,
            })

        const displayFinal = display ? display : null
        const fullFinal = full || (isLikelyHumanName(label) ? label : "") || null

        // ✅ Transaction purpose normalization for snapshot items
        const pickedPurpose = pickTransactionPurpose(item)
        const transactionPurpose =
            String(item?.transactionPurpose ?? "").trim() || (pickedPurpose ? pickedPurpose : "") || null

        const labelsRaw =
            Array.isArray(item?.transactionLabels) && item.transactionLabels.length
                ? item.transactionLabels
                : Array.isArray(item?.transactions?.transactionLabels) && item.transactions?.transactionLabels?.length
                  ? item.transactions.transactionLabels
                  : Array.isArray(item?.transactions?.labels) && item.transactions?.labels?.length
                    ? item.transactions.labels
                    : []

        const transactionLabels = Array.isArray(labelsRaw)
            ? labelsRaw.map((x: any) => String(x ?? "").trim()).filter(Boolean)
            : []

        const transactionLabel =
            String(item?.transactionLabel ?? "").trim() ||
            String(item?.transaction?.label ?? "").trim() ||
            String(item?.transactions?.transactionLabel ?? "").trim() ||
            (transactionLabels[0] ? String(transactionLabels[0]).trim() : "") ||
            null

        return {
            ...item,
            participantType: type ?? item.participantType ?? null,
            participantFullName: fullFinal,
            participantDisplay: displayFinal,
            // ✅ Ensure legacy UI fields still show the rich participant line
            participantLabel: displayFinal || fullFinal || item.participantLabel || null,

            // ✅ ensure transaction purpose fields exist (new backend fields)
            transactionPurpose,
            transactionLabel,
            transactionLabels,
        }
    }

    return {
        ...res,
        nowServing: res.nowServing ? normalizeDisplay(res.nowServing) : null,
        upNext: Array.isArray(res.upNext) ? res.upNext.map((x) => normalizeDisplay(x)) : [],
        board: {
            ...(res.board as any),
            windows: Array.isArray(res?.board?.windows)
                ? res.board.windows.map((w) => ({
                      ...w,
                      nowServing: w.nowServing ? normalizeDisplay(w.nowServing) : null,
                  }))
                : [],
        },
    }
}

function isTicketLike(value: any): value is Ticket {
    if (!value || typeof value !== "object") return false
    const id = value?._id ?? value?.id
    const hasId = typeof id === "string" || (id && typeof id === "object")
    const hasQueueNumber = typeof value?.queueNumber === "number" || typeof value?.queueNumber === "string"
    const hasStatus = typeof value?.status === "string"
    return !!(hasId && hasQueueNumber && hasStatus)
}

function normalizeTicketArrayMaybe(items: any): any {
    if (!Array.isArray(items)) return items
    return items.map((x) => (isTicketLike(x) ? normalizeTicketParticipant(x) : x))
}

function normalizeQueueStatePayload(payload: StaffQueueStateResponse): StaffQueueStateResponse {
    const next: StaffQueueStateResponse = { ...(payload || {}) }

    if (isTicketLike(next.nowServing)) next.nowServing = normalizeTicketParticipant(next.nowServing)
    next.upNext = normalizeTicketArrayMaybe(next.upNext)
    next.waiting = normalizeTicketArrayMaybe(next.waiting)
    next.hold = normalizeTicketArrayMaybe(next.hold)
    next.out = normalizeTicketArrayMaybe(next.out)
    next.history = normalizeTicketArrayMaybe(next.history)

    // If backend wraps in `state`, normalize common keys there too.
    if (next.state && typeof next.state === "object") {
        const s: any = { ...next.state }

        if (isTicketLike(s.nowServing)) s.nowServing = normalizeTicketParticipant(s.nowServing)
        s.upNext = normalizeTicketArrayMaybe(s.upNext)
        s.waiting = normalizeTicketArrayMaybe(s.waiting)
        s.hold = normalizeTicketArrayMaybe(s.hold)
        s.out = normalizeTicketArrayMaybe(s.out)
        s.history = normalizeTicketArrayMaybe(s.history)

        next.state = s
    }

    return next
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

/**
 * ✅ Unified endpoint payload (/staff/tickets/:id/sms)
 * - message?: custom override
 * - status?: CALLED|HOLD|OUT|SERVED (defaults to CALLED when omitted and message is omitted)
 */
export type StaffSendTicketSmsRequest = StaffSendTicketSmsBaseRequest & {
    status?: StaffTicketSmsStatus
}

export type StaffSmsResponse = {
    ok: boolean
    provider?: string

    // present on ticket-based endpoints
    ticketId?: string
    status?: StaffTicketSmsStatus

    // server semantic outcome
    outcome?: "sent" | "skipped" | "failed" | "unknown"
    reason?: string

    /**
     * ✅ Compatibility: some backends return `message` instead of (or alongside) `reason/error`.
     * Keeping it optional prevents TS errors in UI code that reads `res.message`.
     */
    message?: string

    // present on raw send (legacy helper behavior)
    number?: string

    // server may include this on /staff/sms/send
    statusSummary?: Record<string, number>

    // ✅ client-added (for best UX + debugging)
    receiptsCount?: number

    result?: any
    error?: string

    // ✅ optional diagnostic fields (safe to ignore)
    httpStatus?: number
    url?: string
    path?: string
    method?: string
    detail?: any
}

const STAFF_AUTH = { auth: "staff" as const }
// ✅ For SMS + provider-style endpoints, never throw on non-2xx (let UI render `{ ok:false, ... }`)
const STAFF_AUTH_NO_THROW = { auth: "staff" as const, throwOnError: false as const }

function snippetText(val: unknown, max = 220) {
    const s = String(val ?? "").replace(/\s+/g, " ").trim()
    if (!s) return ""
    return s.length > max ? `${s.slice(0, max)}…` : s
}

/**
 * ✅ Client-side receipt validation (defensive)
 * Prevents "false success" UI toasts when:
 * - backend returns HTTP 200 but `{ ok:false }`
 * - backend returns `{ ok:true }` yet receipt array contains FAILED/REFUNDED/empty (older/proxy edge cases)
 */
function extractSemaphoreProviderResponse(res: StaffSmsResponse): unknown | undefined {
    const anyRes: any = res

    // Some endpoints return the raw receipts array directly in `result`
    if (Array.isArray(anyRes?.result)) return anyRes.result

    // Others nest receipts under `result.providerResponse`
    if (Array.isArray(anyRes?.result?.providerResponse)) return anyRes.result.providerResponse

    // Rare older shapes (kept safe)
    if (Array.isArray(anyRes?.providerResponse)) return anyRes.providerResponse
    if (Array.isArray(anyRes?.receipts)) return anyRes.receipts
    if (Array.isArray(anyRes?.result?.result)) return anyRes.result.result

    return undefined
}

function coerceStaffSmsResponse(input: unknown): StaffSmsResponse {
    if (input && typeof input === "object" && !Array.isArray(input)) {
        const obj: any = { ...(input as any) }

        // ✅ Avoid type conflict: some safe network payloads include numeric `status` (HTTP status),
        // but `status` in StaffSmsResponse is reserved for ticket status (CALLED/HOLD/OUT/SERVED).
        if (typeof obj.status === "number") {
            obj.httpStatus = obj.status
            delete obj.status
        }

        return obj as StaffSmsResponse
    }

    const raw =
        typeof input === "string"
            ? input
            : input === null || input === undefined
              ? ""
              : (() => {
                    try {
                        return JSON.stringify(input)
                    } catch {
                        return String(input)
                    }
                })()

    const msg = raw ? `Invalid SMS response from server: "${snippetText(raw)}"` : "Invalid SMS response from server."

    return {
        ok: false,
        provider: "semaphore",
        outcome: "failed",
        reason: "invalid_response",
        error: "invalid_response",
        message: msg,
        result: input as any,
    }
}

function normalizeStaffSmsResponse(res: unknown): StaffSmsResponse {
    const safe = coerceStaffSmsResponse(res)
    const next: StaffSmsResponse = { ...(safe || ({} as any)) }

    // Ensure UI always has something to display
    if (!next.message) next.message = next.reason || next.error || ""

    // Only validate when we can actually see receipts
    const providerResponse = extractSemaphoreProviderResponse(next)
    if (providerResponse === undefined) return next

    const receipt = validateSemaphoreReceipts(providerResponse)

    next.statusSummary = next.statusSummary ?? receipt.statusSummary
    next.receiptsCount = typeof next.receiptsCount === "number" ? next.receiptsCount : receipt.receiptsCount

    // Never override an intentional "skipped" flow
    if (next.outcome === "skipped") return next

    // If backend said ok=true but receipts indicate failure/unknown, downgrade to ok=false
    if (next.ok === true && receipt.ok === false) {
        next.ok = false
        next.outcome = receipt.outcome === "sent" ? "failed" : receipt.outcome
        next.error = next.error || "receipt_invalid"
        next.reason = next.reason || receipt.error
        next.message = next.message || next.reason || receipt.error || "SMS not confirmed by provider receipt."
        return next
    }

    // If ok is missing (shouldn't happen, but keep safe), derive from receipt
    if (typeof next.ok !== "boolean") next.ok = receipt.ok

    // Fill outcome/reason if missing
    if (!next.outcome) next.outcome = receipt.outcome

    if (receipt.ok === false) {
        next.ok = false
        next.outcome = receipt.outcome === "sent" ? "failed" : receipt.outcome
        next.error = next.error || "receipt_invalid"
        next.reason = next.reason || receipt.error
        next.message = next.message || next.reason || receipt.error || "SMS not confirmed by provider receipt."
    }

    return next
}

export const staffApi = {
    myAssignment: () =>
        api.getData<MyAssignmentResponse>("/staff/me/assignment", STAFF_AUTH).then((res) => normalizeMyAssignmentPayload(res)),

    // ✅ Department-to-window assignment map
    getWindowAssignments: () => api.getData<WindowAssignmentsResponse>("/staff/queue/window-assignments", STAFF_AUTH),

    // ✅ Dedicated backend snapshot for staff presentation/monitor pages
    getDisplaySnapshot: () =>
        api.getData<StaffDisplaySnapshotResponse>("/staff/display/snapshot-full", STAFF_AUTH).then((res) => normalizeSnapshot(res)),

    listWaiting: (opts?: { limit?: number }) =>
        api
            .getData<ListTicketsResponse & { context?: any }>(`/staff/queue/waiting-full${toQuery(opts as any)}`, STAFF_AUTH)
            .then((res) => normalizeTicketsResponse(res)),

    listHold: (opts?: { limit?: number }) =>
        api
            .getData<ListTicketsResponse & { context?: any }>(`/staff/queue/hold-full${toQuery(opts as any)}`, STAFF_AUTH)
            .then((res) => normalizeTicketsResponse(res)),

    listOut: (opts?: { limit?: number }) =>
        api
            .getData<ListTicketsResponse & { context?: any }>(`/staff/queue/out-full${toQuery(opts as any)}`, STAFF_AUTH)
            .then((res) => normalizeTicketsResponse(res)),

    // ✅ mine=true => only tickets for this staff's assigned window
    listHistory: (opts?: { limit?: number; mine?: boolean }) =>
        api
            .getData<ListTicketsResponse & { context?: any }>(`/staff/queue/history-full${toQuery(opts as any)}`, STAFF_AUTH)
            .then((res) => normalizeTicketsResponse(res)),

    /**
     * ✅ CENTRALIZED REAL-TIME QUEUE STATE
     * One unified queue state shared across all staff/windows (single DB truth).
     */
    getQueueState: () =>
        api.getData<StaffQueueStateResponse>("/staff/queue/state-full", STAFF_AUTH).then((res) => normalizeQueueStatePayload(res)),

    /**
     * ✅ Primary "Next Queue" action (centralized, race-safe)
     * Route: POST /staff/queue/call-next-central
     */
    callNext: () =>
        api.postData<TicketResponse>("/staff/queue/call-next-central", {}, STAFF_AUTH).then((res) => normalizeTicketResponse(res)),

    /**
     * Legacy "Next Queue" (window-based)
     * Route: POST /staff/queue/call-next
     */
    callNextLegacy: () =>
        api.postData<TicketResponse>("/staff/queue/call-next", {}, STAFF_AUTH).then((res) => normalizeTicketResponse(res)),

    currentCalledForWindow: () =>
        api.getData<CurrentCalledResponse>("/staff/queue/current-called-full", STAFF_AUTH).then((res) => normalizeCurrentCalledResponse(res)),

    /**
     * ✅ Centralized queue operations
     * Routes:
     * - POST /staff/queue/serve
     * - POST /staff/queue/hold
     * - POST /staff/queue/out
     *
     * Payload: { ticketId } (we also include { id } for extra backend compatibility)
     */
    markServed: (ticketId: string) =>
        api.postData<TicketResponse>("/staff/queue/serve", { ticketId, id: ticketId }, STAFF_AUTH).then((res) => normalizeTicketResponse(res)),

    holdNoShow: (ticketId: string) =>
        api.postData<TicketResponse>("/staff/queue/hold", { ticketId, id: ticketId }, STAFF_AUTH).then((res) => normalizeTicketResponse(res)),

    markOut: (ticketId: string) =>
        api.postData<TicketResponse>("/staff/queue/out", { ticketId, id: ticketId }, STAFF_AUTH).then((res) => normalizeTicketResponse(res)),

    /**
     * Legacy ticket operations (kept for backwards compatibility)
     */
    markServedLegacy: (ticketId: string) =>
        api.postData<TicketResponse>(`/staff/tickets/${encodeURIComponent(ticketId)}/served`, {}, STAFF_AUTH).then((res) => normalizeTicketResponse(res)),

    holdNoShowLegacy: (ticketId: string) =>
        api.postData<TicketResponse>(`/staff/tickets/${encodeURIComponent(ticketId)}/hold`, {}, STAFF_AUTH).then((res) => normalizeTicketResponse(res)),

    returnFromHold: (ticketId: string) =>
        api.postData<TicketResponse>(`/staff/tickets/${encodeURIComponent(ticketId)}/return`, {}, STAFF_AUTH).then((res) => normalizeTicketResponse(res)),

    // ✅ SMS endpoints (never throw on provider failures)
    sendSms: (payload: StaffSendSmsRequest) =>
        api.postData<unknown>("/staff/sms/send", payload, STAFF_AUTH_NO_THROW).then((res) => normalizeStaffSmsResponse(res)),

    /**
     * ✅ Legacy alias name, but now calls the unified safe endpoint:
     * POST /staff/tickets/:id/sms  with { status:"CALLED", ...payload }
     */
    sendTicketCalledSms: (ticketId: string, payload?: StaffSendTicketSmsBaseRequest) =>
        api
            .postData<unknown>(
                `/staff/tickets/${encodeURIComponent(ticketId)}/sms`,
                { ...(payload ?? {}), status: "CALLED" },
                STAFF_AUTH_NO_THROW
            )
            .then((res) => normalizeStaffSmsResponse(res)),

    // Unified ticket status SMS (CALLED | HOLD | OUT | SERVED)
    sendTicketStatusSms: (ticketId: string, payload: StaffSendTicketStatusSmsRequest) =>
        api.postData<unknown>(`/staff/tickets/${encodeURIComponent(ticketId)}/sms-status`, payload, STAFF_AUTH_NO_THROW).then((res) => normalizeStaffSmsResponse(res)),

    // ✅ Best DX: unified alias (status OR custom message, defaults to CALLED if none)
    sendTicketSms: (ticketId: string, payload?: StaffSendTicketSmsRequest) =>
        api.postData<unknown>(`/staff/tickets/${encodeURIComponent(ticketId)}/sms`, payload ?? {}, STAFF_AUTH_NO_THROW).then((res) => normalizeStaffSmsResponse(res)),

    // ✅ Staff reports
    getReportsSummary: (opts?: { from?: string; to?: string }) =>
        api.getData<any>(`/staff/reports/summary${toQuery(opts as any)}`, STAFF_AUTH),

    getReportsTimeseries: (opts?: { from?: string; to?: string }) =>
        api.getData<any>(`/staff/reports/timeseries${toQuery(opts as any)}`, STAFF_AUTH),
}