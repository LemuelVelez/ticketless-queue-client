import { api, ApiError } from "@/lib/http"

export type UserRole = "ADMIN" | "STAFF"

export type AuthUser = {
    id: string
    name: string
    email: string
    role: UserRole
    assignedDepartment: string | null
    assignedWindow: string | null
}

export type LoginResponse = {
    token: string
    user: AuthUser
}

export type MeResponse = {
    user: {
        id: string
        role: UserRole
        name?: string
        email?: string
        assignedDepartment?: string
        assignedWindow?: string
    } | null
}

export const authApi = {
    adminLogin: (email: string, password: string) =>
        api.post<LoginResponse>("/auth/admin/login", { email, password }, { auth: false }),

    staffLogin: (email: string, password: string) =>
        api.post<LoginResponse>("/auth/staff/login", { email, password }, { auth: false }),

    /**
     * Convenience: tries ADMIN first, then STAFF.
     * Keeps your single login form working without a role selector.
     */
    login: async (email: string, password: string): Promise<LoginResponse> => {
        try {
            return await authApi.adminLogin(email, password)
        } catch (err) {
            // If admin login fails (usually 401), try staff login.
            if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
                return await authApi.staffLogin(email, password)
            }
            throw err
        }
    },

    me: () => api.get<MeResponse>("/auth/me", { auth: true }),
}
