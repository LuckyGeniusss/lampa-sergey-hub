#!/bin/bash
set -e
LABEL="com.sergey.lampa-backend"
launchctl print "gui/$(id -u)/$LABEL" | grep -E 'state =|pid =|last exit code' || true

echo
curl -fsS --max-time 5 'http://127.0.0.1:18118/version?type=hash'
echo
