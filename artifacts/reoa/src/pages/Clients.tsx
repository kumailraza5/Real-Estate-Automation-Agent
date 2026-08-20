import { useState } from "react";
import { useListClients, useCreateClient, getListClientsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { Plus, Search, Filter, Mail, Phone, ChevronRight, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { LeadStatusBadge } from "./Leads";

export function ClientStatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, string> = {
    active: "bg-green-500/10 text-green-600 border-green-200",
    prospect: "bg-blue-500/10 text-blue-600 border-blue-200",
    closed: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${variantMap[status] || ""}`}>
      {status}
    </span>
  );
}



const clientSchema = z.object({
  firstName: z.string().min(2, "At least 2 characters"),
  lastName: z.string().min(2, "At least 2 characters"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  status: z.string().default("active"),
  source: z.string().optional(),
  budget: z.coerce.number().optional(),
});

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: clients, isLoading } = useListClients();

  const filteredClients = (Array.isArray(clients) ? clients : []).filter(client => {
    const matchesSearch = client.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          client.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          client.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || client.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage active and closed clients.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="font-medium shadow-sm gap-2">
              <Plus className="h-4 w-4" /> Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
            </DialogHeader>
            <CreateClientForm onSuccess={() => setIsCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search clients by name or email..."
              className="pl-9 bg-secondary border-transparent focus-visible:bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] bg-secondary border-transparent">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 text-muted" />
                    <p className="font-medium">No clients found</p>
                    <p className="text-sm mt-1">Add your first client to get started.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client) => (
                  <TableRow key={client.id} className="hover:bg-muted/30 cursor-pointer">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                          {client.firstName[0]}{client.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium">{client.firstName} {client.lastName}</p>
                          <p className="text-xs text-muted-foreground capitalize">{client.source || "—"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                          <Mail className="h-3 w-3" />{client.email}
                        </a>
                        {client.phone && (
                          <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                            <Phone className="h-3 w-3" />{client.phone}
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <LeadStatusBadge status={client.status} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {client.budget ? `$${Number(client.budget).toLocaleString()}` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(client.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Link href={`/clients/${client.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
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

function CreateClientForm({ onSuccess }: { onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const createClient = useCreateClient();

  const form = useForm<z.infer<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      firstName: "", lastName: "", email: "", phone: "",
      status: "active", source: "", budget: undefined,
    },
  });

  const onSubmit = (data: z.infer<typeof clientSchema>) => {
    createClient.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        toast.success("Client added successfully!");
        onSuccess();
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to add client");
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="firstName" render={({ field }) => (
            <FormItem>
              <FormLabel>First Name</FormLabel>
              <FormControl><Input placeholder="John" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="lastName" render={({ field }) => (
            <FormItem>
              <FormLabel>Last Name</FormLabel>
              <FormControl><Input placeholder="Smith" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl><Input type="email" placeholder="john@example.com" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel>Phone (Optional)</FormLabel>
              <FormControl><Input placeholder="+1 555-0100" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="source" render={({ field }) => (
            <FormItem>
              <FormLabel>Source (Optional)</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="How they found you" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="social_media">Social Media</SelectItem>
                  <SelectItem value="walk_in">Walk In</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="budget" render={({ field }) => (
            <FormItem>
              <FormLabel>Budget (Optional)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="e.g. 500000" {...field}
                  onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                  value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <Button type="button" variant="outline" onClick={onSuccess}>Cancel</Button>
          <Button type="submit" disabled={createClient.isPending}>
            {createClient.isPending ? "Adding..." : "Add Client"}
          </Button>
        </div>
      </form>
    </Form>
  );
}