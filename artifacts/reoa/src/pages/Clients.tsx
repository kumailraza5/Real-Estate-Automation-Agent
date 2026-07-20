import { useState } from "react";
import { useListClients, useCreateClient, getListClientsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { Plus, Search, Filter, Mail, Phone, ChevronRight, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadStatusBadge } from "./Leads";

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const { data: clients, isLoading } = useListClients();
  
  const filteredClients = clients?.filter(client => {
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
            </DialogHeader>
            <div className="py-6 text-center text-muted-foreground">Form coming soon</div>
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
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead className="hidden lg:table-cell">Added</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[100px]" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-[80px]" /></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : filteredClients?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 text-muted" />
                    No clients found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients?.map((client) => (
                  <TableRow key={client.id} className="group hover:bg-secondary/20 transition-colors cursor-pointer" onClick={() => window.location.href = `/clients/\${client.id}`}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{client.firstName} {client.lastName}</span>
                        {client.preferredPropertyType && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px] capitalize">
                            Prefers {client.preferredPropertyType}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5 hover:text-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[150px]">{client.email}</span>
                        </div>
                        {client.phone && (
                          <div className="flex items-center gap-1.5 hover:text-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{client.phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ClientStatusBadge status={client.status} />
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {client.budget ? `$\${client.budget.toLocaleString()}` : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {format(new Date(client.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/clients/\${client.id}`}>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
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

export function ClientStatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, string> = {
    active: "bg-blue-500/10 text-blue-600 border-blue-200",
    prospect: "bg-purple-500/10 text-purple-600 border-purple-200",
    closed: "bg-green-500/10 text-green-600 border-green-200",
  };
  
  return (
    <Badge variant="outline" className={`capitalize font-medium \${variantMap[status] || ""}`}>
      {status}
    </Badge>
  );
}