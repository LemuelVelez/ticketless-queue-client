import { Save } from "lucide-react"

import type {
    Department,
    TransactionPurpose,
    TransactionScope,
} from "@/components/admin/departments/types"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import type { PurposeBulkDraft } from "@/components/admin/departments/constants"
import { safeInt, statusBadge } from "@/components/admin/departments/utils"

type ManagerCategoryOption = {
    value: string
    label: string
}

function getManagerCategoryOptions(
    enabledDepartments: Department[],
    currentCategory: string
): ManagerCategoryOption[] {
    const seen = new Set<string>()
    const options: ManagerCategoryOption[] = []

    for (const dept of enabledDepartments) {
        const value = (dept.code?.trim() || dept.name?.trim() || "").trim()
        if (!value || seen.has(value)) continue

        seen.add(value)
        options.push({
            value,
            label: dept.code?.trim() ? `${dept.name} (${dept.code})` : dept.name,
        })
    }

    const trimmedCurrentCategory = currentCategory.trim()
    if (trimmedCurrentCategory && !seen.has(trimmedCurrentCategory)) {
        options.unshift({
            value: trimmedCurrentCategory,
            label: trimmedCurrentCategory,
        })
    }

    return options
}

type PurposeFormFieldsProps = {
    idPrefix: string
    category: string
    onCategoryChange: (value: string) => void
    purposeKey: string
    onPurposeKeyChange: (value: string) => void
    label: string
    onLabelChange: (value: string) => void
    scopes: TransactionScope[]
    onScopeToggle: (scope: TransactionScope, checked: boolean) => void
    sortOrder: number
    onSortOrderChange: (value: number) => void
    applyToAllDepartments: boolean
    onApplyToAllDepartmentsChange: (value: boolean) => void
    departmentIds: string[]
    onDepartmentToggle: (deptId: string, checked: boolean) => void
    enabled: boolean
    onEnabledChange: (value: boolean) => void
    enabledDepartments: Department[]
}

