import { AuthFooter } from "./auth-footer"
import { AuthHeader } from "./auth-header"
import { SignInForm } from "./sign-in-form"

// auth-16 relocated: full-page sign-in (header + centered SSO/email form + trust
// footer). UI only - `onSignIn` fires on any sign-in action (Continue or an SSO
// button) so the route can navigate the user back where they came from.
export function Auth({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="flex min-h-svh w-full flex-col">
      {/* Header */}
      <AuthHeader />

      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center px-6 py-10 sm:px-8 sm:py-12">
        <SignInForm onSignIn={onSignIn} />
      </main>

      {/* Footer */}
      <AuthFooter />
    </div>
  )
}
