import { Link } from "react-router-dom"

import { useSession } from "@/hooks/use-session"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

import logo from "@/assets/images/logo.svg"

export default function NotFoundPage() {
    const { user, loading } = useSession()
    const dashboardPath = user?.role === "ADMIN" ? "/admin/dashboard" : "/staff/dashboard"

    const showDashboard = !loading && !!user
    const authLabel = showDashboard ? "Dashboard" : "Login"
    const authTo = showDashboard ? dashboardPath : "/login"

    return (
        <div className="min-h-screen bg-background text-foreground">
            <main className="mx-auto flex max-w-3xl items-center justify-center px-4 py-16">
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <img src={logo} alt="QueuePass logo" className="h-12 w-12" />
                                <span>Page not found</span>
                            </div>
                            <Badge variant="secondary">404</Badge>
                        </CardTitle>
                        <CardDescription>
                            The page you’re looking for doesn’t exist or may have been moved.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="grid gap-4">
                        <div className="rounded-lg border p-4">
                            <div className="text-6xl font-semibold tracking-tight">404</div>
                            <p className="mt-2 text-sm text-muted-foreground">
                                If you typed the address, double-check the URL. Otherwise, use one of the actions below.
                            </p>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button asChild>
                                <Link to="/">Go to Landing</Link>
                            </Button>

                            <Button variant="outline" asChild>
                                <a href="/join">Join Queue</a>
                            </Button>

                            <Button variant="ghost" asChild disabled={loading}>
                                <Link to={authTo}>{authLabel}</Link>
                            </Button>
                        </div>

                        <div className="text-xs text-muted-foreground">
                            QueuePass • Ticketless Student ID Queue Management
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
