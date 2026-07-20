import { useListNotifications, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bell, Check, Info, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Notifications() {
  const queryClient = useQueryClient();
  const { data: notifications, isLoading } = useListNotifications();
  const markAllRead = useMarkAllNotificationsRead();

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        toast.success("All notifications marked as read");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground flex items-center gap-3">
            <Bell className="h-7 w-7" /> Notifications
          </h1>
          <p className="text-muted-foreground mt-1">System alerts and workflow outcomes.</p>
        </div>
        <Button variant="outline" className="gap-2 shadow-sm" onClick={handleMarkAllRead} disabled={markAllRead.isPending}>
          <Check className="h-4 w-4" /> Mark all as read
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 flex gap-4">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))
            ) : notifications?.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground flex flex-col items-center">
                <Bell className="h-12 w-12 text-muted mb-4" />
                <h3 className="text-lg font-medium text-foreground">All caught up!</h3>
                <p className="mt-1">You have no new notifications.</p>
              </div>
            ) : (
              notifications?.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`p-4 md:p-6 flex gap-4 transition-colors hover:bg-muted/30 \${notification.isRead ? 'opacity-70' : 'bg-primary/5'}`}
                >
                  <div className="shrink-0 mt-1">
                    {notification.type === 'info' && <div className="p-2 bg-blue-500/10 text-blue-500 rounded-full"><Info className="h-5 w-5" /></div>}
                    {notification.type === 'success' && <div className="p-2 bg-green-500/10 text-green-500 rounded-full"><CheckCircle2 className="h-5 w-5" /></div>}
                    {notification.type === 'warning' && <div className="p-2 bg-orange-500/10 text-orange-500 rounded-full"><AlertTriangle className="h-5 w-5" /></div>}
                    {notification.type === 'error' && <div className="p-2 bg-destructive/10 text-destructive rounded-full"><AlertCircle className="h-5 w-5" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h4 className={`font-semibold text-base \${!notification.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {notification.title}
                      </h4>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(notification.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {notification.message}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <div className="shrink-0 self-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}