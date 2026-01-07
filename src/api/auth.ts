import { api, ApiError } from "@/lib/http"

export type UserRole = "ADMIN" | "STAFF"

export type AuthUser = {
    id: string
    name: string
    email: string
    role: UserRole
    assignedDepartment: string | null
    assignedWindow: string | null

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

    login: async (email: string, password: string): Promise<LoginResponse> => {
        try {
            return await authApi.adminLogin(email, password)
        } catch (err) {
            if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
                return await authApi.staffLogin(email, password)
            }
            throw err
        }
    },

    me: () => api.get<MeResponse>("/auth/me", { auth: true }),

    updateMe: (payload: UpdateMePayload) => api.patch<LoginResponse>("/auth/me", payload, { auth: true }),

    // ✅ Backend-proxy avatar upload (no S3 CORS needed)
    uploadMyAvatar: (file: File) =>
        api.put<LoginResponse>("/auth/me/avatar", file, {
            auth: true,
            headers: { "Content-Type": file.type },
        }),

    presignAvatarUpload: (payload: { contentType: string; fileName?: string }) =>
        api.post<PresignAvatarResponse>("/auth/me/avatar/presign", payload, { auth: true }),

    getMyAvatarUrl: () => api.get<{ url: string | null }>("/auth/me/avatar/url", { auth: true }),

    checkEmailExists: (email: string) =>
        api.post<EmailExistsResponse>("/auth/email-exists", { email }, { auth: false }),

    forgotPassword: (email: string) =>
        api.post<ForgotPasswordResponse>("/auth/password/forgot", { email }, { auth: false }),

    resetPassword: (token: string, password: string) =>
        api.post<ResetPasswordResponse>("/auth/password/reset", { token, password }, { auth: false }),
}
