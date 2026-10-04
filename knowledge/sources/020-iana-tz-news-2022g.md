---
title: IANA Time Zone Database — tz database NEWS - Release 2022g
url: https://data.iana.org/time-zones/tzdb/NEWS
authority: secondary
kind: tzdata-release
publisher: IANA Time Zone Database
published: 2022-11-29
fetched: 2026-10-04
language: en
phase: A
---
Release 2022g - 2022-11-29 08:58:31 -0800

  Briefly:
    The northern edge of Chihuahua changes to US timekeeping.
    Much of Greenland stops changing clocks after March 2023.
    Fix some pre-1996 timestamps in northern Canada.
    C89 is now deprecated; please use C99 or later.
    Portability fixes for AIX, libintl, MS-Windows, musl, z/OS
    In C code, use more C23 features if available.
    C23 timegm now supported by default
    Fixes for unlikely integer overflows

  Changes to future timestamps

    In the Mexican state of Chihuahua, the border strip near the US
    will change to agree with nearby US locations on 2022-11-30.
    The strip's western part, represented by Ciudad Juárez, switches
    from -06 all year to -07/-06 with US DST rules, like El Paso, TX.
    The eastern part, represented by Ojinaga, will observe US DST next
    year, like Presidio, TX.  (Thanks to Heitor David Pinto.)
    A new Zone America/Ciudad_Juarez splits from America/Ojinaga.

    Much of Greenland, represented by America/Nuuk, stops observing
    winter time after March 2023, so its daylight saving time becomes
    standard time.  (Thanks to Jonas Nyrup and Jürgen Appel.)

  Changes to past timestamps

    Changes for pre-1996 northern Canada (thanks to Chris Walton):

      Merge America/Iqaluit and America/Pangnirtung into the former,
      with a backward compatibility link for the latter name.
      There is no good evidence the two locations differ since 1970.
      This change affects pre-1996 America/Pangnirtung timestamps.

      Cambridge Bay, Inuvik, Iqaluit, Rankin Inlet, Resolute and
      Yellowknife did not observe DST in 1965, and did observe DST
      from 1972 through 1979.

      Whitehorse moved from -09 to -08 on 1966-02-27, not 1967-05-28.

    Colombia's 1993 fallback was 02-06 24:00, not 04-04 00:00.
    (Thanks to Alois Treindl.)

    Singapore's 1981-12-31 change was at 16:00 UTC (23:30 local time),
    not 24:00 local time.  (Thanks to Geoff Clare via Robert Elz.)

  Changes to code

    Although tzcode still works with C89, bugs found in recent routine
    maintenance indicate that bitrot has set in and that in practice
    C89 is no longer used to build tzcode.  As it is a maintenance
    burden, support for C89 is planned to be removed soon.  Instead,
    please use compilers compatible with C99, C11, C17, or C23.

    timegm, which tzcode implemented in 1989, will finally be
    standardized 34 years later as part of C23, so timegm is now
    supported even if STD_INSPIRED is not defined.

    Fix bug in zdump's tzalloc emulation on hosts that lack tm_zone.
    (Problem reported by Đoàn Trần Công Danh.)

    Fix bug in zic on hosts where malloc(0) yields NULL on success.
    (Problem reported by Tim McBrayer for AIX 6.1.)

    Fix zic configuration to avoid linkage failures on some platforms.
    (Problems reported by Gilmore Davidson and Igor Ivanov.)

    Work around MS-Windows nmake incompatibility with POSIX.
    (Problem reported by Manuela Friedrich.)

    Port mktime and strftime to debugging platforms where accessing
    uninitialized data has undefined behavior (strftime problem
    reported by Robert Elz).

    Check more carefully for unlikely integer overflows, preferring
    C23 <stdckdint.h> to overflow checking by hand, as the latter has
    had obscure bugs.

  Changes to build procedure

    New Makefile rule check_mild that skips checking whether Link
    lines are in the file 'backward'.  (Inspired by a suggestion from
    Stephen Colebourne.)
