'use client';

import { useState } from 'react';
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
import { equipment, equipmentRequests, equipmentMaintenance } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { X, Plus, AlertTriangle, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface EquipmentItem {
  equipmentId: string;
  equipmentName: string;
  quantity: number;
  maxAvailable: number;
}

export function IssueReturnFlow() {
  const { toast } = useToast();
  const [issueEmail, setIssueEmail] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem[]>(
    []
  );
  const [currentEquipmentId, setCurrentEquipmentId] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [selectedApprovedRequestId, setSelectedApprovedRequestId] = useState<
    string | null
  >(null);

  const [selectedIssuedRequest, setSelectedIssuedRequest] = useState<
    (typeof equipmentRequests)[0] | null
  >(null);

  const [returnCondition, setReturnCondition] = useState<
    'good' | 'damaged' | 'lost' | 'not_returned'
  >('good');
  const [damageNotes, setDamageNotes] = useState('');
  const [quantityReturning, setQuantityReturning] = useState(1);

  const [emailSearchQuery, setEmailSearchQuery] = useState('');

  const approvedRequests = equipmentRequests.filter(
    (r) => r.status === 'approved'
  );

  const handleAddEquipment = () => {
    if (!currentEquipmentId || currentQuantity < 1) return;

    const eq = equipment.find((e) => e.id === currentEquipmentId);
    if (!eq) return;

    const existingIndex = selectedEquipment.findIndex(
      (item) => item.equipmentId === currentEquipmentId
    );

    if (existingIndex >= 0) {
      const updated = [...selectedEquipment];
      updated[existingIndex].quantity = Math.min(
        updated[existingIndex].quantity + currentQuantity,
        eq.qtyAvailable
      );
      setSelectedEquipment(updated);
    } else {
      setSelectedEquipment([
        ...selectedEquipment,
        {
          equipmentId: eq.id,
          equipmentName: eq.name,
          quantity: Math.min(currentQuantity, eq.qtyAvailable),
          maxAvailable: eq.qtyAvailable,
        },
      ]);
    }

    setCurrentEquipmentId('');
    setCurrentQuantity(1);
  };

  const handleRemoveEquipment = (equipmentId: string) => {
    setSelectedEquipment(
      selectedEquipment.filter((item) => item.equipmentId !== equipmentId)
    );
  };

  const handleUpdateQuantity = (equipmentId: string, newQuantity: number) => {
    setSelectedEquipment(
      selectedEquipment.map((item) =>
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

    selectedEquipment.forEach((item) => {
      const eq = equipment.find((e) => e.id === item.equipmentId);
      if (eq) {
        eq.qtyAvailable = Math.max(0, eq.qtyAvailable - item.quantity);
        equipmentRequests.push({
          id: `er${Date.now()}_${item.equipmentId}`,
          userId: 'current_user',
          userEmail: issueEmail,
          equipmentId: item.equipmentId,
          equipmentName: item.equipmentName,
          facilityId: eq.facilityId,
          facilityName: 'Current Facility',
          requestDate: new Date().toISOString().split('T')[0],
          status: 'issued',
          createdAt: new Date().toISOString(),
          quantityBorrowed: item.quantity,
          quantityReturned: 0,
        });
      }
    });

    toast({
      title: 'Equipment Issued',
      description: `${selectedEquipment.length} item(s) issued to ${issueEmail}`,
    });

    setIssueEmail('');
    setSelectedEquipment([]);
    setSelectedApprovedRequestId(null);
  };

  const handleReturn = () => {
    if (!selectedIssuedRequest) return;

    const quantityOutstanding =
      selectedIssuedRequest.quantityBorrowed -
      selectedIssuedRequest.quantityReturned;

    if (quantityReturning < 1 || quantityReturning > quantityOutstanding) {
      toast({
        title: 'Invalid Quantity',
        description: `Please enter a valid quantity between 1 and ${quantityOutstanding}`,
        variant: 'destructive',
      });
      return;
    }

    if (returnCondition === 'damaged' && !damageNotes.trim()) {
      toast({
        title: 'Damage Notes Required',
        description:
          'Please provide details about the damage before processing return.',
        variant: 'destructive',
      });
      return;
    }

    const eq = equipment.find(
      (e) => e.id === selectedIssuedRequest.equipmentId
    );

    if (eq) {
      selectedIssuedRequest.quantityReturned += quantityReturning;
      const newOutstanding =
        selectedIssuedRequest.quantityBorrowed -
        selectedIssuedRequest.quantityReturned;

      if (newOutstanding === 0) {
        selectedIssuedRequest.status = 'returned';
        selectedIssuedRequest.returnedAt = new Date().toISOString();
      }

      selectedIssuedRequest.returnCondition = returnCondition;
      selectedIssuedRequest.damageNotes = damageNotes;

      switch (returnCondition) {
        case 'good':
          eq.qtyAvailable = Math.min(
            eq.qtyTotal,
            eq.qtyAvailable + quantityReturning
          );
          toast({
            title: 'Equipment Returned',
            description: `${quantityReturning} ${
              eq.name
            }(s) returned in good condition. ${
              newOutstanding > 0
                ? `${newOutstanding} still outstanding.`
                : 'All items returned.'
            }`,
          });
          break;

        case 'damaged':
          for (let i = 0; i < quantityReturning; i++) {
            equipmentMaintenance.push({
              id: `maint${Date.now()}_${i}`,
              equipmentId: eq.id,
              equipmentName: eq.name,
              facilityId: eq.facilityId,
              requestId: selectedIssuedRequest.id,
              userEmail: selectedIssuedRequest.userEmail,
              damageDescription: damageNotes,
              reportedAt: new Date().toISOString(),
              status: 'pending_repair',
            });
          }
          toast({
            title: 'Damaged Equipment Reported',
            description: `${quantityReturning} ${
              eq.name
            }(s) marked for repair. ${
              newOutstanding > 0 ? `${newOutstanding} still outstanding.` : ''
            }`,
            variant: 'destructive',
          });
          break;

        case 'lost':
          eq.qtyTotal = Math.max(0, eq.qtyTotal - quantityReturning);
          toast({
            title: 'Equipment Marked as Lost',
            description: `${quantityReturning} ${eq.name}(s) marked as lost. ${
              newOutstanding > 0 ? `${newOutstanding} still outstanding.` : ''
            }`,
            variant: 'destructive',
          });
          break;

        case 'not_returned':
          selectedIssuedRequest.status = 'issued';
          toast({
            title: 'Equipment Marked Overdue',
            description: `${quantityReturning} ${eq.name}(s) overdue. Follow-up required with ${selectedIssuedRequest.userEmail}`,
            variant: 'destructive',
          });
          break;
      }

      setSelectedIssuedRequest(null);
      setReturnCondition('good');
      setDamageNotes('');
      setQuantityReturning(1);
    }
  };

  const filteredIssuedRequests = equipmentRequests
    .filter((r) => r.status === 'issued')
    .filter((r) =>
      r.userEmail.toLowerCase().includes(emailSearchQuery.toLowerCase())
    );

  return (
    <Tabs defaultValue="issue" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="issue">Issue Equipment</TabsTrigger>
        <TabsTrigger value="return">Return Equipment</TabsTrigger>
      </TabsList>

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
            />
          </div>

          <div className="space-y-2">
            <Label>Add Equipment</Label>
            <div className="flex gap-2">
              <Select
                value={currentEquipmentId}
                onValueChange={setCurrentEquipmentId}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select equipment" />
                </SelectTrigger>
                <SelectContent>
                  {equipment.map((eq) => (
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
                  equipment.find((e) => e.id === currentEquipmentId)
                    ?.qtyAvailable || 1
                }
                value={currentQuantity}
                onChange={(e) =>
                  setCurrentQuantity(Number.parseInt(e.target.value) || 1)
                }
                className="w-20"
                placeholder="Qty"
              />
              <Button
                type="button"
                size="icon"
                onClick={handleAddEquipment}
                disabled={!currentEquipmentId}
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
                      className="w-16 h-8"
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
                  return (
                    <div
                      key={request.id}
                      className="flex items-center justify-between text-sm p-2 rounded bg-card"
                    >
                      <div>
                        <p className="font-medium">{request.userEmail}</p>
                        <p className="text-muted-foreground text-xs">
                          {request.equipmentName}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={isSelected ? 'default' : 'outline'}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedApprovedRequestId(null);
                            setIssueEmail('');
                            setSelectedEquipment([]);
                          } else {
                            setSelectedApprovedRequestId(request.id);
                            setIssueEmail(request.userEmail);
                            const eq = equipment.find(
                              (e) => e.id === request.equipmentId
                            );
                            if (eq) {
                              setSelectedEquipment([
                                {
                                  equipmentId: eq.id,
                                  equipmentName: eq.name,
                                  quantity: 1,
                                  maxAvailable: eq.qtyAvailable,
                                },
                              ]);
                            }
                          }
                        }}
                      >
                        {isSelected ? 'Selected' : 'Select'}
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
            disabled={!issueEmail || selectedEquipment.length === 0}
          >
            Issue Equipment ({selectedEquipment.length} item
            {selectedEquipment.length !== 1 ? 's' : ''})
          </Button>
        </div>
      </TabsContent>

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
                    setReturnCondition('good');
                    setDamageNotes('');
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
                  Quantity Being Returned{' '}
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
                />
                <p className="text-xs text-muted-foreground">
                  Maximum:{' '}
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
                  onValueChange={(value: any) => setReturnCondition(value)}
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

              {returnCondition === 'damaged' && (
                <div className="space-y-2">
                  <Label htmlFor="damage-notes">
                    Damage Description{' '}
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
                disabled={!selectedIssuedRequest}
              >
                Process Return ({quantityReturning} item
                {quantityReturning !== 1 ? 's' : ''})
              </Button>
            </div>
          ) : (
            <div className="bg-muted/50 rounded-xl p-4 text-center text-sm text-muted-foreground">
              Select an issued item below to process return
            </div>
          )}

          <Separator />

          {equipmentRequests.filter((r) => r.status === 'issued').length >
            0 && (
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
                    className="pl-9"
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
                            {request.equipmentName}
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
                          variant={isSelected ? 'default' : 'outline'}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedIssuedRequest(null);
                              setReturnCondition('good');
                              setDamageNotes('');
                              setQuantityReturning(1);
                            } else {
                              setSelectedIssuedRequest(request);
                              setReturnCondition('good');
                              setDamageNotes('');
                              setQuantityReturning(Math.min(1, outstanding));
                            }
                          }}
                        >
                          {isSelected ? 'Selected' : 'Select'}
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
                        onClick={() => setEmailSearchQuery('')}
                        className="mt-2"
                      >
                        Clear search
                      </Button>
                    </>
                  ) : (
                    'No currently issued equipment'
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
