import * as React from 'react'

import {
  isoDateToBrazilian,
  localDateTimeToBrazilian,
  maskDateInput,
  maskDateTimeInput,
  parseBrazilianDateInput,
  parseBrazilianDateTimeInput,
} from '@/lib/utils'
import { Input } from './input'

type DateInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
}

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onValueChange, placeholder = 'dd/mm/aaaa', inputMode = 'numeric', ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(() => isoDateToBrazilian(value))

    React.useEffect(() => {
      setDisplayValue(isoDateToBrazilian(value))
    }, [value])

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode={inputMode}
        placeholder={placeholder}
        value={displayValue}
        onChange={(event) => {
          const nextDisplayValue = maskDateInput(event.target.value)
          setDisplayValue(nextDisplayValue)

          if (!nextDisplayValue) {
            onValueChange('')
            return
          }

          const parsedValue = parseBrazilianDateInput(nextDisplayValue)
          if (parsedValue) {
            onValueChange(parsedValue)
          }
        }}
      />
    )
  }
)
DateInput.displayName = 'DateInput'

type DateTimeInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
}

const DateTimeInput = React.forwardRef<HTMLInputElement, DateTimeInputProps>(
  ({ value, onValueChange, placeholder = 'dd/mm/aaaa hh:mm', inputMode = 'numeric', ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(() => localDateTimeToBrazilian(value))

    React.useEffect(() => {
      setDisplayValue(localDateTimeToBrazilian(value))
    }, [value])

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode={inputMode}
        placeholder={placeholder}
        value={displayValue}
        onChange={(event) => {
          const nextDisplayValue = maskDateTimeInput(event.target.value)
          setDisplayValue(nextDisplayValue)

          if (!nextDisplayValue) {
            onValueChange('')
            return
          }

          const parsedValue = parseBrazilianDateTimeInput(nextDisplayValue)
          if (parsedValue) {
            onValueChange(parsedValue)
          }
        }}
      />
    )
  }
)
DateTimeInput.displayName = 'DateTimeInput'

export { DateInput, DateTimeInput }
