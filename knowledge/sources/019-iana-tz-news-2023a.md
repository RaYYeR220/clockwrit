---
title: IANA Time Zone Database — tz database NEWS - Release 2023a
url: https://data.iana.org/time-zones/tzdb/NEWS
authority: secondary
kind: tzdata-release
publisher: IANA Time Zone Database
published: 2023-03-22
fetched: 2026-10-04
language: en
phase: A
---
Release 2023a - 2023-03-22 12:39:33 -0700

  Briefly:
    Egypt now uses DST again, from April through October.
    This year Morocco springs forward April 23, not April 30.
    Palestine delays the start of DST this year.
    Much of Greenland still uses DST from 2024 on.
    America/Yellowknife now links to America/Edmonton.
    tzselect can now use current time to help infer timezone.
    The code now defaults to C99 or later.
    Fix use of C23 attributes.

  Changes to future timestamps

    Starting in 2023, Egypt will observe DST from April's last Friday
    through October's last Thursday.  (Thanks to Ahmad ElDardiry.)
    Assume the transition times are 00:00 and 24:00, respectively.

    In 2023 Morocco's spring-forward transition after Ramadan
    will occur April 23, not April 30.  (Thanks to Milamber.)
    Adjust predictions for future years accordingly.  This affects
    predictions for 2023, 2031, 2038, and later years.

    This year Palestine will delay its spring forward from
    March 25 to April 29 due to Ramadan.  (Thanks to Heba Hamad.)
    Make guesses for future Ramadans too.

    Much of Greenland, represented by America/Nuuk, will continue to
    observe DST using European Union rules.  When combined with
    Greenland's decision not to change the clocks in fall 2023,
    America/Nuuk therefore changes from -03/-02 to -02/-01 effective
    2023-10-29 at 01:00 UTC.  (Thanks to Thomas M. Steenholdt.)
    This change from 2022g doesn't affect timestamps until 2024-03-30,
    and doesn't affect tm_isdst until 2023-03-25.

  Changes to past timestamps

    America/Yellowknife has changed from a Zone to a backward
    compatibility Link, as it no longer differs from America/Edmonton
    since 1970.  (Thanks to Almaz Mingaleev.)  This affects some
    pre-1948 timestamps.  The old data are now in 'backzone'.

  Changes to past time zone abbreviations

    When observing Moscow time, Europe/Kirov and Europe/Volgograd now
    use the abbreviations MSK/MSD instead of numeric abbreviations,
    for consistency with other timezones observing Moscow time.

  Changes to code

    You can now tell tzselect local time, to simplify later choices.
    Select the 'time' option in its first prompt.

    You can now compile with -DTZNAME_MAXIMUM=N to limit time zone
    abbreviations to N bytes (default 255).  The reference runtime
    library now rejects POSIX-style TZ strings that contain longer
    abbreviations, treating them as UTC.  Previously the limit was
    platform dependent and abbreviations were silently truncated to
    16 bytes even when the limit was greater than 16.

    The code by default is now designed for C99 or later.  To build on
    a mostly-C89 platform, compile with -DPORT_TO_C89; this should
    work on C89 platforms that also support C99 'long long' and
    perhaps a few other extensions to C89.  To support C89 callers of
    tzcode's library, compile with -DSUPPORT_C89; however, this could
    trigger latent bugs in C99-or-later callers.  The two new macros
    are transitional aids planned to be removed in a future version
    (say, in 2029), when C99 or later will be required.

    The code now builds again on pre-C99 platforms, if you compile
    with -DPORT_TO_C89.  This fixes a bug introduced in 2022f.

    On C23-compatible platforms tzcode no longer uses syntax like
    'static [[noreturn]] void usage(void);'.  Instead, it uses
    '[[noreturn]] static void usage(void);' as strict C23 requires.
    (Problem reported by Houge Langley.)

    The code's functions now constrain their arguments with the C
    'restrict' keyword consistently with their documentation.
    This may allow future optimizations.

    zdump again builds standalone with ckdadd and without setenv,
    fixing a bug introduced in 2022g.  (Problem reported by panic.)

    leapseconds.awk can now process a leap seconds file that never
    expires; this might be useful if leap seconds are discontinued.

  Changes to commentary

    tz-link.html has a new section "Coordinating with governments and
    distributors".  (Thanks to Neil Fuller for some of the text.)

    To improve tzselect diagnostics, zone1970.tab's comments column is
    now limited to countries that have multiple timezones.

    Note that there are plans to discontinue leap seconds by 2035.
