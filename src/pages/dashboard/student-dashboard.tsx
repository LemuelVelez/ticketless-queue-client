"use client"

/* eslint-disable @typescript-eslint/no-unused-vars */
import type React from "react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { IconClock, IconTicket, IconUserCircle } from "@tabler/icons-react"
import { AppSidebar } from "@/components/student-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { MessageSquare } from "lucide-react"
import { mockStudent, type StudentData, type QueueHistoryEntry } from "@/data/mock-students"
import { mockServices, type Service } from "@/data/mock-services"

/** ---------------- Orderly Queue Helpers (per-service, resets daily) ---------------- */
const QUEUE_DATE_KEY = "queue_counter_date";
const COUNTER_PREFIX = "queue_counter_";

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}
function ensureCounterDateFresh() {
    try {
        const today = todayISO();
        const saved = localStorage.getItem(QUEUE_DATE_KEY);
        if (saved !== today) {
            const keysToClear: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(COUNTER_PREFIX)) keysToClear.push(k);
            }
            keysToClear.forEach((k) => localStorage.removeItem(k));
            localStorage.setItem(QUEUE_DATE_KEY, today);
        }
    } catch { /* empty */ }
}
function getNextQueueNumber(serviceId: string, serviceName: string): string {
    ensureCounterDateFresh();
    const prefix = (serviceName?.[0] || "Q").toUpperCase();
    const key = `${COUNTER_PREFIX}${serviceId}`;
    try {
        const current = parseInt(localStorage.getItem(key) || "0", 10);
        const next = current + 1;
        localStorage.setItem(key, String(next));
        return `${prefix}-${String(next).padStart(3, "0")}`;
    } catch {
        return `${prefix}-001`;
    }
}
/** ------------------------------------------------------------------------------- */

// Simulate fetching student data based on ID
const getStudentDataById = (id: string): StudentData => {
    console.log(`Fetching data for student ID: ${id}`)
    return mockStudent
}

