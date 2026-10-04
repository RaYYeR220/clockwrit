---
title: IANA Time Zone Database — tz database NEWS - Release 2026b
url: https://data.iana.org/time-zones/tzdb/NEWS
authority: secondary
kind: tzdata-release
publisher: IANA Time Zone Database
published: 2026-04-22
fetched: 2026-10-04
language: en
phase: A
---
Release 2026b - 2026-04-22 23:06:43 -0700

  Briefly:
    British Columbia moved to permanent -07 on 2026-03-09.
    zic no longer mishandles a last transition to a new time type.
    Some more overflow bugs have been fixed in zic.

  Changes to future timestamps

    British Columbia’s 2026-03-08 spring forward was its last
    foreseeable clock change, as it moved to permanent -07 thereafter.
    (Thanks to Arthur David Olson.)  Although the change to permanent
    -07 legally took place on 2026-03-09, temporarily model the change
    to occur on 2026-11-01 at 02:00 instead.  This works around a
    limitation in CLDR 48.1 (2026-01-08).  This temporary hack is
    planned to be removed after CLDR is fixed.

      To match longstanding practice for -07 standard time in North
      America, such as for America/Dawson, America/Dawson_Creek,
      America/Fort_Nelson and America/Whitehorse, affected BC
      timestamps use the abbreviation MST.  As the change affects both
      America/Vancouver and its backward compatibility link, the
      obsolescent setting TZ="Canada/Pacific" will now use the
      abbreviation MST.  Future TZDB releases may change the
      abbreviation if something else becomes popular across areas
      observing -07, and may change it to "-07" if no alphabetic
      consensus emerges.

  Changes to code

    zic no longer mishandles a last transition to a new time type.
    NOTE FOR 2026b TEMPORARY HACK FOR CLDR AND CANADA:
    This zic fix is needed for the temporary hack (mentioned above)
    that works around the Canadian timekeeping bug in Unicode CLDR.
    Without the fix, the temporary hack causes zic versions 2023d
    through 2026a, in their default mode that generates slim output,
    to generate a TZif file that violates Internet RFC 9636 §3.3.
    The buggy file in turn causes some TZif readers, including tzcode
    itself, to ignore America/Vancouver’s 2026-11-01 02:00 transition
    from PDT (tm_isdst=1) to MST (tm_isdst=0).  Although the buggy
    file does not cause any known TZif reader to mishandle UT offsets,
    caution is advised when using zic 2023d through 2026a to compile
    data from more-recent tz releases.  To work around this problem
    when using these older zic versions, use ‘zic -b fat’.

    zic no longer overflows a buffer when generating a TZ string like
    "PST-167:59:58PDT-167:59:59,M11.5.6/-167:59:59,M12.5.6/-167:59:59",
    which can occur with adversarial input.  (Thanks to Naveed Khan.)

    zic no longer generates a longer TZif file than necessary when
    an earlier time zone abbreviation is a suffix of a later one.
    As a nice side effect, zic no longer overflows a buffer when given
    a long series of abbreviations, each a suffix of the next.
    (Buffer overflow reported by Arthur Chan.)

    zic no longer overflows an int when processing input like ‘Zone
    Ouch 2147483648:00:00 - LMT’.  The int overflow can lead to buffer
    overflow in adversarial cases.  (Thanks to Naveed Khan.)

    zic now checks for signals more often.
