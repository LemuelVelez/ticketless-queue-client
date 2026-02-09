/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from "@/lib/http"
import type { UserRole } from "@/api/auth"

export type Setting = {
    maxHoldAttempts: number
    disallowDuplicateActiveTickets: boolean
    upNextCount: number
}

export type Department = {
    _id: string
    name: string
    code?: string

    /**
     * Top-level manager / office that owns the transaction catalog
     * for this department (e.g., REGISTRAR, LIBRARY, ADMIN_BUILDING).
     */
    transactionManager?: string

    enabled?: boolean
}

export type ServiceWindow = {
    _id: string

    /**
     * Legacy primary department (kept by backend for compatibility).
     * This is the first item from departmentIds.
     */
    department: string

    /**
     * A window may be bound to multiple departments.
     */
    departmentIds?: string[]

    name: string
    number: number
    enabled?: boolean
}

export type TransactionScope = "INTERNAL" | "EXTERNAL"

export type TransactionPurpose = {
    id: string
    category: string
    key: string
    label: string
    scopes: TransactionScope[]
    departmentIds: string[]
    enabled: boolean
    sortOrder: number
    meta?: Record<string, unknown>
    createdAt: string
    updatedAt: string
}

/**
 * NOTE:
 * Kept the name `StaffUser` for backwards-compat with existing pages,
 * but this now represents BOTH STAFF and ADMIN users (per updated backend).
 */
export type StaffUser = {
    id?: string
    _id?: string
    name: string
    email: string
    role: UserRole
    active: boolean

    /**
     * Legacy primary department (kept for backward compatibility)
     */
    assignedDepartment: string | null

    /**
     * New multi-department assignment for STAFF users.
     * Staff can belong to several departments.
     */
    assignedDepartments?: string[]

    /**
     * Staff can be assigned to one window at a time.
     */
    assignedWindow: string | null

    assignedTransactionManager?: string | null
}

type CreateUserPayload = {
    name: string
    email: string
    password: string
    role?: UserRole

    /**
     * STAFF assignment:
     * - transactionManager is the top-level office (e.g. REGISTRAR)
     * - departmentIds may contain multiple departments
     * - windowId is a single window assignment
     */
    transactionManager?: string | null
    departmentId?: string | null // legacy single department
    departmentIds?: string[] | null // new multi-department assignment
    windowId?: string | null
}

type UpdateUserPayload = {
    name?: string
    active?: boolean
    role?: UserRole
    transactionManager?: string | null
    departmentId?: string | null // legacy single department
    departmentIds?: string[] | null // new multi-department assignment
    windowId?: string | null
    password?: string
}

/** =========================
 * REPORTS + AUDIT LOGS TYPES
 * ========================= */

export type ReportRange = {
    from: string // YYYY-MM-DD
    to: string // YYYY-MM-DD
}

export type TicketStatus = "WAITING" | "CALLED" | "HOLD" | "OUT" | "SERVED"

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

export type AuditLogRow = {
    id: string
    actorId: string | null
    actorRole: UserRole | null
    actorName: string | null
    actorEmail: string | null

    action: string
    entityType?: string
    entityId: string | null
    meta?: Record<string, unknown>
    createdAt: string
}

