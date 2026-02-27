/* eslint-disable @typescript-eslint/no-explicit-any */
import { getApiBaseUrl } from "@/lib/env"
import { getAuthToken, getParticipantToken } from "@/lib/auth"

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
export type RequestAuthMode = boolean | "staff" | "participant" | "auto"

export class ApiError extends Error {
    status: number
    data?: unknown
    method?: HttpMethod
    url?: string
    path?: string

    constructor(
        message: string,
        status: number,
        data?: unknown,
        meta?: { method?: HttpMethod; url?: string; path?: string }
    ) {
        super(message)
        this.name = "ApiError"
        this.status = status
        this.data = data
        this.method = meta?.method
        this.url = meta?.url
        this.path = meta?.path
    }
}

type QueryParamValue = string | number | boolean | null | undefined

export type ApiData<T> = T | { data: T }

export function unwrapApiData<T>(value: ApiData<T>): T {
    if (value && typeof value === "object" && "data" in (value as Record<string, unknown>)) {
        return (value as { data: T }).data
    }
    return value as T
}

type RequestOptions = {
    method?: HttpMethod
    body?: unknown
    headers?: Record<string, string>
    /**
     * auth modes:
     * - "auto": prefer staff token, fallback to participant token (default)
     * - true / "staff": use staff/admin token
     * - "participant": use participant token
     * - false: no token
     */
    auth?: RequestAuthMode
    /**
     * Optional query params. Automatically merged with existing query string.
     * Example: { since: "2026-02-27T00:00:00.000Z" }
     */
    params?: Record<string, QueryParamValue>
    /**
     * Fetch credentials behavior.
     * Default is smart:
     * - same-origin API -> "include" (keeps cookie-based flows working)
     * - cross-origin API -> "omit" (prevents CORS failures when backend uses wildcard origins)
     */
    credentials?: RequestCredentials
    signal?: AbortSignal
}

function stripTrailingSlash(s: string) {
    return s.endsWith("/") ? s.slice(0, -1) : s
}

function normalizeApiBaseUrl(rawBase: string) {
    const base = String(rawBase ?? "").trim()
    if (!base) return ""

    if (/^https?:\/\//i.test(base)) return stripTrailingSlash(base)

    if (base.startsWith("//")) {
        if (typeof window !== "undefined") return stripTrailingSlash(`${window.location.protocol}${base}`)
        return stripTrailingSlash(`https:${base}`)
    }

    if (base.startsWith("/")) {
        if (typeof window !== "undefined") return stripTrailingSlash(`${window.location.origin}${base}`)
        return stripTrailingSlash(base)
    }

    if (base.startsWith(":")) {
        if (typeof window !== "undefined") {
            return stripTrailingSlash(`${window.location.protocol}//${window.location.hostname}${base}`)
        }
        return stripTrailingSlash(`http://localhost${base}`)
    }

    if (/^[a-z0-9.-]+(:\d+)?(\/.*)?$/i.test(base)) {
        if (typeof window !== "undefined") return stripTrailingSlash(`${window.location.protocol}//${base}`)
        return stripTrailingSlash(`http://${base}`)
    }

    return stripTrailingSlash(base)
}

function joinUrl(base: string, path: string) {
    if (!base) return path
    const b = stripTrailingSlash(base)
    const p = path.startsWith("/") ? path : `/${path}`
    return `${b}${p}`
}

function buildUrl(path: string) {
    const base = normalizeApiBaseUrl(getApiBaseUrl())
    const cleanPath = path.startsWith("/") ? path : `/${path}`
    return joinUrl(base, cleanPath)
}

function hasHeader(headers: Record<string, string>, key: string) {
    const target = key.toLowerCase()
    return Object.keys(headers).some((k) => k.toLowerCase() === target)
}

function getHeaderValue(headers: Record<string, string>, key: string) {
    const target = key.toLowerCase()
    const found = Object.entries(headers).find(([k]) => k.toLowerCase() === target)
    return found ? found[1] : undefined
}

function resolveAuthToken(auth: RequestAuthMode | undefined): string | null {
    const mode: RequestAuthMode = auth === undefined ? "auto" : auth

    if (mode === false) return null
    if (mode === true || mode === "staff") return getAuthToken()
    if (mode === "participant") return getParticipantToken()

    // ✅ auto: prefer staff, fallback to participant
    return getAuthToken() || getParticipantToken() || null
}

function ensureSessionTokenHeader(headers: Record<string, string>) {
    // ✅ Max compatibility across deployments:
    // If we have Authorization: Bearer <token> but no X-Session-Token,
    // add it so public/participant endpoints still work when proxies strip Authorization.
    if (hasHeader(headers, "X-Session-Token")) return

    const auth = getHeaderValue(headers, "Authorization")
    if (!auth) return
    const s = String(auth).trim()
    if (!s.toLowerCase().startsWith("bearer ")) return

    const token = s.slice(7).trim()
    if (!token) return

    headers["X-Session-Token"] = token
}

function ensureAuthorizationFromSessionToken(headers: Record<string, string>) {
    // ✅ Some backends only read Authorization; if caller/proxy prefers X-Session-Token,
    // mirror it back into Authorization (but never override an explicit Authorization).
    if (hasHeader(headers, "Authorization")) return

    const session = getHeaderValue(headers, "X-Session-Token")
    const token = String(session || "").trim()
    if (!token) return

    headers.Authorization = `Bearer ${token}`
}

function withQuery(path: string, params?: Record<string, QueryParamValue>) {
    if (!params) return path

    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    if (!entries.length) return path

    const [beforeHash, hash] = path.split("#", 2)
    const [base, existingQs] = beforeHash.split("?", 2)

    const qs = new URLSearchParams(existingQs || "")
    for (const [k, v] of entries) {
        qs.set(k, String(v))
    }

    const next = `${base}?${qs.toString()}`
    return hash ? `${next}#${hash}` : next
}

async function parseResponseSafe(res: Response) {
    if (res.status === 204) return null

    const text = await res.text()
    if (!text) return null

    const contentType = String(res.headers.get("content-type") || "").toLowerCase()
    const looksJson = contentType.includes("application/json") || contentType.includes("+json")

    if (looksJson) {
        try {
            return JSON.parse(text)
        } catch {
            // Fall through and return text for better diagnostics
        }
    }

    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

function isBlobBody(body: unknown): body is Blob {
    // File is also a Blob in browsers
    return typeof Blob !== "undefined" && body instanceof Blob
}

function isBodyInitLike(body: unknown): body is BodyInit {
    if (typeof body === "string") return true
    if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) return true
    if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) return true
    if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(body)) return true
    if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) return true
    return false
}

