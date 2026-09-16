import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteMember, listMembers, removeMember, updateMemberRole } from "@/lib/collab";

export default function MembersPanel({
  projectId,
  isOwner,
}: {
  projectId: string;
  isOwner: boolean;
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");

  const members = useQuery({
    queryKey: ["members", projectId],
    queryFn: () => listMembers(projectId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["members", projectId] });

  const invite = useMutation({
    mutationFn: () => inviteMember(projectId, email, role),
    onSuccess: () => {
      setEmail("");
      toast.success("Invite sent.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changeRole = useMutation({
    mutationFn: (input: { id: string; role: "editor" | "viewer" }) =>
      updateMemberRole(input.id, input.role),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: removeMember,
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex h-full flex-col overflow-auto p-3">
      {isOwner ? (
        <div className="space-y-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="h-8 font-mono text-xs"
            aria-label="Invite by email"
          />
          <div className="flex gap-2">
            <Select value={role} onValueChange={(value) => setRole(value as "editor" | "viewer")}>
              <SelectTrigger className="h-8 flex-1 text-xs" aria-label="Role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8 shrink-0"
              disabled={!email.includes("@") || invite.isPending}
              onClick={() => invite.mutate()}
            >
              <UserPlus className="size-3.5" />
              Invite
            </Button>
          </div>
        </div>
      ) : (
        <p className="font-mono text-[11px] text-muted-foreground">
          Only the project owner can change who has access.
        </p>
      )}

      <ul className="mt-4 space-y-1">
        {(members.data ?? []).map((member) => (
          <li
            key={member.id}
            className="group rounded-md px-2 py-1.5 font-mono text-xs text-muted-foreground hover:bg-secondary/60"
          >
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate text-foreground">
                {member.display_name ?? member.invited_email}
              </span>
              {isOwner ? (
                <button
                  type="button"
                  aria-label={`Remove ${member.invited_email}`}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => remove.mutate(member.id)}
                >
                  <Trash2 className="size-3" />
                </button>
              ) : null}
            </div>
            <div className="mt-1 flex items-center gap-2">
              {isOwner ? (
                <Select
                  value={member.role}
                  onValueChange={(value) =>
                    changeRole.mutate({ id: member.id, role: value as "editor" | "viewer" })
                  }
                >
                  <SelectTrigger className="h-6 w-24 text-[11px]" aria-label="Member role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span>{member.role}</span>
              )}
              {member.status === "pending" ? (
                <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                  pending
                </span>
              ) : null}
            </div>
          </li>
        ))}
        {members.data && members.data.length === 0 ? (
          <li className="px-2 py-3 font-mono text-[11px] text-muted-foreground">
            No one else has access yet.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
