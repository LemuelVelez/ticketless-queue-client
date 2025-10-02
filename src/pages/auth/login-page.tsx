import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Building2, Clock, MessageSquare, Phone } from 'lucide-react';

const servicePoints = [
    { id: "registrar", name: "Registrar's Office", description: "Transcripts, Enrollment, Records", icon: "📋", estimatedWait: "15-20 min" },
    { id: "cashier", name: "Cashier", description: "Payments, Fees, Receipts", icon: "💰", estimatedWait: "10-15 min" },
    { id: "library", name: "Library", description: "Book Borrowing, Returns", icon: "📚", estimatedWait: "5-10 min" },
    { id: "clinic", name: "Campus Clinic", description: "Medical Consultations", icon: "🏥", estimatedWait: "20-25 min" },
    { id: "nstp", name: "NSTP Office", description: "NSTP Processing, Requirements", icon: "🎯", estimatedWait: "10-15 min" },
    { id: "rotc", name: "ROTC Office", description: "ROTC Processing, Requirements", icon: "🎖️", estimatedWait: "10-15 min" }
];

/** ---------------- Orderly Queue Helpers (per-service, resets daily) ---------------- */
const QUEUE_DATE_KEY = "queue_counter_date";
const COUNTER_PREFIX = "queue_counter_";

function todayISO(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function ensureCounterDateFresh() {
    try {
        const today = todayISO();
        const saved = localStorage.getItem(QUEUE_DATE_KEY);
        if (saved !== today) {
            // Clear all service counters when the date changes
            const keysToClear: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(COUNTER_PREFIX)) keysToClear.push(k);
            }
            keysToClear.forEach((k) => localStorage.removeItem(k));
            localStorage.setItem(QUEUE_DATE_KEY, today);
        }
    } catch {
        // Fallback: if localStorage not available, do nothing (still returns formatted number starting from 1 each run)
    }
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
        // If localStorage fails, just return first in sequence
        return `${prefix}-001`;
    }
}
/** ------------------------------------------------------------------------------- */

