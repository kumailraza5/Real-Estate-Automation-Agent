import { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetClient, 
  useGetClientNotes, 
  useGetClientActivity,
  useCreateClientNote,
  useUpdateClient,
  getGetClientQueryKey,
  getGetClientNotesQueryKey,
  useListAgents,
  getGetClientActivityQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  UserCircle2, Phone, Mail, MapPin, DollarSign, 
  Clock, Edit, FileText, Activity, 
  CheckSquare, ArrowLeft, Send
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientStatusBadge } from "./Clients";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const clientId = parseInt(id || "0", 10);
  const queryClient = useQueryClient();
  
  const { data: client, isLoading: loadingClient } = useGetClient(clientId, { 
    query: { enabled: !!clientId, queryKey: getGetClientQueryKey(clientId) } 
  });
  
  const { data: notes, isLoading: loadingNotes } = useGetClientNotes(clientId, {
    query: { enabled: !!clientId, queryKey: getGetClientNotesQueryKey(clientId) }
  });
  
  const { data: activity, isLoading: loadingActivity } = useGetClientActivity(clientId, {
    query: { enabled: !!clientId, queryKey: getGetClientActivityQueryKey(clientId) }
  });

  const { data: agents } = useListAgents();
  const updateClient = useUpdateClient();

  const handleStatusChange = (newStatus: string) => {
    updateClient.mutate(
      { id: clientId, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
          queryClient.invalidateQueries({ queryKey: getGetClientActivityQueryKey(clientId) });
          toast.success(`Status updated to \${newStatus}`);
        }
      }
    );
  };

  const handleAgentChange = (newAgentId: string) => {
    updateClient.mutate(
      { id: clientId, data: { assignedAgentId: parseInt(newAgentId, 10) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
          toast.success("Agent assigned successfully");
        }
      }
    );
  };

  if (loadingClient) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-32 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-6">
            <Skeleton className="h-[400px] w-full" />
          </div>
          <div className="md:col-span-2 space-y-6">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!client) return <div>Client not found.</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="h-4 w-4" />
        <Link href="/clients">Back to Clients</Link>
      </div>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">
              {client.firstName} {client.lastName}
            </h1>
            <ClientStatusBadge status={client.status} />
          </div>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            Client added on {format(new Date(client.createdAt), "MMMM d, yyyy")}
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select value={client.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Update Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="prospect">Prospect</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2">
            <Edit className="h-4 w-4" /> Edit Profile
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column - Profile Card */}
        <div className="space-y-6">
          <Card className="overflow-hidden border-t-4 border-t-primary">
            <div className="bg-muted/30 p-6 flex flex-col items-center justify-center border-b border-border">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-display font-bold shadow-sm mb-4">
                {client.firstName[0]}{client.lastName[0]}
              </div>
              <h2 className="text-xl font-bold">{client.firstName} {client.lastName}</h2>
            </div>
            
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                <div className="p-4 flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:\${client.email}`} className="text-sm hover:underline">{client.email}</a>
                </div>
                {client.phone && (
                  <div className="p-4 flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:\${client.phone}`} className="text-sm hover:underline">{client.phone}</a>
                  </div>
                )}
                {client.budget && (
                  <div className="p-4 flex items-center gap-3">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Budget: ${client.budget.toLocaleString()}</span>
                  </div>
                )}
                {client.preferredPropertyType && (
                  <div className="p-4 flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm capitalize">Looking for: {client.preferredPropertyType}</span>
                  </div>
                )}
                
                <div className="p-4 bg-muted/10">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Assignment</p>
                  <Select value={client.assignedAgentId?.toString() || ""} onValueChange={handleAgentChange}>
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned" disabled>Unassigned</SelectItem>
                      {agents?.map(agent => (
                        <SelectItem key={agent.id} value={agent.id.toString()}>{agent.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="notes" className="w-full">
            <TabsList className="grid grid-cols-3 mb-4 w-[400px]">
              <TabsTrigger value="notes" className="gap-2"><FileText className="h-4 w-4" /> Notes</TabsTrigger>
              <TabsTrigger value="activity" className="gap-2"><Activity className="h-4 w-4" /> Activity</TabsTrigger>
              <TabsTrigger value="tasks" className="gap-2"><CheckSquare className="h-4 w-4" /> Tasks</TabsTrigger>
            </TabsList>
            
            <TabsContent value="notes" className="space-y-4">
              <NotesSection clientId={clientId} notes={notes} loading={loadingNotes} />
            </TabsContent>
            
            <TabsContent value="activity">
              <Card>
                <CardHeader>
                  <CardTitle>Activity Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingActivity ? (
                    <div className="space-y-4">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : activity?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No activity recorded yet.</div>
                  ) : (
                    <div className="space-y-6 border-l-2 border-muted ml-3 pl-4 pt-2 pb-2">
                      {activity?.map(log => (
                        <div key={log.id} className="relative">
                          <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-card border-2 border-primary" />
                          <div className="bg-muted/20 rounded-lg p-3 border border-border">
                            <p className="text-sm">
                              <span className="font-semibold">{log.performedBy || 'System'}</span> {log.description}
                            </p>
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(new Date(log.createdAt), 'MMM d, yyyy • h:mm a')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="tasks">
              <Card>
                <CardContent className="py-12 text-center flex flex-col items-center justify-center">
                  <CheckSquare className="h-12 w-12 text-muted mb-4" />
                  <h3 className="text-lg font-medium">No Tasks Assigned</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mt-1 mb-4">
                    Create tasks to manage relationship with this client.
                  </p>
                  <Button variant="outline">Create Task</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function NotesSection({ clientId, notes, loading }: { clientId: number, notes: any, loading: boolean }) {
  const [newNote, setNewNote] = useState("");
  const createNote = useCreateClientNote();
  const queryClient = useQueryClient();

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    
    createNote.mutate(
      { id: clientId, data: { content: newNote } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetClientNotesQueryKey(clientId) });
          setNewNote("");
          toast.success("Note added");
        }
      }
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <Textarea 
            placeholder="Add a note about this client..." 
            className="min-h-[100px] mb-3 resize-none bg-muted/20"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Press Cmd+Enter to save</span>
            <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim() || createNote.isPending} className="gap-2">
              <Send className="h-3 w-3" /> Save Note
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {loading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : notes?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground bg-muted/10 rounded-lg border border-border border-dashed">
            No notes yet. Add one above.
          </div>
        ) : (
          notes?.map((note: any) => (
            <Card key={note.id} className="shadow-none bg-muted/5 border-border">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium text-sm flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-bold">
                      {note.authorName ? note.authorName[0] : 'S'}
                    </div>
                    {note.authorName || 'System'}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(note.createdAt), 'MMM d, h:mm a')}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap mt-2 pl-7 border-l-2 border-transparent">
                  {note.content}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}