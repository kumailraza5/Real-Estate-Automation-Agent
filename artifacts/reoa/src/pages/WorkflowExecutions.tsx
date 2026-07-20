import { useState } from "react";
import { useListWorkflowExecutions } from "@workspace/api-client-react";
import { format } from "date-fns";
import { 
  Activity, CheckCircle2, AlertCircle, AlertTriangle, 
  Search, Filter, ChevronRight
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export default function WorkflowExecutions() {
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: executions, isLoading } = useListWorkflowExecutions(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold font-display tracking-tight flex items-center gap-3">
          <Activity className="h-8 w-8 text-primary" /> Execution Logs
        </h1>
        <p className="text-muted-foreground mt-1">Audit log of all workflow automations.</p>
      </div>

      <Card>
        <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by workflow name..." 
              className="pl-9 bg-secondary border-transparent focus-visible:bg-background"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] bg-secondary border-transparent">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead className="w-[180px]">Date & Time</TableHead>
                <TableHead>Workflow</TableHead>
                <TableHead>Trigger Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : executions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No execution logs found.
                  </TableCell>
                </TableRow>
              ) : (
                executions?.map((log) => (
                  <TableRow key={log.id} className="hover:bg-secondary/20">
                    <TableCell className="text-sm font-medium text-muted-foreground">
                      {format(new Date(log.executedAt), "MMM d, yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {log.workflowName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs bg-muted/20">
                        {log.triggeredBy}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.status === "success" && (
                        <div className="flex items-center gap-1.5 text-green-600">
                          <CheckCircle2 className="h-4 w-4" /> <span className="text-sm font-medium">Success</span>
                        </div>
                      )}
                      {log.status === "failed" && (
                        <div className="flex items-center gap-1.5 text-destructive">
                          <AlertCircle className="h-4 w-4" /> <span className="text-sm font-medium">Failed</span>
                        </div>
                      )}
                      {log.status === "partial" && (
                        <div className="flex items-center gap-1.5 text-orange-500">
                          <AlertTriangle className="h-4 w-4" /> <span className="text-sm font-medium">Partial</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.actionsExecuted} executed
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-5 w-5 text-muted-foreground cursor-pointer hover:text-foreground" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}