import { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetLead, 
  useGetLeadNotes, 
  useGetLeadActivity,
  useCreateLeadNote,
  useUpdateLead,
  getGetLeadQueryKey,
  getGetLeadNotesQueryKey,
  useListAgents,
  getGetLeadActivityQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  UserCircle2, Phone, Mail, MapPin, DollarSign, 
  Calendar, Clock, Edit, FileText, Activity, 
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PROPERTY_TYPES } from "@/lib/constants";
import { LeadStatusBadge } from "./Leads";

const leadSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  source: z.string().min(2),
  status: z.string(),
  assignedAgentId: z.coerce.number().optional(),
  budget: z.coerce.number().optional(),
  propertyType: z.string().optional(),
});

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const leadId = parseInt(id || "0", 10);
  const queryClient = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  const { data: lead, isLoading: loadingLead } = useGetLead(leadId, { 
    query: { enabled: !!leadId, queryKey: getGetLeadQueryKey(leadId) } 
  });
  
  const { data: notes, isLoading: loadingNotes } = useGetLeadNotes(leadId, {
    query: { enabled: !!leadId, queryKey: getGetLeadNotesQueryKey(leadId) }
  });
  
  const { data: activity, isLoading: loadingActivity } = useGetLeadActivity(leadId, {
    query: { enabled: !!leadId, queryKey: getGetLeadActivityQueryKey(leadId) }
  });

  const { data: agents } = useListAgents();
  const updateLead = useUpdateLead();

  const handleStatusChange = (newStatus: string) => {
    updateLead.mutate(
      { id: leadId, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
          queryClient.invalidateQueries({ queryKey: getGetLeadActivityQueryKey(leadId) });
          toast.success(`Status updated to \${newStatus}`);
        }
      }
    );
  };

  const handleAgentChange = (newAgentId: string) => {
    updateLead.mutate(
      { id: leadId, data: { assignedAgentId: parseInt(newAgentId, 10) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
          toast.success("Agent assigned successfully");
        }
      }
    );
  };

  const [isConverting, setIsConverting] = useState(false);
  const handleConvert = async () => {
    if (lead?.status === "converted") return;
    setIsConverting(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/convert`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to convert lead");
      
      toast.success("Lead successfully converted to Client");
      queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
      queryClient.invalidateQueries({ queryKey: getGetLeadActivityQueryKey(leadId) });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsConverting(false);
    }
  };

  if (loadingLead) {
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

  if (!lead) return <div>Lead not found.</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="h-4 w-4" />
        <Link href="/leads">Back to Leads</Link>
      </div>

      {(lead as any).clientId && (
        <div className="bg-primary/10 border border-primary/20 rounded-md p-4 mb-6 flex items-center justify-between">
          <p className="text-sm font-medium">This lead has been converted to a client.</p>
          <Link href={`/clients/${(lead as any).clientId}`} className="text-sm font-bold text-primary hover:underline">
            View Client Record →
          </Link>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">
              {lead.firstName} {lead.lastName}
            </h1>
            <LeadStatusBadge status={lead.status} />
          </div>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            Lead added on {format(new Date(lead.createdAt), "MMMM d, yyyy")} • Source: <span className="capitalize font-medium">{lead.source}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select value={lead.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Update Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="proposal">Proposal</SelectItem>
              <SelectItem value="negotiation">Negotiation</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="default" 
            onClick={handleConvert} 
            disabled={isConverting || lead.status === "converted"}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {lead.status === "converted" ? "Converted" : "Convert to Client"}
          </Button>
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Edit className="h-4 w-4" /> Edit Profile
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Profile</DialogTitle>
              </DialogHeader>
              <EditLeadForm lead={lead} onSuccess={() => setIsEditOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column - Profile Card */}
        <div className="space-y-6">
          <Card className="overflow-hidden border-t-4 border-t-accent">
            <div className="bg-muted/30 p-6 flex flex-col items-center justify-center border-b border-border">
              <div className="h-20 w-20 rounded-full bg-accent/20 flex items-center justify-center text-accent text-3xl font-display font-bold shadow-sm mb-4">
                {lead.firstName[0]}{lead.lastName[0]}
              </div>
              <h2 className="text-xl font-bold">{lead.firstName} {lead.lastName}</h2>
              <div className="flex items-center mt-2 gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Score</span>
                <Badge variant={lead.score > 70 ? "default" : "secondary"}>{lead.score} / 100</Badge>
              </div>
            </div>
            
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                <div className="p-4 flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:\${lead.email}`} className="text-sm hover:underline">{lead.email}</a>
                </div>
                {lead.phone && (
                  <div className="p-4 flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:\${lead.phone}`} className="text-sm hover:underline">{lead.phone}</a>
                  </div>
                )}
                {lead.budget && (
                  <div className="p-4 flex items-center gap-3">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Budget: ${lead.budget.toLocaleString()}</span>
                  </div>
                )}
                {lead.propertyType && (
                  <div className="p-4 flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm capitalize">Looking for: {lead.propertyType}</span>
                  </div>
                )}
                
                <div className="p-4 bg-muted/10">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Assignment</p>
                  <Select value={lead.assignedAgentId?.toString() || ""} onValueChange={handleAgentChange}>
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned" disabled>Unassigned</SelectItem>
                      {(Array.isArray(agents) ? agents : []).map(agent => (
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
              <NotesSection leadId={leadId} notes={notes} loading={loadingNotes} />
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
                      {(Array.isArray(activity) ? activity : []).map(log => (
                        <div key={log.id} className="relative">
                          <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-card border-2 border-accent" />
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
                    Create tasks to follow up with this lead and track your progress through the sales cycle.
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

function NotesSection({ leadId, notes, loading }: { leadId: number, notes: any, loading: boolean }) {
  const [newNote, setNewNote] = useState("");
  const createNote = useCreateLeadNote();
  const queryClient = useQueryClient();

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    
    createNote.mutate(
      { id: leadId, data: { content: newNote } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLeadNotesQueryKey(leadId) });
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
            placeholder="Add a note about this lead..." 
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
          (Array.isArray(notes) ? notes : []).map((note: any) => (
            <Card key={note.id} className="shadow-none bg-muted/5 border-border">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium text-sm flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-accent/20 flex items-center justify-center text-xs text-accent font-bold">
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

function EditLeadForm({ lead, onSuccess }: { lead: any; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const updateLead = useUpdateLead();
  const { data: agents } = useListAgents();
  
  const form = useForm<z.infer<typeof leadSchema>>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      firstName: lead.firstName || "",
      lastName: lead.lastName || "",
      email: lead.email || "",
      phone: lead.phone || "",
      source: lead.source || "website",
      status: lead.status || "new",
      budget: lead.budget || undefined,
      propertyType: lead.propertyType || "",
      assignedAgentId: lead.assignedAgentId || undefined,
    },
  });

  const onSubmit = (data: z.infer<typeof leadSchema>) => {
    updateLead.mutate({ id: lead.id, data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(lead.id) });
        queryClient.invalidateQueries({ queryKey: getGetLeadActivityQueryKey(lead.id) });
        toast.success("Profile updated successfully");
        onSuccess();
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to update profile");
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
               <FormItem>
                 <FormLabel>First Name</FormLabel>
                 <FormControl>
                   <Input {...field} />
                 </FormControl>
                 <FormMessage />
               </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
               <FormItem>
                 <FormLabel>Last Name</FormLabel>
                 <FormControl>
                   <Input {...field} />
                 </FormControl>
                 <FormMessage />
               </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
               <FormItem>
                 <FormLabel>Email</FormLabel>
                 <FormControl>
                   <Input type="email" {...field} />
                 </FormControl>
                 <FormMessage />
               </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
               <FormItem>
                 <FormLabel>Phone (Optional)</FormLabel>
                 <FormControl>
                   <Input {...field} />
                 </FormControl>
                 <FormMessage />
               </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="source"
            render={({ field }) => (
               <FormItem>
                 <FormLabel>Source</FormLabel>
                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                   <FormControl>
                     <SelectTrigger>
                       <SelectValue placeholder="Select source" />
                     </SelectTrigger>
                   </FormControl>
                   <SelectContent>
                     <SelectItem value="website">Website</SelectItem>
                     <SelectItem value="referral">Referral</SelectItem>
                     <SelectItem value="social">Social Media</SelectItem>
                     <SelectItem value="walk-in">Walk-in</SelectItem>
                     <SelectItem value="zillow">Zillow</SelectItem>
                   </SelectContent>
                 </Select>
                 <FormMessage />
               </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="propertyType"
            render={({ field }) => (
               <FormItem>
                 <FormLabel>Interest (Optional)</FormLabel>
                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                   <FormControl>
                     <SelectTrigger>
                       <SelectValue placeholder="Select type" />
                     </SelectTrigger>
                   </FormControl>
                   <SelectContent>
                     {PROPERTY_TYPES.map((t) => (
                       <SelectItem key={t.value} value={t.value}>
                         {t.label}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
                 <FormMessage />
               </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="budget"
            render={({ field }) => (
               <FormItem>
                 <FormLabel>Budget (Optional)</FormLabel>
                 <FormControl>
                   <Input
                     type="number"
                     placeholder="e.g. 750000"
                     {...field}
                     onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                     value={field.value ?? ''}
                   />
                 </FormControl>
                 <FormMessage />
               </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="assignedAgentId"
            render={({ field }) => (
               <FormItem>
                 <FormLabel>Assign To (Optional)</FormLabel>
                 <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                   <FormControl>
                     <SelectTrigger>
                       <SelectValue placeholder="Select an agent" />
                     </SelectTrigger>
                   </FormControl>
                   <SelectContent>
                     {(Array.isArray(agents) ? agents : []).map(agent => (
                       <SelectItem key={agent.id} value={agent.id.toString()}>{agent.name}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
                 <FormMessage />
               </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
          <Button type="button" variant="outline" onClick={onSuccess}>Cancel</Button>
          <Button type="submit" disabled={updateLead.isPending}>
            {updateLead.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}