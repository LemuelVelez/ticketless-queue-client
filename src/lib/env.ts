function normalizeBaseUrl(url: string) {
    return url.replace(/\/+$/, "")
}

function readEnv(name: string) {
    const value = (import.meta.env as Record<string, unknown>)[name]
    return typeof value === "string" ? value.trim() : ""
}

export function getServerPublicUrl() {
    const raw = readEnv("VITE_SERVER_PUBLIC_URL")
    if (raw) return normalizeBaseUrl(raw)

    // Dev-friendly fallback in browser
    if (typeof window !== "undefined") {
        return normalizeBaseUrl(window.location.origin)
    }

    throw new Error("VITE_SERVER_PUBLIC_URL is missing. Add it to your frontend .env file.")
}

export function getApiBaseUrl() {
    // Highest priority: explicit API base URL
    const explicitApi = readEnv("VITE_API_BASE_URL")
    if (explicitApi) return normalizeBaseUrl(explicitApi)

    // Fallback: <server-public-url>/api
    return `${getServerPublicUrl()}/api`
}
