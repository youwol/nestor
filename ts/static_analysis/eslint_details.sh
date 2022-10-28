#!/usr/bin/env sh

echo "::group::yarn eslint -f unix"
files=$(yarn -s eslint --quiet -f unix .); echo "${files}"
echo "::endgroup::"

last_line=$(echo "$files" | tail -n1)
title="ESlint has detected some problems"
echo "::error title=${title}::$last_line. See annotations or job logs for details"

IFS="
"
for file in $(echo "${files}" | head -n -1); do
  path=$(echo ${file} | awk -F ':' '{print $1}')
  line=$(echo ${file} | awk -F ':' '{print $2}')
  col=$(echo ${file} | awk -F ':' '{print $3}')
  msg=$(echo ${file} | awk -F ':' '{print $4}')
  echo "::error title=$title,file=$path,line=$line,col=$col::$msg"
done
