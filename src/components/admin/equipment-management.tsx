'use client';

import { useState } from 'react';
import { equipment, facilities } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PlusIcon, EditIcon, PackageIcon, TrashIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '@/components/ui/card';

function getAvailabilityVariant(
  percent: number
): 'success' | 'warning' | 'danger' | 'critical' {
  if (percent >= 70) return 'success';
  if (percent >= 40) return 'warning';
  if (percent >= 10) return 'danger';
  return 'critical';
}

function getAvailabilityTextColor(percent: number): string {
  if (percent >= 70) return 'text-emerald-700 dark:text-emerald-400';
  if (percent >= 40) return 'text-amber-700 dark:text-amber-400';
  if (percent >= 10) return 'text-orange-700 dark:text-orange-400';
  return 'text-rose-600 dark:text-rose-400';
}

export function EquipmentManagement() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<
    (typeof equipment)[0] | null
  >(null);
  const [deletingEquipment, setDeletingEquipment] = useState<
    (typeof equipment)[0] | null
  >(null);

  const [formData, setFormData] = useState({
    name: '',
    facilityId: '',
    qtyTotal: 10,
    qtyAvailable: 10,
  });

  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Equipment name is required';
    }

    if (!formData.facilityId) {
      errors.facilityId = 'Facility selection is required';
    }

    if (formData.qtyTotal <= 0) {
      errors.qtyTotal = 'Total quantity must be greater than 0';
    }

    if (formData.qtyAvailable < 0) {
      errors.qtyAvailable = 'Available quantity cannot be negative';
    }

    if (formData.qtyAvailable > formData.qtyTotal) {
      errors.qtyAvailable = 'Available quantity cannot exceed total quantity';
    }

    return errors;
  };

  const handleAdd = () => {
    const errors = validateForm();
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      const missingFields = Object.values(errors).join(', ');
      toast({
        title: 'Validation Failed',
        description: `Please fix the following errors: ${missingFields}`,
        variant: 'destructive',
      });
      return;
    }

    const newEquipment = {
      id: `eq${Date.now()}`,
      name: formData.name,
      facilityId: formData.facilityId,
      qtyTotal: formData.qtyTotal,
      qtyAvailable: formData.qtyAvailable,
    };

    equipment.push(newEquipment);

    toast({
      title: 'Equipment Added',
      description: `${newEquipment.name} has been added to inventory.`,
    });

    setIsAddOpen(false);
    resetForm();
    setValidationErrors({});
  };

  const handleEdit = () => {
    if (!editingEquipment) return;

    const errors = validateForm();
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      const missingFields = Object.values(errors).join(', ');
      toast({
        title: 'Validation Failed',
        description: `Please fix the following errors: ${missingFields}`,
        variant: 'destructive',
      });
      return;
    }

    const eq = equipment.find((e) => e.id === editingEquipment.id);
    if (eq) {
      eq.name = formData.name;
      eq.facilityId = formData.facilityId;
      eq.qtyTotal = formData.qtyTotal;
      eq.qtyAvailable = formData.qtyAvailable;

      toast({
        title: 'Equipment Updated',
        description: `${eq.name} has been updated successfully.`,
      });
    }

    setEditingEquipment(null);
    resetForm();
    setValidationErrors({});
  };

  const handleDelete = () => {
    if (!deletingEquipment) return;

    const index = equipment.findIndex((e) => e.id === deletingEquipment.id);
    if (index !== -1) {
      equipment.splice(index, 1);
      toast({
        title: 'Equipment Deleted',
        description: `${deletingEquipment.name} has been removed from inventory.`,
        variant: 'destructive',
      });
    }

    setDeletingEquipment(null);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      facilityId: '',
      qtyTotal: 10,
      qtyAvailable: 10,
    });
  };

  const openEdit = (eq: (typeof equipment)[0]) => {
    setFormData({
      name: eq.name,
      facilityId: eq.facilityId,
      qtyTotal: eq.qtyTotal,
      qtyAvailable: eq.qtyAvailable,
    });
    setEditingEquipment(eq);
    setValidationErrors({});
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog
          open={isAddOpen}
          onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) {
              setValidationErrors({});
              resetForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Equipment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Equipment</DialogTitle>
            </DialogHeader>
            <EquipmentForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleAdd}
              validationErrors={validationErrors}
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
              <Card key={eq.id} className="overflow-hidden">
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
                            ? 'destructive'
                            : eq.qtyAvailable < 3
                            ? 'secondary'
                            : 'default'
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
                      <p className="font-medium mt-1">{eq.qtyTotal}</p>
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
                          'text-sm font-medium',
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
                      className="flex-1"
                    >
                      <EditIcon className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingEquipment(eq)}
                      className="flex-1 text-destructive hover:text-destructive"
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
                <TableRow key={eq.id}>
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
                          ? 'destructive'
                          : eq.qtyAvailable < 3
                          ? 'secondary'
                          : 'default'
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
                          'text-sm font-medium',
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
                      >
                        <EditIcon className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingEquipment(eq)}
                        className="text-destructive hover:text-destructive"
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

      {editingEquipment && (
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
              onSubmit={handleEdit}
              isEdit
              validationErrors={validationErrors}
            />
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog
        open={!!deletingEquipment}
        onOpenChange={() => setDeletingEquipment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{' '}
              <span className="font-semibold">{deletingEquipment?.name}</span>{' '}
              from the equipment inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Equipment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EquipmentForm({
  formData,
  setFormData,
  onSubmit,
  isEdit = false,
  validationErrors = {},
}: {
  formData: any;
  setFormData: any;
  onSubmit: () => void;
  isEdit?: boolean;
  validationErrors?: Record<string, string>;
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
            validationErrors.name ? 'border-destructive' : ''
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
              validationErrors.facilityId ? 'border-destructive' : ''
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
                qtyTotal: Number.parseInt(e.target.value),
              })
            }
            min={1}
            className={`border-3 border-primary/20 focus:border-primary shadow-sm ${
              validationErrors.qtyTotal ? 'border-destructive' : ''
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
                qtyAvailable: Number.parseInt(e.target.value),
              })
            }
            min={0}
            max={formData.qtyTotal}
            className={`border-3 border-primary/20 focus:border-primary shadow-sm ${
              validationErrors.qtyAvailable ? 'border-destructive' : ''
            }`}
          />
          {validationErrors.qtyAvailable && (
            <p className="text-sm text-destructive">
              {validationErrors.qtyAvailable}
            </p>
          )}
        </div>
      </div>

      <Button onClick={onSubmit} className="w-full">
        {isEdit ? 'Update Equipment' : 'Add Equipment'}
      </Button>
    </div>
  );
}
