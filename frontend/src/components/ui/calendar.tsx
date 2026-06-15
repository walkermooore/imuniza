import { DayPicker, type DayPickerProps } from "react-day-picker"
import { cn } from "@/lib/utils"
import "react-day-picker/style.css"

export type CalendarProps = DayPickerProps

function Calendar({ className, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn("p-3", className)}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
