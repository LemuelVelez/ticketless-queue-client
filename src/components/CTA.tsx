import { useMemo } from "react"
import { Link } from "react-router-dom"

import { useSession } from "@/hooks/use-session"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, QrCode } from "lucide-react"

export default function CTA() {
    const { user, loading } = useSession()
    const dashboardPath = useMemo(() => (user?.role === "ADMIN" ? "/admin/dashboard" : "/staff/dashboard"), [user])

    const showDashboard = !loading && !!user
    const authLabel = showDashboard ? "Dashboard" : "Login"
    const authTo = showDashboard ? dashboardPath : "/login"

    return (
        <section className="pb-16">
            <Card className="overflow-hidden">
                <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                        Ready to go ticketless?
                        <Badge variant="secondary" className="gap-1">
                            <QrCode className="h-3.5 w-3.5" />
                            QR entry
                        </Badge>
                    </CardTitle>
                    <CardDescription>
                        Start with a department display QR and a staff window assignment. Students can join instantly on mobile.
                    </CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                        Tip: Pair a TV/monitor for the public display with a staff workstation for calling and announcements.
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button asChild className="gap-2">
                            <Link to="/join">
                                Join Queue <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>

                        <Button variant="outline" asChild disabled={loading}>
                            <Link to={authTo}>{authLabel}</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </section>
    )
}
