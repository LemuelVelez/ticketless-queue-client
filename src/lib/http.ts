/* eslint-disable @typescript-eslint/no-explicit-any */
import { getApiBaseUrl } from "@/lib/env"
import { getAuthToken } from "@/lib/auth"

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

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
    auth?: boolean
    signal?: AbortSignal
}

function buildUrl(path: string) {
    const base = getApiBaseUrl()
    const cleanPath = path.startsWith("/") ? path : `/${path}`
    return `${base}${cleanPath}`
}

async function parseJsonSafe(res: Response) {
    const text = await res.text()
    if (!text) return null
    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, headers = {}, auth = true, signal } = options

    const finalHeaders: Record<string, string> = {
        Accept: "application/json",
        ...headers,
    }

    const token = auth ? getAuthToken() : null
    if (token) finalHeaders.Authorization = `Bearer ${token}`

    let finalBody: BodyInit | undefined

    // Support FormData
    if (body instanceof FormData) {
        finalBody = body
    } else if (body !== undefined) {
        finalHeaders["Content-Type"] = finalHeaders["Content-Type"] || "application/json"
        finalBody = JSON.stringify(body)
    }

    const res = await fetch(buildUrl(path), {
        method,
        headers: finalHeaders,
        body: finalBody,
        signal,
        credentials: "include",
    })

    const data = await parseJsonSafe(res)

    if (!res.ok) {
        const message = (data as any)?.message || res.statusText || "Request failed"
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

    /**
     * Preferred DELETE method
     */
    delete: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
        apiRequest<T>(path, { ...opts, method: "DELETE" }),

    /**
     * Backwards-compatible alias
     */
    del: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
        apiRequest<T>(path, { ...opts, method: "DELETE" }),
}