function PurposeFormFields({
    idPrefix,
    category,
    onCategoryChange,
    purposeKey,
    onPurposeKeyChange,
    label,
    onLabelChange,
    scopes,
    onScopeToggle,
    sortOrder,
    onSortOrderChange,
    applyToAllDepartments,
    onApplyToAllDepartmentsChange,
    departmentIds,
    onDepartmentToggle,
    enabled,
    onEnabledChange,
    enabledDepartments,
}: PurposeFormFieldsProps) {
    const managerCategoryOptions = getManagerCategoryOptions(enabledDepartments, category)

    return (
        <div className="grid gap-4">
            <div className="grid gap-2 md:grid-cols-2 md:gap-4">
                <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-category`}>Manager category</Label>
                    <Select
                        value={category.trim() || undefined}
                        onValueChange={onCategoryChange}
                        disabled={managerCategoryOptions.length === 0}
                    >
                        <SelectTrigger id={`${idPrefix}-category`}>
                            <SelectValue placeholder="Select manager category" />
                        </SelectTrigger>
                        <SelectContent>
                            {managerCategoryOptions.length === 0 ? (
                                <SelectItem value="__no-manager-category__" disabled>
                                    No manager categories available
                                </SelectItem>
                            ) : (
                                managerCategoryOptions.map((option) => (
                                    <SelectItem key={`${idPrefix}-category-${option.value}`} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-key`}>Key</Label>
                    <Input
                        id={`${idPrefix}-key`}
                        value={purposeKey}
                        onChange={(e) => onPurposeKeyChange(e.target.value)}
                        placeholder="e.g., issuance-tor"
                    />
                </div>
            </div>

            <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-label`}>Label</Label>
                <Input
                    id={`${idPrefix}-label`}
                    value={label}
                    onChange={(e) => onLabelChange(e.target.value)}
                    placeholder="e.g., Issuance of Transcript of Records (TOR)"
                />
            </div>

            <div className="grid gap-2 md:grid-cols-2 md:gap-4">
                <div className="grid gap-2">
                    <Label>Scopes</Label>
                    <div className="flex flex-wrap gap-4 rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id={`${idPrefix}-scope-internal`}
                                checked={scopes.includes("INTERNAL")}
                                onCheckedChange={(checked) => onScopeToggle("INTERNAL", checked === true)}
                            />
                            <Label
                                htmlFor={`${idPrefix}-scope-internal`}
                                className="cursor-pointer text-sm font-normal"
                            >
                                Internal
                            </Label>
                        </div>

                        <div className="flex items-center gap-2">
                            <Checkbox
                                id={`${idPrefix}-scope-external`}
                                checked={scopes.includes("EXTERNAL")}
                                onCheckedChange={(checked) => onScopeToggle("EXTERNAL", checked === true)}
                            />
                            <Label
                                htmlFor={`${idPrefix}-scope-external`}
                                className="cursor-pointer text-sm font-normal"
                            >
                                External
                            </Label>
                        </div>
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-sort-order`}>Sort order</Label>
                    <Input
                        id={`${idPrefix}-sort-order`}
                        type="number"
                        value={String(sortOrder)}
                        onChange={(e) => onSortOrderChange(safeInt(e.target.value, 1000))}
                    />
                </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="grid gap-0.5">
                    <div className="text-sm font-medium">Apply to all departments</div>
                    <div className="text-xs text-muted-foreground">
                        Turn off to bind this purpose to selected departments only.
                    </div>
                </div>
                <Switch checked={applyToAllDepartments} onCheckedChange={onApplyToAllDepartmentsChange} />
            </div>

            {!applyToAllDepartments ? (
                <div className="grid gap-2">
                    <Label>Departments</Label>
                    <div className="max-h-48 overflow-y-auto rounded-lg border p-2">
                        {enabledDepartments.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No enabled departments found.</p>
                        ) : (
                            <div className="grid gap-1">
                                {enabledDepartments.map((dept) => {
                                    const checkboxId = `${idPrefix}-dept-${dept._id}`

                                    return (
                                        <div
                                            key={checkboxId}
                                            className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50"
                                        >
                                            <Checkbox
                                                id={checkboxId}
                                                checked={departmentIds.includes(dept._id)}
                                                onCheckedChange={(checked) =>
                                                    onDepartmentToggle(dept._id, checked === true)
                                                }
                                            />
                                            <Label htmlFor={checkboxId} className="cursor-pointer text-sm font-normal">
                                                {dept.name}
                                            </Label>
                                            <span className="text-xs text-muted-foreground">
                                                {dept.code ? `(${dept.code})` : ""}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            ) : null}

            <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="grid gap-0.5">
                    <div className="text-sm font-medium">Enabled</div>
                    <div className="text-xs text-muted-foreground">
                        Disabled purposes are hidden from queue selection.
                    </div>
                </div>
                <Switch checked={enabled} onCheckedChange={onEnabledChange} />
            </div>
        </div>
    )
}

type PurposeDialogsProps = {
    enabledDepartments: Department[]
    saving: boolean

    createOpen: boolean
    onCreateOpenChange: (open: boolean) => void
    cPurposeCategory: string
    onCPurposeCategoryChange: (value: string) => void
    cPurposeKey: string
    onCPurposeKeyChange: (value: string) => void
    cPurposeLabel: string
    onCPurposeLabelChange: (value: string) => void
    cPurposeScopes: TransactionScope[]
    onCPurposeScopeToggle: (scope: TransactionScope, checked: boolean) => void
    cPurposeSortOrder: number
    onCPurposeSortOrderChange: (value: number) => void
    cPurposeApplyAllDepartments: boolean
    onCPurposeApplyAllDepartmentsChange: (value: boolean) => void
    cPurposeDepartmentIds: string[]
    onCPurposeDepartmentToggle: (deptId: string, checked: boolean) => void
    cPurposeEnabled: boolean
    onCPurposeEnabledChange: (value: boolean) => void
    onCreate: () => void

    editAllOpen: boolean
    onEditAllOpenChange: (open: boolean) => void
    editAllPurposeQ: string
    onEditAllPurposeQChange: (value: string) => void
    editAllPurposeDrafts: PurposeBulkDraft[]
    editAllPurposeRows: PurposeBulkDraft[]
    patchEditAllPurposeDraft: (id: string, patch: Partial<PurposeBulkDraft>) => void
    onEditAllPurposeScopeToggle: (id: string, scope: TransactionScope, checked: boolean) => void
    onEditAllPurposeDepartmentToggle: (id: string, deptId: string, checked: boolean) => void
    onSaveAll: () => void

    editOpen: boolean
    onEditOpenChange: (open: boolean) => void
    ePurposeCategory: string
    onEPurposeCategoryChange: (value: string) => void
    ePurposeKey: string
    onEPurposeKeyChange: (value: string) => void
    ePurposeLabel: string
    onEPurposeLabelChange: (value: string) => void
    ePurposeScopes: TransactionScope[]
    onEPurposeScopeToggle: (scope: TransactionScope, checked: boolean) => void
    ePurposeSortOrder: number
    onEPurposeSortOrderChange: (value: number) => void
    ePurposeApplyAllDepartments: boolean
    onEPurposeApplyAllDepartmentsChange: (value: boolean) => void
    ePurposeDepartmentIds: string[]
    onEPurposeDepartmentToggle: (deptId: string, checked: boolean) => void
    ePurposeEnabled: boolean
    onEPurposeEnabledChange: (value: boolean) => void
    onSave: () => void

    deleteOpen: boolean
    onDeleteOpenChange: (open: boolean) => void
    selectedPurpose: TransactionPurpose | null
    onDelete: () => void

    deptById: Map<string, Department>
}

export function PurposeDialogs({
    enabledDepartments,
    saving,
    createOpen,
    onCreateOpenChange,
    cPurposeCategory,
    onCPurposeCategoryChange,
    cPurposeKey,
    onCPurposeKeyChange,
    cPurposeLabel,
    onCPurposeLabelChange,
    cPurposeScopes,
    onCPurposeScopeToggle,
    cPurposeSortOrder,
    onCPurposeSortOrderChange,
    cPurposeApplyAllDepartments,
    onCPurposeApplyAllDepartmentsChange,
    cPurposeDepartmentIds,
    onCPurposeDepartmentToggle,
    cPurposeEnabled,
    onCPurposeEnabledChange,
    onCreate,
    editAllOpen,
    onEditAllOpenChange,
    editAllPurposeQ,
    onEditAllPurposeQChange,
    editAllPurposeDrafts,
    editAllPurposeRows,
    patchEditAllPurposeDraft,
    onEditAllPurposeScopeToggle,
    onEditAllPurposeDepartmentToggle,
    onSaveAll,
    editOpen,
    onEditOpenChange,
    ePurposeCategory,
    onEPurposeCategoryChange,
    ePurposeKey,
    onEPurposeKeyChange,
    ePurposeLabel,
    onEPurposeLabelChange,
    ePurposeScopes,
    onEPurposeScopeToggle,
    ePurposeSortOrder,
    onEPurposeSortOrderChange,
    ePurposeApplyAllDepartments,
    onEPurposeApplyAllDepartmentsChange,
    ePurposeDepartmentIds,
    onEPurposeDepartmentToggle,
    ePurposeEnabled,
    onEPurposeEnabledChange,
    onSave,
    deleteOpen,
    onDeleteOpenChange,
    selectedPurpose,
    onDelete,
}: PurposeDialogsProps) {
    return (
        <>
            <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Create transaction purpose</DialogTitle>
                    </DialogHeader>

                    <PurposeFormFields
                        idPrefix="c-purpose"
                        category={cPurposeCategory}
                        onCategoryChange={onCPurposeCategoryChange}
                        purposeKey={cPurposeKey}
                        onPurposeKeyChange={onCPurposeKeyChange}
                        label={cPurposeLabel}
                        onLabelChange={onCPurposeLabelChange}
                        scopes={cPurposeScopes}
                        onScopeToggle={onCPurposeScopeToggle}
                        sortOrder={cPurposeSortOrder}
                        onSortOrderChange={onCPurposeSortOrderChange}
                        applyToAllDepartments={cPurposeApplyAllDepartments}
                        onApplyToAllDepartmentsChange={onCPurposeApplyAllDepartmentsChange}
                        departmentIds={cPurposeDepartmentIds}
                        onDepartmentToggle={onCPurposeDepartmentToggle}
                        enabled={cPurposeEnabled}
                        onEnabledChange={onCPurposeEnabledChange}
                        enabledDepartments={enabledDepartments}
                    />

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onCreateOpenChange(false)}
                            disabled={saving}
                            className="w-full sm:mr-2 sm:w-auto"
                        >
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            onClick={onCreate}
                            disabled={saving}
                            className="w-full sm:w-auto"
                        >
                            {saving ? "Creating…" : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={editAllOpen} onOpenChange={onEditAllOpenChange}>
                <DialogContent className="sm:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Edit all transaction purposes</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <Input
                                value={editAllPurposeQ}
                                onChange={(e) => onEditAllPurposeQChange(e.target.value)}
                                placeholder="Search in bulk editor…"
                                className="w-full md:w-96"
                            />
                            <Badge variant="secondary">
                                {editAllPurposeRows.length} of {editAllPurposeDrafts.length}
                            </Badge>
                        </div>

                        <div className="max-h-[62vh] space-y-3 overflow-y-auto pr-1">
                            {editAllPurposeRows.length === 0 ? (
                                <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                                    No transaction purposes match your search.
                                </div>
                            ) : (
                                editAllPurposeRows.map((draft) => {
                                    const title = draft.label.trim() || draft.key.trim() || "Untitled purpose"

                                    return (
                                        <div key={draft.id} className="rounded-lg border p-4">
                                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium">{title}</p>
                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {draft.key || "no-key"} · id {draft.id}
                                                    </p>
                                                </div>
                                                {statusBadge(draft.enabled)}
                                            </div>

                                            <PurposeFormFields
                                                idPrefix={`ea-purpose-${draft.id}`}
                                                category={draft.category}
                                                onCategoryChange={(value) =>
                                                    patchEditAllPurposeDraft(draft.id, { category: value })
                                                }
                                                purposeKey={draft.key}
                                                onPurposeKeyChange={(value) =>
                                                    patchEditAllPurposeDraft(draft.id, { key: value })
                                                }
                                                label={draft.label}
                                                onLabelChange={(value) =>
                                                    patchEditAllPurposeDraft(draft.id, { label: value })
                                                }
                                                scopes={draft.scopes}
                                                onScopeToggle={(scope, checked) =>
                                                    onEditAllPurposeScopeToggle(draft.id, scope, checked)
                                                }
                                                sortOrder={draft.sortOrder}
                                                onSortOrderChange={(value) =>
                                                    patchEditAllPurposeDraft(draft.id, { sortOrder: value })
                                                }
                                                applyToAllDepartments={draft.applyToAllDepartments}
                                                onApplyToAllDepartmentsChange={(value) =>
                                                    patchEditAllPurposeDraft(draft.id, {
                                                        applyToAllDepartments: value,
                                                    })
                                                }
                                                departmentIds={draft.departmentIds}
                                                onDepartmentToggle={(deptId, checked) =>
                                                    onEditAllPurposeDepartmentToggle(draft.id, deptId, checked)
                                                }
                                                enabled={draft.enabled}
                                                onEnabledChange={(value) =>
                                                    patchEditAllPurposeDraft(draft.id, { enabled: value })
                                                }
                                                enabledDepartments={enabledDepartments}
                                            />
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onEditAllOpenChange(false)}
                            disabled={saving}
                            className="w-full sm:mr-2 sm:w-auto"
                        >
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            onClick={onSaveAll}
                            disabled={saving || editAllPurposeDrafts.length === 0}
                            className="w-full gap-2 sm:w-auto"
                        >
                            <Save className="h-4 w-4" />
                            {saving ? "Saving changes…" : "Save all changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={editOpen} onOpenChange={onEditOpenChange}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit transaction purpose</DialogTitle>
                    </DialogHeader>

                    <PurposeFormFields
                        idPrefix="e-purpose"
                        category={ePurposeCategory}
                        onCategoryChange={onEPurposeCategoryChange}
                        purposeKey={ePurposeKey}
                        onPurposeKeyChange={onEPurposeKeyChange}
                        label={ePurposeLabel}
                        onLabelChange={onEPurposeLabelChange}
                        scopes={ePurposeScopes}
                        onScopeToggle={onEPurposeScopeToggle}
                        sortOrder={ePurposeSortOrder}
                        onSortOrderChange={onEPurposeSortOrderChange}
                        applyToAllDepartments={ePurposeApplyAllDepartments}
                        onApplyToAllDepartmentsChange={onEPurposeApplyAllDepartmentsChange}
                        departmentIds={ePurposeDepartmentIds}
                        onDepartmentToggle={onEPurposeDepartmentToggle}
                        enabled={ePurposeEnabled}
                        onEnabledChange={onEPurposeEnabledChange}
                        enabledDepartments={enabledDepartments}
                    />

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onEditOpenChange(false)}
                            disabled={saving}
                            className="w-full sm:mr-2 sm:w-auto"
                        >
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            onClick={onSave}
                            disabled={saving}
                            className="w-full sm:w-auto"
                        >
                            {saving ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteOpen} onOpenChange={onDeleteOpenChange}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete transaction purpose?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete{" "}
                            <span className="font-medium">{selectedPurpose?.label || selectedPurpose?.key}</span>.
                            Queue users will no longer be able to select it.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={saving} onClick={() => onDeleteOpenChange(false)}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                onDelete()
                            }}
                            disabled={saving}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            {saving ? "Deleting…" : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}