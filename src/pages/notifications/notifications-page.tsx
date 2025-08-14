"use client"

import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"

import { AppSidebar } from "@/components/student-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

import {
  Bell,
  MessageSquare,
  Ticket,
  Volume2,
  Trash2,
  CheckCheck,
  EyeOff,
  Undo2,
  Settings,
  Megaphone,
  Filter,
} from "lucide-react"

import { mockNotifications, type NotificationItem, type NotificationCategory } from "@/data/mock-notifications"

type FilterKey = "all" | "unread" | NotificationCategory

function categoryIcon(cat: NotificationCategory) {
  switch (cat) {
    case "queue":
      return Ticket
    case "sms":
      return MessageSquare
    case "voiceover":
      return Volume2
    case "system":
    default:
      return Bell
  }
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString()
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { isAuthenticated, studentId } = useAuth()

  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    [...mockNotifications].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
  )
  const [filter, setFilter] = useState<FilterKey>("all")
  const [query, setQuery] = useState("")
  const [prefs, setPrefs] = useState({
    smsEnabled: true,
    voiceoverEnabled: true,
    pushEnabled: false,
  })

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  const filtered = useMemo(() => {
    let list = [...notifications]
    if (filter === "unread") {
      list = list.filter((n) => !n.read)
    } else if (filter !== "all") {
      list = list.filter((n) => n.category === filter)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.message.toLowerCase().includes(q) ||
          (n.meta?.service?.toLowerCase().includes(q) ?? false) ||
          (n.meta?.queueNumber?.toLowerCase().includes(q) ?? false),
      )
    }
    return list
  }, [notifications, filter, query])

  useEffect(() => {
    if (!isAuthenticated || !studentId) {
      navigate("/login")
    }
  }, [isAuthenticated, studentId, navigate])

  if (!isAuthenticated || !studentId) {
    return null
  }

  const markAllRead = () => {
    if (unreadCount === 0) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    toast.success("All notifications marked as read")
  }

  const clearAll = () => {
    if (notifications.length === 0) return
    setNotifications([])
    toast.info("All notifications cleared")
  }

  const toggleRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n)))
  }

  const removeOne = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    toast.success("Notification removed")
  }

  const savePrefs = () => {
    toast.success("Notification preferences saved")
  }

  const testVoiceover = () => {
    const text = "This is a test voice announcement for your queue notification."
    const supports = typeof window !== "undefined" && "speechSynthesis" in window
    if (!supports) {
      toast.error("Voiceover not supported in this browser")
      return
    }
    const utter = new SpeechSynthesisUtterance(text)
    window.speechSynthesis.speak(utter)
  }

  const FilterButton = ({
    label,
    count,
    active,
    onClick,
  }: {
    value: FilterKey
    label: string
    count?: number
    active: boolean
    onClick: () => void
  }) => (
    <Button variant={active ? "secondary" : "ghost"} className="gap-2" onClick={onClick} aria-pressed={active}>
      <span>{label}</span>
      {typeof count === "number" && (
        <Badge variant="outline" className="ml-1">
          {count}
        </Badge>
      )}
    </Button>
  )

  return (
    <SidebarProvider>
      {/* Sidebar uses shadcn/ui primitives that automatically switch to an off-canvas Sheet on mobile for responsiveness. [^4] */}
      <AppSidebar currentPage="notifications" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col gap-6 p-4 lg:gap-8 lg:p-6">
          {/* Page header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
              <p className="text-muted-foreground">
                Stay updated with queue changes, SMS reminders, voiceover events, and system notices.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="gap-2 bg-transparent"
                onClick={markAllRead}
                disabled={unreadCount === 0}
              >
                <CheckCheck className="h-4 w-4" />
                Mark all as read
              </Button>
              <Button variant="destructive" className="gap-2" onClick={clearAll} disabled={notifications.length === 0}>
                <Trash2 className="h-4 w-4" />
                Clear all
              </Button>
            </div>
          </div>

          {/* Filters and search */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
              <CardDescription>
                Filter notifications by status or category and search by service or message.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                <FilterButton
                  value="all"
                  label="All"
                  count={notifications.length}
                  active={filter === "all"}
                  onClick={() => setFilter("all")}
                />
                <FilterButton
                  value="unread"
                  label="Unread"
                  count={unreadCount}
                  active={filter === "unread"}
                  onClick={() => setFilter("unread")}
                />
                <FilterButton
                  value="queue"
                  label="Queue"
                  active={filter === "queue"}
                  onClick={() => setFilter("queue")}
                />
                <FilterButton value="sms" label="SMS" active={filter === "sms"} onClick={() => setFilter("sms")} />
                <FilterButton
                  value="voiceover"
                  label="Voiceover"
                  active={filter === "voiceover"}
                  onClick={() => setFilter("voiceover")}
                />
                <FilterButton
                  value="system"
                  label="System"
                  active={filter === "system"}
                  onClick={() => setFilter("system")}
                />
              </div>
              <div className="w-full md:w-80">
                <Input
                  placeholder="Search by service, queue number, or message..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notifications list */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {filter === "unread" ? "Unread" : "All"} Notifications
              </CardTitle>
              <CardDescription>
                {filtered.length} {filtered.length === 1 ? "item" : "items"} {filter !== "all" ? `in ${filter}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <div className="p-4 bg-gray-100 rounded-full">
                    <Bell className="h-10 w-10 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">No notifications to show</p>
                    <p className="text-sm text-muted-foreground">Try changing the filters or check back later.</p>
                  </div>
                </div>
              ) : (
                filtered.map((n) => {
                  const Icon = categoryIcon(n.category)
                  return (
                    <div
                      key={n.id}
                      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border rounded-md p-4 ${n.read ? "bg-background" : "bg-blue-50/40 dark:bg-blue-900/10"}`}
                      role="article"
                      aria-live="polite"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-full ${n.category === "queue"
                              ? "bg-blue-100 text-blue-700"
                              : n.category === "sms"
                                ? "bg-green-100 text-green-700"
                                : n.category === "voiceover"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-gray-100 text-gray-700"
                            }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{n.title}</p>
                            <Badge variant="outline" className="capitalize">
                              {n.category}
                            </Badge>
                            {!n.read && (
                              <span className="inline-flex h-2 w-2 rounded-full bg-blue-600" aria-label="unread" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {n.meta?.service && (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                                {n.meta.service}
                              </Badge>
                            )}
                            {n.meta?.queueNumber && (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                                #{n.meta.queueNumber}
                              </Badge>
                            )}
                            <span>{formatTime(n.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          className="gap-2 bg-transparent"
                          onClick={() => toggleRead(n.id)}
                          title={n.read ? "Mark as unread" : "Mark as read"}
                        >
                          {n.read ? <Undo2 className="h-4 w-4" /> : <CheckCheck className="h-4 w-4" />}
                          <span className="hidden sm:inline">{n.read ? "Mark unread" : "Mark read"}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          className="gap-2 text-red-600 hover:text-red-700"
                          onClick={() => removeOne(n.id)}
                          title="Remove notification"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="hidden sm:inline">Remove</span>
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card className="border-2 border-blue-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose how you want to receive updates and try a sample voice announcement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-start justify-between gap-4 rounded-md border p-4">
                  <div className="space-y-1">
                    <Label htmlFor="sms" className="text-sm font-medium">
                      SMS Updates
                    </Label>
                    <p className="text-sm text-muted-foreground">Receive text messages about your queue.</p>
                  </div>
                  <Switch
                    id="sms"
                    checked={prefs.smsEnabled}
                    onCheckedChange={(v) => setPrefs((p) => ({ ...p, smsEnabled: v }))}
                  />
                </div>

                <div className="flex items-start justify-between gap-4 rounded-md border p-4">
                  <div className="space-y-1">
                    <Label htmlFor="voiceover" className="text-sm font-medium">
                      Voiceover Announcements
                    </Label>
                    <p className="text-sm text-muted-foreground">Audio announcements when your number is called.</p>
                  </div>
                  <Switch
                    id="voiceover"
                    checked={prefs.voiceoverEnabled}
                    onCheckedChange={(v) => setPrefs((p) => ({ ...p, voiceoverEnabled: v }))}
                  />
                </div>

                <div className="flex items-start justify-between gap-4 rounded-md border p-4">
                  <div className="space-y-1">
                    <Label htmlFor="push" className="text-sm font-medium">
                      Push Notifications
                    </Label>
                    <p className="text-sm text-muted-foreground">Browser push notifications (coming soon).</p>
                  </div>
                  <Switch
                    id="push"
                    checked={prefs.pushEnabled}
                    onCheckedChange={(v) => setPrefs((p) => ({ ...p, pushEnabled: v }))}
                  />
                </div>

                <div className="flex items-start justify-between gap-4 rounded-md border p-4">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Test Voiceover</Label>
                    <p className="text-sm text-muted-foreground">
                      Play a sample announcement using your browser’s TTS.
                    </p>
                  </div>
                  <Button variant="outline" className="gap-2 bg-transparent" onClick={testVoiceover}>
                    <Megaphone className="h-4 w-4" />
                    Test
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  className="gap-2 bg-transparent"
                  onClick={() => {
                    setPrefs({ smsEnabled: true, voiceoverEnabled: true, pushEnabled: false })
                    toast.info("Preferences reset")
                  }}
                >
                  <Undo2 className="h-4 w-4" />
                  Reset
                </Button>
                <Button className="gap-2" onClick={savePrefs}>
                  <CheckCheck className="h-4 w-4" />
                  Save Preferences
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Push notifications are supported by modern browsers and platforms when configured properly. See platform
                guidance for Web Push implementation details. [^1][^2]
              </p>
            </CardContent>
          </Card>

          {/* Info */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <EyeOff className="h-4 w-4 mt-0.5" />
            <p>Unread notifications are highlighted. Mark them as read to dim the highlight.</p>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
