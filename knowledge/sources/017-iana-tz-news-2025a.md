---
title: IANA Time Zone Database — tz database NEWS - Release 2025a
url: https://data.iana.org/time-zones/tzdb/NEWS
authority: secondary
kind: tzdata-release
publisher: IANA Time Zone Database
published: 2025-01-15
fetched: 2026-10-04
language: en
phase: A
---
Release 2025a - 2025-01-15 10:47:24 -0800

  Briefly:
    Paraguay adopted permanent -03 starting spring 2024.
    Improve pre-1991 data for the Philippines.
    Etc/Unknown is now reserved.

  Changes to future timestamps

    Paraguay stopped changing its clocks after the spring-forward
    transition on 2024-10-06, so it is now permanently at -03.
    (Thanks to Heitor David Pinto and Even Scharning.)
    This affects timestamps starting 2025-03-22, as well as the
    obsolescent tm_isdst flags starting 2024-10-15.

  Changes to past timestamps

    Correct timestamps for the Philippines before 1900, and from 1937
    through 1990.  (Thanks to P Chan for the heads-up and citations.)
    This includes adjusting local mean time before 1899; fixing
    transitions in September 1899, January 1937, and June 1954; adding
    transitions in December 1941, November 1945, March and September
    1977, and May and July 1990; and removing incorrect transitions in
    March and September 1978.

  Changes to data

    Add zone1970.tab lines for the Concordia and Eyre Bird Observatory
    research stations.  (Thanks to Derick Rethans and Jule Dabars.)

  Changes to code

    strftime %s now generates the correct numeric string even when the
    represented number does not fit into time_t.  This is better than
    generating the numeric equivalent of (time_t) -1, as strftime did
    in TZDB releases 96a (when %s was introduced) through 2020a and in
    releases 2022b through 2024b.  It is also better than failing and
    returning 0, as strftime did in releases 2020b through 2022a.

    strftime now outputs an invalid conversion specifier as-is,
    instead of eliding the leading '%', which confused debugging.

    An invalid TZ now generates the time zone abbreviation "-00", not
    "UTC", to help the user see that an error has occurred.  (Thanks
    to Arthur David Olson for suggesting a "wrong result".)

    mktime and timeoff no longer incorrectly fail merely because a
    struct tm component near INT_MIN or INT_MAX overflows when a
    lower-order component carries into it.

    TZNAME_MAXIMUM, the maximum number of bytes in a proleptic TZ
    string's time zone abbreviation, now defaults to 254 not 255.
    This helps reduce the size of internal state from 25480 to 21384
    on common platforms.  This change should not be a problem, as
    nobody uses such long "abbreviations" and the longstanding tzcode
    maximum was 16 until release 2023a.  For those who prefer no
    arbitrary limits, you can now specify TZNAME_MAXIMUM values up to
    PTRDIFF_MAX, a limit forced by C anyway; formerly tzcode silently
    misbehaved unless TZNAME_MAXIMUM was less than INT_MAX.

    tzset and related functions no longer leak a file descriptor if
    another thread forks or execs at about the same time and if the
    platform has O_CLOFORK and O_CLOEXEC respectively.  Also, the
    functions no longer let a TZif file become a controlling terminal.

    'zdump -' now reads TZif data from /dev/stdin.
    (From a question by Arthur David Olson.)

  Changes to documentation

    The name Etc/Unknown is now reserved: it will not be used by TZDB.
    This is for compatibility with CLDR, which uses the string
    "Etc/Unknown" for an unknown or invalid timezone.  (Thanks to
    Justin Grant, Mark Davis, and Guy Harris.)

    Cite Internet RFC 9636, which obsoletes RFC 8536 for TZif format.
