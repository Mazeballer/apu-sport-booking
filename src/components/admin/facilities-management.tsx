"use client";

import { useEffect } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Facility,
  SportType,
  LocationType,
  AvailableEquipment,
} from "@/lib/facility-types";
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
import { Textarea } from "@/components/ui/textarea";
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
import { PlusIcon, EditIcon, TrashIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
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
import { ImageUpload } from "@/components/image-upload";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import {
  createFacilityAction,
  updateFacilityAction,
  deleteFacilityAction,
  toggleFacilityActiveAction,
  type FacilityInput,
} from "@/app/(protected)/admin/facilities/actions";
import { notify } from "@/lib/toast";

// Hash function to generate consistent color index from sport name
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Color palette for sport types (dark shades with white text)
const sportColorPalette = [
  "bg-orange-700 text-white hover:bg-orange-800 border-orange-700",
  "bg-emerald-700 text-white hover:bg-emerald-800 border-emerald-700",
  "bg-lime-700 text-white hover:bg-lime-800 border-lime-700",
  "bg-blue-700 text-white hover:bg-blue-800 border-blue-700",
  "bg-rose-700 text-white hover:bg-rose-800 border-rose-700",
  "bg-cyan-700 text-white hover:bg-cyan-800 border-cyan-700",
  "bg-purple-700 text-white hover:bg-purple-800 border-purple-700",
  "bg-amber-700 text-white hover:bg-amber-800 border-amber-700",
  "bg-teal-700 text-white hover:bg-teal-800 border-teal-700",
  "bg-indigo-700 text-white hover:bg-indigo-800 border-indigo-700",
  "bg-pink-700 text-white hover:bg-pink-800 border-pink-700",
  "bg-sky-700 text-white hover:bg-sky-800 border-sky-700",
  "bg-violet-700 text-white hover:bg-violet-800 border-violet-700",
  "bg-fuchsia-700 text-white hover:bg-fuchsia-800 border-fuchsia-700",
  "bg-red-700 text-white hover:bg-red-800 border-red-700",
  "bg-green-700 text-white hover:bg-green-800 border-green-700",
];

// Predefined colors for common sports (to maintain consistency)
const predefinedSportColors: Record<string, string> = {
  Basketball: "bg-orange-700 text-white hover:bg-orange-800 border-orange-700",
  Badminton:
    "bg-emerald-700 text-white hover:bg-emerald-800 border-emerald-700",
  Tennis: "bg-lime-700 text-white hover:bg-lime-800 border-lime-700",
  Football: "bg-blue-700 text-white hover:bg-blue-800 border-blue-700",
  Volleyball: "bg-rose-700 text-white hover:bg-rose-800 border-rose-700",
  Swimming: "bg-cyan-700 text-white hover:bg-cyan-800 border-cyan-700",
};

// Function to get color for any sport type
function getSportTypeColor(sportType: string): string {
  // Check if it's a predefined sport
  if (predefinedSportColors[sportType]) {
    return predefinedSportColors[sportType];
  }

  // For new/custom sports, generate color from hash
  const hash = hashString(sportType);
  const colorIndex = hash % sportColorPalette.length;
  return sportColorPalette[colorIndex];
}

export function FacilitiesManagement({
  initialFacilities,
}: {
  initialFacilities: Facility[];
}) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [facilities, setFacilities] = useState<Facility[]>(initialFacilities);

  useEffect(() => {
    setFacilities(initialFacilities);
  }, [initialFacilities]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [deletingFacility, setDeletingFacility] = useState<Facility | null>(
    null
  );
  const sportOptions = Array.from(
    new Set(facilities.map((f) => f.type).filter(Boolean))
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [layoutImageFile, setLayoutImageFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    type: "Basketball" as SportType,
    location: "",
    locationType: "Indoor" as LocationType,
    description: "",
    capacity: 20,
    operatingStart: "08:00",
    operatingEnd: "22:00",
    status: "active" as "active" | "inactive",
    numberOfCourts: 1,
    isMultiSport: false,
    supportedSports: [] as SportType[],
    availableEquipment: [] as AvailableEquipment[],
    rules: [] as string[],
  });

  const validateForm = (): { isValid: boolean; missingFields: string[] } => {
    const missingFields: string[] = [];

    if (!formData.name.trim()) missingFields.push("Facility Name");
    if (!formData.location.trim()) missingFields.push("Location");
    if (!imageFile && !editingFacility) missingFields.push("Facility Image");
    if (!layoutImageFile && !editingFacility)
      missingFields.push("Courts Layout Image");
    if (!formData.description.trim()) missingFields.push("Description");
    if (!formData.rules || formData.rules.length === 0)
      missingFields.push("Facility Rules (at least one)");

    return {
      isValid: missingFields.length === 0,
      missingFields,
    };
  };

  const handleAdd = async () => {
    const validation = validateForm();
    if (!validation.isValid) {
      const msg =
        "Please fill in all required fields: " +
        validation.missingFields.join(", ");
      notify.error(msg);
      return;
    }

    const imageUrl = imageFile
      ? URL.createObjectURL(imageFile)
      : `/placeholder.svg?height=400&width=600&query=${formData.type} facility`;

    const layoutImageUrl = layoutImageFile
      ? URL.createObjectURL(layoutImageFile)
      : `/placeholder.svg?height=400&width=600&query=${formData.type} court layout`;

    const input: FacilityInput = {
      id: editingFacility?.id,
      name: formData.name,
      type: formData.type,
      location: formData.location,
      locationType: formData.locationType,
      description: formData.description,
      capacity: formData.capacity,
      openTime: formData.operatingStart,
      closeTime: formData.operatingEnd,
      isMultiSport: formData.isMultiSport,
      sharedSports: formData.isMultiSport ? formData.supportedSports : [],
      numberOfCourts: formData.numberOfCourts,
      rules: formData.rules,
      photos: [imageUrl, layoutImageUrl],
      active: formData.status === "active",
    };

    try {
      await createFacilityAction(input);

      notify.success(`${formData.name} has been added successfully.`);

      setIsAddOpen(false);
      setImageFile(null);
      setLayoutImageFile(null);
      resetForm();

      router.refresh();
    } catch (error) {
      console.error(error);
      notify.error("Failed to add facility. Please try again.");
    }
  };

  const handleEdit = async () => {
    if (!editingFacility) return;

    const validation = validateForm();
    if (!validation.isValid) {
      const msg =
        "Please fill in all required fields: " +
        validation.missingFields.join(", ");
      notify.error(msg);
      return;
    }

    const existingPhotos = (editingFacility as any).photos ?? [];

    const imageUrl = imageFile
      ? URL.createObjectURL(imageFile)
      : existingPhotos[0] ??
        editingFacility.image ??
        `/placeholder.svg?height=400&width=600&query=${formData.type} facility`;

    const layoutImageUrl = layoutImageFile
      ? URL.createObjectURL(layoutImageFile)
      : existingPhotos[1] ??
        editingFacility.layoutImage ??
        `/placeholder.svg?height=400&width=600&query=${formData.type} court layout`;

    const input: FacilityInput = {
      id: editingFacility?.id,
      name: formData.name,
      type: formData.type,
      location: formData.location,
      locationType: formData.locationType,
      description: formData.description,
      capacity: formData.capacity,
      openTime: formData.operatingStart,
      closeTime: formData.operatingEnd,
      isMultiSport: formData.isMultiSport,
      sharedSports: formData.isMultiSport ? formData.supportedSports : [],
      numberOfCourts: formData.numberOfCourts,
      rules: formData.rules,
      photos: [imageUrl, layoutImageUrl],
      active: formData.status === "active",
    };

    try {
      await updateFacilityAction(input);

      notify.success(`${formData.name} has been updated successfully.`);

      setEditingFacility(null);
      setImageFile(null);
      setLayoutImageFile(null);
      resetForm();

      router.refresh();
    } catch (error) {
      console.error(error);
      notify.error("Failed to update facility. Please try again.");
    }
  };

  const handleDelete = async () => {
    if (!deletingFacility) return;

    try {
      await deleteFacilityAction(deletingFacility.id);

      notify.success(`${deletingFacility.name} has been removed.`);

      setDeletingFacility(null);
      router.refresh();
    } catch (error) {
      console.error(error);
      notify.error("Failed to delete facility. Please try again.");
    }
  };

  const handleStatusToggle = async (
    facility: Facility,
    nextActive: boolean
  ) => {
    setFacilities((prev) =>
      prev.map((f) =>
        f.id === facility.id
          ? { ...f, status: nextActive ? "active" : "inactive" }
          : f
      )
    );

    try {
      await toggleFacilityActiveAction(facility.id, nextActive);

      notify.success(
        `${facility.name} is now ${nextActive ? "active" : "inactive"}.`
      );
    } catch (error) {
      console.error(error);
      notify.error("Failed to update status. Please try again.");

      setFacilities((prev) =>
        prev.map((f) =>
          f.id === facility.id
            ? { ...f, status: !nextActive ? "active" : "inactive" }
            : f
        )
      );
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "Basketball",
      location: "",
      locationType: "Indoor",
      description: "",
      capacity: 20,
      operatingStart: "08:00",
      operatingEnd: "22:00",
      status: "active",
      numberOfCourts: 1,
      isMultiSport: false,
      supportedSports: [],
      availableEquipment: [],
      rules: [],
    });
  };

  const openEdit = (facility: Facility) => {
    setFormData({
      name: facility.name,
      type: facility.type,
      location: facility.location,
      locationType: facility.locationType,
      description: facility.description,
      capacity: facility.capacity,
      operatingStart: facility.operatingHours.start,
      operatingEnd: facility.operatingHours.end,
      status: facility.status || "active",
      numberOfCourts: facility.courts?.length || 1,
      isMultiSport: facility.isMultiSport || false,
      supportedSports: facility.courts?.[0]?.supportedSports || [facility.type],
      availableEquipment: facility.availableEquipment || [],
      rules: facility.rules || [],
    });
    setEditingFacility(facility);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Facility
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Facility</DialogTitle>
            </DialogHeader>
            <FacilityForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleAdd}
              imageFile={imageFile}
              setImageFile={setImageFile}
              layoutImageFile={layoutImageFile}
              setLayoutImageFile={setLayoutImageFile}
              sportOptions={sportOptions}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isMobile ? (
        <div className="space-y-4">
          {facilities.map((facility) => (
            <Card key={facility.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{facility.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {facility.location} • {facility.locationType}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Switch
                      checked={facility.status === "active"}
                      onCheckedChange={(checked) =>
                        handleStatusToggle(facility, checked)
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <>
                    <Badge
                      variant="outline"
                      className={getSportTypeColor(facility.type)}
                    >
                      {facility.type}
                    </Badge>
                  </>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Capacity</p>
                    <p className="font-medium">{facility.capacity} people</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Courts</p>
                    <p className="font-medium">
                      {facility.courts?.length || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Equipment</p>
                    {facility.availableEquipment &&
                    facility.availableEquipment.length > 0 ? (
                      <Badge className="hover:bg-blue-600 text-white bg-blue-600 bg-primary mt-1">
                        {facility.availableEquipment.length}{" "}
                        {facility.availableEquipment.length === 1
                          ? "item"
                          : "items"}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground border-muted-foreground/30 mt-1"
                      >
                        None
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Hours</p>
                    <p className="font-medium text-xs">
                      {facility.operatingHours.start} -{" "}
                      {facility.operatingHours.end}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(facility)}
                    className="flex-1"
                  >
                    <EditIcon className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeletingFacility(facility)}
                    className="flex-1 text-destructive hover:text-destructive"
                  >
                    <TrashIcon className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-bold text-gray-900 dark:text-gray-100">
                Name
              </TableHead>
              <TableHead className="font-bold text-gray-900 dark:text-gray-100">
                Type
              </TableHead>
              <TableHead className="font-bold text-gray-900 dark:text-gray-100">
                Location
              </TableHead>
              <TableHead className="font-bold text-gray-900 dark:text-gray-100">
                Capacity
              </TableHead>
              <TableHead className="font-bold text-gray-900 dark:text-gray-100">
                Courts
              </TableHead>
              <TableHead className="font-bold text-gray-900 dark:text-gray-100">
                Equipment
              </TableHead>
              <TableHead className="font-bold text-gray-900 dark:text-gray-100">
                Hours
              </TableHead>
              <TableHead className="font-bold text-gray-900 dark:text-gray-100">
                Status
              </TableHead>
              <TableHead className="text-right font-bold text-gray-900 dark:text-gray-100">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {facilities.map((facility) => (
              <TableRow key={facility.id}>
                <TableCell className="font-medium">{facility.name}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap gap-1">
                      {/* Always show the primary sport type from DB */}
                      <Badge
                        variant="outline"
                        className={getSportTypeColor(facility.type)}
                      >
                        {facility.type}
                      </Badge>
                    </div>
                    {facility.isMultiSport &&
                    facility.courts?.[0]?.supportedSports?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {facility.courts[0].supportedSports!.map((sport) => (
                          <Badge
                            key={sport}
                            variant="outline"
                            className={`text-xs ${getSportTypeColor(sport)}`}
                          >
                            {sport}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p>{facility.location}</p>
                    <p className="text-xs text-muted-foreground">
                      {facility.locationType}
                    </p>
                  </div>
                </TableCell>
                <TableCell>{facility.capacity}</TableCell>
                <TableCell>{facility.courts?.length || 0}</TableCell>
                <TableCell>
                  {facility.availableEquipment &&
                  facility.availableEquipment.length > 0 ? (
                    <Badge className="hover:bg-blue-600 text-white bg-blue-600 bg-primary">
                      {facility.availableEquipment.length}{" "}
                      {facility.availableEquipment.length === 1
                        ? "item"
                        : "items"}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-muted-foreground border-muted-foreground/30"
                    >
                      None
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {facility.operatingHours.start} -{" "}
                  {facility.operatingHours.end}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={facility.status === "active"}
                      onCheckedChange={(checked) =>
                        handleStatusToggle(facility, checked)
                      }
                    />
                    <span className="text-sm capitalize mx-0.5">
                      {facility.status || "active"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(facility)}
                    >
                      <EditIcon className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingFacility(facility)}
                      className="text-destructive hover:text-destructive"
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editingFacility && (
        <Dialog
          open={!!editingFacility}
          onOpenChange={() => setEditingFacility(null)}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Facility</DialogTitle>
            </DialogHeader>
            <FacilityForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleEdit}
              isEdit
              imageFile={imageFile}
              setImageFile={setImageFile}
              layoutImageFile={layoutImageFile}
              setLayoutImageFile={setLayoutImageFile}
              sportOptions={sportOptions}
            />
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog
        open={!!deletingFacility}
        onOpenChange={() => setDeletingFacility(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              facility{" "}
              <span className="font-semibold">{deletingFacility?.name}</span>{" "}
              and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Facility
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FacilityForm({
  formData,
  setFormData,
  onSubmit,
  isEdit = false,
  imageFile,
  setImageFile,
  layoutImageFile,
  setLayoutImageFile,
  sportOptions,
}: {
  formData: any;
  setFormData: any;
  onSubmit: () => void | Promise<void>;
  isEdit?: boolean;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  layoutImageFile: File | null;
  setLayoutImageFile: (file: File | null) => void;
  sportOptions: string[];
}) {
  const [isCustomSport, setIsCustomSport] = useState(false);
  const [customSportType, setCustomSportType] = useState("");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [equipmentQuantity, setEquipmentQuantity] = useState(1);
  const [newRule, setNewRule] = useState("");
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const isMobile = useIsMobile();

  const sports: SportType[] = sportOptions as SportType[];

  const handleSportTypeChange = (value: string) => {
    if (value === "Other") {
      setIsCustomSport(true);
      setFormData({ ...formData, type: customSportType });
    } else {
      setIsCustomSport(false);
      setCustomSportType("");
      setFormData({ ...formData, type: value });
    }
  };

  const handleCustomSportTypeChange = (value: string) => {
    setCustomSportType(value);
    setFormData({ ...formData, type: value });
  };

  const handleMultiSportToggle = (checked: boolean) => {
    setFormData({
      ...formData,
      isMultiSport: checked,
      supportedSports: checked ? [formData.type] : [],
    });
  };

  const toggleSupportedSport = (sport: SportType) => {
    const currentSports = formData.supportedSports || [];
    if (currentSports.includes(sport)) {
      setFormData({
        ...formData,
        supportedSports: currentSports.filter((s: SportType) => s !== sport),
      });
    } else {
      setFormData({
        ...formData,
        supportedSports: [...currentSports, sport],
      });
    }
  };

  const addEquipment = () => {
    if (!selectedEquipmentId) return;

    if (
      formData.availableEquipment?.some(
        (eq: AvailableEquipment) => eq.equipmentId === selectedEquipmentId
      )
    ) {
      return;
    }

    const newEquipment: AvailableEquipment = {
      equipmentId: selectedEquipmentId,
      quantity: equipmentQuantity,
    };

    setFormData({
      ...formData,
      availableEquipment: [
        ...(formData.availableEquipment || []),
        newEquipment,
      ],
    });

    setSelectedEquipmentId("");
    setEquipmentQuantity(1);
  };

  const removeEquipment = (equipmentId: string) => {
    setFormData({
      ...formData,
      availableEquipment: formData.availableEquipment.filter(
        (eq: AvailableEquipment) => eq.equipmentId !== equipmentId
      ),
    });
  };

  const addRule = () => {
    if (!newRule.trim()) return;

    setFormData({
      ...formData,
      rules: [...(formData.rules || []), newRule.trim()],
    });

    setNewRule("");
  };

  const removeRule = (index: number) => {
    setFormData({
      ...formData,
      rules: formData.rules.filter((_: string, i: number) => i !== index),
    });
  };

  return (
    <div className="space-y-6 py-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-[15px] font-semibold">
            Facility Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Main Basketball Court"
            className={`border-3 border-primary/20 focus:border-primary shadow-sm ${
              !formData.name.trim() && errors.name ? "border-destructive" : ""
            }`}
          />
          {!formData.name.trim() && errors.name && (
            <p className="text-xs text-destructive">
              Facility name is required
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="type" className="text-[15px] font-semibold">
            Sport Type
          </Label>
          <Select
            value={
              isCustomSport
                ? "Other"
                : sports.includes(formData.type)
                ? formData.type
                : "" // none selected yet
            }
            onValueChange={handleSportTypeChange}
          >
            <SelectTrigger
              id="type"
              className="border-3 border-primary/20 focus:border-primary shadow-sm"
            >
              <SelectValue
                placeholder={
                  sports.length === 0
                    ? "No sports available yet"
                    : "Select sport type"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {sports.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No existing facilities yet
                </div>
              ) : (
                sports.map((sport) => (
                  <SelectItem key={sport} value={sport}>
                    {sport}
                  </SelectItem>
                ))
              )}
              <SelectItem value="Other">Other (Custom)</SelectItem>
            </SelectContent>
          </Select>

          {isCustomSport && (
            <Input
              placeholder="Enter custom sport type"
              value={customSportType}
              onChange={(e) => handleCustomSportTypeChange(e.target.value)}
              className="mt-2 border-2"
            />
          )}
        </div>
      </div>

      <div className="lg:block hidden">
        <Separator className="my-6" />
      </div>

      <div className="space-y-3 rounded-lg border-2 p-4 bg-muted/50">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="multiSport" className="text-base font-semibold">
              Multi-Sport Courts
            </Label>
            <p className="text-sm text-muted-foreground">
              Enable if courts can be used for multiple sports
            </p>
          </div>
          <Switch
            id="multiSport"
            checked={formData.isMultiSport}
            onCheckedChange={handleMultiSportToggle}
          />
        </div>

        {formData.isMultiSport && (
          <div className="space-y-2 pt-2">
            <Label className="text-sm font-semibold">
              Supported Sports (select all that apply)
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {sports.map((sport) => (
                <div key={sport} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`sport-${sport}`}
                    checked={formData.supportedSports?.includes(sport) || false}
                    onChange={() => toggleSupportedSport(sport)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label
                    htmlFor={`sport-${sport}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {sport}
                  </Label>
                </div>
              ))}
            </div>
            {formData.supportedSports?.length === 0 && (
              <p className="text-xs text-destructive">
                Please select at least one sport
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="location" className="text-[15px] font-semibold">
            Location <span className="text-destructive">*</span>
          </Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) =>
              setFormData({ ...formData, location: e.target.value })
            }
            placeholder="Sports Complex A"
            className={`border-3 border-primary/20 focus:border-primary shadow-sm ${
              !formData.location.trim() && errors.location
                ? "border-destructive"
                : ""
            }`}
          />
          {!formData.location.trim() && errors.location && (
            <p className="text-xs text-destructive">Location is required</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="locationType" className="text-[15px] font-semibold">
            Location Type
          </Label>
          <Select
            value={formData.locationType}
            onValueChange={(value) =>
              setFormData({ ...formData, locationType: value })
            }
          >
            <SelectTrigger
              id="locationType"
              className="border-3 border-primary/20 focus:border-primary shadow-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Indoor">Indoor</SelectItem>
              <SelectItem value="Outdoor">Outdoor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="lg:block hidden">
        <Separator className="my-6" />
      </div>

      <div className="space-y-2">
        <Label className="text-[15px] font-semibold">
          Facility Image <span className="text-destructive">*</span>
        </Label>
        <ImageUpload value={imageFile} onChange={setImageFile} />
        {!imageFile && !isEdit && errors.image && (
          <p className="text-xs text-destructive">Facility image is required</p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-[15px] font-semibold">
          Courts Layout Image <span className="text-destructive">*</span>
        </Label>
        <ImageUpload value={layoutImageFile} onChange={setLayoutImageFile} />
        {!layoutImageFile && !isEdit && errors.layoutImage && (
          <p className="text-xs text-destructive">
            Courts layout image is required
          </p>
        )}
      </div>

      <div className="lg:block hidden">
        <Separator className="my-6" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="text-[15px] font-semibold">
          Description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder="Professional indoor basketball court with wooden flooring..."
          rows={3}
          className={`border-2 ${
            !formData.description.trim() && errors.description
              ? "border-destructive"
              : ""
          }`}
        />
        {!formData.description.trim() && errors.description && (
          <p className="text-xs text-destructive">Description is required</p>
        )}
      </div>

      <div className="lg:block hidden">
        <Separator className="my-6" />
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold">
            Facility Rules <span className="text-destructive">*</span>
          </Label>
          <p className="text-sm text-muted-foreground">
            Add rules and guidelines for using this facility
          </p>
        </div>

        <div className="space-y-3 rounded-lg border-2 p-4 bg-muted/50">
          <div className="flex gap-2">
            <Input
              placeholder="Enter a facility rule (e.g., Proper sports attire required)"
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRule();
                }
              }}
              className="flex-1 border-3 border-primary/20 focus:border-primary shadow-sm"
            />
            <Button
              type="button"
              onClick={addRule}
              disabled={!newRule.trim()}
              className="shrink-0"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </div>

          {formData.rules && formData.rules.length > 0 && (
            <div className="space-y-2 pt-2">
              <Label className="text-sm font-semibold">
                Current Rules ({formData.rules.length})
              </Label>
              <div className="space-y-2">
                {formData.rules.map((rule: string, index: number) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-3 rounded-lg border-2 bg-background"
                  >
                    <div className="flex-1">
                      <p className="text-sm">{rule}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRule(index)}
                      className="text-destructive hover:text-destructive shrink-0"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!formData.rules || formData.rules.length === 0) && (
            <div>
              <p className="text-xs text-muted-foreground text-center py-2">
                No rules added yet. Add rules to help users understand facility
                guidelines.
              </p>
              {errors.rules && (
                <p className="text-xs text-destructive text-center">
                  At least one rule is required
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="lg:block hidden">
        <Separator className="my-6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="capacity" className="text-[15px] font-semibold">
            Capacity (people)
          </Label>
          <Input
            id="capacity"
            type="number"
            value={formData.capacity}
            onChange={(e) =>
              setFormData({
                ...formData,
                capacity: Number.parseInt(e.target.value),
              })
            }
            min={1}
            className="border-3 border-primary/20 focus:border-primary shadow-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="numberOfCourts" className="text-[15px] font-semibold">
            Number of Courts
          </Label>
          <Input
            id="numberOfCourts"
            type="number"
            value={formData.numberOfCourts}
            onChange={(e) =>
              setFormData({
                ...formData,
                numberOfCourts: Number.parseInt(e.target.value) || 1,
              })
            }
            min={1}
            max={20}
            className="border-3 border-primary/20 focus:border-primary shadow-sm"
          />
        </div>
      </div>

      <div className="lg:block hidden">
        <Separator className="my-6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="operatingStart" className="text-[15px] font-semibold">
            Opening Time
          </Label>
          <Input
            id="operatingStart"
            type="time"
            value={formData.operatingStart}
            onChange={(e) =>
              setFormData({ ...formData, operatingStart: e.target.value })
            }
            className="border-3 border-primary/20 focus:border-primary shadow-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="operatingEnd" className="text-[15px] font-semibold">
            Closing Time
          </Label>
          <Input
            id="operatingEnd"
            type="time"
            value={formData.operatingEnd}
            onChange={(e) =>
              setFormData({ ...formData, operatingEnd: e.target.value })
            }
            className="border-3 border-primary/20 focus:border-primary shadow-sm"
          />
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="status" className="text-[15px] font-semibold">
            Status
          </Label>
          <Select
            value={formData.status}
            onValueChange={(value) =>
              setFormData({ ...formData, status: value })
            }
          >
            <SelectTrigger
              id="status"
              className="border-3 border-primary/20 focus:border-primary shadow-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">
                Inactive (Maintenance/Renovation)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        onClick={() => {
          setErrors({
            name: !formData.name.trim(),
            location: !formData.location.trim(),
            image: !imageFile && !isEdit,
            layoutImage: !layoutImageFile && !isEdit,
            description: !formData.description.trim(),
            rules: !formData.rules || formData.rules.length === 0,
          });
          onSubmit();
        }}
        className="w-full"
        disabled={
          formData.isMultiSport && formData.supportedSports?.length === 0
        }
      >
        {isEdit ? "Update Facility" : "Add Facility"}
      </Button>
    </div>
  );
}
