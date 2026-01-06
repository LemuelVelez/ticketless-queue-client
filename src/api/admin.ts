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
    enabled?: boolean
}

export type ServiceWindow = {
    _id: string
    department: string
    name: string
    number: number
    enabled?: boolean
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
    assignedDepartment: string | null
    assignedWindow: string | null
}

type CreateUserPayload = {
    name: string
    email: string
    password: string
    role?: UserRole

    /**
     * For STAFF users these may be required by your business rules.
     * For ADMIN users these should typically be omitted / null.
     */
    departmentId?: string | null
    windowId?: string | null
}

type UpdateUserPayload = {
    name?: string
    active?: boolean
    role?: UserRole
    departmentId?: string | null
    windowId?: string | null
    password?: string
}

function apiDelete(path: string) {
    // Your http client may expose delete() or del(). Wrap it here so callers don't need any hacks.
    const apiAny = api as unknown as {
        delete?: (p: string) => Promise<unknown>
        del?: (p: string) => Promise<unknown>
    }

    if (typeof apiAny.delete === "function") return apiAny.delete(path)
    if (typeof apiAny.del === "function") return apiAny.del(path)

    // If neither exists, throw so the UI can fallback (or you can implement delete in lib/http)
    throw new Error("HTTP client has no delete() / del() method")
}

export const adminApi = {
    // SETTINGS
    getSettings: () => api.get<{ settings: Setting | null }>("/admin/settings"),
    updateSettings: (payload: Partial<Setting>) => api.put<{ settings: Setting }>("/admin/settings", payload),

    // DEPARTMENTS
    listDepartments: () => api.get<{ departments: Department[] }>("/admin/departments"),
    createDepartment: (payload: { name: string; code?: string }) =>
        api.post<{ department: Department }>("/admin/departments", payload),
    updateDepartment: (id: string, payload: { name?: string; code?: string; enabled?: boolean }) =>
        api.put<{ department: Department }>(`/admin/departments/${id}`, payload),

    // WINDOWS
    listWindows: (opts?: { departmentId?: string }) => {
        const qs = opts?.departmentId ? `?departmentId=${encodeURIComponent(opts.departmentId)}` : ""
        return api.get<{ windows: ServiceWindow[] }>(`/admin/windows${qs}`)
    },
    createWindow: (payload: { departmentId: string; name: string; number: number }) =>
        api.post<{ window: ServiceWindow }>("/admin/windows", payload),
    updateWindow: (id: string, payload: { name?: string; number?: number; enabled?: boolean }) =>
        api.put<{ window: ServiceWindow }>(`/admin/windows/${id}`, payload),

    // ACCOUNTS (backend still uses /admin/staff endpoints; now supports both ADMIN & STAFF)
    listStaff: () => api.get<{ staff: StaffUser[] }>("/admin/staff"),

    createStaff: (payload: CreateUserPayload) =>
        api.post<{ staff: StaffUser }>("/admin/staff", payload),

    updateStaff: (id: string, payload: UpdateUserPayload) =>
        api.put<{ staff: StaffUser }>(`/admin/staff/${id}`, payload),

    deleteStaff: async (id: string) => {
        // backend now supports DELETE /admin/staff/:id
        await apiDelete(`/admin/staff/${id}`)
        return { ok: true as const }
    },
}
