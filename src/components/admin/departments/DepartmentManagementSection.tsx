import { Link } from "react-router-dom"
import {
    MoreHorizontal,
    Plus,
    RefreshCw,
    FolderTree,
    LayoutGrid,
    Trash2,
} from "lucide-react"

import type {
    Department,
    ServiceWindow,
} from "@/components/admin/departments/types"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { DEFAULT_MANAGER } from "@/components/admin/departments/constants"
import {
    normalizeManagerKey,
    prettyManager,
    statusBadge,
} from "@/components/admin/departments/utils"

type DepartmentStatusTab = "all" | "enabled" | "disabled"

type DepartmentStats = {
    deptTotal: number
    deptEnabled: number
    deptDisabled: number
    winTotal: number
}

type DepartmentManagementSectionProps = {
    loading: boolean
    saving: boolean
    stats: DepartmentStats
    deptQ: string
    onDeptQChange: (value: string) => void
    deptManagerFilter: string
    onDeptManagerFilterChange: (value: string) => void
    managerOptions: string[]
    deptStatusTab: DepartmentStatusTab
    onDeptStatusTabChange: (value: DepartmentStatusTab) => void
    deptRows: Department[]
    windowsByDept: Map<string, ServiceWindow[]>
    onRefresh: () => void
    onCreate: () => void
    onEdit: (department: Department) => void
    onDelete: (department: Department) => void
}

export function DepartmentManagementSection({
    loading,
    saving,
    stats,
    deptQ,
    onDeptQChange,
    deptManagerFilter,
    onDeptManagerFilterChange,
    managerOptions,
    deptStatusTab,
    onDeptStatusTabChange,
    deptRows,
    windowsByDept,
    onRefresh,
    onCreate,
    onEdit,
    onDelete,
}: DepartmentManagementSectionProps) {
    return (
        <Card className="min-w-0">
            <CardHeader className="gap-2">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                        <CardTitle>Department Management</CardTitle>
                        <CardDescription>
                            Create, update, and organize departments while assigning a transaction manager key.
                        </CardDescription>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <Button
                            variant="outline"
                            onClick={onRefresh}
                            disabled={loading || saving}
                            className="w-full gap-2 sm:w-auto"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Refresh
                        </Button>

                        <Button onClick={onCreate} disabled={saving} className="w-full gap-2 sm:w-auto">
                            <Plus className="h-4 w-4" />
                            New department
                        </Button>

                        <Button asChild variant="secondary" className="w-full gap-2 sm:w-auto">
                            <Link to="/admin/windows">
                                <LayoutGrid className="h-4 w-4" />
                                Manage windows
                            </Link>
                        </Button>
                    </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="secondary">Depts: {stats.deptTotal}</Badge>
                        <Badge variant="default">Enabled: {stats.deptEnabled}</Badge>
                        <Badge variant="secondary">Disabled: {stats.deptDisabled}</Badge>
                        <Badge variant="secondary">Windows: {stats.winTotal}</Badge>
                    </div>

                    <div className="flex items-center gap-2">
                        <FolderTree className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Manager hierarchy enabled</span>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="min-w-0">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center">
                        <Input
                            value={deptQ}
                            onChange={(e) => onDeptQChange(e.target.value)}
                            placeholder="Search departments…"
                            className="w-full min-w-0 md:w-80"
                        />

                        <Select value={deptManagerFilter} onValueChange={onDeptManagerFilterChange}>
                            <SelectTrigger className="w-full min-w-0 md:w-80">
                                <SelectValue placeholder="Filter by manager" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All managers</SelectItem>
                                {managerOptions.map((manager) => (
                                    <SelectItem key={manager} value={manager}>
                                        {prettyManager(manager)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Tabs
                        value={deptStatusTab}
                        onValueChange={(value) => onDeptStatusTabChange(value as DepartmentStatusTab)}
                        className="w-full md:w-auto"
                    >
                        <TabsList className="grid w-full grid-cols-3 md:w-80">
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="enabled">Enabled</TabsTrigger>
                            <TabsTrigger value="disabled">Disabled</TabsTrigger>
                        </TabsList>
                        <TabsContent value={deptStatusTab} />
                    </Tabs>
                </div>

                <div className="mt-4">
                    {loading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead className="hidden md:table-cell">Code</TableHead>
                                        <TableHead className="hidden lg:table-cell">Manager</TableHead>
                                        <TableHead className="hidden lg:table-cell">Windows</TableHead>
                                        <TableHead className="text-right">Status</TableHead>
                                        <TableHead className="w-14" />
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {deptRows.map((dept) => {
                                        const winCount = (windowsByDept.get(dept._id) ?? []).length
                                        const manager = normalizeManagerKey(dept.transactionManager || DEFAULT_MANAGER)

                                        return (
                                            <TableRow key={dept._id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex min-w-0 flex-col">
                                                        <span className="truncate">{dept.name}</span>
                                                        <span className="truncate text-xs text-muted-foreground md:hidden">
                                                            {dept.code || "—"} · {prettyManager(manager)}
                                                        </span>
                                                    </div>
                                                </TableCell>

                                                <TableCell className="hidden md:table-cell">
                                                    <span className="text-muted-foreground">{dept.code || "—"}</span>
                                                </TableCell>

                                                <TableCell className="hidden lg:table-cell">
                                                    <Badge variant="outline">{prettyManager(manager)}</Badge>
                                                </TableCell>

                                                <TableCell className="hidden lg:table-cell">
                                                    <span className="text-muted-foreground">{winCount}</span>
                                                </TableCell>

                                                <TableCell className="text-right">{statusBadge(dept.enabled)}</TableCell>

                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" aria-label="Row actions">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>

                                                        <DropdownMenuContent align="end" className="w-52">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onClick={() => onEdit(dept)}
                                                                className="cursor-pointer"
                                                            >
                                                                Edit department
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => onDelete(dept)}
                                                                className="cursor-pointer text-destructive focus:text-destructive"
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete department
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}

                                    {deptRows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                                                No departments match your filters.
                                            </TableCell>
                                        </TableRow>
                                    ) : null}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}