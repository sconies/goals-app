#!/bin/sh
# usage: txt.sh viewer path  -> page text of <main>
curl -s -b "as=$1" "http://localhost:4173$2" | sed -e 's/<script[^>]*>.*<\/script>//g' | python3 -c "
import sys,re,html
s=sys.stdin.read()
m=re.search(r'<main[^>]*>(.*)</main>',s,re.S)
s=m.group(1) if m else s
s=re.sub(r'<(script|style)[^>]*>.*?</\1>','',s,flags=re.S)
s=re.sub(r'<(br|/p|/div|/li|/h[1-6]|/a|/section|/summary)[^>]*>','\n',s)
s=re.sub(r'<[^>]+>','',s)
print(re.sub(r'\n\s*\n+','\n',html.unescape(s)).strip()[:int(sys.argv[1]) if len(sys.argv)>1 else 3000])
" ${3:-2500}
