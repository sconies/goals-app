# post.sh <as> <file> <name> : posts a file as an import and prints the check page's text
base64 -w0 "$2" > local/b64.txt
curl -s -o /dev/null -b "as=$1" --data-urlencode "file=$3" --data-urlencode "data@local/b64.txt" http://localhost:4180/data/import/check
curl -s -b "as=$1" http://localhost:4180/data/import/check | python3 -c "import sys,re;h=sys.stdin.read();h=re.sub(r\"(?s)<(script|style).*?</\\1>\",\"\",h);print(re.sub(r\"\\s+\",\" \",re.sub(r\"<[^>]+>\",\" \",h))[:int(sys.argv[1])])" ${4:-3000}; echo
