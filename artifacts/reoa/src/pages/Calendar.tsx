import { useState } from "react";
import { useListAppointments, useCreateAppointment, getListAppointmentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, isToday, isTomorrow, isSameDay, addDays } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  MapPin,
  Users,
  Video,
  Clock,
  Plus,
  ChevronRight,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const appointmentSchema = z.object({
  title: z.string().min(3, "Title is required"),
  description: z.string().optional(),
  type: z.string().default("viewing"),
  startTime: z.string().min(1, "Start date/time is required"),
  endTime: z.string().min(1, "End date/time is required"),
  location: z.string().optional(),
});

const TYPE_COLORS: Record<string, string> = {
  viewing:    "bg-blue-500/10 text-blue-600 border-blue-200",
  meeting:    "bg-purple-500/10 text-purple-600 border-purple-200",
  inspection: "bg-orange-500/10 text-orange-600 border-orange-200",
  call:       "bg-green-500/10 text-green-600 border-green-200",
  other:      "bg-muted text-muted-foreground border-border",
};

const TYPE_ICONS: Record<string, string> = {
  viewing: "🏠", meeting: "👥", inspection: "🔍", call: "📞", other: "📋",
};

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: appointments, isLoading } = useListAppointments();

  const allAppointments = Array.isArray(appointments) ? appointments : [];

  const getDayAppointments = (day: Date) =>
    allAppointments.filter(apt => isSameDay(new Date(apt.startTime), day));

  const selectedDayAppointments = date
    ? getDayAppointments(date).sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )
    : [];

  // Upcoming: next 5 appointments from now
  const now = new Date();
  const upcoming = [...allAppointments]
    .filter(apt => new Date(apt.startTime) >= now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground flex items-center gap-3">
            <CalendarIcon className="h-8 w-8 text-primary" />
            Calendar
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your viewings, meetings, and inspections.
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" /> New Appointment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Schedule New Appointment</DialogTitle>
            </DialogHeader>
            <CreateAppointmentForm
              defaultDate={date}
              onSuccess={() => setIsCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Main Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">

        {/* ─ Left Sidebar ─ */}
        <div className="space-y-4">
          {/* Mini Calendar */}
          <Card>
            <CardContent className="p-4">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="w-full"
                classNames={{
                  months: "w-full",
                  month: "w-full space-y-3",
                  caption: "flex justify-center pt-1 relative items-center mb-2",
                  caption_label: "text-sm font-semibold",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse",
                  head_row: "flex w-full",
                  head_cell: "text-muted-foreground rounded-md font-normal text-[0.75rem] flex-1 text-center py-1",
                  row: "flex w-full mt-1",
                  cell: "flex-1 text-center text-sm p-0 relative focus-within:z-20",
                  day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100 mx-auto flex items-center justify-center rounded-full hover:bg-muted transition-colors cursor-pointer",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  day_today: "bg-accent/80 text-accent-foreground font-semibold",
                  day_outside: "text-muted-foreground opacity-40",
                  day_disabled: "text-muted-foreground opacity-30",
                }}
              />
            </CardContent>
          </Card>

          {/* Upcoming Appointments */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Upcoming
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {isLoading ? (
                <>
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </>
              ) : upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-2">
                  No upcoming appointments
                </p>
              ) : (
                upcoming.map((apt) => (
                  <button
                    key={apt.id}
                    onClick={() => setDate(new Date(apt.startTime))}
                    className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-base leading-none mt-0.5">
                        {TYPE_ICONS[apt.type] ?? "📋"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {apt.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isToday(new Date(apt.startTime))
                            ? "Today"
                            : isTomorrow(new Date(apt.startTime))
                            ? "Tomorrow"
                            : format(new Date(apt.startTime), "EEE, MMM d")}{" "}
                          · {format(new Date(apt.startTime), "h:mm a")}
                        </p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─ Right Panel — Daily Schedule ─ */}
        <Card className="min-h-[600px] flex flex-col">
          {/* Panel Header */}
          <CardHeader className="border-b border-border py-4 px-6 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-display">
                  {date
                    ? isToday(date)
                      ? "Today"
                      : isTomorrow(date)
                      ? "Tomorrow"
                      : format(date, "EEEE, MMMM d, yyyy")
                    : "Select a date"}
                </CardTitle>
                {date && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {format(date, "MMMM yyyy")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant="secondary"
                  className="font-mono text-sm px-3 py-1"
                >
                  {selectedDayAppointments.length}{" "}
                  {selectedDayAppointments.length === 1
                    ? "Appointment"
                    : "Appointments"}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* Panel Body */}
          <CardContent className="p-0 flex-1">
            {isLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-28 w-full rounded-xl" />
              </div>
            ) : selectedDayAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center px-8">
                <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-5">
                  <CalendarIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  No appointments scheduled
                </h3>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                  {date && isToday(date)
                    ? "Your day is clear. Schedule something or enjoy the free time!"
                    : "Nothing booked for this day yet."}
                </p>
                <Button
                  variant="outline"
                  className="mt-6 gap-2"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <Plus className="h-4 w-4" /> Schedule Appointment
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {selectedDayAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-6 flex flex-col sm:flex-row gap-5 hover:bg-muted/20 transition-colors"
                  >
                    {/* Time Column */}
                    <div className="sm:w-28 shrink-0 flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1 sm:text-right">
                      <div className="text-base font-bold text-foreground">
                        {format(new Date(apt.startTime), "h:mm a")}
                      </div>
                      <div className="text-xs text-muted-foreground hidden sm:block">
                        — {format(new Date(apt.endTime), "h:mm a")}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 ${
                          TYPE_COLORS[apt.type] ?? TYPE_COLORS.other
                        }`}
                      >
                        {TYPE_ICONS[apt.type]} {apt.type}
                      </Badge>
                    </div>

                    {/* Content Card */}
                    <div className="flex-1 bg-card border border-border rounded-xl p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <h4 className="font-semibold text-base leading-snug">
                          {apt.title}
                        </h4>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                          <Clock className="h-3.5 w-3.5" />
                          {Math.round(
                            (new Date(apt.endTime).getTime() -
                              new Date(apt.startTime).getTime()) /
                              60000
                          )}{" "}
                          min
                        </div>
                      </div>

                      {apt.description && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {apt.description}
                        </p>
                      )}

                      {(apt.location || apt.leadId || apt.clientId) && (
                        <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-border/50 text-sm text-muted-foreground">
                          {apt.location && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" />
                              {apt.location}
                            </span>
                          )}
                          {(apt.leadId || apt.clientId) && (
                            <span className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5" />
                              Client Meeting
                            </span>
                          )}
                          {apt.type === "meeting" && !apt.location && (
                            <span className="flex items-center gap-1.5">
                              <Video className="h-3.5 w-3.5" />
                              Virtual Call
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CreateAppointmentForm({
  defaultDate,
  onSuccess,
}: {
  defaultDate?: Date;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const createAppointment = useCreateAppointment();

  const defaultDateStr = defaultDate
    ? format(defaultDate, "yyyy-MM-dd") + "T09:00"
    : format(new Date(), "yyyy-MM-dd") + "T09:00";
  const defaultEndStr = defaultDate
    ? format(defaultDate, "yyyy-MM-dd") + "T10:00"
    : format(new Date(), "yyyy-MM-dd") + "T10:00";

  const form = useForm<z.infer<typeof appointmentSchema>>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "viewing",
      startTime: defaultDateStr,
      endTime: defaultEndStr,
      location: "",
    },
  });

  const onSubmit = (data: z.infer<typeof appointmentSchema>) => {
    createAppointment.mutate(
      { data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListAppointmentsQueryKey(),
          });
          toast.success("Appointment scheduled!");
          onSuccess();
        },
        onError: (err: any) => {
          toast.error(err.message || "Failed to create appointment");
        },
      }
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Property Viewing — 45 Oak Street"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="viewing">🏠 Property Viewing</SelectItem>
                  <SelectItem value="meeting">👥 Client Meeting</SelectItem>
                  <SelectItem value="inspection">🔍 Inspection</SelectItem>
                  <SelectItem value="call">📞 Call</SelectItem>
                  <SelectItem value="other">📋 Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. 45 Oak Street, Dubai Marina"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Any extra notes..." rows={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <Button type="button" variant="outline" onClick={() => { form.reset(); onSuccess(); }}>
            Cancel
          </Button>
          <Button type="submit" disabled={createAppointment.isPending}>
            {createAppointment.isPending ? "Scheduling..." : "Schedule"}
          </Button>
        </div>
      </form>
    </Form>
  );
}