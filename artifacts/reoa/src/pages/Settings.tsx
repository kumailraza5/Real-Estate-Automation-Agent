import { useState } from "react";
import { useListAgents, useCreateAgent, getListAgentsQueryKey, useDeleteAgent } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Settings2, Users, Building, Shield, Bell, Key, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold font-display tracking-tight text-foreground flex items-center gap-3">
          <Settings2 className="h-8 w-8 text-muted-foreground" /> Settings
        </h1>
        <p className="text-muted-foreground mt-1">Manage your team and platform configurations.</p>
      </div>

      <Tabs defaultValue="team" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full max-w-3xl mb-6">
          <TabsTrigger value="team" className="gap-2"><Users className="h-4 w-4" /> Team</TabsTrigger>
          <TabsTrigger value="company" className="gap-2"><Building className="h-4 w-4" /> Company</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Shield className="h-4 w-4" /> Security</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" /> Notifications</TabsTrigger>
          <TabsTrigger value="api" className="gap-2"><Key className="h-4 w-4" /> API</TabsTrigger>
        </TabsList>
        
        <TabsContent value="team" className="space-y-6">
          <TeamSettings />
        </TabsContent>
        
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Company Details</CardTitle>
              <CardDescription>Manage your public brokerage profile.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-2xl">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Brokerage Name</label>
                <Input defaultValue="Apex Real Estate Group" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Support Email</label>
                <Input defaultValue="support@apexrealestate.com" type="email" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Headquarters Address</label>
                <Input defaultValue="100 Market St, Suite 400, San Francisco, CA" />
              </div>
            </CardContent>
            <CardFooter className="border-t border-border mt-6 pt-6">
              <Button>Save Changes</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security & Authentication</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 max-w-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">Two-Factor Authentication</h4>
                  <p className="text-sm text-muted-foreground">Require all agents to use 2FA</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between border-t border-border pt-4">
                <div>
                  <h4 className="font-semibold">Session Timeout</h4>
                  <p className="text-sm text-muted-foreground">Automatically log out inactive users</p>
                </div>
                <Select defaultValue="2h">
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">1 Hour</SelectItem>
                    <SelectItem value="2h">2 Hours</SelectItem>
                    <SelectItem value="4h">4 Hours</SelectItem>
                    <SelectItem value="8h">8 Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TeamSettings() {
  const { data: agents, isLoading } = useListAgents();
  const deleteAgent = useDeleteAgent();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to remove this agent?")) {
      deleteAgent.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
          toast.success("Agent removed");
        }
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-start space-y-0">
        <div>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Manage agent accounts and permissions.</CardDescription>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Invite Member</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
            </DialogHeader>
            <div className="py-6 text-center text-muted-foreground">Invite form coming soon.</div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell></TableCell>
                </TableRow>
              ))
            ) : agents?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No agents found.
                </TableCell>
              </TableRow>
            ) : (
              (Array.isArray(agents) ? agents : []).map(agent => (
                <TableRow key={agent.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">
                        {agent.name[0]}
                      </div>
                      <div>
                        <div className="font-medium">{agent.name}</div>
                        <div className="text-xs text-muted-foreground">{agent.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">
                      {agent.role.replace('-', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={agent.status === 'active' ? 'secondary' : 'outline'} className="capitalize bg-green-500/10 text-green-600 border-green-200">
                      {agent.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(agent.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}