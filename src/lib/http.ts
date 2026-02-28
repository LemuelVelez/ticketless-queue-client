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

/**
 * ✅ Public-display friendly participant name picker (frontend mirror of displayController behavior).
 * Tries in order:
 * - ticket.participantFullName / ticket.participantLabel
 * - ticket.participant.fullName / ticket.participant.name
 * - common fallbacks: fullName/displayName/name
 * - participantDisplay ("Full Name • StudentId • Mobile") -> take first segment
 */
export function pickParticipantFullName(anyObj?: any): string | undefined {
    if (!anyObj) return undefined

    const directCandidates = [
        anyObj.participantFullName,
        anyObj.participantLabel,
        anyObj?.participant?.fullName,
        anyObj?.participant?.name,
        anyObj.fullName,
        anyObj.displayName,
        anyObj.name,
    ]
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)

    if (directCandidates.length) return directCandidates[0]

    const composed = [anyObj.firstName, anyObj.middleName, anyObj.lastName]
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
        .join(" ")
        .trim()
    if (composed) return composed

    const display = String(anyObj.participantDisplay ?? "").trim()
    if (display) return display.split("•")[0]?.trim() || display

    return undefined
}

/**
 * ✅ Transaction-purpose picker (frontend mirror of staffController/queueManagement behavior).
 * Tries in order:
 * - transactionPurpose / purpose / queuePurpose
 * - transaction.purpose
 * - transactions.purpose / transactions.transactionPurpose
 * - meta.purpose / meta.transactionPurpose
 * - fallback to readable labels (transactionLabel / transactionLabels[])
 */
export function pickTransactionPurpose(anyObj?: any): string | undefined {
    if (!anyObj) return undefined

    const joinLabels = (v: any): string => {
        if (!Array.isArray(v)) return ""
        const clean = v
            .map((x) => String(x ?? "").trim())
            .filter(Boolean)
        if (!clean.length) return ""
        // unique (stable)
        const seen = new Set<string>()
        const uniq: string[] = []
        for (const s of clean) {
            if (seen.has(s)) continue
            seen.add(s)
            uniq.push(s)
        }
        return uniq.join(" • ")
    }

    const str = (v: any) => String(v ?? "").trim()

    // 1) Purpose-first candidates
    const purposeCandidates = [
        anyObj.transactionPurpose,
        anyObj.purpose,
        anyObj.queuePurpose,
        anyObj?.transaction?.purpose,
        anyObj?.transactions?.purpose,
        anyObj?.transactions?.transactionPurpose,
        anyObj?.meta?.purpose,
        anyObj?.meta?.transactionPurpose,
    ]
        .map(str)
        .filter(Boolean)

    if (purposeCandidates.length) return purposeCandidates[0]

    // 2) Label arrays (readable)
    const labelArrayCandidates = [
        anyObj.transactionLabels,
        anyObj.selectedTransactionLabels,
        anyObj?.transactions?.transactionLabels,
        anyObj?.transactions?.labels,
        anyObj?.meta?.transactionLabels,
    ]

    for (const c of labelArrayCandidates) {
        const joined = joinLabels(c)
        if (joined) return joined
    }

    // 3) Single label fallbacks
    const labelCandidates = [
        anyObj.transactionLabel,
        anyObj?.transaction?.label,
        anyObj?.transactions?.transactionLabel,
        anyObj?.meta?.transactionLabel,
    ]
        .map(str)
        .filter(Boolean)

    if (labelCandidates.length) return labelCandidates[0]

    return undefined
}

/**
 * ✅ Supports:
 * - Plain payload: T
 * - Wrapped payload: { data: T }
 * - Wrapped payload with extra fields: { data: T, context: ..., meta: ..., ok: ... }
 */
export type ApiData<T> = T | ({ data: T } & Record<string, unknown>)

/**
 * ✅ Smart unwrap:
 * - If response is exactly `{ data: T }`, returns `T`
 * - If response is `{ data: T, ...extras }`, merges into one object:
 *   `{ ...extras, ...data }` (keeps context/meta while still unwrapping)
 */