function snippet(val: unknown, max = 220) {
    if (typeof val !== "string") return ""
    const s = val.replace(/\s+/g, " ").trim()
    if (!s) return ""
    return s.length > max ? `${s.slice(0, max)}…` : s
}

function resolveCredentials(url: string, explicit?: RequestCredentials): RequestCredentials {
    if (explicit) return explicit

    // In SSR / Node contexts, omit by default.
    if (typeof window === "undefined") return "omit"

    // If API is same-origin, keep include (supports cookie-based admin/staff sessions if any).
    // If cross-origin, omit to avoid common CORS failures (wildcard origins + credentials is blocked by browsers).
    try {
        const u = new URL(url, window.location.origin)
        return u.origin === window.location.origin ? "include" : "omit"
    } catch {
        // Safe fallback
        return "omit"
    }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, headers = {}, auth = "auto", params, credentials, signal } = options

    const finalHeaders: Record<string, string> = {
        Accept: "application/json",
        ...headers,
    }

    // Respect caller-provided Authorization header.
    if (!hasHeader(finalHeaders, "Authorization")) {
        const token = resolveAuthToken(auth)
        if (token) finalHeaders.Authorization = `Bearer ${token}`
    }

    // ✅ Ensure X-Session-Token mirrors Bearer token when not explicitly provided
    ensureSessionTokenHeader(finalHeaders)
    // ✅ And the other way around (if only X-Session-Token is set)
    ensureAuthorizationFromSessionToken(finalHeaders)

    let finalBody: BodyInit | undefined

    // Support FormData
    if (body instanceof FormData) {
        finalBody = body
    } else if (isBlobBody(body)) {
        finalBody = body
        // Only set content-type if caller didn't already set it
        if (!hasHeader(finalHeaders, "Content-Type") && body.type) {
            finalHeaders["Content-Type"] = body.type
        }
    } else if (body !== undefined) {
        if (isBodyInitLike(body)) {
            finalBody = body
            if (typeof body === "string" && !hasHeader(finalHeaders, "Content-Type")) {
                finalHeaders["Content-Type"] = "text/plain;charset=UTF-8"
            }
        } else {
            if (!hasHeader(finalHeaders, "Content-Type")) {
                finalHeaders["Content-Type"] = "application/json"
            }
            finalBody = JSON.stringify(body)
        }
    }

    const url = buildUrl(withQuery(path, params))

    let res: Response
    try {
        res = await fetch(url, {
            method,
            headers: finalHeaders,
            body: finalBody,
            signal,
            credentials: resolveCredentials(url, credentials),
        })
    } catch (err: any) {
        throw new ApiError(
            `Cannot reach API server at ${url}. Check your API base URL and make sure the backend is running.`,
            0,
            err,
            { method, url, path }
        )
    }

    const data = await parseResponseSafe(res)

    if (!res.ok) {
        const responseHeaderMsg = res.headers.get("x-error-message") || res.headers.get("X-Error-Message") || ""
        const serverMsg =
            (data as any)?.message ||
            (data as any)?.error ||
            (data as any)?.detail ||
            (data as any)?.title

        const default404 = `Endpoint not found (404): ${method} ${url}. This usually means the backend route is missing or the API base URL is wrong.`
        const baseMessage =
            serverMsg ||
            responseHeaderMsg ||
            (res.status === 404 ? default404 : res.statusText || "Request failed")

        const bodyHint =
            typeof data === "string" && data.includes("<html")
                ? ` Server returned an HTML error page: "${snippet(data)}"`
                : typeof data === "string"
                  ? ` Response: "${snippet(data)}"`
                  : ""

        throw new ApiError(`${baseMessage}${bodyHint}`, res.status, data, { method, url, path })
    }

    return data as T
}

export const api = {
    get: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
        apiRequest<T>(path, { ...opts, method: "GET" }),

    post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
        apiRequest<T>(path, { ...opts, method: "POST", body }),

    put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
        apiRequest<T>(path, { ...opts, method: "PUT", body }),

    patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
        apiRequest<T>(path, { ...opts, method: "PATCH", body }),

    delete: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
        apiRequest<T>(path, { ...opts, method: "DELETE" }),

    del: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
        apiRequest<T>(path, { ...opts, method: "DELETE" }),
}