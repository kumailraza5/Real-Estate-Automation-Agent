import { useState } from "react";
import { useListTasks, useCreateTask, useUpdateTask, getListTasksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  CheckSquare, Plus, Search, Calendar, Phone, Mail, 
  Users, MapPin, AlertCircle, Clock, CheckCircle2, Circle
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function Tasks() {
  const [filter, setFilter] = useState("all");
  const queryClient = useQueryClient();
  const { data: tasks, isLoading } = useListTasks(filter !== "all" ? { status: filter } : undefined);
  const updateTask = useUpdateTask();

  const handleToggleStatus = (task: any) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    updateTask.mutate(
      { id: task.id, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast.success(`Task marked as \${newStatus}`);
        }
      }
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage your daily follow-ups and meetings.</p>
        </div>
        <div className="flex gap-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Add Task
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Kanban Board style */}
        <TaskColumn 
          title="Pending" 
          tasks={tasks?.filter(t => t.status === "pending")} 
          isLoading={isLoading} 
          onToggle={handleToggleStatus}
        />
        <TaskColumn 
          title="In Progress" 
          tasks={tasks?.filter(t => t.status === "in-progress")} 
          isLoading={isLoading} 
          onToggle={handleToggleStatus}
        />
        <TaskColumn 
          title="Completed" 
          tasks={tasks?.filter(t => t.status === "completed")} 
          isLoading={isLoading} 
          onToggle={handleToggleStatus}
        />
      </div>
    </div>
  );
}

function TaskColumn({ title, tasks, isLoading, onToggle }: any) {
  return (
    <Card className="flex flex-col h-full overflow-hidden border-muted">
      <CardHeader className="py-3 px-4 bg-muted/50 border-b border-border shrink-0 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <Badge variant="secondary" className="font-mono text-xs">{tasks?.length || 0}</Badge>
      </CardHeader>
      <CardContent className="p-3 flex-1 overflow-y-auto space-y-3 bg-muted/10">
        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </>
        ) : tasks?.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground italic border-2 border-dashed border-border rounded-lg">
            No tasks here
          </div>
        ) : (
          tasks?.map((task: any) => (
            <div 
              key={task.id} 
              className={`p-4 rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow relative group \${task.status === 'completed' ? 'opacity-60' : ''}`}
            >
              <button 
                onClick={() => onToggle(task)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-primary transition-colors"
              >
                {task.status === "completed" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </button>
              
              <div className="flex gap-2 mb-2">
                <Badge variant={
                  task.priority === 'urgent' ? 'destructive' : 
                  task.priority === 'high' ? 'default' : 'secondary'
                } className="text-[10px] uppercase px-1.5 py-0">
                  {task.priority}
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase px-1.5 py-0 bg-background flex gap-1 items-center">
                  {task.type === 'call' && <Phone className="h-3 w-3" />}
                  {task.type === 'email' && <Mail className="h-3 w-3" />}
                  {task.type === 'meeting' && <Users className="h-3 w-3" />}
                  {task.type === 'viewing' && <MapPin className="h-3 w-3" />}
                  {task.type}
                </Badge>
              </div>
              
              <h4 className={`font-medium text-sm leading-snug pr-8 \${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                {task.title}
              </h4>
              
              {task.description && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {task.description}
                </p>
              )}
              
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <Clock className="h-3.5 w-3.5" />
                  {task.dueDate ? format(new Date(task.dueDate), "MMM d") : "No date"}
                </div>
                {task.assignedAgentName && (
                  <div className="h-6 w-6 rounded-full bg-accent/20 flex items-center justify-center text-accent text-[10px] font-bold" title={task.assignedAgentName}>
                    {task.assignedAgentName[0]}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}