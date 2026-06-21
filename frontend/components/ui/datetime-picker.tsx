"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateTimePickerProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  disabled?: boolean
}

export function DateTimePicker({ date, setDate, disabled }: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(date)
  const [timeValue, setTimeValue] = React.useState<string>(
    date ? format(date, "HH:mm") : "00:00"
  )

  React.useEffect(() => {
    setSelectedDate(date)
    if (date) {
      setTimeValue(format(date, "HH:mm"))
    }
  }, [date])

  const handleDateSelect = (newDate: Date | undefined) => {
    if (newDate) {
      const [hours, minutes] = timeValue.split(':')
      const updatedDate = new Date(newDate)
      updatedDate.setHours(parseInt(hours || "0", 10))
      updatedDate.setMinutes(parseInt(minutes || "0", 10))
      updatedDate.setSeconds(0)
      setSelectedDate(updatedDate)
      setDate(updatedDate)
    } else {
      setSelectedDate(undefined)
      setDate(undefined)
    }
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value
    setTimeValue(newTime)
    
    if (selectedDate) {
      const [hours, minutes] = newTime.split(':')
      const updatedDate = new Date(selectedDate)
      updatedDate.setHours(parseInt(hours || "0", 10))
      updatedDate.setMinutes(parseInt(minutes || "0", 10))
      updatedDate.setSeconds(0)
      setSelectedDate(updatedDate)
      setDate(updatedDate)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal border-slate-200 shadow-sm",
            !selectedDate && "text-slate-500"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? format(selectedDate, "PPP 'at' HH:mm") : <span>Pick a date & time</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          autoFocus
        />
        <div className="p-3 border-t border-border flex items-center justify-between gap-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" />
            Time
          </label>
          <input
            type="time"
            value={timeValue}
            onChange={handleTimeChange}
            disabled={!selectedDate}
            className="flex h-9 w-[120px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
