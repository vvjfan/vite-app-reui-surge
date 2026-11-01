import { type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { AUTH16_PROVIDERS } from "./data"
import { ArrowRightIcon } from "@phosphor-icons/react"

export function SignInForm({ onSignIn }: { onSignIn: () => void }) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSignIn()
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      {/* Heading */}
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
          Back to building.
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          Sign in to sync your team, tasks, and timelines across every surface.
        </p>
      </div>

      {/* Grid */}
      <div className="grid gap-2.5">
        {AUTH16_PROVIDERS.map((provider) => (
          <Button
            key={provider.id}
            type="button"
            variant="outline"
            onClick={onSignIn}
            className="w-full justify-center px-4 [&_svg:not([class*='size-'])]:size-4"
          >
            {provider.logo}
            {provider.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-sm text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      {/* Form */}
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FieldGroup>
          <Field className="gap-2">
            <FieldLabel htmlFor="auth-16-email">Work email</FieldLabel>
            <Input
              id="auth-16-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
            />
          </Field>
        </FieldGroup>

        <Button type="submit" className="w-full">
          Continue
          <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
        </Button>
      </form>

      <p className="text-center text-sm text-pretty text-muted-foreground">
        By continuing, you agree to ReUI&apos;s{" "}
        <a
          href="#"
          className="text-foreground underline underline-offset-4 transition-colors hover:text-primary"
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          href="#"
          className="text-foreground underline underline-offset-4 transition-colors hover:text-primary"
        >
          Privacy Policy
        </a>
        .
      </p>
    </div>
  )
}
