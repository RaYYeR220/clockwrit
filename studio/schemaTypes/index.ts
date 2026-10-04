import {holiday, holidaySuspension, weekendRegime, workdayOverride} from './calendar'
import {instrument} from './instrument'
import {jurisdiction, zone} from './places'
import {ruleSegment} from './rules'
import {ruling} from './ruling'
import {quote, transitionRule} from './shared'

export const schemaTypes = [
  jurisdiction,
  zone,
  instrument,
  ruleSegment,
  holiday,
  weekendRegime,
  workdayOverride,
  holidaySuspension,
  ruling,
  transitionRule,
  quote,
]
