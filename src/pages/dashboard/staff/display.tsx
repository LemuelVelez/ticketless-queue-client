/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import {
    Monitor,
    RefreshCw,
    Maximize2,
    Minimize2,
    Copy,
    ExternalLink,
    Download,
    QrCode as QrCodeIcon,
} from "lucide-react"
import QRCode from "react-qr-code"

import { DashboardLayout } from "@/components/dashboard-layout"
import { STAFF_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { useSession } from "@/hooks/use-session"
import { staffApi, type StaffDisplaySnapshotResponse } from "@/api/staff"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

type DisplayNowServing = StaffDisplaySnapshotResponse["nowServing"]
type DisplayUpNextRow = StaffDisplaySnapshotResponse["upNext"][number]

function parseBool(v: unknown): boolean {
    if (typeof v === "boolean") return v
    if (typeof v !== "string") return false
    const s = v.trim().toLowerCase()
    return s === "1" || s === "true" || s === "yes" || s === "y" || s === "on"
}

function fmtTime(v?: string | null) {
    if (!v) return "—"
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString()
}

function stripTrailingSlash(s: string) {
    return s.endsWith("/") ? s.slice(0, -1) : s
}

function joinUrl(base: string, path: string) {
    const b = stripTrailingSlash(base || "")
    const p = path.startsWith("/") ? path : `/${path}`
    return b ? `${b}${p}` : p
}

function getClientPublicUrl() {
    // Base URL for QR/redirect links (prefer env, fallback to current origin)
    const envBase = String((import.meta as any)?.env?.VITE_CLIENT_PUBLIC_URL ?? "").trim()
    if (envBase) return stripTrailingSlash(envBase)

    if (typeof window !== "undefined") return stripTrailingSlash(window.location.origin)
    return ""
}

async function copyToClipboard(text: string) {
    try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
            return true
        }
    } catch {
        // ignore
    }
    // fallback
    try {
        window.prompt("Copy this link:", text)
        return true
    } catch {
        return false
    }
}

function safeFilePart(v: string) {
    return String(v || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60)
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
}

/**
 * Downloads the QR SVG as a PNG with a proper white "quiet zone" (padding)
 * around it (top/bottom/left/right).
 */
async function downloadSvgAsPng(svgEl: SVGSVGElement, filename: string, scale = 4) {
    const serializer = new XMLSerializer()
    const svgString = serializer.serializeToString(svgEl)

    // Ensure SVG has xmlns for proper serialization in some browsers
    const hasXmlns = svgString.includes('xmlns="http://www.w3.org/2000/svg"')
    const fixedSvg = hasXmlns ? svgString : svgString.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')

    const svgBlob = new Blob([fixedSvg], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(svgBlob)

    const img = new Image()

    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("Failed to render QR image."))
        img.src = url
    })

    // Use rendered size
    const rect = svgEl.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width))
    const h = Math.max(1, Math.round(rect.height))

    // ✅ Add proper spacing (quiet zone) around QR when downloading
    // - 12% of the QR size (min 24px, max 80px) feels good for scanning + print
    const padding = clamp(Math.round(Math.min(w, h) * 0.12), 24, 80)

    const canvas = document.createElement("canvas")
    canvas.width = (w + padding * 2) * scale
    canvas.height = (h + padding * 2) * scale

    const ctx = canvas.getContext("2d")
    if (!ctx) {
        URL.revokeObjectURL(url)
        throw new Error("Canvas is not supported in this browser.")
    }

    // White background for PNG
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Keep edges crisp (QR codes look better without smoothing)
    ctx.imageSmoothingEnabled = false

    // Draw QR centered with padding
    const dx = padding * scale
    const dy = padding * scale
    ctx.drawImage(img, dx, dy, w * scale, h * scale)

    URL.revokeObjectURL(url)

    const pngUrl = canvas.toDataURL("image/png")
    const a = document.createElement("a")
    a.href = pngUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
}

