import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function parseDateLike(value: string | Date): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (!value) return null

  const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch
    const y = Number(year)
    const m = Number(month)
    const d = Number(day)
    if (!isValidDateParts(y, m, d)) return null
    return new Date(y, m - 1, d)
  }

  const brDateMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (brDateMatch) {
    const [, day, month, year] = brDateMatch
    const y = Number(year)
    const m = Number(month)
    const d = Number(day)
    if (!isValidDateParts(y, m, d)) return null
    return new Date(y, m - 1, d)
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function toIsoDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function toLocalDateTimeInput(date: Date): string {
  return `${toIsoDateInput(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function formatDateBR(value: string | Date): string {
  const date = parseDateLike(value)
  if (!date) return ''
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`
}

export function formatTimeBR(value: string | Date): string {
  const date = parseDateLike(value)
  if (!date) return ''
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function formatDateTimeBR(value: string | Date): string {
  const date = parseDateLike(value)
  if (!date) return ''
  return `${formatDateBR(date)} ${formatTimeBR(date)}`
}

export function formatDateTimeWithAtBR(value: string | Date): string {
  const dateTime = formatDateTimeBR(value)
  if (!dateTime) return ''
  const [date, time] = dateTime.split(' ')
  return `${date} às ${time}`
}

export function maskDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function parseBrazilianDateInput(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null

  const [, day, month, year] = match
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)
  if (!isValidDateParts(y, m, d)) return null

  return `${year}-${month}-${day}`
}

export function isoDateToBrazilian(value: string): string {
  return formatDateBR(value)
}

export function maskDateTimeInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 12)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
  if (digits.length <= 10) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)} ${digits.slice(8)}`
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)} ${digits.slice(8, 10)}:${digits.slice(10)}`
}

export function parseBrazilianDateTimeInput(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/)
  if (!match) return null

  const [, day, month, year, hours, minutes] = match
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)
  const hh = Number(hours)
  const mm = Number(minutes)

  if (!isValidDateParts(y, m, d) || hh > 23 || mm > 59) return null

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function localDateTimeToBrazilian(value: string): string {
  if (!value) return ''

  const localMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (localMatch) {
    const [, year, month, day, hours, minutes] = localMatch
    return `${day}/${month}/${year} ${hours}:${minutes}`
  }

  return formatDateTimeBR(value)
}
