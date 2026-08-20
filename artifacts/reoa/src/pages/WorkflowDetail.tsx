import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useGetWorkflow, useUpdateWorkflow, useDeleteWorkflow, getGetWorkflowQueryKey, getListWorkflowsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  ArrowLeft, Zap, Play, GitMerge, Trash2, ArrowDown, Plus, Save
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
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  const { data: workflow, isLoading } = useGetWorkflow(workflowId, {
    query: { enabled: !!workflowId, queryKey: getGetWorkflowQueryKey(workflowId) }
  });

  const updateWorkflow = useUpdateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();

  const [triggerEvent, setTriggerEvent] = useState<string>("");
  const [conditions, setConditions] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);

  useEffect(() => {
    if (workflow) {
      setTriggerEvent(workflow.triggerEvent || "");
      try {
        setConditions(workflow.conditions && workflow.conditions !== "null" ? JSON.parse(workflow.conditions) : []);
      } catch (e) {
        setConditions([]);
      }
      try {
        setActions(workflow.actions && workflow.actions !== "null" ? JSON.parse(workflow.actions) : []);
      } catch (e) {
        setActions([]);
      }
    }
  }, [workflow]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-32 w-full mb-8" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!workflow) return <div>Workflow not found.</div>;

  const handleSave = () => {
    updateWorkflow.mutate({
      id: workflowId,
      data: {
        triggerEvent,
        conditions: JSON.stringify(conditions),
        actions: JSON.stringify(actions)
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWorkflowQueryKey(workflowId), exact: true });
        queryClient.invalidateQueries({ queryKey: getListWorkflowsQueryKey() });
        toast.success("Workflow updated successfully!");
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to save workflow");
      }
    });
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this workflow?")) {
      deleteWorkflow.mutate({ id: workflowId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListWorkflowsQueryKey() });
          toast.success("Workflow deleted successfully!");
          setLocation("/workflows");
        },
        onError: (err: any) => {
          toast.error(err.message || "Failed to delete workflow");
        }
      });
    }
  };

  const addCondition = () => {
    setConditions([...conditions, { field: "budget", operator: ">", value: "" }]);
  };

  const updateCondition = (index: number, key: string, value: string) => {
    const newConditions = [...conditions];
    newConditions[index][key] = value;
    setConditions(newConditions);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const addAction = () => {
    setActions([...actions, { type: "CREATE_TASK", params: { title: "Follow up", type: "call", priority: "high" } }]);
  };

  const updateAction = (index: number, newAction: any) => {
    const newActions = [...actions];
    newActions[index] = newAction;
    setActions(newActions);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
          <ArrowLeft className="h-4 w-4" />
          <Link href="/workflows">Back to Workflows</Link>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="destructive" size="icon" onClick={handleDelete} disabled={deleteWorkflow.isPending} title="Delete Workflow">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button onClick={handleSave} disabled={updateWorkflow.isPending} className="gap-2 shadow-sm">
            <Save className="h-4 w-4" />
            {updateWorkflow.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
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
            <Select value={triggerEvent} onValueChange={setTriggerEvent}>
              <SelectTrigger className="font-mono text-sm bg-secondary">
                <SelectValue />
              </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LEAD_CREATED">LEAD_CREATED</SelectItem>
                  <SelectItem value="LEAD_UPDATED">LEAD_UPDATED</SelectItem>
                  <SelectItem value="CLIENT_CREATED">CLIENT_CREATED</SelectItem>
                  <SelectItem value="CLIENT_UPDATED">CLIENT_UPDATED</SelectItem>
                  <SelectItem value="CLIENT_DELETED">CLIENT_DELETED</SelectItem>
                  <SelectItem value="TASK_COMPLETED">TASK_COMPLETED</SelectItem>
                  <SelectItem value="TASK_OVERDUE">TASK_OVERDUE</SelectItem>
                  <SelectItem value="VIEWING_SCHEDULED">VIEWING_SCHEDULED</SelectItem>
                  <SelectItem value="VIEWING_COMPLETED">VIEWING_COMPLETED</SelectItem>
                  <SelectItem value="APPOINTMENT_REMINDER">APPOINTMENT_REMINDER</SelectItem>
                  <SelectItem value="NO_RESPONSE_48H">NO_RESPONSE_48H</SelectItem>
                  <SelectItem value="ANY">ANY</SelectItem>
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
            <Button variant="ghost" size="sm" onClick={addCondition} className="h-8 gap-1 text-muted-foreground">
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
                  <Select value={cond.field} onValueChange={(v) => updateCondition(i, "field", v)}>
                    <SelectTrigger className="w-[140px] bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="budget">budget</SelectItem>
                      <SelectItem value="status">status</SelectItem>
                      <SelectItem value="source">source</SelectItem>
                      <SelectItem value="score">score</SelectItem>
                      <SelectItem value="notes">notes</SelectItem>
                      <SelectItem value="firstName">firstName</SelectItem>
                      <SelectItem value="lastName">lastName</SelectItem>
                      <SelectItem value="email">email</SelectItem>
                      <SelectItem value="phone">phone</SelectItem>
                      <SelectItem value="preferredPropertyType">preferredPropertyType</SelectItem>
                      <SelectItem value="city">city</SelectItem>
                      <SelectItem value="lastContactDate">lastContactDate</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={cond.operator} onValueChange={(v) => updateCondition(i, "operator", v)}>
                    <SelectTrigger className="w-[120px] bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="==">==(equals)</SelectItem>
                      <SelectItem value="!=">!=(not equals)</SelectItem>
                      <SelectItem value=">">&gt;</SelectItem>
                      <SelectItem value=">=">&gt;=</SelectItem>
                      <SelectItem value="<">&lt;</SelectItem>
                      <SelectItem value="<=">&lt;=</SelectItem>
                      <SelectItem value="contains">contains</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input 
                    value={cond.value} 
                    onChange={(e) => updateCondition(i, "value", e.target.value)}
                    placeholder="Value..."
                    className="bg-background flex-1" 
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeCondition(i)} className="text-destructive h-8 w-8">
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
            <Button variant="outline" size="sm" onClick={addAction} className="h-8 gap-1 border-primary/30 text-primary">
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
                      <Select 
                        value={action.type} 
                        onValueChange={(v) => updateAction(i, { ...action, type: v, params: {} })}
                      >
                        <SelectTrigger className="w-[200px] h-8 font-mono text-xs bg-secondary">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CREATE_TASK">CREATE_TASK</SelectItem>
                          <SelectItem value="ASSIGN_SENIOR_AGENT">ASSIGN_SENIOR_AGENT</SelectItem>
                          <SelectItem value="NOTIFY_MANAGER">NOTIFY_MANAGER</SelectItem>
                          <SelectItem value="UPDATE_CRM_STATUS">UPDATE_CRM_STATUS</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button variant="ghost" size="icon" onClick={() => removeAction(i)} className="h-6 w-6 -mr-2 -mt-2">
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                    
                    {action.type === 'CREATE_TASK' && (
                      <div className="space-y-3">
                        <Input 
                          placeholder="Task Title"
                          value={action.params?.title || ""} 
                          onChange={(e) => updateAction(i, { ...action, params: { ...action.params, title: e.target.value } })}
                          className="font-medium bg-secondary/50" 
                        />
                        <div className="flex gap-3">
                          <Select 
                            value={action.params?.type || "call"}
                            onValueChange={(v) => updateAction(i, { ...action, params: { ...action.params, type: v } })}
                          >
                            <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="call">Call</SelectItem><SelectItem value="email">Email</SelectItem></SelectContent>
                          </Select>
                          <Select 
                            value={action.params?.priority || "high"}
                            onValueChange={(v) => updateAction(i, { ...action, params: { ...action.params, priority: v } })}
                          >
                            <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="urgent">Urgent</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem></SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    
                    {action.type === 'UPDATE_CRM_STATUS' && (
                      <div className="space-y-3">
                        <Select 
                          value={action.params?.status || "contacted"}
                          onValueChange={(v) => updateAction(i, { ...action, params: { ...action.params, status: v } })}
                        >
                          <SelectTrigger><SelectValue placeholder="New Status..." /></SelectTrigger>
                          <SelectContent>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="negotiation">Negotiation</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                  </SelectContent>
                        </Select>
                      </div>
                    )}

                    {action.type === 'ASSIGN_SENIOR_AGENT' && (
                      <p className="text-sm text-muted-foreground italic">Automatically finds and assigns the top available senior agent.</p>
                    )}
                    {action.type === 'NOTIFY_MANAGER' && (
                      <p className="text-sm text-muted-foreground italic">Sends an immediate push notification to all managers.</p>
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