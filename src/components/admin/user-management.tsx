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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import { users as initialUsers, type User } from '@/lib/data';
import { PlusIcon, SearchIcon, TrashIcon, AlertCircleIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function UserManagement() {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [pendingRoleChanges, setPendingRoleChanges] = useState<
    Record<string, 'student' | 'staff' | 'admin'>
  >({});
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showRoleChangeConfirm, setShowRoleChangeConfirm] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    name: '',
    role: 'student' as 'student' | 'staff' | 'admin',
  });
  const { toast } = useToast();

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddUser = () => {
    if (!newUser.email || !newUser.password || !newUser.name) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    const user: User = {
      id: `u${users.length + 1}`,
      email: newUser.email,
      password: newUser.password,
      name: newUser.name,
      role: newUser.role,
      createdAt: new Date().toISOString(),
    };

    setUsers([...users, user]);
    setNewUser({ email: '', password: '', name: '', role: 'student' });
    setShowAddForm(false);
    toast({
      title: 'Success',
      description: 'User created successfully',
    });
  };

  const handleRoleSelect = (
    userId: string,
    newRole: 'student' | 'staff' | 'admin'
  ) => {
    setPendingRoleChanges({ ...pendingRoleChanges, [userId]: newRole });
  };

  const handleConfirmRoleChanges = () => {
    setShowRoleChangeConfirm(true);
  };

  const applyRoleChanges = () => {
    setUsers(
      users.map((user) => {
        if (pendingRoleChanges[user.id]) {
          return { ...user, role: pendingRoleChanges[user.id] };
        }
        return user;
      })
    );
    setPendingRoleChanges({});
    setShowRoleChangeConfirm(false);
    toast({
      title: 'Success',
      description: `${
        Object.keys(pendingRoleChanges).length
      } user role(s) updated successfully`,
    });
  };

  const handleCancelRoleChanges = () => {
    setPendingRoleChanges({});
    toast({
      title: 'Cancelled',
      description: 'Role changes discarded',
    });
  };

  const handleDeleteUser = (userId: string) => {
    setUsers(users.filter((user) => user.id !== userId));
    setUserToDelete(null);
    toast({
      title: 'Success',
      description: 'User deleted successfully',
    });
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'staff':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const hasPendingChanges = Object.keys(pendingRoleChanges).length > 0;

  const getPendingChangesList = () => {
    return users
      .filter((user) => pendingRoleChanges[user.id])
      .map((user) => ({
        name: user.name,
        email: user.email,
        currentRole: user.role,
        newRole: pendingRoleChanges[user.id],
      }));
  };

  return (
    <div className="space-y-6">
      {/* Search and Add User Section */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email, name, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-2">
          <PlusIcon className="h-4 w-4" />
          Add New User
        </Button>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <div className="border rounded-lg p-6 space-y-4 bg-muted/50">
          <h3 className="text-lg font-semibold">Create New User</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={newUser.name}
                onChange={(e) =>
                  setNewUser({ ...newUser, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@mail.apu.edu.my"
                value={newUser.email}
                onChange={(e) =>
                  setNewUser({ ...newUser, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={newUser.password}
                onChange={(e) =>
                  setNewUser({ ...newUser, password: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(value: any) =>
                  setNewUser({ ...newUser, role: value })
                }
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser}>Create User</Button>
          </div>
        </div>
      )}

      {hasPendingChanges && (
        <div className="border border-amber-500 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircleIcon className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-semibold text-amber-900 dark:text-amber-100">
              Pending Role Changes
            </h4>
            <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
              You have {Object.keys(pendingRoleChanges).length} pending role
              change(s). Click "Confirm Changes" to apply them.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelRoleChanges}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirmRoleChanges}>
              Confirm Changes
            </Button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const displayRole = pendingRoleChanges[user.id] || user.role;
                const hasPendingChange = !!pendingRoleChanges[user.id];

                return (
                  <TableRow
                    key={user.id}
                    className={
                      hasPendingChange
                        ? 'bg-amber-50/50 dark:bg-amber-950/10'
                        : ''
                    }
                  >
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Select
                        value={displayRole}
                        onValueChange={(value: any) =>
                          handleRoleSelect(user.id, value)
                        }
                      >
                        <SelectTrigger className="w-36 border-[3px] border-foreground/60 bg-background hover:bg-accent hover:border-foreground/80">
                          <Badge
                            variant={getRoleBadgeVariant(displayRole)}
                            className="capitalize"
                          >
                            {displayRole}
                            {hasPendingChange && ' *'}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-card-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUserToDelete(user)}
                        className="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-900"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span className="font-medium">Total Users: {users.length}</span>
        <span>•</span>
        <span className="font-medium">
          Admins: {users.filter((u) => u.role === 'admin').length}
        </span>
        <span>•</span>
        <span className="font-medium">
          Staff: {users.filter((u) => u.role === 'staff').length}
        </span>
        <span>•</span>
        <span className="font-semibold">
          Students: {users.filter((u) => u.role === 'student').length}
        </span>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!userToDelete}
        onOpenChange={(open) => !open && setUserToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to delete this user?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              user account for:
              <div className="mt-2 p-3 bg-muted rounded-md">
                <div className="font-semibold">{userToDelete?.name}</div>
                <div className="text-sm text-muted-foreground">
                  {userToDelete?.email}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDelete && handleDeleteUser(userToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showRoleChangeConfirm}
        onOpenChange={setShowRoleChangeConfirm}
      >
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Role Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to change the roles for{' '}
              {Object.keys(pendingRoleChanges).length} user(s). Please review
              the changes below:
              <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                {getPendingChangesList().map((change, index) => (
                  <div key={index} className="p-3 bg-muted rounded-md border">
                    <div className="font-semibold">{change.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {change.email}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        variant={getRoleBadgeVariant(change.currentRole)}
                        className="capitalize"
                      >
                        {change.currentRole}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge
                        variant={getRoleBadgeVariant(change.newRole)}
                        className="capitalize"
                      >
                        {change.newRole}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applyRoleChanges}>
              Confirm and Apply Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
