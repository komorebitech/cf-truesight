import { useState } from "react";
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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
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
import { Plus, Trash2, Mail } from "lucide-react";
import { motion } from "motion/react";
import { fadeInUp } from "@/lib/motion";

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
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
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
      <motion.div {...fadeInUp} transition={{ duration: 0.3 }}>
        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            {isAdmin && <TabsTrigger value="invitations">Invitations</TabsTrigger>}
            {isAdmin && <TabsTrigger value="domains">Allowed Domains</TabsTrigger>}
          </TabsList>

          <TabsContent value="members">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {membersLoading ? "\u00A0" : `${members?.length ?? 0} members`}
                  </CardTitle>
                  {isAdmin && (
                    <Button size="sm" onClick={() => setShowInviteDialog(true)}>
                      <Plus className="h-4 w-4" />
                      Invite
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects">
            <Card>
              <CardContent className="p-0">
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
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="invitations">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {invitationsLoading
                        ? "\u00A0"
                        : `${invitations?.length ?? 0} invitations`}
                    </CardTitle>
                    <Button size="sm" onClick={() => setShowInviteDialog(true)}>
                      <Plus className="h-4 w-4" />
                      New Invitation
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {invitationsLoading ? (
                    <div className="space-y-3 p-4">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : !invitations || invitations.length === 0 ? (
                    <EmptyState
                      variant="data"
                      icon={Mail}
                      title="No pending invitations"
                      description="Invite team members to start collaborating"
                      compact
                    />
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
                                {inv.accepted ? "Accepted" : "Pending"}
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
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() =>
                                    deleteInvitation.mutate({
                                      teamId: id!,
                                      invitationId: inv.id,
                                    })
                                  }
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="domains">
              <Card>
                <CardContent className="p-0">
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
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </motion.div>

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
