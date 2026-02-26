import * as React from "react"
import { toast } from "sonner"
import {
    Expand,
    RefreshCcw,
    Volume2,
    VolumeX,
    X,
} from "lucide-react"

import { landingApi, type Announcement, type PublicDisplayState, type TicketView } from "@/api/landing"
import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const STORAGE_MANAGER = "qp_public_display_manager"
const STORAGE_VOICE = "qp_public_display_voice"

function titleCase(input: string) {
    const s = String(input ?? "").trim()
    if (!s) return ""
    return s
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .split(" ")
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
        .join(" ")
}

function formatTime(iso?: string) {
    if (!iso) return ""
    const d = new Date(iso)
    if (String(d).includes("Invalid")) return ""
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function getTicketDisplayName(t?: TicketView) {
    if (!t) return "—"
    const n = String(t.participant?.name ?? "").trim()
    if (n) return n
    const sid = String(t.participant?.studentId ?? "").trim()
    return sid ? `ID ${sid}` : "—"
}

function supportsFullscreen() {
    const el = document.documentElement as any
    return Boolean(el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen)
}

async function requestFullscreen() {
    const el = document.documentElement as any
    const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen
    if (!fn) return false
    try {
        await fn.call(el)
        return true
    } catch {
        return false
    }
}

async function exitFullscreen() {
    const d = document as any
    const fn = d.exitFullscreen || d.webkitExitFullscreen || d.msExitFullscreen
    if (!fn) return
    try {
        await fn.call(d)
    } catch {
        // ignore
    }
}

function isFullscreenActive() {
    const d = document as any
    return Boolean(d.fullscreenElement || d.webkitFullscreenElement || d.msFullscreenElement)
}

type DisplayBoardProps = {
    manager: string
    managers: string[]
    onManagerChange: (v: string) => void
    loadingManagers: boolean

    state: PublicDisplayState | null
    loadingState: boolean
    onRefresh: () => void

    voiceEnabled: boolean
    onVoiceToggle: (v: boolean) => void

    variant: "embed" | "fullscreen"
    onOpenFullscreen: () => void
    onCloseFullscreen?: () => void
    fullscreenActive?: boolean
}

function DisplayBoard({
    manager,
    managers,
    onManagerChange,
    loadingManagers,
    state,
    loadingState,
    onRefresh,
    voiceEnabled,
    onVoiceToggle,
    variant,
    onOpenFullscreen,
    onCloseFullscreen,
    fullscreenActive,
}: DisplayBoardProps) {
    const managerLabel = titleCase(manager || "")

    return (
        <div className={cn("flex flex-col gap-4", variant === "fullscreen" && "h-full")}>
            <div className={cn("flex flex-col gap-3", variant === "fullscreen" && "px-4 pt-4 sm:px-6")}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className={cn("text-xl font-semibold tracking-tight", variant === "fullscreen" && "text-2xl")}>
                                Public Display
                            </h3>
                            <Badge variant="secondary" className="whitespace-nowrap">
                                Centralized view
                            </Badge>
                            {state?.dateKey ? (
                                <Badge variant="outline" className="whitespace-nowrap">
                                    {state.dateKey}
                                </Badge>
                            ) : null}
                        </div>

                        <p className="mt-1 text-sm text-muted-foreground">
                            Switch managers to view their active service windows, now serving, and up next.
                            <span className="hidden sm:inline"> Voice announcements can be enabled for live calls.</span>
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={onRefresh}>
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>

                        {variant === "embed" ? (
                            <Button size="sm" onClick={onOpenFullscreen}>
                                <Expand className="mr-2 h-4 w-4" />
                                Fullscreen
                            </Button>
                        ) : (
                            <Button variant="destructive" size="sm" onClick={onCloseFullscreen}>
                                <X className="h-4 w-4" />
                                Exit
                            </Button>
                        )}
                    </div>
                </div>

                <Card>
                    <CardHeader className={cn("pb-3", variant === "fullscreen" && "pb-4")}>
                        <CardTitle className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate">Manager</span>
                                {managerLabel ? (
                                    <Badge className="whitespace-nowrap">{managerLabel}</Badge>
                                ) : (
                                    <Badge variant="outline">Not selected</Badge>
                                )}
                            </span>

                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={voiceEnabled}
                                        onCheckedChange={onVoiceToggle}
                                        aria-label="Toggle voice announcements"
                                    />
                                    <span className="text-sm text-muted-foreground">
                                        {voiceEnabled ? (
                                            <span className="inline-flex items-center gap-1">
                                                <Volume2 className="h-4 w-4" />
                                                Voice on
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1">
                                                <VolumeX className="h-4 w-4" />
                                                Voice off
                                            </span>
                                        )}
                                    </span>
                                </div>

                                {variant === "fullscreen" ? (
                                    <Badge variant={fullscreenActive ? "default" : "outline"} className="whitespace-nowrap">
                                        {fullscreenActive ? "Browser fullscreen" : "Immersive mode"}
                                    </Badge>
                                ) : null}

                                {state?.serverTime ? (
                                    <Badge variant="outline" className="whitespace-nowrap">
                                        Updated {formatTime(state.serverTime)}
                                    </Badge>
                                ) : null}
                            </div>
                        </CardTitle>

                        <CardDescription className="mt-2">
                            <div className="flex flex-col gap-3">
                                <div className="grid gap-2 sm:hidden">
                                    <Select
                                        value={manager || ""}
                                        onValueChange={(v) => onManagerChange(v)}
                                        disabled={loadingManagers || !managers.length}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={loadingManagers ? "Loading managers..." : "Select manager"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {managers.map((m) => (
                                                <SelectItem key={m} value={m}>
                                                    {titleCase(m)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="hidden sm:block">
                                    <Tabs value={manager || ""} onValueChange={(v) => onManagerChange(v)}>
                                        <TabsList className="flex w-full flex-wrap justify-start">
                                            {loadingManagers ? (
                                                <>
                                                    <TabsTrigger value="__loading__" disabled>
                                                        Loading...
                                                    </TabsTrigger>
                                                </>
                                            ) : managers.length ? (
                                                managers.map((m) => (
                                                    <TabsTrigger key={m} value={m} className="whitespace-nowrap">
                                                        {titleCase(m)}
                                                    </TabsTrigger>
                                                ))
                                            ) : (
                                                <TabsTrigger value="__empty__" disabled>
                                                    No managers found
                                                </TabsTrigger>
                                            )}
                                        </TabsList>
                                    </Tabs>
                                </div>

                                {variant === "fullscreen" ? (
                                    <p className="text-xs text-muted-foreground">
                                        Mobile tip: landscape is recommended for the best viewing experience.
                                    </p>
                                ) : null}
                            </div>
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>

            <div className={cn("grid gap-4", variant === "fullscreen" && "min-h-0 px-4 pb-4 sm:px-6 sm:pb-6", "lg:grid-cols-3")}>
                <Card className={cn("lg:col-span-2", variant === "fullscreen" && "min-h-0")}>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between">
                            <span>Active service windows</span>
                            <Badge variant="secondary" className="whitespace-nowrap">
                                {state?.windows?.length ?? 0} windows
                            </Badge>
                        </CardTitle>
                        <CardDescription>
                            Each window shows what it is currently serving. This view is centralized (same across devices).
                        </CardDescription>
                    </CardHeader>

                    <CardContent className={cn("pt-0", variant === "fullscreen" && "min-h-0")}>
                        {loadingState && !state ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <Card key={i}>
                                        <CardHeader className="pb-3">
                                            <Skeleton className="h-5 w-40" />
                                            <Skeleton className="h-4 w-64" />
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <Skeleton className="h-10 w-32" />
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : state?.windows?.length ? (
                            <ScrollArea className={cn(variant === "fullscreen" ? "h-[60vh] sm:h-[64vh]" : "h-[48vh] sm:h-[50vh]")}>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {state.windows.map((w) => {
                                        const serving = w.nowServing
                                        const deptNames = w.departments?.map((d) => d.name).filter(Boolean) ?? []
                                        const participantName = getTicketDisplayName(serving)

                                        return (
                                            <Card key={w.id} className="overflow-hidden">
                                                <CardHeader className="pb-3">
                                                    <CardTitle className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="truncate font-semibold">
                                                                    {w.name || `Window ${w.number}`}
                                                                </span>
                                                                <Badge variant="outline" className="whitespace-nowrap">
                                                                    #{w.number}
                                                                </Badge>
                                                            </div>

                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                {deptNames.length ? deptNames.join(" • ") : "No departments assigned"}
                                                            </p>
                                                        </div>

                                                        <Badge variant={serving ? "default" : "secondary"} className="whitespace-nowrap">
                                                            {serving ? "Now serving" : "Idle"}
                                                        </Badge>
                                                    </CardTitle>
                                                </CardHeader>

                                                <CardContent className="pt-0">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-baseline gap-2">
                                                            <span className={cn("text-3xl font-bold tracking-tight", variant === "fullscreen" && "text-4xl")}>
                                                                {serving ? serving.queueNumber : "—"}
                                                            </span>
                                                            <span className="text-sm text-muted-foreground">Queue #</span>
                                                        </div>

                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-sm font-medium">{participantName}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {serving?.department?.name ? serving.department.name : "—"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )
                                    })}
                                </div>
                            </ScrollArea>
                        ) : (
                            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                                {manager ? "No active windows found for this manager." : "Select a manager to start."}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className={cn(variant === "fullscreen" && "min-h-0")}>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between">
                            <span>Up next</span>
                            <Badge variant="secondary" className="whitespace-nowrap">
                                {state?.upNext?.length ?? 0}
                            </Badge>
                        </CardTitle>
                        <CardDescription>
                            A user-friendly preview of the next tickets in line (names first).
                        </CardDescription>
                    </CardHeader>

                    <CardContent className={cn("pt-0", variant === "fullscreen" && "min-h-0")}>
                        {loadingState && !state ? (
                            <div className="grid gap-2">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                                        <Skeleton className="h-5 w-10" />
                                        <Skeleton className="h-4 w-40" />
                                    </div>
                                ))}
                            </div>
                        ) : state?.upNext?.length ? (
                            <ScrollArea className={cn(variant === "fullscreen" ? "h-[60vh] sm:h-[64vh]" : "h-[48vh] sm:h-[50vh]")}>
                                <div className="grid gap-2">
                                    {state.upNext.map((t) => (
                                        <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <Badge className="whitespace-nowrap">{t.queueNumber}</Badge>
                                                    <span className="truncate text-sm font-medium">
                                                        {getTicketDisplayName(t)}
                                                    </span>
                                                </div>
                                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                                    {t.department?.name || "Department"}
                                                </p>
                                            </div>

                                            <Badge variant="outline" className="whitespace-nowrap">
                                                Waiting
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        ) : (
                            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                                {manager ? "No waiting tickets right now." : "Select a manager to view up next."}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export default function PublicDisplaySection() {
    const [managers, setManagers] = React.useState<string[]>([])
    const [loadingManagers, setLoadingManagers] = React.useState(true)

    const [manager, setManager] = React.useState<string>("")
    const [state, setState] = React.useState<PublicDisplayState | null>(null)
    const [loadingState, setLoadingState] = React.useState(false)

    const [fullscreenOpen, setFullscreenOpen] = React.useState(false)
    const [fullscreenActive, setFullscreenActive] = React.useState(false)

    const [voiceEnabled, setVoiceEnabled] = React.useState<boolean>(() => {
        try {
            return localStorage.getItem(STORAGE_VOICE) === "1"
        } catch {
            return false
        }
    })

    const voiceEnabledRef = React.useRef(voiceEnabled)
    React.useEffect(() => {
        voiceEnabledRef.current = voiceEnabled
        try {
            localStorage.setItem(STORAGE_VOICE, voiceEnabled ? "1" : "0")
        } catch {
            // ignore
        }
    }, [voiceEnabled])

    const sinceRef = React.useRef<string | undefined>(undefined)
    const spokenIdsRef = React.useRef<Set<string>>(new Set())
    const speechQueueRef = React.useRef<Announcement[]>([])
    const speakingRef = React.useRef(false)

    const lastToastRef = React.useRef<number>(0)

    const safeToastError = (msg: string) => {
        const now = Date.now()
        if (now - lastToastRef.current < 8000) return
        lastToastRef.current = now
        toast.error(msg)
    }

    const pumpSpeech = React.useCallback(() => {
        if (!voiceEnabledRef.current) return
        if (speakingRef.current) return
        const next = speechQueueRef.current.shift()
        if (!next) return

        speakingRef.current = true
        try {
            const u = new SpeechSynthesisUtterance(next.voiceText)
            u.rate = 1
            u.onend = () => {
                speakingRef.current = false
                pumpSpeech()
            }
            u.onerror = () => {
                speakingRef.current = false
                pumpSpeech()
            }
            window.speechSynthesis.speak(u)
        } catch {
            speakingRef.current = false
        }
    }, [])

    const enqueueAnnouncements = React.useCallback(
        (items: Announcement[]) => {
            if (!items?.length) return
            const fresh = items.filter((a) => a?.id && !spokenIdsRef.current.has(a.id))
            if (!fresh.length) return

            for (const a of fresh) {
                spokenIdsRef.current.add(a.id)
                speechQueueRef.current.push(a)
            }

            pumpSpeech()
        },
        [pumpSpeech],
    )

    const loadManagers = React.useCallback(async () => {
        setLoadingManagers(true)
        try {
            const list = await landingApi.listManagers()
            setManagers(list)

            let next = ""
            try {
                const saved = localStorage.getItem(STORAGE_MANAGER)
                if (saved && list.includes(saved)) next = saved
            } catch {
                // ignore
            }

            if (!next) next = list[0] || ""
            setManager(next)
        } catch {
            safeToastError("Failed to load managers for Public Display.")
            setManagers([])
            setManager("")
        } finally {
            setLoadingManagers(false)
        }
    }, [])

    React.useEffect(() => {
        void loadManagers()
    }, [loadManagers])

    const refresh = React.useCallback(async () => {
        if (!manager) return
        setLoadingState(true)
        try {
            const data = await landingApi.getPublicDisplayState(manager, sinceRef.current)
            setState(data)

            const anns = data?.announcements ?? []
            if (anns.length) {
                const last = anns[anns.length - 1]
                sinceRef.current = last?.createdAt || sinceRef.current
                enqueueAnnouncements(anns)
            }
        } catch {
            safeToastError("Unable to load Public Display right now.")
        } finally {
            setLoadingState(false)
        }
    }, [manager, enqueueAnnouncements])

    React.useEffect(() => {
        if (!manager) return

        try {
            localStorage.setItem(STORAGE_MANAGER, manager)
        } catch {
            // ignore
        }

        // Reset announcement dedupe per manager switch
        sinceRef.current = undefined
        spokenIdsRef.current = new Set()
        speechQueueRef.current = []
        speakingRef.current = false

        void refresh()

        const id = window.setInterval(() => {
            void refresh()
        }, 2500)

        return () => window.clearInterval(id)
    }, [manager, refresh])

    React.useEffect(() => {
        const onFs = () => setFullscreenActive(isFullscreenActive())
        document.addEventListener("fullscreenchange", onFs)
        document.addEventListener("webkitfullscreenchange", onFs as any)
        onFs()
        return () => {
            document.removeEventListener("fullscreenchange", onFs)
            document.removeEventListener("webkitfullscreenchange", onFs as any)
        }
    }, [])

    const handleManagerChange = (v: string) => {
        setManager(v)
    }

    const openFullscreen = async () => {
        setFullscreenOpen(true)

        // Best-effort browser fullscreen (desktop + most mobile browsers).
        // iOS Safari often does not support it; we still show immersive mode (Dialog).
        if (!supportsFullscreen()) {
            toast.message("Fullscreen not supported in this browser. Using immersive mode instead.")
            return
        }

        const ok = await requestFullscreen()
        if (!ok) {
            toast.message("Could not enter browser fullscreen. Using immersive mode instead.")
        }
    }

    const closeFullscreen = async () => {
        setFullscreenOpen(false)
        if (isFullscreenActive()) await exitFullscreen()
    }

    const toggleVoice = (v: boolean) => {
        // This click is a user gesture -> helps keep voice audible on mobile
        setVoiceEnabled(v)
        try {
            // Warm-up voices (some browsers populate lazily)
            window.speechSynthesis.getVoices()
        } catch {
            // ignore
        }
        toast.success(v ? "Voice announcements enabled." : "Voice announcements disabled.")
    }

    return (
        <section id="public-display" className="scroll-mt-24">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold tracking-tight">Public Display</h2>
                <p className="text-muted-foreground">
                    A centralized display for the general public: switch managers, view their windows, and see who’s being served next.
                </p>
            </div>

            <Separator className="my-8" />

            <DisplayBoard
                manager={manager}
                managers={managers}
                onManagerChange={handleManagerChange}
                loadingManagers={loadingManagers}
                state={state}
                loadingState={loadingState}
                onRefresh={refresh}
                voiceEnabled={voiceEnabled}
                onVoiceToggle={toggleVoice}
                variant="embed"
                onOpenFullscreen={openFullscreen}
            />

            <Dialog
                open={fullscreenOpen}
                onOpenChange={(v) => {
                    if (!v) void closeFullscreen()
                    else setFullscreenOpen(true)
                }}
            >
                <DialogContent fullscreen showCloseButton={false} className="p-0">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Public Display Fullscreen</DialogTitle>
                    </DialogHeader>

                    <div className="flex h-full flex-col">
                        <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary">Public Display</Badge>
                                <Badge variant="outline" className="hidden sm:inline-flex">
                                    Landscape recommended on mobile
                                </Badge>
                            </div>
                        </div>

                        <div className="flex-1">
                            <DisplayBoard
                                manager={manager}
                                managers={managers}
                                onManagerChange={handleManagerChange}
                                loadingManagers={loadingManagers}
                                state={state}
                                loadingState={loadingState}
                                onRefresh={refresh}
                                voiceEnabled={voiceEnabled}
                                onVoiceToggle={toggleVoice}
                                variant="fullscreen"
                                onOpenFullscreen={openFullscreen}
                                onCloseFullscreen={closeFullscreen}
                                fullscreenActive={fullscreenActive}
                            />
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </section>
    )
}