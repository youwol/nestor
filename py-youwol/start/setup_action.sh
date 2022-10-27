#!/usr/bin/env sh

# A random string for this action execution
random=$(awk 'BEGIN { srand(); print int(rand()*32768) }' /dev/null | base64)

# Variables definition
work_dir="${RUNNER_TEMP}/py-youwol_start_working_dir_${random}"
coveragerc_path="${work_dir}/.coveragerc"

# Set up working directory
mkdir -p "${work_dir}"

# Set up coverage conf
cat  << _coverage_rc > "${coveragerc_path}"
[run]
branch = True
data_file = coverage.coverage
debug = sys,config
_coverage_rc

## Actions parameters

# Conf repository
if [ -n "$INPUTS_CONF_REPOSITORY" ]; then
  # If using a conf repository, output its checkout, its directory and a config path inside
  checkout_path=".py-youwol_start_conf_${random}"
  conf_dir="$RUNNER_TEMP/py-youwol_start_conf_${random}"
  {
    echo "conf-checkout-path=${checkout_path}"
    echo "conf-directory=${conf_dir}"
    echo "config=${conf_dir}/$INPUTS_CONF_PATH"
  } >> "$GITHUB_OUTPUT"
else
  # Not using a conf repository, config path is relative to workspace
  echo "config=$INPUTS_CONF_PATH" >> "$GITHUB_OUTPUT"
fi

# Py-Youwol sources
if [ -n "$INPUTS_PATH" ]; then
  # Sources are already there
  echo "sources=$INPUTS_PATH" >> "$GITHUB_OUTPUT"
else
  # Sources will be checkout
  echo "py-youwol-checkout=true" >> "$GITHUB_OUTPUT"
  echo "sources=$RUNNER_TEMP/py-youwol_${random}" >> "$GITHUB_OUTPUT"
fi

echo "instance=${work_dir}" >> "$GITHUB_OUTPUT"

## Summary
echo "action outputs :"
cat "$GITHUB_OUTPUT"
