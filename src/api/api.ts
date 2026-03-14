import { getApiBaseUrl } from "@/lib/env"

export type ApiRouteParam = string | number

export const API_PREFIX = "/api"

const FRONTEND_DEV_PORTS = new Set(["3000", "3001", "4173", "5173"])
const DEFAULT_LOCAL_API_PORT = "3000"

const LEGACY_API_PATH_ALIASES: ReadonlyArray<readonly [string, string]> = [
    ["/admin/staff", "/users/staff"],
    ["/admin/participants", "/users/participants"],
    ["/admin/reports", "/reports"],
]

function stripTrailingSlash(value: string) {
    return String(value ?? "").replace(/\/+$/, "")
}

function ensureLeadingSlash(value: string) {
    const raw = String(value ?? "").trim()
    if (!raw) return "/"
    return raw.startsWith("/") ? raw : `/${raw}`
}

function stripApiPrefix(value: string) {
    const normalized = ensureLeadingSlash(value)
    if (normalized === API_PREFIX) return ""
    return normalized.replace(/^\/api(?=\/|$)/i, "")
}

function resolveLegacyApiPath(value: string) {
    const normalized = ensureLeadingSlash(value)

    for (const [legacyPath, resolvedPath] of LEGACY_API_PATH_ALIASES) {
        if (normalized === legacyPath) return resolvedPath
        if (normalized.startsWith(`${legacyPath}/`)) {
            return `${resolvedPath}${normalized.slice(legacyPath.length)}`
        }
    }

    return normalized
}

function encodeRouteParam(value: ApiRouteParam) {
    return encodeURIComponent(String(value ?? "").trim())
}

function getRuntimeEnv(name: string) {
    const env = (
        globalThis as typeof globalThis & {
            process?: { env?: Record<string, string | undefined> }
        }
    ).process?.env

    return String(env?.[name] ?? "").trim()
}

function isLikelyLocalDevHostname(hostname: string) {
    const raw = String(hostname ?? "").trim().toLowerCase()
    if (!raw) return false

    if (raw === "localhost" || raw === "0.0.0.0" || raw === "::1") return true
    if (raw.endsWith(".local")) return true
    if (/^127(?:\.\d{1,3}){3}$/.test(raw)) return true
    if (/^10(?:\.\d{1,3}){3}$/.test(raw)) return true
    if (/^192\.168(?:\.\d{1,3}){2}$/.test(raw)) return true
    if (/^172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/.test(raw)) return true

    return false
}

function normalizeDevHostname(hostname: string) {
    const raw = String(hostname ?? "").trim()
    if (!raw) return ""
    if (raw === "0.0.0.0" || raw === "::1") return "127.0.0.1"
    return raw
}

function isFrontendDevPort(port: string) {
    return FRONTEND_DEV_PORTS.has(String(port ?? "").trim())
}

function normalizeExplicitLocalDevApiBase(value: string) {
    const raw = stripTrailingSlash(String(value ?? "").trim())
    if (!raw || raw === API_PREFIX) return raw

    try {
        const url = new URL(raw)
        if (!isLikelyLocalDevHostname(url.hostname)) return raw

        const hostname = normalizeDevHostname(url.hostname)
        const changedHostname = Boolean(hostname) && hostname !== url.hostname

        if (!changedHostname) return raw

        url.hostname = hostname
        return stripTrailingSlash(url.toString())
    } catch {
        return raw
    }
}

function normalizeAbsoluteUrl(value: string) {
    const raw = String(value ?? "").trim()
    if (!raw) return raw

    const candidate = raw.startsWith("//")
        ? typeof window !== "undefined"
            ? `${window.location.protocol}${raw}`
            : `http:${raw}`
        : raw

    try {
        const url = new URL(candidate)

        if (isLikelyLocalDevHostname(url.hostname)) {
            const normalizedHostname = normalizeDevHostname(url.hostname)
            if (normalizedHostname) {
                url.hostname = normalizedHostname
            }
        }

        return url.toString()
    } catch {
        return raw
    }
}

