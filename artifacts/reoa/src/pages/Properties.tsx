import { useState } from "react";
import { useListProperties, useCreateProperty, useDeleteProperty, getListPropertiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, Search, MapPin, BedDouble, Bath, Maximize, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { PROPERTY_TYPES } from "@/lib/constants";

const propertySchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  address: z.string().min(5),
  city: z.string().min(2),
  price: z.coerce.number().min(1, "Price is required"),
  type: z.string().min(1, "Select a property type"),
  status: z.string().default("available"),
  bedrooms: z.coerce.number().optional(),
  bathrooms: z.coerce.number().optional(),
  area: z.coerce.number().optional(),
  description: z.string().optional(),
});

export default function Properties() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: properties, isLoading } = useListProperties({
    status: statusFilter !== "all" ? statusFilter : undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
  });

  const filteredProperties = (Array.isArray(properties) ? properties : []).filter(p =>
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Properties</h1>
          <p className="text-muted-foreground mt-1">Manage your listing portfolio and track availability.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" /> Add Property
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Property</DialogTitle>
            </DialogHeader>
            <CreatePropertyForm onSuccess={() => setIsCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row gap-4 p-4 bg-card rounded-lg border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by title, address, or city..."
            className="pl-9 bg-muted/50 border-transparent focus-visible:bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] bg-muted/50 border-transparent">
              <SelectValue placeholder="Property Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {PROPERTY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-muted/50 border-transparent">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="under-offer">Under Offer</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
              <SelectItem value="rented">Rented</SelectItem>
            </SelectContent>
          </Select>

          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="w-auto ml-2">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="grid">Grid</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {isLoading ? (
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-4"}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full rounded-none" />
              <CardHeader className="p-4 pb-0">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <Skeleton className="h-8 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProperties.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center">
            <Building2 className="h-12 w-12 text-muted mb-4" />
            <h3 className="text-lg font-medium text-foreground">No properties found</h3>
            <p className="max-w-sm mt-1 mb-6">Add your first property listing to get started.</p>
            <Button onClick={() => setIsCreateOpen(true)}>Add First Property</Button>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProperties.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProperties.map((p) => (
            <PropertyListRow key={p.id} property={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function PropertyCard({ property: p }: { property: any }) {
  const queryClient = useQueryClient();
  const deleteProperty = useDeleteProperty();
  const statusColors: Record<string, string> = {
    available: "bg-green-500/10 text-green-600 border-green-200",
    "under-offer": "bg-orange-500/10 text-orange-600 border-orange-200",
    sold: "bg-red-500/10 text-red-600 border-red-200",
    rented: "bg-blue-500/10 text-blue-600 border-blue-200",
  };

  const handleDelete = () => {
    deleteProperty.mutate({ id: p.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
        toast.success(`"${p.title}" deleted successfully`);
      },
      onError: () => toast.error("Failed to delete property"),
    });
  };

  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-shadow">
      <div className="h-44 bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center relative">
        <Building2 className="h-16 w-16 text-primary/30" />
        <Badge variant="outline" className={`absolute top-3 right-3 capitalize font-medium ${statusColors[p.status] || ""}`}>
          {p.status}
        </Badge>
        <Badge variant="secondary" className="absolute top-3 left-3 capitalize text-xs">
          {p.type}
        </Badge>
        {/* Delete button — visible on hover */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              className="absolute bottom-3 right-3 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
              disabled={deleteProperty.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Property?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{p.title}</strong>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <CardHeader className="p-4 pb-1">
        <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">{p.title}</h3>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
          <MapPin className="h-3 w-3" /> {p.address}, {p.city}
        </p>
      </CardHeader>
      <CardContent className="p-4 pt-1">
        <p className="text-xl font-bold text-primary font-display">
          ${Number(p.price).toLocaleString()}
        </p>
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          {p.bedrooms && <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" />{p.bedrooms} bd</span>}
          {p.bathrooms && <span className="flex items-center gap-1"><Bath className="h-3 w-3" />{p.bathrooms} ba</span>}
          {p.area && <span className="flex items-center gap-1"><Maximize className="h-3 w-3" />{p.area} sqft</span>}
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Link href={`/properties/${p.id}`} className="w-full">
          <Button variant="outline" className="w-full gap-2 text-xs">
            View Details <ChevronRight className="h-3 w-3" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function PropertyListRow({ property: p }: { property: any }) {
  const queryClient = useQueryClient();
  const deleteProperty = useDeleteProperty();

  const handleDelete = () => {
    deleteProperty.mutate({ id: p.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
        toast.success(`"${p.title}" deleted successfully`);
      },
      onError: () => toast.error("Failed to delete property"),
    });
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Building2 className="h-7 w-7 text-primary/60" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold line-clamp-1">{p.title}</h3>
          <p className="text-sm text-muted-foreground">{p.address}, {p.city}</p>
          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
            {p.bedrooms && <span>{p.bedrooms} bd</span>}
            {p.bathrooms && <span>{p.bathrooms} ba</span>}
            {p.area && <span>{p.area} sqft</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-primary">${Number(p.price).toLocaleString()}</p>
          <Badge variant="outline" className="capitalize text-xs mt-1">{p.status}</Badge>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link href={`/properties/${p.id}`}>
            <Button variant="ghost" size="icon"><ChevronRight className="h-4 w-4" /></Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                disabled={deleteProperty.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Property?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete <strong>{p.title}</strong>? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

function CreatePropertyForm({ onSuccess }: { onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const createProperty = useCreateProperty();

  const form = useForm<z.infer<typeof propertySchema>>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      title: "", address: "", city: "", price: undefined as any,
      type: "", status: "available", bedrooms: undefined, bathrooms: undefined,
      area: undefined, description: "",
    },
  });

  const onSubmit = (data: z.infer<typeof propertySchema>) => {
    createProperty.mutate({ data: data as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
        toast.success("Property added successfully!");
        onSuccess();
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to add property");
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel>Property Title</FormLabel>
            <FormControl><Input placeholder="e.g. Luxury 3BR Apartment in Downtown" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="address" render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl><Input placeholder="123 Main St" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="city" render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl><Input placeholder="Dubai" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="type" render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
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
          )} />
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="under-offer">Under Offer</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="rented">Rented</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="price" render={({ field }) => (
          <FormItem>
            <FormLabel>Price (USD)</FormLabel>
            <FormControl>
              <Input type="number" placeholder="e.g. 850000" {...field}
                onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                value={field.value ?? ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-3 gap-4">
          <FormField control={form.control} name="bedrooms" render={({ field }) => (
            <FormItem>
              <FormLabel>Bedrooms</FormLabel>
              <FormControl>
                <Input type="number" placeholder="3" {...field}
                  onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                  value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="bathrooms" render={({ field }) => (
            <FormItem>
              <FormLabel>Bathrooms</FormLabel>
              <FormControl>
                <Input type="number" placeholder="2" {...field}
                  onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                  value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="area" render={({ field }) => (
            <FormItem>
              <FormLabel>Area (sqft)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="1800" {...field}
                  onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                  value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Description (Optional)</FormLabel>
            <FormControl><Textarea placeholder="Describe the property..." rows={3} {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <Button type="button" variant="outline" onClick={onSuccess}>Cancel</Button>
          <Button type="submit" disabled={createProperty.isPending}>
            {createProperty.isPending ? "Adding..." : "Add Property"}
          </Button>
        </div>
      </form>
    </Form>
  );
}