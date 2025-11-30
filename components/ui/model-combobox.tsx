"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface Model {
  id: string
  name: string
  pricing: { prompt: number; completion: number }
  context_length?: number
  providerName?: string
  providerIcon?: string
}

interface ModelComboboxProps {
  models: Model[]
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

export function ModelCombobox({
  models,
  value,
  onValueChange,
  disabled = false,
  placeholder = "Sélectionner un modèle..."
}: ModelComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const selectedModel = models.find((m) => m.id === value)

  // Filtrer les modèles par recherche
  const filteredModels = React.useMemo(() => {
    if (!search) return models
    const searchLower = search.toLowerCase()
    return models.filter((m) =>
      m.name.toLowerCase().includes(searchLower) ||
      m.id.toLowerCase().includes(searchLower) ||
      m.providerName?.toLowerCase().includes(searchLower)
    )
  }, [models, search])

  // Grouper par provider
  const groupedModels = React.useMemo(() => {
    const groups: Record<string, Model[]> = {}
    for (const model of filteredModels) {
      const provider = model.providerName || "Other"
      if (!groups[provider]) groups[provider] = []
      groups[provider].push(model)
    }
    return groups
  }, [filteredModels])

  const formatPrice = (price: number) => {
    const perMillion = price * 1000000
    if (perMillion === 0) return "FREE"
    if (perMillion < 0.01) return `$${perMillion.toFixed(4)}/1M`
    return `$${perMillion.toFixed(2)}/1M`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:text-white"
        >
          {selectedModel ? (
            <div className="flex items-center gap-2 truncate">
              {selectedModel.providerIcon && (
                <img
                  src={selectedModel.providerIcon}
                  alt={selectedModel.providerName || ""}
                  className="w-4 h-4 rounded-sm object-contain flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                  }}
                />
              )}
              <span className="truncate">{selectedModel.name}</span>
              <span className={cn(
                "text-xs flex-shrink-0",
                selectedModel.pricing.prompt === 0 ? "text-green-400" : "text-slate-400"
              )}>
                {formatPrice(selectedModel.pricing.prompt)}
              </span>
            </div>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 bg-slate-900 border-slate-700" align="start">
        <Command className="bg-slate-900" shouldFilter={false}>
          <div className="flex items-center border-b border-slate-700 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Rechercher un modèle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-10 w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-400"
            />
          </div>
          <CommandList className="max-h-[300px] overflow-auto">
            <CommandEmpty className="py-6 text-center text-sm text-slate-400">
              Aucun modèle trouvé.
            </CommandEmpty>
            {Object.entries(groupedModels).map(([provider, providerModels]) => (
              <CommandGroup
                key={provider}
                heading={
                  <div className="flex items-center gap-2 text-slate-400">
                    {providerModels[0]?.providerIcon && (
                      <img
                        src={providerModels[0].providerIcon}
                        alt={provider}
                        className="w-4 h-4 rounded-sm object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = "none"
                        }}
                      />
                    )}
                    <span>{provider}</span>
                  </div>
                }
                className="text-white"
              >
                {providerModels.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={model.id}
                    onSelect={() => {
                      onValueChange(model.id)
                      setOpen(false)
                      setSearch("")
                    }}
                    className="cursor-pointer hover:bg-slate-800 text-white data-[selected=true]:bg-slate-800"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 flex-shrink-0",
                        value === model.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="truncate">{model.name}</span>
                      <span className={cn(
                        "text-xs flex-shrink-0",
                        model.pricing.prompt === 0 ? "text-green-400 font-medium" : "text-slate-400"
                      )}>
                        {formatPrice(model.pricing.prompt)}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