export default function StaffDisplayPage() {
    const location = useLocation()
    const { user: sessionUser } = useSession()

    const dashboardUser: DashboardUser | undefined = React.useMemo(() => {
        if (!sessionUser) return undefined
        return {
            name: sessionUser.name ?? "Staff",
            email: sessionUser.email ?? "",
            avatarUrl: (sessionUser as any)?.avatarUrl ?? undefined,
        }
    }, [sessionUser])

    const [loading, setLoading] = React.useState(true)
    const [busy, setBusy] = React.useState(false)

    const [departmentId, setDepartmentId] = React.useState<string | null>(null)
    const [departmentName, setDepartmentName] = React.useState<string>("—")

    const [nowServing, setNowServing] = React.useState<DisplayNowServing>(null)
    const [upNext, setUpNext] = React.useState<DisplayUpNextRow[]>([])

    const [autoRefresh, setAutoRefresh] = React.useState(true)
    const [refreshEveryMs, setRefreshEveryMs] = React.useState(5000)

    // ✅ Presentation mode
    const [presentation, setPresentation] = React.useState(false)
    const [kioskMode, setKioskMode] = React.useState(false)
    const [slideMode, setSlideMode] = React.useState<"split" | "deck">("split")
    const [slideSeconds, setSlideSeconds] = React.useState(10)
    const [slideIndex, setSlideIndex] = React.useState(0)

    const presentationRequestedRef = React.useRef(false)
    const autoPresentDoneRef = React.useRef(false)

    const assignedOk = Boolean(departmentId)

    const clientPublicBase = React.useMemo(() => getClientPublicUrl(), [])

    // URLs (QR targets)
    const staffDisplayUrl = React.useMemo(() => joinUrl(clientPublicBase, "/staff/display"), [clientPublicBase])

    const publicDisplayUrl = React.useMemo(() => {
        if (!departmentId) return ""
        // Common pattern: /display?departmentId=...
        return joinUrl(clientPublicBase, `/display?departmentId=${encodeURIComponent(departmentId)}`)
    }, [clientPublicBase, departmentId])

    // ✅ QR Generator state
    const [qrTarget, setQrTarget] = React.useState<"public" | "staff">("public")
    const [downloadingQr, setDownloadingQr] = React.useState(false)
    const qrWrapRef = React.useRef<HTMLDivElement | null>(null)

    const qrValue = React.useMemo(() => {
        return qrTarget === "staff" ? staffDisplayUrl : publicDisplayUrl
    }, [qrTarget, staffDisplayUrl, publicDisplayUrl])

    const refresh = React.useCallback(async () => {
        try {
            const snap = await staffApi.getDisplaySnapshot()

            setDepartmentId(snap.department?.id ?? null)
            setDepartmentName(snap.department?.name ?? "—")
            setNowServing(snap.nowServing ?? null)
            setUpNext(Array.isArray(snap.upNext) ? snap.upNext : [])

            const refreshMs = clamp(Number(snap.meta?.refreshMs ?? 5000), 2000, 60000)
            setRefreshEveryMs(refreshMs)
        } catch (e: any) {
            const status = Number(e?.status || 0)
            if (status === 400) {
                // staff not assigned -> render empty/assigned message without toast spam
                setDepartmentId(null)
                setDepartmentName("—")
                setNowServing(null)
                setUpNext([])
                return
            }
            toast.error(e?.message ?? "Failed to load display snapshot.")
        }
    }, [])

    async function enterPresentation() {
        setPresentation(true)
        try {
            presentationRequestedRef.current = true
            await document.documentElement.requestFullscreen()
        } catch {
            presentationRequestedRef.current = false
        }
    }

    async function exitPresentation() {
        setPresentation(false)
        try {
            if (document.fullscreenElement) await document.exitFullscreen()
        } catch {
            // ignore
        } finally {
            presentationRequestedRef.current = false
        }
    }

    React.useEffect(() => {
        ; (async () => {
            setLoading(true)
            try {
                await refresh()
            } finally {
                setLoading(false)
            }
        })()
    }, [refresh])

    // query-mode parser (kiosk/deck/slideSec)
    React.useEffect(() => {
        const qs = new URLSearchParams(location.search || "")
        setKioskMode(parseBool(qs.get("kiosk")))
        setSlideMode(parseBool(qs.get("deck")) ? "deck" : "split")

        const sec = Number(qs.get("slideSec"))
        if (Number.isFinite(sec) && sec > 0) {
            setSlideSeconds(clamp(Math.floor(sec), 5, 30))
        }
    }, [location.search])

    // ✅ Auto-enter Presentation Mode when opening /staff/display?present=1
    React.useEffect(() => {
        if (autoPresentDoneRef.current) return
        const qs = new URLSearchParams(location.search || "")
        const shouldPresent = parseBool(qs.get("present"))
        if (!shouldPresent) return

        autoPresentDoneRef.current = true
        void enterPresentation()
    }, [location.search])

    React.useEffect(() => {
        if (!autoRefresh) return
        const intervalMs = clamp(refreshEveryMs, 2000, 60000)
        const t = window.setInterval(() => void refresh(), intervalMs)
        return () => window.clearInterval(t)
    }, [autoRefresh, refresh, refreshEveryMs])

    React.useEffect(() => {
        setSlideIndex(0)
    }, [slideMode])

    React.useEffect(() => {
        if (!(presentation && slideMode === "deck")) return
        const ms = clamp(slideSeconds, 5, 30) * 1000
        const t = window.setInterval(() => setSlideIndex((v) => v + 1), ms)
        return () => window.clearInterval(t)
    }, [presentation, slideMode, slideSeconds])

    // Keep presentation state in sync if user presses ESC to exit fullscreen
    React.useEffect(() => {
        const onFsChange = () => {
            const isFs = typeof document !== "undefined" && !!document.fullscreenElement
            if (presentation && presentationRequestedRef.current && !isFs) {
                presentationRequestedRef.current = false
                setPresentation(false)
            }
        }
        document.addEventListener("fullscreenchange", onFsChange)
        return () => document.removeEventListener("fullscreenchange", onFsChange)
    }, [presentation])

    async function onManualRefresh() {
        setBusy(true)
        try {
            await refresh()
        } finally {
            setBusy(false)
        }
    }

    async function onCopy(url: string) {
        if (!url) return
        const ok = await copyToClipboard(url)
        if (ok) toast.success("Link copied.")
        else toast.error("Failed to copy link.")
    }

    function onOpen(url: string) {
        if (!url) return
        window.open(url, "_blank", "noopener,noreferrer")
    }

    async function onOpenProjectorWindow() {
        if (typeof window === "undefined") return

        const qs = new URLSearchParams()
        qs.set("present", "1")
        qs.set("deck", "1")
        qs.set("kiosk", "1")
        qs.set("slideSec", String(clamp(slideSeconds, 5, 30)))

        const url = `${window.location.origin}${location.pathname}?${qs.toString()}`
        const popup = window.open(
            url,
            "staff-display-projector",
            "popup=yes,width=1920,height=1080,noopener,noreferrer"
        )

        if (!popup) {
            toast.error("Popup blocked. Please allow popups, then try again.")
            return
        }

        popup.focus()
        toast.success("Projector window opened. Move it to your extended display if needed.")

        // Optional: place popup on a secondary screen when browser supports Screen Details API
        try {
            const winAny = window as any
            if (typeof winAny.getScreenDetails === "function") {
                const details = await winAny.getScreenDetails()
                const screens = Array.isArray(details?.screens) ? details.screens : []
                const current = details?.currentScreen
                const secondary = screens.find((s: any) => s !== current) || null

                if (secondary && typeof popup.moveTo === "function" && typeof popup.resizeTo === "function") {
                    const left = Number(secondary.availLeft ?? secondary.left ?? 0)
                    const top = Number(secondary.availTop ?? secondary.top ?? 0)
                    const width = Number(secondary.availWidth ?? secondary.width ?? 1920)
                    const height = Number(secondary.availHeight ?? secondary.height ?? 1080)
                    popup.moveTo(left, top)
                    popup.resizeTo(width, height)
                }
            }
        } catch {
            // ignore (feature not available / permission denied)
        }
    }

    async function onDownloadQrPng() {
        if (!qrValue) {
            toast.error("No QR link available.")
            return
        }

        const svg = qrWrapRef.current?.querySelector("svg") as SVGSVGElement | null
        if (!svg) {
            toast.error("QR code is not ready.")
            return
        }

        setDownloadingQr(true)
        try {
            const label =
                qrTarget === "staff"
                    ? "staff-display"
                    : `public-display-${safeFilePart(departmentName) || safeFilePart(departmentId ?? "department")}`

            const filename = `${label}.png`
            await downloadSvgAsPng(svg, filename, 5)
            toast.success("QR code downloaded.")
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to download QR code.")
        } finally {
            setDownloadingQr(false)
        }
    }

    // ✅ Presentation overlay
    if (presentation) {
        const bigNumberClass = "text-7xl sm:text-8xl md:text-9xl font-semibold tracking-tight leading-none"
        const deckViews: Array<"now" | "upnext" | "summary"> = ["now", "upnext", "summary"]
        const deckView = deckViews[slideIndex % deckViews.length]

        const renderSplitView = () => (
            <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
                {/* Now serving */}
                <div className="flex min-h-0 flex-1 flex-col rounded-2xl border bg-muted p-6">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">NOW SERVING</div>
                        {nowServing ? <Badge>CALLED</Badge> : <Badge variant="secondary">—</Badge>}
                    </div>

                    <div className="mt-4 flex flex-1 flex-col justify-center">
                        {nowServing ? (
                            <>
                                <div className={bigNumberClass}>#{nowServing.queueNumber}</div>
                                <div className="mt-4 text-lg text-muted-foreground">
                                    Window: {nowServing.windowNumber ? `#${nowServing.windowNumber}` : "—"}
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">Called at: {fmtTime(nowServing.calledAt)}</div>
                            </>
                        ) : (
                            <div className="text-center text-lg text-muted-foreground">No ticket is currently being called.</div>
                        )}
                    </div>
                </div>

                {/* Up next */}
                <div className="w-full max-w-none rounded-2xl border p-6 lg:w-105">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">UP NEXT</div>
                        <Badge variant="secondary">{upNext.length}</Badge>
                    </div>

                    <div className="mt-4 grid gap-3">
                        {upNext.length === 0 ? (
                            <div className="rounded-lg border p-4 text-sm text-muted-foreground">No waiting tickets.</div>
                        ) : (
                            upNext.map((t) => (
                                <div key={t.id} className="flex items-center justify-between rounded-xl border p-4">
                                    <div className="text-3xl font-semibold">#{t.queueNumber}</div>
                                    <div className="text-right text-xs text-muted-foreground">Up next</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )

        const renderDeckView = () => {
            if (deckView === "now") {
                return (
                    <div className="flex min-h-0 flex-1 flex-col rounded-3xl border bg-muted p-8 lg:p-12">
                        <div className="text-center text-sm tracking-[0.25em] text-muted-foreground">NOW SERVING</div>
                        <div className="mt-8 flex flex-1 flex-col items-center justify-center text-center">
                            {nowServing ? (
                                <>
                                    <div className="text-[clamp(5rem,16vw,14rem)] font-semibold leading-none">#{nowServing.queueNumber}</div>
                                    <div className="mt-6 text-2xl text-muted-foreground">
                                        Window {nowServing.windowNumber ? `#${nowServing.windowNumber}` : "—"}
                                    </div>
                                    <div className="mt-2 text-base text-muted-foreground">Called at: {fmtTime(nowServing.calledAt)}</div>
                                </>
                            ) : (
                                <div className="text-3xl text-muted-foreground">No ticket is currently being called.</div>
                            )}
                        </div>
                    </div>
                )
            }

            if (deckView === "upnext") {
                return (
                    <div className="flex min-h-0 flex-1 flex-col rounded-3xl border p-8 lg:p-12">
                        <div className="text-center text-sm tracking-[0.25em] text-muted-foreground">UP NEXT</div>
                        <div className="mt-8 grid flex-1 content-start gap-4">
                            {upNext.length === 0 ? (
                                <div className="rounded-xl border p-8 text-center text-2xl text-muted-foreground">No waiting tickets.</div>
                            ) : (
                                upNext.slice(0, 6).map((t, idx) => (
                                    <div key={t.id} className="flex items-center justify-between rounded-2xl border p-6">
                                        <div className="text-5xl font-semibold">#{t.queueNumber}</div>
                                        <Badge variant={idx === 0 ? "default" : "secondary"}>
                                            {idx === 0 ? "Next to call" : "Waiting"}
                                        </Badge>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )
            }

            return (
                <div className="flex min-h-0 flex-1 flex-col rounded-3xl border p-8 lg:p-12">
                    <div className="text-center text-sm tracking-[0.25em] text-muted-foreground">QUEUE SUMMARY</div>
                    <div className="mt-8 grid flex-1 gap-6 lg:grid-cols-2">
                        <div className="rounded-2xl border bg-muted p-8">
                            <div className="text-sm text-muted-foreground">Now Serving</div>
                            <div className="mt-3 text-7xl font-semibold">
                                {nowServing ? `#${nowServing.queueNumber}` : "—"}
                            </div>
                            <div className="mt-4 text-lg text-muted-foreground">
                                Window: {nowServing?.windowNumber ? `#${nowServing.windowNumber}` : "—"}
                            </div>
                        </div>
                        <div className="rounded-2xl border p-8">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">Up Next</div>
                                <Badge variant="secondary">{upNext.length}</Badge>
                            </div>
                            <div className="mt-4 grid gap-3">
                                {upNext.length === 0 ? (
                                    <div className="text-lg text-muted-foreground">No waiting tickets.</div>
                                ) : (
                                    upNext.slice(0, 5).map((t) => (
                                        <div key={t.id} className="text-3xl font-semibold">
                                            #{t.queueNumber}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )
        }

        return (
            <div className="fixed inset-0 z-50 bg-background">
                <div className="flex h-full w-full flex-col">
                    {!kioskMode ? (
                        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">Department: {departmentName}</Badge>
                                    <Badge variant="secondary">Dept ID: {departmentId ?? "—"}</Badge>
                                    {!assignedOk ? <Badge variant="destructive">Not assigned</Badge> : null}
                                </div>
                                <div className="mt-2 text-sm text-muted-foreground">
                                    Auto refresh: {autoRefresh ? "On" : "Off"} • Updates every {Math.round(refreshEveryMs / 1000)}s
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <Button
                                    variant={slideMode === "split" ? "default" : "outline"}
                                    onClick={() => setSlideMode("split")}
                                    className="gap-2"
                                >
                                    Split View
                                </Button>

                                <Button
                                    variant={slideMode === "deck" ? "default" : "outline"}
                                    onClick={() => setSlideMode("deck")}
                                    className="gap-2"
                                >
                                    Slide Deck
                                </Button>

                                <div className="flex items-center gap-2">
                                    <Switch
                                        id="autoRefreshPm"
                                        checked={autoRefresh}
                                        onCheckedChange={(v) => setAutoRefresh(Boolean(v))}
                                        disabled={busy}
                                    />
                                    <Label htmlFor="autoRefreshPm" className="text-sm">
                                        Auto refresh
                                    </Label>
                                </div>

                                <Button variant="outline" onClick={() => void onManualRefresh()} disabled={busy} className="gap-2">
                                    <RefreshCw className="h-4 w-4" />
                                    Refresh
                                </Button>

                                <Button variant="secondary" onClick={() => void exitPresentation()} className="gap-2">
                                    <Minimize2 className="h-4 w-4" />
                                    Exit
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="pointer-events-none absolute right-4 top-4 z-10">
                            <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="pointer-events-auto gap-2"
                                onClick={() => void exitPresentation()}
                            >
                                <Minimize2 className="h-4 w-4" />
                                Exit
                            </Button>
                        </div>
                    )}

                    <div className={`flex min-h-0 flex-1 flex-col gap-6 p-4 lg:p-8 ${slideMode === "deck" ? "transition-all duration-500" : ""}`}>
                        {slideMode === "deck" ? renderDeckView() : renderSplitView()}

                        {slideMode === "deck" ? (
                            <div className="text-center text-sm text-muted-foreground">
                                Slide {((slideIndex % 3) + 1)} / 3 • changes every {slideSeconds}s
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        )
    }

    // ✅ Normal dashboard layout
    return (
        <DashboardLayout title="Display" navItems={STAFF_NAV_ITEMS} user={dashboardUser} activePath={location.pathname}>
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                <Card className="min-w-0">
                    <CardHeader className="gap-2">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <CardTitle className="flex items-center gap-2">
                                    <Monitor className="h-5 w-5" />
                                    Staff Display
                                </CardTitle>
                                <CardDescription>
                                    PPT-style presentation mode for projector/TV plus backend-integrated live snapshot.
                                </CardDescription>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <Button
                                    variant="outline"
                                    onClick={() => void onManualRefresh()}
                                    disabled={loading || busy}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Refresh
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={() => void onOpenProjectorWindow()}
                                    disabled={busy}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    Open on 2nd Screen
                                </Button>

                                <Button
                                    variant="secondary"
                                    onClick={() => void enterPresentation()}
                                    disabled={busy}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <Maximize2 className="h-4 w-4" />
                                    Presentation
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="secondary">Department: {departmentName}</Badge>
                                <Badge variant="secondary">Dept ID: {departmentId ?? "—"}</Badge>
                                {!assignedOk ? <Badge variant="destructive">Not assigned</Badge> : null}
                                <Badge variant="outline">Refresh: {Math.round(refreshEveryMs / 1000)}s</Badge>
                            </div>

                            <div className="flex items-center gap-2">
                                <Switch
                                    id="autoRefresh"
                                    checked={autoRefresh}
                                    onCheckedChange={(v) => setAutoRefresh(Boolean(v))}
                                    disabled={busy}
                                />
                                <Label htmlFor="autoRefresh" className="text-sm">
                                    Auto refresh
                                </Label>
                            </div>
                        </div>

                        <div className="text-xs text-muted-foreground">
                            Tip: Connect your secondary monitor (HDMI/USB/VGA) in <strong>Extend</strong> mode, then click{" "}
                            <strong>Open on 2nd Screen</strong>. If browser permissions allow, it will try to place the window on the other monitor.
                        </div>
                    </CardHeader>

                    <CardContent className="min-w-0">
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-48 w-full" />
                                <Skeleton className="h-40 w-full" />
                            </div>
                        ) : !assignedOk ? (
                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                You are not assigned to a department. Please ask an admin to assign your department.
                            </div>
                        ) : (
                            <div className="grid gap-6 lg:grid-cols-12">
                                {/* QR Generator */}
                                <Card className="lg:col-span-12">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <QrCodeIcon className="h-5 w-5" />
                                            QR Code
                                        </CardTitle>
                                        <CardDescription>Generate a QR code and download it as PNG (with proper spacing).</CardDescription>
                                    </CardHeader>

                                    <CardContent className="space-y-4">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex flex-col gap-2 sm:flex-row">
                                                <Button
                                                    type="button"
                                                    variant={qrTarget === "public" ? "default" : "outline"}
                                                    onClick={() => setQrTarget("public")}
                                                    className="w-full sm:w-auto"
                                                >
                                                    Public Display
                                                </Button>

                                                <Button
                                                    type="button"
                                                    variant={qrTarget === "staff" ? "default" : "outline"}
                                                    onClick={() => setQrTarget("staff")}
                                                    className="w-full sm:w-auto"
                                                >
                                                    Staff Display
                                                </Button>
                                            </div>

                                            <div className="flex flex-col gap-2 sm:flex-row">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="w-full gap-2 sm:w-auto"
                                                    disabled={!qrValue}
                                                    onClick={() => void onCopy(qrValue)}
                                                >
                                                    <Copy className="h-4 w-4" />
                                                    Copy link
                                                </Button>

                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    className="w-full gap-2 sm:w-auto"
                                                    disabled={!qrValue}
                                                    onClick={() => onOpen(qrValue)}
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                    Open
                                                </Button>

                                                <Button
                                                    type="button"
                                                    className="w-full gap-2 sm:w-auto"
                                                    disabled={!qrValue || downloadingQr}
                                                    onClick={() => void onDownloadQrPng()}
                                                >
                                                    <Download className="h-4 w-4" />
                                                    {downloadingQr ? "Downloading…" : "Download PNG"}
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="rounded-lg border p-4">
                                            <div className="grid gap-4 lg:grid-cols-12">
                                                <div className="lg:col-span-4">
                                                    <div className="text-sm font-medium">
                                                        Target: {qrTarget === "public" ? "Public Display" : "Staff Display"}
                                                    </div>
                                                    <div className="mt-1 break-all text-xs text-muted-foreground">{qrValue || "—"}</div>
                                                    {qrTarget === "staff" ? (
                                                        <div className="mt-2 text-xs text-muted-foreground">Note: Staff display may require login.</div>
                                                    ) : null}
                                                </div>

                                                <div className="lg:col-span-8">
                                                    <div className="flex items-center justify-center">
                                                        <div
                                                            ref={qrWrapRef}
                                                            className="rounded-xl border bg-white p-4"
                                                            style={{ width: "fit-content" }}
                                                        >
                                                            {qrValue ? (
                                                                <QRCode value={qrValue} size={220} bgColor="#FFFFFF" fgColor="#000000" />
                                                            ) : (
                                                                <div className="flex h-55 w-55 items-center justify-center text-sm text-muted-foreground">
                                                                    No link available
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Now serving */}
                                <Card className="lg:col-span-7">
                                    <CardHeader>
                                        <CardTitle>Now serving</CardTitle>
                                        <CardDescription>Latest called ticket for your department.</CardDescription>
                                    </CardHeader>

                                    <CardContent>
                                        {nowServing ? (
                                            <div className="rounded-2xl border bg-muted p-6">
                                                <div className="text-sm text-muted-foreground">NOW SERVING</div>
                                                <div className="mt-1 text-6xl font-semibold tracking-tight">#{nowServing.queueNumber}</div>
                                                <div className="mt-2 text-sm text-muted-foreground">
                                                    Window: {nowServing.windowNumber ? `#${nowServing.windowNumber}` : "—"}
                                                </div>
                                                <div className="text-sm text-muted-foreground">Called at: {fmtTime(nowServing.calledAt)}</div>
                                            </div>
                                        ) : (
                                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                                No ticket is currently being called.
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Up next */}
                                <Card className="lg:col-span-5">
                                    <CardHeader>
                                        <CardTitle>Up next</CardTitle>
                                        <CardDescription>Next waiting tickets (oldest first).</CardDescription>
                                    </CardHeader>

                                    <CardContent>
                                        {upNext.length === 0 ? (
                                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">No waiting tickets.</div>
                                        ) : (
                                            <div className="grid gap-3">
                                                {upNext.map((t) => (
                                                    <div key={t.id} className="flex items-center justify-between rounded-xl border p-4">
                                                        <div className="text-2xl font-semibold">#{t.queueNumber}</div>
                                                        <Badge variant="secondary">Waiting</Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
