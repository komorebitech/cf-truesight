import { useEffect } from "react";
import { useNavigate } from "react-router";
import { GoogleLogin } from "@react-oauth/google";
import { Eye } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center space-y-4 pb-2">
          <div className="flex items-center gap-2">
            <Eye className="h-8 w-8 text-primary" />
            <span className="font-serif text-2xl font-bold">TrueSight</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Sign in to your account
          </p>
        </CardHeader>
        <CardContent className="flex justify-center pb-8">
          <GoogleLogin
            onSuccess={async (response) => {
              if (!response.credential) {
                toast.error("No credential received from Google");
                return;
              }
              try {
                await login(response.credential);
                navigate("/", { replace: true });
              } catch {
                toast.error("Sign in failed. Please try again.");
              }
            }}
            onError={() => {
              toast.error("Google Sign-In failed");
            }}
            theme="outline"
            size="large"
            width="300"
          />
        </CardContent>
      </Card>
    </div>
  );
}
