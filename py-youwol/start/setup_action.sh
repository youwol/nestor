#!/usr/bin/env sh

# A random string for this action execution
random=$(awk 'BEGIN { srand(); print int(rand()*32768) }' /dev/null | base64)

# Variables definition
config=$INPUTS_CONF_PATH
sources=$INPUTS_PATH
py_youwol_checkout="false"

## Actions parameters

# Conf repository
if [ -n "$INPUTS_CONF_REPOSITORY" ]; then
  # If using a conf repository, output its checkout, its directory and a config path inside
  checkout_path=".py-youwol_start_conf_${random}"
  conf_dir="$RUNNER_TEMP/py-youwol_start_conf_${random}"
  config="${conf_dir}/$INPUTS_CONF_PATH"
fi

# Py-Youwol sources
if [ -z "${sources}" ]; then
  # Sources will be checkout
  py_youwol_checkout="true"
  sources="$RUNNER_TEMP/py-youwol_${random}"
fi

## Set Step outputs
{
  echo "conf-checkout-path=${checkout_path}"
  echo "conf-directory=${conf_dir}"
  echo "config=${config}"
  echo "sources=${sources}"
  echo "py-youwol_checkout=${py_youwol_checkout}"
} >> "$GITHUB_OUTPUT"

## Summary
echo "action outputs :"
cat "$GITHUB_OUTPUT"
