import { useNavigate, useRouterState } from "@tanstack/react-router"
import { useTheme } from "@/components/theme-provider"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { USER } from "./data"
import {
  SunIcon,
  MoonIcon,
  DesktopIcon as MonitorIcon,
  CaretUpDownIcon as ChevronsUpDownIcon,
  UserIcon,
  GearIcon as SettingsIcon,
  ShieldCheckIcon,
  PaletteIcon,
  SignOutIcon as LogOutIcon,
} from "@phosphor-icons/react"

// ── Theme Toggle ──

const THEMES = [
  {
    value: "light",
    label: "Light",
    icon: <SunIcon className="size-3.5" aria-hidden="true" />,
  },
  {
    value: "dark",
    label: "Dark",
    icon: <MoonIcon className="size-3.5" aria-hidden="true" />,
  },
  {
    value: "system",
    label: "System",
    icon: <MonitorIcon className="size-3.5" aria-hidden="true" />,
  },
] as const

function ThemeSegmentedToggle() {
  const { theme, setTheme } = useTheme()
  const currentTheme = theme

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 rounded-full bg-muted/60 p-0.5"
    >
      {THEMES.map(({ value, label, icon }) => {
        const isActive = currentTheme === value
        return (
          <Button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            variant="ghost"
            size="icon-xs"
            onClick={() => setTheme(value)}
            className={cn(
              "rounded-full",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {icon}
          </Button>
        )
      })}
    </div>
  )
}

// ── Nav User ──

export function NavUser() {
  const { isMobile } = useSidebar()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })

  // UI only: return to the sign-in page, carrying the current location so a
  // subsequent sign-in can navigate back to it.
  function handleSignOut() {
    navigate({ to: "/sign-in", search: { redirect: href } })
  }

  return (
    <SidebarMenu>
      {/* Sidebar */}
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="group-data-[collapsible=icon]:justify-center data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar className="size-7 rounded-md">
              <AvatarImage src={USER.avatar} alt={USER.name} />
              <AvatarFallback className="rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                {USER.initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-medium">{USER.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {USER.email}
              </span>
            </div>
            <ChevronsUpDownIcon
              className="ml-auto size-4 opacity-50 group-data-[collapsible=icon]:hidden"
              aria-hidden="true"
            />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
            className="w-56"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-2.5 py-2">
                <Avatar className="size-8 rounded-md">
                  <AvatarImage src={USER.avatar} alt={USER.name} />
                  <AvatarFallback className="rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                    {USER.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    {USER.name}
                  </span>
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {USER.email}
                  </span>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => navigate({ to: "/account/profile" })}
                >
                  <UserIcon aria-hidden="true" />
                  Profile
                  <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate({ to: "/account/preferences" })}
                >
                  <SettingsIcon aria-hidden="true" />
                  Preferences
                </DropdownMenuItem>
                {/* This menu is the signed-in PERSON's, so every item lands in
                    /account. It used to send "Manage account" to /settings,
                    which is the STORE's configuration (team, payments, billing)
                    and nothing to do with this account. */}
                <DropdownMenuItem
                  onClick={() => navigate({ to: "/account/security" })}
                >
                  <ShieldCheckIcon aria-hidden="true" />
                  Security
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                <DropdownMenuItem
                  className="cursor-default focus:bg-transparent!"
                  onSelect={(e) => e.preventDefault()}
                >
                  <PaletteIcon aria-hidden="true" />
                  Theme
                  <div className="ml-auto">
                    <ThemeSegmentedToggle />
                  </div>
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={handleSignOut}>
                <LogOutIcon aria-hidden="true" />
                Sign Out
                <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