function inferBrowserDevApiBaseUrl() {
    if (typeof window === "undefined") return ""

    const { protocol, hostname, port } = window.location
    if (!isFrontendDevPort(port)) return ""
    if (!isLikelyLocalDevHostname(hostname)) return ""

    const resolvedHostname = normalizeDevHostname(hostname)
    if (!resolvedHostname) return ""

    return `${protocol}//${resolvedHostname}:${DEFAULT_LOCAL_API_PORT}${API_PREFIX}`
}

function inferServerDevApiBaseUrl() {
    if (typeof window !== "undefined") return ""

    const explicitBase = stripTrailingSlash(
        normalizeExplicitLocalDevApiBase(
            getRuntimeEnv("VITE_SERVER_PUBLIC_URL") ||
                getRuntimeEnv("SERVER_PUBLIC_URL") ||
                getRuntimeEnv("VITE_API_BASE_URL") ||
                getRuntimeEnv("NEXT_PUBLIC_API_BASE_URL") ||
                getRuntimeEnv("API_BASE_URL")
        )
    )

    if (explicitBase && explicitBase !== API_PREFIX) {
        return /\/api$/i.test(explicitBase)
            ? explicitBase
            : `${explicitBase}${API_PREFIX}`
    }

    const nodeEnv = getRuntimeEnv("NODE_ENV").toLowerCase()
    if (nodeEnv !== "development") return ""

    return `http://127.0.0.1:${DEFAULT_LOCAL_API_PORT}${API_PREFIX}`
}

function inferLocalDevApiBaseUrl() {
    return inferBrowserDevApiBaseUrl() || inferServerDevApiBaseUrl()
}

function normalizeApiBaseUrl(value: string) {
    const normalizedInput = normalizeExplicitLocalDevApiBase(value)
    const base = stripTrailingSlash(String(normalizedInput ?? "").trim())

    if (!base || base === API_PREFIX) {
        const inferred = inferLocalDevApiBaseUrl()
        return inferred || API_PREFIX
    }

    return /\/api$/i.test(base) ? base : `${base}${API_PREFIX}`
}

export function getResolvedApiBaseUrl() {
    return normalizeApiBaseUrl(getApiBaseUrl())
}

export function toApiPath(path: string) {
    const raw = String(path ?? "").trim()
    if (!raw) return ""

    if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) {
        return raw
    }

    const normalized = stripApiPrefix(raw)
    const resolved = normalized ? resolveLegacyApiPath(normalized) : ""
    return resolved ? ensureLeadingSlash(resolved) : ""
}

export function toApiUrl(path: string) {
    const raw = String(path ?? "").trim()
    if (!raw) return getResolvedApiBaseUrl()

    if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) {
        return normalizeAbsoluteUrl(raw)
    }

    const apiPath = toApiPath(raw)
    return apiPath
        ? `${getResolvedApiBaseUrl()}${apiPath}`
        : getResolvedApiBaseUrl()
}

