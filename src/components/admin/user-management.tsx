'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
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
import { PlusIcon, SearchIcon, TrashIcon, AlertCircleIcon } from 'lucide-react';
import { notify } from '@/lib/toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '@/components/ui/card';

/** Debounce helper (fires after typing stops) */
function useDebounce<T>(value: T, delay = 450) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

type Role = 'student' | 'staff' | 'admin';
type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
};

type UserManagementProps = {
  initialUsers?: UserRow[];
  initialTotal?: number;
  initialQuery?: string;
  initialPage?: number;
  pageSize?: number;
};

export function UserManagement({
  initialUsers = [],
  initialTotal = 0,
  initialQuery = '',
  initialPage = 1,
  pageSize = 20,
}: UserManagementProps) {
  const isMobile = useIsMobile();

  // list + paging
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const pageSizeLocal = pageSize;

  // ui states
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(searchQuery, 450);
  const [showAddForm, setShowAddForm] = useState(false);
  const [pendingRoleChanges, setPendingRoleChanges] = useState<
    Record<string, Role>
  >({});
  const [userToDelete, setUserToDelete] = useState<UserRow | null>(null);
  const [showRoleChangeConfirm, setShowRoleChangeConfirm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    name: '',
    role: 'student' as Role,
  });

  // Fetch users (debounced + refreshKey after mutations)
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const res = await fetch(
          `/api/admin/users?query=${encodeURIComponent(
            debouncedQuery
          )}&page=${page}&pageSize=${pageSizeLocal}`,
          { signal: controller.signal }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch users');
        setUsers(json.users || []);
        setTotal(json.total || 0);
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          notify.error(`Failed to load users: ${e.message}`);
        }
      }
    };
    load();
    return () => controller.abort();
  }, [debouncedQuery, page, refreshKey]);

  // If the backend delivers a fresh list, drop any pending changes that match originals
  useEffect(() => {
    setPendingRoleChanges((prev) => {
      const next = { ...prev };
      for (const [id, newRole] of Object.entries(prev)) {
        const original = users.find((u) => u.id === id)?.role;
        if (!original || original === newRole) {
          delete next[id];
        }
      }
      return next;
    });
  }, [users]);

  const filteredUsers = users;

  const handleAddUser = async () => {
    // Required fields
    if (!newUser.email || !newUser.password || !newUser.name) {
      notify.error('Please fill in all required fields.');
      return;
    }
    // Password rule
    if (newUser.password.length < 8) {
      notify.warning('Password must be at least 8 characters long.');
      return;
    }
    // Basic email check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email)) {
      notify.warning('Please enter a valid email address.');
      return;
    }

    try {
      setCreating(true);
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create user');

      // refresh list
      setShowAddForm(false);
      setNewUser({ email: '', password: '', name: '', role: 'student' });
      setPage(1);
      setSearchQuery('');
      setRefreshKey((k) => k + 1);

      notify.success('User created successfully!');
    } catch (e: any) {
      notify.error(`Failed to create user: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleRoleSelect = (userId: string, newRole: Role) => {
    const original = users.find((u) => u.id === userId)?.role;

    setPendingRoleChanges((prev) => {
      if (!original) return prev; // user not found, ignore

      const next = { ...prev };
      if (newRole === original) {
        delete next[userId]; // back to original → remove pending change
      } else {
        next[userId] = newRole; // track changed value
      }
      return next;
    });
  };

  const handleConfirmRoleChanges = () => {
    if (Object.keys(pendingRoleChanges).length === 0) {
      notify.info('Nothing to update.');
      return;
    }
    setShowRoleChangeConfirm(true);
  };

  const applyRoleChanges = async () => {
    const entries = Object.entries(pendingRoleChanges).filter(([id, role]) => {
      const original = users.find((u) => u.id === id)?.role;
      return original && original !== role;
    });

    if (entries.length === 0) {
      notify.info('Nothing to update.');
      return;
    }

    // optimistic UI
    const prevUsers = users;
    setUsers((list) =>
      list.map((u) => {
        const found = entries.find(([id]) => id === u.id);
        return found ? { ...u, role: found[1] as Role } : u;
      })
    );

    try {
      await Promise.all(
        entries.map(async ([id, role]) => {
          const res = await fetch(`/api/admin/users/${id}/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role }),
          });
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error || 'Failed to update role');
          }
        })
      );
      setPendingRoleChanges({});
      notify.success(`${entries.length} user role(s) updated successfully`);
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      setUsers(prevUsers); // rollback
      notify.error(e.message || 'Update failed');
    }
  };

  const handleCancelRoleChanges = () => {
    setPendingRoleChanges({});
    notify.info('Role changes discarded.');
  };

  const handleDeleteUser = async (userId: string) => {
    const prev = users;
    setUsers(users.filter((u) => u.id !== userId)); // optimistic
    setUserToDelete(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete user');

      setRefreshKey((k) => k + 1);
      notify.success('User deleted successfully');
    } catch (e: any) {
      setUsers(prev); // rollback
      notify.error(`Failed to delete user: ${e.message}`);
    }
  };

  const getRoleBadgeVariant = (role: string) =>
    role === 'admin'
      ? 'destructive'
      : role === 'staff'
      ? 'default'
      : 'secondary';

  const getRoleBadgeClassName = (role: string) =>
    role === 'student'
      ? 'bg-green-200 text-green-950 hover:bg-green-200 dark:bg-green-900 dark:text-green-50 border-green-300 dark:border-green-800'
      : '';

  const hasPendingChanges = Object.keys(pendingRoleChanges).length > 0;

  const pendingList = useMemo(
    () =>
      users
        .filter((u) => pendingRoleChanges[u.id])
        .map((u) => ({
          name: u.name,
          email: u.email,
          currentRole: u.role,
          newRole: pendingRoleChanges[u.id]!,
        })),
    [users, pendingRoleChanges]
  );

  const showingCount = Math.min(
    pageSize,
    Math.max(0, total - (page - 1) * pageSize)
  );

  return (
    <div className="space-y-6">
      {/* Search + Add */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md w-full">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email, name, or role..."
            value={searchQuery}
            onChange={(e) => {
              setPage(1);
              setSearchQuery(e.target.value);
            }}
            className="pl-10 border-3 border-primary/20 focus:border-primary shadow-sm"
          />
        </div>
        <Button
          onClick={() => setShowAddForm((s) => !s)}
          className="gap-2 w-full sm:w-auto"
        >
          <PlusIcon className="h-4 w-4" />
          Add New User
        </Button>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <div className="border rounded-lg p-6 space-y-4 bg-card">
          <h3 className="text-lg font-bold">Create New User</h3>
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
                className="border-3 border-primary/20 focus:border-primary shadow-sm"
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
                className="border-3 border-primary/20 focus:border-primary shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={newUser.password}
                onChange={(e) =>
                  setNewUser({ ...newUser, password: e.target.value })
                }
                className="border-3 border-primary/20 focus:border-primary shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(value: Role) =>
                  setNewUser({ ...newUser, role: value })
                }
              >
                <SelectTrigger
                  id="role"
                  className="border-3 border-primary/20 focus:border-primary shadow-sm"
                >
                  <Badge
                    variant={getRoleBadgeVariant(newUser.role)}
                    className={`capitalize ${getRoleBadgeClassName(
                      newUser.role
                    )}`}
                  >
                    {newUser.role}
                  </Badge>
                </SelectTrigger>
                <SelectContent className="border-2">
                  <SelectItem value="student">
                    <Badge
                      variant="secondary"
                      className="bg-green-200 text-green-950 border-green-300 capitalize"
                    >
                      Student
                    </Badge>
                  </SelectItem>
                  <SelectItem value="staff">
                    <Badge variant="default" className="capitalize">
                      Staff
                    </Badge>
                  </SelectItem>
                  <SelectItem value="admin">
                    <Badge variant="destructive" className="capitalize">
                      Admin
                    </Badge>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser} disabled={creating}>
              {creating ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </div>
      )}

      {/* Pending changes banner */}
      {hasPendingChanges && (
        <div className="border-2 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 flex flex-col sm:flex-row items-start gap-3 shadow-sm">
          <AlertCircleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-semibold">Pending Role Changes</h4>
            <p className="text-sm">
              You have {Object.keys(pendingRoleChanges).length} pending
              change(s). Click “Confirm Changes” to apply.
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelRoleChanges}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmRoleChanges}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Confirm Changes
            </Button>
          </div>
        </div>
      )}

      {/* Users table / cards */}
      {isMobile ? (
        <div className="space-y-4">
          {filteredUsers.length === 0 ? (
            <Card>
              <CardContent className="text-center text-muted-foreground py-12">
                No users found
              </CardContent>
            </Card>
          ) : (
            filteredUsers.map((user) => {
              const displayRole = pendingRoleChanges[user.id] || user.role;
              const hasPendingChange = !!pendingRoleChanges[user.id];
              return (
                <Card
                  key={user.id}
                  className={
                    hasPendingChange
                      ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/10'
                      : ''
                  }
                >
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold">{user.name}</h3>
                        <p className="text-sm text-muted-foreground break-all">
                          {user.email}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created:{' '}
                          {new Date(user.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Role
                      </Label>
                      <Select
                        value={displayRole}
                        onValueChange={(v: Role) =>
                          handleRoleSelect(user.id, v)
                        }
                      >
                        <SelectTrigger className="w-full mt-1 border-3 border-primary/20 focus:border-primary shadow-sm">
                          <Badge
                            variant={getRoleBadgeVariant(displayRole)}
                            className={`capitalize ${getRoleBadgeClassName(
                              displayRole
                            )}`}
                          >
                            {displayRole}
                            {hasPendingChange && ' *'}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent className="border-2">
                          <SelectItem value="student">
                            <Badge
                              variant="secondary"
                              className="bg-green-200 text-green-950 border-green-300 capitalize"
                            >
                              Student
                            </Badge>
                          </SelectItem>
                          <SelectItem value="staff">
                            <Badge variant="default" className="capitalize">
                              Staff
                            </Badge>
                          </SelectItem>
                          <SelectItem value="admin">
                            <Badge variant="destructive" className="capitalize">
                              Admin
                            </Badge>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUserToDelete(user)}
                      className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/20"
                    >
                      <TrashIcon className="h-4 w-4 mr-2" /> Delete User
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-bold">Name</TableHead>
                <TableHead className="font-bold">Email</TableHead>
                <TableHead className="font-bold">Role</TableHead>
                <TableHead className="font-bold">Created</TableHead>
                <TableHead className="text-right font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-12"
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
                      className={`hover:bg-muted/50 transition-colors ${
                        hasPendingChange
                          ? 'bg-amber-50/50 dark:bg-amber-950/10 border-l-4 border-l-amber-500'
                          : ''
                      }`}
                    >
                      <TableCell className="font-semibold">
                        {user.name}
                      </TableCell>
                      <TableCell className="font-medium">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={displayRole}
                          onValueChange={(v: Role) =>
                            handleRoleSelect(user.id, v)
                          }
                        >
                          <SelectTrigger className="w-[160px] border-3 border-primary/20 focus:border-primary shadow-sm">
                            <Badge
                              variant={getRoleBadgeVariant(displayRole)}
                              className={`capitalize ${getRoleBadgeClassName(
                                displayRole
                              )}`}
                            >
                              {displayRole}
                              {hasPendingChange && ' *'}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent className="border-2">
                            <SelectItem value="student">
                              <Badge
                                variant="secondary"
                                className="bg-green-200 text-green-950 border-green-300 capitalize"
                              >
                                Student
                              </Badge>
                            </SelectItem>
                            <SelectItem value="staff">
                              <Badge variant="default" className="capitalize">
                                Staff
                              </Badge>
                            </SelectItem>
                            <SelectItem value="admin">
                              <Badge
                                variant="destructive"
                                className="capitalize"
                              >
                                Admin
                              </Badge>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="font-medium">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setUserToDelete(user)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30"
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

          {/* Pager */}
          <div className="flex items-center justify-between p-3 text-sm">
            <div>
              Page {page} • Showing {showingCount} of {total}
            </div>
            <div className="space-x-2">
              <Button
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={`rounded-md bg-[#0A66C2] text-white font-semibold px-4 py-2 transition-colors ${
                  page <= 1
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-[#004C99]'
                }`}
              >
                Prev
              </Button>

              <Button
                size="sm"
                disabled={page * pageSize >= total}
                onClick={() => setPage((p) => p + 1)}
                className={`rounded-md bg-[#0A66C2] text-white font-semibold px-4 py-2 transition-colors ${
                  page * pageSize >= total
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-[#004C99]'
                }`}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="flex flex-wrap gap-3 text-sm bg-muted/50 rounded-lg p-4 border">
        <Stat label="Total Users" value={users.length} />
        <Dot />
        <Stat
          label="Admins"
          value={users.filter((u) => u.role === 'admin').length}
          className="text-red-600 dark:text-red-400"
        />
        <Dot />
        <Stat
          label="Staff"
          value={users.filter((u) => u.role === 'staff').length}
          className="text-blue-600 dark:text-blue-400"
        />
        <Dot />
        <Stat
          label="Students"
          value={users.filter((u) => u.role === 'student').length}
          className="text-green-600 dark:text-green-400"
        />
      </div>

      {/* Delete dialog */}
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
              <div className="mt-3 p-4 bg-muted rounded-lg border">
                <div className="font-semibold text-foreground">
                  {userToDelete?.name}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
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

      {/* Confirm role changes */}
      <AlertDialog
        open={showRoleChangeConfirm}
        onOpenChange={setShowRoleChangeConfirm}
      >
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Role Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to change the roles for{' '}
              {Object.keys(pendingRoleChanges).length} user(s).
              <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                {pendingList.map((c, i) => (
                  <div key={i} className="p-4 bg-muted rounded-lg border">
                    <div className="font-semibold text-foreground">
                      {c.name}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {c.email}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge
                        variant={getRoleBadgeVariant(c.currentRole)}
                        className={`capitalize font-medium ${getRoleBadgeClassName(
                          c.currentRole
                        )}`}
                      >
                        {c.currentRole}
                      </Badge>
                      <span className="text-muted-foreground font-medium">
                        →
                      </span>
                      <Badge
                        variant={getRoleBadgeVariant(c.newRole)}
                        className={`capitalize font-medium ${getRoleBadgeClassName(
                          c.newRole
                        )}`}
                      >
                        {c.newRole}
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

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: number | string;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold">{label}:</span>
      <span className={`font-bold ${className || ''}`}>{value}</span>
    </div>
  );
}

function Dot() {
  return <span className="text-muted-foreground">•</span>;
}
