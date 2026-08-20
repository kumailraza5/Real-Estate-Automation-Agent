import { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetProperty, 
  getGetPropertyQueryKey,
  useUpdateProperty,
  getListPropertiesQueryKey,
  useListAgents
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  Building2, MapPin, BedDouble, Bath, Maximize, 
  ArrowLeft, Edit, DollarSign, Home, Image as ImageIcon 
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PROPERTY_TYPES } from "@/lib/constants";

const editPropertySchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  address: z.string().min(5),
  city: z.string().min(2),
  price: z.coerce.number().min(1, "Price is required"),
  type: z.string().min(1, "Select a property type"),
  status: z.string(),
  bedrooms: z.coerce.number().optional(),
  bathrooms: z.coerce.number().optional(),
  area: z.coerce.number().optional(),
  description: z.string().optional(),
});

function EditPropertyModal({ property, propertyId }: { property: any; propertyId: number }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const updateProperty = useUpdateProperty();

  const form = useForm<z.infer<typeof editPropertySchema>>({
    resolver: zodResolver(editPropertySchema),
    defaultValues: {
      title: property.title || "",
      address: property.address || "",
      city: property.city || "",
      price: property.price || 0,
      type: property.type || "residential",
      status: property.status || "available",
      bedrooms: property.bedrooms || 0,
      bathrooms: property.bathrooms || 0,
      area: property.area || 0,
      description: property.description || "",
    },
  });

  const onSubmit = (data: z.infer<typeof editPropertySchema>) => {
    updateProperty.mutate(
      { id: propertyId, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPropertyQueryKey(propertyId), exact: true });
          queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
          toast.success("Property updated successfully!");
          setOpen(false);
        },
        onError: (err: any) => {
          toast.error(err.message || "Failed to update property");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Property</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
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
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
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
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="under-offer">Under Offer</SelectItem>
                        <SelectItem value="sold">Sold</SelectItem>
                        <SelectItem value="rented">Rented</SelectItem>
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
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price ($)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Area (sqm)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="bedrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bedrooms</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bathrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bathrooms</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={updateProperty.isPending}>
              {updateProperty.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const propertyId = parseInt(id || "0", 10);
  
  const { data: property, isLoading } = useGetProperty(propertyId, { 
    query: { enabled: !!propertyId, queryKey: getGetPropertyQueryKey(propertyId) } 
  });
  
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[300px] w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-[300px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!property) return <div>Property not found.</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="h-4 w-4" />
        <Link href="/properties">Back to Properties</Link>
      </div>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Badge variant="secondary" className="capitalize font-medium">{property.type}</Badge>
            <Badge variant={
              property.status === 'available' ? 'default' : 
              property.status === 'sold' ? 'secondary' : 'outline'
            } className="capitalize">{property.status.replace('-', ' ')}</Badge>
          </div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground mt-2">
            {property.title}
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-lg">
            <MapPin className="h-5 w-5" /> {property.address}, {property.city}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold font-display text-primary">
            ${property.price.toLocaleString()}
          </div>
          <EditPropertyModal property={property} propertyId={propertyId} />
        </div>
      </div>

      {/* Hero Image Section */}
      <div className="w-full h-[400px] md:h-[500px] rounded-xl overflow-hidden relative bg-muted border border-border shadow-sm group">
        {property.imageUrl ? (
          <img 
            src={property.imageUrl} 
            alt={property.title} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-secondary/30 text-muted-foreground">
            <ImageIcon className="h-16 w-16 mb-4 opacity-20" />
            <p>No image available</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start mt-8">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Property Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-muted/30 rounded-lg border border-border">
                <div className="flex flex-col items-center justify-center p-2">
                  <Home className="h-6 w-6 text-muted-foreground mb-2" />
                  <span className="text-sm font-medium capitalize">{property.type}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">Type</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 border-l border-border md:border-t-0 border-t md:border-l">
                  <BedDouble className="h-6 w-6 text-muted-foreground mb-2" />
                  <span className="text-sm font-medium">{property.bedrooms} Beds</span>
                  <span className="text-xs text-muted-foreground mt-0.5">Bedrooms</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 border-l-0 md:border-l border-border border-t md:border-t-0">
                  <Bath className="h-6 w-6 text-muted-foreground mb-2" />
                  <span className="text-sm font-medium">{property.bathrooms} Baths</span>
                  <span className="text-xs text-muted-foreground mt-0.5">Bathrooms</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 border-l border-border border-t md:border-t-0">
                  <Maximize className="h-6 w-6 text-muted-foreground mb-2" />
                  <span className="text-sm font-medium">{property.area} sqm</span>
                  <span className="text-xs text-muted-foreground mt-0.5">Living Area</span>
                </div>
              </div>

              <div className="prose prose-sm dark:prose-invert max-w-none">
                <h3 className="text-lg font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {property.description || "No description provided."}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Tabs defaultValue="appointments" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="appointments">Appointments</TabsTrigger>
              <TabsTrigger value="leads">Interested Leads</TabsTrigger>
            </TabsList>
            <TabsContent value="appointments">
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No appointments scheduled for this property.
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="leads">
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No leads currently tracking this property.
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Agent & Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="bg-muted/10 pb-4 border-b border-border">
              <CardTitle className="text-base">Listing Agent</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {property.assignedAgentId ? (
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-lg">
                    {property.assignedAgentName?.[0] || 'A'}
                  </div>
                  <div>
                    <p className="font-semibold">{property.assignedAgentName}</p>
                    <p className="text-sm text-muted-foreground">Primary Agent</p>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground flex flex-col gap-3">
                  <p>No agent currently assigned to this property.</p>
                  <Button variant="outline" size="sm" className="w-full">Assign Agent</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start gap-2" variant="outline">
                <Building2 className="h-4 w-4" /> Change Status
              </Button>
              <Button className="w-full justify-start gap-2" variant="outline">
                <DollarSign className="h-4 w-4" /> Update Price
              </Button>
            </CardContent>
          </Card>
          
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Added to system on {format(new Date(property.createdAt), "MMMM d, yyyy")}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}