#!/usr/bin/env sh

echo "::group::yarn prettier logs"
files=$(yarn -s prettier --list-different .) && echo $files
echo "::endgroup::"

title="Prettier has detected some problems"
echo "::error title=${title}::See annotations or job logs for details"
for file in ${files} ; do
  echo "::error file=${file},title=${title}::Mal-formatted file"
done
