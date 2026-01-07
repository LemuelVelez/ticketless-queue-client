import { api, ApiError } from "@/lib/http"

export type UserRole = "ADMIN" | "STAFF"

export type AuthUser = {
    id: string
    name: string
    email: string
    role: UserRole
    assignedDepartment: string | null
    assignedWindow: string | null

    // ✅ Optional avatar fields
    avatarKey?: string | null
    avatarUrl?: string | null
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

        avatarKey?: string | null
        avatarUrl?: string | null
    } | null
}

export type ForgotPasswordResponse = { ok: true }
export type ResetPasswordResponse = { ok: true }

export type EmailExistsResponse = { exists: boolean }

export type UpdateMePayload = {
    name?: string
    email?: string
    currentPassword?: string
    newPassword?: string
    avatarKey?: string | null
    avatarUrl?: string | null
}

export type PresignAvatarResponse = {
    uploadUrl: string
    key: string
    objectUrl: string
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

    // ✅ Update current user (returns refreshed token + user)
    updateMe: (payload: UpdateMePayload) => api.patch<LoginResponse>("/auth/me", payload, { auth: true }),

    // ✅ Presign S3 upload (backend uses AWS_* env; frontend never sees secrets)
    presignAvatarUpload: (payload: { contentType: string; fileName?: string }) =>
        api.post<PresignAvatarResponse>("/auth/me/avatar/presign", payload, { auth: true }),

    // ✅ Get a display URL for current avatar (may be signed if bucket is private)
    getMyAvatarUrl: () => api.get<{ url: string | null }>("/auth/me/avatar/url", { auth: true }),

    // ✅ Check if an email exists (active account)
    checkEmailExists: (email: string) =>
        api.post<EmailExistsResponse>("/auth/email-exists", { email }, { auth: false }),

    // ✅ Password reset flow
    forgotPassword: (email: string) =>
        api.post<ForgotPasswordResponse>("/auth/password/forgot", { email }, { auth: false }),

    resetPassword: (token: string, password: string) =>
        api.post<ResetPasswordResponse>("/auth/password/reset", { token, password }, { auth: false }),
}
