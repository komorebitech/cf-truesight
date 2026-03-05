import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useAcceptInvitation } from "@/hooks/use-invitations";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, CheckCircle, XCircle } from "lucide-react";

export function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const acceptInvitation = useAcceptInvitation();
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      // Redirect to login, preserving return URL
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`, { replace: true });
      return;
    }

    if (token && !attempted && !acceptInvitation.isPending) {
      setAttempted(true);
      acceptInvitation.mutate(token);
    }
  }, [authLoading, isAuthenticated, token, attempted, acceptInvitation, navigate]);

  if (authLoading || (!attempted && isAuthenticated)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted/30">
        <Card className="w-full max-w-sm">
          <CardHeader className="items-center space-y-4 pb-2">
            <Eye className="h-8 w-8 text-primary" />
            <p className="text-sm text-destructive">Invalid invitation link.</p>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button onClick={() => navigate("/")}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center space-y-4 pb-2">
          <Eye className="h-8 w-8 text-primary" />
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 pb-8">
          {acceptInvitation.isPending && (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="text-sm text-muted-foreground">Accepting invitation...</p>
            </>
          )}
          {acceptInvitation.isSuccess && (
            <>
              <CheckCircle className="h-10 w-10 text-green-500" />
              <p className="text-sm font-medium">
                You have joined {acceptInvitation.data.team.name}!
              </p>
              <Button onClick={() => navigate("/teams")}>Go to Teams</Button>
            </>
          )}
          {acceptInvitation.isError && (
            <>
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-destructive">
                {acceptInvitation.error instanceof Error
                  ? acceptInvitation.error.message
                  : "Failed to accept invitation."}
              </p>
              <Button onClick={() => navigate("/")}>Go to Dashboard</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
