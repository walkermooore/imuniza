"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type DatePickerProps = Omit<React.HTMLAttributes<HTMLButtonElement>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
  readOnly?: boolean
  placeholder?: string
}

const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  ({ value, onValueChange, readOnly, placeholder = "Selecione a data", className, id, ...props }, ref) => {
    const [open, setOpen] = React.useState(false)

    const selectedDate = React.useMemo(() => {
      if (!value) return undefined
      const parsed = parse(value, "yyyy-MM-dd", new Date())
      return isValid(parsed) ? parsed : undefined
    }, [value])

    return (
      <Popover open={open} onOpenChange={readOnly ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <Button
            {...props}
            ref={ref}
            id={id}
            variant="outline"
            disabled={readOnly}
            className={cn(
              "w-full justify-start font-normal",
              !selectedDate && "text-muted-foreground",
              readOnly && "bg-gray-50 cursor-not-allowed opacity-100",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate ? format(selectedDate, "dd/MM/yyyy") : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            captionLayout="dropdown"
            onSelect={(date) => {
              onValueChange(date ? format(date, "yyyy-MM-dd") : "")
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    )
  }
)
DatePicker.displayName = "DatePicker"

// ---------------------------------------------------------------------------

type DateTimePickerProps = Omit<React.HTMLAttributes<HTMLButtonElement>, 'value' | 'onChange'> & {
  value: string           // ISO local datetime string: "yyyy-MM-dd'T'HH:mm" or ""
  onValueChange: (value: string) => void
  readOnly?: boolean
  placeholder?: string
}

const DateTimePicker = React.forwardRef<HTMLButtonElement, DateTimePickerProps>(
  ({ value, onValueChange, readOnly, placeholder = "Selecione data e hora", className, id, ...props }, ref) => {
    const [open, setOpen] = React.useState(false)

    const DATETIME_FORMAT = "yyyy-MM-dd'T'HH:mm"

    const selectedDate = React.useMemo(() => {
      if (!value) return undefined
      const parsed = parse(value, DATETIME_FORMAT, new Date())
      return isValid(parsed) ? parsed : undefined
    }, [value])

    // Controlled time fields, derived from value but editable independently
    const [hours, setHours] = React.useState(() => selectedDate ? format(selectedDate, "HH") : "00")
    const [minutes, setMinutes] = React.useState(() => selectedDate ? format(selectedDate, "mm") : "00")

    // Keep time fields in sync when value changes externally
    React.useEffect(() => {
      if (selectedDate) {
        setHours(format(selectedDate, "HH"))
        setMinutes(format(selectedDate, "mm"))
      }
    }, [value])

    function emitChange(date: Date | undefined, hh: string, mm: string) {
      if (!date) {
        onValueChange("")
        return
      }
      const paddedHH = hh.padStart(2, "0")
      const paddedMM = mm.padStart(2, "0")
      const dateStr = format(date, "yyyy-MM-dd")
      onValueChange(`${dateStr}T${paddedHH}:${paddedMM}`)
    }

    function handleHoursChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value.replace(/\D/g, "").slice(0, 2)
      setHours(raw)
      const num = parseInt(raw, 10)
      if (raw.length === 2 && num >= 0 && num <= 23) {
        emitChange(selectedDate, raw, minutes)
      }
    }

    function handleMinutesChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value.replace(/\D/g, "").slice(0, 2)
      setMinutes(raw)
      const num = parseInt(raw, 10)
      if (raw.length === 2 && num >= 0 && num <= 59) {
        emitChange(selectedDate, hours, raw)
      }
    }

    return (
      <Popover open={open} onOpenChange={readOnly ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <Button
            {...props}
            ref={ref}
            id={id}
            variant="outline"
            disabled={readOnly}
            className={cn(
              "w-full justify-start font-normal",
              !selectedDate && "text-muted-foreground",
              readOnly && "bg-gray-50 cursor-not-allowed opacity-100",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate
              ? format(selectedDate, "dd/MM/yyyy") + ` ${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`
              : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            captionLayout="dropdown"
            onSelect={(date) => {
              emitChange(date, hours, minutes)
            }}
          />
          <div className="flex items-center justify-center gap-2 border-t p-3">
            <span className="text-sm text-muted-foreground">Hora:</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={hours}
              onChange={handleHoursChange}
              onBlur={() => {
                const padded = hours.padStart(2, "0")
                setHours(padded)
                emitChange(selectedDate, padded, minutes)
              }}
              className="w-10 rounded-md border px-2 py-1 text-center text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm font-medium">:</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={minutes}
              onChange={handleMinutesChange}
              onBlur={() => {
                const padded = minutes.padStart(2, "0")
                setMinutes(padded)
                emitChange(selectedDate, hours, padded)
              }}
              className="w-10 rounded-md border px-2 py-1 text-center text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </PopoverContent>
      </Popover>
    )
  }
)
DateTimePicker.displayName = "DateTimePicker"

export { DatePicker, DateTimePicker }