export const API_PATHS = {
    auth: {
        register: "/auth/register",
        login: "/auth/login",
        forgotPassword: "/auth/forgot-password",
        resetPassword: "/auth/reset-password",
        me: "/auth/me",
        mePassword: "/auth/me/password",
        changePassword: "/auth/change-password",
        meAvatar: "/auth/me/avatar",
        meAvatarPresign: "/auth/me/avatar/presign",
    },
    settings: {
        current: "/settings/current",
        avatar: "/settings/current/avatar",
        avatarPresign: "/settings/current/avatar/presign",
    },
    self: {
        me: "/me",
        mePassword: "/me/password",
        meAvatar: "/me/avatar",
        meAvatarPresign: "/me/avatar/presign",
        usersMe: "/users/me",
        usersMePassword: "/users/me/password",
        usersMeAvatar: "/users/me/avatar",
        usersMeAvatarPresign: "/users/me/avatar/presign",
    },
    auditLogs: {
        list: "/audit-logs",
        recent: "/audit-logs/recent",
        byActor: (actorId: ApiRouteParam) =>
            `/audit-logs/actor/${encodeRouteParam(actorId)}`,
    },
    departments: {
        list: "/departments",
        enabled: "/departments/enabled",
        byId: (id: ApiRouteParam) =>
            `/departments/${encodeRouteParam(id)}`,
        byTransactionManager: (transactionManager: ApiRouteParam) =>
            `/departments/transaction-manager/${encodeRouteParam(
                transactionManager
            )}`,
    },
    serviceWindows: {
        list: "/service-windows",
        enabled: "/service-windows/enabled",
        byId: (id: ApiRouteParam) =>
            `/service-windows/${encodeRouteParam(id)}`,
        byDepartment: (departmentId: ApiRouteParam) =>
            `/service-windows/department/${encodeRouteParam(departmentId)}`,
    },
    transactionPurposes: {
        list: "/transaction-purposes",
    },
    tickets: {
        recent: "/tickets/recent",
        byId: (id: ApiRouteParam) => `/tickets/${encodeRouteParam(id)}`,
        queueByDepartment: (departmentId: ApiRouteParam) =>
            `/tickets/department/${encodeRouteParam(departmentId)}/queue`,
        activeByDepartment: (departmentId: ApiRouteParam) =>
            `/tickets/department/${encodeRouteParam(departmentId)}/active`,
    },
    reports: {
        summary: "/reports/summary",
        timeseries: "/reports/timeseries",
    },
    publicDisplay: {
        managers: "/landing/managers",
        stateByQuery: "/landing/public-display",
        state: (transactionManager: ApiRouteParam) =>
            `/landing/public-display/${encodeRouteParam(transactionManager)}`,
    },
    users: {
        byId: (id: ApiRouteParam) => `/users/${encodeRouteParam(id)}`,
        byStudentId: (studentId: ApiRouteParam) =>
            `/users/student/${encodeRouteParam(studentId)}`,
        staff: "/users/staff",
        staffSendLogin: (id: ApiRouteParam) =>
            `/users/staff/${encodeRouteParam(id)}/send-login`,
        staffResendLogin: (id: ApiRouteParam) =>
            `/users/staff/${encodeRouteParam(id)}/resend-login`,
        participants: "/users/participants",
    },
    admin: {
        auditLogs: "/admin/audit-logs",
        staff: "/admin/staff",
        staffSendLogin: (id: ApiRouteParam) =>
            `/admin/staff/${encodeRouteParam(id)}/send-login`,
        staffResendLogin: (id: ApiRouteParam) =>
            `/admin/staff/${encodeRouteParam(id)}/resend-login`,
        participants: "/admin/participants",
        reports: {
            summary: "/admin/reports/summary",
            timeseries: "/admin/reports/timeseries",
        },
    },
} as const