export default function StudentDashboard() {
    const navigate = useNavigate()
    const { studentId, queueData, logout, isAuthenticated } = useAuth()
    const [studentData, setStudentData] = useState<StudentData>(() =>
        studentId ? getStudentDataById(studentId) : mockStudent,
    )
    const [selectedService, setSelectedService] = useState<string>("")

    // Phone input MUST start with '9' and be 10 digits total (9 + 9 more)
    const [phoneNumber, setPhoneNumber] = useState<string>("9")

    const [isJoiningQueue, setIsJoiningQueue] = useState<boolean>(false)
    const [isCancellingQueue, setIsCancellingQueue] = useState<boolean>(false)

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!isAuthenticated || !studentId) {
            navigate("/login")
            return
        }
    }, [isAuthenticated, studentId, navigate])

    // Initialize student data with queue data from login
    useEffect(() => {
        if (studentId) {
            const data = getStudentDataById(studentId)
            // If we have queue data from login, add it to current queue and history
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

    // ---------- Phone helpers: keep leading '9' immovable (same as join-queue-page) ----------
    const normalizeWithLeading9 = (value: string) => {
        let d = value.replace(/\D/g, "")
        if (d.startsWith("63")) d = d.slice(2)
        if (d.startsWith("0")) d = d.slice(1)
        if (!d.startsWith("9")) d = "9" + d
        if (d.length > 10) d = d.slice(0, 10)
        if (d.length < 1) d = "9" // ensure leading 9 remains
        return d
    }
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhoneNumber(normalizeWithLeading9(e.target.value))
    }
    const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const input = e.currentTarget
        const start = input.selectionStart ?? 0
        const end = input.selectionEnd ?? 0

        if (
            (e.key === "Backspace" && start <= 1 && end <= 1) ||
            (e.key === "Delete" && start === 0) ||
            (start === 0 && end > 0 && (e.key === "Backspace" || e.key === "Delete" || e.key.length === 1))
        ) {
            e.preventDefault()
        }
    }
    const isPhoneValid = /^9\d{9}$/.test(phoneNumber)
    // -----------------------------------------------------------------------------------------

    const handleJoinQueue = async () => {
        if (!selectedService) {
            toast.error("Please select a service to join the queue.")
            return
        }
        if (!isPhoneValid) {
            toast.error("Invalid mobile number. Enter 10 digits after +63 (must start with 9).")
            return
        }

        // Prevent joining if already in queue or currently processing
        if (studentData.currentQueue || isJoiningQueue || isCancellingQueue) {
            toast.error("Cannot join queue at this time.")
            return
        }

        setIsJoiningQueue(true)
        try {
            // Simulate API call to join queue
            await new Promise((resolve) => setTimeout(resolve, 2000))

            const serviceInfo = mockServices.find((s: Service) => s.id === selectedService)
            if (serviceInfo) {
                // >>> ORDERLY (SEQUENTIAL) NUMBER INSTEAD OF RANDOM
                const newQueueNumber = getNextQueueNumber(selectedService, serviceInfo.name)
                const fullE164 = `+63${phoneNumber}`
                const newQueueEntry = {
                    service: serviceInfo.name,
                    queueNumber: newQueueNumber,
                    estimatedWaitTime: serviceInfo.estimatedWaitTime,
                    servicePoint: serviceInfo.name,
                    phoneNumber: fullE164,
                }

                setStudentData((prev: StudentData) => ({
                    ...prev,
                    currentQueue: newQueueEntry,
                    queueHistory: [
                        {
                            id: String(Date.now()), // Use timestamp for unique ID
                            service: serviceInfo.name,
                            queueNumber: newQueueNumber,
                            status: "In Progress",
                            timestamp: new Date().toLocaleString(),
                        },
                        ...prev.queueHistory,
                    ],
                }))

                // Clear the selected service and reset phone to leading '9'
                setSelectedService("")
                setPhoneNumber("9")
                toast.success(
                    `Successfully joined queue for ${serviceInfo.name}! Your number is ${newQueueNumber}. SMS notification sent to ${fullE164}.`,
                )
            } else {
                toast.error("Failed to join queue. Service not found.")
            }
        } catch (error) {
            toast.error("Failed to join queue. Please try again.")
        } finally {
            setIsJoiningQueue(false)
        }
    }

    const handleCancelQueue = async () => {
        if (!studentData.currentQueue || isCancellingQueue || isJoiningQueue) {
            return
        }

        setIsCancellingQueue(true)
        try {
            // Simulate API call to cancel queue
            await new Promise((resolve) => setTimeout(resolve, 1500))

            const currentQueueNumber = studentData.currentQueue.queueNumber

            setStudentData((prev: StudentData) => {
                const updatedHistory: QueueHistoryEntry[] = prev.queueHistory.map((entry: QueueHistoryEntry) =>
                    entry.queueNumber === currentQueueNumber && entry.status === "In Progress"
                        ? { ...entry, status: "Cancelled" }
                        : entry,
                )

                return {
                    ...prev,
                    currentQueue: null, // Clear current queue
                    queueHistory: updatedHistory,
                }
            })

            toast.info("Your current queue has been cancelled.")
        } catch (error) {
            toast.error("Failed to cancel queue. Please try again.")
        } finally {
            setIsCancellingQueue(false)
        }
    }

    // Check if user can join a new queue
    const canJoinQueue =
        !studentData.currentQueue && !isJoiningQueue && !isCancellingQueue && selectedService && isPhoneValid

    // Don't render if not authenticated
    if (!isAuthenticated || !studentId) {
        return null
    }

    return (
        <SidebarProvider>
            {/* Sidebar is responsive (off-canvas on mobile) via the shadcn sidebar primitives. [^1] */}
            <AppSidebar onLogout={handleLogout} currentPage="dashboard" />
            <SidebarInset>
                <SiteHeader />
                <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {/* Student Information Card */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Student Information</CardTitle>
                                <IconUserCircle className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col items-center sm:flex-row sm:items-center gap-4 text-center sm:text-left">
                                    <Avatar className="h-16 w-16">
                                        <AvatarImage src={studentData.avatar || "/placeholder.svg"} alt={studentData.name} />
                                        <AvatarFallback>
                                            {studentData.name
                                                .split(" ")
                                                .map((n: string) => n[0])
                                                .join("")}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-2xl font-bold">{studentData.name}</p>
                                        <p className="text-sm text-muted-foreground">{studentData.id}</p>
                                        <p className="text-sm text-muted-foreground">{studentData.email}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Current Queue Status Card */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Current Queue Status</CardTitle>
                                <IconTicket className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                {studentData.currentQueue ? (
                                    <div className="grid gap-2">
                                        <p className="text-2xl font-bold">{studentData.currentQueue.queueNumber}</p>
                                        <p className="text-sm text-muted-foreground">Service: {studentData.currentQueue.service}</p>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                            <IconClock className="h-4 w-4" /> Estimated Wait: {studentData.currentQueue.estimatedWaitTime}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Service Point: {studentData.currentQueue.servicePoint}
                                        </p>
                                        <Button
                                            variant="destructive"
                                            className="mt-4 w-full"
                                            onClick={handleCancelQueue}
                                            disabled={isCancellingQueue || isJoiningQueue}
                                        >
                                            {isCancellingQueue ? "Cancelling..." : "Cancel Queue"}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="text-muted-foreground text-center">
                                        <p>You are not currently in a queue.</p>
                                        <p className="mt-2 text-sm">Select a service point to join a new queue.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Join New Queue Card */}
                        <Card className="lg:col-span-1">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Join New Queue</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="service-select" className="text-sm font-medium">
                                            Select Service Point <span className="text-red-500">*</span>
                                        </Label>
                                        <Select
                                            value={selectedService}
                                            onValueChange={setSelectedService}
                                            disabled={!!studentData.currentQueue || isJoiningQueue || isCancellingQueue}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select a service point" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {mockServices.map((service: Service) => (
                                                    <SelectItem key={service.id} value={service.id}>
                                                        {service.name} (Est. Wait: {service.estimatedWaitTime})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="phone" className="text-sm font-medium">
                                            Mobile Number <span className="text-red-500">*</span>
                                        </Label>
                                        <div className="flex">
                                            <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-r-0 border-gray-300 rounded-l-md select-none">
                                                +63
                                            </span>
                                            <Input
                                                id="phone"
                                                type="tel"
                                                inputMode="numeric"
                                                maxLength={10}
                                                pattern="^9\d{9}$"
                                                placeholder="9XX XXX XXXX"
                                                value={phoneNumber}
                                                onChange={handlePhoneChange}
                                                onKeyDown={handlePhoneKeyDown}
                                                required
                                                disabled={!!studentData.currentQueue || isJoiningQueue || isCancellingQueue}
                                                className="rounded-l-none"
                                                aria-label="Philippine mobile number starting with 9"
                                                title="+63 followed by 10 digits starting with 9"
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <MessageSquare className="h-4 w-4" />
                                            SMS notifications will be sent to this number
                                        </p>
                                    </div>

                                    <Button onClick={handleJoinQueue} disabled={!canJoinQueue} className="w-full">
                                        {isJoiningQueue ? "Joining..." : "Join Queue"}
                                    </Button>

                                    {studentData.currentQueue && (
                                        <p className="text-sm text-muted-foreground text-center">
                                            You are already in a queue. Please cancel your current queue to join a new one.
                                        </p>
                                    )}
                                    {(isJoiningQueue || isCancellingQueue) && !studentData.currentQueue && (
                                        <p className="text-sm text-muted-foreground text-center">
                                            Please wait while processing your request...
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Queue History Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Queue History</CardTitle>
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
                                        {studentData.queueHistory.length > 0 ? (
                                            studentData.queueHistory.map((entry: QueueHistoryEntry) => (
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
                                                    No queue history found.
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
