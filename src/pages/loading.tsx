import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

import logo from "@/assets/images/logo.svg"

export default function LoadingPage() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* ✅ Mobile-only UI (xs): logo on top + vertical stack */}
            <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:hidden">
                <Card className="w-full max-w-sm">
                    <CardHeader className="space-y-3 text-center">
                        <div className="flex justify-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-lg border bg-card">
                                <img
                                    src={logo}
                                    alt="QueuePass logo"
                                    className="h-10 w-10"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <CardTitle className="text-base">Loading QueuePass</CardTitle>
                            <CardDescription className="text-xs">
                                We’re preparing your queue experience.
                            </CardDescription>
                        </div>

                        <div className="flex justify-center">
                            <Badge variant="secondary" className="max-w-full whitespace-normal">
                                Please wait
                            </Badge>
                        </div>
                    </CardHeader>

                    <CardContent className="grid gap-4">
                        <div className="rounded-lg border p-4">
                            <Skeleton className="h-9 w-32" />
                            <div className="mt-3 grid gap-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-11/12" />
                                <Skeleton className="h-4 w-9/12" />
                            </div>
                        </div>

                        <Separator />

                        <div className="grid gap-2">
                            <Skeleton className="h-4 w-4/5" />
                            <Skeleton className="h-4 w-3/5" />
                        </div>

                        <div className="grid gap-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>

                        <div className="text-xs text-muted-foreground text-center">
                            Tip: Keep this page open—queue status can update in real time.
                        </div>
                    </CardContent>
                </Card>
            </main>

            {/* ✅ Desktop UI (sm+) — unchanged */}
            <main className="mx-auto hidden  items-center justify-center px-4 py-16 sm:flex">
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <img
                                    src={logo}
                                    alt="QueuePass logo"
                                    className="h-15 w-15"
                                />
                                <span>Loading QueuePass</span>
                            </div>
                            <Badge variant="secondary">Please wait</Badge>
                        </CardTitle>
                        <CardDescription>
                            We’re preparing your queue experience.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="grid gap-4">
                        <div className="rounded-lg border p-4">
                            <Skeleton className="h-10 w-40" />
                            <div className="mt-3 grid gap-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-11/12" />
                                <Skeleton className="h-4 w-9/12" />
                            </div>
                        </div>

                        <Separator />

                        <div className="grid gap-2">
                            <Skeleton className="h-4 w-60" />
                            <Skeleton className="h-4 w-70" />
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>

                        <div className="text-xs text-muted-foreground">
                            Tip: Keep this page open—queue status and displays can update in real time.
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
