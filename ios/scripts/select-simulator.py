#!/usr/bin/env python3
import json,os,subprocess
devices=json.loads(subprocess.check_output(['xcrun','simctl','list','devices','available','-j']))['devices']
choices=[d for runtime,group in devices.items() if 'iOS-' in runtime for d in group if d.get('isAvailable') and 'iPad' in d['name']]
if not choices:raise SystemExit('No iPad simulator installed for this Xcode')
device=choices[0]
with open(os.environ['GITHUB_ENV'],'a') as env:env.write('BANDPILOT_SIMULATOR='+device['udid']+'\n')
print('Selected iPad simulator:',device['name'],device['udid'])
