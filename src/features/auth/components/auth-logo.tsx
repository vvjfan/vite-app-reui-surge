import { Logo } from "@/components/shared/app-shell/logo"

export function AuthLogo() {
  return (
    <div className="inline-flex items-center gap-2">
      <Logo />
      <span className="text-base font-medium">ReUI</span>
    </div>
  )
}
