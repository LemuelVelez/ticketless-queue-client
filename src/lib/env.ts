function normalizeBaseUrl(url: string) {
    return url.replace(/\/+$/, "")
}

export function getServerPublicUrl() {
    const raw = import.meta.env.VITE_SERVER_PUBLIC_URL as string | undefined
    if (!raw) {
        throw new Error("VITE_SERVER_PUBLIC_URL is missing. Add it to your frontend .env file.")
    }
    return normalizeBaseUrl(raw)
}

export function getApiBaseUrl() {
    return `${getServerPublicUrl()}/api`
}
