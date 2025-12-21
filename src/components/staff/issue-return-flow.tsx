// components/staff/issue-return-flow.tsx
"use client";

import { useState, useTransition } from "react";
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
import { notify } from "@/lib/toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { X, Plus, AlertTriangle, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { EquipReturnCondition } from "@prisma/client";
import {
  issueEquipmentFromCounter,
  returnEquipmentFromCounter,
} from "@/app/(protected)/staff/issue-return-actions";

interface EquipmentOption {
  id: string;
  name: string;
  qtyAvailable: number;
  qtyTotal: number;
  facilityId: string;
  facilityName: string;
}

interface ApprovedRequestRow {
  id: string; // equipmentRequest id
  userEmail: string;
  facilityName: string;
  items: {
    equipmentId: string;
    equipmentName: string;
    qtyRequested: number;
  }[];
}

interface IssuedItemRow {
  id: string; // equipmentRequestItem id
  requestId: string;
  userEmail: string;
  equipmentId: string;
  equipmentName: string;
  facilityName: string;
  quantityBorrowed: number;
  quantityReturned: number;
}

interface EquipmentItemSelection {
  equipmentId: string;
  equipmentName: string;
  quantity: number;
  maxAvailable: number;
}

interface IssueReturnFlowProps {
  equipmentOptions: EquipmentOption[];
  approvedRequests: ApprovedRequestRow[];
  issuedItems: IssuedItemRow[];
}

