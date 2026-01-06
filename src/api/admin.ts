import { api } from "@/lib/http"

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

export type StaffUser = {
    id?: string
    _id?: string
    name: string
    email: string
    role: "STAFF"
    active: boolean
    assignedDepartment: string | null
    assignedWindow: string | null
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

    // STAFF
    listStaff: () => api.get<{ staff: StaffUser[] }>("/admin/staff"),
    createStaff: (payload: {
        name: string
        email: string
        password: string
        departmentId: string
        windowId: string
    }) => api.post<{ staff: StaffUser }>("/admin/staff", payload),
    updateStaff: (id: string, payload: {
        name?: string
        active?: boolean
        departmentId?: string
        windowId?: string
        password?: string
    }) => api.put<{ staff: StaffUser }>(`/admin/staff/${id}`, payload),
}
