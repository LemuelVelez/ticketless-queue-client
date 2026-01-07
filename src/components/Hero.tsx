/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { BellRing, Mic, QrCode, Tv2, Volume2 } from "lucide-react"

import heroImage from "@/assets/images/heroImage.svg"
import { useSession } from "@/hooks/use-session"

import { studentApi, type Department } from "@/api/student"
import { api } from "@/lib/http"
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
    type CarouselApi,
} from "@/components/ui/carousel"

type DisplayNowServing = {
    id: string
    queueNumber: number
    windowNumber: number | null
    calledAt: string | null
} | null

type DisplayUpNextRow = {
    id: string
    queueNumber: number
}

type DepartmentDisplayResponse = {
    department: { id: string; name: string }
    nowServing: DisplayNowServing
    upNext: DisplayUpNextRow[]
}

type LiveDeptSnapshot = {
    data: DepartmentDisplayResponse | null
    fetchedAt: number | null
    error?: string
}

function formatAgo(ms: number) {
    const sec = Math.max(0, Math.floor(ms / 1000))
    if (sec < 60) return `${sec}s ago`
    const min = Math.floor(sec / 60)
    return `${min}m ago`
}

export default function Hero() {
    const { user, loading } = useSession()
    const dashboardPath = user?.role === "ADMIN" ? "/admin/dashboard" : "/staff/dashboard"

    // ---- Live carousel (departments + now serving/up next) ----
    const [loadingDepts, setLoadingDepts] = React.useState(true)
    const [departments, setDepartments] = React.useState<Department[]>([])
    const [live, setLive] = React.useState<Record<string, LiveDeptSnapshot>>({})

    const [carouselApi, setCarouselApi] = React.useState<CarouselApi | null>(null)
    const [activeIndex, setActiveIndex] = React.useState(0)
    const [loadingDeptId, setLoadingDeptId] = React.useState<string | null>(null)

    const activeDept = React.useMemo(() => departments[activeIndex] || null, [departments, activeIndex])

    const fetchDepartments = React.useCallback(async () => {
        setLoadingDepts(true)
        try {
            const res = await studentApi.listDepartments()
            const list = res.departments ?? []
            setDepartments(list)
        } catch {
            setDepartments([])
        } finally {
            setLoadingDepts(false)
        }
    }, [])

    const fetchDeptDisplay = React.useCallback(
        async (deptId: string) => {
            if (!deptId) return
            setLoadingDeptId(deptId)
            try {
                const res = await api.get<DepartmentDisplayResponse>(`/display/${deptId}`, { auth: false })
                setLive((prev) => ({
                    ...prev,
                    [deptId]: { data: res, fetchedAt: Date.now() },
                }))
            } catch (e: any) {
                setLive((prev) => ({
                    ...prev,
                    [deptId]: {
                        data: prev?.[deptId]?.data ?? null,
                        fetchedAt: prev?.[deptId]?.fetchedAt ?? null,
                        error: e?.message ?? "Failed to load",
                    },
                }))
            } finally {
                setLoadingDeptId((prev) => (prev === deptId ? null : prev))
            }
        },
        [],
    )

    React.useEffect(() => {
        void fetchDepartments()
    }, [fetchDepartments])

    // Track active slide
    React.useEffect(() => {
        if (!carouselApi) return
        const onSelect = () => setActiveIndex(carouselApi.selectedScrollSnap())
        onSelect()
        carouselApi.on("select", onSelect)
        return () => {
            carouselApi.off("select", onSelect)
        }
    }, [carouselApi])

    // Auto-refresh ONLY the currently viewed department (every 5s)
    React.useEffect(() => {
        const deptId = activeDept?._id
        if (!deptId) return

        void fetchDeptDisplay(deptId)
        const t = window.setInterval(() => void fetchDeptDisplay(deptId), 5000)
        return () => window.clearInterval(t)
    }, [activeDept?._id, fetchDeptDisplay])

    return (
        <section className="py-12 md:py-16">
            <div className="grid gap-8 md:grid-cols-2 md:items-start">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="gap-1">
                            <QrCode className="h-3.5 w-3.5" />
                            QR-based entry
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                            <BellRing className="h-3.5 w-3.5" />
                            SMS notification
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                            <Volume2 className="h-3.5 w-3.5" />
                            Voice announcement
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                            <Tv2 className="h-3.5 w-3.5" />
                            Public display
                        </Badge>
                    </div>

                    <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
                        QueuePass: ticketless student ID queueing for school offices
                    </h1>
                    <p className="mt-4 text-pretty text-muted-foreground">
                        Students scan a QR code, enter their Student ID, and get a virtual queue number. Staff can call
                        next, recall, serve, and HOLD no-shows—while the public display updates in real time with SMS +
                        voice announcements.
                    </p>

                    <div className="mt-6 flex flex-wrap gap-2">
                        <Button asChild>
                            <a href="/join">Join Queue</a>
                        </Button>

                        {/* ✅ Show Dashboard only when session user exists (and not while loading) */}
                        {!loading && user ? (
                            <Button variant="outline" asChild>
                                <Link to={dashboardPath}>Dashboard</Link>
                            </Button>
                        ) : null}
                    </div>

                    <div className="mt-6">
                        <Separator className="my-4" />
                        <p className="text-sm text-muted-foreground">
                            Designed for Registrar, Cashier, Library, Clinic, NSTP/ROTC, and other student-facing
                            departments.
                        </p>
                    </div>
                </div>

                {/* Right column: portrait image + live carousel */}
                <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
                    <div className="flex items-start justify-center lg:justify-start">
                        <div className="w-full max-w-70 rounded-xl border bg-card p-3">
                            <img
                                src={heroImage}
                                alt="QueuePass hero illustration"
                                className="h-full w-full object-contain rounded-circle"
                            />
                        </div>
                    </div>

                    <Card className="overflow-hidden">
                        <CardHeader>
                            <CardTitle>Live display (all departments)</CardTitle>
                            <CardDescription>
                                Swipe through departments — the current slide refreshes every 5 seconds.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="grid gap-4">
                            {loadingDepts ? (
                                <div className="grid gap-3">
                                    <div className="h-24 w-full rounded-lg border bg-muted" />
                                    <div className="h-24 w-full rounded-lg border bg-muted" />
                                </div>
                            ) : departments.length === 0 ? (
                                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                                    No departments available to display.
                                </div>
                            ) : (
                                <Carousel
                                    setApi={setCarouselApi}
                                    opts={{ align: "start", loop: true }}
                                    className="w-full"
                                >
                                    <CarouselContent>
                                        {departments.map((d) => {
                                            const snap = live[d._id]
                                            const data = snap?.data ?? null
                                            const isActive = activeDept?._id === d._id
                                            const isLoadingThis = isActive && loadingDeptId === d._id

                                            const nowServing = data?.nowServing ?? null
                                            const upNext = data?.upNext ?? []

                                            return (
                                                <CarouselItem key={d._id}>
                                                    <div className="grid gap-3 rounded-xl border p-4">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <div className="truncate text-sm font-medium">
                                                                    {d.name}
                                                                    {d.code ? ` (${d.code})` : ""}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    Department live status
                                                                </div>
                                                            </div>

                                                            <Badge variant="secondary">
                                                                {isActive ? "Live" : "Dept"}
                                                            </Badge>
                                                        </div>

                                                        <Separator />

                                                        {/* Now Serving */}
                                                        <div className="grid gap-2 rounded-lg border p-3">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm font-medium">Now Serving</span>
                                                                <Badge>
                                                                    {nowServing?.windowNumber
                                                                        ? `Window ${nowServing.windowNumber}`
                                                                        : "—"}
                                                                </Badge>
                                                            </div>

                                                            {isLoadingThis ? (
                                                                <div className="text-sm text-muted-foreground">
                                                                    Loading live data…
                                                                </div>
                                                            ) : nowServing ? (
                                                                <div className="text-3xl font-semibold">
                                                                    Queue #{nowServing.queueNumber}
                                                                </div>
                                                            ) : (
                                                                <div className="text-sm text-muted-foreground">
                                                                    No ticket is currently being called.
                                                                </div>
                                                            )}

                                                            {snap?.error ? (
                                                                <div className="text-xs text-destructive">
                                                                    {snap.error}
                                                                </div>
                                                            ) : null}
                                                        </div>

                                                        {/* Up Next */}
                                                        <div className="grid gap-2 rounded-lg border p-3">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm font-medium">Up Next</span>
                                                                <Badge variant="secondary">{upNext.length}</Badge>
                                                            </div>

                                                            {isLoadingThis ? (
                                                                <div className="text-sm text-muted-foreground">
                                                                    Loading…
                                                                </div>
                                                            ) : upNext.length ? (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {upNext.slice(0, 6).map((t) => (
                                                                        <Badge key={t.id} variant="outline">
                                                                            #{t.queueNumber}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="text-sm text-muted-foreground">
                                                                    No waiting tickets.
                                                                </div>
                                                            )}

                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                <Mic className="h-4 w-4" />
                                                                Voice runs on the display browser (Web Speech API).
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                            <span>
                                                                {snap?.fetchedAt
                                                                    ? `Updated ${formatAgo(Date.now() - snap.fetchedAt)}`
                                                                    : "Not loaded yet"}
                                                            </span>
                                                            <Button asChild size="sm" variant="outline">
                                                                <Link to={`/display?departmentId=${encodeURIComponent(d._id)}`}>
                                                                    Open Display
                                                                </Link>
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CarouselItem>
                                            )
                                        })}
                                    </CarouselContent>

                                    <CarouselPrevious />
                                    <CarouselNext />
                                </Carousel>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </section>
    )
}