export function IssueReturnFlow({
  equipmentOptions,
  approvedRequests,
  issuedItems,
}: IssueReturnFlowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [issueEmail, setIssueEmail] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<
    EquipmentItemSelection[]
  >([]);
  const [currentEquipmentId, setCurrentEquipmentId] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [selectedApprovedRequestId, setSelectedApprovedRequestId] = useState<
    string | null
  >(null);

  const [selectedIssuedRequest, setSelectedIssuedRequest] =
    useState<IssuedItemRow | null>(null);

  const [returnCondition, setReturnCondition] =
    useState<EquipReturnCondition>("good");
  const [damageNotes, setDamageNotes] = useState("");
  const [quantityReturning, setQuantityReturning] = useState(1);

  const [emailSearchQuery, setEmailSearchQuery] = useState("");
  const [issuingRequestId, setIssuingRequestId] = useState<string | null>(null);
  const [issuedRequestIds, setIssuedRequestIds] = useState<Set<string>>(
    () => new Set()
  );

  // ISSUE TAB LOGIC

  const handleAddEquipment = () => {
    if (!currentEquipmentId || currentQuantity < 1) return;

    const eq = equipmentOptions.find((e) => e.id === currentEquipmentId);
    if (!eq) return;

    const existingIndex = selectedEquipment.findIndex(
      (item) => item.equipmentId === currentEquipmentId
    );

    const safeQty = Math.min(currentQuantity, eq.qtyAvailable);

    if (existingIndex >= 0) {
      const updated = [...selectedEquipment];
      updated[existingIndex].quantity = Math.min(
        updated[existingIndex].quantity + currentQuantity,
        eq.qtyAvailable
      );
      setSelectedEquipment(updated);
    } else {
      setSelectedEquipment((prev) => [
        ...prev,
        {
          equipmentId: eq.id,
          equipmentName: eq.name,
          quantity: safeQty,
          maxAvailable: eq.qtyAvailable,
        },
      ]);
    }

    setCurrentEquipmentId("");
    setCurrentQuantity(1);
  };

  const handleRemoveEquipment = (equipmentId: string) => {
    setSelectedEquipment((prev) =>
      prev.filter((item) => item.equipmentId !== equipmentId)
    );
  };

  const handleUpdateQuantity = (equipmentId: string, newQuantity: number) => {
    setSelectedEquipment((prev) =>
      prev.map((item) =>
        item.equipmentId === equipmentId
          ? {
              ...item,
              quantity: Math.max(1, Math.min(newQuantity, item.maxAvailable)),
            }
          : item
      )
    );
  };

  const handleIssue = () => {
    if (!issueEmail || selectedEquipment.length === 0) return;

    if (!selectedApprovedRequestId) {
      notify.error("Please select an approved request first.");
      return;
    }

    // prevent issuing same request again in the same session (UX guard)
    if (issuedRequestIds.has(selectedApprovedRequestId)) {
      notify.error("This request has already been issued.");
      return;
    }

    // prevent double-click while request is sending
    if (issuingRequestId === selectedApprovedRequestId) {
      notify.error("Issuing in progress, please wait.");
      return;
    }

    const payloadItems = selectedEquipment.map((item) => ({
      equipmentId: item.equipmentId,
      qty: item.quantity,
    }));

    setIssuingRequestId(selectedApprovedRequestId);

    startTransition(async () => {
      try {
        await issueEquipmentFromCounter({
          equipmentRequestId: selectedApprovedRequestId,
          items: payloadItems,
        });

        // only set after success
        setIssuedRequestIds((prev) => {
          const next = new Set(prev);
          next.add(selectedApprovedRequestId);
          return next;
        });

        notify.success(
          `${selectedEquipment.length} item(s) issued to ${issueEmail}`
        );

        setIssueEmail("");
        setSelectedEquipment([]);
        setSelectedApprovedRequestId(null);
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Something went wrong";
        notify.error(message);
      } finally {
        setIssuingRequestId(null);
      }
    });
  };

  // RETURN TAB LOGIC

  const handleReturn = () => {
    if (!selectedIssuedRequest) return;

    const quantityOutstanding =
      selectedIssuedRequest.quantityBorrowed -
      selectedIssuedRequest.quantityReturned;

    if (quantityReturning < 1 || quantityReturning > quantityOutstanding) {
      notify.error(
        `Please enter a valid quantity between 1 and ${quantityOutstanding}`
      );
      return;
    }

    if (returnCondition === "damaged" && !damageNotes.trim()) {
      notify.error(
        "Please provide details about the damage before processing return."
      );
      return;
    }

    const requestItemId = selectedIssuedRequest.id;

    startTransition(async () => {
      try {
        await returnEquipmentFromCounter({
          requestItemId,
          quantity: quantityReturning,
          condition: returnCondition,
          damageNotes,
        });

        notify.success(`Processed return of ${quantityReturning} item(s)`);

        setSelectedIssuedRequest(null);
        setReturnCondition("good");
        setDamageNotes("");
        setQuantityReturning(1);
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Something went wrong";
        notify.error("Return failed");
      }
    });
  };

  const filteredIssuedRequests = issuedItems.filter((r) =>
    r.userEmail.toLowerCase().includes(emailSearchQuery.toLowerCase())
  );

  return (
    <Tabs defaultValue="issue" className="w-full">
      <TabsList className="grid w-full grid-cols-2 bg-transparent gap-2 p-0">
        <TabsTrigger
          value="issue"
          className="flex items-center justify-center gap-1.5 text-sm md:text-sm px-3 py-2.5 md:py-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 data-[state=active]:border-2 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-100 dark:data-[state=active]:border-blue-500 rounded-xl data-[state=inactive]:border-0 data-[state=inactive]:bg-muted/50 transition-all min-h-[44px]"
        >
          Issue Equipment
        </TabsTrigger>
        <TabsTrigger
          value="return"
          className="flex items-center justify-center gap-1.5 text-sm md:text-sm px-3 py-2.5 md:py-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 data-[state=active]:border-2 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-100 dark:data-[state=active]:border-blue-500 rounded-xl data-[state=inactive]:border-0 data-[state=inactive]:bg-muted/50 transition-all min-h-[44px]"
        >
          Return Equipment
        </TabsTrigger>
      </TabsList>

      {/* ISSUE TAB */}
      <TabsContent value="issue" className="space-y-6 pt-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="issue-email">Student Email</Label>
            <Input
              id="issue-email"
              type="email"
              placeholder="student@mail.apu.edu.my"
              value={issueEmail}
              onChange={(e) => setIssueEmail(e.target.value)}
              className="border-3 border-primary/20 focus:border-primary shadow-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Add Equipment</Label>
            <div className="flex gap-2">
              <Select
                value={currentEquipmentId}
                onValueChange={setCurrentEquipmentId}
              >
                <SelectTrigger className="flex-1 border-3 border-primary/20 focus:border-primary shadow-sm">
                  <SelectValue placeholder="Select equipment" />
                </SelectTrigger>
                <SelectContent>
                  {equipmentOptions.map((eq) => (
                    <SelectItem
                      key={eq.id}
                      value={eq.id}
                      disabled={eq.qtyAvailable === 0}
                    >
                      {eq.name} ({eq.qtyAvailable} available)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="1"
                max={
                  equipmentOptions.find((e) => e.id === currentEquipmentId)
                    ?.qtyAvailable || 1
                }
                value={currentQuantity}
                onChange={(e) =>
                  setCurrentQuantity(Number.parseInt(e.target.value) || 1)
                }
                className="w-20 border-3 border-primary/20 focus:border-primary shadow-sm"
                placeholder="Qty"
              />
              <Button
                type="button"
                size="icon"
                onClick={handleAddEquipment}
                disabled={!currentEquipmentId || isPending}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {selectedEquipment.length > 0 && (
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <Label className="text-sm font-semibold">
                Selected Equipment
              </Label>
              {selectedEquipment.map((item) => (
                <div
                  key={item.equipmentId}
                  className="flex items-center justify-between bg-card p-3 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="font-medium">{item.equipmentName}</span>
                    <Badge variant="secondary">Qty: {item.quantity}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max={item.maxAvailable}
                      value={item.quantity}
                      onChange={(e) =>
                        handleUpdateQuantity(
                          item.equipmentId,
                          Number.parseInt(e.target.value) || 1
                        )
                      }
                      className="w-16 h-8 border-3 border-primary/20 focus:border-primary shadow-sm"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveEquipment(item.equipmentId)}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {approvedRequests.length > 0 && (
            <div className="bg-muted/50 rounded-xl p-4">
              <h4 className="font-semibold mb-3 text-sm">Approved Requests</h4>
              <div className="space-y-2">
                {approvedRequests.map((request) => {
                  const isSelected = selectedApprovedRequestId === request.id;
                  const alreadyIssued = issuedRequestIds.has(request.id);
                  const inFlight = issuingRequestId === request.id;

                  return (
                    <div
                      key={request.id}
                      className="flex items-center justify-between text-sm p-2 rounded bg-card"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{request.userEmail}</p>
                        <p className="text-muted-foreground text-xs">
                          {request.facilityName}
                        </p>

                        <div className="mt-2 space-y-1">
                          {request.items.map((item) => (
                            <div
                              key={item.equipmentId}
                              className="flex items-center text-xs text-muted-foreground"
                            >
                              <span>{item.equipmentName}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        disabled={alreadyIssued || inFlight || isPending}
                        onClick={() => {
                          if (alreadyIssued) {
                            notify.error(
                              "This request has already been issued."
                            );
                            return;
                          }

                          if (isSelected) {
                            setSelectedApprovedRequestId(null);
                            setIssueEmail("");
                            setSelectedEquipment([]);
                            return;
                          }

                          const selections: EquipmentItemSelection[] = [];

                          for (const item of request.items) {
                            const eq = equipmentOptions.find(
                              (e) => e.id === item.equipmentId
                            );
                            if (!eq || eq.qtyAvailable <= 0) continue;

                            selections.push({
                              equipmentId: eq.id,
                              equipmentName: eq.name,
                              quantity: Math.min(
                                item.qtyRequested,
                                eq.qtyAvailable
                              ),
                              maxAvailable: eq.qtyAvailable,
                            });
                          }

                          if (selections.length === 0) {
                            notify.error(
                              "All items in this request are currently out of stock."
                            );
                            return;
                          }

                          setSelectedApprovedRequestId(request.id);
                          setIssueEmail(request.userEmail);
                          setSelectedEquipment(selections);
                        }}
                      >
                        {alreadyIssued
                          ? "Issued"
                          : inFlight
                          ? "Issuing..."
                          : isSelected
                          ? "Selected"
                          : "Select"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Button
            onClick={handleIssue}
            className="w-full"
            disabled={
              !issueEmail ||
              selectedEquipment.length === 0 ||
              isPending ||
              !selectedApprovedRequestId ||
              issuingRequestId === selectedApprovedRequestId ||
              issuedRequestIds.has(selectedApprovedRequestId)
            }
          >
            Issue Equipment ({selectedEquipment.length} item
            {selectedEquipment.length !== 1 ? "s" : ""})
          </Button>
        </div>
      </TabsContent>

      {/* RETURN TAB */}
      <TabsContent value="return" className="space-y-6 pt-6">
        <div className="space-y-4">
          {selectedIssuedRequest ? (
            <div className="bg-muted/50 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Selected for Return</h4>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedIssuedRequest(null);
                    setReturnCondition("good");
                    setDamageNotes("");
                    setQuantityReturning(1);
                  }}
                >
                  Clear
                </Button>
              </div>
              <div className="bg-card p-4 rounded-lg space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Student Email
                    </Label>
                    <p className="font-medium">
                      {selectedIssuedRequest.userEmail}
                    </p>
                  </div>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Equipment
                  </Label>
                  <p className="font-medium">
                    {selectedIssuedRequest.equipmentName}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Facility
                  </Label>
                  <p className="text-sm">
                    {selectedIssuedRequest.facilityName}
                  </p>
                </div>
                <Separator />
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Borrowed
                    </Label>
                    <p className="text-sm font-semibold">
                      {selectedIssuedRequest.quantityBorrowed}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Returned
                    </Label>
                    <p className="text-sm font-semibold text-green-600">
                      {selectedIssuedRequest.quantityReturned}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Outstanding
                    </Label>
                    <p className="text-sm font-semibold text-orange-600">
                      {selectedIssuedRequest.quantityBorrowed -
                        selectedIssuedRequest.quantityReturned}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity-returning">
                  Quantity Being Returned{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quantity-returning"
                  type="number"
                  min="1"
                  max={
                    selectedIssuedRequest.quantityBorrowed -
                    selectedIssuedRequest.quantityReturned
                  }
                  value={quantityReturning}
                  onChange={(e) =>
                    setQuantityReturning(Number.parseInt(e.target.value) || 1)
                  }
                  placeholder="Enter quantity"
                  className="border-3 border-primary/20 focus:border-primary shadow-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum:{" "}
                  {selectedIssuedRequest.quantityBorrowed -
                    selectedIssuedRequest.quantityReturned}
                </p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold">
                  Return Condition
                </Label>
                <RadioGroup
                  value={returnCondition}
                  onValueChange={(value) =>
                    setReturnCondition(value as EquipReturnCondition)
                  }
                >
                  <div className="flex items-center space-x-2 p-3 rounded-lg border bg-card">
                    <RadioGroupItem value="good" id="good" />
                    <Label htmlFor="good" className="flex-1 cursor-pointer">
                      <div className="font-medium">Good Condition</div>
                      <div className="text-xs text-muted-foreground">
                        Equipment returned without damage
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 p-3 rounded-lg border bg-card">
                    <RadioGroupItem value="damaged" id="damaged" />
                    <Label htmlFor="damaged" className="flex-1 cursor-pointer">
                      <div className="font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Damaged
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Equipment needs repair
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 p-3 rounded-lg border bg-card">
                    <RadioGroupItem value="lost" id="lost" />
                    <Label htmlFor="lost" className="flex-1 cursor-pointer">
                      <div className="font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        Lost
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Equipment cannot be returned
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 p-3 rounded-lg border bg-card">
                    <RadioGroupItem value="not_returned" id="not_returned" />
                    <Label
                      htmlFor="not_returned"
                      className="flex-1 cursor-pointer"
                    >
                      <div className="font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        Not Returned (Overdue)
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Equipment not returned yet
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {returnCondition === "damaged" && (
                <div className="space-y-2">
                  <Label htmlFor="damage-notes">
                    Damage Description{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="damage-notes"
                    value={damageNotes}
                    onChange={(e) => setDamageNotes(e.target.value)}
                    placeholder="Describe the damage in detail..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              )}

              <Button
                onClick={handleReturn}
                className="w-full"
                disabled={!selectedIssuedRequest || isPending}
              >
                Process Return ({quantityReturning} item
                {quantityReturning !== 1 ? "s" : ""})
              </Button>
            </div>
          ) : (
            <div className="bg-muted/50 rounded-xl p-4 text-center text-sm text-muted-foreground">
              Select an issued item below to process return
            </div>
          )}

          <Separator />

          {issuedItems.length > 0 && (
            <div className="bg-muted/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm">Currently Issued</h4>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search by student email..."
                    value={emailSearchQuery}
                    onChange={(e) => setEmailSearchQuery(e.target.value)}
                    className="pl-9 border-3 border-primary/20 focus:border-primary shadow-sm"
                  />
                </div>
              </div>

              {filteredIssuedRequests.length > 0 ? (
                <div className="space-y-2">
                  {filteredIssuedRequests.map((request) => {
                    const isSelected = selectedIssuedRequest?.id === request.id;
                    const outstanding =
                      request.quantityBorrowed - request.quantityReturned;
                    return (
                      <div
                        key={request.id}
                        className="flex items-center justify-between text-sm p-2 rounded bg-card"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{request.userEmail}</p>
                          <p className="text-muted-foreground text-xs">
                            {request.equipmentName} · {request.facilityName}
                          </p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              Borrowed: {request.quantityBorrowed}
                            </Badge>
                            {request.quantityReturned > 0 && (
                              <Badge
                                variant="outline"
                                className="text-xs text-green-600"
                              >
                                Returned: {request.quantityReturned}
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className="text-xs text-orange-600"
                            >
                              Outstanding: {outstanding}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedIssuedRequest(null);
                              setReturnCondition("good");
                              setDamageNotes("");
                              setQuantityReturning(1);
                            } else {
                              setSelectedIssuedRequest(request);
                              setReturnCondition("good");
                              setDamageNotes("");
                              setQuantityReturning(1);
                            }
                          }}
                        >
                          {isSelected ? "Selected" : "Select"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {emailSearchQuery ? (
                    <>
                      No issued equipment found for "{emailSearchQuery}"
                      <br />
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setEmailSearchQuery("")}
                        className="mt-2"
                      >
                        Clear search
                      </Button>
                    </>
                  ) : (
                    "No currently issued equipment"
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
