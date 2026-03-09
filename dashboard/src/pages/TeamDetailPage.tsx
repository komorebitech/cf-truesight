import { useParams } from "react-router";
import {
  useTeam,
  useTeamMembers,
  useUpdateMemberRole,
  useRemoveMember,
  useTeamProjects,
  useLinkProject,
  useUnlinkProject,
  useAllowedDomains,
  useAddAllowedDomain,
  useRemoveAllowedDomain,
} from "@/hooks/use-teams";
import {
  useTeamInvitations,
  useCreateInvitation,
  useDeleteInvitation,
} from "@/hooks/use-invitations";
import { useProjects } from "@/hooks/use-projects";
import { useAuth } from "@/contexts/AuthContext";
import { PageLayout } from "@/components/PageLayout";
import { TeamMembersTable } from "@/components/TeamMembersTable";
import { TeamProjectsTable } from "@/components/TeamProjectsTable";
import { AllowedDomainsTable } from "@/components/AllowedDomainsTable";
import { InviteMemberDialog } from "@/components/InviteMemberDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: team, isLoading: teamLoading } = useTeam(id);
  const { data: members, isLoading: membersLoading } = useTeamMembers(id);
  const { data: teamProjects, isLoading: projectsLoading } = useTeamProjects(id);
  const { data: invitations, isLoading: invitationsLoading } = useTeamInvitations(id);
  const { data: allProjectsData } = useProjects();
  const { data: domains, isLoading: domainsLoading } = useAllowedDomains(id);

  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const linkProjectMut = useLinkProject();
  const unlinkProject = useUnlinkProject();
  const createInvitation = useCreateInvitation();
  const deleteInvitation = useDeleteInvitation();
  const addDomain = useAddAllowedDomain();
  const removeDomain = useRemoveAllowedDomain();

  const [showInviteDialog, setShowInviteDialog] = useState(false);

  const currentMember = members?.find((m) => m.user_id === user?.id);
  const isAdmin = currentMember?.role === "admin";
  const allProjects = allProjectsData?.data;

  if (teamLoading) {
    return (
      <PageLayout title="Team">
        <Skeleton className="mb-2 h-8 w-48" />
        <Skeleton className="h-5 w-24" />
      </PageLayout>
    );
  }

  if (!team) {
    return (
      <PageLayout title="Team">
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Team not found.</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={team.name}>
        <div className="flex items-center gap-4">
          <Badge variant={team.active ? "success" : "secondary"}>
            {team.active ? "active" : "inactive"}
          </Badge>
        </div>

        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            {isAdmin && <TabsTrigger value="invitations">Invitations</TabsTrigger>}
            {isAdmin && <TabsTrigger value="domains">Allowed Domains</TabsTrigger>}
          </TabsList>

          <TabsContent value="members">
            <div className="rounded-lg border bg-card">
              <div className="flex items-center justify-between p-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {membersLoading ? "Loading..." : `${members?.length ?? 0} members`}
                </h3>
                {isAdmin && (
                  <Button size="sm" onClick={() => setShowInviteDialog(true)}>
                    <Plus className="h-4 w-4" />
                    Invite
                  </Button>
                )}
              </div>
              <TeamMembersTable
                members={members}
                isLoading={membersLoading}
                isAdmin={isAdmin}
                currentUserId={user?.id}
                onRoleChange={(userId, role) =>
                  updateRole.mutate({ teamId: id!, userId, role })
                }
                onRemove={(userId) =>
                  removeMember.mutate({ teamId: id!, userId })
                }
              />
            </div>
          </TabsContent>

          <TabsContent value="projects">
            <div className="rounded-lg border bg-card">
              <TeamProjectsTable
                teamProjects={teamProjects}
                allProjects={allProjects}
                isLoading={projectsLoading}
                isAdmin={isAdmin}
                onLink={async (projectId) => {
                  await linkProjectMut.mutateAsync({ teamId: id!, projectId });
                }}
                onUnlink={(projectId) =>
                  unlinkProject.mutate({ teamId: id!, projectId })
                }
                isLinking={linkProjectMut.isPending}
              />
            </div>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="invitations">
              <div className="rounded-lg border bg-card">
                <div className="flex items-center justify-between p-4">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {invitationsLoading
                      ? "Loading..."
                      : `${invitations?.length ?? 0} invitations`}
                  </h3>
                  <Button size="sm" onClick={() => setShowInviteDialog(true)}>
                    <Plus className="h-4 w-4" />
                    New Invitation
                  </Button>
                </div>
                {invitationsLoading ? (
                  <div className="space-y-3 p-4">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : !invitations || invitations.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No pending invitations.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="w-[60px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{inv.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={inv.accepted ? "success" : "secondary"}
                            >
                              {inv.accepted ? "accepted" : "pending"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(inv.expires_at)}
                          </TableCell>
                          <TableCell>
                            {!inv.accepted && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  deleteInvitation.mutate({
                                    teamId: id!,
                                    invitationId: inv.id,
                                  })
                                }
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="domains">
              <div className="rounded-lg border bg-card">
                <AllowedDomainsTable
                  domains={domains}
                  isLoading={domainsLoading}
                  onAdd={async (domain, defaultRole) => {
                    await addDomain.mutateAsync({
                      teamId: id!,
                      domain,
                      defaultRole,
                    });
                  }}
                  onRemove={(domainId) =>
                    removeDomain.mutate({ teamId: id!, domainId })
                  }
                  isAdding={addDomain.isPending}
                />
              </div>
            </TabsContent>
          )}
        </Tabs>
      <InviteMemberDialog
        open={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        onInvite={async (email, role) => {
          await createInvitation.mutateAsync({ teamId: id!, email, role });
        }}
        isSubmitting={createInvitation.isPending}
      />
    </PageLayout>
  );
}
