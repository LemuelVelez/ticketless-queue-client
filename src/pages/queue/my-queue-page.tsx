/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
    IconTicket,
    IconRefresh,
    IconX,
    IconCheck
} from "@tabler/icons-react";
import { AppSidebar } from "@/components/student-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Clock, MapPin, Phone, Users, AlertCircle } from 'lucide-react';
import { mockStudent, type StudentData } from "@/data/mock-students";

// Simulate fetching student data based on ID
const getStudentDataById = (id: string): StudentData => {
    console.log(`Fetching data for student ID: ${id}`);
    return mockStudent;
};

// Simulate real-time queue updates
const useQueueUpdates = (queueNumber: string | null) => {
    const [queuePosition, setQueuePosition] = useState<number>(5);
    const [peopleAhead, setPeopleAhead] = useState<number>(4);
    const [estimatedWaitMinutes, setEstimatedWaitMinutes] = useState<number>(15);

    useEffect(() => {
        if (!queueNumber) return;

        const interval = setInterval(() => {
            // Simulate queue movement
            setQueuePosition(prev => Math.max(1, prev - Math.random() * 0.3));
            setPeopleAhead(prev => Math.max(0, prev - Math.random() * 0.3));
            setEstimatedWaitMinutes(prev => Math.max(1, prev - Math.random() * 0.5));
        }, 10000); // Update every 10 seconds

        return () => clearInterval(interval);
    }, [queueNumber]);

    return { queuePosition: Math.floor(queuePosition), peopleAhead: Math.floor(peopleAhead), estimatedWaitMinutes: Math.floor(estimatedWaitMinutes) };
};

