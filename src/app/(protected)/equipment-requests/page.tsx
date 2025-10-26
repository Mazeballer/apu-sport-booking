"use client"

import { AuthGuard } from "@/components/auth-guard"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { equipmentRequests } from "@/lib/data"
import { getUserEmail } from "@/lib/auth"
import { PackageIcon, CalendarIcon, ClockIcon } from "lucide-react"
import { Separator } from "@/components/ui/separator"

const statusColors = {
  pending: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  approved: "bg-green-500/10 text-green-700 border-green-500/20",
  denied: "bg-red-500/10 text-red-700 border-red-500/20",
  issued: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  returned: "bg-gray-500/10 text-gray-700 border-gray-500/20",
}

export default function EquipmentRequestsPage() {
  const userEmail = getUserEmail()
  const userRequests = equipmentRequests.filter((r) => r.userEmail === userEmail)

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Equipment Requests</h1>
            <p className="text-muted-foreground text-lg">Track your equipment rental requests and their status</p>
          </div>

          {userRequests.length === 0 ? (
            <Card className="rounded-2xl shadow-md">
              <CardContent className="py-16 text-center">
                <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                  <PackageIcon className="w-12 h-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No equipment requests</h3>
                <p className="text-muted-foreground">
                  You can request equipment when booking a facility or from the equipment desk
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Desktop Table View */}
              <Card className="hidden md:block rounded-2xl shadow-md">
                <CardHeader>
                  <CardTitle>Your Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Facility</TableHead>
                        <TableHead>Request Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <PackageIcon className="h-4 w-4 text-primary" />
                              </div>
                              <span className="font-medium">{request.equipmentName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{request.facilityName}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                              {new Date(request.requestDate).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusColors[request.status]}>
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {request.notes ? (
                              <span className="text-sm text-muted-foreground">{request.notes}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground italic">No notes</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <ClockIcon className="h-4 w-4" />
                              {new Date(request.createdAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {userRequests.map((request) => (
                  <Card key={request.id} className="rounded-2xl shadow-md">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <PackageIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-bold">{request.equipmentName}</h3>
                              <p className="text-sm text-muted-foreground">{request.facilityName}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className={statusColors[request.status]}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </Badge>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground mb-1">Request Date</p>
                            <div className="flex items-center gap-2 font-medium">
                              <CalendarIcon className="h-4 w-4 text-primary" />
                              {new Date(request.requestDate).toLocaleDateString()}
                            </div>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-1">Submitted</p>
                            <div className="flex items-center gap-2 font-medium">
                              <ClockIcon className="h-4 w-4 text-primary" />
                              {new Date(request.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        {request.notes && (
                          <>
                            <Separator />
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">Notes</p>
                              <p className="text-sm">{request.notes}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  )
}
