// Every theme beyond the three built into register.tsx: one file each, in
// the order /config lists them. A new theme adds its file and a line here.

import { theme as bars } from './bars'
import { theme as rings } from './rings'
import { theme as battery } from './battery'
import { theme as digital } from './digital'
import { theme as columns } from './columns'
import { theme as hexSupercar } from './hex-supercar'
import { theme as fiveDialSports } from './five-dial-sports'
import { theme as spartanSupercar } from './spartan-supercar'
import { theme as neonGrid } from './neon-grid'
import { theme as raceWheel } from './race-wheel'
import { theme as boostScreen } from './boost-screen'
import { theme as scannerDash } from './scanner-dash'
import { theme as fiftiesChrome } from './fifties-chrome'
import { theme as chronoConsole } from './chrono-console'
import { theme as ninetiesRally } from './nineties-rally'
import { theme as vuMeter } from './vu-meter'
import { theme as weatherStation } from './weather-station'
import { theme as steampunk } from './steampunk'
import { theme as hourglass } from './hourglass'
import { theme as retroArcade } from './retro-arcade'

import type { ThemeDef } from './kit'

export const EXTRA: ThemeDef[] = [bars, rings, battery, digital, columns, hexSupercar, fiveDialSports, spartanSupercar, neonGrid, raceWheel, boostScreen, scannerDash, fiftiesChrome, chronoConsole, ninetiesRally, vuMeter, weatherStation, steampunk, hourglass, retroArcade]
