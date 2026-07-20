import { useState } from "react";
import { useListAppointments } from "@workspace/api-client-react";
import { format, isToday, isTomorrow, isSameDay } from "date-fns";
import { 
  Calendar as CalendarIcon, 
  MapPin, 
  Users, 
  Video,
  Clock,
  Plus
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const { data: appointments, isLoading } = useListAppointments();

  const getDayAppointments = (day: Date) => {
    return appointments?.filter(apt => isSameDay(new Date(apt.startTime), day)) || [];
  };

  const selectedDayAppointments = date ? getDayAppointments(date) : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground flex items-center gap-3">
            <CalendarIcon className="h-8 w-8 text-primary" /> Calendar
          </h1>
          <p className="text-muted-foreground mt-1">Manage your viewings, meetings, and inspections.</p>
        </div>
        <Button className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" /> New Appointment
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Sidebar - Mini Calendar */}
        <div className="md:col-span-4 lg:col-span-3 space-y-6 shrink-0">
          <Card>
            <CardContent className="p-3">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="w-full"
                classNames={{
                  months: "w-full",
                  month: "w-full space-y-4",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex w-full",
                  head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] flex-1",
                  row: "flex w-full mt-2",
                  cell: "text-center text-sm relative p-0 hover:bg-muted focus-within:relative focus-within:z-20 w-9 h-9 rounded-md flex-1",
                  day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 flex items-center justify-center mx-auto rounded-md",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  day_today: "bg-accent text-accent-foreground",
                }}
              />
            </CardContent>
          </Card>
          
          <Card className="bg-secondary border-secondary-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Upcoming</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  {appointments?.slice(0, 3).map((apt, i) => (
                    <div key={i} className="flex flex-col gap-1 border-l-2 border-primary pl-3">
                      <span className="font-medium text-foreground truncate">{apt.title}</span>
                      <span className="text-muted-foreground text-xs">
                        {format(new Date(apt.startTime), "MMM d, h:mm a")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Content - Daily Schedule */}
        <div className="md:col-span-8 lg:col-span-9">
          <Card className="h-full flex flex-col">
            <CardHeader className="border-b border-border py-4 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">
                  {date ? (
                    isToday(date) ? "Today" : 
                    isTomorrow(date) ? "Tomorrow" : 
                    format(date, "EEEE, MMMM d, yyyy")
                  ) : "Select a date"}
                </CardTitle>
                {date && <Badge variant="secondary">{selectedDayAppointments.length} Appointments</Badge>}
              </div>
            </CardHeader>
            
            <CardContent className="p-0 flex-1 overflow-auto">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : selectedDayAppointments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-12 text-muted-foreground text-center">
                  <CalendarIcon className="h-12 w-12 text-muted mb-4" />
                  <h3 className="text-lg font-medium text-foreground">No appointments</h3>
                  <p className="mt-1 max-w-sm">Enjoy your free time, or schedule a new meeting for this day.</p>
                  <Button variant="outline" className="mt-6">Schedule Appointment</Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {selectedDayAppointments.sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()).map(apt => (
                    <div key={apt.id} className="p-6 flex flex-col sm:flex-row gap-6 hover:bg-muted/10 transition-colors">
                      <div className="w-32 shrink-0 flex flex-col items-start sm:items-end sm:text-right gap-1 pt-1">
                        <div className="text-lg font-bold text-foreground">
                          {format(new Date(apt.startTime), "h:mm a")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          to {format(new Date(apt.endTime), "h:mm a")}
                        </div>
                        <Badge variant="outline" className="mt-2 text-xs font-medium uppercase tracking-wider bg-background">
                          {apt.type}
                        </Badge>
                      </div>
                      
                      <div className="flex-1 bg-secondary/50 rounded-lg p-5 border border-border">
                        <h4 className="font-semibold text-lg mb-2">{apt.title}</h4>
                        {apt.description && (
                          <p className="text-muted-foreground text-sm mb-4">
                            {apt.description}
                          </p>
                        )}
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mt-auto pt-4 border-t border-border/50">
                          {apt.location && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                              <span className="truncate">{apt.location}</span>
                            </div>
                          )}
                          
                          {(apt.leadId || apt.clientId) && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Users className="h-4 w-4" />
                              <span>Client Meeting</span>
                            </div>
                          )}
                          
                          {apt.type === 'meeting' && !apt.location && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Video className="h-4 w-4" />
                              <span>Virtual Call</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}