'use client';

import { useState } from 'react';
import { equipmentRequests } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle,
  PackageX,
  Clock,
  CheckCircle,
  Search,
} from 'lucide-react';

export function EquipmentStatus() {
  const [searchQuery, setSearchQuery] = useState('');

  const filterRequests = (requests: typeof equipmentRequests) => {
    if (!searchQuery.trim()) return requests;
    return requests.filter((req) =>
      req.userEmail.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const today = new Date();
  const overdueEquipment = equipmentRequests.filter((req) => {
    if (req.status !== 'issued') return false;
    const requestDate = new Date(req.requestDate);
    const daysSinceRequest = Math.floor(
      (today.getTime() - requestDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceRequest > 7; // Consider overdue if issued for more than 7 days
  });

  const damagedEquipment = equipmentRequests.filter(
    (req) => req.status === 'returned' && req.returnCondition === 'damaged'
  );

  const lostEquipment = equipmentRequests.filter(
    (req) => req.status === 'returned' && req.returnCondition === 'lost'
  );

  const returnHistory = equipmentRequests.filter(
    (req) => req.status === 'returned'
  );

  const getConditionBadge = (condition?: string) => {
    switch (condition) {
      case 'good':
        return (
          <Badge
            variant="secondary"
            className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Good
          </Badge>
        );
      case 'damaged':
        return (
          <Badge
            variant="secondary"
            className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Damaged
          </Badge>
        );
      case 'lost':
        return (
          <Badge
            variant="secondary"
            className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
          >
            <PackageX className="h-3 w-3 mr-1" />
            Lost
          </Badge>
        );
      default:
        return <Badge variant="secondary">-</Badge>;
    }
  };

  const calculateDaysOverdue = (requestDate: string) => {
    const reqDate = new Date(requestDate);
    const daysSince = Math.floor(
      (today.getTime() - reqDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, daysSince - 7); // Assuming 7 days is the standard loan period
  };

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by student email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs defaultValue="overdue" className="w-full">
        <TabsList className="w-full md:grid md:grid-cols-4 flex overflow-x-auto">
          <TabsTrigger
            value="overdue"
            className="gap-2 whitespace-nowrap flex-shrink-0"
          >
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Overdue</span>
            <span className="sm:hidden">Over</span> (
            {filterRequests(overdueEquipment).length})
          </TabsTrigger>
          <TabsTrigger
            value="damaged"
            className="gap-2 whitespace-nowrap flex-shrink-0"
          >
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Damaged</span>
            <span className="sm:hidden">Dmg</span> (
            {filterRequests(damagedEquipment).length})
          </TabsTrigger>
          <TabsTrigger
            value="lost"
            className="gap-2 whitespace-nowrap flex-shrink-0"
          >
            <PackageX className="h-4 w-4" />
            Lost ({filterRequests(lostEquipment).length})
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="gap-2 whitespace-nowrap flex-shrink-0"
          >
            <CheckCircle className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
            <span className="sm:hidden">Hist</span> (
            {filterRequests(returnHistory).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overdue" className="space-y-4">
          {filterRequests(overdueEquipment).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No overdue equipment</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Email</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Qty Borrowed</TableHead>
                  <TableHead>Qty Outstanding</TableHead>
                  <TableHead>Issued Date</TableHead>
                  <TableHead>Days Overdue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filterRequests(overdueEquipment).map((req) => {
                  const daysOverdue = calculateDaysOverdue(req.requestDate);
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">
                        {req.userEmail}
                      </TableCell>
                      <TableCell>{req.equipmentName}</TableCell>
                      <TableCell>{req.facilityName}</TableCell>
                      <TableCell>{req.quantityBorrowed}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        >
                          {req.quantityBorrowed - req.quantityReturned}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(req.requestDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">{daysOverdue} days</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="damaged" className="space-y-4">
          {filterRequests(damagedEquipment).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No damaged equipment reported</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Email</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Qty Damaged</TableHead>
                  <TableHead>Damage Notes</TableHead>
                  <TableHead>Returned Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filterRequests(damagedEquipment).map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">
                      {req.userEmail}
                    </TableCell>
                    <TableCell>{req.equipmentName}</TableCell>
                    <TableCell>{req.facilityName}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                      >
                        {req.quantityReturned}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {req.damageNotes || 'No notes provided'}
                    </TableCell>
                    <TableCell>
                      {req.returnedAt
                        ? new Date(req.returnedAt).toLocaleDateString()
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="lost" className="space-y-4">
          {filterRequests(lostEquipment).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <PackageX className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No lost equipment reported</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Email</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Qty Lost</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Reported Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filterRequests(lostEquipment).map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">
                      {req.userEmail}
                    </TableCell>
                    <TableCell>{req.equipmentName}</TableCell>
                    <TableCell>{req.facilityName}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                      >
                        {req.quantityReturned}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {req.damageNotes || 'No notes provided'}
                    </TableCell>
                    <TableCell>
                      {req.returnedAt
                        ? new Date(req.returnedAt).toLocaleDateString()
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {filterRequests(returnHistory).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No return history yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Email</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Qty Returned</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Returned Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filterRequests(returnHistory).map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">
                      {req.userEmail}
                    </TableCell>
                    <TableCell>{req.equipmentName}</TableCell>
                    <TableCell>{req.facilityName}</TableCell>
                    <TableCell>{req.quantityReturned}</TableCell>
                    <TableCell>
                      {getConditionBadge(req.returnCondition)}
                    </TableCell>
                    <TableCell>
                      {req.returnedAt
                        ? new Date(req.returnedAt).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {req.damageNotes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
