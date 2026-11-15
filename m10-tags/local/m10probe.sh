B=http://localhost:47317
J=local/m10jar; rm -f $J
c() { curl -s -b "as=$1" "${@:2}"; }
c amara -o /dev/null -w "add %{http_code} %{redirect_url}\n" -X POST -d "name=Stage&kind=list&values=Discover%0ABuild%0ARun" $B/workspace/fields/add
c amara $B/workspace/fields | grep -o "A list: [^<]*\|[0-9]* goals\? ha[sv]e\? a value"
c amara -X POST -d "name=stage&kind=list&values=a" $B/workspace/fields/add | grep -o "There’s already[^<]*"
FID=$(c amara $B/workspace/fields | grep -o 'data-change="[^"]*"' | head -1 | cut -d'"' -f2); echo FID=$FID
c amara -o /dev/null -w "set %{http_code}\n" -X POST -d "field=$FID&value=Discover" $B/goals/lead-flaky/fields
c amara -o /dev/null -X POST -d "field=$FID&value=build" $B/goals/lead-flaky/fields
c amara -o /dev/null -X POST -d "field=$FID&value=Discover" $B/goals/ci-docker/fields
c amara $B/goals/lead-flaky | grep -o "Stage · [A-Za-z ]*\|Stage: Discover → Build" | sort -u
c tunde -o /dev/null -w "tunde %{redirect_url}\n" -X POST -d "field=$FID&value=Run" $B/goals/lead-flaky/fields
c amara "$B/goals?scope=all&f.$FID=Build" | grep -o "Remove the filter Stage is Build\|Flaky test rate in the main pipelines\|Base image build time\|[0-9]* goals\? match" | sort -u
c amara "$B/data/export" > local/m10export.csv; head -c 300 local/m10export.csv; echo
python3 -c "
import urllib.parse,sys
t=open('local/m10export.csv',encoding='utf-8-sig').read()
print(urllib.parse.urlencode({'name':'export.csv','file':t}))" > local/m10body
c amara -X POST --data-binary @local/m10body $B/data/import | grep -o "Nothing would change\|Read [^<]*\|Must fix[^<]*\|<legend>[^<]*\|Save [0-9]* change"
printf 'Key,Goal,Stage\nG-15,x,Operate\nG-23,y,operate\n' > local/stages.csv
python3 -c "
import urllib.parse
t=open('local/stages.csv').read()
print(urllib.parse.urlencode({'name':'stages.csv','file':t}))" > local/m10body2
c amara -X POST --data-binary @local/m10body2 $B/data/import | grep -o "Nothing would change\|Read [^<]*\|Must fix[^<]*\|<legend>[^<]*\|Save [0-9]* changes\?"
curl -s -b as=amara -X POST -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find_goals","arguments":{"fields":{"Stage":"Build"}}}}' $B/mcp; echo
curl -s -b as=amara -X POST -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_fields","arguments":{}}}' $B/mcp; echo