export const API_ROUTES = {
    auth: {
        register: () => toApiUrl(API_PATHS.auth.register),
        login: () => toApiUrl(API_PATHS.auth.login),
        forgotPassword: () => toApiUrl(API_PATHS.auth.forgotPassword),
        resetPassword: () => toApiUrl(API_PATHS.auth.resetPassword),
        me: () => toApiUrl(API_PATHS.auth.me),
        mePassword: () => toApiUrl(API_PATHS.auth.mePassword),
        changePassword: () => toApiUrl(API_PATHS.auth.changePassword),
        meAvatar: () => toApiUrl(API_PATHS.auth.meAvatar),
        meAvatarPresign: () => toApiUrl(API_PATHS.auth.meAvatarPresign),
    },
    settings: {
        current: () => toApiUrl(API_PATHS.settings.current),
        avatar: () => toApiUrl(API_PATHS.settings.avatar),
        avatarPresign: () => toApiUrl(API_PATHS.settings.avatarPresign),
    },
    self: {
        me: () => toApiUrl(API_PATHS.self.me),
        mePassword: () => toApiUrl(API_PATHS.self.mePassword),
        meAvatar: () => toApiUrl(API_PATHS.self.meAvatar),
        meAvatarPresign: () => toApiUrl(API_PATHS.self.meAvatarPresign),
        usersMe: () => toApiUrl(API_PATHS.self.usersMe),
        usersMePassword: () => toApiUrl(API_PATHS.self.usersMePassword),
        usersMeAvatar: () => toApiUrl(API_PATHS.self.usersMeAvatar),
        usersMeAvatarPresign: () => toApiUrl(API_PATHS.self.usersMeAvatarPresign),
    },
    auditLogs: {
        list: () => toApiUrl(API_PATHS.auditLogs.list),
        recent: () => toApiUrl(API_PATHS.auditLogs.recent),
        byActor: (actorId: ApiRouteParam) =>
            toApiUrl(API_PATHS.auditLogs.byActor(actorId)),
    },
    departments: {
        list: () => toApiUrl(API_PATHS.departments.list),
        enabled: () => toApiUrl(API_PATHS.departments.enabled),
        byId: (id: ApiRouteParam) => toApiUrl(API_PATHS.departments.byId(id)),
        byTransactionManager: (transactionManager: ApiRouteParam) =>
            toApiUrl(
                API_PATHS.departments.byTransactionManager(transactionManager)
            ),
    },
    serviceWindows: {
        list: () => toApiUrl(API_PATHS.serviceWindows.list),
        enabled: () => toApiUrl(API_PATHS.serviceWindows.enabled),
        byId: (id: ApiRouteParam) =>
            toApiUrl(API_PATHS.serviceWindows.byId(id)),
        byDepartment: (departmentId: ApiRouteParam) =>
            toApiUrl(API_PATHS.serviceWindows.byDepartment(departmentId)),
    },
    transactionPurposes: {
        list: () => toApiUrl(API_PATHS.transactionPurposes.list),
    },
    tickets: {
        recent: () => toApiUrl(API_PATHS.tickets.recent),
        byId: (id: ApiRouteParam) => toApiUrl(API_PATHS.tickets.byId(id)),
        queueByDepartment: (departmentId: ApiRouteParam) =>
            toApiUrl(API_PATHS.tickets.queueByDepartment(departmentId)),
        activeByDepartment: (departmentId: ApiRouteParam) =>
            toApiUrl(API_PATHS.tickets.activeByDepartment(departmentId)),
    },
    reports: {
        summary: () => toApiUrl(API_PATHS.reports.summary),
        timeseries: () => toApiUrl(API_PATHS.reports.timeseries),
    },
    publicDisplay: {
        managers: () => toApiUrl(API_PATHS.publicDisplay.managers),
        stateByQuery: () => toApiUrl(API_PATHS.publicDisplay.stateByQuery),
        state: (transactionManager: ApiRouteParam) =>
            toApiUrl(API_PATHS.publicDisplay.state(transactionManager)),
    },
    users: {
        byId: (id: ApiRouteParam) => toApiUrl(API_PATHS.users.byId(id)),
        byStudentId: (studentId: ApiRouteParam) =>
            toApiUrl(API_PATHS.users.byStudentId(studentId)),
        staff: () => toApiUrl(API_PATHS.users.staff),
        staffSendLogin: (id: ApiRouteParam) =>
            toApiUrl(API_PATHS.users.staffSendLogin(id)),
        staffResendLogin: (id: ApiRouteParam) =>
            toApiUrl(API_PATHS.users.staffResendLogin(id)),
        participants: () => toApiUrl(API_PATHS.users.participants),
    },
    admin: {
        auditLogs: () => toApiUrl(API_PATHS.admin.auditLogs),
        staff: () => toApiUrl(API_PATHS.admin.staff),
        staffSendLogin: (id: ApiRouteParam) =>
            toApiUrl(API_PATHS.admin.staffSendLogin(id)),
        staffResendLogin: (id: ApiRouteParam) =>
            toApiUrl(API_PATHS.admin.staffResendLogin(id)),
        participants: () => toApiUrl(API_PATHS.admin.participants),
        reports: {
            summary: () => toApiUrl(API_PATHS.admin.reports.summary),
            timeseries: () => toApiUrl(API_PATHS.admin.reports.timeseries),
        },
    },
} as const