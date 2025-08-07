import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage({ onLoginSuccess }: { onLoginSuccess: (studentId: string) => void }) {
    const [studentId, setStudentId] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1500));

        if (studentId === "12345") {
            toast.success("Login successful!");
            onLoginSuccess(studentId);
        } else {
            toast.error("Invalid Student ID. Please try again.");
        }
        setLoading(false);
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 to-background p-4">
            <Card className="w-full max-w-sm shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">Student Login</CardTitle>
                    <CardDescription>Enter your Student ID to generate a queue number.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="studentId">Student ID</Label>
                            <Input
                                id="studentId"
                                type="text"
                                placeholder="e.g., 2021-0001"
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Processing..." : "Generate Queue Number"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
