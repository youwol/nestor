#!/usr/bin/env sh

jq_cmd='if .status == "py-youwol ok" then halt else error ("incorrect status from py-youwol") end'

# wait for py-youwol readiness
echo "::group::Trying at most 10 times to call healtz endpoint, waiting 1 seconde between retries"
for try in $(seq 1 1 10); do
  echo "try $try/10 to contact py-youwol instance"
  response=$(curl --silent 'http://localhost:2001/healthz' || echo "No response")
  if echo "${response}" | jq -e "${jq_cmd}"; then
    echo "Success : py-youwol is ready"
    echo "::endgroup::"
    exit 0
  else
    echo "Invalid response '${response}'."
    echo "Retrying in 1 second"
    sleep 1
  fi
done
# If execution flow is here, something went wrong
echo "::endgroup::"
echo "::error::Failed to contact py-youwol instance after 10 seconds"
exit 1
