import { round } from "./math"

export {
  parseHrtimeToSeconds,
  parseHrtimeToMs,
  convertHrtime
}

function parseHrtimeToSeconds(hrtime: ReturnType<NodeJS.HRTime>) {
  return round(hrtime[0] + hrtime[1] / 1e9, 1000) 
}

function parseHrtimeToMs(hrtime: ReturnType<NodeJS.HRTime>) {
  return round((hrtime[0] * 1e6 + hrtime[1] / 1000), 1000)
}

/** @todo Rename to smth like `convertBigIntTime `*/
function convertHrtime(hrtime: bigint) {
	const number = Number(hrtime),
	  milliseconds = number / 1000000,
	  seconds = milliseconds / 1000

	return {
		seconds,
		milliseconds,
		"nanoseconds": hrtime
	};
}