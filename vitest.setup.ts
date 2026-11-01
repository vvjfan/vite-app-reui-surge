import { configure } from "@testing-library/react"

// Testing Library waits 1s by default. That is tight for this suite: the
// component tests seed the whole demo store (163 SKUs, 48 orders, their
// customers and locations) before a form can resolve its pickers, and with
// files running in parallel a loaded machine occasionally crosses that line -
// the editor is still showing "Loading catalog" when the assertion runs and a
// correct test reports a failure.
//
// The ceiling only bounds how long a `waitFor` may keep retrying; a passing
// test still finishes as soon as its condition holds, so raising it costs
// nothing on the happy path and buys the suite its determinism back.
configure({ asyncUtilTimeout: 5000 })
