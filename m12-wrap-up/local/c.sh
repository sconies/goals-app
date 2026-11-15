#!/bin/bash
# usage: c.sh cookie path [n]
O=$(mktemp); code=$(curl -s -o $O -w "%{http_code}" -b "$1" "http://localhost:47430$2")
python3 -c "
import re,sys
s=open('$O').read(); m=re.search(r'<main.*?</main>',s,re.S); s=m.group(0) if m else s
s=re.sub(r'<(script|style)[^>]*>.*?</\1>','',s,flags=re.S); s=re.sub(r'<[^>]+>',' ',s); s=re.sub(r'\s+',' ',s)
print('$code', s[:int('${3:-600}')])"
rm $O
