---
title: vacanza/holidays (GitHub) — python-holidays poland.py at release tag v0.63
url: https://github.com/vacanza/holidays/blob/300a72c6c48c439d6bdf07c0590f30c4cdec157e/holidays/countries/poland.py#L101-L110
authority: community
kind: library
publisher: vacanza/holidays (GitHub)
published: 2024-12-16
fetched: 2026-10-04
language: en
phase: B
---
self._add_epiphany_day(tr("Święto Trzech Króli"))

if self._year <= 1950:
# Candlemas.
self._add_candlemas(tr("Oczyszczenie Najświętszej Marii Panny"))

# Easter Sunday.
self._add_easter_sunday(tr("Niedziela Wielkanocna"))

# Easter Monday.
self._add_easter_monday(tr("Poniedziałek Wielkanocny"))

if self._year >= 1950:
# National Day.
self._add_holiday_may_1(tr("Święto Państwowe"))

if self._year <= 1950 or self._year >= 1990:
# National Day of the Third of May.
self._add_holiday_may_3(tr("Święto Narodowe Trzeciego Maja"))

if 1946 <= self._year <= 1950:
# National Victory and Freedom Day.
self._add_holiday_may_9(tr("Narodowe Święto Zwycięstwa i Wolności"))

if self._year <= 1950:
# Ascension Day.
self._add_ascension_thursday(tr("Wniebowstąpienie Pańskie"))

# Pentecost.
self._add_whit_sunday(tr("Zielone Świątki"))

if self._year <= 1950:
# Whit Monday.
self._add_whit_monday(tr("Drugi dzień Zielonych Świątek"))

# Corpus Christi.
self._add_corpus_christi_day(tr("Dzień Bożego Ciała"))

if self._year <= 1950:
self._add_saints_peter_and_paul_day(
# Saints Peter and Paul Day.
tr("Uroczystość Świętych Apostołów Piotra i Pawła")
)

if 1945 <= self._year <= 1989:
# National Day of Rebirth of Poland.
self._add_holiday_jul_22(tr("Narodowe Święto Odrodzenia Polski"))

if self._year <= 1960 or self._year >= 1989:
# Assumption Day.
self._add_assumption_of_mary_day(tr("Wniebowzięcie Najświętszej Marii Panny"))

# All Saints' Day.
self._add_all_saints_day(tr("Uroczystość Wszystkich Świętych"))

if 1937 <= self._year <= 1944 or self._year >= 1989:
# National Independence Day.
self._add_holiday_nov_11(tr("Narodowe Święto Niepodległości"))

if self._year <= 1950:
self._add_immaculate_conception_day(
# Immaculate Conception of the Blessed Virgin Mary.
tr("Niepokalane Poczęcie Najświętszej Marii Panny")
)

# Christmas Day.
self._add_christmas_day(tr("Boże Narodzenie (pierwszy dzień)"))
# Second Day of Christmas.
self._add_christmas_day_two(tr("Boże Narodzenie (drugi dzień)"))

class PL(Poland):
pass

class POL(Poland):
pass

class PolandStaticHolidays:
special_public_holidays = {
# National Independence Day - 100th anniversary.
2018: (NOV, 12, tr("Narodowe Święto Niepodległości - 100-lecie")),
}
