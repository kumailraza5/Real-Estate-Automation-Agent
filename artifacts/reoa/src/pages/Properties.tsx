import { useState } from "react";
import { useListProperties, getListPropertiesQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Building2, Search, Filter, MapPin, BedDouble, Bath, Maximize, ChevronRight } from "lucide-react";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Properties() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("available");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: properties, isLoading } = useListProperties({
    status: statusFilter !== "all" ? statusFilter : undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
  });

  const filteredProperties = properties?.filter(p => 
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
        <Button className="gap-2 shadow-sm">
          <Building2 className="h-4 w-4" /> Add Property
        </Button>
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
              <SelectItem value="apartment">Apartment</SelectItem>
              <SelectItem value="villa">Villa</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="land">Land</SelectItem>
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
            viewMode === "grid" ? (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-48 w-full rounded-none" />
                <CardHeader className="p-4 pb-0">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <Skeleton className="h-8 w-1/3 mb-4" />
                  <div className="flex gap-4">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Skeleton key={i} className="h-32 w-full" />
            )
          ))}
        </div>
      ) : filteredProperties?.length === 0 ? (
        <div className="py-24 text-center border border-dashed rounded-lg bg-card text-muted-foreground flex flex-col items-center">
          <Building2 className="h-12 w-12 mb-4 text-muted" />
          <h3 className="text-lg font-medium text-foreground">No properties found</h3>
          <p className="mt-1">Try adjusting your filters or search term.</p>
        </div>
      ) : (
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-4"}>
          {filteredProperties?.map((property) => (
            viewMode === "grid" ? (
              <Link key={property.id} href={`/properties/\${property.id}`}>
                <Card className="overflow-hidden cursor-pointer hover-elevate transition-all border-border hover:border-accent/50 group h-full flex flex-col">
                  <div className="relative h-48 w-full bg-muted overflow-hidden">
                    {property.imageUrl ? (
                      <img 
                        src={property.imageUrl} 
                        alt={property.title} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary/50">
                        <Building2 className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                      <PropertyStatusBadge status={property.status} />
                      <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm shadow-sm capitalize">
                        {property.type}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-4 flex-1 flex flex-col">
                    <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-accent transition-colors">{property.title}</h3>
                    <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-1.5 line-clamp-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0" /> {property.address}, {property.city}
                    </p>
                    <div className="text-xl font-bold font-display mt-auto pt-4 text-primary">
                      ${property.price.toLocaleString()}
                    </div>
                  </CardContent>
                  <CardFooter className="p-4 pt-0 border-t border-border mt-auto bg-muted/10 grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5 justify-center py-2">
                      <BedDouble className="h-4 w-4" /> {property.bedrooms}
                    </div>
                    <div className="flex items-center gap-1.5 justify-center py-2 border-l border-r border-border">
                      <Bath className="h-4 w-4" /> {property.bathrooms}
                    </div>
                    <div className="flex items-center gap-1.5 justify-center py-2">
                      <Maximize className="h-4 w-4" /> {property.area} <span className="text-[10px]">sqm</span>
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            ) : (
              <Link key={property.id} href={`/properties/\${property.id}`}>
                <Card className="overflow-hidden cursor-pointer hover-elevate transition-all border-border hover:border-accent/50 group flex flex-row">
                  <div className="relative h-32 w-48 shrink-0 bg-muted overflow-hidden hidden sm:block">
                    {property.imageUrl ? (
                      <img 
                        src={property.imageUrl} 
                        alt={property.title} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary/50">
                        <Building2 className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4 flex-1 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <PropertyStatusBadge status={property.status} />
                        <span className="text-xs font-medium text-muted-foreground capitalize">{property.type}</span>
                      </div>
                      <h3 className="font-semibold text-lg truncate group-hover:text-accent transition-colors">{property.title}</h3>
                      <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" /> {property.address}, {property.city}
                      </p>
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-4">
                      <div className="text-xl font-bold font-display text-primary">
                        ${property.price.toLocaleString()}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4" /> {property.bedrooms}</span>
                        <span className="flex items-center gap-1.5"><Bath className="h-4 w-4" /> {property.bathrooms}</span>
                        <span className="flex items-center gap-1.5"><Maximize className="h-4 w-4" /> {property.area} sqm</span>
                      </div>
                    </div>
                  </CardContent>
                  <div className="p-4 border-l border-border flex items-center justify-center bg-muted/10 group-hover:bg-accent/5 transition-colors hidden md:flex">
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </div>
                </Card>
              </Link>
            )
          ))}
        </div>
      )}
    </div>
  );
}

function PropertyStatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, string> = {
    "available": "bg-green-500/10 text-green-600 border-green-200",
    "under-offer": "bg-orange-500/10 text-orange-600 border-orange-200",
    "sold": "bg-accent/10 text-accent border-accent/30",
    "rented": "bg-blue-500/10 text-blue-600 border-blue-200",
  };
  
  return (
    <Badge variant="outline" className={`capitalize font-medium shadow-sm \${variantMap[status] || ""}`}>
      {status.replace('-', ' ')}
    </Badge>
  );
}