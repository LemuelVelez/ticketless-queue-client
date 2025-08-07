import { useState, useEffect } from "react"; // Added useEffect
import { IconClock, IconTicket, IconUserCircle } from "@tabler/icons-react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { mockStudent, type StudentData, type QueueHistoryEntry } from "@/data/mock-students";
import { mockServices, type Service } from "@/data/mock-services";

// Simulate fetching student data based on ID
// In a real application, this would be an API call
const getStudentDataById = (id: string): StudentData => {
    // For now, we'll just return the mockStudent, but in a real app
    // you'd fetch data specific to the 'id'
    console.log(`Fetching data for student ID: ${id}`); // Log to show it's being used
    return mockStudent;
};

export default function StudentDashboard({ studentId, onLogout }: { studentId: string; onLogout: () => void }) {
    // Initialize studentData using the studentId prop
    const [studentData, setStudentData] = useState<StudentData>(() => getStudentDataById(studentId));
    const [selectedService, setSelectedService] = useState<string>("");
    const [isJoiningQueue, setIsJoiningQueue] = useState<boolean>(false);

    // Optional: If studentId could change and you need to re-fetch data
    useEffect(() => {
        setStudentData(getStudentDataById(studentId));
    }, [studentId]);

    const handleJoinQueue = async () => {
        if (!selectedService) {
            toast.error("Please select a service to join the queue.");
            return;
        }
        setIsJoiningQueue(true);
        // Simulate API call to join queue
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const serviceInfo = mockServices.find((s: Service) => s.id === selectedService);
        if (serviceInfo) {
            const newQueueNumber = `${serviceInfo.name.substring(0, 1)}-${Math.floor(Math.random() * 100) + 1}`;
            const newQueueEntry = {
                service: serviceInfo.name,
                queueNumber: newQueueNumber,
                estimatedWaitTime: serviceInfo.estimatedWaitTime,
                servicePoint: serviceInfo.name,
            };
            setStudentData((prev: StudentData) => ({
                ...prev,
                currentQueue: newQueueEntry,
                queueHistory: [
                    {
                        id: String(prev.queueHistory.length + 1),
                        service: serviceInfo.name,
                        queueNumber: newQueueNumber,
                        status: "In Progress",
                        timestamp: new Date().toLocaleString(),
                    },
                    ...prev.queueHistory,
                ],
            }));
            toast.success(`Successfully joined queue for ${serviceInfo.name}! Your number is ${newQueueNumber}.`);
        } else {
            toast.error("Failed to join queue. Service not found.");
        }
        setIsJoiningQueue(false);
    };

    const handleCancelQueue = async () => {
        setIsJoiningQueue(true); // Reusing for loading state
        await new Promise((resolve) => setTimeout(resolve, 1500));
        if (studentData.currentQueue) {
            setStudentData((prev: StudentData) => {
                const updatedHistory: QueueHistoryEntry[] = prev.queueHistory.map((entry: QueueHistoryEntry) =>
                    entry.queueNumber === prev.currentQueue?.queueNumber && entry.status === "In Progress"
                        ? { ...entry, status: "Cancelled" }
                        : entry
                );
                return {
                    ...prev,
                    currentQueue: null,
                    queueHistory: updatedHistory,
                };
            });
            toast.info("Your current queue has been cancelled.");
        }
        setIsJoiningQueue(false);
    };

    return (
        <SidebarProvider>
            <AppSidebar />
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
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-16 w-16">
                                        <AvatarImage src={studentData.avatar || "/placeholder.svg"} alt={studentData.name} />
                                        <AvatarFallback>{studentData.name.split(" ").map((n: string) => n[0]).join("")}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-2xl font-bold">{studentData.name}</p>
                                        <p className="text-sm text-muted-foreground">{studentData.id}</p>
                                        <p className="text-sm text-muted-foreground">{studentData.email}</p>
                                    </div>
                                </div>
                                <Button variant="outline" className="mt-4 w-full" onClick={onLogout}>
                                    Logout
                                </Button>
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
                                        <p className="text-sm text-muted-foreground">
                                            Service: {studentData.currentQueue.service}
                                        </p>
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
                                            disabled={isJoiningQueue}
                                        >
                                            {isJoiningQueue ? "Cancelling..." : "Cancel Queue"}
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
                                    <Select value={selectedService} onValueChange={setSelectedService}>
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
                                    <Button
                                        onClick={handleJoinQueue}
                                        disabled={!selectedService || isJoiningQueue || !!studentData.currentQueue}
                                    >
                                        {isJoiningQueue ? "Joining..." : "Join Queue"}
                                    </Button>
                                    {studentData.currentQueue && (
                                        <p className="text-sm text-muted-foreground text-center">
                                            You are already in a queue. Please cancel your current queue to join a new one.
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
    );
}
