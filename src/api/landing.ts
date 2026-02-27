import { api } from "@/lib/http"

export type TicketParticipantType = "STUDENT" | "ALUMNI_VISITOR" | "GUEST" | "ALUMNI" | "UNKNOWN"

export type TicketView = {
    id: string
    dateKey: string
    queueNumber: number
    status: string
    department: { id: string; name: string; code?: string; transactionManager: string }
    participant: { studentId: string; name?: string; phone?: string; type?: TicketParticipantType }
    window?: { id: string; name: string; number: number }
    createdAt: string
    updatedAt: string
}

export type Announcement = {
    id: string
    createdAt: string
    ticketId: string
    queueNumber: number
    departmentName: string
    windowNumber?: number
    windowName?: string
    participantName?: string
    participantType?: TicketParticipantType
    voiceText: string
}

export type PublicDisplayState = {
    manager: string
    serverTime: string
    dateKey: string
    windows: Array<{
        id: string
        name: string
        number: number
        enabled: boolean
        departments: Array<{ id: string; name: string; code?: string }>
        nowServing?: TicketView
    }>
    departments: Array<{ id: string; name: string; code?: string }>
    upNext: TicketView[]
    announcements: Announcement[]
}

export type PublicManagerDepartmentsResponse = {
    manager: string
    departments: Array<{ id: string; name: string; code?: string; transactionManager?: string }>
}

export type PublicManagerWindowsResponse = {
    manager: string
    windows: Array<{
        id: string
        name: string
        number: number
        enabled: boolean
        departments: Array<{ id: string; name: string; code?: string }>
    }>
}

type ApiEnvelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string } }

const DISPLAY_BASE = "/display"

function isApiEnvelope<T>(v: unknown): v is ApiEnvelope<T> {
    if (!v || typeof v !== "object") return false
    return "ok" in (v as any)
}

/**
 * Normalizes common API shapes:
 *  - ApiEnvelope<T>
 *  - T
 *  - { data: ApiEnvelope<T> }
 *  - { data: T }
 */
function unwrap<T>(res: unknown): T {
    const payload = res && typeof res === "object" && "data" in (res as any) ? (res as any).data : res

    if (isApiEnvelope<T>(payload)) {
        if (!payload.ok) {
            const msg = payload.error?.message || "Request failed."
            throw new Error(msg)
        }
        if (payload.data === undefined) {
            throw new Error("Request succeeded but no data was returned.")
        }
        return payload.data
    }

    if (payload === undefined || payload === null) {
        throw new Error("Empty response.")
    }

    return payload as T
}

export const landingApi = {
    /**
     * PUBLIC DISPLAY: managers for the dropdown/tabs.
     * GET /display/managers -> { managers: string[] }
     */
    async listManagers(): Promise<string[]> {
        const res = await api.get<{ managers: string[] }>(`${DISPLAY_BASE}/managers`, { auth: false })
        const data = unwrap<{ managers: string[] }>(res)
        return Array.isArray(data?.managers) ? data.managers : []
    },

    /**
     * PUBLIC DISPLAY: departments under manager (names first).
     * GET /display/manager/:manager/departments
     */
    async listDepartmentsByManager(manager: string): Promise<PublicManagerDepartmentsResponse> {
        const safe = encodeURIComponent(String(manager ?? "").trim())
        const res = await api.get<PublicManagerDepartmentsResponse>(`${DISPLAY_BASE}/manager/${safe}/departments`, {
            auth: false,
        })
        return unwrap<PublicManagerDepartmentsResponse>(res)
    },

    /**
     * PUBLIC DISPLAY: windows under manager (includes mapped departments).
     * GET /display/manager/:manager/windows
     */
    async listWindowsByManager(manager: string): Promise<PublicManagerWindowsResponse> {
        const safe = encodeURIComponent(String(manager ?? "").trim())
        const res = await api.get<PublicManagerWindowsResponse>(`${DISPLAY_BASE}/manager/${safe}/windows`, { auth: false })
        return unwrap<PublicManagerWindowsResponse>(res)
    },

    /**
     * PUBLIC DISPLAY: centralized state for big screen.
     * GET /display/manager/:manager/state?since=ISO
     */
    async getPublicDisplayState(manager: string, since?: string): Promise<PublicDisplayState> {
        const safe = encodeURIComponent(String(manager ?? "").trim())
        const res = await api.get<PublicDisplayState>(`${DISPLAY_BASE}/manager/${safe}/state`, {
            auth: false,
            params: since ? { since } : undefined,
        })
        return unwrap<PublicDisplayState>(res)
    },

    /**
     * PUBLIC DISPLAY: announcements only (for voice polling).
     * GET /display/manager/:manager/announcements?since=ISO
     */
    async getManagerAnnouncements(manager: string, since?: string): Promise<Pick<PublicDisplayState, "manager" | "dateKey" | "serverTime" | "announcements">> {
        const safe = encodeURIComponent(String(manager ?? "").trim())
        const res = await api.get<Pick<PublicDisplayState, "manager" | "dateKey" | "serverTime" | "announcements">>(
            `${DISPLAY_BASE}/manager/${safe}/announcements`,
            {
                auth: false,
                params: since ? { since } : undefined,
            }
        )
        return unwrap<Pick<PublicDisplayState, "manager" | "dateKey" | "serverTime" | "announcements">>(res)
    },
}