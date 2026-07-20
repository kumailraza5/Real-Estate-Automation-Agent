import { useState } from "react";
import { useListWorkflows, useToggleWorkflow } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { 
  Zap, Plus, Activity, Power, PowerOff, 
  Settings2, ChevronRight, Play, Clock
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

export default function Workflows() {
  const { data: workflows, isLoading } = useListWorkflows();
  const toggleWorkflow = useToggleWorkflow();
  const queryClient = useQueryClient();

  const handleToggle = (id: number, currentStatus: boolean) => {
    toggleWorkflow.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
          toast.success(`Workflow ${!currentStatus ? 'activated' : 'deactivated'}`);
        }
      }
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight flex items-center gap-3">
            <Zap className="h-8 w-8 text-accent" /> Workflows
          </h1>
          <p className="text-muted-foreground mt-1">Automate your real estate operations with trigger-based rules.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Create Workflow
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-primary-foreground/80 font-medium">Active Automations</p>
                <p className="text-4xl font-display font-bold mt-2">
                  {workflows?.filter(w => w.isActive).length || 0}
                </p>
              </div>
              <div className="p-3 bg-primary-foreground/10 rounded-lg">
                <Power className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground font-medium">Total Executions</p>
                <p className="text-4xl font-display font-bold mt-2 text-foreground">
                  {workflows?.reduce((acc, w) => acc + w.executionCount, 0).toLocaleString() || 0}
                </p>
              </div>
              <div className="p-3 bg-secondary rounded-lg">
                <Activity className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold mb-4">Configured Rules</h2>
        
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : workflows?.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center">
              <Settings2 className="h-12 w-12 text-muted mb-4" />
              <h3 className="text-lg font-medium text-foreground">No workflows configured</h3>
              <p className="max-w-sm mt-1 mb-6">Create a workflow to automate repetitive tasks like follow-ups, assignments, and notifications.</p>
              <Button>Create your first workflow</Button>
            </CardContent>
          </Card>
        ) : (
          workflows?.map(workflow => (
            <Card key={workflow.id} className={`overflow-hidden transition-colors border-l-4 \${workflow.isActive ? 'border-l-accent' : 'border-l-muted'}`}>
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row md:items-center p-6 gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{workflow.name}</h3>
                      <Badge variant="outline" className="font-mono text-xs bg-muted/30">
                        {workflow.triggerEvent}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {workflow.description || "No description provided."}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 mt-4 text-xs font-medium text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Play className="h-3 w-3" /> {workflow.executionCount} runs
                      </span>
                      {workflow.lastExecutedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Last ran {format(new Date(workflow.lastExecutedAt), "MMM d, h:mm a")}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-6 md:w-auto w-full pt-4 md:pt-0 border-t border-border md:border-0 mt-4 md:mt-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium \${workflow.isActive ? 'text-accent' : 'text-muted-foreground'}`}>
                        {workflow.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <Switch 
                        checked={workflow.isActive} 
                        onCheckedChange={() => handleToggle(workflow.id, workflow.isActive)} 
                      />
                    </div>
                    <Button variant="secondary" asChild>
                      <Link href={`/workflows/\${workflow.id}`} className="gap-2">
                        Configure <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}