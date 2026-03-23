import { Alert, AlertTitle, AlertDescription } from "./components/ui/alert";
import { Button } from "./components/ui/button";
import { Warning, ArrowsClockwise } from "@phosphor-icons/react";
import { FallbackProps } from "react-error-boundary";

export const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-4">
        <Alert variant="destructive">
          <Warning className="h-4 w-4" />
          <AlertTitle>Application Error</AlertTitle>
          <AlertDescription>
            Something unexpected happened while running the application. The error details are shown below.
          </AlertDescription>
        </Alert>
        <div className="bg-card border rounded-lg p-4 space-y-4">
          <pre className="text-sm overflow-auto whitespace-pre-wrap break-words text-foreground">
            {errorMessage}
          </pre>
          {errorStack && (
            <pre className="text-xs overflow-auto whitespace-pre-wrap break-words text-muted-foreground">
              {errorStack}
            </pre>
          )}
          <Button
            onClick={resetErrorBoundary}
            variant="outline"
            className="w-full"
          >
            <ArrowsClockwise className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
};
