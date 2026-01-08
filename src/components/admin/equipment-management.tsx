"use client";

import { useEffect, useState, startTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  PlusIcon,
  EditIcon,
  PackageIcon,
  TrashIcon,
  Loader2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import {
  upsertEquipment,
  deleteEquipmentAction,
  type ActionResult,
} from "@/app/(protected)/admin/inventory/actions";
import { notify } from "@/lib/toast";

type Facility = { id: string; name: string };
type EquipmentRow = {
  id: string;
  name: string;
  facilityId: string;
  qtyTotal: number;
  qtyAvailable: number;
};

function getAvailabilityVariant(
  p: number
): "success" | "warning" | "danger" | "critical" {
  if (p >= 70) return "success";
  if (p >= 40) return "warning";
  if (p >= 10) return "danger";
  return "critical";
}
function getAvailabilityTextColor(p: number): string {
  if (p >= 70) return "text-emerald-700 dark:text-emerald-400";
  if (p >= 40) return "text-amber-700 dark:text-amber-400";
  if (p >= 10) return "text-orange-700 dark:text-orange-400";
  return "text-rose-600 dark:text-rose-400";
}

export function EquipmentManagement({
  facilities = [],
  equipment = [],
}: {
  facilities?: Facility[];
  equipment?: EquipmentRow[];
}) {
  const isMobile = useIsMobile();
  const router = useRouter();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<EquipmentRow | null>(
    null
  );
  const [deletingEquipment, setDeletingEquipment] =
    useState<EquipmentRow | null>(null);

  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    id: "" as string | undefined,
    name: "",
    facilityId: "",
    qtyTotal: 10,
    qtyAvailable: 10,
  });

  // Server actions via React.useActionState
  const [upsertState, upsertDispatch] = useActionState<ActionResult, FormData>(
    upsertEquipment,
    { ok: true }
  );
  const [deleteState, deleteDispatch] = useActionState<ActionResult, FormData>(
    deleteEquipmentAction,
    { ok: true }
  );

  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [lastAction, setLastAction] = useState<null | "upsert" | "delete">(
    null
  );

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = "Equipment name is required";
    if (!formData.facilityId)
      errors.facilityId = "Facility selection is required";
    if (formData.qtyTotal <= 0)
      errors.qtyTotal = "Total quantity must be greater than 0";
    if (formData.qtyAvailable < 0)
      errors.qtyAvailable = "Available quantity cannot be negative";
    if (formData.qtyAvailable > formData.qtyTotal) {
      errors.qtyAvailable = "Available quantity cannot exceed total quantity";
    }
    return errors;
  };

  const resetForm = () =>
    setFormData({
      id: undefined,
      name: "",
      facilityId: "",
      qtyTotal: 10,
      qtyAvailable: 10,
    });

  const openEdit = (eq: EquipmentRow) => {
    setFormData({
      id: eq.id,
      name: eq.name,
      facilityId: eq.facilityId,
      qtyTotal: eq.qtyTotal,
      qtyAvailable: eq.qtyAvailable,
    });
    setEditingEquipment(eq);
    setValidationErrors({});
    setIsAddOpen(true); // open dialog in edit mode
  };

  const submitUpsert = () => {
    if (saving) return;

    const errors = validateForm();
    setValidationErrors(errors);
    if (Object.keys(errors).length) {
      notify.error(Object.values(errors).join(", "));
      return;
    }

    setSaving(true);
    const fd = new FormData();
    if (formData.id) fd.set("id", formData.id);
    fd.set("name", formData.name);
    fd.set("facilityId", formData.facilityId);
    fd.set("qtyTotal", String(formData.qtyTotal));
    fd.set("qtyAvailable", String(formData.qtyAvailable));

    setLastAction("upsert");
    startTransition(() => {
      upsertDispatch(fd);
    });
  };

  const handleDelete = () => {
    if (!deletingEquipment || isDeleting) return;

    setIsDeleting(true);
    const fd = new FormData();
    fd.set("id", deletingEquipment.id);

    setLastAction("delete");
    startTransition(() => {
      deleteDispatch(fd);
    });
  };

  // React to action results
  useEffect(() => {
    if (lastAction !== "upsert") return;
    if (!upsertState) return;

    if (upsertState.ok) {
      notify.success(formData.id ? "Equipment updated" : "Equipment added");
      setIsAddOpen(false);
      setEditingEquipment(null);
      resetForm();
      router.refresh();
    } else {
      notify.error(upsertState.message ?? "Could not save");
    }
    setSaving(false);
    setLastAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upsertState]);

  useEffect(() => {
    if (lastAction !== "delete") return;
    if (!deleteState) return;

    if (deleteState.ok) {
      notify.success("Equipment deleted");
      router.refresh();
    } else {
      notify.error(deleteState.message ?? "Delete failed");
    }
    setDeletingEquipment(null);
    setIsDeleting(false);
    setLastAction(null);
  }, [deleteState, lastAction, router]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog
          open={isAddOpen}
          onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) {
              setValidationErrors({});
              setEditingEquipment(null);
              resetForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              onClick={() => setIsAddOpen(true)}
              className="transition-all duration-200 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Equipment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingEquipment ? "Edit Equipment" : "Add New Equipment"}
              </DialogTitle>
            </DialogHeader>
            <EquipmentForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={submitUpsert}
              validationErrors={validationErrors}
              facilities={facilities}
              isEdit={!!editingEquipment}
              saving={saving}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isMobile ? (
        <div className="space-y-4">
          {equipment.map((eq) => {
            const facility = facilities.find((f) => f.id === eq.facilityId);
            const stockPercent = (eq.qtyAvailable / eq.qtyTotal) * 100;
            return (
              <Card
                key={eq.id}
                className="overflow-hidden transition-shadow hover:shadow-md"
              >
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <PackageIcon className="h-5 w-5 text-primary flex-shrink-0" />
                      <div>
                        <h3 className="font-bold">{eq.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {facility?.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Available</p>
                      <Badge
                        variant={
                          eq.qtyAvailable === 0
                            ? "destructive"
                            : eq.qtyAvailable < 3
                            ? "secondary"
                            : "default"
                        }
                        className="mt-1"
                      >
                        {eq.qtyAvailable}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Total Stock
                      </p>
                      <Badge
                        variant={
                          eq.qtyAvailable === 0
                            ? "destructive"
                            : eq.qtyAvailable < 3
                            ? "secondary"
                            : "default"
                        }
                        className="mt-1"
                      >
                        {eq.qtyTotal}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Availability
                    </p>
                    <div className="flex items-center gap-3">
                      <Progress
                        value={stockPercent}
                        variant={getAvailabilityVariant(stockPercent)}
                        className="flex-1"
                      />
                      <span
                        className={cn(
                          "text-sm font-medium",
                          getAvailabilityTextColor(stockPercent)
                        )}
                      >
                        {Math.round(stockPercent)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(eq)}
                      className="flex-1 transition-all duration-150 active:scale-95"
                    >
                      <EditIcon className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingEquipment(eq)}
                      className="flex-1 text-destructive hover:text-destructive transition-all duration-150 active:scale-95"
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipment</TableHead>
              <TableHead>Facility</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Stock Level</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipment.map((eq) => {
              const facility = facilities.find((f) => f.id === eq.facilityId);
              const stockPercent = (eq.qtyAvailable / eq.qtyTotal) * 100;

              return (
                <TableRow
                  key={eq.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <PackageIcon className="h-4 w-4 text-primary" />
                      <span className="font-medium">{eq.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{facility?.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        eq.qtyAvailable === 0
                          ? "destructive"
                          : eq.qtyAvailable < 3
                          ? "secondary"
                          : "default"
                      }
                    >
                      {eq.qtyAvailable}
                    </Badge>
                  </TableCell>
                  <TableCell>{eq.qtyTotal}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Progress
                        value={stockPercent}
                        variant={getAvailabilityVariant(stockPercent)}
                        className="w-24"
                      />
                      <span
                        className={cn(
                          "text-sm font-medium",
                          getAvailabilityTextColor(stockPercent)
                        )}
                      >
                        {Math.round(stockPercent)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(eq)}
                        className="transition-all duration-150 active:scale-95 hover:bg-accent"
                      >
                        <EditIcon className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingEquipment(eq)}
                        className="text-destructive hover:text-destructive transition-all duration-150 active:scale-95 hover:bg-destructive/10"
                      >
                        <TrashIcon className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={!!editingEquipment}
        onOpenChange={(open) => {
          if (!open) {
            setEditingEquipment(null);
            setValidationErrors({});
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Equipment</DialogTitle>
          </DialogHeader>
          <EquipmentForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={submitUpsert}
            isEdit
            validationErrors={validationErrors}
            facilities={facilities}
            saving={saving}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingEquipment}
        onOpenChange={() => setDeletingEquipment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              <span className="font-semibold">{deletingEquipment?.name}</span>{" "}
              from the equipment inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all duration-150 active:scale-95"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Equipment"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Optional inline error surfaces */}
      {!upsertState.ok && (
        <p className="text-sm text-red-600">
          {upsertState.message ?? "Action failed."}
        </p>
      )}
      {!deleteState.ok && (
        <p className="text-sm text-red-600">
          {deleteState.message ?? "Delete failed."}
        </p>
      )}
    </div>
  );
}

function EquipmentForm({
  formData,
  setFormData,
  onSubmit,
  isEdit = false,
  validationErrors = {},
  facilities,
  saving = false,
}: {
  formData: any;
  setFormData: any;
  onSubmit: () => void;
  isEdit?: boolean;
  validationErrors?: Record<string, string>;
  facilities: Facility[];
  saving?: boolean;
}) {
  return (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <Label htmlFor="eq-name">
          Equipment Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="eq-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Basketball"
          className={`border-3 border-primary/20 focus:border-primary shadow-sm ${
            validationErrors.name ? "border-destructive" : ""
          }`}
        />
        {validationErrors.name && (
          <p className="text-sm text-destructive">{validationErrors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="eq-facility">
          Facility <span className="text-destructive">*</span>
        </Label>
        <Select
          value={formData.facilityId}
          onValueChange={(value) =>
            setFormData({ ...formData, facilityId: value })
          }
        >
          <SelectTrigger
            id="eq-facility"
            className={`border-3 border-primary/20 focus:border-primary shadow-sm ${
              validationErrors.facilityId ? "border-destructive" : ""
            }`}
          >
            <SelectValue placeholder="Select facility" />
          </SelectTrigger>
          <SelectContent>
            {facilities.map((facility) => (
              <SelectItem key={facility.id} value={facility.id}>
                {facility.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {validationErrors.facilityId && (
          <p className="text-sm text-destructive">
            {validationErrors.facilityId}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 pr-3 border-r-2 border-border">
          <Label
            htmlFor="eq-total"
            className="text-gray-900 dark:text-gray-100 font-semibold text-[15px]"
          >
            Total Quantity <span className="text-destructive">*</span>
          </Label>
          <Input
            id="eq-total"
            type="number"
            value={formData.qtyTotal}
            onChange={(e) =>
              setFormData({
                ...formData,
                qtyTotal: Number.parseInt(e.target.value || "0", 10),
              })
            }
            min={1}
            className={`border-3 border-primary/20 focus:border-primary shadow-sm ${
              validationErrors.qtyTotal ? "border-destructive" : ""
            }`}
          />
          {validationErrors.qtyTotal && (
            <p className="text-sm text-destructive">
              {validationErrors.qtyTotal}
            </p>
          )}
        </div>

        <div className="space-y-2 pl-3">
          <Label
            htmlFor="eq-available"
            className="text-gray-900 dark:text-gray-100 font-semibold text-[15px]"
          >
            Available Quantity <span className="text-destructive">*</span>
          </Label>
          <Input
            id="eq-available"
            type="number"
            value={formData.qtyAvailable}
            onChange={(e) =>
              setFormData({
                ...formData,
                qtyAvailable: Number.parseInt(e.target.value || "0", 10),
              })
            }
            min={0}
            max={formData.qtyTotal}
            className={`border-3 border-primary/20 focus:border-primary shadow-sm ${
              validationErrors.qtyAvailable ? "border-destructive" : ""
            }`}
          />
          {validationErrors.qtyAvailable && (
            <p className="text-sm text-destructive">
              {validationErrors.qtyAvailable}
            </p>
          )}
        </div>
      </div>

      <Button
        onClick={onSubmit}
        className="w-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100"
        disabled={saving}
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isEdit ? "Updating..." : "Adding Equipment..."}
          </>
        ) : (
          <>{isEdit ? "Update Equipment" : "Add Equipment"}</>
        )}
      </Button>
    </div>
  );
}
