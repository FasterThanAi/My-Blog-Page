"use client";

import * as React from "react";
import { fetchUsersList, updateUserRoleAction, toggleUserSuspensionAction } from "@/app/actions/dashboard";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Avatar } from "@/components/ui/avatar";
import { Search, ChevronLeft, ChevronRight, UserMinus, UserCheck, ShieldAlert } from "lucide-react";

interface UserItem {
  id: string;
  role: "owner" | "customer";
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  suspended_at: string | null;
  created_at: string;
  postCount: number;
}

export function UsersDirectory() {
  const [users, setUsers] = React.useState<UserItem[]>([]);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [actioningId, setActioningId] = React.useState<string | null>(null);
  const { toast } = useToast();
  
  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const loadUsers = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUsersList({ search, page, limit });
      setUsers(data.users as unknown as UserItem[]);
      setTotalCount(data.count);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load users list", "error");
    } finally {
      setLoading(false);
    }
  }, [search, page, toast]);

  React.useEffect(() => {
    const handle = requestAnimationFrame(() => {
      loadUsers();
    });
    return () => cancelAnimationFrame(handle);
  }, [page, loadUsers]); // Reload on page changes. For search, we will trigger manually on button submit.

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  const handleRoleChange = async (userId: string, currentRole: "owner" | "customer") => {
    const newRole = currentRole === "owner" ? "customer" : "owner";
    const confirmMsg = `Are you sure you want to change this user's role to ${newRole}?`;
    if (!window.confirm(confirmMsg)) return;

    setActioningId(userId);
    try {
      const res = await updateUserRoleAction({ targetUserId: userId, newRole });
      if (res.success) {
        toast(`User role updated to ${newRole}`, "success");
        loadUsers();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update user role", "error");
    } finally {
      setActioningId(null);
    }
  };

  const handleSuspensionToggle = async (userId: string, isSuspended: boolean) => {
    const confirmMsg = isSuspended
      ? "Are you sure you want to unsuspend this user? They will be able to post and comment again."
      : "Are you sure you want to suspend this user? They will be blocked from creating posts, comments, and votes.";

    if (!window.confirm(confirmMsg)) return;

    setActioningId(userId);
    try {
      const res = await toggleUserSuspensionAction({
        targetUserId: userId,
        suspend: !isSuspended,
      });
      if (res.success) {
        toast(isSuspended ? "User unsuspended successfully" : "User suspended successfully", "success");
        loadUsers();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to toggle suspension state", "error");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2.5 max-w-md w-full">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username or display name..."
            className="pl-10 h-10.5 rounded-12 bg-raised border border-border/60 focus-ring text-13"
          />
        </div>
        <Button type="submit" size="sm" className="h-10.5 rounded-12 cursor-pointer">
          Search
        </Button>
      </form>

      {/* Users Table */}
      <Card className="border border-border/60 overflow-hidden bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-13">
            <thead>
              <tr className="border-b border-border/60 bg-raised/50 font-semibold text-muted text-11 uppercase tracking-wider select-none">
                <th className="px-6 py-3.5">User</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Joined Date</th>
                <th className="px-6 py-3.5 text-center">Posts</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-border/20" />
                        <div className="flex flex-col gap-1.5">
                          <div className="w-20 h-4 bg-border/20 rounded" />
                          <div className="w-24 h-3 bg-border/10 rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><div className="w-12 h-5 bg-border/20 rounded" /></td>
                    <td className="px-6 py-4"><div className="w-16 h-4 bg-border/20 rounded" /></td>
                    <td className="px-6 py-4 text-center"><div className="w-6 h-4 bg-border/20 rounded mx-auto" /></td>
                    <td className="px-6 py-4"><div className="w-24 h-8 bg-border/20 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted">
                    No users found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                users.map((item) => {
                  const isSuspended = !!item.suspended_at;
                  return (
                    <tr key={item.id} className="hover:bg-raised/20 transition-colors">
                      {/* User Info */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={item.avatar_url}
                            fallback={item.display_name || item.username || ""}
                            size="md"
                          />
                          <div className="flex flex-col truncate max-w-[200px]">
                            <span className="font-semibold text-text truncate">
                              {item.display_name || "Platform User"}
                            </span>
                            <span className="text-muted text-11 truncate">
                              @{item.username}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-6 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          item.role === "owner" 
                            ? "bg-accent/5 border-accent/10 text-accent"
                            : "bg-border/20 border-border text-muted"
                        }`}>
                          {item.role}
                        </span>
                      </td>

                      {/* Joined */}
                      <td className="px-6 py-3.5 text-muted text-12">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>

                      {/* Post Count */}
                      <td className="px-6 py-3.5 text-center font-mono font-medium text-text">
                        {item.postCount}
                      </td>

                      {/* Action buttons */}
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          {isSuspended && (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-500/5 px-2 py-0.5 rounded border border-red-500/10 mr-1.5 select-none">
                              <ShieldAlert className="w-3 h-3" />
                              Suspended
                            </span>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={actioningId !== null}
                            onClick={() => handleRoleChange(item.id, item.role)}
                            className="hover:bg-border/20"
                          >
                            Toggle Role
                          </Button>

                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={actioningId !== null}
                            onClick={() => handleSuspensionToggle(item.id, isSuspended)}
                            className={`min-w-[96px] h-8 rounded-8 ${
                              isSuspended 
                                ? "bg-accent/5 hover:bg-accent/10 text-accent border-accent/10" 
                                : "text-red-600 hover:text-red-700 hover:bg-red-500/10 border-red-500/10"
                            }`}
                          >
                            {isSuspended ? (
                              <>
                                <UserCheck className="w-3.5 h-3.5 mr-1" />
                                Unsuspend
                              </>
                            ) : (
                              <>
                                <UserMinus className="w-3.5 h-3.5 mr-1" />
                                Suspend
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border/60 px-6 py-4.5 bg-raised/20 select-none">
            <span className="text-12 text-muted">
              Page {page} of {totalPages} ({totalCount} total users)
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 1 || loading}
                onClick={() => setPage((prev) => prev - 1)}
                className="h-8 rounded-8 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page === totalPages || loading}
                onClick={() => setPage((prev) => prev + 1)}
                className="h-8 rounded-8 cursor-pointer"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
