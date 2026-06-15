import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { ScrollArea } from './scroll-area'
import { cn } from '../../lib/utils'

export interface ComboboxOption {
  value: string
  label: string
  disabled?: boolean
}

interface AsyncComboboxProps {
  value: string
  onValueChange: (value: string) => void
  fetchOptions: (search: string, limit: number) => Promise<ComboboxOption[]>
  placeholder: string
  searchPlaceholder?: string
  emptyMessage?: string
  minSearchLength?: number
  initialLimit?: number
  searchLimit?: number
  disabled?: boolean
  id?: string
  valueLabel?: string
  noSearchMessage?: string
}

export function AsyncCombobox({
  value,
  onValueChange,
  fetchOptions,
  placeholder,
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Nenhum resultado encontrado.',
  minSearchLength = 2,
  initialLimit = 10,
  searchLimit = 10,
  disabled = false,
  id,
  valueLabel,
  noSearchMessage,
}: AsyncComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<ComboboxOption[]>([])
  const [loading, setLoading] = useState(false)
  const requestIdRef = useRef(0)

  const trimmedSearch = search.trim()
  const shouldSearch = trimmedSearch.length >= minSearchLength
  const shouldShowPrompt = trimmedSearch.length > 0 && !shouldSearch
  const selectedLabel = valueLabel ?? options.find((option) => option.value === value)?.label

  useEffect(() => {
    if (!open) {
      setSearch('')
      setOptions([])
      setLoading(false)
      return
    }

    if (shouldShowPrompt) {
      setOptions([])
      setLoading(false)
      return
    }

    const requestId = ++requestIdRef.current
    const limit = shouldSearch ? searchLimit : initialLimit
    const timeoutId = window.setTimeout(async () => {
      setLoading(true)
      try {
        const nextOptions = await fetchOptions(shouldSearch ? trimmedSearch : '', limit)
        if (requestIdRef.current === requestId) {
          setOptions(nextOptions.slice(0, limit))
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false)
        }
      }
    }, shouldSearch ? 250 : 0)

    return () => window.clearTimeout(timeoutId)
  }, [
    fetchOptions,
    initialLimit,
    open,
    searchLimit,
    shouldSearch,
    shouldShowPrompt,
    trimmedSearch,
  ])

  const displayOptions = useMemo(() => {
    if (!value || !selectedLabel || options.some((option) => option.value === value)) {
      return options
    }
    return [{ value, label: selectedLabel }, ...options]
  }, [options, selectedLabel, value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-10 w-full justify-between px-3 font-normal"
        >
          <span className={cn('truncate', !selectedLabel && 'text-muted-foreground')}>
            {selectedLabel || placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="border-b p-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9"
          />
        </div>

        {shouldShowPrompt ? (
          <div className="px-3 py-4 text-sm text-muted-foreground">
            {noSearchMessage ?? `Digite ao menos ${minSearchLength} caracteres para buscar.`}
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Buscando...
          </div>
        ) : displayOptions.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground">{emptyMessage}</div>
        ) : (
          <ScrollArea className="max-h-64">
            <div className="p-1">
              {displayOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left text-sm ${option?.disabled ? 'text-[gray]' : 'cursor-pointer hover:bg-accent hover:text-accent-foreground'}`}
                  disabled={option?.disabled}
                  onClick={() => {
                    onValueChange(option.value)
                    setOpen(false)
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  <Check className={cn('h-4 w-4 shrink-0', value === option.value ? 'opacity-100' : 'opacity-0')} />
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  )
}
