import { Button } from "@/components/ui/button";

export const LoadingState = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Loading exam...</p>
    </div>
  </div>
);

export const ErrorState = ({ message, onBack }: { message: string; onBack: () => void }) => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <p className="text-destructive mb-4 text-lg">{message}</p>
      <Button onClick={onBack}>Return to Dashboard</Button>
    </div>
  </div>
);
