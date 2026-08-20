import { useState } from "react";
import { useListWorkflows, useCreateWorkflow, useToggleWorkflow, getListWorkflowsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Zap, Plus, Activity, Power,
  Settings2, ChevronRight, Play, Clock
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const workflowSchema = z.object({
  name: z.string().min(3, "Name is required"),
  description: z.string().optional(),
  triggerEvent: z.string().min(1, "Select a trigger event"),
  isActive: z.boolean().default(true),
});

const TRIGGER_OPTIONS = [
  { value: "LEAD_CREATED", label: "🆕 New Lead Created", description: "Fires when a new lead is added" },
  { value: "LEAD_UPDATED", label: "🔄 Lead Status Changed", description: "Fires when a lead's status updates" },
  { value: "CLIENT_CREATED", label: "🤝 New Client Created", description: "Fires when a new client is added" },
  { value: "CLIENT_UPDATED", label: "🔄 Client Updated", description: "Fires when a client record is updated" },
  { value: "CLIENT_DELETED", label: "🗑️ Client Deleted", description: "Fires when a client record is deleted" },
  { value: "TASK_COMPLETED", label: "✅ Task Completed", description: "Fires when a task is marked as completed" },
  { value: "TASK_OVERDUE", label: "⏰ Task Overdue", description: "Fires when a task passes its due date" },
  { value: "VIEWING_SCHEDULED", label: "📅 Appointment Scheduled", description: "Fires when a new appointment is created" },
  { value: "VIEWING_COMPLETED", label: "✅ Appointment Completed", description: "Fires when an appointment is marked as completed" },
  { value: "APPOINTMENT_REMINDER", label: "🔔 Appointment Reminder", description: "Fires as a reminder before an upcoming appointment" },
  { value: "NO_RESPONSE_48H", label: "⏰ 48H No Response (Scheduled)", description: "Fires if a lead has no activity for 48 hours" },
  { value: "ANY", label: "⚡ Any Event", description: "Fires on any system event" },
];

export default function Workflows() {
  const { data: workflows, isLoading } = useListWorkflows();
  const toggleWorkflow = useToggleWorkflow();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleToggle = (id: number, currentStatus: boolean) => {
    toggleWorkflow.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListWorkflowsQueryKey() });
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
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Create Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Workflow</DialogTitle>
            </DialogHeader>
            <CreateWorkflowForm onSuccess={() => setIsCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-primary-foreground/80 font-medium">Active Automations</p>
                <p className="text-4xl font-display font-bold mt-2">
                  {(Array.isArray(workflows) ? workflows : []).filter(w => w.isActive).length || 0}
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
                  {(Array.isArray(workflows) ? workflows : []).reduce((acc, w) => acc + (w.executionCount || 0), 0).toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-secondary rounded-lg">
                <Activity className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground font-medium">Total Workflows</p>
                <p className="text-4xl font-display font-bold mt-2 text-foreground">
                  {(Array.isArray(workflows) ? workflows : []).length}
                </p>
              </div>
              <div className="p-3 bg-secondary rounded-lg">
                <Zap className="h-6 w-6 text-muted-foreground" />
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
        ) : (Array.isArray(workflows) ? workflows : []).length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center">
              <Settings2 className="h-12 w-12 text-muted mb-4" />
              <h3 className="text-lg font-medium text-foreground">No workflows configured</h3>
              <p className="max-w-sm mt-1 mb-6">Create a workflow to automate repetitive tasks like follow-ups, assignments, and notifications.</p>
              <Button onClick={() => setIsCreateOpen(true)}>Create your first workflow</Button>
            </CardContent>
          </Card>
        ) : (
          (Array.isArray(workflows) ? workflows : []).map(workflow => (
            <Card key={workflow.id} className={`overflow-hidden transition-colors border-l-4 ${workflow.isActive ? 'border-l-accent' : 'border-l-muted'}`}>
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
                        <Play className="h-3 w-3" /> {workflow.executionCount || 0} runs
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
                      <span className={`text-sm font-medium ${workflow.isActive ? 'text-accent' : 'text-muted-foreground'}`}>
                        {workflow.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <Switch
                        checked={workflow.isActive}
                        onCheckedChange={() => handleToggle(workflow.id, workflow.isActive)}
                      />
                    </div>
                    <Button variant="secondary" asChild>
                      <Link href={`/workflows/${workflow.id}`} className="gap-2">
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

function CreateWorkflowForm({ onSuccess }: { onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const createWorkflow = useCreateWorkflow();

  const form = useForm<z.infer<typeof workflowSchema>>({
    resolver: zodResolver(workflowSchema),
    defaultValues: {
      name: "", description: "", triggerEvent: "", isActive: true,
    },
  });

  const selectedTrigger = form.watch("triggerEvent");
  const triggerInfo = TRIGGER_OPTIONS.find(t => t.value === selectedTrigger);

  const onSubmit = (data: z.infer<typeof workflowSchema>) => {
    createWorkflow.mutate({ 
      data: {
        ...data,
        actions: "[]",
        conditions: "[]"
      } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWorkflowsQueryKey() });
        toast.success("Workflow created! Configure its actions now.");
        onSuccess();
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to create workflow");
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Workflow Name</FormLabel>
            <FormControl><Input placeholder="e.g. High Budget Lead Alert" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="triggerEvent" render={({ field }) => (
          <FormItem>
            <FormLabel>Trigger Event</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select what triggers this workflow..." /></SelectTrigger></FormControl>
              <SelectContent>
                {TRIGGER_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {triggerInfo && (
              <FormDescription className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                ℹ️ {triggerInfo.description}
              </FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Description (Optional)</FormLabel>
            <FormControl>
              <Textarea placeholder="Describe what this workflow does..." rows={2} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="bg-blue-500/5 border border-blue-200/30 rounded-lg p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">💡 Next Steps</p>
          <p>After creating the workflow, click <strong>Configure</strong> to add actions like sending notifications, creating tasks, or assigning agents.</p>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <Button type="button" variant="outline" onClick={() => { form.reset(); onSuccess(); }}>Cancel</Button>
          <Button type="submit" disabled={createWorkflow.isPending}>
            {createWorkflow.isPending ? "Creating..." : "Create Workflow"}
          </Button>
        </div>
      </form>
    </Form>
  );
}