/* eslint-disable @typescript-eslint/no-explicit-any */
import { getApiBaseUrl } from "@/lib/env"
import { getAnyAuthToken, getAuthToken, getParticipantToken } from "@/lib/auth"

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
export type RequestAuthMode = boolean | "staff" | "participant" | "auto"

export class ApiError extends Error {
    status: number
    data?: unknown

    constructor(message: string, status: number, data?: unknown) {
        super(message)
        this.name = "ApiError"
        this.status = status
        this.data = data
    }
}

type RequestOptions = {
    method?: HttpMethod
    body?: unknown
    headers?: Record<string, string>
    /**
     * auth modes:
     * - true / "staff": use staff/admin token (default)
     * - "participant": use participant token
     * - "auto": prefer staff token, fallback to participant token
     * - false: no token
     */
    auth?: RequestAuthMode
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

function getHeader(headers: Record<string, string>, key: string): string | undefined {
    const target = key.toLowerCase()
    const foundKey = Object.keys(headers).find((k) => k.toLowerCase() === target)
    return foundKey ? headers[foundKey] : undefined
}

function resolveAuthToken(auth: RequestAuthMode | undefined): string | null {
    const mode: RequestAuthMode = auth === undefined ? true : auth

    if (mode === false) return null
    if (mode === true || mode === "staff") return getAuthToken()
    if (mode === "participant") return getParticipantToken()
    return getAnyAuthToken("staff")
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

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, headers = {}, auth = true, signal } = options

    const finalHeaders: Record<string, string> = {
        Accept: "application/json",
        ...headers,
    }

    // Respect caller-provided Authorization header.
    if (!hasHeader(finalHeaders, "Authorization")) {
        const token = resolveAuthToken(auth)
        if (token) finalHeaders.Authorization = `Bearer ${token}`
    }

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
            if (
                typeof body === "string" &&
                !hasHeader(finalHeaders, "Content-Type")
            ) {
                finalHeaders["Content-Type"] = "text/plain;charset=UTF-8"
            }
        } else {
            if (!hasHeader(finalHeaders, "Content-Type")) {
                finalHeaders["Content-Type"] = "application/json"
            }
            finalBody = JSON.stringify(body)
        }
    }

    const url = buildUrl(path)

    let res: Response
    try {
        res = await fetch(url, {
            method,
            headers: finalHeaders,
            body: finalBody,
            signal,
            credentials: "include",
        })
    } catch (err: any) {
        throw new ApiError(
            `Cannot reach API server at ${url}. Check your API base URL and make sure the backend is running.`,
            0,
            err
        )
    }

    const data = await parseResponseSafe(res)

    if (!res.ok) {
        const message =
            (data as any)?.message ||
            getHeader(finalHeaders, "X-Error-Message") ||
            res.statusText ||
            "Request failed"

        throw new ApiError(message, res.status, data)
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
