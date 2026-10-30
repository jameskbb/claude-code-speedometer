// Every theme beyond the three built into register.tsx: one file each, in
// the order /config lists them. A new theme adds its file and a line here.

import { theme as bars } from './bars'
import { theme as rings } from './rings'
import { theme as battery } from './battery'
import { theme as digital } from './digital'
import { theme as columns } from './columns'
import { theme as lamborghiniHuracan } from './lamborghini-huracan'
import { theme as porsche911 } from './porsche-911'
import { theme as ferrariF40 } from './ferrari-f40'
import { theme as tronLightcycle } from './tron-lightcycle'
import { theme as f1Wheel } from './f1-wheel'
import { theme as skylineR34 } from './skyline-r34'
import { theme as knightRider } from './knight-rider'
import { theme as belAir1957 } from './bel-air-1957'
import { theme as delorean } from './delorean'
import { theme as wrxGc8 } from './wrx-gc8'
import { theme as vuMeter } from './vu-meter'
import { theme as weatherStation } from './weather-station'
import { theme as steampunk } from './steampunk'
import { theme as hourglass } from './hourglass'
import { theme as retroArcade } from './retro-arcade'

import type { ThemeDef } from './kit'

export const EXTRA: ThemeDef[] = [bars, rings, battery, digital, columns, lamborghiniHuracan, porsche911, ferrariF40, tronLightcycle, f1Wheel, skylineR34, knightRider, belAir1957, delorean, wrxGc8, vuMeter, weatherStation, steampunk, hourglass, retroArcade]
