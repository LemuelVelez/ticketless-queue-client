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

export default function JoinQueuePage() {
    const navigate = useNavigate()
    const { isAuthenticated, studentId, login, queueData } = useAuth()

    const [selectedService, setSelectedService] = useState<string>("")
    const [phoneNumber, setPhoneNumber] = useState<string>("")
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

    const canJoin = Boolean(selectedService && phoneNumber && !isJoiningQueue)

    const handleBack = () => {
        navigate("/student")
    }

    const handleJoinQueue = async () => {
        if (!selectedService) {
            toast.error("Please select a service point.")
            return
        }
        if (!phoneNumber) {
            toast.error("Please provide your mobile number for SMS notifications.")
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

            const newQueueNumber = `${serviceInfo.name.substring(0, 1)}-${Math.floor(Math.random() * 100) + 1}`
            const newQueueData = {
                service: serviceInfo.name,
                queueNumber: newQueueNumber,
                estimatedWaitTime: serviceInfo.estimatedWaitTime,
                servicePoint: serviceInfo.name,
                phoneNumber,
            }

            // Reuse login() to update auth context with the new queue data
            login(studentId, newQueueData)

            toast.success(
                `Successfully joined queue for ${serviceInfo.name}! Your number is ${newQueueNumber}. SMS notification sent to +63${phoneNumber}.`,
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
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" onClick={handleBack} className="gap-2">
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
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select a service point" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {mockServices.map((service: Service) => (
                                                <SelectItem key={service.id} value={service.id}>
                                                    <div className="flex items-center justify-between w-full">
                                                        <span>{service.name}</span>
                                                        <span className="text-xs text-muted-foreground">{service.estimatedWaitTime}</span>
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
                                    <div className="flex">
                                        <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-r-0 border-gray-300 rounded-l-md">
                                            +63
                                        </span>
                                        <Input
                                            id="phone"
                                            type="tel"
                                            placeholder="9XX XXX XXXX"
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                            className="rounded-l-none"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <MessageSquare className="h-4 w-4" />
                                        SMS notifications will be sent to this number.
                                    </p>
                                </div>

                                {selectedServicePoint && (
                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Building2 className="h-5 w-5 text-blue-600" />
                                            <div>
                                                <p className="font-medium text-blue-900">{selectedServicePoint.name}</p>
                                                <p className="text-sm text-blue-700">{selectedServicePoint.description}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-blue-600">
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
                                    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
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
                                    <li>Receive your queue number and estimated wait time.</li>
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
