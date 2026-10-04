---
title: IANA Time Zone Database — tz database NEWS - Release 2022b
url: https://data.iana.org/time-zones/tzdb/NEWS
authority: secondary
kind: tzdata-release
publisher: IANA Time Zone Database
published: 2022-08-10
fetched: 2026-10-04
language: en
phase: A
---
Release 2022b - 2022-08-10 15:38:32 -0700

  Briefly:
    Chile's DST is delayed by a week in September 2022.
    Iran no longer observes DST after 2022.
    Rename Europe/Kiev to Europe/Kyiv.
    New zic -R option
    Vanguard form now uses %z.
    Finish moving duplicate-since-1970 zones to 'backzone'.
    New build option PACKRATLIST
    New tailored_tarballs target, replacing rearguard_tarballs

  Changes to future timestamps

    Chile's 2022 DST start is delayed from September 4 to September 11.
    (Thanks to Juan Correa.)

    Iran plans to stop observing DST permanently, after it falls back
    on 2022-09-21.  (Thanks to Ali Mirjamali.)

  Changes to past timestamps

    Finish moving to 'backzone' the location-based zones whose
    timestamps since 1970 are duplicates; adjust links accordingly.
    This change ordinarily affects only pre-1970 timestamps, and with
    the new PACKRATLIST option it does not affect any timestamps.
    In this round the affected zones are Antarctica/Vostok,
    Asia/Brunei, Asia/Kuala_Lumpur, Atlantic/Reykjavik,
    Europe/Amsterdam, Europe/Copenhagen, Europe/Luxembourg,
    Europe/Monaco, Europe/Oslo, Europe/Stockholm, Indian/Christmas,
    Indian/Cocos, Indian/Kerguelen, Indian/Mahe, Indian/Reunion,
    Pacific/Chuuk, Pacific/Funafuti, Pacific/Majuro, Pacific/Pohnpei,
    Pacific/Wake and Pacific/Wallis, and the affected links are
    Arctic/Longyearbyen, Atlantic/Jan_Mayen, Iceland, Pacific/Ponape,
    Pacific/Truk, and Pacific/Yap.

    From fall 1994 through fall 1995, Shanks wrote that Crimea's
    DST transitions were at 02:00 standard time, not at 00:00.
    (Thanks to Michael Deckers.)

    Iran adopted standard time in 1935, not 1946.  In 1977 it observed
    DST from 03-21 23:00 to 10-20 24:00; its 1978 transitions were on
    03-24 and 08-05, not 03-20 and 10-20; and its spring 1979
    transition was on 05-27, not 03-21.
    (Thanks to Roozbeh Pournader and Francis Santoni.)

    Chile's observance of -04 from 1946-08-29 through 1947-03-31 was
    considered DST, not standard time.  Santiago and environs had moved
    their clocks back to rejoin the rest of mainland Chile; put this
    change at the end of 1946-08-28.  (Thanks to Michael Deckers.)

    Some old, small clock transitions have been removed, as people at
    the time did not change their clocks.  This affects Asia/Hong_Kong
    in 1904, Asia/Ho_Chi_Minh in 1906, and Europe/Dublin in 1880.

  Changes to zone name

    Rename Europe/Kiev to Europe/Kyiv, as "Kyiv" is more common in
    English now.  Spelling of other names in Ukraine has not yet
    demonstrably changed in common English practice so for now these
    names retain old spellings, as in other countries (e.g.,
    Europe/Prague not "Praha", and Europe/Sofia not "Sofiya").

  Changes to code

    zic has a new option '-R @N' to output explicit transitions < N.
    (Need suggested by Almaz Mingaleev.)

    'zic -r @N' no longer outputs bad data when N < first transition.
    (Problem introduced in 2021d and reported by Peter Krefting.)

    zic now checks its input for NUL bytes and unterminated lines, and
    now supports input line lengths up to 2048 (not 512) bytes.

    gmtime and related code now use the abbreviation "UTC" not "GMT".
    POSIX is being revised to require this.

    When tzset and related functions set vestigial static variables
    like tzname, they now prefer specified timestamps to unspecified ones.
    (Problem reported by Almaz Mingaleev.)

    zic no longer complains "can't determine time zone abbreviation to
    use just after until time" when a transition to a new standard
    time occurs simultaneously with the first DST fallback transition.

  Changes to build procedure

    Source data in vanguard form now uses the %z notation, introduced
    in release 2015f.  For example, for America/Sao_Paulo vanguard
    form contains the zone continuation line "-3:00 Brazil %z", which
    is simpler and more reliable than the line "-3:00 Brazil -03/-02"
    used in main and rearguard forms.  The plan is for the main form
    to use %z eventually; in the meantime maintainers of zi parsers
    are encouraged to test the parsers on vanguard.zi.

    The Makefile has a new PACKRATLIST option to select a subset of
    'backzone'.  For example, 'make PACKRATDATA=backzone
    PACKRATLIST=zone.tab' now generates TZif files identical to those
    of the global-tz project.

    The Makefile has a new tailored_tarballs target for generating
    special-purpose tarballs.  It generalizes and replaces the
    rearguard_tarballs target and related targets and macros, which
    are now obsolescent.

    'make install' now defaults LOCALTIME to Factory not GMT,
    which means the default abbreviation is now "-00" not "GMT".

    Remove the posix_packrat target, marked obsolescent in 2016a.
