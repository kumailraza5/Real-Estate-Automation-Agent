import { useGetAutomationActivityReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import { Activity, Zap, CheckCircle2, AlertCircle } from "lucide-react";

export default function Reports() {
  const { data: report, isLoading } = useGetAutomationActivityReport();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Analytics & Reports</h1>
        <p className="text-muted-foreground mt-1">Insights into your operations and automation efficiency.</p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Total Automations Run</p>
                    <p className="text-3xl font-display font-bold">{report?.totalExecutions.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-primary/10 text-primary rounded-lg"><Activity className="h-5 w-5" /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                    <p className="text-3xl font-display font-bold text-green-600">{report?.successRate}%</p>
                  </div>
                  <div className="p-3 bg-green-500/10 text-green-600 rounded-lg"><CheckCircle2 className="h-5 w-5" /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Active Triggers</p>
                    <p className="text-3xl font-display font-bold">{report?.byTrigger.length}</p>
                  </div>
                  <div className="p-3 bg-accent/10 text-accent rounded-lg"><Zap className="h-5 w-5" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Execution by Workflow</CardTitle>
                <CardDescription>Most heavily utilized automation rules</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report?.byWorkflow} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="workflowName" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                      <RechartsTooltip 
                        cursor={{ fill: 'hsl(var(--muted))' }}
                        contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                      />
                      <Bar dataKey="executions" radius={[4, 4, 0, 0]}>
                        {report?.byWorkflow.map((entry, index) => (
                          <Cell key={`cell-\${index}`} fill="hsl(var(--primary))" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Trigger Volume</CardTitle>
                <CardDescription>Events driving the most automation</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event Trigger</TableHead>
                      <TableHead className="text-right">Executions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report?.byTrigger.map((trigger) => (
                      <TableRow key={trigger.trigger}>
                        <TableCell className="font-medium font-mono text-sm">{trigger.trigger}</TableCell>
                        <TableCell className="text-right">{trigger.count.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}