export default function MyQueuePage() {
    const navigate = useNavigate();
    const { studentId, queueData, logout, isAuthenticated } = useAuth();
    const [studentData, setStudentData] = useState<StudentData>(() =>
        studentId ? getStudentDataById(studentId) : mockStudent
    );
    const [isCancellingQueue, setIsCancellingQueue] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

    // Get real-time queue updates
    const { queuePosition, peopleAhead, estimatedWaitMinutes } = useQueueUpdates(
        studentData.currentQueue?.queueNumber || null
    );

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!isAuthenticated || !studentId) {
            navigate('/login');
            return;
        }
    }, [isAuthenticated, studentId, navigate]);

    // Initialize student data with queue data from login
    useEffect(() => {
        if (studentId) {
            const data = getStudentDataById(studentId);
            if (queueData) {
                const newQueueEntry = {
                    id: String(Date.now()),
                    service: queueData.service,
                    queueNumber: queueData.queueNumber,
                    status: "In Progress" as const,
                    timestamp: new Date().toLocaleString(),
                };
                setStudentData({
                    ...data,
                    currentQueue: queueData,
                    queueHistory: [newQueueEntry, ...data.queueHistory],
                });
            } else {
                setStudentData(data);
            }
        }
    }, [studentId, queueData]);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const handleCancelQueue = async () => {
        if (!studentData.currentQueue || isCancellingQueue) {
            return;
        }

        setIsCancellingQueue(true);
        try {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            const currentQueueNumber = studentData.currentQueue.queueNumber;
            setStudentData((prev: StudentData) => {
                const updatedHistory = prev.queueHistory.map((entry) =>
                    entry.queueNumber === currentQueueNumber && entry.status === "In Progress"
                        ? { ...entry, status: "Cancelled" as const }
                        : entry
                );
                return {
                    ...prev,
                    currentQueue: null,
                    queueHistory: updatedHistory,
                };
            });
            toast.info("Your queue has been cancelled successfully.");
        } catch (error) {
            toast.error("Failed to cancel queue. Please try again.");
        } finally {
            setIsCancellingQueue(false);
        }
    };

    const handleRefreshStatus = async () => {
        setIsRefreshing(true);
        try {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            toast.success("Queue status refreshed!");
        } catch (error) {
            toast.error("Failed to refresh status.");
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleJoinNewQueue = () => {
        navigate('/student'); // Navigate back to dashboard to join new queue
    };

    // Calculate progress percentage
    const progressPercentage = studentData.currentQueue
        ? Math.max(10, 100 - (peopleAhead * 20))
        : 0;

    // Don't render if not authenticated
    if (!isAuthenticated || !studentId) {
        return null;
    }

    return (
        <SidebarProvider>
            <AppSidebar onLogout={handleLogout} currentPage="my-queue" />
            <SidebarInset>
                <SiteHeader />
                <main className="flex flex-1 flex-col gap-6 p-4 lg:gap-8 lg:p-6">
                    {/* Page Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">My Queue</h1>
                            <p className="text-muted-foreground">
                                Manage your current queue status and track your position
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={handleRefreshStatus}
                            disabled={isRefreshing}
                            className="gap-2"
                        >
                            <IconRefresh className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>

                    {studentData.currentQueue ? (
                        <>
                            {/* Current Queue Status - Main Card */}
                            <Card className="border-2 border-blue-200 bg-blue-50/50">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-100 rounded-full">
                                                <IconTicket className="h-6 w-6 text-blue-600" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-2xl text-blue-900">
                                                    Queue #{studentData.currentQueue.queueNumber}
                                                </CardTitle>
                                                <CardDescription className="text-blue-700">
                                                    You are currently in the queue
                                                </CardDescription>
                                            </div>
                                        </div>
                                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 px-3 py-1">
                                            <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                                                Active
                                            </div>
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Queue Progress */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Queue Progress</span>
                                            <span className="font-medium">{Math.round(progressPercentage)}% Complete</span>
                                        </div>
                                        <Progress value={progressPercentage} className="h-3" />
                                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                                            <span>Position #{queuePosition}</span>
                                            <span>{peopleAhead} people ahead</span>
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* Queue Details Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <MapPin className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium">Service Point</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {studentData.currentQueue.service}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Phone className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium">SMS Notifications</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        +63{studentData.currentQueue.phoneNumber}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <Clock className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium">Estimated Wait Time</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {estimatedWaitMinutes} minutes remaining
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Users className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium">Queue Position</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        #{queuePosition} in line
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* Action Buttons */}
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <Button
                                            variant="destructive"
                                            onClick={handleCancelQueue}
                                            disabled={isCancellingQueue}
                                            className="flex-1 gap-2"
                                        >
                                            <IconX className="h-4 w-4" />
                                            {isCancellingQueue ? "Cancelling..." : "Cancel Queue"}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={handleRefreshStatus}
                                            disabled={isRefreshing}
                                            className="gap-2"
                                        >
                                            <IconRefresh className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                            Refresh Status
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Important Information */}
                            <Card className="border-amber-200 bg-amber-50/50">
                                <CardContent className="pt-6">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                                        <div className="space-y-2">
                                            <h3 className="font-medium text-amber-900">Important Reminders</h3>
                                            <ul className="text-sm text-amber-800 space-y-1">
                                                <li>• Please stay within the campus premises while in queue</li>
                                                <li>• You will receive SMS notifications when it's almost your turn</li>
                                                <li>• Have your required documents ready for faster service</li>
                                                <li>• If you miss your turn, you may need to rejoin the queue</li>
                                            </ul>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        /* No Active Queue State */
                        <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-6">
                            <div className="p-4 bg-gray-100 rounded-full">
                                <IconTicket className="h-12 w-12 text-gray-400" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-semibold text-gray-900">No Active Queue</h2>
                                <p className="text-muted-foreground max-w-md">
                                    You are not currently in any queue. Join a service queue to track your position and receive updates.
                                </p>
                            </div>
                            <Button onClick={handleJoinNewQueue} className="gap-2">
                                <IconTicket className="h-4 w-4" />
                                Join New Queue
                            </Button>
                        </div>
                    )}

                    {/* Recent Queue Activity */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <IconCheck className="h-5 w-5" />
                                Recent Queue Activity
                            </CardTitle>
                            <CardDescription>
                                Your recent queue entries and their status
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {studentData.queueHistory.slice(0, 3).map((entry) => (
                                    <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${entry.status === "Completed"
                                                ? "bg-green-100"
                                                : entry.status === "In Progress"
                                                    ? "bg-blue-100"
                                                    : "bg-red-100"
                                                }`}>
                                                <IconTicket className={`h-4 w-4 ${entry.status === "Completed"
                                                    ? "text-green-600"
                                                    : entry.status === "In Progress"
                                                        ? "text-blue-600"
                                                        : "text-red-600"
                                                    }`} />
                                            </div>
                                            <div>
                                                <p className="font-medium">{entry.service}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    Queue #{entry.queueNumber} • {entry.timestamp}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className={
                                                entry.status === "Completed"
                                                    ? "bg-green-100 text-green-800 border-green-200"
                                                    : entry.status === "In Progress"
                                                        ? "bg-blue-100 text-blue-800 border-blue-200"
                                                        : "bg-red-100 text-red-800 border-red-200"
                                            }
                                        >
                                            {entry.status}
                                        </Badge>
                                    </div>
                                ))}
                                {studentData.queueHistory.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No queue history found
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}
