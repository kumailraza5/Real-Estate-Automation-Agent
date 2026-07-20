import { 
  useGetDashboardSummary, 
  useGetDashboardPipeline, 
  useGetDashboardRecentActivity,
  useListTasks
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  Building2, 
  Zap, 
  TrendingUp, 
  CheckSquare, 
  AlertCircle,
  Activity,
  Phone,
  Mail,
  Calendar
} from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: pipeline, isLoading: loadingPipeline } = useGetDashboardPipeline();
  const { data: activity, isLoading: loadingActivity } = useGetDashboardRecentActivity();
  const { data: tasks, isLoading: loadingTasks } = useListTasks({ 
    dueDate: format(new Date(), 'yyyy-MM-dd') 
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your real estate operations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Active Leads" 
          value={summary?.activeLeads} 
          subtitle={`${summary?.totalLeads} total`}
          icon={<Users className="h-4 w-4" />}
          loading={loadingSummary}
          trend="+12% from last month"
        />
        <StatCard 
          title="Properties" 
          value={summary?.totalProperties} 
          icon={<Building2 className="h-4 w-4" />}
          loading={loadingSummary}
        />
        <StatCard 
          title="Deals Closed" 
          value={summary?.dealsClosedThisMonth} 
          subtitle="This Month"
          icon={<TrendingUp className="h-4 w-4" />}
          loading={loadingSummary}
          valuePrefix=""
        />
        <StatCard 
          title="Revenue" 
          value={summary?.revenueThisMonth} 
          subtitle="This Month"
          icon={<Activity className="h-4 w-4" />}
          loading={loadingSummary}
          valuePrefix="$"
          formatValue={(v: number) => v.toLocaleString()}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pipeline Overview</CardTitle>
            <CardDescription>Value by stage across all active leads</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPipeline ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-[90%]" />
                <Skeleton className="h-8 w-[80%]" />
              </div>
            ) : (
              <div className="space-y-4">
                {pipeline?.stages.map((stage) => (
                  <div key={stage.status} className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium capitalize text-muted-foreground">
                      {stage.status.replace('_', ' ')}
                    </div>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent transition-all duration-500"
                        style={{ width: `${Math.max(5, (stage.value / (pipeline.stages.reduce((a, b) => a + b.value, 0) || 1)) * 100)}%` }}
                      />
                    </div>
                    <div className="w-24 text-right text-sm font-semibold">
                      ${stage.value.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle>Today's Tasks</CardTitle>
              <CardDescription>{tasks?.length || 0} tasks pending</CardDescription>
            </div>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-4">
            {loadingTasks ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : tasks?.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <CheckSquare className="h-8 w-8 text-muted" />
                <p>No tasks scheduled for today.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks?.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-accent/50 transition-colors">
                    {task.type === 'call' ? <Phone className="h-4 w-4 mt-0.5 text-blue-500" /> :
                     task.type === 'email' ? <Mail className="h-4 w-4 mt-0.5 text-orange-500" /> :
                     task.type === 'meeting' ? <Users className="h-4 w-4 mt-0.5 text-purple-500" /> :
                     <Calendar className="h-4 w-4 mt-0.5 text-green-500" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {task.dueTime ? format(new Date(`2000-01-01T\${task.dueTime}`), 'h:mm a') : 'Any time'}
                      </p>
                    </div>
                    {task.priority === 'urgent' && <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">Urgent</Badge>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions across your workspace</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingActivity ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-[90%]" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted before:to-transparent hidden">
                <div className="space-y-6">
                  {activity?.map(log => (
                    <div key={log.id} className="flex gap-4 items-start">
                      <div className="relative mt-1">
                        <div className="absolute -inset-1 rounded-full bg-accent/20 blur-[2px]" />
                        <div className="relative h-2.5 w-2.5 rounded-full bg-accent" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground">
                          <span className="font-semibold">{log.performedBy || 'System'}</span> {log.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(log.createdAt), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Real timeline view */}
            {!loadingActivity && (
              <div className="space-y-6 border-l-2 border-muted ml-3 pl-4">
                {activity?.map(log => (
                  <div key={log.id} className="relative">
                    <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-card border-2 border-accent" />
                    <div>
                      <p className="text-sm text-foreground">
                        <span className="font-medium text-foreground">{log.performedBy || 'System Automation'}</span> {log.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(log.createdAt), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>System Health</CardTitle>
              <CardDescription>Automation & APIs</CardDescription>
            </div>
            <Zap className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                  <span className="text-sm font-medium">Workflows Engine</span>
                </div>
                <Badge variant="secondary" className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-none">
                  {summary?.automationsActive || 0} Active
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                  <span className="text-sm font-medium">API Endpoints</span>
                </div>
                <span className="text-xs text-muted-foreground">Operational</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                  <span className="text-sm font-medium">Database Sync</span>
                </div>
                <span className="text-xs text-muted-foreground">Just now</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon, loading, trend, valuePrefix = "", formatValue }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20 mb-1" />
        ) : (
          <div className="text-2xl font-bold font-display">
            {valuePrefix}{formatValue ? formatValue(value || 0) : value || 0}
          </div>
        )}
        {(subtitle || trend) && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            {trend && <span className="text-green-500">{trend}</span>}
            {subtitle && <span>{subtitle}</span>}
          </p>
        )}
      </CardContent>
    </Card>
  );
}