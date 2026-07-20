import { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetProperty, 
  getGetPropertyQueryKey,
  useListAgents
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { 
  Building2, MapPin, BedDouble, Bath, Maximize, 
  ArrowLeft, Edit, DollarSign, Home, Image as ImageIcon 
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const propertyId = parseInt(id || "0", 10);
  
  const { data: property, isLoading } = useGetProperty(propertyId, { 
    query: { enabled: !!propertyId, queryKey: [getGetPropertyQueryKey(propertyId)] } 
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
          <Button variant="outline" size="icon">
            <Edit className="h-4 w-4" />
          </Button>
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