export default function LoginPage() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [studentId, setStudentId] = useState("");
    const [selectedService, setSelectedService] = useState("");
    // Phone input ALWAYS starts with '9' and keeps up to 10 digits total (9 + 9 more)
    const [phoneNumber, setPhoneNumber] = useState("9");
    const [loading, setLoading] = useState(false);

    const handleBack = () => {
        navigate('/');
    };

    // Normalize to a 10-digit number starting with 9.
    // Handles pastes like "+639123456789", "09123456789", "9123456789", etc.
    const normalizeWithLeading9 = (value: string) => {
        let d = value.replace(/\D/g, "");
        if (d.startsWith("63")) d = d.slice(2);
        if (d.startsWith("0")) d = d.slice(1);
        if (!d.startsWith("9")) d = "9" + d;
        if (d.length > 10) d = d.slice(0, 10);
        if (d.length < 1) d = "9"; // ensure the leading 9 remains
        return d;
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhoneNumber(normalizeWithLeading9(e.target.value));
    };

    // Prevent deleting the first '9'
    const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const input = e.currentTarget;
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? 0;

        if (
            (e.key === "Backspace" && start <= 1 && end <= 1) ||
            (e.key === "Delete" && start === 0) ||
            (start === 0 && end > 0 && (e.key === "Backspace" || e.key === "Delete" || e.key.length === 1))
        ) {
            e.preventDefault();
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedService) {
            toast.error("Please select a service point.");
            return;
        }

        // Validate Student ID: TC-20-A-00123 (pattern: AA-YY-A-#####)
        const studentIdPattern = /^[A-Z]{2}-\d{2}-[A-Z]-\d{5}$/;
        if (!studentIdPattern.test(studentId)) {
            toast.error("Invalid Student ID format. Please use format: TC-20-A-00123");
            return;
        }

        // Validate phone: must be exactly 10 digits and start with 9
        const phonePattern = /^9\d{9}$/;
        if (!phonePattern.test(phoneNumber)) {
            toast.error("Invalid mobile number. It should be 10 digits after +63 (starts with 9).");
            return;
        }

        setLoading(true);

        // Simulate API call for student verification and queue generation
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const selectedServicePoint = servicePoints.find(sp => sp.id === selectedService);
        if (selectedServicePoint) {
            // >>> ORDERLY (SEQUENTIAL) NUMBER INSTEAD OF RANDOM
            const queueNumber = getNextQueueNumber(selectedServicePoint.id, selectedServicePoint.name);
            const fullE164 = `+63${phoneNumber}`;
            const queueData = {
                service: selectedServicePoint.name,
                queueNumber: queueNumber,
                estimatedWaitTime: selectedServicePoint.estimatedWait,
                servicePoint: selectedServicePoint.name,
                phoneNumber: fullE164,
            };

            toast.success(
                `Queue number generated successfully! Your number is ${queueNumber} for ${selectedServicePoint.name}. SMS notification sent to ${fullE164}.`
            );

            // Use auth context to login and navigate to dashboard
            login(studentId, queueData);
            navigate('/student');
        }

        setLoading(false);
    };

    const selectedServicePoint = servicePoints.find(sp => sp.id === selectedService);
    const year = new Date(Date.now()).getFullYear();

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4">
            {/* Header */}
            <div className="max-w-md mx-auto pt-4 mb-6">
                <Button
                    variant="ghost"
                    onClick={handleBack}
                    className="mb-4 text-gray-600 hover:text-gray-900 cursor-pointer"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Welcome
                </Button>
                <div className="text-center">
                    <h1 className="text-xl font-bold text-gray-900">JRMSU Queue Management</h1>
                    <p className="text-sm text-gray-600">Generate Your Queue Number</p>
                </div>
            </div>

            {/* Main Form Card */}
            <div className="flex justify-center">
                <Card className="w-full max-w-md shadow-xl border-0 bg-white/90 backdrop-blur-sm">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold text-gray-900">Student Queue Registration</CardTitle>
                        <CardDescription className="text-gray-600">
                            Enter your details to join the service queue
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-6">
                            {/* Student ID Input */}
                            <div className="space-y-2">
                                <Label htmlFor="studentId" className="text-sm font-medium text-gray-700">
                                    Student ID <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="studentId"
                                    type="text"
                                    placeholder="TC-20-A-00123"
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                                    required
                                    className="text-center font-mono text-lg"
                                    pattern="^[A-Z]{2}-\d{2}-[A-Z]-\d{5}$"
                                    title="Use this exact format: TC-20-A-00123"
                                    autoCapitalize="characters"
                                />
                                <p className="text-xs text-gray-500">Format: <span className="font-mono">TC-20-A-00123</span></p>
                            </div>

                            {/* Service Point Selection */}
                            <div className="space-y-2">
                                <Label htmlFor="service" className="text-sm font-medium text-gray-700">
                                    Select Service Point <span className="text-red-500">*</span>
                                </Label>
                                <Select value={selectedService} onValueChange={setSelectedService} required>
                                    <SelectTrigger className="cursor-pointer">
                                        <SelectValue placeholder="Choose your service point" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {servicePoints.map((service) => (
                                            <SelectItem key={service.id} value={service.id}>
                                                <div className="flex items-center gap-2 cursor-pointer">
                                                    <span>{service.icon}</span>
                                                    <div>
                                                        <p className="font-medium">{service.name}</p>
                                                        <p className="text-xs text-gray-500">{service.description}</p>
                                                    </div>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Mobile Number Input */}
                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
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
                                        className="rounded-l-none"
                                        aria-label="Philippine mobile number starting with 9"
                                        title="+63 followed by 10 digits starting with 9"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <MessageSquare className="h-4 w-4" />
                                    SMS notifications will be sent to this number
                                </p>
                            </div>

                            {/* Service Point Info */}
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
                                        <span>Estimated wait time: {selectedServicePoint.estimatedWait}</span>
                                    </div>
                                </div>
                            )}

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold cursor-pointer"
                                disabled={loading}
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Generating Queue Number...
                                    </div>
                                ) : (
                                    "Generate Queue Number"
                                )}
                            </Button>

                            {/* Info Text */}
                            <div className="text-center space-y-2">
                                <p className="text-xs text-gray-500">
                                    You will receive SMS notifications about your queue status
                                </p>
                                <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
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
                        </form>
                    </CardContent>
                </Card>
            </div>

            {/* Footer */}
            <div className="text-center mt-8 text-xs text-gray-500">
                <p>© {year} Jose Rizal Memorial State University</p>
                <p>Ticketless Queue Management System</p>
            </div>
        </div >
    );
}
