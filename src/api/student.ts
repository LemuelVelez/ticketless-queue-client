/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from "@/lib/http"

export type TicketStatus = "WAITING" | "CALLED" | "HOLD" | "OUT" | "SERVED"

export type Department = {
    _id: string
    name: string
    code?: string
    enabled?: boolean
}

export type TicketDepartment =
    | string
    | {
        _id?: string
        id?: string
        name?: string
        enabled?: boolean
    }

export type Ticket = {
    _id: string
    department: TicketDepartment
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

export type ListDepartmentsResponse = { departments: Department[] }
export type TicketResponse = { ticket: Ticket }
export type FindActiveTicketResponse = { ticket: Ticket | null }

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

export const studentApi = {
    // Public
    listDepartments: () => api.get<ListDepartmentsResponse>("/public/departments", { auth: false }),

    joinQueue: (payload: { departmentId: string; studentId: string; phone?: string }) =>
        api.post<TicketResponse>("/public/tickets/join", payload, { auth: false }),

    getTicket: (id: string) => api.get<TicketResponse>(`/public/tickets/${encodeURIComponent(id)}`, { auth: false }),

    // Optional helper: find active ticket for today
    findActiveByStudent: (opts: { departmentId: string; studentId: string }) =>
        api.get<FindActiveTicketResponse>(`/public/tickets${toQuery(opts as any)}`, { auth: false }),
}
