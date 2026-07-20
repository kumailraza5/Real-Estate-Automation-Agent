import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetWorkflow, getGetWorkflowQueryKey } from "@workspace/api-client-react";
import { 
  ArrowLeft, Zap, Play, GitMerge, FileText, CheckCircle2,
  Clock, Plus, Settings2, Trash2, ArrowDown
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function WorkflowDetail() {
  const { id } = useParams<{ id: string }>();
  const workflowId = parseInt(id || "0", 10);
  
  const { data: workflow, isLoading } = useGetWorkflow(workflowId, {
    query: { enabled: !!workflowId, queryKey: [getGetWorkflowQueryKey(workflowId)] }
  });

  const [conditions, setConditions] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);

  useEffect(() => {
    if (workflow) {
      try {
        setConditions(workflow.conditions ? JSON.parse(workflow.conditions) : []);
        setActions(workflow.actions ? JSON.parse(workflow.actions) : []);
      } catch (e) {
        console.error("Failed to parse workflow JSON", e);
      }
    }
  }, [workflow]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-32 w-full mb-8" />
        <div className="flex justify-center"><div className="w-1 h-8 bg-muted" /></div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!workflow) return <div>Workflow not found.</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
          <ArrowLeft className="h-4 w-4" />
          <Link href="/workflows">Back to Workflows</Link>
        </div>
        <Button className="gap-2 shadow-sm">Save Changes</Button>
      </div>
      
      <div className="mb-12">
        <h1 className="text-3xl font-bold font-display tracking-tight text-foreground flex items-center gap-3">
          {workflow.name}
          <Badge variant={workflow.isActive ? "default" : "secondary"}>
            {workflow.isActive ? "Active" : "Inactive"}
          </Badge>
        </h1>
        <p className="text-muted-foreground mt-2">{workflow.description}</p>
      </div>

      {/* Visual Builder */}
      <div className="relative flex flex-col items-center max-w-2xl mx-auto space-y-2">
        
        {/* Trigger Block */}
        <Card className="w-full border-2 border-accent shadow-md relative z-10">
          <CardHeader className="bg-accent/10 border-b border-accent/20 py-3 flex flex-row items-center gap-3 space-y-0">
            <div className="p-2 bg-accent text-accent-foreground rounded-md shadow-sm">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Trigger</CardTitle>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">When this happens</p>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <Select defaultValue={workflow.triggerEvent}>
              <SelectTrigger className="font-mono text-sm bg-secondary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead_created">lead_created</SelectItem>
                <SelectItem value="lead_updated">lead_updated</SelectItem>
                <SelectItem value="viewing_scheduled">viewing_scheduled</SelectItem>
                <SelectItem value="deal_closed">deal_closed</SelectItem>
                <SelectItem value="no_response_48h">no_response_48h</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Connector */}
        <div className="w-0.5 h-12 bg-border relative z-0 flex items-center justify-center">
          <ArrowDown className="h-4 w-4 text-border absolute -bottom-3 bg-background" />
        </div>

        {/* Conditions Block */}
        <Card className="w-full border-border relative z-10 mt-2">
          <CardHeader className="bg-muted/30 border-b border-border py-3 flex flex-row items-center gap-3 space-y-0">
            <div className="p-2 bg-muted text-muted-foreground rounded-md">
              <GitMerge className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base font-semibold">Conditions</CardTitle>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Only continue if (Optional)</p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground">
              <Plus className="h-3 w-3" /> Add
            </Button>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {conditions.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground border border-dashed rounded-md bg-secondary/50">
                Always run (no conditions set)
              </div>
            ) : (
              conditions.map((cond, i) => (
                <div key={i} className="flex items-center gap-3 bg-secondary p-3 rounded-lg border border-border">
                  <span className="text-xs font-medium text-muted-foreground uppercase w-8 text-right">
                    {i === 0 ? 'IF' : 'AND'}
                  </span>
                  <Select defaultValue={cond.field}>
                    <SelectTrigger className="w-[140px] bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={cond.field}>{cond.field}</SelectItem></SelectContent>
                  </Select>
                  <Select defaultValue={cond.operator}>
                    <SelectTrigger className="w-[120px] bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={cond.operator}>{cond.operator}</SelectItem></SelectContent>
                  </Select>
                  <Input value={cond.value} className="bg-background flex-1" readOnly />
                  <Button variant="ghost" size="icon" className="text-destructive h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Connector */}
        <div className="w-0.5 h-12 bg-border relative z-0 flex items-center justify-center">
          <ArrowDown className="h-4 w-4 text-border absolute -bottom-3 bg-background" />
        </div>

        {/* Actions Block */}
        <Card className="w-full border-2 border-primary shadow-md relative z-10 mt-2">
          <CardHeader className="bg-primary/10 border-b border-primary/20 py-3 flex flex-row items-center gap-3 space-y-0">
            <div className="p-2 bg-primary text-primary-foreground rounded-md shadow-sm">
              <Play className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base font-semibold">Actions</CardTitle>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Do these things</p>
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1 border-primary/30 text-primary">
              <Plus className="h-3 w-3" /> Add Step
            </Button>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {actions.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-md bg-secondary/50">
                No actions configured. Workflow will do nothing.
              </div>
            ) : (
              actions.map((action, i) => (
                <div key={i} className="relative pl-6 before:absolute before:left-[11px] before:top-8 before:bottom-[-24px] before:w-0.5 before:bg-border last:before:hidden">
                  <div className="absolute left-0 top-3 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-sm z-10 border-2 border-background">
                    {i + 1}
                  </div>
                  <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <Badge variant="secondary" className="font-mono">{action.type}</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 -mt-2"><Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" /></Button>
                    </div>
                    
                    {action.type === 'create_task' && (
                      <div className="space-y-3">
                        <Input defaultValue={action.params?.title} className="font-medium bg-secondary/50" />
                        <div className="flex gap-3">
                          <Select defaultValue={action.params?.type}>
                            <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="call">Call</SelectItem><SelectItem value="email">Email</SelectItem></SelectContent>
                          </Select>
                          <Select defaultValue={action.params?.priority}>
                            <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="high">High Priority</SelectItem><SelectItem value="medium">Medium Priority</SelectItem></SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    
                    {action.type === 'send_notification' && (
                      <div className="space-y-3">
                        <Input defaultValue={action.params?.message} className="bg-secondary/50" />
                        <Select defaultValue={action.params?.recipient}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="assigned_agent">Assigned Agent</SelectItem><SelectItem value="admin">Administrators</SelectItem></SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}