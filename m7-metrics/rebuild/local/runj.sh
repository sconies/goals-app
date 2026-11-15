cd "$(dirname "$0")/.."
JOURNEY_PORT=47201 node tests/journeys.mjs > local/j-on.out 2>&1; echo "on exit $?" >> local/j-on.out
JOURNEY_PORT=47202 FARO_OFF=metrics node tests/journeys.mjs > local/j-off.out 2>&1; echo "off exit $?" >> local/j-off.out
JOURNEY_PORT=47203 FARO_WITHOUT=metrics node tests/journeys.mjs > local/j-without.out 2>&1; echo "without exit $?" >> local/j-without.out
