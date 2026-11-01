import type { ReactNode } from "react"
import { KeyIcon as KeyRoundIcon } from "@phosphor-icons/react"

import { AnthropicBlackWordmark } from "@/components/ui/svgs/anthropicBlackWordmark"
import { AnthropicWhiteWordmark } from "@/components/ui/svgs/anthropicWhiteWordmark"
import { GithubDark } from "@/components/ui/svgs/githubDark"
import { GithubLight } from "@/components/ui/svgs/githubLight"
import { Google } from "@/components/ui/svgs/google"
import { NvidiaWordmarkDark } from "@/components/ui/svgs/nvidiaWordmarkDark"
import { NvidiaWordmarkLight } from "@/components/ui/svgs/nvidiaWordmarkLight"
import { OpenaiWordmarkDark } from "@/components/ui/svgs/openaiWordmarkDark"
import { OpenaiWordmarkLight } from "@/components/ui/svgs/openaiWordmarkLight"
import { ResendWordmarkBlack } from "@/components/ui/svgs/resendWordmarkBlack"
import { ResendWordmarkWhite } from "@/components/ui/svgs/resendWordmarkWhite"
import { SupabaseWordmarkDark } from "@/components/ui/svgs/supabaseWordmarkDark"
import { SupabaseWordmarkLight } from "@/components/ui/svgs/supabaseWordmarkLight"

export type AuthProvider = {
  id: string
  label: string
  logo: ReactNode
}

export type TrustBrand = {
  id: string
  name: string
  logo: ReactNode
}

function ThemeLogo({ light, dark }: { light: ReactNode; dark: ReactNode }) {
  return (
    <>
      <span aria-hidden="true" className="dark:hidden">
        {light}
      </span>
      <span aria-hidden="true" className="hidden dark:block">
        {dark}
      </span>
    </>
  )
}

export const AUTH16_PROVIDERS: AuthProvider[] = [
  {
    id: "google",
    label: "Continue with Google",
    logo: <Google aria-hidden="true" data-icon="inline-start" />,
  },
  {
    id: "github",
    label: "Continue with GitHub",
    logo: (
      <ThemeLogo
        light={<GithubLight aria-hidden="true" data-icon="inline-start" />}
        dark={<GithubDark aria-hidden="true" data-icon="inline-start" />}
      />
    ),
  },
  {
    id: "sso",
    label: "Use Single Sign-On",
    logo: <KeyRoundIcon aria-hidden="true" data-icon="inline-start" />,
  },
]

export const AUTH16_TRUST_BRANDS: TrustBrand[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    logo: (
      <ThemeLogo
        light={
          <AnthropicBlackWordmark className="h-3 w-auto" aria-hidden="true" />
        }
        dark={
          <AnthropicWhiteWordmark className="h-3 w-auto" aria-hidden="true" />
        }
      />
    ),
  },
  {
    id: "supabase",
    name: "Supabase",
    logo: (
      <ThemeLogo
        light={
          <SupabaseWordmarkLight className="h-4 w-auto" aria-hidden="true" />
        }
        dark={
          <SupabaseWordmarkDark className="h-4 w-auto" aria-hidden="true" />
        }
      />
    ),
  },
  {
    id: "nvidia",
    name: "NVIDIA",
    logo: (
      <ThemeLogo
        light={
          <NvidiaWordmarkLight className="h-3.5 w-auto" aria-hidden="true" />
        }
        dark={
          <NvidiaWordmarkDark className="h-3.5 w-auto" aria-hidden="true" />
        }
      />
    ),
  },
  {
    id: "resend",
    name: "Resend",
    logo: (
      <ThemeLogo
        light={
          <ResendWordmarkBlack className="h-3 w-auto" aria-hidden="true" />
        }
        dark={<ResendWordmarkWhite className="h-3 w-auto" aria-hidden="true" />}
      />
    ),
  },
  {
    id: "openai",
    name: "OpenAI",
    logo: (
      <ThemeLogo
        light={
          <OpenaiWordmarkLight className="h-4 w-auto" aria-hidden="true" />
        }
        dark={<OpenaiWordmarkDark className="h-4 w-auto" aria-hidden="true" />}
      />
    ),
  },
]