export function unwrapApiData<T>(value: ApiData<T>): T {
    if (value && typeof value === "object" && "data" in (value as Record<string, unknown>)) {
        const wrapper = value as { data: unknown } & Record<string, unknown>
        const data = wrapper.data

        const { data: _data, ...rest } = wrapper
        const hasExtras = Object.keys(rest).length > 0

        // Plain wrapper: { data: T }
        if (!hasExtras) return data as T

        // Wrapper with extras: { data: T, context/meta/... }
        // If `data` is an object, merge extras + data (do not lose context/meta).
        if (data && typeof data === "object" && !Array.isArray(data)) {
            return { ...rest, ...(data as Record<string, unknown>) } as T
        }

        // If data is primitive/array, return it (extras are not mergeable)
        return data as T
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
    /**
     * ✅ If false, do not throw ApiError on non-2xx responses.
     * This is useful for endpoints that intentionally return structured JSON bodies
     * with non-2xx status codes (e.g., `{ ok:false, reason:... }`) and you want
     * the caller to handle it without try/catch.
     */
    throwOnError?: boolean
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

function isAbsoluteUrl(input: string) {
    const s = String(input ?? "").trim()
    return /^https?:\/\//i.test(s) || s.startsWith("//")
}

function buildUrl(path: string) {
    const raw = String(path ?? "").trim()
    if (!raw) return ""

    // ✅ Allow passing a fully-qualified URL (useful for presigned/absolute endpoints).
    if (isAbsoluteUrl(raw)) {
        // Normalize protocol-relative urls (//host/path) into https? based on current protocol.
        return raw.startsWith("//") ? normalizeApiBaseUrl(raw) : raw
    }

    const base = normalizeApiBaseUrl(getApiBaseUrl())
    const cleanPath = raw.startsWith("/") ? raw : `/${raw}`
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

function hasSessionTokenHeader(headers: Record<string, string>) {
    return hasHeader(headers, "X-Session-Token") || hasHeader(headers, "X-SessionToken")
}

function getSessionTokenHeaderValue(headers: Record<string, string>) {
    return getHeaderValue(headers, "X-Session-Token") || getHeaderValue(headers, "X-SessionToken")
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
    if (hasSessionTokenHeader(headers)) return

    const auth = getHeaderValue(headers, "Authorization")
    if (!auth) return
    const s = String(auth).trim()
    if (!s.toLowerCase().startsWith("bearer ")) return

    const token = s.slice(7).trim()
    if (!token) return

    // ✅ set both variants for maximum backend/proxy compatibility
    headers["X-Session-Token"] = token
    headers["X-SessionToken"] = token
}

function ensureAuthorizationFromSessionToken(headers: Record<string, string>) {
    // ✅ Some backends only read Authorization; if caller/proxy prefers X-Session-Token,
    // mirror it back into Authorization (but never override an explicit Authorization).
    if (hasHeader(headers, "Authorization")) return

    const session = getSessionTokenHeaderValue(headers)
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

    const textRaw = await res.text()
    if (!textRaw) return null

    // ✅ Some proxies/server runtimes can prepend a UTF-8 BOM; strip it to avoid JSON.parse failures.
    const text = textRaw.replace(/^\uFEFF/, "")

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

function formatServerReason(reason: unknown): string {
    const s = String(reason ?? "").trim()
    if (!s) return ""
    return s.replace(/[_-]+/g, " ").trim()
}

/** =========================
 * SEMAPHORE RECEIPT VALIDATION (shared)
 * ========================= */

export type SemaphoreReceiptItem = {
    status?: string
    message_id?: number | string
    recipient?: string
    [key: string]: unknown
}

export type SemaphoreReceiptValidation = {
    ok: boolean
    outcome: "sent" | "failed" | "unknown"
    statusSummary: Record<string, number>
    error?: string
    receiptsCount: number
}

function normalizeSemaphoreStatus(status: unknown): string {
    return String(status ?? "").trim().toLowerCase()
}

function summarizeSemaphoreStatuses(items: Array<{ status?: string }> = []) {
    const out: Record<string, number> = {}
    for (const it of items) {
        const key = normalizeSemaphoreStatus(it?.status) || "unknown"
        out[key] = (out[key] || 0) + 1
    }
    return out
}

/**
 * ✅ Prevent "false success" cases:
 * - Empty receipt array => not ok
 * - Any FAILED/REFUNDED => not ok
 * - At least one QUEUED/PENDING/SENT and no failures => ok
 */
export function validateSemaphoreReceipts(providerResponse: unknown): SemaphoreReceiptValidation {
    const receipts = Array.isArray(providerResponse) ? (providerResponse as SemaphoreReceiptItem[]) : []

    if (!receipts.length) {
        return {
            ok: false,
            outcome: "unknown",
            statusSummary: {},
            receiptsCount: 0,
            error: "Empty provider receipt (no message receipts returned by Semaphore).",
        }
    }

    const okStatuses = new Set(["queued", "pending", "sent"])
    const failStatuses = new Set(["failed", "refunded"])

    const summary = summarizeSemaphoreStatuses(receipts)

    let okCount = 0
    let failCount = 0

    for (const r of receipts) {
        const st = normalizeSemaphoreStatus(r?.status)
        if (okStatuses.has(st)) okCount++
        else if (failStatuses.has(st)) failCount++
    }

    const ok = okCount > 0 && failCount === 0
    const outcome: SemaphoreReceiptValidation["outcome"] = ok ? "sent" : failCount > 0 ? "failed" : "unknown"

    const error = ok
        ? undefined
        : failCount > 0
          ? `Semaphore receipt status indicates failure (${Object.entries(summary)
                .map(([k, v]) => `${k}:${v}`)
                .join(", ")})`
          : `Semaphore receipt status is not confirmable (${Object.entries(summary)
                .map(([k, v]) => `${k}:${v}`)
                .join(", ")})`

    return {
        ok,
        outcome,
        statusSummary: summary,
        receiptsCount: receipts.length,
        error,
    }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const {
        method = "GET",
        body,
        headers = {},
        auth = "auto",
        params,
        credentials,
        throwOnError = true,
        signal,
    } = options

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
        const msg = `Cannot reach API server at ${url}. Check your API base URL and make sure the backend is running.`

        // ✅ When caller explicitly opts out of throwing, return a safe JSON-ish payload
        // (prevents UI crashes on SMS endpoints that are designed to be "no throw".)
        if (throwOnError === false) {
            return ({
                ok: false,
                error: "network_error",
                reason: "network_error",
                message: msg,
                status: 0,
                method,
                url,
                path,
                detail: String(err?.message || err || ""),
            } as any) as T
        }

        throw new ApiError(msg, 0, err, { method, url, path })
    }

    const data = await parseResponseSafe(res)

    // ✅ If backend sets X-Error-Message but returns 200 with `{ ok:false }`,
    // carry it into the JSON payload so UI can render it without needing headers access.
    const headerErrorMsg = res.headers.get("x-error-message") || res.headers.get("X-Error-Message") || ""
    if (headerErrorMsg && data && typeof data === "object" && !Array.isArray(data)) {
        const d: any = data
        if ("ok" in d && d.ok === false) {
            if (!d.message && !d.error && !d.reason) d.message = headerErrorMsg
            if (!d.reason) d.reason = headerErrorMsg
        }
    }

    if (!res.ok) {
        // ✅ Allow structured error bodies to be handled by caller without try/catch
        if (throwOnError === false) return data as T

        const responseHeaderMsg = headerErrorMsg
        const reasonMsg = formatServerReason((data as any)?.reason)

        const serverMsg =
            (data as any)?.message ||
            (data as any)?.error ||
            (data as any)?.detail ||
            (data as any)?.title ||
            reasonMsg

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

    /**
     * ✅ Convenience methods:
     * Some backends respond with `{ data: ... }` (sometimes with extra fields like `{ context: ... }`).
     * These helpers unwrap smartly so we don't lose `context/meta` while keeping DX clean.
     */
    getData: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
        apiRequest<ApiData<T>>(path, { ...opts, method: "GET" }).then((res) => unwrapApiData<T>(res)),

    postData: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
        apiRequest<ApiData<T>>(path, { ...opts, method: "POST", body }).then((res) => unwrapApiData<T>(res)),

    putData: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
        apiRequest<ApiData<T>>(path, { ...opts, method: "PUT", body }).then((res) => unwrapApiData<T>(res)),

    patchData: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
        apiRequest<ApiData<T>>(path, { ...opts, method: "PATCH", body }).then((res) => unwrapApiData<T>(res)),

    deleteData: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
        apiRequest<ApiData<T>>(path, { ...opts, method: "DELETE" }).then((res) => unwrapApiData<T>(res)),
}