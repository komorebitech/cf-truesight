import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <h1 className="mb-2 text-6xl font-bold text-muted">
        404
      </h1>
      <h2 className="mb-2 font-serif text-xl font-semibold">
        Page Not Found
      </h2>
      <p className="mb-6 text-muted-foreground">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to="/">
        <Button variant="outline">
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Button>
      </Link>
    </div>
  );
}
