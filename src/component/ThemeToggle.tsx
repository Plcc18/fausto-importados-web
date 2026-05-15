import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/lib/useTheme"
import { Button } from "@/Shadcn-Components/ui/button"

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggle } = useTheme()

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      title={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className={className}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 transition-transform duration-300 rotate-0 scale-100" />
      ) : (
        <Moon className="h-4 w-4 transition-transform duration-300 rotate-0 scale-100" />
      )}
      <span className="sr-only">
        {theme === "dark" ? "Tema claro" : "Tema escuro"}
      </span>
    </Button>
  )
}