import type {EvalArm} from '@/lib/site'

/** The three arms in the order the site always shows them: the agent first. */
export const ARMS: {arm: EvalArm; label: string; short: string}[] = [
  {arm: 'agent', label: 'Clockwrit', short: 'Clockwrit'},
  {arm: 'keyword', label: 'Keyword search + the same model', short: 'Keyword + model'},
  {arm: 'model', label: 'The same model, no tools', short: 'Model alone'},
]
