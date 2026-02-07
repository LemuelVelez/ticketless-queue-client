/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { Activity, Home, PieChart as PieChartIcon, TrendingUp } from "lucide-react"
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"

import Header from "@/components/Header"
import Footer from "@/components/Footer"

import { studentApi, type HomeOverviewResponse } from "@/api/student"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const STATUS_COLORS: Record<string, string> = {
    WAITING: "var(--chart-1)",
    CALLED: "var(--chart-2)",
    HOLD: "var(--chart-3)",
    SERVED: "var(--chart-4)",
    OUT: "var(--chart-5)",
}

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

function pickNonEmptyString(v: unknown) {
    return typeof v === "string" && v.trim() ? v.trim() : ""
}

function formatDateTime(input?: string) {
    if (!input) return "—"
    const d = new Date(input)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString()
}

function formatNumber(v: number | undefined) {
    return new Intl.NumberFormat().format(Number(v || 0))
}

export default function StudentHomePage() {
    const location = useLocation()

    const qs = React.useMemo(() => new URLSearchParams(location.search || ""), [location.search])
    const preDeptId = React.useMemo(() => pickNonEmptyString(qs.get("departmentId")), [qs])

    const [loading, setLoading] = React.useState(true)
    const [overview, setOverview] = React.useState<HomeOverviewResponse | null>(null)

    const loadOverview = React.useCallback(async () => {
        setLoading(true)
        try {
            const res = await studentApi.getHomeOverview({
                participantType: "STUDENT",
                departmentId: preDeptId || undefined,
                days: 7,
            })
            setOverview(res)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load overview charts.")
            setOverview(null)
        } finally {
            setLoading(false)
        }
    }, [preDeptId])

    React.useEffect(() => {
        void loadOverview()
    }, [loadOverview])

    const topDepartments = React.useMemo(() => {
        return (overview?.departmentLoad ?? []).slice(0, 6)
    }, [overview])

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header variant="student" />

            <main className="mx-auto w-full px-4 py-10 space-y-6">
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="gap-2">
                            <Home className="h-3.5 w-3.5" />
                            Student
                        </Badge>
                        {overview?.scope?.departmentName ? <Badge variant="outline">{overview.scope.departmentName}</Badge> : null}
                        <Badge variant="outline">Updated: {formatDateTime(overview?.generatedAt)}</Badge>
                    </div>

                    <h1 className="text-2xl font-semibold tracking-tight">Student Home Overview</h1>
                    <p className="text-sm text-muted-foreground">
                        Live queue analytics and service performance for today.
                    </p>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <Skeleton className="h-28 w-full" />
                            <Skeleton className="h-28 w-full" />
                            <Skeleton className="h-28 w-full" />
                            <Skeleton className="h-28 w-full" />
                        </div>
                        <Skeleton className="h-85 w-full" />
                        <Skeleton className="h-85 w-full" />
                    </div>
                ) : !overview ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Overview unavailable</CardTitle>
                            <CardDescription>Could not load chart data right now. Please try refreshing the page.</CardDescription>
                        </CardHeader>
                    </Card>
                ) : (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>Active Tickets</CardDescription>
                                    <CardTitle className="text-2xl">{formatNumber(overview.highlights.activeTickets)}</CardTitle>
                                </CardHeader>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>Total Today</CardDescription>
                                    <CardTitle className="text-2xl">{formatNumber(overview.highlights.totalToday)}</CardTitle>
                                </CardHeader>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>Served Today</CardDescription>
                                    <CardTitle className="text-2xl">{formatNumber(overview.highlights.servedToday)}</CardTitle>
                                </CardHeader>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>Enabled Departments</CardDescription>
                                    <CardTitle className="text-2xl">{formatNumber(overview.highlights.enabledDepartments)}</CardTitle>
                                </CardHeader>
                            </Card>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Activity className="h-4 w-4" />
                                        Status Distribution
                                    </CardTitle>
                                    <CardDescription>Current ticket statuses for {overview.dateKey}</CardDescription>
                                </CardHeader>
                                <CardContent className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={overview.statusDistribution}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="status" />
                                            <YAxis allowDecimals={false} />
                                            <Tooltip />
                                            <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                                                {overview.statusDistribution.map((row) => (
                                                    <Cell
                                                        key={row.status}
                                                        fill={STATUS_COLORS[row.status] ?? "var(--chart-1)"}
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <PieChartIcon className="h-4 w-4" />
                                        Department Load
                                    </CardTitle>
                                    <CardDescription>Top departments by total queue volume today</CardDescription>
                                </CardHeader>
                                <CardContent className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={topDepartments}
                                                dataKey="total"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={95}
                                                paddingAngle={2}
                                            >
                                                {topDepartments.map((row, idx) => (
                                                    <Cell
                                                        key={`${row.departmentId}-${idx}`}
                                                        fill={PIE_COLORS[idx % PIE_COLORS.length]}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4" />
                                    7-Day Queue Trend
                                </CardTitle>
                                <CardDescription>Total vs served tickets for the last 7 days</CardDescription>
                            </CardHeader>
                            <CardContent className="h-85">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={overview.trend}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="dateKey" tickFormatter={(v) => String(v).slice(5)} />
                                        <YAxis allowDecimals={false} />
                                        <Tooltip />
                                        <Legend />
                                        <Area
                                            type="monotone"
                                            dataKey="total"
                                            stroke="var(--chart-1)"
                                            fill="var(--chart-1)"
                                            fillOpacity={0.15}
                                            strokeWidth={2}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="served"
                                            stroke="var(--chart-2)"
                                            fill="var(--chart-2)"
                                            fillOpacity={0.12}
                                            strokeWidth={2}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </>
                )}
            </main>

            <Footer variant="student" />
        </div>
    )
}
