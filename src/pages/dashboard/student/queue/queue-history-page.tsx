"use client"

import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { IconClock, IconFilter, IconHistory, IconSearch, IconTableExport } from "@tabler/icons-react"
import { AppSidebar } from "@/components/student-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

import { useAuth } from "@/contexts/AuthContext"
import { mockStudent, type StudentData, type QueueHistoryEntry } from "@/data/mock-students"

// Simulate fetching student data based on ID (same approach as your other pages)
const getStudentDataById = (id: string): StudentData => {
    console.log(`Fetching data for student ID: ${id}`)
    return mockStudent
}

type StatusFilter = "All" | "Completed" | "In Progress" | "Cancelled"

export default function QueueHistoryPage() {
    const navigate = useNavigate()
    const { isAuthenticated, studentId, queueData, logout } = useAuth()
    const [studentData, setStudentData] = useState<StudentData>(() =>
        studentId ? getStudentDataById(studentId) : mockStudent,
    )

    // Filters
    const [search, setSearch] = useState<string>("")
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("All")

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!isAuthenticated || !studentId) {
            navigate("/login")
            return
        }
    }, [isAuthenticated, studentId, navigate])

    // Initialize student data with any active queue from AuthContext (same as other pages)
    useEffect(() => {
        if (studentId) {
            const data = getStudentDataById(studentId)
            if (queueData) {
                const newQueueEntry: QueueHistoryEntry = {
                    id: String(Date.now()),
                    service: queueData.service,
                    queueNumber: queueData.queueNumber,
                    status: "In Progress",
                    timestamp: new Date().toLocaleString(),
                }
                setStudentData({
                    ...data,
                    currentQueue: queueData,
                    queueHistory: [newQueueEntry, ...data.queueHistory],
                })
            } else {
                setStudentData(data)
            }
        }
    }, [studentId, queueData])

    const handleLogout = () => {
        logout()
        navigate("/")
    }

    const counts = useMemo(() => {
        const total = studentData.queueHistory.length
        const completed = studentData.queueHistory.filter((e) => e.status === "Completed").length
        const inProgress = studentData.queueHistory.filter((e) => e.status === "In Progress").length
        const cancelled = studentData.queueHistory.filter((e) => e.status === "Cancelled").length
        return { total, completed, inProgress, cancelled }
    }, [studentData.queueHistory])

    const filtered = useMemo(() => {
        let list = [...studentData.queueHistory]
        if (statusFilter !== "All") {
            list = list.filter((e) => e.status === statusFilter)
        }
        if (search.trim()) {
            const q = search.trim().toLowerCase()
            list = list.filter(
                (e) =>
                    e.service.toLowerCase().includes(q) ||
                    e.queueNumber.toLowerCase().includes(q) ||
                    e.timestamp.toLowerCase().includes(q),
            )
        }
        return list
    }, [studentData.queueHistory, statusFilter, search])

    const resetFilters = () => {
        setSearch("")
        setStatusFilter("All")
    }

    const exportCSV = () => {
        if (filtered.length === 0) {
            toast.info("No records to export.")
            return
        }
        const headers = ["ID", "Service", "Queue Number", "Status", "Timestamp"]
        const rows = filtered.map((e) => [e.id, e.service, e.queueNumber, e.status, e.timestamp])
        const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "queue-history.csv"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success("Exported queue history.")
    }

    // Don't render if not authenticated
    if (!isAuthenticated || !studentId) {
        return null
    }

    const actions = (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => navigate("/my-queue")} className="w-full sm:w-auto">
                Go to My Queue
            </Button>
            <Button onClick={exportCSV} className="gap-2 w-full sm:w-auto">
                <IconTableExport className="h-4 w-4" />
                Export CSV
            </Button>
        </div>
    )

    return (
        <SidebarProvider>
            {/* Uses shadcn/ui Sidebar primitives that collapse to an off-canvas Sheet on mobile for responsive behavior. [^1] */}
            <AppSidebar onLogout={handleLogout} currentPage="queue-history" />
            <SidebarInset>
                <SiteHeader />
                <main className="flex flex-1 flex-col gap-6 p-4 lg:gap-8 lg:p-6">
                    {/* Page Header */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Queue History</h1>
                            <p className="text-muted-foreground">View and filter your past queue entries</p>
                        </div>
                        {actions}
                    </div>

                    {/* Summary */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Records</CardTitle>
                                <IconHistory className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{counts.total}</div>
                                <p className="text-xs text-muted-foreground">All-time queue entries</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                                <span className="inline-block size-2 rounded-full bg-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{counts.completed}</div>
                                <p className="text-xs text-muted-foreground">Served and finished</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                                <span className="inline-block size-2 rounded-full bg-blue-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{counts.inProgress}</div>
                                <p className="text-xs text-muted-foreground">Currently active</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
                                <span className="inline-block size-2 rounded-full bg-red-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{counts.cancelled}</div>
                                <p className="text-xs text-muted-foreground">Cancelled entries</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filters */}
                    <Card className="border-2 border-blue-100 bg-blue-50/30">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Filters</CardTitle>
                            <CardDescription>Search and narrow down your queue history records</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="search">Search</Label>
                                    <div className="relative">
                                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="search"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search by service, number, or timestamp"
                                            className="pl-9"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="status">Status</Label>
                                    <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
                                        <SelectTrigger id="status" className="w-full">
                                            <SelectValue placeholder="Filter by status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="All">All</SelectItem>
                                            <SelectItem value="Completed">Completed</SelectItem>
                                            <SelectItem value="In Progress">In Progress</SelectItem>
                                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                                    <Button variant="outline" onClick={resetFilters} className="w-full sm:w-auto bg-transparent">
                                        Reset
                                    </Button>
                                    <Button variant="secondary" className="gap-2 w-full sm:w-auto">
                                        <IconFilter className="h-4 w-4" />
                                        Apply
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <IconClock className="h-5 w-5" />
                                History Records
                            </CardTitle>
                            <CardDescription>Your past queue entries and their status.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Service</TableHead>
                                            <TableHead>Queue Number</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Timestamp</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.length > 0 ? (
                                            filtered.map((entry: QueueHistoryEntry) => (
                                                <TableRow key={entry.id}>
                                                    <TableCell className="font-medium">{entry.service}</TableCell>
                                                    <TableCell>{entry.queueNumber}</TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className={
                                                                entry.status === "Completed"
                                                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                                                    : entry.status === "In Progress"
                                                                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                                                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                                            }
                                                        >
                                                            {entry.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{entry.timestamp}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                                    No records match your filters.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}
