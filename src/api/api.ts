import { getApiBaseUrl } from "@/lib/env"

export type ApiRouteParam = string | number

export const API_PREFIX = "/api"

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

function encodeRouteParam(value: ApiRouteParam) {
    return encodeURIComponent(String(value ?? "").trim())
}

function inferLocalDevApiBaseUrl() {
    if (typeof window === "undefined") return ""

    const { protocol, hostname, port } = window.location
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1"
    const isFrontendDevPort =
        port === "3000" || port === "3001" || port === "4173" || port === "5173"

    if (!isLocalHost || !isFrontendDevPort) return ""

    return `${protocol}//${hostname}:5000${API_PREFIX}`
}

function normalizeApiBaseUrl(value: string) {
    const base = stripTrailingSlash(String(value ?? "").trim())

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
    return normalized ? ensureLeadingSlash(normalized) : ""
}

export function toApiUrl(path: string) {
    const raw = String(path ?? "").trim()
    if (!raw) return getResolvedApiBaseUrl()

    if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) {
        return raw
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
    },
    settings: {
        current: "/settings/current",
    },
    auditLogs: {
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
    users: {
        byId: (id: ApiRouteParam) => `/users/${encodeRouteParam(id)}`,
        byStudentId: (studentId: ApiRouteParam) =>
            `/users/student/${encodeRouteParam(studentId)}`,
        staff: "/users/staff",
        participants: "/users/participants",
    },
} as const

export const API_ROUTES = {
    auth: {
        register: () => toApiUrl(API_PATHS.auth.register),
        login: () => toApiUrl(API_PATHS.auth.login),
        forgotPassword: () => toApiUrl(API_PATHS.auth.forgotPassword),
        resetPassword: () => toApiUrl(API_PATHS.auth.resetPassword),
        me: () => toApiUrl(API_PATHS.auth.me),
    },
    settings: {
        current: () => toApiUrl(API_PATHS.settings.current),
    },
    auditLogs: {
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
    users: {
        byId: (id: ApiRouteParam) => toApiUrl(API_PATHS.users.byId(id)),
        byStudentId: (studentId: ApiRouteParam) =>
            toApiUrl(API_PATHS.users.byStudentId(studentId)),
        staff: () => toApiUrl(API_PATHS.users.staff),
        participants: () => toApiUrl(API_PATHS.users.participants),
    },
} as const