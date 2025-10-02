// src/pages/queue/join-queue-page.tsx
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Building2, Clock, MessageSquare, ArrowLeft, Phone } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { AppSidebar } from "@/components/student-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

export default function JoinQueuePage() {
    const navigate = useNavigate()
    const { isAuthenticated, studentId, login, queueData } = useAuth()

    const [selectedService, setSelectedService] = useState<string>("")
    // Phone input MUST start with '9' and be 10 digits total (9 + 9 more)
    const [phoneNumber, setPhoneNumber] = useState<string>("9")
    const [isJoiningQueue, setIsJoiningQueue] = useState<boolean>(false)

    useEffect(() => {
        if (!isAuthenticated || !studentId) {
            navigate("/login")
        }
    }, [isAuthenticated, studentId, navigate])

    const selectedServicePoint = useMemo(
        () => mockServices.find((s: Service) => s.id === selectedService),
        [selectedService],
    )

    const isPhoneValid = /^9\d{9}$/.test(phoneNumber)
    const canJoin = Boolean(selectedService && isPhoneValid && !isJoiningQueue)

    const handleBack = () => {
        navigate("/student")
    }

    // Normalize to a 10-digit number starting with 9.
    // Handles pastes like "+639123456789", "09123456789", "9123456789", etc.
    const normalizeWithLeading9 = (value: string) => {
        let d = value.replace(/\D/g, "")
        if (d.startsWith("63")) d = d.slice(2)
        if (d.startsWith("0")) d = d.slice(1)
        if (!d.startsWith("9")) d = "9" + d
        if (d.length > 10) d = d.slice(0, 10)
        if (d.length < 1) d = "9" // ensure the leading 9 remains
        return d
    }

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhoneNumber(normalizeWithLeading9(e.target.value))
    }

    // Prevent deleting or overwriting the first '9'
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

    const handleJoinQueue = async () => {
        if (!selectedService) {
            toast.error("Please select a service point.")
            return
        }
        if (!isPhoneValid) {
            toast.error("Invalid mobile number. Enter 10 digits after +63 (must start with 9).")
            return
        }
        if (!studentId) {
            toast.error("You must be logged in to join a queue.")
            navigate("/login")
            return
        }
        // Optional: prevent if already in an active queue per context state
        if (queueData) {
            toast.info("You already have an active queue. Redirecting to My Queue...")
            navigate("/my-queue")
            return
        }

        try {
            setIsJoiningQueue(true)
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 1500))

            const serviceInfo = mockServices.find((s: Service) => s.id === selectedService)
            if (!serviceInfo) {
                toast.error("Failed to join queue. Service not found.")
                return
            }

            // >>> ORDERLY (SEQUENTIAL) NUMBER INSTEAD OF RANDOM
            const newQueueNumber = getNextQueueNumber(selectedService, serviceInfo.name)
            const fullE164 = `+63${phoneNumber}`
            const newQueueData = {
                service: serviceInfo.name,
                queueNumber: newQueueNumber,
                estimatedWaitTime: serviceInfo.estimatedWaitTime,
                servicePoint: serviceInfo.name,
                phoneNumber: fullE164,
            }

            // Reuse login() to update auth context with the new queue data
            login(studentId, newQueueData)

            toast.success(
                `Successfully joined queue for ${serviceInfo.name}! Your number is ${newQueueNumber}. SMS notification sent to ${fullE164}.`,
            )

            // Navigate to My Queue page
            navigate("/my-queue")
        } catch (err) {
            toast.error("Failed to join queue. Please try again.")
        } finally {
            setIsJoiningQueue(false)
        }
    }

    if (!isAuthenticated || !studentId) {
        return null
    }

    return (
        <SidebarProvider>
            <AppSidebar currentPage="join-queue" />
            <SidebarInset>
                <SiteHeader />
                <main className="flex flex-1 flex-col gap-6 p-4 lg:gap-8 lg:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" onClick={handleBack} className="gap-2 w-full sm:w-auto">
                                <ArrowLeft className="h-4 w-4" />
                                Back to Dashboard
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Join Queue Form */}
                        <Card className="border-2 border-blue-200 bg-white/80">
                            <CardHeader>
                                <CardTitle className="text-2xl">Join a Service Queue</CardTitle>
                                <CardDescription>Choose a service point and enter your mobile number for SMS updates.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="service-select" className="text-sm font-medium">
                                        Select Service Point <span className="text-red-500">*</span>
                                    </Label>
                                    <Select value={selectedService} onValueChange={setSelectedService}>
                                        <SelectTrigger className="w-full cursor-pointer">
                                            <SelectValue placeholder="Select a service point" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {mockServices.map((service: Service) => (
                                                <SelectItem key={service.id} value={service.id} className="cursor-pointer">
                                                    <div className="flex items-center justify-between w-full">
                                                        <span>{service.name}</span>
                                                        <span className="text-xs text-muted-foreground ml-2">{service.estimatedWaitTime}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="phone" className="text-sm font-medium">
                                        Mobile Number <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="flex w-full">
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
                                            className="rounded-l-none"
                                            aria-label="Philippine mobile number starting with 9"
                                            title="+63 followed by 10 digits starting with 9"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <MessageSquare className="h-4 w-4" />
                                        SMS notifications will be sent to this number.
                                    </p>
                                </div>

                                {selectedServicePoint && (
                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3 mb-2">
                                            <Building2 className="h-5 w-5 text-blue-600" />
                                            <div>
                                                <p className="font-medium text-blue-900">{selectedServicePoint.name}</p>
                                                <p className="text-sm text-blue-700">{selectedServicePoint.description}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start sm:items-center gap-2 text-sm text-blue-600">
                                            <Clock className="h-4 w-4" />
                                            <span>Estimated wait time: {selectedServicePoint.estimatedWaitTime}</span>
                                        </div>
                                    </div>
                                )}

                                <Button onClick={handleJoinQueue} disabled={!canJoin} className="w-full">
                                    {isJoiningQueue ? (
                                        <div className="flex items-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            Joining Queue...
                                        </div>
                                    ) : (
                                        "Join Queue"
                                    )}
                                </Button>

                                <div className="text-center space-y-2">
                                    <p className="text-xs text-muted-foreground">
                                        You will receive SMS notifications about your queue status.
                                    </p>
                                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Phone className="h-4 w-4" />
                                            SMS Updates
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <MessageSquare className="h-4 w-4" />
                                            Real-time Status
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Helpful Info */}
                        <Card className="bg-blue-50/50 border-2 border-blue-100">
                            <CardHeader>
                                <CardTitle>How it works</CardTitle>
                                <CardDescription>Quick overview of the ticketless queue experience</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm text-muted-foreground">
                                <ol className="list-decimal pl-5 space-y-2">
                                    <li>Choose a service point and enter your mobile number.</li>
                                    <li>Receive your orderly queue number and estimated wait time.</li>
                                    <li>Track your position and get SMS reminders as your turn approaches.</li>
                                    <li>Proceed to the service point when called.</li>
                                </ol>
                                <div className="rounded-md border p-4 bg-white">
                                    Tip: Keep your phone nearby to avoid missing your turn.
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}
