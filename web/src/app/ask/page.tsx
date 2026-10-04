import type {Metadata} from 'next'
import {listScenarios} from '@/lib/data'
import {AskClient} from './ask-client'

export const metadata: Metadata = {title: 'Ask'}
export const revalidate = 300

const SUGGESTIONS = [
  'A weekly call is set for Mondays 10:00 in New York. What time is it in Winnipeg on 2 November 2026, and why?',
  'Is 24 December 2026 a working day in Poland?',
  'Did Ukraine abolish daylight saving time? What will the clocks in Kyiv read on 1 July 2027?',
  'When exactly does Manitoba’s permanent time start — and why does tzdata say a different date?',
  'Is Saturday 10 October 2026 a working day in China?',
  'What would change for New York if the US Sunshine Protection Act became law?',
]

export default async function AskPage({searchParams}: PageProps<'/ask'>) {
  const [scenarios, params] = await Promise.all([listScenarios().catch(() => []), searchParams])
  const q = typeof params.q === 'string' ? params.q.slice(0, 500) : ''
  return <AskClient scenarios={scenarios} suggestions={SUGGESTIONS} initialQuestion={q} />
}
