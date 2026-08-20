import React, { useState } from "react";
import { useListWorkflowExecutions } from "@workspace/api-client-react";
import { format } from "date-fns";
import { 
  Activity, CheckCircle2, AlertCircle, AlertTriangle, 
  Search, Filter, ChevronRight, ChevronDown, User, Home, Building2, Briefcase, CalendarCheck
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export default function WorkflowExecutions() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const { data: executions, isLoading } = useListWorkflowExecutions(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );

  const filteredExecutions = (Array.isArray(executions) ? executions : []).filter((log) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.workflowName?.toLowerCase().includes(term) ||
      log.triggerEntityName?.toLowerCase().includes(term) ||
      log.triggeredBy?.toLowerCase().includes(term)
    );
  });

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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
              ) : filteredExecutions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No execution logs found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredExecutions.map((log) => {
                  const isExpanded = expandedRow === log.id;
                  
                  // Safe parse actionResults
                  let actionResults: any[] = [];
                  try {
                    if (log.actionResults) {
                      actionResults = JSON.parse(log.actionResults);
                    }
                  } catch (e) {
                    console.error("Failed to parse actionResults", e);
                  }
                  
                  let TriggerIcon = User;
                  if (log.triggerEntityType === 'property') TriggerIcon = Home;
                  else if (log.triggerEntityType === 'client') TriggerIcon = Briefcase;
                  else if (log.triggerEntityType === 'appointment') TriggerIcon = CalendarCheck;
                  
                  return (
                    <React.Fragment key={log.id}>
                      <TableRow className="hover:bg-secondary/20">
                        <TableCell className="text-sm font-medium text-muted-foreground">
                          {format(new Date(log.executedAt), "MMM d, yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {log.workflowName}
                        </TableCell>
                        <TableCell>
                          {log.triggerEntityName ? (
                            <Badge variant="secondary" className="flex w-max items-center gap-1.5 px-2.5 py-1">
                              <TriggerIcon className="w-3 h-3 text-muted-foreground" />
                              <span className="font-medium text-foreground">{log.triggerEntityName}</span>
                              <span className="text-[10px] text-muted-foreground opacity-70">#{log.triggerEntityId}</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="font-mono text-xs bg-muted/20">
                              {log.triggeredBy}
                            </Badge>
                          )}
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
                          {(() => {
                            const skippedCount = actionResults.filter((ar: any) => ar.status === 'skipped').length;
                            const total = log.actionsExecuted ?? 0;
                            return skippedCount > 0
                              ? `${total} executed (${skippedCount} skipped)`
                              : `${total} executed`;
                          })()}
                        </TableCell>
                        <TableCell>
                          <div 
                            className="cursor-pointer hover:bg-secondary rounded-md p-1 w-max transition-colors"
                            onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-foreground" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      
                      {isExpanded && (
                        <TableRow className="bg-secondary/10 hover:bg-secondary/10">
                          <TableCell colSpan={6} className="p-0 border-b-0">
                            <div className="p-4 border-l-2 border-l-primary mx-4 my-2 rounded-r-md bg-card">
                              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Activity className="w-4 h-4" /> Action Results Breakdown
                              </h4>
                              {actionResults.length > 0 ? (
                                <div className="space-y-2">
                                  {actionResults.map((ar, idx) => (
                                    <div key={idx} className="flex items-start justify-between text-sm py-1.5 border-b border-border/40 last:border-0 gap-4">
                                      <span className="font-mono text-muted-foreground">{ar.action}</span>
                                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                                        {ar.status === 'success' ? (
                                          <span className="text-green-600 text-xs font-medium bg-green-500/10 px-2 py-0.5 rounded-full">✓ Success</span>
                                        ) : ar.status === 'skipped' ? (
                                          <span className="text-amber-600 text-xs font-medium bg-amber-500/10 px-2 py-0.5 rounded-full">⊘ Skipped</span>
                                        ) : (
                                          <span className="text-destructive text-xs font-medium bg-destructive/10 px-2 py-0.5 rounded-full">✕ Failed: {ar.error}</span>
                                        )}
                                        {ar.note && (
                                          <span className="text-[11px] text-muted-foreground italic">{ar.note}</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">No detailed action results available.</p>
                              )}
                              
                              {log.errorMessage && (
                                <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
                                  <span className="font-semibold block mb-1">Execution Error:</span>
                                  <span className="font-mono">{log.errorMessage}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}