export type AuditLogsResponse = {
    page: number
    limit: number
    total: number
    logs: AuditLogRow[]
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

export const adminApi = {
    // SETTINGS
    getSettings: () => api.get<{ settings: Setting | null }>("/admin/settings"),
    updateSettings: (payload: Partial<Setting>) => api.put<{ settings: Setting }>("/admin/settings", payload),

    // DEPARTMENTS (CRUD)
    listDepartments: () => api.get<{ departments: Department[] }>("/admin/departments"),
    getDepartment: (id: string) => api.get<{ department: Department }>(`/admin/departments/${id}`),
    createDepartment: (payload: { name: string; code?: string; transactionManager?: string }) =>
        api.post<{ department: Department }>("/admin/departments", payload),
    updateDepartment: (
        id: string,
        payload: { name?: string; code?: string; transactionManager?: string; enabled?: boolean }
    ) => api.put<{ department: Department }>(`/admin/departments/${id}`, payload),
    deleteDepartment: (id: string) => api.delete<{ ok: true }>(`/admin/departments/${id}`),

    // TRANSACTION PURPOSES
    listTransactionPurposes: (opts?: {
        category?: string
        key?: string
        scope?: TransactionScope
        departmentId?: string
        enabledOnly?: boolean
        includeDisabled?: boolean
        matchDepartmentOrGlobal?: boolean
    }) => api.get<{ transactions: TransactionPurpose[] }>(`/admin/transaction-purposes${toQuery(opts as any)}`),

    createTransactionPurpose: (payload: {
        category: string
        key: string
        label: string
        scopes?: TransactionScope[]
        departmentId?: string
        departmentIds?: string[]
        applyToAllDepartments?: boolean
        enabled?: boolean
        sortOrder?: number
        meta?: Record<string, unknown>
    }) => api.post<{ transaction: TransactionPurpose }>("/admin/transaction-purposes", payload),

    updateTransactionPurpose: (
        id: string,
        payload: Partial<{
            category: string
            key: string
            label: string
            scopes: TransactionScope[]
            departmentId: string
            departmentIds: string[]
            applyToAllDepartments: boolean
            enabled: boolean
            sortOrder: number
            meta: Record<string, unknown>
        }>
    ) => api.put<{ transaction: TransactionPurpose }>(`/admin/transaction-purposes/${id}`, payload),

    deleteTransactionPurpose: (id: string) => api.delete<{ ok: true }>(`/admin/transaction-purposes/${id}`),

    // WINDOWS (CRUD)
    listWindows: (opts?: { departmentId?: string }) => {
        const qs = opts?.departmentId ? `?departmentId=${encodeURIComponent(opts.departmentId)}` : ""
        return api.get<{ windows: ServiceWindow[] }>(`/admin/windows${qs}`)
    },
    getWindow: (id: string) => api.get<{ window: ServiceWindow }>(`/admin/windows/${id}`),
    createWindow: (payload: { departmentId?: string; departmentIds?: string[]; name: string; number: number }) =>
        api.post<{ window: ServiceWindow }>("/admin/windows", payload),
    updateWindow: (
        id: string,
        payload: {
            name?: string
            number?: number
            enabled?: boolean
            departmentId?: string | null
            departmentIds?: string[]
        }
    ) => api.put<{ window: ServiceWindow }>(`/admin/windows/${id}`, payload),
    deleteWindow: (id: string) => api.delete<{ ok: true }>(`/admin/windows/${id}`),

    // ACCOUNTS (backend still uses /admin/staff endpoints; now supports both ADMIN & STAFF)
    listStaff: () => api.get<{ staff: StaffUser[] }>("/admin/staff"),
    createStaff: (payload: CreateUserPayload) => api.post<{ staff: StaffUser }>("/admin/staff", payload),
    updateStaff: (id: string, payload: UpdateUserPayload) =>
        api.put<{ staff: StaffUser }>(`/admin/staff/${id}`, payload),

    deleteStaff: (id: string) => api.delete<{ ok: true }>(`/admin/staff/${id}`),

    // REPORTS
    getReportsSummary: (opts?: { from?: string; to?: string; departmentId?: string }) =>
        api.get<ReportsSummaryResponse>(`/admin/reports/summary${toQuery(opts)}`),

    getReportsTimeseries: (opts?: { from?: string; to?: string; departmentId?: string }) =>
        api.get<ReportsTimeseriesResponse>(`/admin/reports/timeseries${toQuery(opts)}`),

    // AUDIT LOGS
    listAuditLogs: (opts?: {
        page?: number
        limit?: number
        action?: string
        entityType?: string
        actorRole?: UserRole
        from?: string
        to?: string
    }) => api.get<AuditLogsResponse>(`/admin/audit-logs${toQuery(opts as any)}`),
}
