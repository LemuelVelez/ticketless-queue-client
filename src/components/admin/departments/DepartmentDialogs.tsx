
import type { Department } from "@/api/admin"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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

import { prettyManager } from "@/components/admin/departments/utils"

type DepartmentDialogsProps = {
    managerOptions: string[]
    saving: boolean
    createOpen: boolean
    onCreateOpenChange: (open: boolean) => void
    cDeptName: string
    onCDeptNameChange: (value: string) => void
    cDeptCode: string
    onCDeptCodeChange: (value: string) => void
    cDeptManager: string
    onCDeptManagerChange: (value: string) => void
    onCreate: () => void
    editOpen: boolean
    onEditOpenChange: (open: boolean) => void
    selectedDept: Department | null
    eDeptName: string
    onEDeptNameChange: (value: string) => void
    eDeptCode: string
    onEDeptCodeChange: (value: string) => void
    eDeptManager: string
    onEDeptManagerChange: (value: string) => void
    eDeptEnabled: boolean
    onEDeptEnabledChange: (value: boolean) => void
    onSave: () => void
    deleteOpen: boolean
    onDeleteOpenChange: (open: boolean) => void
    onDelete: () => void
}

export function DepartmentDialogs({
    managerOptions,
    saving,
    createOpen,
    onCreateOpenChange,
    cDeptName,
    onCDeptNameChange,
    cDeptCode,
    onCDeptCodeChange,
    cDeptManager,
    onCDeptManagerChange,
    onCreate,
    editOpen,
    onEditOpenChange,
    selectedDept,
    eDeptName,
    onEDeptNameChange,
    eDeptCode,
    onEDeptCodeChange,
    eDeptManager,
    onEDeptManagerChange,
    eDeptEnabled,
    onEDeptEnabledChange,
    onSave,
    deleteOpen,
    onDeleteOpenChange,
    onDelete,
}: DepartmentDialogsProps) {
    return (
        <>
            <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create department</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="c-dept-name">Name</Label>
                            <Input
                                id="c-dept-name"
                                value={cDeptName}
                                onChange={(e) => onCDeptNameChange(e.target.value)}
                                placeholder="e.g., College of Computing Studies"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="c-dept-code">Code (optional)</Label>
                            <Input
                                id="c-dept-code"
                                value={cDeptCode}
                                onChange={(e) => onCDeptCodeChange(e.target.value)}
                                placeholder="e.g., CCS"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="c-dept-manager">Transaction manager</Label>
                            <Input
                                id="c-dept-manager"
                                value={cDeptManager}
                                onChange={(e) => onCDeptManagerChange(e.target.value)}
                                placeholder="e.g., REGISTRAR"
                            />
                            <div className="flex flex-wrap gap-2">
                                {managerOptions.slice(0, 6).map((manager) => (
                                    <Button
                                        key={`c-dept-manager-${manager}`}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onCDeptManagerChange(manager)}
                                    >
                                        {prettyManager(manager)}
                                    </Button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Managers are dynamic. Type a new key to create a new transaction manager group.
                            </p>
                        </div>
                    </div>

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

            <Dialog open={editOpen} onOpenChange={onEditOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit department</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="e-dept-name">Name</Label>
                            <Input
                                id="e-dept-name"
                                value={eDeptName}
                                onChange={(e) => onEDeptNameChange(e.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="e-dept-code">Code</Label>
                            <Input
                                id="e-dept-code"
                                value={eDeptCode}
                                onChange={(e) => onEDeptCodeChange(e.target.value)}
                                placeholder="Optional"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="e-dept-manager">Transaction manager</Label>
                            <Input
                                id="e-dept-manager"
                                value={eDeptManager}
                                onChange={(e) => onEDeptManagerChange(e.target.value)}
                                placeholder="e.g., REGISTRAR"
                            />
                            <div className="flex flex-wrap gap-2">
                                {managerOptions.slice(0, 6).map((manager) => (
                                    <Button
                                        key={`e-dept-manager-${manager}`}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onEDeptManagerChange(manager)}
                                    >
                                        {prettyManager(manager)}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="grid gap-0.5">
                                <div className="text-sm font-medium">Enabled</div>
                                <div className="text-xs text-muted-foreground">
                                    Disabled departments won’t appear in public/join selection.
                                </div>
                            </div>
                            <Switch checked={eDeptEnabled} onCheckedChange={onEDeptEnabledChange} />
                        </div>
                    </div>

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
                        <AlertDialogTitle>Delete department?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete{" "}
                            <span className="font-medium">{selectedDept?.name || "this department"}</span>.
                            <br />
                            <br />
                            A department can only be deleted if it is not referenced by windows, staff assignments, or
                            transaction purposes.
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