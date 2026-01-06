import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

import logo from "@/assets/images/logo.svg"

export default function LoadingPage() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <main className="mx-auto flex max-w-3xl items-center justify-center px-4 py-16">
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
