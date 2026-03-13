import { Link } from "react-router-dom"
import {
    Building2,
    ClipboardList,
    MoreHorizontal,
    Plus,
    RefreshCw,
    Save,
    Trash2,
} from "lucide-react"

import type {
    Department,
    TransactionPurpose,
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
    purposeDepartmentText,
    purposeScopeBadges,
    statusBadge,
} from "@/components/admin/departments/utils"

type PurposeStatusTab = "all" | "enabled" | "disabled"

type PurposeStats = {
    purposeTotal: number
    purposeEnabled: number
    purposeDisabled: number
}

type PurposeManagementSectionProps = {
    loading: boolean
    saving: boolean
    stats: PurposeStats
    purposeQ: string
    onPurposeQChange: (value: string) => void
    purposeManagerFilter: string
    onPurposeManagerFilterChange: (value: string) => void
    purposeScopeFilter: string
    onPurposeScopeFilterChange: (value: string) => void
    purposeDeptFilter: string
    onPurposeDeptFilterChange: (value: string) => void
    purposeStatusTab: PurposeStatusTab
    onPurposeStatusTabChange: (value: PurposeStatusTab) => void
    managerOptions: string[]
    departments: Department[]
    purposeRows: TransactionPurpose[]
    deptById: Map<string, Department>
    onRefresh: () => void
    onCreate: () => void
    onEditAll: () => void
    onSaveDefaults: () => void
    onEdit: (purpose: TransactionPurpose) => void
    onDelete: (purpose: TransactionPurpose) => void
}

export function PurposeManagementSection({
    loading,
    saving,
    stats,
    purposeQ,
    onPurposeQChange,
    purposeManagerFilter,
    onPurposeManagerFilterChange,
    purposeScopeFilter,
    onPurposeScopeFilterChange,
    purposeDeptFilter,
    onPurposeDeptFilterChange,
    purposeStatusTab,
    onPurposeStatusTabChange,
    managerOptions,
    departments,
    purposeRows,
    deptById,
    onRefresh,
    onCreate,
    onEditAll,
    onSaveDefaults,
    onEdit,
    onDelete,
}: PurposeManagementSectionProps) {
    return (
        <Card className="min-w-0">
            <CardHeader className="gap-2">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                        <CardTitle>Transaction Purpose Management</CardTitle>
                        <CardDescription>
                            Configure queue transaction purposes by manager category and department scope.
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
                            New purpose
                        </Button>

                        <Button
                            variant="outline"
                            onClick={onEditAll}
                            disabled={loading || saving || purposeRows.length === 0}
                            className="w-full gap-2 sm:w-auto"
                        >
                            <ClipboardList className="h-4 w-4" />
                            Edit all transactions
                        </Button>

                        <Button
                            variant="secondary"
                            onClick={onSaveDefaults}
                            disabled={loading || saving}
                            className="w-full gap-2 sm:w-auto"
                        >
                            <Save className="h-4 w-4" />
                            Save registrar defaults
                        </Button>

                        <Button asChild variant="secondary" className="w-full gap-2 sm:w-auto">
                            <Link to="/admin/departments">
                                <Building2 className="h-4 w-4" />
                                View departments
                            </Link>
                        </Button>
                    </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="secondary">Purposes: {stats.purposeTotal}</Badge>
                        <Badge variant="default">Enabled: {stats.purposeEnabled}</Badge>
                        <Badge variant="secondary">Disabled: {stats.purposeDisabled}</Badge>
                    </div>

                    <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Department-aware transactions</span>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="min-w-0">
                <div className="flex flex-col gap-3">
                    <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center">
                        <Input
                            value={purposeQ}
                            onChange={(e) => onPurposeQChange(e.target.value)}
                            placeholder="Search purpose key / label…"
                            className="w-full min-w-0 md:w-80"
                        />

                        <Select value={purposeManagerFilter} onValueChange={onPurposeManagerFilterChange}>
                            <SelectTrigger className="w-full min-w-0 md:w-64">
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

                        <Select value={purposeScopeFilter} onValueChange={onPurposeScopeFilterChange}>
                            <SelectTrigger className="w-full min-w-0 md:w-56">
                                <SelectValue placeholder="Filter by scope" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All scopes</SelectItem>
                                <SelectItem value="INTERNAL">Internal</SelectItem>
                                <SelectItem value="EXTERNAL">External</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={purposeDeptFilter} onValueChange={onPurposeDeptFilterChange}>
                            <SelectTrigger className="w-full min-w-0 md:w-72">
                                <SelectValue placeholder="Filter by department" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All department bindings</SelectItem>
                                <SelectItem value="__all_departments__">Global (all departments)</SelectItem>
                                {departments.map((dept) => (
                                    <SelectItem key={dept._id} value={dept._id}>
                                        {dept.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Tabs
                        value={purposeStatusTab}
                        onValueChange={(value) => onPurposeStatusTabChange(value as PurposeStatusTab)}
                        className="w-full md:w-auto"
                    >
                        <TabsList className="grid w-full grid-cols-3 md:w-80">
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="enabled">Enabled</TabsTrigger>
                            <TabsTrigger value="disabled">Disabled</TabsTrigger>
                        </TabsList>
                        <TabsContent value={purposeStatusTab} />
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
                                        <TableHead>Purpose</TableHead>
                                        <TableHead className="hidden md:table-cell">Manager</TableHead>
                                        <TableHead className="hidden lg:table-cell">Scope</TableHead>
                                        <TableHead className="hidden lg:table-cell">Department binding</TableHead>
                                        <TableHead className="text-right">Status</TableHead>
                                        <TableHead className="w-14" />
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {purposeRows.map((purpose) => {
                                        const category = normalizeManagerKey(purpose.category || DEFAULT_MANAGER)

                                        return (
                                            <TableRow key={purpose.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex min-w-0 flex-col">
                                                        <span className="truncate">{purpose.label}</span>
                                                        <span className="truncate text-xs text-muted-foreground">
                                                            {purpose.key} · sort {purpose.sortOrder}
                                                        </span>
                                                        <span className="truncate text-xs text-muted-foreground md:hidden">
                                                            {prettyManager(category)}
                                                        </span>
                                                    </div>
                                                </TableCell>

                                                <TableCell className="hidden md:table-cell">
                                                    <Badge variant="outline">{prettyManager(category)}</Badge>
                                                </TableCell>

                                                <TableCell className="hidden lg:table-cell">
                                                    {purposeScopeBadges(purpose.scopes || [])}
                                                </TableCell>

                                                <TableCell className="hidden lg:table-cell">
                                                    {purposeDepartmentText(purpose, deptById)}
                                                </TableCell>

                                                <TableCell className="text-right">{statusBadge(purpose.enabled)}</TableCell>

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
                                                                onClick={() => onEdit(purpose)}
                                                                className="cursor-pointer"
                                                            >
                                                                Edit purpose
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => onDelete(purpose)}
                                                                className="cursor-pointer text-destructive focus:text-destructive"
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete purpose
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}

                                    {purposeRows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                                                No transaction purposes match your filters.
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