import 'server-only'
import latest from '@/data/eval-latest.json'
import {contentClient} from './sanity'

/** The instant the landing page reads every clock at: the first Monday after Canada's 2026 changes. */
export const PROBE_INSTANT = '2026-11-02T15:00:00Z'

export const HERO_CITIES = [
  {zone: 'America/Winnipeg', city: 'Winnipeg', from: '2026-11-01T07:00:00Z'},
  {zone: 'America/Vancouver', city: 'Vancouver', from: '2026-11-01T09:00:00Z'},
  {zone: 'America/Edmonton', city: 'Edmonton', from: '2026-11-01T08:00:00Z'},
  {zone: 'Africa/Casablanca', city: 'Casablanca', from: '2026-09-20T02:00:00Z'},
] as const

export interface Counts {
  instruments: number
  primary: number
  jurisdictions: number
  zones: number
  segments: number
  holidays: number
  rulingsApplied: number
  rulingsOpen: number
}

export async function datasetCounts(): Promise<Counts> {
  return contentClient().fetch(`{
    "instruments": count(*[_type == "instrument"]),
    "primary": count(*[_type == "instrument" && authority == "primary"]),
    "jurisdictions": count(*[_type == "jurisdiction"]),
    "zones": count(*[_type == "zone"]),
    "segments": count(*[_type == "ruleSegment"]),
    "holidays": count(*[_type == "holiday"]),
    "rulingsApplied": count(*[_type == "ruling" && status == "applied"]),
    "rulingsOpen": count(*[_type == "ruling" && status == "proposed"])
  }`)
}

export type EvalArm = 'model' | 'keyword' | 'agent'

export interface EvalSummary {
  ranAt: string
  /** The date the questions were asked "as of". */
  today: string
  split: string
  total: number
  answerModel: string
  judgeModel: string
  summary: Record<EvalArm, {correct: number; incorrect: number; abstained: number; errors: number; trapsCorrect: number; traps: number}>
}

/** One question as eval/src/run.ts writes it: the key and every arm's graded answer. */
export interface EvalRow {
  id: string
  category: string
  trap: boolean
  question: string
  key: string
  arms: Partial<
    Record<
      EvalArm,
      {
        answer: string
        verdict: 'correct' | 'incorrect' | 'abstained' | 'error'
        reason: string
        ms: number
        retrieved?: string[]
        tools?: string[]
        error?: string
      }
    >
  >
}

export type EvalRun = EvalSummary & {rows: EvalRow[]}

/** Latest held-out evaluation (copied from eval/results by the eval runner), if it has been run. */
export function evalSummary(): EvalRun | null {
  return latest as unknown as EvalRun | null
}
