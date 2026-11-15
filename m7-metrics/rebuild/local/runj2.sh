cd "$(dirname "$0")/.."
JOURNEY_PORT=47241 node tests/journeys.mjs > local/j-on.out 2>&1; echo "on exit $?" >> local/j-on.out
JOURNEY_PORT=47243 FARO_WITHOUT=metrics node tests/journeys.mjs > local/j-without.out 2>&1; echo "without exit $?" >> local/j-without.out
JOURNEY_PORT=47242 FARO_OFF=metrics node tests/journeys.mjs > local/j-off.out 2>&1; echo "off exit $?" >> local/j-off.out
node tests/platform.mjs > local/platform.out 2>&1; echo "platform exit $?" >> local/platform.out
