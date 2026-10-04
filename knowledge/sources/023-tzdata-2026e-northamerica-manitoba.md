---
title: IANA tz (eggert/tz GitHub mirror) — tzdata 2026e northamerica (IANA tz source file)
url: https://github.com/eggert/tz/blob/2026e/northamerica
authority: secondary
kind: tzdata-release
publisher: IANA tz (eggert/tz GitHub mirror)
published: 2026-09-29
fetched: 2026-10-04
language: en
phase: A
---
# From Tim Parenti (2026-09-21):
# With Manitoba now adopting year-round -05, the area around Creighton will
# likely wish to follow. As the area doesn't have a special charter like
# Lloydminster, the existing de facto arrangement technically violates
# provincial law already, but once the new Act takes effect it will better
# allow for continued alignment with Manitoba, per the above.

# Rule NAME FROM TO - IN ON AT SAVE LETTER/S
Rule Regina 1918 only - Apr 14 2:00 1:00 D
Rule Regina 1918 only - Oct 27 2:00 0 S
Rule Regina 1930 1934 - May Sun>=1 0:00 1:00 D
Rule Regina 1930 1934 - Oct Sun>=1 0:00 0 S
Rule Regina 1937 1941 - Apr Sun>=8 0:00 1:00 D
Rule Regina 1937 only - Oct Sun>=8 0:00 0 S
Rule Regina 1938 only - Oct Sun>=1 0:00 0 S
Rule Regina 1939 1941 - Oct Sun>=8 0:00 0 S
Rule Regina 1942 only - Feb 9 2:00 1:00 W # War
Rule Regina 1945 only - Aug 14 23:00u 1:00 P # Peace
Rule Regina 1945 only - Sep lastSun 2:00 0 S
Rule Regina 1946 only - Apr Sun>=8 2:00 1:00 D
Rule Regina 1946 only - Oct Sun>=8 2:00 0 S
Rule Regina 1947 1957 - Apr lastSun 2:00 1:00 D
Rule Regina 1947 1957 - Sep lastSun 2:00 0 S
Rule Regina 1959 only - Apr lastSun 2:00 1:00 D
Rule Regina 1959 only - Oct lastSun 2:00 0 S
#
Rule Swift 1957 only - Apr lastSun 2:00 1:00 D
Rule Swift 1957 only - Oct lastSun 2:00 0 S
Rule Swift 1959 1961 - Apr lastSun 2:00 1:00 D
Rule Swift 1959 only - Oct lastSun 2:00 0 S
Rule Swift 1960 1961 - Sep lastSun 2:00 0 S
# Zone NAME STDOFF RULES FORMAT [UNTIL]
Zone America/Regina -6:58:36 - LMT 1905 Sep
-7:00 Regina M%sT 1960 Apr lastSun 2:00
-6:00 - CST
Zone America/Swift_Current -7:11:20 - LMT 1905 Sep
-7:00 Canada M%sT 1946 Apr lastSun 2:00
-7:00 Regina M%sT 1950
-7:00 Swift M%sT 1972 Apr lastSun 2:00
-6:00 - CST

# Alberta

# From Alois Treindl (2019-07-19):
# There was no DST in Alberta in 1967... Calgary Herald, 29 April 1967.
# 1969, no DST, from Edmonton Journal 18 April 1969
#
# From Paul Eggert (2019-07-25):
# Pearce's book says that Alberta's 1948 Daylight Saving Act required
# Mountain Standard Time without DST, and that "anyone who broke that law
# could be fined up to $25 and costs". There seems to be no record of
# anybody paying the fine. The law was not changed until an August 1971
# plebiscite reinstituted DST in 1972. This story is also mentioned in:
# Boyer JP. Forcing Choice: The Risky Reward of Referendums. Dundum. 2017.
# ISBN 978-1459739123.

# From Roozbeh Pournader (2026-04-20):
# https://calgaryherald.com/opinion/columnists/bell-alberta-daylight-time-year-round-premier-danielle-smith
#
# From Tim Parenti (2026-04-23):
# Section 3 of Bill 31, the Red Tape Reduction Statutes Amendment Act, 2026
# https://docs.assembly.ab.ca/LADDAR_files/docs/bills/bill/legislature_31/session_2/20251023_bill-031.pdf
# would repeal the Daylight Saving Time Act in the Revised Statutes of Alberta
# 2000 Chapter D-5:
# https://web.archive.org/web/20240128134751/https://kings-printer.alberta.ca/documents/Acts/D05.pdf
# ...and substitutes a new chapt
